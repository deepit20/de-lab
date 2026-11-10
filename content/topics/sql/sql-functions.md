=== crisp
**CASE** — derive categories:
```sql
CASE WHEN amount >= 300 THEN 'large' WHEN amount >= 100 THEN 'medium' ELSE 'small' END AS size
```
First matching WHEN wins; no ELSE → NULL.

**Strings:** `UPPER/LOWER`, `TRIM`, `SUBSTR(s, start, len)` (1-based), `REPLACE(s, a, b)`, `LENGTH`, concat `a || b` (BigQuery `CONCAT`), `INSTR` (BigQuery `STRPOS`).

**Dates** (SQLite stores ISO text):
| Need | SQLite | BigQuery |
|---|---|---|
| truncate to month | `strftime('%Y-%m-01', d)` | `DATE_TRUNC(d, MONTH)` |
| year | `strftime('%Y', d)` | `EXTRACT(YEAR FROM d)` |
| add days | `date(d, '+7 day')` | `DATE_ADD(d, INTERVAL 7 DAY)` |
| difference in days | `julianday(a) - julianday(b)` | `DATE_DIFF(a, b, DAY)` |

**Types:** `CAST(x AS INTEGER/REAL/TEXT)`; BigQuery `SAFE_CAST` returns NULL instead of failing — ideal for dirty data.

- Store timestamps in **UTC**; convert for display.
- Cleaning pattern: `NULLIF(TRIM(LOWER(email)), '')`.

=== memory
- **CASE reads top-down; first true wins.**
- **SAFE_CAST = cast that never crashes.**
- Trigger: *"month bucket"* → truncate date to month.

=== data
flashcards:
  - q: "What does CASE return when no WHEN matches and there is no ELSE?"
    a: "NULL."
  - q: "SQLite and BigQuery way to truncate a date to its month?"
    a: "SQLite strftime('%Y-%m-01', d); BigQuery DATE_TRUNC(d, MONTH)."
  - q: "Why use SAFE_CAST in BigQuery pipelines?"
    a: "Bad values become NULL instead of failing the whole query — then you can count/route them."
quiz:
  - q: "`CASE WHEN amount > 100 THEN 'A' WHEN amount > 300 THEN 'B' END` for amount 500 returns…"
    options: ["'A'", "'B'", "NULL", "error"]
    answer: 0
    explain: "The first matching WHEN wins — order conditions from most to least specific."
exercises:
  - id: sql-functions-1
    lang: sql
    kind: coding
    difficulty: 1
    title: Order size buckets
    prompt: |
      Classify non-cancelled orders: `large` (≥ 300), `medium` (≥ 100), else `small`. Return `size`, `orders`, `revenue` (rounded 2), ordered by revenue desc.
    starter: |
      SELECT CASE
             END AS size
      FROM orders
    solution: |
      SELECT CASE WHEN amount >= 300 THEN 'large' WHEN amount >= 100 THEN 'medium' ELSE 'small' END AS size,
             COUNT(*) AS orders, ROUND(SUM(amount), 2) AS revenue
      FROM orders
      WHERE status <> 'cancelled'
      GROUP BY size
      ORDER BY revenue DESC;
    ordered: true
    hints:
      - "Put the largest threshold first."
  - id: sql-functions-2
    lang: sql
    kind: coding
    difficulty: 1
    title: Clean names and emails
    prompt: |
      From `stg_customers`, return `stg_id`, `clean_name` (trimmed, Title case not required — just TRIM) and `clean_email` (trimmed, lower-case, NULL if empty) for rows whose name or email needed cleaning (i.e. the cleaned value differs from the raw value). Order by stg_id.
    starter: |
      SELECT stg_id
      FROM stg_customers
    solution: |
      SELECT stg_id, TRIM(name) AS clean_name, NULLIF(TRIM(LOWER(email)), '') AS clean_email
      FROM stg_customers
      WHERE TRIM(name) <> name OR LOWER(email) <> email
      ORDER BY stg_id;
    ordered: true
    hints:
      - "Compare the cleaned expression with the raw column in WHERE."
interview:
  - q: "How do you handle dirty date or numeric values when casting in a warehouse pipeline?"
    type: scenario
    level: 2
    keyPoints:
      - "SAFE_CAST or TRY_CAST returns NULL"
      - "count and log rejected values"
      - "quarantine bad rows instead of failing silently"
      - "validate formats in staging"
