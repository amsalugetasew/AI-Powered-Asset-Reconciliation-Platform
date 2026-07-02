#!/usr/bin/env python3
"""
Test script to verify system capacity for large datasets

Usage:
    python test_capacity.py --records 100000
    python test_capacity.py --records 500000 --test-memory
    python test_capacity.py --file path/to/large_file.xlsx
"""

import os
import sys
import argparse
import pandas as pd
import time
import psutil
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from utils.data_cleaner import DataCleaner
from services.reconciliation_service import ReconciliationService
from config import Config


def get_memory_usage():
    """Get current memory usage in MB"""
    process = psutil.Process()
    return process.memory_info().rss / (1024 * 1024)


def generate_test_data(num_records, output_path):
    """Generate synthetic test data"""
    print(f"Generating {num_records} test records...")
    
    categories = ['FF', 'HA', 'OE', 'IT', 'VH']
    departments = ['Finance', 'HR', 'IT', 'Operations', 'Sales']
    descriptions = [
        'OFFICE CHAIR', 'DESK', 'COMPUTER', 'PRINTER', 'TELEPHONE',
        'CABINET', 'TELEVISION', 'PROJECTOR', 'WHITEBOARD', 'SCANNER'
    ]
    
    data = []
    for i in range(num_records):
        record = {
            'Old Tag Number': f'OLD-{i:08d}',
            'New Tag Number': f'NEW-{i:08d}',
            'Year': 2020 + (i % 6),
            'Category': categories[i % len(categories)],
            'Description': descriptions[i % len(descriptions)],
            'Serial No': f'SN-{i:08d}',
            'Department': departments[i % len(departments)],
            'District': f'District-{(i % 10) + 1}',
            'Book Value': 100 + (i % 10000),
            'Asset Number': f'ASSET-{i:08d}'
        }
        data.append(record)
        
        if (i + 1) % 10000 == 0:
            print(f"  Generated {i + 1} records...")
    
    df = pd.DataFrame(data)
    df.to_excel(output_path, index=False, engine='openpyxl')
    
    file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"✓ Generated {num_records} records ({file_size_mb:.1f} MB) -> {output_path}")
    
    return output_path


def test_file_reading(file_path):
    """Test file reading with memory monitoring"""
    print(f"\n{'='*60}")
    print("TEST: File Reading")
    print(f"{'='*60}")
    
    file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
    print(f"File: {file_path}")
    print(f"Size: {file_size_mb:.1f} MB")
    
    mem_before = get_memory_usage()
    print(f"Memory before: {mem_before:.1f} MB")
    
    start_time = time.time()
    df = DataCleaner.process_file(file_path)
    elapsed = time.time() - start_time
    
    mem_after = get_memory_usage()
    mem_used = mem_after - mem_before
    
    print(f"\n✓ Successfully read {len(df)} records")
    print(f"  Time: {elapsed:.2f} seconds")
    print(f"  Memory used: {mem_used:.1f} MB")
    print(f"  Memory after: {mem_after:.1f} MB")
    print(f"  Records/second: {len(df)/elapsed:.0f}")
    
    return df


def test_duplicate_detection(df, batch_size=10000):
    """Test duplicate detection"""
    print(f"\n{'='*60}")
    print("TEST: Duplicate Detection")
    print(f"{'='*60}")
    
    mem_before = get_memory_usage()
    print(f"Records: {len(df)}")
    print(f"Memory before: {mem_before:.1f} MB")
    
    start_time = time.time()
    main_df, duplicates_df = ReconciliationService.extract_duplicates(df, batch_size=batch_size)
    elapsed = time.time() - start_time
    
    mem_after = get_memory_usage()
    mem_used = mem_after - mem_before
    
    print(f"\n✓ Duplicate detection complete")
    print(f"  Time: {elapsed:.2f} seconds")
    print(f"  Memory used: {mem_used:.1f} MB")
    print(f"  Unique records: {len(main_df)}")
    print(f"  Duplicates: {len(duplicates_df)}")
    
    return main_df, duplicates_df


