"""
Test script to verify AI Matcher is working correctly
"""
import os
from dotenv import load_dotenv
from utils.ai_matcher import AIMatcher

# Load environment variables
load_dotenv()

def test_ai_matcher():
    """Test the AI matcher with sample TV records"""
    
    print("="*70)
    print("AI MATCHER TEST")
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
    
    # Sample customer records
    customer_records = [
        {
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
    ]
    
    # Sample internal records
    internal_records = [
        {
            'old_tag_number': 'INT001',
            'new_tag_number': 'NEWINT001',
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
            'new_tag_number': 'NEWINT002',
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
            'new_tag_number': 'NEWINT003',
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
            'new_tag_number': 'NEWINT004',
            'description': 'PRINTER HP LASERJET',
            'category': 'Electronics',
            'department': 'IT Department',
            'year': '2023',
            'book_value': 3000.0,
            'serial_no': '',
            'district': 'District A',
            'asset_number': 'A005'
        }
    ]
    
    print("Testing with sample records:")
    print(f"  Customer: {customer_records[0]['description']}")
    print(f"  Internal records: {len(internal_records)}")
    for i, rec in enumerate(internal_records, 1):
        print(f"    {i}. {rec['description'][:60]}...")
    print()
    
    # Perform matching
    try:
        matches = matcher.ai_match_batch(
            customer_records=customer_records,
            internal_records=internal_records,
            batch_size=1,
            top_k=10
        )
        
        print("\n" + "="*70)
        print("TEST RESULTS")
        print("="*70)
        
        if matches:
            print(f"✓ SUCCESS: Found {len(matches)} match(es)\n")
            for i, match in enumerate(matches, 1):
                print(f"Match {i}:")
                print(f"  Customer: {match['customer_description']}")
                print(f"  Internal: {match['internal_description'][:60]}...")
                print(f"  Confidence: {match['confidence_score']:.2%}")
                print(f"  Reasoning: {match['ai_reasoning']}")
                print()
        else:
            print("✗ FAILED: No matches found")
            print("  This might indicate:")
            print("  - API key is invalid")
            print("  - Model is not responding correctly")
            print("  - Confidence threshold is too high")
            print("  - LLM is being too strict with matching")
            
    except Exception as e:
        print(f"✗ ERROR during matching: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    test_ai_matcher()
