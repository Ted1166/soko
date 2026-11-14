use near_sdk::store::LookupMap;
use near_sdk::{env, near, AccountId};

use crate::StorageKey;

#[near(serializers = [borsh])]
pub struct Ledger {
    coins: LookupMap<AccountId, u128>,
    held: LookupMap<(AccountId, String), u128>,
}

impl Ledger {
    pub fn new() -> Self {
        Self {
            coins: LookupMap::new(StorageKey::Coins),
            held: LookupMap::new(StorageKey::Held),
        }
    }

    pub fn coins_of(&self, who: &AccountId) -> u128 {
        self.coins.get(who).copied().unwrap_or(0)
    }

    pub fn held_of(&self, who: &AccountId, good: &str) -> u128 {
        self.held
            .get(&(who.clone(), good.to_string()))
            .copied()
            .unwrap_or(0)
    }

    pub fn credit_coins(&mut self, who: &AccountId, amount: u128) {
        let next = self
            .coins_of(who)
            .checked_add(amount)
            .unwrap_or_else(|| env::panic_str("Coin balance overflow"));
        self.coins.insert(who.clone(), next);
    }

    pub fn debit_coins(&mut self, who: &AccountId, amount: u128) {
        let current = self.coins_of(who);
        if current < amount {
            env::panic_str("Not enough coins");
        }
        self.coins.insert(who.clone(), current - amount);
    }

    pub fn credit_goods(&mut self, who: &AccountId, good: &str, qty: u128) {
        let next = self
            .held_of(who, good)
            .checked_add(qty)
            .unwrap_or_else(|| env::panic_str("Inventory overflow"));
        self.held.insert((who.clone(), good.to_string()), next);
    }

    pub fn debit_goods(&mut self, who: &AccountId, good: &str, qty: u128) {
        let current = self.held_of(who, good);
        if current < qty {
            env::panic_str("Not enough goods in stock");
        }
        self.held
            .insert((who.clone(), good.to_string()), current - qty);
    }

    pub fn move_coins(&mut self, from: &AccountId, to: &AccountId, amount: u128) {
        self.debit_coins(from, amount);
        self.credit_coins(to, amount);
    }

    pub fn move_goods(&mut self, from: &AccountId, to: &AccountId, good: &str, qty: u128) {
        self.debit_goods(from, good, qty);
        self.credit_goods(to, good, qty);
    }
}
