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
                   threshold: float = 0.60) -> Tuple[List[Dict], pd.DataFrame, pd.DataFrame]:
        """
        Perform fuzzy matching on unmatched records
        Returns: (potential_matches, remaining_customer, remaining_internal)
        """
        potential_matches = []
        matched_customer_indices = set()
        matched_internal_indices = set()
        
        customer_df = customer_df.copy()
        internal_df = internal_df.copy()
        customer_df['source_index'] = customer_df.index
        internal_df['source_index'] = internal_df.index
        
        for c_idx, c_row in customer_df.iterrows():
            if c_row['source_index'] in matched_customer_indices:
                continue
            
            best_match = None
            best_score = 0.0
            best_internal_idx = None
            
            for i_idx, i_row in internal_df.iterrows():
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
                    # 'customer_serial_no': 0,#c_row['serial_no'],
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
                    # 'internal_serial_no': 0,#best_match['serial_no'],
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
        
        return potential_matches, remaining_customer, remaining_internal
