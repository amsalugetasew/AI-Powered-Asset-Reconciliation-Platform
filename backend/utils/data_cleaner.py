import pandas as pd
import re
import os
from typing import Dict, List

class DataCleaner:
    """Clean and standardize Excel data"""
    
    COLUMN_MAPPING = {
        'old tag number': 'old_tag_number',
        'old_tag': 'old_tag_number',
        'old tag no': 'old_tag_number',
        'new tag number': 'new_tag_number',
        'new_tag': 'new_tag_number',
        'new tag no': 'new_tag_number',
        'year': 'year',
        'category': 'category',
        'description': 'description',
        'desc': 'description',
        'serial no': 'serial_no',
        'serial number': 'serial_no',
        'serial': 'serial_no',
        'department': 'department',
        'unit': 'department',
        'department/unit': 'department',
        'district': 'district',
        'book value': 'book_value',
        'value': 'book_value',
        'asset number': 'asset_number',
        'asset no': 'asset_number',
        'asset_no': 'asset_number'
    }
    
    @staticmethod
    def read_excel(file_path: str) -> pd.DataFrame:
        """
        Read Excel file and return DataFrame.
        For large files, pandas handles memory efficiently.
        """
        try:
            # Check file size for logging
            file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
            
            if file_size_mb > 50:
                print(f"  Large file detected ({file_size_mb:.1f}MB) - this may take a moment...")
            
            # Read entire file - pandas is optimized for this
            df = pd.read_excel(file_path, engine='openpyxl')
            print(f"  ✓ Read {len(df)} rows from Excel file ({file_size_mb:.1f}MB)")
            return df
                
        except Exception as e:
            raise ValueError(f"Error reading Excel file: {str(e)}")
    
    @staticmethod
    def standardize_columns(df: pd.DataFrame) -> pd.DataFrame:
        """Standardize column names"""
        # Convert column names to lowercase and strip whitespace
        df.columns = df.columns.str.lower().str.strip()
        
        # Map columns to standard names
        column_rename = {}
        for col in df.columns:
            if col in DataCleaner.COLUMN_MAPPING:
                column_rename[col] = DataCleaner.COLUMN_MAPPING[col]
        
        df = df.rename(columns=column_rename)
        
        # Drop duplicated columns (keep first) to prevent ambiguous Series errors
        df = df.loc[:, ~df.columns.duplicated(keep='first')]
        
        # Ensure all required columns exist
        required_columns = [
            'old_tag_number', 'new_tag_number', 'year', 'category',
            'description', 'serial_no', 'department', 'district',
            'book_value', 'asset_number'
        ]
        
        for col in required_columns:
            if col not in df.columns:
                df[col] = None
        
        return df[required_columns]
    
    @staticmethod
    def clean_text(value) -> str:
        """Clean text values"""
        if pd.isna(value):
            return ''
        
        value = str(value).strip()
        # Remove extra whitespace
        value = re.sub(r'\s+', ' ', value)
        # Convert to uppercase for consistency
        value = value.upper()
        return value
    
    @staticmethod
    def clean_numeric(value) -> float:
        """Clean numeric values"""
        if pd.isna(value):
            return 0.0
        
        try:
            # Remove currency symbols and commas
            if isinstance(value, str):
                value = re.sub(r'[^\d.-]', '', value)
            return float(value)
        except:
            return 0.0
    
    @staticmethod
    def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
        """Clean all values in DataFrame"""
        df = df.copy()
        
        text_columns = ['old_tag_number', 'new_tag_number', 'category', 
                       'description', 'serial_no', 'department', 'district', 'asset_number']
        for col in text_columns:
            if col in df.columns:
                df[col] = df[col].apply(DataCleaner.clean_text)
        
        # Clean numeric columns
        if 'book_value' in df.columns:
            df['book_value'] = df['book_value'].apply(DataCleaner.clean_numeric)
        
        if 'year' in df.columns:
            df['year'] = df['year'].apply(lambda x: int(DataCleaner.clean_numeric(x)) if DataCleaner.clean_numeric(x) > 0 else None)
        
        # Replace empty strings with NA temporarily to drop completely empty rows
        # We only consider rows where text is empty and numerics are NaN/0 as empty
        df = df.replace('', pd.NA)
        
        # Remove completely empty rows
        df = df.dropna(how='all')
        
        # Fill NA back with empty strings for text columns
        df = df.fillna('')
        
        # Reset index
        df = df.reset_index(drop=True)
        
        return df
    
    @staticmethod
    def process_file(file_path: str) -> pd.DataFrame:
        """Complete file processing pipeline"""
        df = DataCleaner.read_excel(file_path)
        df = DataCleaner.standardize_columns(df)
        df = DataCleaner.clean_dataframe(df)
        return df
