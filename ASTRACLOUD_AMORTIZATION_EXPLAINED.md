# AstraCloud AI Amortization Calculation

This document explains how the monthly payment schedule is calculated for AstraCloud AI.

## Deal Inputs

| Field | Value |
|---|---:|
| Principal | $15,000,000 |
| Annual Rate | 12.25% |
| Monthly Rate | 12.25% / 12 = 1.020833% |
| Tenure | 36 months |
| IO Period | 6 months |
| Amortization Period | 30 months |
| Origination Fee | 2.00% |
| EOT Fee | 1.00% |
| PIK Rate | 0.00% |

## Core Formulas

### Monthly Interest

```text
Interest = Opening Balance * Annual Rate / 12
```

Example:

```text
$15,000,000 * 12.25% / 12 = $153,125
```

### Monthly Principal

This loan uses straight-line amortization after the IO period:

```text
Monthly Principal = Principal / Amortization Months
```

For AstraCloud AI:

```text
$15,000,000 / 30 = $500,000
```

### Total Payment

```text
Total Payment = Interest + Principal + EOT Fee
```

The EOT fee is only paid in the final month.

### Closing Balance

```text
Closing Balance = Opening Balance - Principal
```

During IO months, principal is zero, so the closing balance stays the same.

## Column Definitions

| Column | Meaning |
|---|---|
| Mo. | Month number from 1 to 36 |
| Date | Origination date plus the month number |
| Phase | `IO`, `Amort`, or `Amort (Final)` |
| Opening bal. | Outstanding balance at the start of the month |
| Interest | Monthly cash interest due |
| Principal | Principal repayment for the month |
| Total payment | Interest + principal + EOT fee if final month |
| Closing bal. | Balance after principal repayment |

## IO Period: Months 1-6

During the IO period:

```text
Principal = $0
Closing Balance = Opening Balance
```

Each IO month is calculated as:

```text
Opening Balance = $15,000,000
Interest = $15,000,000 * 12.25% / 12 = $153,125
Principal = $0
Total Payment = $153,125
Closing Balance = $15,000,000
```

Example:

| Mo. | Phase | Opening | Interest | Principal | Total | Closing |
|---:|---|---:|---:|---:|---:|---:|
| 1 | IO | $15,000,000 | $153,125 | $0 | $153,125 | $15,000,000 |

## Amortization Period: Months 7-35

From month 7 onward:

```text
Principal = $500,000
```

Month 7:

```text
Opening Balance = $15,000,000
Interest = $15,000,000 * 12.25% / 12 = $153,125
Principal = $500,000
Total Payment = $153,125 + $500,000 = $653,125
Closing Balance = $15,000,000 - $500,000 = $14,500,000
```

Month 8:

```text
Opening Balance = $14,500,000
Interest = $14,500,000 * 12.25% / 12 = $148,020.83
Principal = $500,000
Total Payment = $148,020.83 + $500,000 = $648,020.83
Closing Balance = $14,500,000 - $500,000 = $14,000,000
```

The same pattern continues until month 35.

## Final Month: Month 36

The final month includes the remaining principal and the EOT fee.

```text
Opening Balance = $500,000
Interest = $500,000 * 12.25% / 12 = $5,104.17
Principal = $500,000
EOT Fee = $15,000,000 * 1.00% = $150,000
Total Payment = $5,104.17 + $500,000 + $150,000 = $655,104.17
Closing Balance = $0
```

Displayed rounded:

```text
Opening Balance = $500,000
Interest = $5,104
Principal = $500,000
Total Payment = $655,104
Closing Balance = $0
```

## Why Month 36 Total Payment Is Higher

Month 36 is higher because it includes:

```text
Final interest + final principal + EOT fee
```

```text
$5,104 + $500,000 + $150,000 = $655,104
```

The EOT fee is included in the total payment but is not shown as a separate column in the UI table.

## Full Schedule Logic

```text
balance = principal

for month in 1..36:
    opening_balance = balance
    interest = opening_balance * rate / 12

    if month <= 6:
        phase = "IO"
        principal_payment = 0
        eot_fee = 0

    else if month == 36:
        phase = "Amort (Final)"
        principal_payment = remaining_balance
        eot_fee = principal * eot_fee_rate

    else:
        phase = "Amort"
        principal_payment = principal / amort_months
        eot_fee = 0

    total_payment = interest + principal_payment + eot_fee
    closing_balance = opening_balance - principal_payment
```

## Final Verification

| Check | Result |
|---|---:|
| Monthly interest at full balance | $153,125 |
| Monthly principal | $500,000 |
| Month 7 closing balance | $14,500,000 |
| Final month interest | $5,104 |
| Final month EOT fee | $150,000 |
| Final total payment | $655,104 |
| Final closing balance | $0 |

All AstraCloud AI amortization table values are correct.
