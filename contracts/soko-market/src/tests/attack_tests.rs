use near_sdk::json_types::U128;

use super::{
    account, act_as, fresh_market, fund, hire_npc, market_account, open_stall, standard_policy,
    supply_listing,
};

#[test]
#[should_panic(expected = "Price too far above market")]
fn colluding_seller_cannot_extract_an_inflated_price() {
    let mut market = fresh_market();
    let attacker = account("attacker.testnet");
    let owner = account("mama.testnet");
    open_stall(&mut market, &attacker, "Totally Legit", 0);
    open_stall(&mut market, &owner, "Mama Mboga", 0);
    let npc = hire_npc(&mut market, &owner, "Juma", standard_policy(), 0);
    fund(&mut market, &owner, &npc, 500, 0);
    let listing = supply_listing(&mut market, &attacker, "maize", 10, 80, 0);
    act_as(&npc, 0, 0);
    market.buy_goods(listing, U128(1));
}

#[test]
fn drain_attempt_leaves_the_funds_untouched() {
    let mut market = fresh_market();
    let attacker = account("attacker.testnet");
    let owner = account("mama.testnet");
    open_stall(&mut market, &attacker, "Totally Legit", 0);
    open_stall(&mut market, &owner, "Mama Mboga", 0);
    let npc = hire_npc(&mut market, &owner, "Juma", standard_policy(), 0);
    fund(&mut market, &owner, &npc, 500, 0);
    let listing = supply_listing(&mut market, &attacker, "maize", 10, 400, 0);
    act_as(&npc, 0, 0);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        market.buy_goods(listing, U128(1));
    }));
    assert!(result.is_err());
    assert_eq!(market.coins_of(npc).0, 500);
    assert_eq!(market.coins_of(attacker).0, 1_000);
}

#[test]
fn price_pump_moves_the_reference_slowly() {
    let mut market = fresh_market();
    let attacker = account("attacker.testnet");
    let accomplice = account("accomplice.testnet");
    open_stall(&mut market, &attacker, "Totally Legit", 0);
    open_stall(&mut market, &accomplice, "Also Legit", 0);
    let listing = supply_listing(&mut market, &attacker, "maize", 10, 400, 0);
    act_as(&accomplice, 0, 0);
    market.buy_goods(listing, U128(1));
    let reference = market
        .get_good("maize".to_string())
        .unwrap()
        .reference_price
        .0;
    assert_eq!(reference, 42);
}

#[test]
#[should_panic(expected = "Only the stall owner can do this")]
fn npc_cannot_move_its_own_funds() {
    let mut market = fresh_market();
    let owner = account("mama.testnet");
    open_stall(&mut market, &owner, "Mama Mboga", 0);
    let npc = hire_npc(&mut market, &owner, "Juma", standard_policy(), 0);
    fund(&mut market, &owner, &npc, 500, 0);
    act_as(&npc, 0, 0);
    market.defund_npc(npc.clone(), U128(500));
}

#[test]
#[should_panic(expected = "Only the stall owner can do this")]
fn npc_cannot_rewrite_its_own_policy() {
    let mut market = fresh_market();
    let owner = account("mama.testnet");
    open_stall(&mut market, &owner, "Mama Mboga", 0);
    let npc = hire_npc(&mut market, &owner, "Juma", standard_policy(), 0);
    let mut loose = standard_policy();
    loose.max_trade_value = U128(1_000_000);
    loose.daily_cap = U128(1_000_000);
    act_as(&npc, 0, 0);
    market.set_policy(npc.clone(), loose);
}

#[test]
#[should_panic(expected = "NPCs cannot open stalls")]
fn npc_cannot_open_a_stall() {
    let mut market = fresh_market();
    let owner = account("mama.testnet");
    open_stall(&mut market, &owner, "Mama Mboga", 0);
    let npc = hire_npc(&mut market, &owner, "Juma", standard_policy(), 0);
    act_as(&npc, 0, 0);
    market.open_stall("Shadow Stall".to_string());
}

#[test]
#[should_panic(expected = "Cannot trade with your own stall")]
fn wash_trading_between_own_npcs_is_blocked() {
    let mut market = fresh_market();
    let owner = account("mama.testnet");
    open_stall(&mut market, &owner, "Mama Mboga", 0);
    let seller_npc = hire_npc(&mut market, &owner, "Juma", standard_policy(), 0);
    let buyer_npc = hire_npc(&mut market, &owner, "Amina", standard_policy(), 0);
    fund(&mut market, &owner, &buyer_npc, 500, 0);
    let listing = supply_listing(&mut market, &seller_npc, "maize", 10, 40, 0);
    act_as(&buyer_npc, 0, 0);
    market.buy_goods(listing, U128(1));
}

#[test]
#[should_panic(expected = "The market account cannot open a stall")]
fn the_market_account_cannot_trade_against_its_own_escrow() {
    let mut market = fresh_market();
    act_as(&market_account(), 0, 0);
    market.open_stall("Escrow Thief".to_string());
}
