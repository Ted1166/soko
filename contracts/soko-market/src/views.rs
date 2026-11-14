use near_sdk::json_types::{U128, U64};
use near_sdk::{env, near, AccountId};

use crate::constants::NANOS_PER_DAY;

use crate::policy::Policy;
use crate::{Contract, ContractExt};

#[near(serializers = [json])]
pub struct GoodView {
    pub id: String,
    pub name: String,
    pub base_price: U128,
    pub reference_price: U128,
    pub volume: U128,
}

#[near(serializers = [json])]
pub struct HeldView {
    pub good: String,
    pub qty: U128,
}

#[near(serializers = [json])]
pub struct ListingView {
    pub id: u64,
    pub seller: AccountId,
    pub good: String,
    pub qty: U128,
    pub unit_price: U128,
    pub listed_at: U64,
}

#[near(serializers = [json])]
pub struct NpcView {
    pub account: AccountId,
    pub stall_owner: AccountId,
    pub name: String,
    pub persona: String,
    pub policy: Policy,
    pub spent_today: U128,
    pub active: bool,
    pub coins: U128,
    pub inventory: Vec<HeldView>,
}

#[near(serializers = [json])]
pub struct StallView {
    pub owner: AccountId,
    pub name: String,
    pub npcs: Vec<AccountId>,
    pub coins: U128,
}

impl Contract {
    fn good_view(&self, good: &crate::goods::Good) -> GoodView {
        GoodView {
            id: good.id.clone(),
            name: good.name.clone(),
            base_price: U128(good.base_price),
            reference_price: U128(good.reference_price),
            volume: U128(good.volume),
        }
    }

    fn inventory(&self, who: &AccountId) -> Vec<HeldView> {
        self.catalog
            .keys()
            .filter_map(|good| {
                let qty = self.ledger.held_of(who, good);
                if qty > 0 {
                    Some(HeldView {
                        good: good.clone(),
                        qty: U128(qty),
                    })
                } else {
                    None
                }
            })
            .collect()
    }

    fn npc_view(&self, npc: &crate::npc::Npc) -> NpcView {
        NpcView {
            account: npc.account.clone(),
            stall_owner: npc.stall_owner.clone(),
            name: npc.name.clone(),
            persona: npc.persona.clone(),
            policy: npc.policy.clone(),
            spent_today: U128(if npc.spend_day == env::block_timestamp() / NANOS_PER_DAY {
                npc.spent_today
            } else {
                0
            }),
            active: npc.active,
            coins: U128(self.ledger.coins_of(&npc.account)),
            inventory: self.inventory(&npc.account),
        }
    }

    fn listing_view(listing: &crate::market::Listing) -> ListingView {
        ListingView {
            id: listing.id,
            seller: listing.seller.clone(),
            good: listing.good.clone(),
            qty: U128(listing.qty),
            unit_price: U128(listing.unit_price),
            listed_at: U64(listing.listed_at),
        }
    }
}

#[near]
impl Contract {
    pub fn get_catalog(&self) -> Vec<GoodView> {
        self.catalog.values().map(|g| self.good_view(g)).collect()
    }

    pub fn get_good(&self, id: String) -> Option<GoodView> {
        self.catalog.get(id.as_str()).map(|g| self.good_view(g))
    }

    pub fn get_stall(&self, owner: AccountId) -> Option<StallView> {
        self.stalls.get(&owner).map(|stall| StallView {
            owner: stall.owner.clone(),
            name: stall.name.clone(),
            npcs: stall.npcs.clone(),
            coins: U128(self.ledger.coins_of(&stall.owner)),
        })
    }

    pub fn get_stalls(&self, from_index: Option<u64>, limit: Option<u64>) -> Vec<StallView> {
        self.stalls
            .values()
            .skip(from_index.unwrap_or(0) as usize)
            .take(limit.unwrap_or(50).min(100) as usize)
            .map(|stall| StallView {
                owner: stall.owner.clone(),
                name: stall.name.clone(),
                npcs: stall.npcs.clone(),
                coins: U128(self.ledger.coins_of(&stall.owner)),
            })
            .collect()
    }

    pub fn get_npc(&self, account: AccountId) -> Option<NpcView> {
        self.npcs.get(&account).map(|npc| self.npc_view(npc))
    }

    pub fn get_stall_npcs(&self, owner: AccountId) -> Vec<NpcView> {
        match self.stalls.get(&owner) {
            Some(stall) => stall
                .npcs
                .iter()
                .filter_map(|id| self.npcs.get(id))
                .map(|npc| self.npc_view(npc))
                .collect(),
            None => Vec::new(),
        }
    }

    pub fn get_listing(&self, id: u64) -> Option<ListingView> {
        self.listings.get(&id).map(Self::listing_view)
    }

    pub fn get_listings(
        &self,
        from_index: Option<u64>,
        limit: Option<u64>,
        good: Option<String>,
    ) -> Vec<ListingView> {
        self.listings
            .values()
            .filter(|l| good.as_ref().map_or(true, |g| &l.good == g))
            .skip(from_index.unwrap_or(0) as usize)
            .take(limit.unwrap_or(50).min(100) as usize)
            .map(Self::listing_view)
            .collect()
    }

    pub fn coins_of(&self, account: AccountId) -> U128 {
        U128(self.ledger.coins_of(&account))
    }

    pub fn goods_of(&self, account: AccountId, good: String) -> U128 {
        U128(self.ledger.held_of(&account, &good))
    }

    pub fn inventory_of(&self, account: AccountId) -> Vec<HeldView> {
        self.inventory(&account)
    }
}
