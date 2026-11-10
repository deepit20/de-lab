=== lesson
--- step concept: Grain — the most important word in analytics
Aggregation collapses many rows into one row **per group**. Before writing any GROUP BY, answer: *"one output row per what?"* That is the **grain** of your result.

```sql
-- grain: one row per channel
SELECT channel, COUNT(*) AS orders, SUM(amount) AS revenue
FROM orders
GROUP BY channel;
```
Rule: every column in SELECT must be either **in GROUP BY** or **inside an aggregate**.

[[quiz:sql-aggregation:q0]]

--- step example: WHERE vs HAVING
```sql
SELECT customer_id, COUNT(*) AS orders, ROUND(SUM(amount), 2) AS revenue
FROM orders
WHERE status <> 'cancelled'      -- filters ROWS before grouping
GROUP BY customer_id
HAVING COUNT(*) >= 10            -- filters GROUPS after grouping
ORDER BY revenue DESC;
```

--- step practice: Revenue by channel
[[exercise:sql-aggregation-1]]

--- step check: Grouping by a derived value
You can group by an expression — e.g. the month of a date: `strftime('%Y-%m', order_date)` in SQLite (`FORMAT_DATE('%Y-%m', d)` or `DATE_TRUNC(d, MONTH)` in BigQuery).

[[exercise:sql-aggregation-2]]

--- step challenge: Filtering groups
[[exercise:sql-aggregation-3]]

--- step scenario: Grain mismatch
> [!REAL] Joining `orders` to `order_items` multiplies each order by its number of items. Summing `orders.amount` after that join **double counts** revenue. Always check the grain before you aggregate.

[[exercise:sql-aggregation-4]]
[[recall:sql-aggregation:r0]]

=== detailed
## What aggregation does
An aggregate function turns a set of values into one value: `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`, plus engine-specific ones (`STRING_AGG`, `ARRAY_AGG`, `APPROX_COUNT_DISTINCT`). `GROUP BY` defines the sets.

## Grain
The **grain** of a table or result is what one row represents: "one row per order", "one row per customer per day". Most analytics bugs are grain bugs:
- aggregating at the wrong grain (averaging daily averages instead of the raw values),
- joining tables of different grains and summing the "one" side (fan-out double counting),
- grouping by a column that is not actually unique for the entity (two customers with the same name).

> [!TIP] Write the grain as a comment at the top of every query/model: `-- grain: one row per customer per month`.

