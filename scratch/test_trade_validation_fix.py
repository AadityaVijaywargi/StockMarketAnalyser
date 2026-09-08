import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

def validate_buy_trade_setup(current_price, entry, stop_loss, target_1, target_2=None):
    """
    Validates BUY trade setup for logical correctness.
    """
    if current_price <= 0 or entry <= 0 or stop_loss <= 0 or target_1 <= 0:
        return False, "Price parameters must be strictly positive"

    # 1. Stop Loss must be strictly below Entry
    if stop_loss >= entry:
        return False, f"Stop Loss (Rs.{stop_loss}) >= Entry (Rs.{entry})"

    # 2. Stop Loss must be strictly below Current Price
    if stop_loss >= current_price:
        return False, f"Stop Loss (Rs.{stop_loss}) >= Current Price (Rs.{current_price})"

    # 3. Entry < Target 1 < Target 2
    if entry >= target_1:
        return False, f"Entry (Rs.{entry}) >= Target 1 (Rs.{target_1})"

    if target_2 and target_1 >= target_2:
        return False, f"Target 1 (Rs.{target_1}) >= Target 2 (Rs.{target_2})"

    # 4. Entry must be logically related to Current Price (within 8% max)
    if abs(entry - current_price) / current_price > 0.08:
        return False, f"Entry (Rs.{entry}) deviates >8% from Current Price (Rs.{current_price})"

    # 5. Risk > 0 and Reward > Risk
    risk = entry - stop_loss
    reward = target_1 - entry
    if risk <= 0:
        return False, f"Risk (Rs.{risk}) <= 0"

    if reward <= risk:
        return False, f"Reward (Rs.{reward}) <= Risk (Rs.{risk}) (R:R ratio < 1.0)"

    return True, "VALID"


def test_validation():
    print("==================================================")
    print(" AUDITING TRADE VALIDATION BUG                    ")
    print("==================================================")

    # User's reported bug setup
    bug_curr = 2590.0
    bug_entry = 3217.0
    bug_sl = 2895.0
    bug_t1 = 3603.0
    bug_t2 = 3861.0

    valid, reason = validate_buy_trade_setup(bug_curr, bug_entry, bug_sl, bug_t1, bug_t2)
    print(f"\nTesting Reported Bug Case:")
    print(f"  Current Price: Rs.{bug_curr}")
    print(f"  Entry: Rs.{bug_entry}, Stop Loss: Rs.{bug_sl}, T1: Rs.{bug_t1}, T2: Rs.{bug_t2}")
    print(f"  Validation Result: {valid}")
    print(f"  Rejection Reason: {reason}")

    assert valid is False, "Bug setup should have been rejected!"
    print("  BUG SETUP SUCCESSFULLY REJECTED BY VALIDATION LAYER [PASS]")

    # Valid Trade Setup
    valid_curr = 2590.0
    valid_entry = 2590.0
    valid_sl = 2460.5
    valid_t1 = 2797.2
    valid_t2 = 2978.5

    v_ok, v_reason = validate_buy_trade_setup(valid_curr, valid_entry, valid_sl, valid_t1, valid_t2)
    print(f"\nTesting Corrected Trade Setup:")
    print(f"  Current Price: Rs.{valid_curr}")
    print(f"  Entry: Rs.{valid_entry}, Stop Loss: Rs.{valid_sl}, T1: Rs.{valid_t1}, T2: Rs.{valid_t2}")
    print(f"  Validation Result: {v_ok}")
    print(f"  Status: {v_reason}")

    assert v_ok is True
    print("  VALID SETUP PASSED VERIFICATION [PASS]")

if __name__ == "__main__":
    test_validation()
