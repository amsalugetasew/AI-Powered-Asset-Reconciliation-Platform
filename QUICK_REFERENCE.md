# Quick Reference Guide

## Configuration Settings (.env)

### AI Matching Thresholds
```env
AI_MATCH_THRESHOLD=0.20           # 20% - LLM confidence for "AI Matched"
MANUAL_REVIEW_THRESHOLD=0.10      # 10% - LLM confidence for "Manual Review"
```

### Fuzzy Pre-filtering
```env
FUZZY_PREFILTER_THRESHOLD=0.30    # 30% - Minimum fuzzy score to pass
AI_TOP_K_CANDIDATES=10            # Top 10 candidates sent to LLM
```

### Rate Limiting
```env
RATE_LIMIT_DELAY=1.0              # 1 second between API calls
MAX_RETRIES=5                     # 5 retry attempts on rate limit
```

## Common Scenarios

### Scenario 1: Missing Matches (False Negatives)

**Problem:** Expected matches not found

**Solutions:**
```env
# Lower thresholds
AI_MATCH_THRESHOLD=0.15
FUZZY_PREFILTER_THRESHOLD=0.25
AI_TOP_K_CANDIDATES=15
```

### Scenario 2: Too Many Wrong Matches (False Positives)

**Problem:** Unrelated items being matched

**Solutions:**
```env
# Raise thresholds
AI_MATCH_THRESHOLD=0.30
FUZZY_PREFILTER_THRESHOLD=0.40
AI_TOP_K_CANDIDATES=5
```

### Scenario 3: Rate Limit Errors

**Problem:** Frequent "429 Rate limit" errors

**Solutions:**
```env
# Increase delays
RATE_LIMIT_DELAY=2.0
MAX_RETRIES=10

# Reduce API calls
FUZZY_PREFILTER_THRESHOLD=0.40
AI_TOP_K_CANDIDATES=5
```

### Scenario 4: Processing Too Slow

**Problem:** Takes hours to complete

**Solutions:**
```env
# Reduce delays (if not hitting rate limits)
RATE_LIMIT_DELAY=0.5

# Reduce candidates
AI_TOP_K_CANDIDATES=5
FUZZY_PREFILTER_THRESHOLD=0.35
```

### Scenario 5: High API Costs

**Problem:** Expensive API usage

**Solutions:**
```env
# Aggressive filtering
FUZZY_PREFILTER_THRESHOLD=0.40
AI_TOP_K_CANDIDATES=5

# Process fewer records
# Edit reconciliation_service.py:
customer_records_limited = customer_records[:50]
```

## Testing Commands

### Test Fuzzy Pre-filtering
```bash
cd backend
python test_fuzzy_filter.py
```

### Test AI Matching
```bash
cd backend
python test_ai_matcher.py
```

### Run Backend
```bash
cd backend
python app.py
```

## Console Output Meanings

### ✓ Success Messages
```
✓ AI Matcher initialized successfully
✓ Match found! Confidence: 0.90
```

### → Information
```
→ 10 candidates passed fuzzy filter
→ AI MATCHED (>= 0.2)
```

### ⚠ Warnings
```
⚠ Rate limit hit (attempt 1/5)
⏳ Waiting 3.2s before retry...
```

### ✗ Errors
```
✗ No match found by LLM
✗ Rate limit exceeded after 5 attempts
✗ No candidates passed fuzzy filter
```

## Preset Configurations

### Conservative (Avoid Rate Limits)
```env
AI_MATCH_THRESHOLD=0.20
MANUAL_REVIEW_THRESHOLD=0.10
FUZZY_PREFILTER_THRESHOLD=0.30
AI_TOP_K_CANDIDATES=10
RATE_LIMIT_DELAY=2.0
MAX_RETRIES=5
```
**Use when:** Large datasets, shared API key

### Balanced (Default)
```env
AI_MATCH_THRESHOLD=0.20
MANUAL_REVIEW_THRESHOLD=0.10
FUZZY_PREFILTER_THRESHOLD=0.30
AI_TOP_K_CANDIDATES=10
RATE_LIMIT_DELAY=1.0
MAX_RETRIES=5
```
**Use when:** Normal operations

