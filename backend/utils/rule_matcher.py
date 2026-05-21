import pandas as pd
from typing import Tuple, List, Dict

class RuleMatcher:
    """Rule-based exact matching for asset reconciliation"""
    
    @staticmethod
    def exact_match(customer_df: pd.DataFrame, internal_df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """
        Perform exact matching using tag numbers
        Returns: (matched_df, unmatched_customer_df, unmatched_internal_df)
        """
        matched_records = []
        matched_customer_indices = set()
        matched_internal_indices = set()
        
        # Add source identifier
        customer_df = customer_df.copy()
        internal_df = internal_df.copy()
        customer_df['source_index'] = customer_df.index
        internal_df['source_index'] = internal_df.index
        
        # Strategy 1: Old-Old matching
        matches = RuleMatcher._match_on_field(
            customer_df, internal_df, 
            'old_tag_number', 'old_tag_number',
            matched_customer_indices, matched_internal_indices,
            'OLD-OLD'
        )
        matched_records.extend(matches)
        
        # Strategy 2: New-New matching
        matches = RuleMatcher._match_on_field(
            customer_df, internal_df,
            'new_tag_number', 'new_tag_number',
            matched_customer_indices, matched_internal_indices,
            'NEW-NEW'
        )
        matched_records.extend(matches)
        
        # Strategy 3: Old-New matching (customer old = internal new)
        matches = RuleMatcher._match_on_field(
            customer_df, internal_df,
            'old_tag_number', 'new_tag_number',
            matched_customer_indices, matched_internal_indices,
            'OLD-NEW'
        )
        matched_records.extend(matches)
        
        # Strategy 4: New-Old matching (customer new = internal old)
        matches = RuleMatcher._match_on_field(
            customer_df, internal_df,
            'new_tag_number', 'old_tag_number',
            matched_customer_indices, matched_internal_indices,
            'NEW-OLD'
        )
        matched_records.extend(matches)
        
        # Create matched DataFrame
        if matched_records:
            matched_df = pd.DataFrame(matched_records)
        else:
            matched_df = pd.DataFrame()
        
        # Get unmatched records
        unmatched_customer = customer_df[~customer_df['source_index'].isin(matched_customer_indices)].copy()
        unmatched_internal = internal_df[~internal_df['source_index'].isin(matched_internal_indices)].copy()
        
        # Remove source_index column
        unmatched_customer = unmatched_customer.drop('source_index', axis=1)
        unmatched_internal = unmatched_internal.drop('source_index', axis=1)
        
        return matched_df, unmatched_customer, unmatched_internal
    
    @staticmethod
    def _match_on_field(customer_df: pd.DataFrame, internal_df: pd.DataFrame,
                       customer_field: str, internal_field: str,
                       matched_customer_indices: set, matched_internal_indices: set,
                       match_type: str) -> List[Dict]:
        """Match records on specific fields"""
        matches = []
        
        for c_idx, c_row in customer_df.iterrows():
            # Skip if already matched
            if c_row['source_index'] in matched_customer_indices:
                continue
            
            customer_value = c_row[customer_field]
            
            # Skip empty values
            if not customer_value or customer_value == '':
                continue
            
            for i_idx, i_row in internal_df.iterrows():
                # Skip if already matched
                if i_row['source_index'] in matched_internal_indices:
                    continue
                
                internal_value = i_row[internal_field]
                
                # Skip empty values
                if not internal_value or internal_value == '':
                    continue
                
                # Exact match
                if customer_value == internal_value:
                    match_record = RuleMatcher._create_match_record(
                        c_row, i_row, match_type, 1.0
                    )
                    matches.append(match_record)
                    matched_customer_indices.add(c_row['source_index'])
                    matched_internal_indices.add(i_row['source_index'])
                    break
        
        return matches
    
    @staticmethod
    def _create_match_record(customer_row: pd.Series, internal_row: pd.Series,
                            match_type: str, confidence: float) -> Dict:
        """Create a matched record with parallel columns"""
        return {
            # Customer data
            'customer_old_tag': customer_row['old_tag_number'],
            'customer_new_tag': customer_row['new_tag_number'],
            'customer_year': customer_row['year'],
            'customer_category': customer_row['category'],
            'customer_description': customer_row['description'],
            'customer_serial_no': customer_row['serial_no'],
            'customer_department': customer_row['department'],
            'customer_district': customer_row['district'],
            'customer_book_value': customer_row['book_value'],
            'customer_asset_number': customer_row['asset_number'],
            
            # Internal data
            'internal_old_tag': internal_row['old_tag_number'],
            'internal_new_tag': internal_row['new_tag_number'],
            'internal_year': internal_row['year'],
            'internal_category': internal_row['category'],
            'internal_description': internal_row['description'],
            'internal_serial_no': internal_row['serial_no'],
            'internal_department': internal_row['department'],
            'internal_district': internal_row['district'],
            'internal_book_value': internal_row['book_value'],
            'internal_asset_number': internal_row['asset_number'],
            
            # Metadata
            'match_type': match_type,
            'match_method': 'RULE_BASED',
            'confidence_score': confidence
        }
