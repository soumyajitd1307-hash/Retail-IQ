# Cleaning Report

- Rows before cleaning: 3751
- Rows after cleaning: 3748
- Invalid dates removed: 1
- Duplicate orders removed: 1
- Missing categories filled with `Unknown`: 1
- Rows removed for missing required numeric fields: 0
- Rows removed because amount was non-positive: 1
- Amount outlier cap (99th percentile): 3586.83
- Rows whose amount was capped: 38
- Clean output: `transactions_clean.csv`

Notes:
- This dataset is synthetic, not real customer data.
- `persona_true` is for validation only and must not be used as a model feature.
- Outliers were capped rather than dropped to retain potentially valid high-value orders.
