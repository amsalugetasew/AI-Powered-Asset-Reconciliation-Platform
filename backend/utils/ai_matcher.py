import pandas as pd
from typing import List, Dict
import json
import time
import random
from fuzzywuzzy import fuzz

class AIMatcher:
    """AI-assisted matching using LLM reasoning via Groq with fuzzy pre-filtering"""
    
    def __init__(self, provider='openai', api_key=None, model=None, fuzzy_threshold=0.30,
                 rate_limit_delay=1.0, max_retries=5):
        """
        Initialize AI matcher with Groq and fuzzy filtering
        
        Args:
            provider: API provider (always 'groq' for this implementation)
            api_key: Groq API key
            model: Model name (default: llama-3.3-70b-versatile)
            fuzzy_threshold: Minimum fuzzy score to pass filter (default: 0.30)
            rate_limit_delay: Base delay between API calls in seconds (default: 1.0)
            max_retries: Maximum retry attempts for rate limit errors (default: 5)
        """
        if not api_key:
            raise ValueError("API key is required for AI matching")
            
        import openai
        self.provider = 'groq'
        self.api_key = api_key
        self.client = openai.OpenAI(
            api_key=api_key, 
            base_url="https://api.groq.com/openai/v1"
        )
        self.model = model or 'llama-3.3-70b-versatile'
        self.fuzzy_threshold = fuzzy_threshold
        self.rate_limit_delay = rate_limit_delay
        self.max_retries = max_retries
        
        print(f"✓ AI Matcher initialized with Groq model: {self.model}")
        print(f"  - Fuzzy pre-filter threshold: {fuzzy_threshold:.0%}")
        print(f"  - Rate limit delay: {rate_limit_delay}s between calls")
        print(f"  - Max retries: {max_retries}")
    
    def ai_match_batch(self, customer_records: List[Dict], internal_records: List[Dict],
                      batch_size: int = 5, top_k: int = 10) -> List[Dict]:
        """
        Perform AI-assisted matching on batches of records with fuzzy pre-filtering
        
        Args:
            customer_records: List of customer records to match
            internal_records: List of internal records to match against
            batch_size: Number of customer records to process per batch
            top_k: Number of top fuzzy matches to send to LLM (default: 10)
        
        Returns:
            List of potential matches with confidence scores
        """
        print(f"Starting AI matching: {len(customer_records)} customer records vs {len(internal_records)} internal records")
        print(f"  - Fuzzy pre-filtering enabled: Top {top_k} candidates per record")
        matches = []
        
        # Process in batches
        for i in range(0, len(customer_records), batch_size):
            batch = customer_records[i:i + batch_size]
            print(f"Processing batch {i//batch_size + 1} ({len(batch)} records)...")
            
            for idx, customer_record in enumerate(batch):
                print(f"  Matching customer record {i+idx+1}: {customer_record.get('description', 'N/A')[:60]}...")
                
                # Step 1: Fuzzy pre-filtering to get top candidates
                top_candidates = self._fuzzy_filter_candidates(
                    customer_record, 
                    internal_records, 
                    top_k=top_k
                )
                
                if not top_candidates:
                    print(f"    ✗ No candidates passed fuzzy filter (threshold: {self.fuzzy_threshold:.0%})")
                    continue
                
                print(f"    → {len(top_candidates)} candidates passed fuzzy filter")
                
                # Step 2: Use LLM to evaluate top candidates
                match_result = self._evaluate_with_llm(customer_record, top_candidates)
                
                if match_result:
                    matches.append(match_result)
                    print(f"    ✓ Match found! Confidence: {match_result['confidence_score']:.2f}")
                else:
                    print(f"    ✗ No match found by LLM")
        
        print(f"AI matching complete: {len(matches)} total matches found")
        return matches
    
    def _fuzzy_filter_candidates(self, customer_record: Dict, internal_records: List[Dict], 
                                 top_k: int = 10) -> List[Dict]:
        """
        Pre-filter candidates using fuzzy matching to reduce LLM calls
        
        Args:
            customer_record: Customer record to match
            internal_records: All internal records
            top_k: Number of top candidates to return
        
        Returns:
            List of top K candidates sorted by fuzzy score
        """
        candidates_with_scores = []
        
        for internal_record in internal_records:
            # Calculate fuzzy similarity score
            score = self._calculate_fuzzy_score(customer_record, internal_record)
            
            # Only consider candidates above threshold
            if score >= self.fuzzy_threshold:
                candidates_with_scores.append({
                    'record': internal_record,
                    'fuzzy_score': score
                })
        
        # Sort by fuzzy score (descending) and take top K
        candidates_with_scores.sort(key=lambda x: x['fuzzy_score'], reverse=True)
        
        # Additional filtering: Skip if top candidate is too low
        if candidates_with_scores and candidates_with_scores[0]['fuzzy_score'] < 0.40:
            # Even the best candidate is weak, likely no good match
            print(f"    ⚠ Best fuzzy score only {candidates_with_scores[0]['fuzzy_score']:.0%}, skipping LLM call")
            return []
        
        top_candidates = [c['record'] for c in candidates_with_scores[:top_k]]
        
        # Log fuzzy scores for debugging
        if top_candidates and len(candidates_with_scores) > 0:
            best_score = candidates_with_scores[0]['fuzzy_score']
            print(f"    📊 Best fuzzy score: {best_score:.0%}")
        
        return top_candidates
    
    def _calculate_fuzzy_score(self, customer_record: Dict, internal_record: Dict) -> float:
        """
        Calculate fuzzy similarity score between two records
        Uses weighted combination of field similarities
        """
        scores = []
        weights = []
        
        # Description similarity (weight: 0.40 - most important for AI matching)
        if customer_record.get('description') and internal_record.get('description'):
            desc_score = fuzz.token_set_ratio(
                str(customer_record['description']),
                str(internal_record['description'])
            ) / 100.0
            scores.append(desc_score)
            weights.append(0.40)
        
        # Category similarity (weight: 0.20)
        if customer_record.get('category') and internal_record.get('category'):
            cat_score = fuzz.token_set_ratio(
                str(customer_record['category']),
                str(internal_record['category'])
            ) / 100.0
            scores.append(cat_score)
            weights.append(0.20)
        
        # Department similarity (weight: 0.15)
        if customer_record.get('department') and internal_record.get('department'):
            dept_score = fuzz.token_set_ratio(
                str(customer_record['department']),
                str(internal_record['department'])
            ) / 100.0
            scores.append(dept_score)
            weights.append(0.15)
        
        # District similarity (weight: 0.10)
        if customer_record.get('district') and internal_record.get('district'):
            dist_score = fuzz.token_set_ratio(
                str(customer_record['district']),
                str(internal_record['district'])
            ) / 100.0
            scores.append(dist_score)
            weights.append(0.10)
        
        # Year similarity (weight: 0.10)
        if customer_record.get('year') and internal_record.get('year'):
            try:
                c_year = int(customer_record['year'])
                i_year = int(internal_record['year'])
                if c_year == i_year:
                    scores.append(1.0)
                else:
                    year_diff = abs(c_year - i_year)
                    year_score = max(0.0, 1.0 - (year_diff * 0.1))
                    scores.append(year_score)
                weights.append(0.10)
            except (ValueError, TypeError):
                pass
        
        # Book value similarity (weight: 0.05)
        if customer_record.get('book_value') and internal_record.get('book_value'):
            try:
                c_value = float(customer_record['book_value'])
                i_value = float(internal_record['book_value'])
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
    
    def _evaluate_with_llm(self, customer_record: Dict, candidates: List[Dict]) -> Dict:
        """
        Use LLM to evaluate if any candidate is a match with robust rate limit handling
        
        Implements:
        - Exponential backoff with jitter
        - Configurable retry attempts
        - Automatic delay between calls
        - Detailed error logging
        """
        prompt = self._build_matching_prompt(customer_record, candidates)
        
        for attempt in range(self.max_retries):
            try:
                # Add base delay between API calls to avoid rate limits
                if attempt == 0 and self.rate_limit_delay > 0:
                    time.sleep(self.rate_limit_delay)
                
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {
                            "role": "system", 
                            "content": "You are an expert asset reconciliation analyst. Analyze asset records and determine if they represent the same physical asset. Be generous with semantic matches."
                        },
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.1,
                    max_tokens=500
                )
                result_text = response.choices[0].message.content
                
                # Parse LLM response
                match_result = self._parse_llm_response(result_text, customer_record, candidates)
                return match_result
                
            except Exception as e:
                error_msg = str(e)
                is_rate_limit = "429" in error_msg or "rate limit" in error_msg.lower()
                
                if is_rate_limit and attempt < self.max_retries - 1:
                    # Exponential backoff with jitter
                    wait_time = self._calculate_backoff_time(attempt)
                    print(f"    ⚠ Rate limit hit (attempt {attempt + 1}/{self.max_retries})")
                    print(f"    ⏳ Waiting {wait_time:.1f}s before retry...")
                    time.sleep(wait_time)
                    continue
                elif is_rate_limit:
                    print(f"    ✗ Rate limit exceeded after {self.max_retries} attempts")
                    print(f"    💡 Consider: Increase RATE_LIMIT_DELAY or reduce batch size")
                    return None
                else:
                    # Non-rate-limit error
                    print(f"    ✗ API error: {error_msg[:100]}")
                    return None
            
        return None
    
    def _calculate_backoff_time(self, attempt: int) -> float:
        """
        Calculate exponential backoff time with jitter
        
        Formula: base_delay * (2 ^ attempt) + random jitter
        
        Examples:
        - Attempt 0: 2-4s
        - Attempt 1: 4-8s
        - Attempt 2: 8-16s
        - Attempt 3: 16-32s
        """
        base_delay = 2.0
        exponential_delay = base_delay * (2 ** attempt)
        jitter = random.uniform(0, exponential_delay)
        return exponential_delay + jitter
    
    def _build_matching_prompt(self, customer_record: Dict, candidates: List[Dict]) -> str:
        """Build concise prompt for LLM evaluation"""
        
        # Simplified prompt with only essential fields
        prompt = f"""Match customer record to internal candidates.

Customer: {customer_record.get('description', 'N/A')} | Cat: {customer_record.get('category', 'N/A')} | Dept: {customer_record.get('department', 'N/A')[:30]}

Candidates:
"""
        
        for idx, candidate in enumerate(candidates, 1):
            prompt += f"{idx}. {candidate.get('description', 'N/A')} | Cat: {candidate.get('category', 'N/A')} | Dept: {candidate.get('department', 'N/A')[:30]}\n"
        
        prompt += f"""
RULES:
1. Match if descriptions refer to SAME item type (e.g., "TV"="TELEVISION", "CHAIR"="CHAIR")
2. Different item types = NO match (e.g., "CHAIR" ≠ "PRINTER")
3. Similar category/department strengthens match
4. Confidence ≥0.20 for weak matches, ≥0.60 for strong matches

JSON response:
{{"match_found": true/false, "candidate_index": 1-{len(candidates)} or null, "confidence": 0.0-1.0, "reasoning": "brief"}}
"""
        
        return prompt
    
    def _parse_llm_response(self, response_text: str, customer_record: Dict,
                           candidates: List[Dict]) -> Dict:
        """Parse LLM response and create match record"""
        
        try:
            # Extract JSON from response
            import re
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if not json_match:
                print(f"    ⚠ No JSON found in response: {response_text[:100]}")
                return None
            
            result = json.loads(json_match.group())
            
            if not result.get('match_found') or result.get('candidate_index') is None:
                return None
            
            confidence = float(result.get('confidence', 0.0))
            candidate_idx = int(result.get('candidate_index')) - 1
            
            if candidate_idx < 0 or candidate_idx >= len(candidates):
                print(f"    ⚠ Invalid candidate index: {candidate_idx}")
                return None
            
            matched_internal = candidates[candidate_idx]
            
            # Create match record
            match_record = {
                # Customer data
                'customer_old_tag': customer_record.get('old_tag_number', ''),
                'customer_new_tag': customer_record.get('new_tag_number', ''),
                'customer_year': customer_record.get('year', ''),
                'customer_category': customer_record.get('category', ''),
                'customer_description': customer_record.get('description', ''),
                # 'customer_serial_no': 0,#customer_record.get('serial_no', ''),
                'customer_department': customer_record.get('department', ''),
                'customer_district': customer_record.get('district', ''),
                'customer_book_value': customer_record.get('book_value', 0.0),
                'customer_asset_number': customer_record.get('asset_number', ''),
                'customer_source_index': customer_record.get('source_index', None),
                
                # Internal data
                'internal_old_tag': matched_internal.get('old_tag_number', ''),
                'internal_new_tag': matched_internal.get('new_tag_number', ''),
                'internal_year': matched_internal.get('year', ''),
                'internal_category': matched_internal.get('category', ''),
                'internal_description': matched_internal.get('description', ''),
                # 'internal_serial_no': 0,#matched_internal.get('serial_no', ''),
                'internal_department': matched_internal.get('department', ''),
                'internal_district': matched_internal.get('district', ''),
                'internal_book_value': matched_internal.get('book_value', 0.0),
                'internal_asset_number': matched_internal.get('asset_number', ''),
                'internal_source_index': matched_internal.get('source_index', None),
                
                # Metadata
                'match_type': 'AI',
                'match_method': 'LLM_REASONING',
                'confidence_score': round(confidence, 4),
                'ai_reasoning': result.get('reasoning', '')
            }
            
            return match_record
            
        except Exception as e:
            print(f"    ⚠ Error parsing LLM response: {str(e)}")
            print(f"    Response text: {response_text[:200]}")
            return None
