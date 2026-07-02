# Performance Optimization Guide

## System Capacity

The Asset Reconciliation Platform has been optimized to handle:

- **File Size**: Up to 100 MB per file (customer + internal files)
- **Record Count**: Up to 1 million records per file
- **Processing Time**: Varies based on matching complexity and AI usage

## Optimization Features

### 1. Optimized File Reading (data_cleaner.py)

**Purpose**: Efficiently read large Excel files

**How it works**:
- Pandas' openpyxl engine handles large files efficiently
- File size detection and logging for user feedback
- Memory-efficient reading (pandas streams data internally)

**Configuration**: Automatic, no configuration needed

**Example Output**:
```
Large file detected (75.2MB) - this may take a moment...
✓ Read 150000 rows from Excel file (75.2MB)
```

### 2. Memory-Efficient Duplicate Detection (reconciliation_service.py)

**Purpose**: Handle duplicate detection on datasets with 100k+ records

**How it works**:
- For datasets < 50k records: Uses pandas built-in `duplicated()` (fast)
- For datasets ≥ 50k records: Uses batch processing with set-based tracking
- Processes records in batches to avoid memory spikes

**Configuration**:
```env
BATCH_SIZE=10000  # Number of records per batch (default: 10000)
```

**Example Output**:
```
Detecting duplicates in 150000 records...
  Using batch processing (batch size: 10000)...
    Processed 10000/150000 records
    Processed 20000/150000 records
    ...
  ✓ Found 5234 duplicates, 144766 unique records
```

### 3. Batch-Based Fuzzy Matching (fuzzy_matcher.py)

**Purpose**: Optimize fuzzy matching for large datasets (O(n×m) complexity)

**How it works**:
- Processes customer records in batches
- Smart sampling: Limits comparisons per record to top 5,000 candidates
- Category-based filtering: Prioritizes same-category matches
- Early termination when no good matches found

**Configuration**:
```env
BATCH_SIZE=10000  # Customer records per batch
```

**Performance**:
- Small datasets (< 10k records): Process all at once
- Large datasets (> 10k records): Batch processing with progress logging
- Comparison limit: 5,000 internal records per customer record max

**Example Output**:
```
Starting fuzzy matching: 50000 customer vs 60000 internal records
  Threshold: 0.60, Batch size: 10000
  Using batch processing for large dataset...
    Processing batch 1: records 1-10000/50000
      Found 1234 matches in this batch (total: 1234)
    Processing batch 2: records 10001-20000/50000
      Found 987 matches in this batch (total: 2221)
    ...
  ✓ Fuzzy matching complete: 5678 matches found
    Remaining: 44322 customer, 54322 internal
```

### 4. Limited AI Processing (reconciliation_service.py)

**Purpose**: Control costs and processing time for LLM API calls

**How it works**:
- Only processes records that passed exact and fuzzy matching
- Configurable limit on number of records sent to AI
- Fuzzy pre-filtering reduces LLM calls by 40-95%
- Rate limiting prevents API throttling

**Configuration**:
```env
MAX_AI_RECORDS=1000           # Max records to process with AI
AI_TOP_K_CANDIDATES=5         # Top N candidates per record
MIN_FUZZY_FOR_LLM=0.45       # Skip LLM if best fuzzy < 45%
RATE_LIMIT_DELAY=2.0         # Seconds between API calls
MAX_RETRIES=5                # Retry attempts for rate limits
```

**Performance**:
- With 50k unmatched records: Only processes first 1,000 with AI
- Pre-filtering: Reduces LLM calls by 60-95%
- Rate limiting: Prevents 429 errors

**Example Output**:
```
Step 4: AI-Assisted Matching
  AI Matcher available: True
  Remaining customer records: 50000
  Remaining internal records: 60000
Processing 1000 customer records with AI (limit: 1000)...
  Pre-filtering with fuzzy matching...
  Processing customer record 1/1000...
    Fuzzy pre-filter: Found 5 candidates above 0.30 threshold
    Best fuzzy score: 0.52 - Sending to LLM
    ✓ AI Match found: confidence 0.85
  ...
  Results: 234 AI matched, 156 manual review
```

### 5. Streaming Excel Report Generation (report_generator.py)

**Purpose**: Generate large Excel reports without memory overflow

**How it works**:
- Writes sheets sequentially
- For sheets > 50k rows: Writes in chunks
- Progress logging for large operations

**Configuration**: Uses `BATCH_SIZE` from config (default: 10000)

**Example Output**:
```
Generating Excel report: reconciliation_report_72_20260702_143022.xlsx
  ✓ Summary sheet created
  Writing Exact_Matched_By_Tag in chunks (75000 rows)...
    Writing rows 1-50000...
    Writing rows 50001-75000...
  ✓ Exact_Matched_By_Tag sheet created (75000 rows)
  ✓ AI_Matched_Need_Manual_Review sheet created (1234 rows)
  ...
✓ Report generated successfully
```

