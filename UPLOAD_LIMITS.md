# Upload Limits and Capacity Guide

## Current Configuration

### File Size Limit
**Current:** `50 MB` per file

This is configured in your `.env` file:
```env
MAX_FILE_SIZE=50
```

### Record Capacity

Based on your current configuration:

| File Size | Approximate Records* | Processing Time** | Recommended |
|-----------|---------------------|-------------------|-------------|
| 1 MB | ~10,000 records | 2-5 minutes | ✓ Fast |
| 5 MB | ~50,000 records | 10-15 minutes | ✓ Good |
| 10 MB | ~100,000 records | 20-30 minutes | ✓ OK |
| 25 MB | ~250,000 records | 50-75 minutes | ⚠ Slow |
| 50 MB | ~500,000 records | 100-150 minutes | ⚠ Very Slow |

*Approximate - depends on number of columns and data complexity
**With AI matching enabled and rate limiting (2s delay)

## How to Change Limits

### Increase File Size Limit

Edit `backend/.env`:
```env
# For 100 MB limit
MAX_FILE_SIZE=100

# For 200 MB limit
MAX_FILE_SIZE=200

# For 500 MB limit
MAX_FILE_SIZE=500
```

Then **restart your backend**.

### Recommended Settings

#### Small Datasets (< 10,000 records)
```env
MAX_FILE_SIZE=10
```
- Fast processing
- Low memory usage
- Quick results

#### Medium Datasets (10,000 - 50,000 records)
```env
MAX_FILE_SIZE=50
```
- Balanced performance
- Moderate memory usage
- Reasonable processing time

#### Large Datasets (50,000 - 100,000 records)
```env
MAX_FILE_SIZE=100
```
- Longer processing time
- Higher memory usage
- May hit rate limits more frequently

#### Very Large Datasets (100,000+ records)
```env
MAX_FILE_SIZE=200
```
- Very long processing time
- High memory usage
- Recommended: Process in batches instead

## Performance Factors

### 1. Number of Records
More records = longer processing time
- Exact matching: Fast (O(n))
- Fuzzy matching: Slow (O(n²))
- AI matching: Very slow (API rate limits)

### 2. AI Matching Configuration

**Current Settings:**
```env
RATE_LIMIT_DELAY=2.0          # 2 seconds between API calls
AI_TOP_K_CANDIDATES=5         # Top 5 candidates per record
MIN_FUZZY_FOR_LLM=0.45        # Skip AI if fuzzy < 45%
```

**Processing Time Calculation:**
```
Records for AI = Records - (Exact Matched + Fuzzy Matched + Skipped)
API Calls = Records for AI × 1 (if candidates pass filter)
Time = API Calls × RATE_LIMIT_DELAY

Example:
1000 records → 200 go to AI → 200 × 2s = 400s (6.7 minutes)
```

### 3. Rate Limiting

**Current:** 2 seconds between calls = max 30 calls/minute

**Options:**
- **Faster (1s delay):** Higher risk of rate limits
- **Balanced (2s delay):** Current setting, safe
- **Safer (3s delay):** Slower but no rate limits

### 4. Data Complexity

**Faster Processing:**
- Many exact matches (new_tag_number + serial_no match)
- Simple descriptions
- Fewer unique records
- Many duplicates

**Slower Processing:**
- Few exact matches
- Complex descriptions requiring AI
- Many unique records
- No duplicates

## Memory Usage

### Estimated Memory Requirements

| Records | Columns | Memory Usage | Recommended RAM |
|---------|---------|--------------|-----------------|
| 10,000 | 10 | ~50 MB | 2 GB |
| 50,000 | 10 | ~250 MB | 4 GB |
| 100,000 | 10 | ~500 MB | 8 GB |
| 500,000 | 10 | ~2.5 GB | 16 GB |

**Note:** These are estimates. Actual usage depends on:
- Data types (text vs numbers)
- Description length
- Number of columns
- Duplicate count

## Optimization Strategies

### For Large Datasets

#### 1. Split Files
Instead of uploading 1 file with 100,000 records:
- Split into 10 files of 10,000 records each
- Process separately
- Faster and more manageable

#### 2. Adjust AI Settings
```env
# More aggressive filtering
MIN_FUZZY_FOR_LLM=0.50        # Skip more records
AI_TOP_K_CANDIDATES=3         # Fewer candidates

# Faster rate limiting (if not hitting limits)
RATE_LIMIT_DELAY=1.0          # Faster API calls
```

#### 3. Disable AI Matching
If you don't need AI matching for large datasets:
- Remove or rename `OPENAI_API_KEY` in `.env`
- System will only do Exact + Fuzzy matching
- Much faster processing

#### 4. Process in Batches
```python
# Manually split your Excel file
# Process first 10,000 records
# Then next 10,000 records
# Combine results manually
```

### For Better Performance

#### 1. Pre-clean Your Data
- Remove obvious duplicates before upload
- Standardize tag numbers and serial numbers
- Clean up descriptions