## The GROUP BY rule
Every non-aggregated SELECT expression must appear in GROUP BY. (SQLite and MySQL allow "bare" columns and return an arbitrary row's value — a trap. BigQuery and Postgres reject it.)

## WHERE vs HAVING
| | WHERE | HAVING |
|---|---|---|
| Runs | before grouping | after grouping |
| Filters | rows | groups |
| Can use aggregates | no | yes |
| Performance | reduces data early | applied to grouped output |

Put row filters in WHERE even if HAVING would accept them — less data reaches the grouping step.

## Aggregates and NULLs
`COUNT(*)` counts rows; `COUNT(x)` counts non-null x; `SUM/AVG/MIN/MAX` ignore NULL; `SUM` over zero rows returns NULL (wrap with `COALESCE(SUM(x), 0)` when you need 0).

## Counting distinct
`COUNT(DISTINCT customer_id)` — exact but expensive at scale (requires de-duplication across the cluster). BigQuery's `APPROX_COUNT_DISTINCT` (HyperLogLog) is ~1% error and much cheaper — a classic trade-off question.

## Averages of averages
The average of per-group averages ≠ the overall average unless the groups are equal-sized. Compute ratios from summed numerators and denominators: `SUM(revenue) / SUM(orders)`.

## Integer division
In SQLite and many engines `5 / 2 = 2`. Multiply by `1.0` or `CAST(... AS REAL)` first. BigQuery's `/` always returns FLOAT64 (use `DIV` for integer division) — know your engine.

## Performance considerations
- Grouping requires a hash or sort; on distributed systems it triggers a **shuffle** (rows with the same key must meet on one worker).
- High-cardinality GROUP BY (e.g. by user_id over billions of rows) is expensive; pre-aggregate in incremental models.
- Filter first (WHERE, partition filters) to shrink the input.

## Common mistakes
> [!MISTAKE] Summing a header-level amount after joining to a line-level table.

> [!MISTAKE] `AVG(daily_avg)` instead of `SUM(total)/SUM(count)`.

> [!MISTAKE] Grouping by `name` instead of the key `customer_id`.

## Interview questions
- What is the difference between WHERE and HAVING?
- What is grain, and why does it matter when joining?
- How would you count unique users across billions of events cheaply?

=== crisp
- Decide the **grain** first: "one row per ___".
- SELECT columns: in GROUP BY **or** inside an aggregate.
- WHERE filters rows (before), HAVING filters groups (after; can use aggregates).
- `COUNT(*)` rows · `COUNT(col)` non-null · `COUNT(DISTINCT col)` unique non-null.
- SUM over no rows = NULL → `COALESCE(SUM(x),0)`.
- Ratio of sums, not average of averages.
- Integer division: `1.0 * a / b`.
- Joining to a finer grain then summing the coarser table → double counting.
- Large distinct counts → `APPROX_COUNT_DISTINCT` (BigQuery) trades accuracy for cost.

=== memory
- **"Rows in WHERE, groups in HAVING."**
- **Grain check:** "If I join this, does any row on my side get repeated?"
- Trigger: *"revenue too high after join"* → fan-out.
- Trigger: *"average looks off"* → average of averages / integer division.

=== data
flashcards:
  - q: "What is the 'grain' of a table?"
    a: "What one row represents, e.g. one row per order per day."
  - q: "WHERE vs HAVING?"
    a: "WHERE filters rows before grouping; HAVING filters groups after aggregation and can use aggregates."
  - q: "What does SUM return over zero rows?"
    a: "NULL — use COALESCE(SUM(x), 0) if you need 0."
  - q: "Why is AVG of daily averages usually wrong?"
    a: "Days with few rows weigh the same as busy days; compute SUM(total)/SUM(count)."
  - q: "What does joining orders to order_items do to orders.amount?"
    a: "Repeats it once per item → summing it double counts revenue."
quiz:
  - q: "Which query is invalid in strict SQL (BigQuery/Postgres)?"
    options:
      - "SELECT channel, COUNT(*) FROM orders GROUP BY channel"
      - "SELECT channel, status, COUNT(*) FROM orders GROUP BY channel"
      - "SELECT channel, MAX(amount) FROM orders GROUP BY channel"
      - "SELECT COUNT(*) FROM orders"
    answer: 1
    explain: "`status` is neither grouped nor aggregated."
  - q: "You need customers with more than 10 orders. Where does `COUNT(*) > 10` go?"
    options: ["WHERE", "HAVING", "ORDER BY", "SELECT"]
    answer: 1
recall:
  - q: "What is grain, and how can ignoring it produce wrong numbers?"
    keyPoints:
      - "grain is what one row represents"
      - "decide output grain before grouping"
      - "joining to a finer grain duplicates rows"
      - "summing duplicated values double counts"
      - "aggregate before joining or at the right level"
exercises:
  - id: sql-aggregation-1
    lang: sql
    kind: coding
    difficulty: 1
    title: Revenue by channel
    prompt: |
      For orders that are **not cancelled**, return per `channel`: `orders` (count) and `revenue` (sum of amount, rounded to 2 decimals). Highest revenue first.
    starter: |
      SELECT channel
      FROM orders
    solution: |
      SELECT channel, COUNT(*) AS orders, ROUND(SUM(amount), 2) AS revenue
      FROM orders
      WHERE status <> 'cancelled'
      GROUP BY channel
      ORDER BY revenue DESC;
    ordered: true
    hints:
      - "Row filter (not cancelled) belongs in WHERE."
      - "GROUP BY channel; use COUNT(*) and ROUND(SUM(amount), 2)."
  - id: sql-aggregation-2
    lang: sql
    kind: coding
    difficulty: 2
    title: Monthly revenue in 2025
    prompt: |
      Return `month` (format `YYYY-MM`), `orders` and `revenue` (rounded 2) for **delivered** orders placed in **2025**, in month order. In SQLite: `strftime('%Y-%m', order_date)`.
    starter: |
      SELECT strftime('%Y-%m', order_date) AS month
      FROM orders
    solution: |
      SELECT strftime('%Y-%m', order_date) AS month, COUNT(*) AS orders, ROUND(SUM(amount), 2) AS revenue
      FROM orders
      WHERE status = 'delivered' AND order_date >= '2025-01-01' AND order_date < '2026-01-01'
      GROUP BY month
      ORDER BY month;
    ordered: true
    hints:
      - "Filter the year with a range on order_date."
      - "Group by the month expression (or its alias — SQLite allows it)."
  - id: sql-aggregation-3
    lang: sql
    kind: coding
    difficulty: 2
    title: Loyal customers
    prompt: |
      Find customers with **at least 15 non-cancelled orders**. Return `customer_id`, `orders`, `avg_order_value` (rounded to 2). Order by `orders` desc, then `customer_id`.
    starter: |
      SELECT customer_id
      FROM orders
    solution: |
      SELECT customer_id, COUNT(*) AS orders, ROUND(AVG(amount), 2) AS avg_order_value
      FROM orders
      WHERE status <> 'cancelled'
      GROUP BY customer_id
      HAVING COUNT(*) >= 15
      ORDER BY orders DESC, customer_id;
    ordered: true
    hints:
      - "Which filter applies to rows, which to groups?"
      - "HAVING COUNT(*) >= 15"
  - id: sql-aggregation-4
    lang: sql
    kind: debug
    difficulty: 2
    title: "Debug: revenue is too high"
    prompt: |
      This query is meant to show **total delivered revenue per category**, but the numbers are inflated. Find the grain problem and fix it. Return `category`, `revenue` (rounded 2), highest first. Revenue of a line = `quantity * unit_price`.
    starter: |
      SELECT p.category, ROUND(SUM(o.amount), 2) AS revenue
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.order_id
      JOIN products p ON p.product_id = oi.product_id
      WHERE o.status = 'delivered'
      GROUP BY p.category
      ORDER BY revenue DESC;
    solution: |
      SELECT p.category, ROUND(SUM(oi.quantity * oi.unit_price), 2) AS revenue
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.order_id
      JOIN products p ON p.product_id = oi.product_id
      WHERE o.status = 'delivered'
      GROUP BY p.category
      ORDER BY revenue DESC;
    ordered: true
    hints:
      - "What is the grain after joining to order_items?"
      - "o.amount is an order-level total repeated for every item of that order."
      - "Sum a line-level measure instead."
    explain: |
      After the join the grain is **one row per order line**. `o.amount` is the whole order's total, repeated on every line — so a 3-item order contributes its total three times, and to the wrong categories. Aggregate the measure that lives at the joined grain: `quantity * unit_price`.
interview:
  - q: "What is the difference between WHERE and HAVING? When would you use each?"
    type: concept
    level: 1
    keyPoints:
      - "WHERE filters rows before grouping"
      - "HAVING filters groups after aggregation"
      - "HAVING can use aggregate functions"
      - "put row filters in WHERE for performance"
  - q: "Your dashboard revenue doubled after someone added a join. How do you investigate?"
    type: scenario
    level: 2
    keyPoints:
      - "check the grain of each table"
      - "one-to-many join causing fan-out"
      - "compare row counts before and after the join"
      - "aggregate before joining or sum a measure at the joined grain"
      - "add a test reconciling totals with the source"
