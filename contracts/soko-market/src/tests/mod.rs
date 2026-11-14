mod attack_tests;
mod market_tests;
mod policy_tests;

use near_sdk::json_types::U128;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::{testing_env, AccountId, NearToken, PublicKey};

use crate::policy::Policy;
use crate::Contract;

pub const DAY: u64 = 86_400_000_000_000;

pub fn account(name: &str) -> AccountId {
    name.parse().unwrap()
}

pub fn market_account() -> AccountId {
    account("soko.testnet")
}

pub fn admin() -> AccountId {
    account("admin.testnet")
}

pub fn act_as(caller: &AccountId, deposit_milli_near: u128, timestamp: u64) {
    let context = VMContextBuilder::new()
        .current_account_id(market_account())
        .predecessor_account_id(caller.clone())
        .signer_account_id(caller.clone())
        .attached_deposit(NearToken::from_millinear(deposit_milli_near))
        .block_timestamp(timestamp)
        .build();
    testing_env!(context);
}

pub fn fresh_market() -> Contract {
    act_as(&admin(), 0, 0);
    Contract::new(admin())
}

pub fn test_key() -> PublicKey {
    "ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp"
        .parse()
        .unwrap()
}

pub fn standard_policy() -> Policy {
    Policy {
        max_trade_value: U128(100),
        daily_cap: U128(200),
        max_premium_bps: 1_000,
        allowed_goods: vec!["maize".to_string(), "rice".to_string()],
    }
}

pub fn open_stall(contract: &mut Contract, owner: &AccountId, name: &str, timestamp: u64) {
    act_as(owner, 0, timestamp);
    contract.open_stall(name.to_string());
}

pub fn hire_npc(
    contract: &mut Contract,
    owner: &AccountId,
    name: &str,
    policy: Policy,
    timestamp: u64,
) -> AccountId {
    act_as(owner, 100, timestamp);
    let _ = contract.spawn_npc(
        name.to_string(),
        "A careful trader".to_string(),
        test_key(),
        policy,
    );
    contract
        .get_stall(owner.clone())
        .unwrap()
        .npcs
        .last()
        .cloned()
        .unwrap()
}

pub fn fund(
    contract: &mut Contract,
    owner: &AccountId,
    npc: &AccountId,
    amount: u128,
    timestamp: u64,
) {
    act_as(owner, 0, timestamp);
    contract.fund_npc(npc.clone(), U128(amount));
}

pub fn supply_listing(
    contract: &mut Contract,
    seller: &AccountId,
    good: &str,
    qty: u128,
    price: u128,
    timestamp: u64,
) -> u64 {
    act_as(&admin(), 0, timestamp);
    contract.mint_goods(seller.clone(), good.to_string(), U128(qty));
    act_as(seller, 0, timestamp);
    contract.list_goods(good.to_string(), U128(qty), U128(price))
}
