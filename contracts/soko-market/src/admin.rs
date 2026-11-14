use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::{env, near, require, AccountId};

use crate::constants::{MAX_PRICE, MAX_QTY};
use crate::events;
use crate::goods::Good;
use crate::{Contract, ContractExt};

impl Contract {
    pub(crate) fn assert_owner(&self) {
        require!(
            env::predecessor_account_id() == self.owner,
            "Only the game admin can do this"
        );
    }
}

#[near]
impl Contract {
    pub fn add_good(&mut self, id: String, name: String, base_price: U128) {
        self.assert_owner();
        require!(
            (2..=16).contains(&id.len())
                && id
                    .chars()
                    .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit()),
            "Good id must be 2 to 16 lowercase letters or digits"
        );
        require!(
            (2..=24).contains(&name.chars().count()),
            "Good name must be 2 to 24 characters"
        );
        require!(
            base_price.0 > 0 && base_price.0 <= MAX_PRICE,
            "Base price out of range"
        );
        require!(
            !self.catalog.contains_key(id.as_str()),
            "Good already exists"
        );
        self.catalog.insert(
            id.clone(),
            Good {
                id: id.clone(),
                name,
                base_price: base_price.0,
                reference_price: base_price.0,
                volume: 0,
            },
        );
        events::emit(
            "good_added",
            json!({ "id": id, "base_price": base_price.0.to_string() }),
        );
    }

    pub fn mint_coins(&mut self, to: AccountId, amount: U128) {
        self.assert_owner();
        require!(amount.0 > 0, "Amount must be above zero");
        self.ledger.credit_coins(&to, amount.0);
        events::emit(
            "coins_minted",
            json!({ "to": to, "amount": amount.0.to_string() }),
        );
    }

    pub fn mint_goods(&mut self, to: AccountId, good: String, qty: U128) {
        self.assert_owner();
        require!(self.catalog.contains_key(good.as_str()), "Unknown good");
        require!(qty.0 > 0 && qty.0 <= MAX_QTY, "Quantity out of range");
        self.ledger.credit_goods(&to, &good, qty.0);
        events::emit(
            "goods_minted",
            json!({ "to": to, "good": good, "qty": qty.0.to_string() }),
        );
    }
}
