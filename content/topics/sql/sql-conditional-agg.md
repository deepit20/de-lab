=== lesson
--- step concept: Count only the rows you care about
`GROUP BY` gives one row per group. **Conditional aggregation** puts a `CASE` *inside* the aggregate so one query returns many counts side by side:

```sql
SELECT channel,
       COUNT(*)                                            AS orders,
       SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled
FROM orders
GROUP BY channel;
```
Each row contributes 1 to `cancelled` only if it matches the condition.

> [!THINK] How would you get the cancelled count *and* the delivered count with only one scan of the table?

--- step practice: A status breakdown
[[exercise:sql-conditional-agg-1]]

--- step concept: Ratios without integer surprises
`AVG(CASE WHEN … THEN 1.0 ELSE 0 END)` is the **share** of rows matching a condition.

```sql
SELECT ROUND(100.0 * SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END) / COUNT(*), 1) AS return_pct
FROM orders;
```
> [!MISTAKE] `SUM(...) / COUNT(*)` with two integers is **integer division** in SQLite and many databases: 3 / 10 = 0. Multiply by `100.0` or `1.0` first.

[[quiz:sql-conditional-agg:q0]]
[[quiz:sql-conditional-agg:q1]]

--- step example: Pivot rows into columns
Values that live in rows (year 2024, year 2025) become columns:

```sql
SELECT category,
       SUM(CASE WHEN strftime('%Y', order_date) = '2024' THEN revenue ELSE 0 END) AS rev_2024,
       SUM(CASE WHEN strftime('%Y', order_date) = '2025' THEN revenue ELSE 0 END) AS rev_2025
FROM sales
GROUP BY category;
```
BigQuery also has a `PIVOT` operator, but the CASE pattern works in every database.

[[exercise:sql-conditional-agg-2]]

--- step check: Distinct counts with a condition
`COUNT(DISTINCT CASE WHEN status = 'delivered' THEN customer_id END)` counts customers with at least one delivered order — the CASE returns NULL for other rows and COUNT ignores NULLs.

[[quiz:sql-conditional-agg:q2]]

--- step interview: Explain it
[[recall:sql-conditional-agg:r0]]

=== detailed
## The pattern
```sql
AGG(CASE WHEN <condition> THEN <value> ELSE <neutral> END)
```
| Goal | Expression |
|---|---|
| count matching rows | `SUM(CASE WHEN c THEN 1 ELSE 0 END)` or `COUNT(CASE WHEN c THEN 1 END)` |
| sum matching values | `SUM(CASE WHEN c THEN amount ELSE 0 END)` |
| share of rows | `AVG(CASE WHEN c THEN 1.0 ELSE 0 END)` |
| distinct entities matching | `COUNT(DISTINCT CASE WHEN c THEN id END)` |
| min/max of matching | `MAX(CASE WHEN c THEN order_date END)` |

Postgres and BigQuery offer `COUNTIF(c)` (BigQuery) and `FILTER (WHERE c)` (Postgres) as shortcuts.

## Why it matters
- **One scan** instead of many queries joined together — cheaper in BigQuery, which bills by bytes scanned.
- Produces **report-shaped** output: one row per entity, one column per metric.
- It is how you build **feature tables** for analytics and ML (orders_last_30d, returns_last_30d…).

## Pivoting
Rows → columns needs a **known, fixed** list of output columns. If new categories appear every week, keep the data long (one row per category) and let the BI tool pivot.

## Pitfalls
- **Integer division:** cast or multiply by 1.0 before dividing.
- **Divide by zero:** `x / NULLIF(COUNT(*), 0)`.
- **ELSE NULL vs ELSE 0:** `SUM` of all NULLs is NULL, not 0. Use `ELSE 0` or wrap in `COALESCE`.
- **Filtering too early:** a `WHERE status = 'delivered'` removes the rows you wanted to count as cancelled. Put conditions inside the CASE instead.

> [!INTERVIEW] "Return per customer: number of orders, number of returns and return rate" is a classic screen question. Answer with one GROUP BY and three conditional aggregates.

=== crisp
**Conditional aggregation** = an aggregate over a CASE expression — several filtered metrics in **one pass**:
```sql
SELECT channel,
       COUNT(*)                                              AS orders,
       SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
       ROUND(100.0 * AVG(CASE WHEN status = 'cancelled' THEN 1.0 ELSE 0 END), 1) AS cancel_pct,
       SUM(CASE WHEN status = 'delivered' THEN amount END)   AS delivered_revenue
FROM orders GROUP BY channel;
```
- **Pivot** rows to columns: one `SUM(CASE WHEN category = 'X' THEN v END) AS x` per value.
- `COUNT(DISTINCT CASE WHEN cond THEN id END)` counts unique ids meeting a condition.
- BigQuery shortcuts: `COUNTIF(cond)`, `SUM(IF(cond, x, 0))`, `PIVOT` operator.
- Ratios: `100.0 * …` to avoid integer division; `NULLIF(den, 0)`.

