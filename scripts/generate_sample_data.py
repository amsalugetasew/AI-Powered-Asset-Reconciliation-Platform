"""
Generate sample Excel files for testing AssetSync AI
"""
import pandas as pd
import random
from datetime import datetime

def generate_sample_data():
    """Generate sample customer and internal asset data"""
    
    # Sample data
    categories = ['Computer', 'Furniture', 'Equipment', 'Vehicle', 'Building']
    departments = ['IT', 'Admin', 'Finance', 'HR', 'Operations']
    districts = ['North', 'South', 'East', 'West', 'Central']
    
    descriptions = {
        'Computer': ['Dell Laptop', 'HP Desktop', 'MacBook Pro', 'Lenovo ThinkPad', 'Surface Pro'],
        'Furniture': ['Office Desk', 'Conference Table', 'Office Chair', 'Filing Cabinet', 'Bookshelf'],
        'Equipment': ['Printer', 'Scanner', 'Projector', 'Photocopier', 'Shredder'],
        'Vehicle': ['Toyota Camry', 'Honda Accord', 'Ford F-150', 'Chevrolet Silverado', 'Tesla Model 3'],
        'Building': ['Office Building', 'Warehouse', 'Retail Store', 'Factory', 'Distribution Center']
    }
    
    # Generate customer data (100 records)
    customer_data = []
    for i in range(1, 101):
        category = random.choice(categories)
        customer_data.append({
            'Old Tag Number': f'CUST-OLD-{i:04d}',
            'New Tag Number': f'CUST-NEW-{i:04d}',
            'Year': random.randint(2020, 2024),
            'Category': category,
            'Description': random.choice(descriptions[category]),
            'Serial No': f'SN{random.randint(10000, 99999)}',
            'Department': random.choice(departments),
            'District': random.choice(districts),
            'Book Value': round(random.uniform(100, 50000), 2),
            'Asset Number': f'AST-C-{i:04d}'
        })
    
    # Generate internal data (100 records)
    # 70% exact matches, 20% fuzzy matches, 10% no match
    internal_data = []
    
    # 70 exact matches (same as customer)
    for i in range(1, 71):
        customer_record = customer_data[i-1].copy()
        customer_record['Old Tag Number'] = f'INT-OLD-{i:04d}'
        customer_record['New Tag Number'] = f'INT-NEW-{i:04d}'
        customer_record['Asset Number'] = f'AST-I-{i:04d}'
        # Some records match on old tag, some on new tag
        if i % 2 == 0:
            customer_record['Old Tag Number'] = customer_data[i-1]['Old Tag Number']
        else:
            customer_record['New Tag Number'] = customer_data[i-1]['New Tag Number']
        internal_data.append(customer_record)
    
    # 20 fuzzy matches (similar but not exact)
    for i in range(71, 91):
        customer_record = customer_data[i-1].copy()
        # Slightly modify description
        customer_record['Description'] = customer_record['Description'] + ' (Refurbished)'
        # Slightly different serial number
        customer_record['Serial No'] = f'SN{random.randint(10000, 99999)}'
        # Different tags
        customer_record['Old Tag Number'] = f'INT-OLD-{i:04d}'
        customer_record['New Tag Number'] = f'INT-NEW-{i:04d}'
        customer_record['Asset Number'] = f'AST-I-{i:04d}'
        # Slightly different book value
        customer_record['Book Value'] = customer_record['Book Value'] * random.uniform(0.9, 1.1)
        internal_data.append(customer_record)
    
    # 10 completely different records (no match)
    for i in range(91, 101):
        category = random.choice(categories)
        internal_data.append({
            'Old Tag Number': f'INT-OLD-{i:04d}',
            'New Tag Number': f'INT-NEW-{i:04d}',
            'Year': random.randint(2020, 2024),
            'Category': category,
            'Description': random.choice(descriptions[category]),
            'Serial No': f'SN{random.randint(10000, 99999)}',
            'Department': random.choice(departments),
            'District': random.choice(districts),
            'Book Value': round(random.uniform(100, 50000), 2),
            'Asset Number': f'AST-I-{i:04d}'
        })
    
    # Create DataFrames
    customer_df = pd.DataFrame(customer_data)
    internal_df = pd.DataFrame(internal_data)
    
    # Shuffle internal data
    internal_df = internal_df.sample(frac=1).reset_index(drop=True)
    
    # Save to Excel
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    customer_filename = f'sample_customer_assets_{timestamp}.xlsx'
    internal_filename = f'sample_internal_assets_{timestamp}.xlsx'
    
    customer_df.to_excel(customer_filename, index=False)
    internal_df.to_excel(internal_filename, index=False)
    
    print(f"✅ Generated sample data:")
    print(f"   Customer file: {customer_filename} ({len(customer_df)} records)")
    print(f"   Internal file: {internal_filename} ({len(internal_df)} records)")
    print(f"\n📊 Expected results:")
    print(f"   - Exact matches: ~70 records")
    print(f"   - Fuzzy matches: ~20 records")
    print(f"   - Unmatched: ~10 records")
    print(f"\n💡 Upload these files to test the reconciliation system!")

if __name__ == '__main__':
    generate_sample_data()
