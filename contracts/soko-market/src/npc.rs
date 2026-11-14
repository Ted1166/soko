use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::{env, near, require, AccountId, Allowance, Promise, PublicKey};

use crate::constants::{
    MAX_NPCS_PER_STALL, NANOS_PER_DAY, NPC_KEY_ALLOWANCE, NPC_METHODS, NPC_MIN_DEPOSIT,
};
use crate::events;
use crate::policy::Policy;
use crate::{Contract, ContractExt};

#[near(serializers = [borsh])]
#[derive(Clone)]
pub struct Npc {
    pub account: AccountId,
    pub stall_owner: AccountId,
    pub name: String,
    pub persona: String,
    pub policy: Policy,
    pub spent_today: u128,
    pub spend_day: u64,
    pub active: bool,
}

fn slug_from(name: &str) -> String {
    let slug: String = name
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .map(|c| c.to_ascii_lowercase())
        .take(12)
        .collect();
    if slug.is_empty() {
        "trader".to_string()
    } else {
        slug
    }
}

impl Contract {
    pub(crate) fn assert_npc_owner(&self, npc_id: &AccountId) {
        let npc = self
            .npcs
            .get(npc_id)
            .unwrap_or_else(|| env::panic_str("NPC not found"));
        require!(
            env::predecessor_account_id() == npc.stall_owner,
            "Only the stall owner can do this"
        );
    }

    pub(crate) fn controller_of(&self, account: &AccountId) -> AccountId {
        match self.npcs.get(account) {
            Some(npc) => npc.stall_owner.clone(),
            None => account.clone(),
        }
    }
}

#[near]
impl Contract {
    #[payable]
    pub fn spawn_npc(
        &mut self,
        name: String,
        persona: String,
        public_key: PublicKey,
        policy: Policy,
    ) -> Promise {
        let owner = env::predecessor_account_id();
        require!(!self.npcs.contains_key(&owner), "NPCs cannot spawn NPCs");
        let deposit = env::attached_deposit();
        require!(
            deposit >= NPC_MIN_DEPOSIT,
            "Attach at least 0.1 NEAR to cover the NPC's gas"
        );
        let name = name.trim().to_string();
        require!(
            (2..=24).contains(&name.chars().count()),
            "NPC name must be 2 to 24 characters"
        );
        require!(persona.chars().count() <= 280, "Persona is too long");
        self.validate_policy(&policy);
        let stall = self
            .stalls
            .get(&owner)
            .unwrap_or_else(|| env::panic_str("Open a stall first"));
        require!(
            stall.npcs.len() < MAX_NPCS_PER_STALL,
            "This stall has reached its NPC limit"
        );
        let id = self.next_npc_id;
        self.next_npc_id += 1;
        let account: AccountId =
            format!("{}-{}.{}", slug_from(&name), id, env::current_account_id())
                .parse()
                .unwrap_or_else(|_| env::panic_str("Could not form the NPC account id"));
        self.npcs.insert(
            account.clone(),
            Npc {
                account: account.clone(),
                stall_owner: owner.clone(),
                name: name.clone(),
                persona,
                policy,
                spent_today: 0,
                spend_day: env::block_timestamp() / NANOS_PER_DAY,
                active: true,
            },
        );
        self.stalls
            .get_mut(&owner)
            .unwrap_or_else(|| env::panic_str("Open a stall first"))
            .npcs
            .push(account.clone());
        events::emit(
            "npc_spawned",
            json!({ "npc": account, "owner": owner, "name": name }),
        );
        let allowance = Allowance::limited(NPC_KEY_ALLOWANCE)
            .unwrap_or_else(|| env::panic_str("Invalid key allowance"));
        Promise::new(account)
            .create_account()
            .transfer(deposit)
            .add_access_key_allowance(
                public_key,
                allowance,
                env::current_account_id(),
                NPC_METHODS.to_string(),
            )
    }

    pub fn fund_npc(&mut self, npc: AccountId, amount: U128) {
        self.assert_npc_owner(&npc);
        require!(amount.0 > 0, "Amount must be above zero");
        let owner = env::predecessor_account_id();
        self.ledger.move_coins(&owner, &npc, amount.0);
        events::emit(
            "npc_funded",
            json!({ "npc": npc, "amount": amount.0.to_string() }),
        );
    }

    pub fn defund_npc(&mut self, npc: AccountId, amount: U128) {
        self.assert_npc_owner(&npc);
        require!(amount.0 > 0, "Amount must be above zero");
        let owner = env::predecessor_account_id();
        self.ledger.move_coins(&npc, &owner, amount.0);
        events::emit(
            "npc_defunded",
            json!({ "npc": npc, "amount": amount.0.to_string() }),
        );
    }

    pub fn stock_npc(&mut self, npc: AccountId, good: String, qty: U128) {
        self.assert_npc_owner(&npc);
        require!(qty.0 > 0, "Quantity must be above zero");
        let owner = env::predecessor_account_id();
        self.ledger.move_goods(&owner, &npc, &good, qty.0);
        events::emit(
            "npc_stocked",
            json!({ "npc": npc, "good": good, "qty": qty.0.to_string() }),
        );
    }

    pub fn unstock_npc(&mut self, npc: AccountId, good: String, qty: U128) {
        self.assert_npc_owner(&npc);
        require!(qty.0 > 0, "Quantity must be above zero");
        let owner = env::predecessor_account_id();
        self.ledger.move_goods(&npc, &owner, &good, qty.0);
        events::emit(
            "npc_unstocked",
            json!({ "npc": npc, "good": good, "qty": qty.0.to_string() }),
        );
    }

    pub fn set_policy(&mut self, npc: AccountId, policy: Policy) {
        self.assert_npc_owner(&npc);
        self.validate_policy(&policy);
        self.npcs
            .get_mut(&npc)
            .unwrap_or_else(|| env::panic_str("NPC not found"))
            .policy = policy;
        events::emit("policy_updated", json!({ "npc": npc }));
    }

    pub fn freeze_npc(&mut self, npc: AccountId) {
        self.assert_npc_owner(&npc);
        self.npcs
            .get_mut(&npc)
            .unwrap_or_else(|| env::panic_str("NPC not found"))
            .active = false;
        events::emit("npc_frozen", json!({ "npc": npc }));
    }

    pub fn unfreeze_npc(&mut self, npc: AccountId) {
        self.assert_npc_owner(&npc);
        self.npcs
            .get_mut(&npc)
            .unwrap_or_else(|| env::panic_str("NPC not found"))
            .active = true;
        events::emit("npc_unfrozen", json!({ "npc": npc }));
    }
}
