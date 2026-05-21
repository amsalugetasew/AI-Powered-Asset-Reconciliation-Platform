"""
Test script to verify fuzzy pre-filtering is working
"""
import os
from dotenv import load_dotenv
from utils.ai_matcher import AIMatcher

# Load environment variables
load_dotenv()

def test_fuzzy_filter():
    """Test the fuzzy pre-filtering without calling LLM"""
    
    print("="*70)
    print("FUZZY PRE-FILTER TEST")
    print("="*70)
    
    # Get API key
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        print("✗ ERROR: No OPENAI_API_KEY found in .env file")
        return
    
    print(f"✓ API Key found: {api_key[:10]}...")
    
    # Initialize AI Matcher
    try:
        matcher = AIMatcher(
            provider='groq',
            api_key=api_key,
            model='llama-3.3-70b-versatile',
            fuzzy_threshold=0.30,  # 30% fuzzy threshold
            rate_limit_delay=1.0,  # 1 second between calls
            max_retries=5          # 5 retry attempts
        )
        print("✓ AI Matcher initialized successfully\n")
    except Exception as e:
        print(f"✗ ERROR initializing AI Matcher: {str(e)}")
        return
    
    # Sample customer record
    customer_record = {
        'old_tag_number': 'CUST001',
        'new_tag_number': 'NEW001',
        'description': 'TELEVISION (65 INCH)',
        'category': 'Electronics',
        'department': 'IT Department',
        'year': '2023',
        'book_value': 15000.0,
        'serial_no': '',
        'district': 'District A',
        'asset_number': 'A001'
    }
    
    # Sample internal records with varying similarity
    internal_records = [
        {
            'old_tag_number': 'INT001',
            'description': 'TV MODEL:-QA65Q60CAU QA65Q60CA AC220-240V-50/60HZ 170W MADE BY SAMSUNG IN EGYPT',
            'category': 'Electronics',
            'department': 'IT Department',
            'year': '2023',
            'book_value': 15000.0,
            'serial_no': '',
            'district': 'District A',
            'asset_number': 'A002'
        },
        {
            'old_tag_number': 'INT002',
            'description': 'LAPTOP DELL INSPIRON 15',
            'category': 'Electronics',
            'department': 'IT Department',
            'year': '2023',
            'book_value': 8000.0,
            'serial_no': '',
            'district': 'District A',
            'asset_number': 'A003'
        },
        {
            'old_tag_number': 'INT003',
            'description': 'CHAIR OFFICE ERGONOMIC',
            'category': 'Furniture',
            'department': 'Admin',
            'year': '2022',
            'book_value': 500.0,
            'serial_no': '',
            'district': 'District B',
            'asset_number': 'A004'
        },
        {
            'old_tag_number': 'INT004',
            'description': 'PRINTER HP LASERJET',
            'category': 'Electronics',
            'department': 'IT Department',
            'year': '2023',
            'book_value': 3000.0,
            'serial_no': '',
            'district': 'District A',
            'asset_number': 'A005'
        },
        {
            'old_tag_number': 'INT005',
            'description': 'TELEVISION SAMSUNG 55 INCH SMART TV',
            'category': 'Electronics',
            'department': 'IT Department',
            'year': '2022',
            'book_value': 12000.0,
            'serial_no': '',
            'district': 'District A',
            'asset_number': 'A006'
        }
    ]
    
    print("Customer Record:")
    print(f"  Description: {customer_record['description']}")
    print(f"  Category: {customer_record['category']}")
    print(f"  Department: {customer_record['department']}")
    print()
    
    print("Internal Records:")
    for i, rec in enumerate(internal_records, 1):
        print(f"  {i}. {rec['description'][:60]}...")
    print()
    
    # Test fuzzy filtering
    print("="*70)
    print("TESTING FUZZY PRE-FILTERING")
    print("="*70)
    
    # Calculate fuzzy scores for each internal record
    print("\nFuzzy Scores (threshold: 30%):")
    print("-" * 70)
    
    for i, internal_record in enumerate(internal_records, 1):
        score = matcher._calculate_fuzzy_score(customer_record, internal_record)
        status = "✓ PASS" if score >= 0.30 else "✗ FAIL"
        print(f"{i}. {internal_record['description'][:50]:<50} | Score: {score:.2%} | {status}")
    
    print()
    
    # Get top K candidates
    top_k = 3
    top_candidates = matcher._fuzzy_filter_candidates(
        customer_record, 
        internal_records, 
        top_k=top_k
    )
    
    print(f"\nTop {top_k} Candidates (would be sent to LLM):")
    print("-" * 70)
    
    if top_candidates:
        for i, candidate in enumerate(top_candidates, 1):
            score = matcher._calculate_fuzzy_score(customer_record, candidate)
            print(f"{i}. {candidate['description'][:60]}...")
            print(f"   Score: {score:.2%}")
            print()
        
        print(f"✓ SUCCESS: Fuzzy filtering reduced {len(internal_records)} records to {len(top_candidates)} candidates")
        print(f"  This saves {len(internal_records) - len(top_candidates)} unnecessary LLM calls!")
    else:
        print("✗ No candidates passed the fuzzy filter threshold")
    
    print("\n" + "="*70)
    print("BENEFITS OF FUZZY PRE-FILTERING:")
    print("="*70)
    print(f"• Reduces API calls: {len(internal_records)} → {len(top_candidates)} records")
    print(f"• Saves cost: {((len(internal_records) - len(top_candidates)) / len(internal_records) * 100):.0f}% reduction")
    print(f"• Faster processing: Only relevant candidates sent to LLM")
    print(f"• Better accuracy: LLM focuses on likely matches")

if __name__ == '__main__':
    test_fuzzy_filter()
