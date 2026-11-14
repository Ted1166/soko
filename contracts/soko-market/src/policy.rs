use near_sdk::json_types::U128;
use near_sdk::{env, near, require, AccountId};

use crate::constants::NANOS_PER_DAY;
use crate::Contract;

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Policy {
    pub max_trade_value: U128,
    pub daily_cap: U128,
    pub max_premium_bps: u32,
    pub allowed_goods: Vec<String>,
}

impl Contract {
    pub(crate) fn validate_policy(&self, policy: &Policy) {
        require!(
            policy.max_trade_value.0 > 0,
            "Per-trade limit must be above zero"
        );
        require!(
            policy.daily_cap.0 >= policy.max_trade_value.0,
            "Daily cap must cover at least one trade"
        );
        require!(
            policy.max_premium_bps <= 5_000,
            "Price premium cannot exceed 50 percent"
        );
        require!(
            !policy.allowed_goods.is_empty() && policy.allowed_goods.len() <= 8,
            "Allow between 1 and 8 goods"
        );
        for good in &policy.allowed_goods {
            require!(
                self.catalog.contains_key(good.as_str()),
                "Policy lists an unknown good"
            );
        }
    }

    pub(crate) fn authorize_npc_buy(
        &mut self,
        npc_id: &AccountId,
        good_id: &str,
        unit_price: u128,
        value: u128,
    ) {
        let reference = self.reference_price_of(good_id);
        let today = env::block_timestamp() / NANOS_PER_DAY;
        let npc = self
            .npcs
            .get_mut(npc_id)
            .unwrap_or_else(|| env::panic_str("Not an NPC"));
        require!(npc.active, "NPC is frozen");
        require!(
            npc.policy.allowed_goods.iter().any(|g| g == good_id),
            "Good not allowed by policy"
        );
        require!(
            value <= npc.policy.max_trade_value.0,
            "Trade exceeds per-trade limit"
        );
        if npc.spend_day != today {
            npc.spend_day = today;
            npc.spent_today = 0;
        }
        let projected = npc
            .spent_today
            .checked_add(value)
            .unwrap_or_else(|| env::panic_str("Spend overflow"));
        require!(projected <= npc.policy.daily_cap.0, "Daily cap reached");
        let ceiling =
            reference.saturating_mul(10_000 + npc.policy.max_premium_bps as u128) / 10_000;
        require!(unit_price <= ceiling, "Price too far above market");
        npc.spent_today = projected;
    }
}