#### 2. Use Better Matching Fields
- Ensure new_tag_number and serial_no are filled
- More exact matches = faster processing
- Less AI matching needed

#### 3. Increase Fuzzy Threshold
```env
FUZZY_PREFILTER_THRESHOLD=0.40  # More strict
MIN_FUZZY_FOR_LLM=0.50          # Skip more
```

## Real-World Examples

### Example 1: Small Company (1,000 records)
```
File Size: 2 MB
Records: 1,000
Processing Time: ~3 minutes

Breakdown:
- Exact matched: 600 (fast)
- Fuzzy matched: 200 (medium)
- AI matched: 100 (2 mins)
- Unmatched: 100
```

### Example 2: Medium Company (10,000 records)
```
File Size: 15 MB
Records: 10,000
Processing Time: ~25 minutes

Breakdown:
- Exact matched: 6,000 (fast)
- Fuzzy matched: 2,000 (medium)
- AI matched: 1,000 (20 mins)
- Unmatched: 1,000
```

### Example 3: Large Company (50,000 records)
```
File Size: 70 MB
Records: 50,000
Processing Time: ~2 hours

Breakdown:
- Exact matched: 30,000 (fast)
- Fuzzy matched: 10,000 (medium)
- AI matched: 5,000 (1.5 hours)
- Unmatched: 5,000

Recommendation: Split into 5 batches of 10,000 records
```

## Technical Limits

### Flask/Python Limits
- **Memory:** Limited by available RAM
- **Processing:** Single-threaded (one reconciliation at a time)
- **Pandas:** Can handle millions of rows, but slow

### MySQL Limits
- **Max packet size:** 16 MB default (can be increased)
- **Max table size:** Effectively unlimited for your use case
- **Max connections:** Typically 151 (more than enough)

### Groq API Limits (AI Matching)
- **Free Tier:** 30 requests/minute, 6,000 tokens/minute
- **Paid Tier:** Higher limits (contact Groq)
- **Our setting:** 30 requests/minute (2s delay)

### Excel Limits
- **Max rows:** 1,048,576 rows per sheet
- **Max file size:** ~50 MB practical limit
- **Performance:** Slow above 10,000 rows

## Recommended Configuration

### For Best Performance

```env
# File Upload
MAX_FILE_SIZE=100

# AI Matching - Optimized
FUZZY_PREFILTER_THRESHOLD=0.35
MIN_FUZZY_FOR_LLM=0.50
AI_TOP_K_CANDIDATES=5
RATE_LIMIT_DELAY=2.0
MAX_RETRIES=5

# AI Thresholds
AI_MATCH_THRESHOLD=0.20
MANUAL_REVIEW_THRESHOLD=0.10
```

### For Maximum Speed (No AI)

```env
# File Upload
MAX_FILE_SIZE=200

# Remove or comment out AI key to disable AI matching
# OPENAI_API_KEY=

# Only Exact + Fuzzy matching will run (much faster)
```

### For Best Accuracy (Slower)

```env
# File Upload
MAX_FILE_SIZE=50

# AI Matching - Comprehensive
FUZZY_PREFILTER_THRESHOLD=0.25
MIN_FUZZY_FOR_LLM=0.40
AI_TOP_K_CANDIDATES=10
RATE_LIMIT_DELAY=1.5
MAX_RETRIES=10

# Lower thresholds = more matches
AI_MATCH_THRESHOLD=0.15
MANUAL_REVIEW_THRESHOLD=0.10
```

## Troubleshooting

### "Request Entity Too Large" Error

**Cause:** File exceeds `MAX_FILE_SIZE`

**Solution:** Increase limit in `.env` and restart backend

### "Memory Error" or System Freezes

**Cause:** File too large for available RAM

**Solution:**
1. Split file into smaller chunks
2. Close other applications
3. Upgrade server RAM

### "Timeout" Error

**Cause:** Processing taking too long

**Solution:**
1. Reduce file size
2. Disable AI matching
3. Increase timeout (if using web server like nginx)

### Very Slow Processing

**Causes:**
- Too many records for AI matching
- Rate limits being hit
- Slow fuzzy matching

**Solutions:**
1. Increase `MIN_FUZZY_FOR_LLM` to skip more records
2. Reduce `AI_TOP_K_CANDIDATES`
3. Process in smaller batches

## Summary

**Current Limits:**
- ✅ **File Size:** 50 MB per file
- ✅ **Records:** Up to ~500,000 records (theoretically)
- ✅ **Practical Limit:** 10,000-50,000 records for reasonable speed
- ✅ **Recommended:** Process in batches if > 50,000 records

**To Increase Limits:**
1. Edit `MAX_FILE_SIZE` in `.env`
2. Adjust AI matching settings for performance
3. Consider splitting large files
4. Restart backend after changes

**Best Practice:**
- **< 10,000 records:** Upload directly, fast processing
- **10,000 - 50,000 records:** Upload directly, moderate speed
- **> 50,000 records:** Split into batches, process separately
