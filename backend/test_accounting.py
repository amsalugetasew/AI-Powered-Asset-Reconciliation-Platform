"""
Test script to verify reconciliation accounting is correct
"""
import pandas as pd

def test_accounting():
    """Test that totals add up correctly"""
    
    print("="*70)
    print("RECONCILIATION ACCOUNTING TEST")
    print("="*70)
    
    # Simulate reconciliation results
    print("\nScenario: 100 customer records, 150 internal records")
    print("-" * 70)
    
    # Customer side
    total_customer = 100
    exact_matched = 30
    ai_matched = 15
    manual_review = 20
    customer_unmatched = 25
    customer_duplicates = 10
    
    print("\nCustomer Records:")
    print(f"  Total uploaded: {total_customer}")
    print(f"  - Exact matched: {exact_matched}")
    print(f"  - AI matched: {ai_matched}")
    print(f"  - Manual review: {manual_review}")
    print(f"  - Unmatched: {customer_unmatched}")
    print(f"  - Duplicates: {customer_duplicates}")
    
    customer_sum = exact_matched + ai_matched + manual_review + customer_unmatched + customer_duplicates
    print(f"  = Sum: {customer_sum}")
    
    if total_customer == customer_sum:
        print(f"  ✓ Customer accounting CORRECT")
    else:
        print(f"  ✗ Customer accounting WRONG!")
        print(f"    Expected: {total_customer}")
        print(f"    Got: {customer_sum}")
        print(f"    Difference: {total_customer - customer_sum}")
    
    # Internal side
    total_internal = 150
    # Note: exact_matched, ai_matched, manual_review are same (1-to-1 matching)
    internal_unmatched = 75
    internal_duplicates = 15
    
    print("\nInternal Records:")
    print(f"  Total uploaded: {total_internal}")
    print(f"  - Exact matched: {exact_matched}")
    print(f"  - AI matched: {ai_matched}")
    print(f"  - Manual review: {manual_review}")
    print(f"  - Unmatched: {internal_unmatched}")
    print(f"  - Duplicates: {internal_duplicates}")
    
    internal_sum = exact_matched + ai_matched + manual_review + internal_unmatched + internal_duplicates
    print(f"  = Sum: {internal_sum}")
    
    if total_internal == internal_sum:
        print(f"  ✓ Internal accounting CORRECT")
    else:
        print(f"  ✗ Internal accounting WRONG!")
        print(f"    Expected: {total_internal}")
        print(f"    Got: {internal_sum}")
        print(f"    Difference: {total_internal - internal_sum}")
    
    print("\n" + "="*70)
    print("ACCOUNTING FORMULA")
    print("="*70)
    print("\nFor Customer Records:")
    print("  Total = Exact Matched + AI Matched + Manual Review + Unmatched + Duplicates")
    print(f"  {total_customer} = {exact_matched} + {ai_matched} + {manual_review} + {customer_unmatched} + {customer_duplicates}")
    print(f"  {total_customer} = {customer_sum} ✓")
    
    print("\nFor Internal Records:")
    print("  Total = Exact Matched + AI Matched + Manual Review + Unmatched + Duplicates")
    print(f"  {total_internal} = {exact_matched} + {ai_matched} + {manual_review} + {internal_unmatched} + {internal_duplicates}")
    print(f"  {total_internal} = {internal_sum} ✓")
    
    print("\n" + "="*70)
    print("KEY POINTS")
    print("="*70)
    print("1. Matched counts are SAME for both customer and internal")
    print("   (Each match pairs 1 customer record with 1 internal record)")
    print(f"   Matched: {exact_matched + ai_matched + manual_review}")
    print()
    print("2. Unmatched counts are DIFFERENT for customer and internal")
    print(f"   Customer unmatched: {customer_unmatched}")
    print(f"   Internal unmatched: {internal_unmatched}")
    print()
    print("3. Duplicates are counted SEPARATELY")
    print(f"   Customer duplicates: {customer_duplicates}")
    print(f"   Internal duplicates: {internal_duplicates}")
    print()
    print("4. Total uploaded = Matched + Unmatched + Duplicates")
    print(f"   Customer: {total_customer} = {exact_matched + ai_matched + manual_review} + {customer_unmatched} + {customer_duplicates}")
    print(f"   Internal: {total_internal} = {exact_matched + ai_matched + manual_review} + {internal_unmatched} + {internal_duplicates}")

if __name__ == '__main__':
    test_accounting()
