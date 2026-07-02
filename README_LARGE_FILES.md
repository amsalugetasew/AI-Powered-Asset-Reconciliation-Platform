# Handling Large Files (100MB, 1M Records)

This guide explains how to use the Asset Reconciliation System with large datasets.

## System Requirements

### Minimum Requirements
- **RAM**: 8 GB
- **CPU**: 4 cores
- **Disk Space**: 10 GB free
- **Python**: 3.8+
- **MySQL**: 5.7+ or 8.0+

### Recommended for Large Files
- **RAM**: 16 GB or more
- **CPU**: 8 cores
- **Disk Space**: 20 GB free
- **SSD**: For faster file I/O

## Capacity

The system is optimized to handle:

| Metric | Capacity |
|--------|----------|
| Max file size per file | 100 MB |
| Max records per file | 1,000,000 |
| Max total records (both files) | 2,000,000 |
| Concurrent uploads | 1 (process sequentially) |

## Configuration for Large Files

### 1. Update `.env` File

For **medium datasets** (10k - 100k records):
```env
# Use default settings
MAX_FILE_SIZE=100
BATCH_SIZE=10000
MAX_AI_RECORDS=1000
AI_TOP_K_CANDIDATES=5
MIN_FUZZY_FOR_LLM=0.45
RATE_LIMIT_DELAY=2.0
```

For **large datasets** (100k - 1M records):
```env
# Reduce batch sizes and AI usage
MAX_FILE_SIZE=100
BATCH_SIZE=5000           # Smaller batches
MAX_AI_RECORDS=500        # Limit AI to reduce costs
AI_TOP_K_CANDIDATES=3     # Fewer candidates
MIN_FUZZY_FOR_LLM=0.50    # Higher threshold to skip more
RATE_LIMIT_DELAY=3.0      # Longer delay between API calls
```

### 2. Optimize MySQL Configuration

Edit MySQL config file (`my.cnf` or `my.ini`):

```ini
[mysqld]
# Increase buffer pool for large datasets
innodb_buffer_pool_size = 2G

# Increase max packet size for large queries
max_allowed_packet = 256M

# Optimize for bulk operations
innodb_flush_log_at_trx_commit = 2
innodb_flush_method = O_DIRECT

# Connection limits
max_connections = 200
wait_timeout = 600
interactive_timeout = 600
```

Restart MySQL after changes.

### 3. Increase System Resources

**Linux/Mac**:
```bash
# Increase file descriptor limits
ulimit -n 4096

# Increase memory limits (if needed)
ulimit -m unlimited
```

**Windows**:
- Increase virtual memory (Page file size)
- Close unnecessary applications

## Usage Guide

### Step 1: Prepare Your Files

**File Format**: Excel (.xlsx or .xls)

**Required Columns** (case-insensitive):
- Old Tag Number
- New Tag Number
- Year
- Category
- Description
- Serial No
- Department
- District
- Book Value
- Asset Number

**Best Practices**:
1. Remove unnecessary columns to reduce file size
2. Clean data before upload (remove empty rows)
3. Split very large files (> 1M records) into multiple uploads

### Step 2: Upload Files

1. Navigate to the upload page
2. Select customer file (wait for upload to complete)
3. Select internal file (wait for upload to complete)
4. Click "Start Reconciliation"

**Important**: Do not close the browser during processing!

### Step 3: Monitor Progress

The system will display progress in the console:

```
Step 1: Loading and cleaning data...
  Large file detected (75.2MB) - using chunked reading with size 10000
  Chunk 1: 10000 rows (total so far: 10000)
  ...
  Total customer records uploaded: 150000
  Total internal records uploaded: 180000

Step 2: Performing Exact matching...
  Exact matches: 45000

Step 3: Performing fuzzy matching...
  Starting fuzzy matching: 105000 customer vs 135000 internal records
  Using batch processing for large dataset...
    Processing batch 1: records 1-10000/105000
    ...
  ✓ Fuzzy matching complete: 12000 matches found

Step 4: AI-Assisted Matching
  Processing 1000 customer records with AI (limit: 1000)...
  ...
  Results: 234 AI matched, 156 manual review

Step 5: Generating report...
  Generating Excel report: reconciliation_report_72_20260702.xlsx
  Writing Exact_Matched_By_Tag in chunks (45000 rows)...
  ✓ Report generated successfully
```

### Step 4: Download Results

Once complete, download the Excel report which contains:

- **Summary**: Overview of matches and statistics
- **Exact_Matched_By_Tag**: Rule-based matches
- **AI_Matched_Need_Manual_Review**: High-confidence AI matches
- **Matched_Need_Manual_Review**: Fuzzy + low-confidence AI matches
- **Customer_Unmatched**: Unmatched customer records
- **Finance_Unmatched**: Unmatched internal records
- **Customer_Duplicates**: Duplicate customer records
- **Finance_Duplicates**: Duplicate internal records

## Performance Expectations

