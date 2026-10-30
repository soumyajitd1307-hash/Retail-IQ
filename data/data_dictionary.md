# Data Dictionary — Retail Customer Intelligence

This project uses synthetic (computer-generated) retail transaction data. It does not contain real customer records.

| Column | Meaning | Notes |
|---|---|---|
| `customer_id` | Unique customer identifier | One customer can have many transactions |
| `order_id` | Unique order identifier | Used to identify duplicate orders |
| `transaction_date` | Date of the transaction | ISO format: YYYY-MM-DD |
| `category` | Product category | `Unknown` means category was missing in source data |
| `quantity` | Number of units purchased | Positive integer expected |
| `amount` | Final amount paid after discount | Invalid non-positive values removed; extreme values capped at the 99th percentile in cleaned output |
| `discount_percent` | Discount percentage applied | 0 means no discount |
| `discount_amount` | Monetary value of the discount | Synthetic estimate |
| `is_discounted` | Whether the order had a discount | 1 = yes, 0 = no |
| `campaign_id` | Promotion/campaign identifier | Blank means no campaign recorded |
| `channel` | Purchase channel | Online, In-Store, or Mobile App |
| `persona_true` | Synthetic ground-truth persona | Validation only; **must not be used as an ML input feature** |

## Cleaning rules
1. Invalid transaction dates were removed.
2. Duplicate `order_id` records were removed.
3. Missing categories were filled with `Unknown`.
4. Rows with missing required numeric values were removed.
5. Transactions with `amount <= 0` were removed.
6. `amount` values above the 99th percentile were capped at the 99th percentile.
