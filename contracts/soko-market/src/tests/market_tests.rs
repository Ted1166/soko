use near_sdk::json_types::U128;

use super::{account, act_as, admin, fresh_market, open_stall, supply_listing};

#[test]
fn a_trade_moves_coins_and_goods() {
    let mut market = fresh_market();
    let seller = account("seller.testnet");
    let buyer = account("buyer.testnet");
    open_stall(&mut market, &seller, "Seller Stall", 0);
    open_stall(&mut market, &buyer, "Buyer Stall", 0);
    let listing = supply_listing(&mut market, &seller, "maize", 100, 40, 0);
    act_as(&buyer, 0, 0);
    market.buy_goods(listing, U128(10));
    assert_eq!(market.coins_of(buyer.clone()).0, 600);
    assert_eq!(market.coins_of(seller.clone()).0, 1_400);
    assert_eq!(market.goods_of(buyer, "maize".to_string()).0, 10);
    assert_eq!(market.get_listing(listing).unwrap().qty.0, 90);
}

#[test]
fn a_full_fill_removes_the_listing() {
    let mut market = fresh_market();
    let seller = account("seller.testnet");
    let buyer = account("buyer.testnet");
    open_stall(&mut market, &seller, "Seller Stall", 0);
    open_stall(&mut market, &buyer, "Buyer Stall", 0);
    let listing = supply_listing(&mut market, &seller, "maize", 5, 40, 0);
    act_as(&buyer, 0, 0);
    market.buy_goods(listing, U128(5));
    assert!(market.get_listing(listing).is_none());
    assert!(market.get_listings(None, None, None).is_empty());
}

#[test]
fn cancelling_returns_the_goods() {
    let mut market = fresh_market();
    let seller = account("seller.testnet");
    open_stall(&mut market, &seller, "Seller Stall", 0);
    let listing = supply_listing(&mut market, &seller, "rice", 20, 90, 0);
    assert_eq!(market.goods_of(seller.clone(), "rice".to_string()).0, 0);
    act_as(&seller, 0, 0);
    market.cancel_listing(listing);
    assert_eq!(market.goods_of(seller, "rice".to_string()).0, 20);
}

#[test]
fn repricing_updates_the_listing() {
    let mut market = fresh_market();
    let seller = account("seller.testnet");
    open_stall(&mut market, &seller, "Seller Stall", 0);
    let listing = supply_listing(&mut market, &seller, "maize", 20, 40, 0);
    act_as(&seller, 0, 0);
    market.reprice_listing(listing, U128(35));
    assert_eq!(market.get_listing(listing).unwrap().unit_price.0, 35);
}

#[test]
#[should_panic(expected = "Cannot trade with your own stall")]
fn nobody_trades_with_their_own_stall() {
    let mut market = fresh_market();
    let seller = account("seller.testnet");
    open_stall(&mut market, &seller, "Seller Stall", 0);
    let listing = supply_listing(&mut market, &seller, "maize", 20, 40, 0);
    act_as(&seller, 0, 0);
    market.buy_goods(listing, U128(1));
}

#[test]
#[should_panic(expected = "Open a stall first")]
fn trading_requires_a_stall() {
    let mut market = fresh_market();
    let seller = account("seller.testnet");
    let stranger = account("stranger.testnet");
    open_stall(&mut market, &seller, "Seller Stall", 0);
    let listing = supply_listing(&mut market, &seller, "maize", 20, 40, 0);
    act_as(&stranger, 0, 0);
    market.buy_goods(listing, U128(1));
}

#[test]
fn the_reference_price_follows_trades() {
    let mut market = fresh_market();
    let seller = account("seller.testnet");
    let buyer = account("buyer.testnet");
    open_stall(&mut market, &seller, "Seller Stall", 0);
    open_stall(&mut market, &buyer, "Buyer Stall", 0);
    let listing = supply_listing(&mut market, &seller, "maize", 100, 48, 0);
    act_as(&buyer, 0, 0);
    market.buy_goods(listing, U128(1));
    let good = market.get_good("maize".to_string()).unwrap();
    assert_eq!(good.reference_price.0, 42);
    assert_eq!(good.volume.0, 1);
}

#[test]
#[should_panic(expected = "Not enough coins")]
fn buyers_cannot_spend_more_than_they_hold() {
    let mut market = fresh_market();
    let seller = account("seller.testnet");
    let buyer = account("buyer.testnet");
    open_stall(&mut market, &seller, "Seller Stall", 0);
    open_stall(&mut market, &buyer, "Buyer Stall", 0);
    let listing = supply_listing(&mut market, &seller, "kanga", 10, 300, 0);
    act_as(&buyer, 0, 0);
    market.buy_goods(listing, U128(4));
}

#[test]
fn the_reference_price_cannot_collapse_below_half_the_base() {
    let mut market = fresh_market();
    let seller = account("seller.testnet");
    let buyer = account("buyer.testnet");
    open_stall(&mut market, &seller, "Seller Stall", 0);
    open_stall(&mut market, &buyer, "Buyer Stall", 0);
    let listing = supply_listing(&mut market, &seller, "maize", 100, 1, 0);
    act_as(&buyer, 0, 0);
    for _ in 0..40 {
        market.buy_goods(listing, U128(1));
    }
    let good = market.get_good("maize".to_string()).unwrap();
    assert_eq!(good.reference_price.0, 20);
}

#[test]
fn a_collapsed_market_recovers_on_the_next_trade() {
    let mut market = fresh_market();
    let seller = account("seller.testnet");
    let buyer = account("buyer.testnet");
    open_stall(&mut market, &seller, "Seller Stall", 0);
    open_stall(&mut market, &buyer, "Buyer Stall", 0);
    let listing = supply_listing(&mut market, &seller, "maize", 100, 1, 0);
    act_as(&buyer, 0, 0);
    for _ in 0..40 {
        market.buy_goods(listing, U128(1));
    }
    act_as(&seller, 0, 0);
    market.cancel_listing(listing);
    let fair = {
        act_as(&seller, 0, 0);
        market.list_goods("maize".to_string(), U128(10), U128(22))
    };
    act_as(&buyer, 0, 0);
    market.buy_goods(fair, U128(1));
    let good = market.get_good("maize".to_string()).unwrap();
    assert!(good.reference_price.0 >= 20);
}

#[test]
fn the_reference_price_cannot_run_away_above_double_the_base() {
    let mut market = fresh_market();
    let seller = account("seller.testnet");
    let buyer = account("buyer.testnet");
    open_stall(&mut market, &seller, "Seller Stall", 0);
    open_stall(&mut market, &buyer, "Buyer Stall", 0);
    act_as(&admin(), 0, 0);
    market.mint_coins(buyer.clone(), U128(100_000));
    let listing = supply_listing(&mut market, &seller, "maize", 100, 200, 0);
    act_as(&buyer, 0, 0);
    for _ in 0..50 {
        market.buy_goods(listing, U128(1));
    }
    let good = market.get_good("maize".to_string()).unwrap();
    assert_eq!(good.reference_price.0, 80);
}
