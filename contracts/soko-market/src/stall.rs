use near_sdk::serde_json::json;
use near_sdk::{env, near, require, AccountId};

use crate::constants::STARTER_COINS;
use crate::events;
use crate::{Contract, ContractExt};

#[near(serializers = [borsh])]
#[derive(Clone)]
pub struct Stall {
    pub owner: AccountId,
    pub name: String,
    pub npcs: Vec<AccountId>,
    pub opened_at: u64,
}

#[near]
impl Contract {
    pub fn open_stall(&mut self, name: String) {
        let owner = env::predecessor_account_id();
        require!(
            owner != env::current_account_id(),
            "The market account cannot open a stall"
        );
        require!(!self.npcs.contains_key(&owner), "NPCs cannot open stalls");
        require!(!self.stalls.contains_key(&owner), "Stall already open");
        let name = name.trim().to_string();
        require!(
            (2..=32).contains(&name.chars().count()),
            "Stall name must be 2 to 32 characters"
        );
        self.stalls.insert(
            owner.clone(),
            Stall {
                owner: owner.clone(),
                name: name.clone(),
                npcs: Vec::new(),
                opened_at: env::block_timestamp(),
            },
        );
        self.ledger.credit_coins(&owner, STARTER_COINS);
        events::emit("stall_opened", json!({ "owner": owner, "name": name }));
    }
}
