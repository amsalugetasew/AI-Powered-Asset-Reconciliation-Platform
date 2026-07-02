import pandas as pd
from typing import Dict, Tuple
import os
from datetime import datetime

from utils.data_cleaner import DataCleaner
from utils.rule_matcher import RuleMatcher
from utils.fuzzy_matcher import FuzzyMatcher
from utils.ai_matcher import AIMatcher
from utils.report_generator import ReportGenerator

class ReconciliationService:
    """Main service for asset reconciliation"""
    
    def __init__(self, config):
        """Initialize reconciliation service"""
        self.config = config
        self.ai_match_threshold = config.AI_MATCH_THRESHOLD
        self.manual_review_threshold = config.MANUAL_REVIEW_THRESHOLD
        self.fuzzy_prefilter_threshold = config.FUZZY_PREFILTER_THRESHOLD
        self.ai_top_k_candidates = config.AI_TOP_K_CANDIDATES
        self.rate_limit_delay = config.RATE_LIMIT_DELAY
        self.max_retries = config.MAX_RETRIES
        
        # Initialize AI matcher if API key is available
        self.ai_matcher = None
        api_key = config.OPENAI_API_KEY
        
        if api_key and api_key.strip():
            try:
                self.ai_matcher = AIMatcher(
                    provider='groq',
                    api_key=api_key,
                    model='llama-3.3-70b-versatile',
                    fuzzy_threshold=self.fuzzy_prefilter_threshold,
                    rate_limit_delay=self.rate_limit_delay,
                    max_retries=self.max_retries
                )
                print(f"✓ AI Matcher initialized successfully")
                print(f"  - AI Match Threshold: {self.ai_match_threshold}")
                print(f"  - Manual Review Threshold: {self.manual_review_threshold}")
                print(f"  - Fuzzy Pre-filter Threshold: {self.fuzzy_prefilter_threshold}")
                print(f"  - Top K Candidates: {self.ai_top_k_candidates}")
                print(f"  - Rate Limit Delay: {self.rate_limit_delay}s")
                print(f"  - Max Retries: {self.max_retries}")
            except Exception as e:
                print(f"✗ Failed to initialize AI Matcher: {str(e)}")
                self.ai_matcher = None
        else:
            print("✗ No API key found - AI matching disabled")
    
    @staticmethod
    def extract_duplicates(df: pd.DataFrame, batch_size: int = 50000) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        Separate duplicate records from the input DataFrame with memory-efficient batch processing.
        Keep the first row in each duplicate group for matching, and place only additional repeated rows into the duplicate report.
        
        Args:
            df: Input DataFrame
            batch_size: Size of batches for processing large datasets
            
        Returns:
            Tuple of (main_df, duplicates_df)
        """
        if df.empty:
            return df.copy(), df.copy()
        
        print(f"  Detecting duplicates in {len(df)} records...")
        
        # For small datasets, use original logic
        if len(df) <= batch_size:
            empty_tags = (df['new_tag_number'] == '') & (df['serial_no'] == '')
            df_empty = df[empty_tags].copy()
            df_non_empty = df[~empty_tags].copy()

            tag_dupes_mask = df_non_empty.duplicated(subset=['new_tag_number', 'serial_no'], keep='first')
            empty_dupes_mask = df_empty.duplicated(keep='first')

            duplicates_df = pd.concat([
                df_non_empty[tag_dupes_mask],
                df_empty[empty_dupes_mask]
            ]).sort_index().copy()

            main_df = pd.concat([
                df_non_empty[~tag_dupes_mask],
                df_empty[~empty_dupes_mask]
            ]).sort_index().copy()
            
            print(f"    ✓ Found {len(duplicates_df)} duplicates, {len(main_df)} unique records")
            return main_df, duplicates_df
        
        # For large datasets, use memory-efficient batch processing
        print(f"    Using batch processing (batch size: {batch_size})...")
        
        empty_tags = (df['new_tag_number'] == '') & (df['serial_no'] == '')
        df_empty = df[empty_tags]
        df_non_empty = df[~empty_tags]
        
        # Process non-empty tags
        tag_dupes_mask = pd.Series([False] * len(df_non_empty), index=df_non_empty.index)
        seen_tags = set()
        
        for i in range(0, len(df_non_empty), batch_size):
            batch = df_non_empty.iloc[i:i+batch_size]
            for idx, row in batch.iterrows():
                key = (row['new_tag_number'], row['serial_no'])
                if key in seen_tags:
                    tag_dupes_mask[idx] = True
                else:
                    seen_tags.add(key)
            
            if i > 0:
                print(f"      Processed {min(i+batch_size, len(df_non_empty))}/{len(df_non_empty)} records")
        
        # Process empty tags
        empty_dupes_mask = df_empty.duplicated(keep='first')
        
        duplicates_df = pd.concat([
            df_non_empty[tag_dupes_mask],
            df_empty[empty_dupes_mask]
        ]).sort_index()

        main_df = pd.concat([
            df_non_empty[~tag_dupes_mask],
            df_empty[~empty_dupes_mask]
        ]).sort_index()
        
        print(f"    ✓ Found {len(duplicates_df)} duplicates, {len(main_df)} unique records")
        return main_df, duplicates_df

    def process_reconciliation(self, customer_file_path: str, internal_file_path: str,
                              reconciliation_id: int) -> Dict:
        """
        Complete reconciliation pipeline
        Returns statistics and report path
        """
        
        # Step 1: Load and clean data
        print("Step 1: Loading and cleaning data...")
        customer_df_original = DataCleaner.process_file(customer_file_path)
        internal_df_original = DataCleaner.process_file(internal_file_path)
        
        # Store original totals BEFORE any processing
        total_customer_uploaded = len(customer_df_original)
        total_internal_uploaded = len(internal_df_original)
        
        # Create copies for matching with cleared serial numbers
        customer_match_df = customer_df_original.copy()
        internal_match_df = internal_df_original.copy()
        
        if 'serial_no' in customer_match_df.columns:
            customer_match_df['serial_no'] = ''
        if 'serial_no' in internal_match_df.columns:
            internal_match_df['serial_no'] = ''
        
        print(f"  Total customer records uploaded: {total_customer_uploaded}")
        print(f"  Total internal records uploaded: {total_internal_uploaded}")
        
        # Use configured batch size for large datasets
        batch_size = getattr(self.config, 'BATCH_SIZE', 50000)
        customer_df, customer_duplicates = self.extract_duplicates(customer_match_df, batch_size)
        internal_df, internal_duplicates = self.extract_duplicates(internal_match_df, batch_size)
        
        print(f"  Customer: {len(customer_df)} unique + {len(customer_duplicates)} duplicates")
        print(f"  Internal: {len(internal_df)} unique + {len(internal_duplicates)} duplicates")
        
        # Step 2: Rule-based matching
        print("Step 2: Performing Exact matching...")
        rule_matched_df, unmatched_customer, unmatched_internal = RuleMatcher.exact_match(
            customer_df, internal_df
        )
        
        rule_matched_count = len(rule_matched_df)
        print(f"Exact matches: {rule_matched_count}")
        
        # Step 3: Fuzzy matching
        print("Step 3: Performing fuzzy matching...")
        batch_size = getattr(self.config, 'BATCH_SIZE', 10000)
        fuzzy_matches, remaining_customer, remaining_internal = FuzzyMatcher.fuzzy_match(
            unmatched_customer, unmatched_internal, threshold=0.60, batch_size=batch_size
        )
        
        # Step 4: AI-assisted matching (if available and needed)
        ai_matched = []
        manual_review = []
        
        print(f"\n{'='*60}")
        print(f"Step 4: AI-Assisted Matching")
        print(f"{'='*60}")
        print(f"AI Matcher available: {self.ai_matcher is not None}")
        print(f"Remaining customer records: {len(remaining_customer)}")
        print(f"Remaining internal records: {len(remaining_internal)}")
        
        if self.ai_matcher and len(remaining_customer) > 0 and len(remaining_internal) > 0:
            # Add index as a field to track records after AI processing
            remaining_customer_with_index = remaining_customer.copy()
            remaining_internal_with_index = remaining_internal.copy()
            remaining_customer_with_index['source_index'] = remaining_customer_with_index.index
            remaining_internal_with_index['source_index'] = remaining_internal_with_index.index
            
            # Separate data ingestion for LLM: Exclude serial number and tag numbers
            cols_to_exclude = ['serial_no', 'old_tag_number', 'new_tag_number']
            llm_customer_df = remaining_customer_with_index.drop(columns=cols_to_exclude, errors='ignore')
            llm_internal_df = remaining_internal_with_index.drop(columns=cols_to_exclude, errors='ignore')
            
            # Convert to list of dicts for AI processing
            customer_records = llm_customer_df.to_dict('records')
            internal_records = llm_internal_df.to_dict('records')
            
            # Limit AI processing to avoid high costs
            max_ai_records = getattr(self.config, 'MAX_AI_RECORDS', 1000)
            customer_records_limited = customer_records[:max_ai_records]
            print(f"Processing {len(customer_records_limited)} customer records with AI (limit: {max_ai_records})...")
            
            ai_matches = self.ai_matcher.ai_match_batch(
                customer_records_limited, 
                internal_records, 
                batch_size=5,
                top_k=self.ai_top_k_candidates
            )
            
            print(f"\nClassifying {len(ai_matches)} AI matches by confidence...")
            # Classify AI matches by confidence
            for match in ai_matches:
                confidence = match['confidence_score']
                print(f"  Match: {match.get('customer_description', 'N/A')[:40]}... <-> "
                      f"{match.get('internal_description', 'N/A')[:40]}... "
                      f"[Confidence: {confidence:.2f}]")
                
                if confidence >= self.ai_match_threshold:
                    ai_matched.append(match)
                    print(f"    → AI MATCHED (>= {self.ai_match_threshold})")
                elif confidence >= self.manual_review_threshold:
                    manual_review.append(match)
                    print(f"    → MANUAL REVIEW (>= {self.manual_review_threshold})")
                else:
                    print(f"    → BELOW THRESHOLD (< {self.manual_review_threshold})")
            
            print(f"\nResults: {len(ai_matched)} AI matched, {len(manual_review)} manual review")
            
            # Re-populate the excluded fields (serial_no, tag numbers) for the final report
            for m in ai_matched + manual_review:
                c_idx = m.get('customer_source_index')
                i_idx = m.get('internal_source_index')
                if c_idx is not None and c_idx in remaining_customer.index:
                    m['customer_old_tag'] = remaining_customer.at[c_idx, 'old_tag_number']
                    m['customer_new_tag'] = remaining_customer.at[c_idx, 'new_tag_number']
                if i_idx is not None and i_idx in remaining_internal.index:
                    m['internal_old_tag'] = remaining_internal.at[i_idx, 'old_tag_number']
                    m['internal_new_tag'] = remaining_internal.at[i_idx, 'new_tag_number']
            
            # Remove AI-matched records from remaining by index
            ai_matched_customer_indices = [m['customer_source_index'] for m in ai_matched + manual_review if m.get('customer_source_index') is not None]
            ai_matched_internal_indices = [m['internal_source_index'] for m in ai_matched + manual_review if m.get('internal_source_index') is not None]
            
            remaining_customer = remaining_customer.drop(index=ai_matched_customer_indices, errors='ignore')
            remaining_internal = remaining_internal.drop(index=ai_matched_internal_indices, errors='ignore')
            
            # Clean up source_index from match dicts so it doesn't appear in the report
            for m in ai_matched + manual_review:
                m.pop('customer_source_index', None)
                m.pop('internal_source_index', None)
            
            # Include fuzzy matches in the manual review group
            manual_review.extend(fuzzy_matches)
        else:
            reason = "no API key" if not self.ai_matcher else "no remaining records"
            print(f"Skipping AI matching ({reason})")
            # All fuzzy matches go to manual review
            manual_review = fuzzy_matches
            fuzzy_matches = []
        
        # Combine fuzzy and AI matches
        ai_matched_df = pd.DataFrame(ai_matched) if ai_matched else pd.DataFrame()
        manual_review_df = pd.DataFrame(manual_review) if manual_review else pd.DataFrame()
        
        # --- RESTORE ORIGINAL SERIAL NUMBERS ---
        def restore_serial(df, orig_df, is_customer=True, is_match=False):
            if df.empty: return df
            if is_match:
                prefix = 'customer' if is_customer else 'internal'
                idx_col = f'{prefix}_source_index'
                serial_col = f'{prefix}_serial_no'
                if idx_col in df.columns:
                    valid_idx = df[idx_col].dropna().index
                    df.loc[valid_idx, serial_col] = df.loc[valid_idx, idx_col].astype(int).map(orig_df['serial_no'])
            else:
                if 'serial_no' in df.columns:
                    df['serial_no'] = orig_df.loc[df.index, 'serial_no']
            return df
            
        rule_matched_df = restore_serial(rule_matched_df, customer_df_original, True, True)
        rule_matched_df = restore_serial(rule_matched_df, internal_df_original, False, True)
        
        ai_matched_df = restore_serial(ai_matched_df, customer_df_original, True, True)
        ai_matched_df = restore_serial(ai_matched_df, internal_df_original, False, True)
        
        manual_review_df = restore_serial(manual_review_df, customer_df_original, True, True)
        manual_review_df = restore_serial(manual_review_df, internal_df_original, False, True)
        
        remaining_customer = restore_serial(remaining_customer, customer_df_original, True, False)
        remaining_internal = restore_serial(remaining_internal, internal_df_original, False, False)
        
        customer_duplicates = restore_serial(customer_duplicates, customer_df_original, True, False)
        internal_duplicates = restore_serial(internal_duplicates, internal_df_original, False, False)
        
        # Step 5: Generate report
        print("Step 5: Generating report...")
        report_path = ReportGenerator.generate_excel_report(
            rule_matched_df=rule_matched_df,
            ai_matched_df=ai_matched_df,
            manual_review_df=manual_review_df,
            customer_unmatched_df=remaining_customer,
            internal_unmatched_df=remaining_internal,
            customer_duplicates_df=customer_duplicates,
            internal_duplicates_df=internal_duplicates,
            reconciliation_id=reconciliation_id,
            output_dir=self.config.REPORTS_FOLDER
        )
        
        # Calculate statistics with proper accounting
        # Duplicates are STANDALONE - not part of matching process
        print("\n" + "="*60)
        print("RECONCILIATION SUMMARY")
        print("="*60)
        
        # Customer side accounting
        customer_matched_count = rule_matched_count + len(ai_matched) + len(manual_review)
        customer_unmatched_count = len(remaining_customer)
        customer_duplicates_count = len(customer_duplicates)
        customer_unique_count = customer_matched_count + customer_unmatched_count
        
        print(f"\nCustomer Records:")
        print(f"  Total uploaded: {total_customer_uploaded}")
        print(f"  ├─ Unique records: {customer_unique_count}")
        print(f"  │  ├─ Exact matched: {rule_matched_count}")
        print(f"  │  ├─ AI matched: {len(ai_matched)}")
        print(f"  │  ├─ Manual review: {len(manual_review)}")
        print(f"  │  └─ Unmatched: {customer_unmatched_count}")
        print(f"  └─ Duplicates (standalone): {customer_duplicates_count}")
        print(f"  = Verification: {customer_unique_count} + {customer_duplicates_count} = {customer_unique_count + customer_duplicates_count}")
        
        # Verify customer accounting
        if total_customer_uploaded != (customer_unique_count + customer_duplicates_count):
            print(f"  ✗ ERROR: Customer totals don't match!")
            print(f"    Expected: {total_customer_uploaded}")
            print(f"    Got: {customer_unique_count + customer_duplicates_count}")
            print(f"    Difference: {total_customer_uploaded - (customer_unique_count + customer_duplicates_count)}")
        else:
            print(f"  ✓ Customer accounting verified: {total_customer_uploaded} = {customer_unique_count} + {customer_duplicates_count}")
        
        # Internal side accounting
        internal_matched_count = rule_matched_count + len(ai_matched) + len(manual_review)
        internal_unmatched_count = len(remaining_internal)
        internal_duplicates_count = len(internal_duplicates)
        internal_unique_count = internal_matched_count + internal_unmatched_count
        
        print(f"\nInternal Records:")
        print(f"  Total uploaded: {total_internal_uploaded}")
        print(f"  ├─ Unique records: {internal_unique_count}")
        print(f"  │  ├─ Exact matched: {rule_matched_count}")
        print(f"  │  ├─ AI matched: {len(ai_matched)}")
        print(f"  │  ├─ Manual review: {len(manual_review)}")
        print(f"  │  └─ Unmatched: {internal_unmatched_count}")
        print(f"  └─ Duplicates (standalone): {internal_duplicates_count}")
        print(f"  = Verification: {internal_unique_count} + {internal_duplicates_count} = {internal_unique_count + internal_duplicates_count}")
        
        # Verify internal accounting
        if total_internal_uploaded != (internal_unique_count + internal_duplicates_count):
            print(f"  ✗ ERROR: Internal totals don't match!")
            print(f"    Expected: {total_internal_uploaded}")
            print(f"    Got: {internal_unique_count + internal_duplicates_count}")
            print(f"    Difference: {total_internal_uploaded - (internal_unique_count + internal_duplicates_count)}")
        else:
            print(f"  ✓ Internal accounting verified: {total_internal_uploaded} = {internal_unique_count} + {internal_duplicates_count}")
        
        print("="*60)
        
        # Calculate statistics - send counts that will be displayed
        statistics = {
            'total_customer_records': total_customer_uploaded,
            'total_internal_records': total_internal_uploaded,
            'rule_matched': rule_matched_count,
            'ai_matched': len(ai_matched),
            'manual_review': len(manual_review),
            'customer_unmatched': customer_unmatched_count,
            'internal_unmatched': internal_unmatched_count,
            'customer_duplicates': customer_duplicates_count,
            'internal_duplicates': internal_duplicates_count,
            'report_path': report_path
        }
        
        print("Reconciliation completed successfully!")
        return statistics
