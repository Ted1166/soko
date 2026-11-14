use near_sdk::{env, near};

use crate::constants::MAX_PRICE;
use crate::Contract;

#[near(serializers = [borsh])]
#[derive(Clone)]
pub struct Good {
    pub id: String,
    pub name: String,
    pub base_price: u128,
    pub reference_price: u128,
    pub volume: u128,
}

const DEFAULT_GOODS: [(&str, &str, u128); 6] = [
    ("maize", "Maize", 40),
    ("rice", "Rice", 90),
    ("tea", "Tea", 70),
    ("charcoal", "Charcoal", 55),
    ("kanga", "Kanga cloth", 300),
    ("mandazi", "Mandazi", 15),
];

impl Contract {
    pub(crate) fn seed_catalog(&mut self) {
        for (id, name, price) in DEFAULT_GOODS {
            self.catalog.insert(
                id.to_string(),
                Good {
                    id: id.to_string(),
                    name: name.to_string(),
                    base_price: price,
                    reference_price: price,
                    volume: 0,
                },
            );
        }
    }

    pub(crate) fn reference_price_of(&self, good_id: &str) -> u128 {
        self.catalog
            .get(good_id)
            .unwrap_or_else(|| env::panic_str("Unknown good"))
            .reference_price
    }

    pub(crate) fn record_trade(&mut self, good_id: &str, unit_price: u128, qty: u128) {
        let good = self
            .catalog
            .get_mut(good_id)
            .unwrap_or_else(|| env::panic_str("Unknown good"));
        let low = (good.reference_price * 80 / 100).max(1);
        let high = (good.reference_price * 120 / 100).max(low);
        let effective = unit_price.clamp(low, high);
        let blended = good
            .reference_price
            .saturating_mul(3)
            .saturating_add(effective)
            / 4;
        let floor = (good.base_price / 2).max(1);
        let ceiling = good.base_price.saturating_mul(2).min(MAX_PRICE);
        good.reference_price = blended.clamp(floor, ceiling);
        good.volume = good.volume.saturating_add(qty);
    }
}
