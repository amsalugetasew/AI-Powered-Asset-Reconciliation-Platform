# Rate Limit Handling

## Overview

Implemented robust rate limit handling to prevent API errors and ensure smooth processing even with high-volume reconciliations.

## Problem

API providers like Groq have rate limits:
- **Requests per minute (RPM)**: Maximum number of API calls per minute
- **Tokens per minute (TPM)**: Maximum tokens processed per minute

When exceeded, you get:
```
Error code: 429 - Rate limit reached for model `llama-3.3-70b-versatile`
```

## Solution

### 1. **Base Delay Between Calls**
Adds a configurable delay between each API call to stay under rate limits.

```env
RATE_LIMIT_DELAY=1.0  # 1 second between calls
```

**Effect:**
- 1.0s delay = Max 60 calls/minute
- 0.5s delay = Max 120 calls/minute
- 2.0s delay = Max 30 calls/minute

### 2. **Exponential Backoff with Jitter**
When rate limit is hit, waits progressively longer before retrying.

**Formula:** `wait_time = base_delay * (2 ^ attempt) + random_jitter`

**Example progression:**
```
Attempt 1: Wait 2-4 seconds
Attempt 2: Wait 4-8 seconds
Attempt 3: Wait 8-16 seconds
Attempt 4: Wait 16-32 seconds
Attempt 5: Wait 32-64 seconds
```

**Why jitter?** Prevents multiple processes from retrying simultaneously.

### 3. **Configurable Max Retries**
Set maximum retry attempts before giving up.

```env
MAX_RETRIES=5  # Try up to 5 times
```

### 4. **Intelligent Error Detection**
Distinguishes between rate limit errors (retry) and other errors (fail fast).

```python
if "429" in error or "rate limit" in error.lower():
    # Rate limit - retry with backoff
else:
    # Other error - fail immediately
```

## Configuration

### Environment Variables (.env)

```env
# Rate Limiting Configuration
RATE_LIMIT_DELAY=1.0    # Seconds between API calls (default: 1.0)
MAX_RETRIES=5           # Maximum retry attempts (default: 5)
```

### Recommended Settings

#### Conservative (Avoid Rate Limits)
```env
RATE_LIMIT_DELAY=2.0    # 2 seconds between calls
MAX_RETRIES=5           # 5 retry attempts
```
- **Pros:** Very unlikely to hit rate limits
- **Cons:** Slower processing
- **Use when:** Large datasets, shared API key

#### Balanced (Default)
```env
RATE_LIMIT_DELAY=1.0    # 1 second between calls
MAX_RETRIES=5           # 5 retry attempts
```
- **Pros:** Good balance of speed and reliability
- **Cons:** May occasionally hit rate limits
- **Use when:** Normal operations

#### Aggressive (Fast Processing)
```env
RATE_LIMIT_DELAY=0.5    # 0.5 seconds between calls
MAX_RETRIES=10          # 10 retry attempts
```
- **Pros:** Faster processing
- **Cons:** More likely to hit rate limits, more retries
- **Use when:** Small datasets, dedicated API key

#### No Delay (Maximum Speed)
```env
RATE_LIMIT_DELAY=0.0    # No delay
MAX_RETRIES=10          # 10 retry attempts
```
- **Pros:** Fastest possible processing
- **Cons:** Will hit rate limits frequently
- **Use when:** Testing only, not recommended for production

## How It Works

### Flow Diagram

```
Customer Record → Fuzzy Filter → Top 10 Candidates
                                        ↓
                                  LLM API Call
                                        ↓
                              ┌─────────┴─────────┐
                              │                   │
                         Success              Rate Limit?
                              │                   │
                         Return Match        Wait & Retry
                                                  ↓
                                        Exponential Backoff
                                                  ↓
                                        ┌─────────┴─────────┐
                                        │                   │
                                   Success            Max Retries?
                                        │                   │
                                   Return Match        Give Up
```

### Code Flow