=== memory
- **"One scan, many filters."**
- `AVG(CASE WHEN cond THEN 1.0 ELSE 0 END)` = share of rows meeting cond.

=== data
flashcards:
  - q: "How do you count cancelled orders per channel in one GROUP BY?"
    a: "SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)"
  - q: "How do you pivot categories into columns without PIVOT?"
    a: "One SUM(CASE WHEN category = 'X' THEN value END) AS x column per category."
  - q: "BigQuery shortcut for counting rows meeting a condition?"
    a: "COUNTIF(condition)"
quiz:
  - q: "`AVG(CASE WHEN status = 'returned' THEN 1.0 ELSE 0 END)` computes…"
    options: ["number of returns", "share of orders returned", "average returned amount", "error"]
    answer: 1
  - q: "In SQLite, `SELECT 3 / 10` returns…"
    options: ["0.3", "NULL", "error", "0"]
    answer: 3
    explain: "Both operands are integers, so the result is integer division. Use 3 * 1.0 / 10."
  - q: "`COUNT(DISTINCT CASE WHEN status = 'delivered' THEN customer_id END)` counts…"
    options: ["all customers", "orders that are not delivered", "customers with at least one delivered order", "delivered orders"]
    answer: 2
    explain: "Non-matching rows produce NULL, which COUNT ignores; DISTINCT removes duplicate customers."
recall:
  - q: "How do you count several different conditions per group in a single query, and what are the pitfalls?"
    keyPoints:
      - "SUM(CASE WHEN … THEN 1 ELSE 0 END)"
      - "one scan of the table"
      - "AVG of 1.0/0 gives a share"
      - "beware integer division"
      - "don't filter the rows out in WHERE"
      - "pivot needs a fixed list of columns"
exercises:
  - id: sql-conditional-agg-1
    lang: sql
    kind: coding
    difficulty: 2
    title: Status breakdown per channel
    prompt: |
      Per `channel` return `orders`, `delivered`, `cancelled`, `returned` (counts) and `cancel_pct` (cancelled / orders × 100, rounded 1). Order by channel.
    starter: |
      SELECT channel, COUNT(*) AS orders
      FROM orders
      GROUP BY channel
    solution: |
      SELECT channel, COUNT(*) AS orders,
             SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
             SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
             SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END) AS returned,
             ROUND(100.0 * SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) / COUNT(*), 1) AS cancel_pct
      FROM orders
      GROUP BY channel
      ORDER BY channel;
    ordered: true
    hints:
      - "SUM(CASE WHEN … THEN 1 ELSE 0 END) per status."
  - id: sql-conditional-agg-2
    lang: sql
    kind: coding
    difficulty: 2
    title: Pivot revenue by category and year
    prompt: |
      Return one row per `category` with delivered line revenue (`quantity * unit_price`) in two columns: `rev_2024` and `rev_2025` (rounded 2). Order by category.
    starter: |
      SELECT p.category
      FROM order_items oi
      JOIN orders o ON o.order_id = oi.order_id
      JOIN products p ON p.product_id = oi.product_id
    solution: |
      SELECT p.category,
             ROUND(SUM(CASE WHEN o.order_date < '2025-01-01' THEN oi.quantity * oi.unit_price ELSE 0 END), 2) AS rev_2024,
             ROUND(SUM(CASE WHEN o.order_date >= '2025-01-01' THEN oi.quantity * oi.unit_price ELSE 0 END), 2) AS rev_2025
      FROM order_items oi
      JOIN orders o ON o.order_id = oi.order_id
      JOIN products p ON p.product_id = oi.product_id
      WHERE o.status = 'delivered'
      GROUP BY p.category
      ORDER BY p.category;
    ordered: true
    hints:
      - "One SUM(CASE …) per year column."
interview:
  - q: "How would you compute several differently-filtered metrics in a single query efficiently?"
    type: concept
    level: 2
    keyPoints:
      - "conditional aggregation with CASE inside aggregates"
      - "single scan instead of multiple queries"
      - "COUNTIF / SUM(IF()) in BigQuery"
      - "pivot pattern"
