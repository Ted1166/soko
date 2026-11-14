use near_sdk::json_types::U128;

use super::{
    account, act_as, fresh_market, fund, hire_npc, open_stall, standard_policy, supply_listing,
    test_key, DAY,
};

#[test]
#[should_panic(expected = "Attach at least 0.25 NEAR")]
fn spawning_requires_a_gas_deposit() {
    let mut market = fresh_market();
    let owner = account("mama.testnet");
    open_stall(&mut market, &owner, "Mama Mboga", 0);
    act_as(&owner, 10, 0);
    let _ = market.spawn_npc(
        "Juma".to_string(),
        "Quiet".to_string(),
        test_key(),
        standard_policy(),
    );
}

#[test]
#[should_panic(expected = "Open a stall first")]
fn spawning_requires_a_stall() {
    let mut market = fresh_market();
    let owner = account("mama.testnet");
    act_as(&owner, 250, 0);
    let _ = market.spawn_npc(
        "Juma".to_string(),
        "Quiet".to_string(),
        test_key(),
        standard_policy(),
    );
}

#[test]
#[should_panic(expected = "Trade exceeds per-trade limit")]
fn npc_cannot_exceed_the_trade_limit() {
    let mut market = fresh_market();
    let seller = account("seller.testnet");
    let owner = account("mama.testnet");
    open_stall(&mut market, &seller, "Seller Stall", 0);
    open_stall(&mut market, &owner, "Mama Mboga", 0);
    let npc = hire_npc(&mut market, &owner, "Juma", standard_policy(), 0);
    fund(&mut market, &owner, &npc, 500, 0);
    let listing = supply_listing(&mut market, &seller, "maize", 100, 40, 0);
    act_as(&npc, 0, 0);
    market.buy_goods(listing, U128(3));
}

#[test]
#[should_panic(expected = "Daily cap reached")]
fn npc_stops_at_the_daily_cap() {
    let mut market = fresh_market();
    let seller = account("seller.testnet");
    let owner = account("mama.testnet");
    open_stall(&mut market, &seller, "Seller Stall", 0);
    open_stall(&mut market, &owner, "Mama Mboga", 0);
    let npc = hire_npc(&mut market, &owner, "Juma", standard_policy(), 0);
    fund(&mut market, &owner, &npc, 500, 0);
    let listing = supply_listing(&mut market, &seller, "maize", 100, 40, 0);
    act_as(&npc, 0, 0);
    market.buy_goods(listing, U128(2));
    market.buy_goods(listing, U128(2));
    market.buy_goods(listing, U128(2));
}

#[test]
fn npc_daily_cap_resets_the_next_day() {
    let mut market = fresh_market();
    let seller = account("seller.testnet");
    let owner = account("mama.testnet");
    open_stall(&mut market, &seller, "Seller Stall", 0);
    open_stall(&mut market, &owner, "Mama Mboga", 0);
    let npc = hire_npc(&mut market, &owner, "Juma", standard_policy(), 0);
    fund(&mut market, &owner, &npc, 500, 0);
    let listing = supply_listing(&mut market, &seller, "maize", 100, 40, 0);
    act_as(&npc, 0, 0);
    market.buy_goods(listing, U128(2));
    market.buy_goods(listing, U128(2));
    act_as(&npc, 0, DAY);
    market.buy_goods(listing, U128(2));
    assert_eq!(market.coins_of(npc.clone()).0, 260);
    assert_eq!(market.goods_of(npc, "maize".to_string()).0, 6);
}

#[test]
#[should_panic(expected = "Good not allowed by policy")]
fn npc_cannot_buy_a_good_outside_its_policy() {
    let mut market = fresh_market();
    let seller = account("seller.testnet");
    let owner = account("mama.testnet");
    open_stall(&mut market, &seller, "Seller Stall", 0);
    open_stall(&mut market, &owner, "Mama Mboga", 0);
    let npc = hire_npc(&mut market, &owner, "Juma", standard_policy(), 0);
    fund(&mut market, &owner, &npc, 500, 0);
    let listing = supply_listing(&mut market, &seller, "tea", 10, 70, 0);
    act_as(&npc, 0, 0);
    market.buy_goods(listing, U128(1));
}

