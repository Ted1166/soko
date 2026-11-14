use near_sdk::NearToken;

pub const NANOS_PER_DAY: u64 = 86_400_000_000_000;
pub const MAX_PRICE: u128 = 1_000_000_000_000;
pub const MAX_QTY: u128 = 1_000_000_000;
pub const MAX_LISTINGS_PER_TRADER: u32 = 20;
pub const MAX_NPCS_PER_STALL: usize = 8;
pub const STARTER_COINS: u128 = 1_000;
pub const NPC_MIN_DEPOSIT: NearToken = NearToken::from_millinear(100);
pub const NPC_KEY_ALLOWANCE: NearToken = NearToken::from_millinear(50);
pub const NPC_METHODS: &str = "list_goods,reprice_listing,cancel_listing,buy_goods";
