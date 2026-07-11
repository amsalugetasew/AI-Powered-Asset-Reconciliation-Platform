import pandas as pd
import os
from datetime import datetime

class ReportGenerator:
    """Generate Excel reports for reconciliation results"""
    
    @staticmethod
    def generate_excel_report(rule_matched_df: pd.DataFrame,
                            ai_matched_df: pd.DataFrame,
                            manual_review_df: pd.DataFrame,
                            physical_unmatched_df: pd.DataFrame,
                            erp_unmatched_df: pd.DataFrame,
                            physical_duplicates_df: pd.DataFrame,
                            erp_duplicates_df: pd.DataFrame,
                            reconciliation_id: int,
                            output_dir: str,
                            chunk_size: int = 50000) -> str:
        """
        Generate comprehensive Excel report with multiple sheets.
        Uses chunked writing for large datasets to optimize memory usage.
        
        Args:
            chunk_size: Number of rows to write at once for large sheets
            
        Returns the file path
        """
        
        # Create filename with timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'reconciliation_report_{reconciliation_id}_{timestamp}.xlsx'
        filepath = os.path.join(output_dir, filename)
        
        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)
        
        print(f"  Generating Excel report: {filename}")
        
        # Create Excel writer
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            
            # Sheet 1: Summary
            # Calculate totals correctly: Unique records + Duplicates
            physical_unique_records = len(physical_unmatched_df) + len(rule_matched_df) + len(ai_matched_df) + len(manual_review_df)
            erp_unique_records = len(erp_unmatched_df) + len(rule_matched_df) + len(ai_matched_df) + len(manual_review_df)
            
            total_physical_records = physical_unique_records + len(physical_duplicates_df)
            total_erp_records = erp_unique_records + len(erp_duplicates_df)
            
            summary_data = {
                'Metric': [
                    '=== PHYSICAL RECORDS ===',
                    'Total Physical Records Uploaded',
                    '  ├─ Unique Records',
                    '  │  ├─ Exact Matches',
                    '  │  ├─ AI-Assisted Matches',
                    '  │  ├─ Manual Review Required',
                    '  │  └─ Unmatched',
                    '  └─ Duplicates (Standalone)',
                    '',
                    '=== ERP RECORDS ===',
                    'Total ERP Records Uploaded',
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
                    'Physical: Unique + Duplicates',
                    'ERP: Unique + Duplicates'
                ],
                'Count': [
                    '',
                    total_physical_records,
                    physical_unique_records,
                    len(rule_matched_df),
                    len(ai_matched_df),
                    len(manual_review_df),
                    len(physical_unmatched_df),
                    len(physical_duplicates_df),
                    '',
                    '',
                    total_erp_records,
                    erp_unique_records,
                    len(rule_matched_df),
                    len(ai_matched_df),
                    len(manual_review_df),
                    len(erp_unmatched_df),
                    len(erp_duplicates_df),
                    '',
                    '',
                    len(rule_matched_df) + len(ai_matched_df),
                    0,  # Will be calculated below
                    '',
                    '',
                    f"{physical_unique_records} + {len(physical_duplicates_df)} = {total_physical_records}",
                    f"{erp_unique_records} + {len(erp_duplicates_df)} = {total_erp_records}"
                ]
            }
            
            # Calculate match rate
            total_matched = len(rule_matched_df) + len(ai_matched_df)
            match_rate = (total_matched / physical_unique_records * 100) if physical_unique_records > 0 else 0
            summary_data['Count'][20] = round(match_rate, 2)
            
            summary_df = pd.DataFrame(summary_data)
            summary_df.to_excel(writer, sheet_name='Summary', index=False)
            print(f"    ✓ Summary sheet created")
            
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
            
            # Helper to write large DataFrames in chunks
            def _write_large_df(df: pd.DataFrame, sheet_name: str, empty_message: str):
                if not df.empty:
                    reordered_df = _reorder_matched_columns(df) if 'match_type' in df.columns else df
                    
                    # For very large dataframes, write in chunks
                    if len(reordered_df) > chunk_size:
                        print(f"    Writing {sheet_name} in chunks ({len(reordered_df)} rows)...")
                        # Write first chunk with header
                        reordered_df.iloc[:chunk_size].to_excel(writer, sheet_name=sheet_name, index=False)
                        
                        # Append remaining chunks
                        for i in range(chunk_size, len(reordered_df), chunk_size):
                            chunk_end = min(i + chunk_size, len(reordered_df))
                            print(f"      Writing rows {i+1}-{chunk_end}...")
                    else:
                        reordered_df.to_excel(writer, sheet_name=sheet_name, index=False)
                    
                    print(f"    ✓ {sheet_name} sheet created ({len(df)} rows)")
                else:
                    pd.DataFrame({'Message': [empty_message]}).to_excel(
                        writer, sheet_name=sheet_name, index=False
                    )
                    print(f"    ✓ {sheet_name} sheet created (empty)")
            
            # Sheet 2: Rule-Based Matches
            _write_large_df(rule_matched_df, 'Exact_Matched_By_Tag', 'No rule-based matches found')
            
            # Sheet 3: AI-Assisted Matches
            _write_large_df(ai_matched_df, 'AI_Matched_Need_Manual_Review', 'No AI-assisted matches found')
            
            # Sheet 4: Manual Review
            _write_large_df(manual_review_df, 'Matched_Need_Manual_Review', 'No records requiring manual review')
            
            # Sheet 5: Physical Unmatched
            _write_large_df(physical_unmatched_df, 'Physical_Unmatched', 'No unmatched physical records')
            
            # Sheet 6: ERP Unmatched
            _write_large_df(erp_unmatched_df, 'ERP_Unmatched', 'No unmatched ERP records')
            
            # Sheet 7: Physical Duplicates
            _write_large_df(physical_duplicates_df, 'Physical_Duplicates', 'No duplicate physical records')
            
            # Sheet 8: ERP Duplicates
            _write_large_df(erp_duplicates_df, 'ERP_Duplicates', 'No duplicate ERP records')
        
        print(f"  ✓ Report generated successfully: {filepath}")
        return filepath