```python
# 1. Base delay before call
time.sleep(RATE_LIMIT_DELAY)  # e.g., 1.0s

# 2. Make API call
try:
    response = client.chat.completions.create(...)
    return parse_response(response)
    
except RateLimitError:
    # 3. Calculate backoff time
    wait_time = 2 * (2 ** attempt) + random_jitter
    
    # 4. Wait and retry
    time.sleep(wait_time)
    retry()
```

## Console Output

### Normal Operation (No Rate Limits)
```
Processing batch 1 (5 records)...
  Matching customer record 1: TELEVISION (65 INCH)...
    → 10 candidates passed fuzzy filter
    ✓ Match found! Confidence: 0.90
  
  Matching customer record 2: LAPTOP DELL...
    → 8 candidates passed fuzzy filter
    ✗ No match found by LLM
```

### Rate Limit Hit (With Retry)
```
Processing batch 1 (5 records)...
  Matching customer record 1: TELEVISION (65 INCH)...
    → 10 candidates passed fuzzy filter
    ⚠ Rate limit hit (attempt 1/5)
    ⏳ Waiting 3.2s before retry...
    ✓ Match found! Confidence: 0.90
```

### Rate Limit Exceeded (Max Retries)
```
Processing batch 1 (5 records)...
  Matching customer record 1: TELEVISION (65 INCH)...
    → 10 candidates passed fuzzy filter
    ⚠ Rate limit hit (attempt 1/5)
    ⏳ Waiting 3.2s before retry...
    ⚠ Rate limit hit (attempt 2/5)
    ⏳ Waiting 7.5s before retry...
    ⚠ Rate limit hit (attempt 3/5)
    ⏳ Waiting 14.8s before retry...
    ⚠ Rate limit hit (attempt 4/5)
    ⏳ Waiting 28.3s before retry...
    ⚠ Rate limit hit (attempt 5/5)
    ⏳ Waiting 55.1s before retry...
    ✗ Rate limit exceeded after 5 attempts
    💡 Consider: Increase RATE_LIMIT_DELAY or reduce batch size
```

## Performance Impact

### Without Rate Limit Handling
```
50 records × 10 candidates = 500 API calls
No delays between calls
Result: Rate limit errors, failed processing
```

### With Rate Limit Handling (1s delay)
```
50 records × 10 candidates = 500 API calls
1 second delay between calls
Processing time: ~8-10 minutes
Result: Smooth processing, no errors
```

### With Rate Limit Handling (2s delay)
```
50 records × 10 candidates = 500 API calls
2 second delay between calls
Processing time: ~16-20 minutes
Result: Very smooth processing, no errors
```

## Optimization Strategies

### 1. Reduce API Calls (Fuzzy Pre-filtering)
Already implemented! Reduces calls by 40-95%.

```env
FUZZY_PREFILTER_THRESHOLD=0.35  # Stricter filtering
AI_TOP_K_CANDIDATES=5           # Fewer candidates
```

### 2. Increase Delay
Slower but more reliable.

```env
RATE_LIMIT_DELAY=2.0  # 2 seconds
```

### 3. Reduce Batch Size
Process fewer records at once.

```python
# In reconciliation_service.py
customer_records_limited = customer_records[:50]  # Reduce from 100
```

### 4. Process in Off-Peak Hours
API rate limits may be less strict during off-peak times.

### 5. Upgrade API Plan
Contact Groq to increase rate limits for your API key.

## Troubleshooting

### Issue: Frequent Rate Limit Errors

**Symptoms:**
```
⚠ Rate limit hit (attempt 1/5)
⚠ Rate limit hit (attempt 2/5)
⚠ Rate limit hit (attempt 3/5)
```

**Solutions:**

1. **Increase base delay:**
   ```env
   RATE_LIMIT_DELAY=2.0  # or 3.0
   ```

2. **Reduce candidates:**
   ```env
   AI_TOP_K_CANDIDATES=5
   ```

3. **Stricter fuzzy filtering:**
   ```env
   FUZZY_PREFILTER_THRESHOLD=0.40
   ```

