use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::{env, near, require, AccountId};

use crate::constants::{MAX_LISTINGS_PER_TRADER, MAX_PRICE, MAX_QTY};
use crate::events;
use crate::{Contract, ContractExt};

#[near(serializers = [borsh])]
#[derive(Clone)]
pub struct Listing {
    pub id: u64,
    pub seller: AccountId,
    pub good: String,
    pub qty: u128,
    pub unit_price: u128,
    pub listed_at: u64,
}

impl Contract {
    pub(crate) fn require_active_trader(&self, who: &AccountId) {
        match self.npcs.get(who) {
            Some(npc) => require!(npc.active, "NPC is frozen"),
            None => require!(self.stalls.contains_key(who), "Open a stall first"),
        }
    }

    fn open_listings(&self, who: &AccountId) -> u32 {
        self.listing_counts.get(who).copied().unwrap_or(0)
    }

    fn add_listing_count(&mut self, who: &AccountId) {
        let next = self.open_listings(who) + 1;
        self.listing_counts.insert(who.clone(), next);
    }

    fn drop_listing_count(&mut self, who: &AccountId) {
        let next = self.open_listings(who).saturating_sub(1);
        self.listing_counts.insert(who.clone(), next);
    }
}

#[near]
impl Contract {
    pub fn list_goods(&mut self, good: String, qty: U128, unit_price: U128) -> u64 {
        let seller = env::predecessor_account_id();
        self.require_active_trader(&seller);
        require!(qty.0 > 0 && qty.0 <= MAX_QTY, "Quantity out of range");
        require!(
            unit_price.0 > 0 && unit_price.0 <= MAX_PRICE,
            "Price out of range"
        );
        require!(self.catalog.contains_key(good.as_str()), "Unknown good");
        if let Some(npc) = self.npcs.get(&seller) {
            require!(
                npc.policy.allowed_goods.iter().any(|g| *g == good),
                "Good not allowed by policy"
            );
        }
        require!(
            self.open_listings(&seller) < MAX_LISTINGS_PER_TRADER,
            "Too many open listings"
        );
        let escrow = env::current_account_id();
        self.ledger.move_goods(&seller, &escrow, &good, qty.0);
        let id = self.next_listing_id;
        self.next_listing_id += 1;
        self.listings.insert(
            id,
            Listing {
                id,
                seller: seller.clone(),
                good: good.clone(),
                qty: qty.0,
                unit_price: unit_price.0,
                listed_at: env::block_timestamp(),
            },
        );
        self.add_listing_count(&seller);
        events::emit(
            "listed",
            json!({
                "listing": id,
                "seller": seller,
                "good": good,
                "qty": qty.0.to_string(),
                "unit_price": unit_price.0.to_string(),
            }),
        );
        id
    }

    pub fn reprice_listing(&mut self, listing_id: u64, unit_price: U128) {
        let caller = env::predecessor_account_id();
        self.require_active_trader(&caller);
        require!(
            unit_price.0 > 0 && unit_price.0 <= MAX_PRICE,
            "Price out of range"
        );
        let listing = self
            .listings
            .get_mut(&listing_id)
            .unwrap_or_else(|| env::panic_str("Listing not found"));
        require!(listing.seller == caller, "Only the seller can reprice");
        let previous = listing.unit_price;
        listing.unit_price = unit_price.0;
        events::emit(
            "repriced",
            json!({
                "listing": listing_id,
                "seller": caller,
                "from": previous.to_string(),
                "to": unit_price.0.to_string(),
            }),
        );
    }

    pub fn cancel_listing(&mut self, listing_id: u64) {
        let caller = env::predecessor_account_id();
        self.require_active_trader(&caller);
        let listing = self
            .listings
            .get(&listing_id)
            .cloned()
            .unwrap_or_else(|| env::panic_str("Listing not found"));
        require!(listing.seller == caller, "Only the seller can cancel");
        self.listings.remove(&listing_id);
        self.drop_listing_count(&caller);
        let escrow = env::current_account_id();
        self.ledger
            .move_goods(&escrow, &caller, &listing.good, listing.qty);
        events::emit(
            "cancelled",
            json!({ "listing": listing_id, "seller": caller }),
        );
    }

    pub fn buy_goods(&mut self, listing_id: u64, qty: U128) {
        let buyer = env::predecessor_account_id();
        self.require_active_trader(&buyer);
        require!(qty.0 > 0, "Quantity must be above zero");
        let listing = self
            .listings
            .get(&listing_id)
            .cloned()
            .unwrap_or_else(|| env::panic_str("Listing not found"));
        require!(qty.0 <= listing.qty, "Not enough quantity listed");
        require!(
            self.controller_of(&buyer) != self.controller_of(&listing.seller),
            "Cannot trade with your own stall"
        );
        let value = listing
            .unit_price
            .checked_mul(qty.0)
            .unwrap_or_else(|| env::panic_str("Trade value overflow"));
        if self.npcs.contains_key(&buyer) {
            self.authorize_npc_buy(&buyer, &listing.good, listing.unit_price, value);
        }
        self.ledger.move_coins(&buyer, &listing.seller, value);
        let escrow = env::current_account_id();
        self.ledger
            .move_goods(&escrow, &buyer, &listing.good, qty.0);
        if qty.0 == listing.qty {
            self.listings.remove(&listing_id);
            self.drop_listing_count(&listing.seller);
        } else {
            self.listings
                .get_mut(&listing_id)
                .unwrap_or_else(|| env::panic_str("Listing not found"))
                .qty -= qty.0;
        }
        self.record_trade(&listing.good, listing.unit_price, qty.0);
        events::emit(
            "trade",
            json!({
                "listing": listing_id,
                "buyer": buyer,
                "seller": listing.seller,
                "good": listing.good,
                "qty": qty.0.to_string(),
                "unit_price": listing.unit_price.to_string(),
                "value": value.to_string(),
            }),
        );
    }
}
