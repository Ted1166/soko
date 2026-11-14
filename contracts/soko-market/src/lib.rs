mod admin;
mod constants;
mod events;
mod goods;
mod ledger;
mod market;
mod npc;
mod policy;
mod stall;
mod views;

#[cfg(test)]
mod tests;

use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{near, AccountId, BorshStorageKey, PanicOnDefault};

use crate::goods::Good;
use crate::ledger::Ledger;
use crate::market::Listing;
use crate::npc::Npc;
use crate::stall::Stall;

#[near(serializers = [borsh])]
#[derive(BorshStorageKey)]
pub enum StorageKey {
    Coins,
    Held,
    Catalog,
    Stalls,
    Npcs,
    Listings,
    ListingCounts,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    pub(crate) owner: AccountId,
    pub(crate) ledger: Ledger,
    pub(crate) catalog: IterableMap<String, Good>,
    pub(crate) stalls: IterableMap<AccountId, Stall>,
    pub(crate) npcs: LookupMap<AccountId, Npc>,
    pub(crate) listings: IterableMap<u64, Listing>,
    pub(crate) listing_counts: LookupMap<AccountId, u32>,
    pub(crate) next_listing_id: u64,
    pub(crate) next_npc_id: u64,
}

#[near]
impl Contract {
    #[init]
    pub fn new(owner: AccountId) -> Self {
        let mut contract = Self {
            owner,
            ledger: Ledger::new(),
            catalog: IterableMap::new(StorageKey::Catalog),
            stalls: IterableMap::new(StorageKey::Stalls),
            npcs: LookupMap::new(StorageKey::Npcs),
            listings: IterableMap::new(StorageKey::Listings),
            listing_counts: LookupMap::new(StorageKey::ListingCounts),
            next_listing_id: 1,
            next_npc_id: 1,
        };
        contract.seed_catalog();
        contract
    }
}