### Processing Time Estimates

| Records | File Size | Processing Time | Memory Usage |
|---------|-----------|----------------|--------------|
| 10k | ~5 MB | 2-3 minutes | ~500 MB |
| 50k | ~25 MB | 8-12 minutes | ~1.5 GB |
| 100k | ~50 MB | 15-25 minutes | ~2.5 GB |
| 500k | ~100 MB | 45-75 minutes | ~4 GB |
| 1M | ~200 MB | 90-120 minutes | ~6 GB |

**Factors affecting speed**:
- Number of exact matches (faster)
- Number of fuzzy matches needed (slower)
- AI matching usage (slower, limited by API rate limits)
- System resources (CPU, RAM, disk speed)

### Cost Expectations (Groq API)

With current configuration:
- **MAX_AI_RECORDS=1000**: Process max 1,000 records with AI
- **AI_TOP_K_CANDIDATES=5**: Compare against 5 candidates each
- **Total LLM calls**: ~500-800 (after fuzzy pre-filtering)

**Cost**: ~$0.05-0.10 per reconciliation (using Groq's free tier limits)

To reduce costs:
- Decrease `MAX_AI_RECORDS` to 500 or 200
- Increase `MIN_FUZZY_FOR_LLM` to 0.60 or 0.70
- Use smaller `AI_TOP_K_CANDIDATES` (3 instead of 5)

## Testing Capacity

Use the included test script to verify your system can handle large datasets:

### Test File Reading
```bash
cd backend
python test_capacity.py --records 100000
```

### Test Full Pipeline
```bash
python test_capacity.py --records 50000 --full-pipeline
```

### Test with Existing File
```bash
python test_capacity.py --file path/to/large_file.xlsx --test-memory
```

The test will show:
- Time taken
- Memory usage
- Records per second
- Errors (if any)

## Troubleshooting

### Issue: "MemoryError" or System Freeze

**Cause**: Insufficient RAM for dataset size

**Solutions**:
1. Reduce `BATCH_SIZE` in `.env`:
   ```env
   BATCH_SIZE=2500  # or even 1000
   ```

2. Split large files into smaller chunks (500k records each)

3. Close other applications to free memory

4. Increase system swap/page file size

### Issue: "Request timed out" or Very Slow

**Cause**: Database or network bottleneck

**Solutions**:
1. Optimize MySQL (see configuration above)

2. Check database connection:
   ```bash
   mysql -u root -p
   SHOW PROCESSLIST;
   ```

3. Increase timeout in `config.py`:
   ```python
   SQLALCHEMY_ENGINE_OPTIONS = {
       'pool_pre_ping': True,
       'pool_recycle': 3600,
       'connect_timeout': 300  # Add this
   }
   ```

### Issue: "429 Too Many Requests" (Groq API)

**Cause**: Hitting API rate limits

**Solutions**:
1. Increase delay in `.env`:
   ```env
   RATE_LIMIT_DELAY=4.0  # 4 seconds between calls
   ```

2. Reduce AI usage:
   ```env
   MAX_AI_RECORDS=200
   MIN_FUZZY_FOR_LLM=0.60
   ```

3. Upgrade Groq API tier (if available)

### Issue: File Upload Fails

**Cause**: File too large or network timeout

**Solutions**:
1. Check file size: Must be < 100 MB per file

2. Increase upload timeout in `app.py`:
   ```python
   app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
   app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024
   ```

3. Use nginx/Apache with increased timeouts

4. Split file into smaller parts

### Issue: Excel Report Generation Hangs

**Cause**: Large report size (> 50k rows per sheet)

**Solution**: Already optimized! The system uses chunked writing automatically.

If still having issues, reduce chunk size in `report_generator.py`:
```python
def generate_excel_report(..., chunk_size: int = 25000):  # Reduce from 50000
```

## Performance Tuning Tips

### For Speed
- Increase `BATCH_SIZE` to 20000 (if you have enough RAM)
- Decrease `MAX_AI_RECORDS` to skip AI matching
- Use SSD for faster file I/O
- Use MySQL on same machine (reduce network latency)

### For Cost Reduction
- Decrease `MAX_AI_RECORDS` to 100-500
- Increase `MIN_FUZZY_FOR_LLM` to 0.70
- Reduce `AI_TOP_K_CANDIDATES` to 2-3

### For Accuracy
- Increase `MAX_AI_RECORDS` to 5000-10000
- Decrease `MIN_FUZZY_FOR_LLM` to 0.30
- Increase `AI_TOP_K_CANDIDATES` to 10

## Support

For issues or questions:
1. Check logs in console output
2. Review `PERFORMANCE_OPTIMIZATION.md` for detailed architecture
3. Run capacity test to verify system limits
4. Check system resources (RAM, CPU, disk space)

## Next Steps

After successful reconciliation:
1. Review matched records in the Excel report
2. Manually verify records in "Manual Review" sheets
3. Export final results for accounting
4. Archive processed files
