import pandas as pd
import os
from datetime import datetime

class ReportGenerator:
    """Generate Excel reports for reconciliation results"""
    
    @staticmethod
    def generate_excel_report(rule_matched_df: pd.DataFrame,
                            ai_matched_df: pd.DataFrame,
                            manual_review_df: pd.DataFrame,
                            customer_unmatched_df: pd.DataFrame,
                            internal_unmatched_df: pd.DataFrame,
                            customer_duplicates_df: pd.DataFrame,
                            internal_duplicates_df: pd.DataFrame,
                            reconciliation_id: int,
                            output_dir: str) -> str:
        """
        Generate comprehensive Excel report with multiple sheets
        Returns the file path
        """
        
        # Create filename with timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'reconciliation_report_{reconciliation_id}_{timestamp}.xlsx'
        filepath = os.path.join(output_dir, filename)
        
        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)
        
        # Create Excel writer
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            
            # Sheet 1: Summary
            # Calculate totals correctly: Unique records + Duplicates
            customer_unique_records = len(customer_unmatched_df) + len(rule_matched_df) + len(ai_matched_df) + len(manual_review_df)
            internal_unique_records = len(internal_unmatched_df) + len(rule_matched_df) + len(ai_matched_df) + len(manual_review_df)
            
            total_customer_records = customer_unique_records + len(customer_duplicates_df)
            total_internal_records = internal_unique_records + len(internal_duplicates_df)
            
            summary_data = {
                'Metric': [
                    '=== CUSTOMER RECORDS ===',
                    'Total Customer Records Uploaded',
                    '  ├─ Unique Records',
                    '  │  ├─ Exact Matches',
                    '  │  ├─ AI-Assisted Matches',
                    '  │  ├─ Manual Review Required',
                    '  │  └─ Unmatched',
                    '  └─ Duplicates (Standalone)',
                    '',
                    '=== INTERNAL RECORDS ===',
                    'Total Internal Records Uploaded',
                    '  ├─ Unique Records',
                    '  │  ├─ Exact Matches',
                    '  │  ├─ AI-Assisted Matches',
                    '  │  ├─ Manual Review Required',
                    '  │  └─ Unmatched',
                    '  └─ Duplicates (Standalone)',
                    '',
                    '=== MATCH STATISTICS ===',
                    'Total Matched (Exact + AI)',
                    'Overall Match Rate (%)',
                    '',
                    '=== VERIFICATION ===',
                    'Customer: Unique + Duplicates',
                    'Internal: Unique + Duplicates'
                ],
                'Count': [
                    '',
                    total_customer_records,
                    customer_unique_records,
                    len(rule_matched_df),
                    len(ai_matched_df),
                    len(manual_review_df),
                    len(customer_unmatched_df),
                    len(customer_duplicates_df),
                    '',
                    '',
                    total_internal_records,
                    internal_unique_records,
                    len(rule_matched_df),
                    len(ai_matched_df),
                    len(manual_review_df),
                    len(internal_unmatched_df),
                    len(internal_duplicates_df),
                    '',
                    '',
                    len(rule_matched_df) + len(ai_matched_df),
                    0,  # Will be calculated below
                    '',
                    '',
                    f"{customer_unique_records} + {len(customer_duplicates_df)} = {total_customer_records}",
                    f"{internal_unique_records} + {len(internal_duplicates_df)} = {total_internal_records}"
                ]
            }
            
            # Calculate match rate
            total_matched = len(rule_matched_df) + len(ai_matched_df)
            match_rate = (total_matched / customer_unique_records * 100) if customer_unique_records > 0 else 0
            summary_data['Count'][20] = round(match_rate, 2)
            
            summary_df = pd.DataFrame(summary_data)
            summary_df.to_excel(writer, sheet_name='Summary', index=False)
            
            # Helper to reorder columns
            def _reorder_matched_columns(df: pd.DataFrame) -> pd.DataFrame:
                if df.empty:
                    return df
                    
                ordered_columns = [
                    'internal_old_tag', 'internal_new_tag', 
                    'internal_year', 'internal_category',
                    'internal_description', 
                    'internal_serial_no', 
                    'internal_department', 
                    'internal_district', 
                    'internal_book_value', 
                    'internal_asset_number',
                    'customer_old_tag', 'customer_new_tag',
                    'customer_year', 'customer_category',
                    'customer_description',
                    'customer_serial_no',
                    'customer_department', 'customer_district', 'customer_book_value',
                    'match_type', 'match_method', 'confidence_score'
                ]
                
                if 'ai_reasoning' in df.columns:
                    ordered_columns.append('ai_reasoning')
                    
                # Only include columns that actually exist
                actual_columns = [col for col in ordered_columns if col in df.columns]
                
                # Add any remaining columns
                remaining = [col for col in df.columns if col not in actual_columns]
                
                return df[actual_columns + remaining]
            
            # Sheet 2: Rule-Based Matches
            if not rule_matched_df.empty:
                _reorder_matched_columns(rule_matched_df).to_excel(writer, sheet_name='Exact_Matched_By_Tag', index=False)
            else:
                pd.DataFrame({'Message': ['No rule-based matches found']}).to_excel(
                    writer, sheet_name='Exact_Matched_By_Tag', index=False
                )
            
            # Sheet 3: AI-Assisted Matches
            if not ai_matched_df.empty:
                _reorder_matched_columns(ai_matched_df).to_excel(writer, sheet_name='AI_Matched_Need_Manual_Review', index=False)
            else:
                pd.DataFrame({'Message': ['No AI-assisted matches found']}).to_excel(
                    writer, sheet_name='AI_Matched_Need_Manual_Review', index=False
                )
            
            # Sheet 4: Manual Review
            if not manual_review_df.empty:
                _reorder_matched_columns(manual_review_df).to_excel(writer, sheet_name='Matched_Need_Manual_Review', index=False)
            else:
                pd.DataFrame({'Message': ['No records requiring manual review']}).to_excel(
                    writer, sheet_name='Matched_Need_Manual_Review', index=False
                )
            
            # Sheet 5: Customer Unmatched
            if not customer_unmatched_df.empty:
                customer_unmatched_df.to_excel(writer, sheet_name='Customer_Unmatched', index=False)
            else:
                pd.DataFrame({'Message': ['No unmatched customer records']}).to_excel(
                    writer, sheet_name='Customer_Unmatched', index=False
                )
            
            # Sheet 6: Internal Unmatched
            if not internal_unmatched_df.empty:
                internal_unmatched_df.to_excel(writer, sheet_name='Finance_Unmatched', index=False)
            else:
                pd.DataFrame({'Message': ['No unmatched internal records']}).to_excel(
                    writer, sheet_name='Finance_Unmatched', index=False
                )
            
            # Sheet 7: Customer Duplicates
            if not customer_duplicates_df.empty:
                customer_duplicates_df.to_excel(writer, sheet_name='Customer_Duplicates', index=False)
            else:
                pd.DataFrame({'Message': ['No duplicate customer records']}).to_excel(
                    writer, sheet_name='Customer_Duplicates', index=False
                )
            
            # Sheet 8: Internal Duplicates
            if not internal_duplicates_df.empty:
                internal_duplicates_df.to_excel(writer, sheet_name='Finance_Duplicates', index=False)
            else:
                pd.DataFrame({'Message': ['No duplicate Finance records']}).to_excel(
                    writer, sheet_name='Finance_Duplicates', index=False
                )
        
        return filepath