#[test]
#[should_panic(expected = "NPC is frozen")]
fn frozen_npc_cannot_trade() {
    let mut market = fresh_market();
    let seller = account("seller.testnet");
    let owner = account("mama.testnet");
    open_stall(&mut market, &seller, "Seller Stall", 0);
    open_stall(&mut market, &owner, "Mama Mboga", 0);
    let npc = hire_npc(&mut market, &owner, "Juma", standard_policy(), 0);
    fund(&mut market, &owner, &npc, 500, 0);
    let listing = supply_listing(&mut market, &seller, "maize", 100, 40, 0);
    act_as(&owner, 0, 0);
    market.freeze_npc(npc.clone());
    act_as(&npc, 0, 0);
    market.buy_goods(listing, U128(1));
}

#[test]
fn unfrozen_npc_trades_again() {
    let mut market = fresh_market();
    let seller = account("seller.testnet");
    let owner = account("mama.testnet");
    open_stall(&mut market, &seller, "Seller Stall", 0);
    open_stall(&mut market, &owner, "Mama Mboga", 0);
    let npc = hire_npc(&mut market, &owner, "Juma", standard_policy(), 0);
    fund(&mut market, &owner, &npc, 500, 0);
    let listing = supply_listing(&mut market, &seller, "maize", 100, 40, 0);
    act_as(&owner, 0, 0);
    market.freeze_npc(npc.clone());
    market.unfreeze_npc(npc.clone());
    act_as(&npc, 0, 0);
    market.buy_goods(listing, U128(1));
    assert_eq!(market.goods_of(npc, "maize".to_string()).0, 1);
}

#[test]
#[should_panic(expected = "Only the stall owner can do this")]
fn only_the_owner_can_change_a_policy() {
    let mut market = fresh_market();
    let owner = account("mama.testnet");
    let stranger = account("stranger.testnet");
    open_stall(&mut market, &owner, "Mama Mboga", 0);
    let npc = hire_npc(&mut market, &owner, "Juma", standard_policy(), 0);
    act_as(&stranger, 0, 0);
    market.set_policy(npc, standard_policy());
}

#[test]
#[should_panic(expected = "Daily cap must cover at least one trade")]
fn policy_must_be_coherent() {
    let mut market = fresh_market();
    let owner = account("mama.testnet");
    open_stall(&mut market, &owner, "Mama Mboga", 0);
    let npc = hire_npc(&mut market, &owner, "Juma", standard_policy(), 0);
    let mut policy = standard_policy();
    policy.daily_cap = U128(10);
    act_as(&owner, 0, 0);
    market.set_policy(npc, policy);
}

#[test]
#[should_panic(expected = "This stall has reached its NPC limit")]
fn stall_npc_limit_is_enforced() {
    let mut market = fresh_market();
    let owner = account("mama.testnet");
    open_stall(&mut market, &owner, "Mama Mboga", 0);
    for index in 0..9 {
        hire_npc(
            &mut market,
            &owner,
            &format!("Trader{}", index),
            standard_policy(),
            0,
        );
    }
}

#[test]
fn spent_today_reads_zero_after_the_day_rolls_over() {
    let mut market = fresh_market();
    let seller = account("seller.testnet");
    let owner = account("mama.testnet");
    open_stall(&mut market, &seller, "Seller Stall", 0);
    open_stall(&mut market, &owner, "Mama Mboga", 0);
    let npc = hire_npc(&mut market, &owner, "Juma", standard_policy(), 0);
    fund(&mut market, &owner, &npc, 500, 0);
    let listing = supply_listing(&mut market, &seller, "maize", 100, 40, 0);
    act_as(&npc, 0, 0);
    market.buy_goods(listing, U128(2));
    assert_eq!(market.get_npc(npc.clone()).unwrap().spent_today.0, 80);
    act_as(&npc, 0, DAY);
    assert_eq!(market.get_npc(npc).unwrap().spent_today.0, 0);
}