### Aggressive (Fast Processing)
```env
AI_MATCH_THRESHOLD=0.15
MANUAL_REVIEW_THRESHOLD=0.10
FUZZY_PREFILTER_THRESHOLD=0.25
AI_TOP_K_CANDIDATES=15
RATE_LIMIT_DELAY=0.5
MAX_RETRIES=10
```
**Use when:** Small datasets, need speed

### Cost-Optimized
```env
AI_MATCH_THRESHOLD=0.25
MANUAL_REVIEW_THRESHOLD=0.15
FUZZY_PREFILTER_THRESHOLD=0.40
AI_TOP_K_CANDIDATES=5
RATE_LIMIT_DELAY=1.0
MAX_RETRIES=5
```
**Use when:** Budget constraints

## Troubleshooting Checklist

- [ ] Check console for "✓ AI Matcher initialized successfully"
- [ ] Verify API key in .env file
- [ ] Check if records matched in Exact/Fuzzy stages first
- [ ] Look for "→ X candidates passed fuzzy filter" (X should be > 0)
- [ ] Check for rate limit warnings
- [ ] Review Excel report tabs (AI Matched, Manual Review)
- [ ] Verify thresholds are appropriate for your data
- [ ] Test with small dataset first (10-20 records)

## Files to Check

### Configuration
- `backend/.env` - Your settings
- `backend/config.py` - Configuration loader

### Core Logic
- `backend/utils/ai_matcher.py` - AI matching logic
- `backend/services/reconciliation_service.py` - Main service

### Testing
- `backend/test_ai_matcher.py` - Test AI matching
- `backend/test_fuzzy_filter.py` - Test fuzzy filtering

### Documentation
- `AI_MATCHING_FIXED.md` - AI matching fix details
- `FUZZY_FILTERING_ADDED.md` - Fuzzy filtering details
- `RATE_LIMIT_HANDLING.md` - Rate limit handling details
- `IMPLEMENTATION_SUMMARY.md` - Complete summary

## Performance Metrics

### Fuzzy Pre-filtering Impact
```
Before: 50 records × 200 internal = 10,000 LLM calls
After:  50 records × 10 candidates = 500 LLM calls
Reduction: 95%
```

### Rate Limit Delay Impact
```
1.0s delay: ~8-10 minutes for 500 calls
2.0s delay: ~16-20 minutes for 500 calls
0.5s delay: ~4-5 minutes for 500 calls
```

### Threshold Impact on Accuracy
```
AI_MATCH_THRESHOLD=0.20: More matches, some false positives
AI_MATCH_THRESHOLD=0.30: Balanced
AI_MATCH_THRESHOLD=0.40: Fewer matches, high precision
```

## Quick Fixes

### "0 AI matches" Issue
1. Lower `AI_MATCH_THRESHOLD` to 0.15
2. Lower `FUZZY_PREFILTER_THRESHOLD` to 0.25
3. Increase `AI_TOP_K_CANDIDATES` to 15
4. Check console for initialization message
5. Verify API key is correct

### Rate Limit Issue
1. Increase `RATE_LIMIT_DELAY` to 2.0
2. Increase `MAX_RETRIES` to 10
3. Reduce `AI_TOP_K_CANDIDATES` to 5
4. Process fewer records at once

### Slow Processing Issue
1. Reduce `RATE_LIMIT_DELAY` to 0.5 (if no rate limits)
2. Increase `FUZZY_PREFILTER_THRESHOLD` to 0.35
3. Reduce `AI_TOP_K_CANDIDATES` to 5
4. Process in smaller batches

## Support

For detailed information, see:
- `IMPLEMENTATION_SUMMARY.md` - Complete overview
- `RATE_LIMIT_HANDLING.md` - Rate limit details
- `FUZZY_FILTERING_ADDED.md` - Fuzzy filtering details
- `AI_MATCHING_FIXED.md` - AI matching fix details