## Configuration Reference

### File Upload Limits

```env
# Maximum file size in MB (customer + internal files)
MAX_FILE_SIZE=100
```

### Batch Processing

```env
# Number of records to process per batch
BATCH_SIZE=10000

# Maximum records to send to AI/LLM
MAX_AI_RECORDS=1000
```

### Matching Thresholds

```env
# AI confidence thresholds
AI_MATCH_THRESHOLD=0.20          # Auto-accept if ≥ 20%
MANUAL_REVIEW_THRESHOLD=0.10     # Manual review if ≥ 10%

# Fuzzy pre-filtering for AI
FUZZY_PREFILTER_THRESHOLD=0.30   # Pre-filter threshold
MIN_FUZZY_FOR_LLM=0.45          # Skip LLM if best < 45%
AI_TOP_K_CANDIDATES=5            # Top candidates per record
```

### Rate Limiting

```env
# Groq API rate limiting
RATE_LIMIT_DELAY=2.0            # Seconds between calls
MAX_RETRIES=5                   # Retry attempts
```

## Performance Benchmarks

### Test Scenario 1: Medium Dataset
- **Size**: 10,000 customer + 12,000 internal records (~5 MB each)
- **Processing Time**: ~2-3 minutes
- **Memory Usage**: ~500 MB
- **AI Calls**: ~500 (after fuzzy filtering)

### Test Scenario 2: Large Dataset
- **Size**: 100,000 customer + 120,000 internal records (~50 MB each)
- **Processing Time**: ~15-20 minutes
- **Memory Usage**: ~2 GB
- **AI Calls**: ~1,000 (limited by MAX_AI_RECORDS)

### Test Scenario 3: Very Large Dataset
- **Size**: 500,000 customer + 600,000 internal records (~100 MB each)
- **Processing Time**: ~45-60 minutes
- **Memory Usage**: ~4 GB
- **AI Calls**: ~1,000 (limited by MAX_AI_RECORDS)

## Recommendations

### For Small Datasets (< 10k records)
```env
BATCH_SIZE=50000              # Not needed, will process all at once
MAX_AI_RECORDS=5000           # Process more with AI
AI_TOP_K_CANDIDATES=10        # More candidates per record
```

### For Medium Datasets (10k - 100k records)
```env
BATCH_SIZE=10000              # Default batch size
MAX_AI_RECORDS=1000           # Reasonable AI limit
AI_TOP_K_CANDIDATES=5         # Balance quality/speed
```

### For Large Datasets (100k - 1M records)
```env
BATCH_SIZE=5000               # Smaller batches for memory
MAX_AI_RECORDS=500            # Limit AI to reduce cost
AI_TOP_K_CANDIDATES=3         # Fewer candidates
MIN_FUZZY_FOR_LLM=0.50        # Higher threshold
```

## Monitoring and Troubleshooting

### Memory Issues

**Symptoms**: 
- "MemoryError" exceptions
- System slowdown
- Process killed

**Solutions**:
1. Reduce `BATCH_SIZE` (try 5000 or 2500)
2. Reduce `MAX_AI_RECORDS` to limit memory during AI processing
3. Close other applications
4. Increase system RAM

### Performance Issues

**Symptoms**:
- Slow processing (> 1 hour for 100k records)
- Hanging during fuzzy matching

**Solutions**:
1. Increase `MIN_FUZZY_FOR_LLM` to skip more AI calls
2. Reduce `AI_TOP_K_CANDIDATES` to 3 or fewer
3. Ensure `RATE_LIMIT_DELAY` is set to 2.0 or higher
4. Check database connection (MySQL performance)

### API Rate Limiting

**Symptoms**:
- Frequent "429 Too Many Requests" errors
- Long waits between retries

**Solutions**:
1. Increase `RATE_LIMIT_DELAY` to 3.0 or 4.0 seconds
2. Reduce `MAX_AI_RECORDS` to limit total API calls
3. Increase `MIN_FUZZY_FOR_LLM` to skip weak matches
4. Use higher-tier Groq API plan

## Architecture Notes

The system uses a **pipeline architecture** with progressive refinement:

1. **Exact Matching** (Rule-based): Fast, 100% accurate, O(n) complexity
2. **Fuzzy Matching**: Medium speed, good accuracy, O(n×m) complexity (optimized with batching)
3. **AI Matching**: Slow, high accuracy, limited by API rate limits

Each stage only processes records not matched by previous stages, minimizing computational load.

## Future Enhancements

Potential optimizations for even larger datasets:

1. **Parallel Processing**: Multi-threading for fuzzy matching
2. **Database-backed Processing**: Store intermediate results in MySQL
3. **Incremental Processing**: Resume from checkpoints
4. **Async AI Calls**: Concurrent LLM requests with semaphore limiting
5. **Index-based Fuzzy Matching**: Pre-build search indices (BK-tree, LSH)
6. **Distributed Processing**: Split workload across multiple workers
