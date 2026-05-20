# Sample portfolio test results

**Run date:** 2026-05-18 14:08 UTC  
**API:** `http://127.0.0.1:8000`  
**API reachable:** Yes  
**Samples directory:** `D:\privatecreadit\private-credit-mcp\frontend\public\samples`

## Summary

| Result | Count |
|--------|-------|
| **PASS** | 5 |
| **FAIL** | 0 |

| Sample | File | Upload | Deals | AUM | Port IRR | Summary | Deal metrics | Overall |
|--------|------|--------|-------|-----|----------|---------|--------------|---------|
| Nexus Fund II | `nexus-fund-ii.xlsx` | ✅ | 5 | $7.40M | 18.04% | ✅ | ✅ | **PASS** |
| Nexus Fund III | `nexus-fund-iii.xlsx` | ✅ | 5 | $6.60M | 18.07% | ✅ | ✅ | **PASS** |
| Nexus Fund IV | `nexus-fund-iv.xlsx` | ✅ | 5 | $7.25M | 18.18% | ✅ | ✅ | **PASS** |
| Nexus Portfolio 4 | `nexus-portfolio-4.xlsx` | ✅ | 5 | $6.70M | 18.31% | ✅ | ✅ | **PASS** |
| Demo portfolio | `sample-portfolio.xlsx` | ✅ | 6 | $50.50M | 17.48% | ✅ | ✅ | **PASS** |

## Correct results (PASS)

### Nexus Fund II (`nexus-fund-ii.xlsx`)

- Upload: ✅ — **5** deals parsed
- AUM: **$7.40M**
- Portfolio IRR: **18.04%**
- First deal metrics (`D001`): IRR **14.90%**

### Nexus Fund III (`nexus-fund-iii.xlsx`)

- Upload: ✅ — **5** deals parsed
- AUM: **$6.60M**
- Portfolio IRR: **18.07%**
- First deal metrics (`D001`): IRR **16.80%**

### Nexus Fund IV (`nexus-fund-iv.xlsx`)

- Upload: ✅ — **5** deals parsed
- AUM: **$7.25M**
- Portfolio IRR: **18.18%**
- First deal metrics (`D001`): IRR **14.90%**

### Nexus Portfolio 4 (`nexus-portfolio-4.xlsx`)

- Upload: ✅ — **5** deals parsed
- AUM: **$6.70M**
- Portfolio IRR: **18.31%**
- First deal metrics (`D001`): IRR **16.91%**

### Demo portfolio (`sample-portfolio.xlsx`)

- Upload: ✅ — **6** deals parsed
- AUM: **$50.50M**
- Portfolio IRR: **17.48%**
- First deal metrics (`D001`): IRR **27.17%**


## Incorrect results (FAIL)

_None — all samples passed._


## How to re-run

```bash
cd private-credit-mcp
.venv\Scripts\activate
python -m uvicorn api.main:app --port 8000
# other terminal:
python scripts/test_sample_portfolios.py
```

## UI one-click load

On the Connect screen, choose **Upload file**, then click any chip under **Try a sample portfolio** to load without browsing.