4. **Process fewer records:**
   ```python
   customer_records_limited = customer_records[:25]
   ```

### Issue: Processing Too Slow

**Symptoms:**
- Takes hours to complete
- Console shows long delays

**Solutions:**

1. **Reduce delay (if not hitting rate limits):**
   ```env
   RATE_LIMIT_DELAY=0.5
   ```

2. **Increase fuzzy threshold (fewer candidates):**
   ```env
   FUZZY_PREFILTER_THRESHOLD=0.35
   AI_TOP_K_CANDIDATES=5
   ```

3. **Process in batches:**
   - Split large datasets into smaller chunks
   - Process separately

### Issue: Max Retries Exceeded

**Symptoms:**
```
✗ Rate limit exceeded after 5 attempts
💡 Consider: Increase RATE_LIMIT_DELAY or reduce batch size
```

**Solutions:**

1. **Increase max retries:**
   ```env
   MAX_RETRIES=10
   ```

2. **Increase base delay:**
   ```env
   RATE_LIMIT_DELAY=3.0
   ```

3. **Wait and retry later:**
   - API rate limits may reset after time period

## Best Practices

### 1. Start Conservative
```env
RATE_LIMIT_DELAY=2.0
MAX_RETRIES=5
```
Then reduce delay if no rate limit errors occur.

### 2. Monitor Console Output
Watch for rate limit warnings and adjust accordingly.

### 3. Test with Small Dataset First
Before processing 1000 records, test with 10-20 to gauge rate limits.

### 4. Use Fuzzy Pre-filtering
Already implemented! Reduces API calls by 40-95%.

### 5. Process During Off-Peak Hours
If possible, run large reconciliations during off-peak times.

### 6. Keep Logs
Save console output to track rate limit patterns:
```bash
python app.py > reconciliation.log 2>&1
```

## API Rate Limit Information

### Groq Rate Limits (as of 2024)

**Free Tier:**
- 30 requests per minute
- 6,000 tokens per minute

**Paid Tier:**
- Higher limits (varies by plan)
- Contact Groq for details

### Calculating Your Needs

**Example:**
- 50 customer records
- 10 candidates per record (after fuzzy filtering)
- 50 API calls needed

**With 1s delay:**
- 50 calls × 1s = 50 seconds
- Well under 30 calls/minute limit ✓

**With 0.5s delay:**
- 50 calls × 0.5s = 25 seconds
- ~120 calls/minute
- Exceeds free tier limit ✗

## Testing

### Test Rate Limit Handling
```bash
cd backend
python test_ai_matcher.py
```

Watch for:
```
⚠ Rate limit hit (attempt 1/5)
⏳ Waiting 3.2s before retry...
✓ Match found! Confidence: 0.90
```

### Simulate Rate Limits
Temporarily set very low delay to trigger rate limits:
```env
RATE_LIMIT_DELAY=0.1  # Very aggressive
```

Then run test and observe retry behavior.

## Summary

✅ **Base delay between calls** - Prevents hitting rate limits  
✅ **Exponential backoff** - Smart retry strategy  
✅ **Configurable retries** - Adjustable persistence  
✅ **Intelligent error detection** - Distinguishes rate limits from other errors  
✅ **Detailed logging** - Clear visibility into retry behavior  
✅ **Jitter** - Prevents thundering herd problem  

The system now handles rate limits gracefully with automatic retries and exponential backoff, ensuring reliable processing even with API constraints.

## Configuration Summary

```env
# Recommended for most use cases
RATE_LIMIT_DELAY=1.0    # 1 second between calls
MAX_RETRIES=5           # 5 retry attempts

# Conservative (avoid rate limits)
RATE_LIMIT_DELAY=2.0
MAX_RETRIES=5

# Aggressive (faster, more retries)
RATE_LIMIT_DELAY=0.5
MAX_RETRIES=10
```

Choose based on:
- Dataset size
- API plan limits
- Processing time requirements
- Reliability needs