def test_full_pipeline(customer_file, internal_file):
    """Test full reconciliation pipeline"""
    print(f"\n{'='*60}")
    print("TEST: Full Reconciliation Pipeline")
    print(f"{'='*60}")
    
    config = Config()
    service = ReconciliationService(config)
    
    mem_before = get_memory_usage()
    print(f"Memory before: {mem_before:.1f} MB")
    
    start_time = time.time()
    
    try:
        stats = service.process_reconciliation(
            customer_file_path=customer_file,
            internal_file_path=internal_file,
            reconciliation_id=999
        )
        elapsed = time.time() - start_time
        
        mem_after = get_memory_usage()
        mem_used = mem_after - mem_before
        
        print(f"\n{'='*60}")
        print("RESULTS")
        print(f"{'='*60}")
        print(f"✓ Reconciliation complete")
        print(f"  Time: {elapsed:.2f} seconds ({elapsed/60:.1f} minutes)")
        print(f"  Memory used: {mem_used:.1f} MB")
        print(f"  Peak memory: {mem_after:.1f} MB")
        print(f"\nStatistics:")
        print(f"  Customer records: {stats['total_customer_records']}")
        print(f"  Internal records: {stats['total_internal_records']}")
        print(f"  Exact matches: {stats['rule_matched']}")
        print(f"  AI matches: {stats['ai_matched']}")
        print(f"  Manual review: {stats['manual_review']}")
        print(f"  Customer unmatched: {stats['customer_unmatched']}")
        print(f"  Internal unmatched: {stats['internal_unmatched']}")
        print(f"  Customer duplicates: {stats['customer_duplicates']}")
        print(f"  Internal duplicates: {stats['internal_duplicates']}")
        print(f"\nReport: {stats['report_path']}")
        
    except Exception as e:
        print(f"\n✗ Error: {str(e)}")
        import traceback
        traceback.print_exc()


def main():
    parser = argparse.ArgumentParser(description='Test system capacity for large datasets')
    parser.add_argument('--records', type=int, help='Number of records to generate for testing')
    parser.add_argument('--file', type=str, help='Path to existing file to test')
    parser.add_argument('--test-memory', action='store_true', help='Run memory stress test')
    parser.add_argument('--full-pipeline', action='store_true', help='Test full reconciliation pipeline')
    parser.add_argument('--batch-size', type=int, default=10000, help='Batch size for processing')
    
    args = parser.parse_args()
    
    if not args.records and not args.file:
        parser.print_help()
        return
    
    print(f"\n{'='*60}")
    print("Asset Reconciliation System - Capacity Test")
    print(f"{'='*60}")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"System Memory: {psutil.virtual_memory().total / (1024**3):.1f} GB")
    print(f"Available Memory: {psutil.virtual_memory().available / (1024**3):.1f} GB")
    print(f"CPU Cores: {psutil.cpu_count()}")
    
    # Generate or use existing file
    if args.file:
        test_file = args.file
    elif args.records:
        test_file = f'test_data_{args.records}_records.xlsx'
        if not os.path.exists(test_file):
            test_file = generate_test_data(args.records, test_file)
    
    # Run tests
    if args.full_pipeline:
        # Generate two files for full pipeline test
        customer_file = f'test_customer_{args.records}_records.xlsx'
        internal_file = f'test_internal_{args.records}_records.xlsx'
        
        if not os.path.exists(customer_file):
            generate_test_data(args.records, customer_file)
        if not os.path.exists(internal_file):
            generate_test_data(int(args.records * 1.2), internal_file)
        
        test_full_pipeline(customer_file, internal_file)
    else:
        # Individual tests
        df = test_file_reading(test_file)
        
        if args.test_memory:
            test_duplicate_detection(df, batch_size=args.batch_size)
    
    print(f"\n{'='*60}")
    print("Test Complete")
    print(f"{'='*60}")


if __name__ == '__main__':
    main()
