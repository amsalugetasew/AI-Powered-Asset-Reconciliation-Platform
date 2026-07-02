import pandas as pd
from fuzzywuzzy import fuzz
from typing import Tuple, List, Dict

class FuzzyMatcher:
    """Fuzzy matching for asset reconciliation"""
    
    @staticmethod
    def calculate_similarity(customer_row: pd.Series, internal_row: pd.Series) -> float:
        """Calculate overall similarity score between two records"""
        scores = []
        weights = []
        
        # Description similarity (weight: 0.35)
        if customer_row.get('description') and internal_row.get('description'):
            desc_score = fuzz.token_set_ratio(
                str(customer_row['description']),
                str(internal_row['description'])
            ) / 100.0
            scores.append(desc_score)
            weights.append(0.35)
        
        # # Serial number similarity (weight: 0.20)
        # if customer_row.get('serial_no') and internal_row.get('serial_no'):
        #     serial_score = fuzz.ratio(
        #         str(customer_row['serial_no']),
        #         str(internal_row['serial_no'])
        #     ) / 100.0
        #     scores.append(serial_score)
        #     weights.append(0.20)
        
        # Department similarity (weight: 0.10)
        if customer_row.get('department') and internal_row.get('department'):
            dept_score = fuzz.token_set_ratio(
                str(customer_row['department']),
                str(internal_row['department'])
            ) / 100.0
            scores.append(dept_score)
            weights.append(0.10)
        
        # Asset number similarity (weight: 0.10)
        if customer_row.get('asset_number') and internal_row.get('asset_number'):
            asset_score = fuzz.ratio(
                str(customer_row['asset_number']),
                str(internal_row['asset_number'])
            ) / 100.0
            scores.append(asset_score)
            weights.append(0.10)
            
        # Category similarity (weight: 0.15)
        if customer_row.get('category') and internal_row.get('category'):
            cat_score = fuzz.token_set_ratio(
                str(customer_row['category']),
                str(internal_row['category'])
            ) / 100.0
            scores.append(cat_score)
            weights.append(0.15)
            
        # District similarity (weight: 0.10)
        if customer_row.get('district') and internal_row.get('district'):
            dist_score = fuzz.token_set_ratio(
                str(customer_row['district']),
                str(internal_row['district'])
            ) / 100.0
            scores.append(dist_score)
            weights.append(0.10)
            
        # Year similarity (weight: 0.15)
        if pd.notna(customer_row.get('year')) and pd.notna(internal_row.get('year')):
            try:
                c_year = int(customer_row['year'])
                i_year = int(internal_row['year'])
                if c_year == i_year:
                    scores.append(1.0)
                else:
                    year_diff = abs(c_year - i_year)
                    year_score = max(0.0, 1.0 - (year_diff * 0.1))
                    scores.append(year_score)
                weights.append(0.15)
            except (ValueError, TypeError):
                pass
        
        # Book value similarity (weight: 0.05)
        if pd.notna(customer_row.get('book_value')) and pd.notna(internal_row.get('book_value')):
            try:
                c_value = float(customer_row['book_value'])
                i_value = float(internal_row['book_value'])
                if c_value > 0 and i_value > 0:
                    value_diff = abs(c_value - i_value) / max(c_value, i_value)
                    value_score = 1.0 - min(value_diff, 1.0)
                    scores.append(value_score)
                    weights.append(0.05)
            except (ValueError, TypeError):
                pass
        
        # Calculate weighted average
        if not scores:
            return 0.0
        
        total_weight = sum(weights)
        weighted_sum = sum(s * w for s, w in zip(scores, weights))
        
        return weighted_sum / total_weight if total_weight > 0 else 0.0
    
    @staticmethod
    def fuzzy_match(customer_df: pd.DataFrame, internal_df: pd.DataFrame,
                   threshold: float = 0.60, batch_size: int = 10000, 
                   max_comparisons_per_record: int = 5000) -> Tuple[List[Dict], pd.DataFrame, pd.DataFrame]:
        """
        Perform fuzzy matching on unmatched records with batch processing for large datasets.
        
        Args:
            customer_df: Customer records DataFrame
            internal_df: Internal records DataFrame  
            threshold: Minimum similarity threshold for matching
            batch_size: Number of customer records to process in each batch
            max_comparisons_per_record: Max internal records to compare per customer record
            
        Returns: (potential_matches, remaining_customer, remaining_internal)
        """
        potential_matches = []
        matched_customer_indices = set()
        matched_internal_indices = set()
        
        customer_df = customer_df.copy()
        internal_df = internal_df.copy()
        customer_df['source_index'] = customer_df.index
        internal_df['source_index'] = internal_df.index
        
        total_customers = len(customer_df)
        total_internals = len(internal_df)
        
        print(f"  Starting fuzzy matching: {total_customers} customer vs {total_internals} internal records")
        print(f"  Threshold: {threshold}, Batch size: {batch_size}")
        
        # For large datasets, use batch processing
        if total_customers > batch_size:
            print(f"  Using batch processing for large dataset...")
            
            for batch_start in range(0, total_customers, batch_size):
                batch_end = min(batch_start + batch_size, total_customers)
                customer_batch = customer_df.iloc[batch_start:batch_end]
                
                print(f"    Processing batch {batch_start//batch_size + 1}: records {batch_start+1}-{batch_end}/{total_customers}")
                
                batch_matches = FuzzyMatcher._process_batch(
                    customer_batch, internal_df, threshold,
                    matched_customer_indices, matched_internal_indices,
                    max_comparisons_per_record
                )
                
                potential_matches.extend(batch_matches)
                print(f"      Found {len(batch_matches)} matches in this batch (total: {len(potential_matches)})")
        else:
            # For smaller datasets, process all at once
            for c_idx, c_row in customer_df.iterrows():
                if c_row['source_index'] in matched_customer_indices:
                    continue
                
                best_match = None
                best_score = 0.0
                best_internal_idx = None
                
                # Limit comparisons for very large internal datasets
                internal_sample = internal_df
                if len(internal_df) > max_comparisons_per_record:
                    # Sample based on category first to reduce search space
                    if pd.notna(c_row.get('category')) and c_row['category']:
                        internal_sample = internal_df[internal_df['category'] == c_row['category']]
                        if len(internal_sample) == 0:
                            internal_sample = internal_df.sample(min(max_comparisons_per_record, len(internal_df)))
                    else:
                        internal_sample = internal_df.sample(min(max_comparisons_per_record, len(internal_df)))
                
                for i_idx, i_row in internal_sample.iterrows():
                    if i_row['source_index'] in matched_internal_indices:
                        continue
                    
                    similarity = FuzzyMatcher.calculate_similarity(c_row, i_row)
                    
                    if similarity > best_score and similarity >= threshold:
                        best_score = similarity
                        best_match = i_row
                        best_internal_idx = i_row['source_index']
                
                if best_match is not None:
                    match_record = {
                        # Customer data
                        'customer_old_tag': c_row['old_tag_number'],
                        'customer_new_tag': c_row['new_tag_number'],
                        'customer_year': c_row['year'],
                        'customer_category': c_row['category'],
                        'customer_description': c_row['description'],
                        'customer_department': c_row['department'],
                        'customer_district': c_row['district'],
                        'customer_book_value': c_row['book_value'],
                        'customer_asset_number': c_row['asset_number'],
                        'customer_source_index': c_row.get('source_index', None),
                        
                        # Internal data
                        'internal_old_tag': best_match['old_tag_number'],
                        'internal_new_tag': best_match['new_tag_number'],
                        'internal_year': best_match['year'],
                        'internal_category': best_match['category'],
                        'internal_description': best_match['description'],
                        'internal_department': best_match['department'],
                        'internal_district': best_match['district'],
                        'internal_book_value': best_match['book_value'],
                        'internal_asset_number': best_match['asset_number'],
                        'internal_source_index': best_match.get('source_index', None),
                        
                        # Metadata
                        'match_type': 'FUZZY',
                        'match_method': 'FUZZY_MATCHING',
                        'confidence_score': round(best_score, 4)
                    }
                    
                    potential_matches.append(match_record)
                    matched_customer_indices.add(c_row['source_index'])
                    matched_internal_indices.add(best_internal_idx)
        
        # Get remaining unmatched
        remaining_customer = customer_df[~customer_df['source_index'].isin(matched_customer_indices)].copy()
        remaining_internal = internal_df[~internal_df['source_index'].isin(matched_internal_indices)].copy()
        
        remaining_customer = remaining_customer.drop('source_index', axis=1)
        remaining_internal = remaining_internal.drop('source_index', axis=1)
        
        print(f"  ✓ Fuzzy matching complete: {len(potential_matches)} matches found")
        print(f"    Remaining: {len(remaining_customer)} customer, {len(remaining_internal)} internal")
        
        return potential_matches, remaining_customer, remaining_internal
    
    @staticmethod
    def _process_batch(customer_batch: pd.DataFrame, internal_df: pd.DataFrame, 
                      threshold: float, matched_customer_indices: set, 
                      matched_internal_indices: set, max_comparisons: int) -> List[Dict]:
        """Process a batch of customer records against internal records"""
        batch_matches = []
        
        for c_idx, c_row in customer_batch.iterrows():
            if c_row['source_index'] in matched_customer_indices:
                continue
            
            best_match = None
            best_score = 0.0
            best_internal_idx = None
            
            # Limit comparisons for very large internal datasets
            internal_sample = internal_df
            if len(internal_df) > max_comparisons:
                # Sample based on category first to reduce search space
                if pd.notna(c_row.get('category')) and c_row['category']:
                    internal_sample = internal_df[internal_df['category'] == c_row['category']]
                    if len(internal_sample) == 0:
                        internal_sample = internal_df.sample(min(max_comparisons, len(internal_df)))
                else:
                    internal_sample = internal_df.sample(min(max_comparisons, len(internal_df)))
            
            for i_idx, i_row in internal_sample.iterrows():
                if i_row['source_index'] in matched_internal_indices:
                    continue
                
                similarity = FuzzyMatcher.calculate_similarity(c_row, i_row)
                
                if similarity > best_score and similarity >= threshold:
                    best_score = similarity
                    best_match = i_row
                    best_internal_idx = i_row['source_index']
            
            if best_match is not None:
                match_record = {
                    # Customer data
                    'customer_old_tag': c_row['old_tag_number'],
                    'customer_new_tag': c_row['new_tag_number'],
                    'customer_year': c_row['year'],
                    'customer_category': c_row['category'],
                    'customer_description': c_row['description'],
                    'customer_department': c_row['department'],
                    'customer_district': c_row['district'],
                    'customer_book_value': c_row['book_value'],
                    'customer_asset_number': c_row['asset_number'],
                    'customer_source_index': c_row.get('source_index', None),
                    
                    # Internal data
                    'internal_old_tag': best_match['old_tag_number'],
                    'internal_new_tag': best_match['new_tag_number'],
                    'internal_year': best_match['year'],
                    'internal_category': best_match['category'],
                    'internal_description': best_match['description'],
                    'internal_department': best_match['department'],
                    'internal_district': best_match['district'],
                    'internal_book_value': best_match['book_value'],
                    'internal_asset_number': best_match['asset_number'],
                    'internal_source_index': best_match.get('source_index', None),
                    
                    # Metadata
                    'match_type': 'FUZZY',
                    'match_method': 'FUZZY_MATCHING',
                    'confidence_score': round(best_score, 4)
                }
                
                batch_matches.append(match_record)
                matched_customer_indices.add(c_row['source_index'])
                matched_internal_indices.add(best_internal_idx)
        
        return batch_matches
