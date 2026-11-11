=== lesson
--- step concept: CASE turns rules into columns
`CASE` is SQL's if/else. It is evaluated **top to bottom** and the **first** true `WHEN` wins.

```sql
SELECT order_id, amount,
       CASE WHEN amount >= 300 THEN 'large'
            WHEN amount >= 100 THEN 'medium'
            ELSE 'small' END AS size
FROM orders;
```
No `ELSE` and no match → `NULL`.

> [!THINK] What happens if you swap the two WHEN lines? Which orders become "large"?

[[quiz:sql-functions:q0]]

--- step practice: Bucket the orders
Use `CASE` inside `SELECT` and group by the new column.

[[exercise:sql-functions-1]]

--- step example: Cleaning strings
Real source data arrives with spaces, mixed case and empty strings. A standard cleaning chain:

```sql
SELECT TRIM(full_name)                       AS clean_name,
       NULLIF(LOWER(TRIM(email)), '')        AS clean_email,
       SUBSTR(phone, 1, 3)                   AS area_code,
       REPLACE(city, '  ', ' ')              AS city
FROM stg_customers;
```
Read it inside-out: `TRIM` → `LOWER` → `NULLIF(…, '')` turns an empty string into a real NULL.

[[exercise:sql-functions-2]]

--- step concept: Dates are where dialects differ
SQLite stores dates as ISO text (`'2025-03-14'`), so you use `date()` and `strftime()`. BigQuery has real `DATE`/`TIMESTAMP` types.

| Need | SQLite | BigQuery |
|---|---|---|
| month bucket | `strftime('%Y-%m-01', d)` | `DATE_TRUNC(d, MONTH)` |
| add 7 days | `date(d, '+7 day')` | `DATE_ADD(d, INTERVAL 7 DAY)` |
| days between | `julianday(a) - julianday(b)` | `DATE_DIFF(a, b, DAY)` |

[[quiz:sql-functions:q1]]

--- step check: Casting safely
`CAST('12.5' AS REAL)` converts types. In BigQuery `CAST('abc' AS INT64)` **fails the whole query**, while `SAFE_CAST` returns NULL — so you can count bad rows instead of crashing the pipeline.

[[quiz:sql-functions:q2]]

--- step interview: Explain it
[[recall:sql-functions:r0]]

=== detailed
## CASE expressions
Two forms:

```sql
-- searched CASE (most flexible)
CASE WHEN amount >= 300 THEN 'large' WHEN amount >= 100 THEN 'medium' ELSE 'small' END
-- simple CASE (compares one value)
CASE status WHEN 'delivered' THEN 1 WHEN 'returned' THEN -1 ELSE 0 END
```
- Conditions are checked **in order**; put the most specific first.
- Every branch should return the **same type**.
- `CASE` works anywhere an expression works: `SELECT`, `WHERE`, `ORDER BY`, `GROUP BY`, inside `SUM()` (conditional aggregation).

## String functions
| Function | SQLite | BigQuery |
|---|---|---|
| upper / lower | `UPPER`, `LOWER` | same |
| trim spaces | `TRIM`, `LTRIM`, `RTRIM` | same |
| substring (1-based) | `SUBSTR(s, start, len)` | `SUBSTR` |
| replace | `REPLACE(s, a, b)` | same |
| length | `LENGTH` | `LENGTH` |
| concat | `a \|\| b` | `CONCAT(a, b)` or `\|\|` |
| position | `INSTR(s, x)` | `STRPOS(s, x)` |
| regex | — | `REGEXP_CONTAINS`, `REGEXP_EXTRACT` |

> [!MISTAKE] `'a' || NULL` is NULL. When concatenating optional parts, wrap them: `COALESCE(middle_name, '')`.

## Dates and timestamps
- Keep dates in ISO format (`YYYY-MM-DD`) — it sorts correctly as text.
- Store timestamps in **UTC** and convert only for display.
- Truncate to a period for reporting (`DATE_TRUNC`), extract parts with `EXTRACT(YEAR FROM d)` / `strftime('%Y', d)`.
- Day differences: `DATE_DIFF(end, start, DAY)` in BigQuery.

## Type conversion
- `CAST(x AS INTEGER | REAL | TEXT)` in SQLite; `CAST(x AS INT64 | NUMERIC | STRING)` in BigQuery.
- **Money:** use `NUMERIC`/`DECIMAL`, not float, in warehouses.
- `SAFE_CAST` (BigQuery) returns NULL on failure — pair it with a count of failures to make bad data visible.

> [!REAL] A typical staging model is just these functions applied column by column: trim, standardise case, convert empty strings to NULL, cast types, parse dates. Doing it once in staging means every downstream query gets clean data.

## Interview questions
- How does CASE decide which branch to use?
- How would you bucket timestamps into months in BigQuery?
- What is the difference between CAST and SAFE_CAST?

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
  - q: "In SQLite, which expression gives the first day of the month for `order_date`?"
    options: ["DATE_TRUNC(order_date, MONTH)", "MONTH(order_date)", "date(order_date, 'month')", "strftime('%Y-%m-01', order_date)"]
    answer: 3
    explain: "SQLite stores dates as text, so you format them. DATE_TRUNC is the BigQuery form."
  - q: "A BigQuery load has a few rows where `amount` is 'N/A'. Which keeps the query running and lets you count bad rows?"
    options: ["CAST(amount AS STRING)", "Delete the column", "SAFE_CAST(amount AS NUMERIC)", "CAST(amount AS NUMERIC)"]
    answer: 2
    explain: "SAFE_CAST returns NULL for values it cannot convert instead of failing the job."
recall:
  - q: "Show how you would clean a raw email column and bucket orders by size, and explain the rules CASE follows."
    keyPoints:
      - "TRIM then LOWER then NULLIF(…, '')"
      - "CASE is evaluated top to bottom"
      - "first matching WHEN wins"
      - "no ELSE means NULL"
      - "SAFE_CAST for dirty values"
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
