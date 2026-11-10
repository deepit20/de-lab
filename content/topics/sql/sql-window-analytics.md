=== lesson
--- step concept: Looking at neighbouring rows
`LAG(col, n)` reads the value *n* rows **before** the current row in the window order; `LEAD` reads *after*.
```sql
SELECT sale_date, revenue,
       LAG(revenue) OVER (ORDER BY sale_date) AS prev_revenue,
       revenue - LAG(revenue) OVER (ORDER BY sale_date) AS change
FROM daily_sales WHERE store_id = 1;
```
Typical uses: day-over-day change, time between events, detecting status transitions.

[[quiz:sql-window-analytics:q0]]

--- step practice: Day-over-day change
[[exercise:sql-window-analytics-1]]

--- step concept: Running totals and frames
Aggregates become running calculations when given an ORDER BY inside OVER:
```sql
SUM(revenue) OVER (PARTITION BY store_id ORDER BY sale_date
                   ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total,
AVG(revenue) OVER (PARTITION BY store_id ORDER BY sale_date
                   ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)         AS avg_7_rows
```
The **frame** says which rows around the current one are included.

> [!WARN] With ORDER BY but no frame, the default is `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` — rows with the **same** ORDER BY value are all included (ties jump together). Use `ROWS` when you mean physical rows.

[[quiz:sql-window-analytics:q1]]
[[exercise:sql-window-analytics-2]]

--- step challenge: Rolling average
[[exercise:sql-window-analytics-3]]

--- step scenario: Time between orders
[[exercise:sql-window-analytics-4]]
[[recall:sql-window-analytics:r0]]

=== detailed
## Offset functions
| Function | Returns |
|---|---|
| `LAG(x, n, default)` | x from n rows earlier in the partition |
| `LEAD(x, n, default)` | x from n rows later |
| `FIRST_VALUE(x)` / `LAST_VALUE(x)` | first/last value in the frame |
| `NTH_VALUE(x, n)` | nth value in the frame |

> [!MISTAKE] `LAST_VALUE(x) OVER (ORDER BY d)` returns the **current** row's value, because the default frame ends at the current row. Use `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`.

## Aggregate windows
`SUM / AVG / COUNT / MIN / MAX … OVER (…)`:
- no ORDER BY → aggregate over the whole partition (e.g. share of total: `amount / SUM(amount) OVER (PARTITION BY customer_id)`),
- with ORDER BY → running aggregate up to the current row.

## Frames
```
ROWS  BETWEEN <start> AND <end>
RANGE BETWEEN <start> AND <end>
start/end: UNBOUNDED PRECEDING | n PRECEDING | CURRENT ROW | n FOLLOWING | UNBOUNDED FOLLOWING
```
- **ROWS** counts physical rows.
- **RANGE** uses value distance from the current row's ORDER BY value (ties are peers; with dates in BigQuery you can use `RANGE BETWEEN 6 PRECEDING` on a numeric day value).

> [!REAL] A "7-day rolling average" with `ROWS 6 PRECEDING` is only correct if there is **exactly one row per day**. If days are missing (gaps), you get 7 *rows*, not 7 *days*. Fill gaps with a date spine first, or use a RANGE frame on a date number.

## Patterns
- Period-over-period: `x - LAG(x) OVER (PARTITION BY k ORDER BY period)`
- Percent change: `100.0 * (x - LAG(x)) / NULLIF(LAG(x), 0)`
- Running total / cumulative share
- Sessionisation: `LAG(event_time)` → gap > 30 min marks a new session → running SUM of the flags = session number
- Status change detection: `status <> LAG(status)`

## Performance
Same as ranking windows: sort per partition; avoid a single huge partition. Several windows with the **same** OVER clause share one sort — define a named window (`WINDOW w AS (…)`) where supported.

## Interview questions
- How do you compute a running total? A 7-day moving average?
- What is the difference between ROWS and RANGE?
- How would you find the time between consecutive orders per customer?

=== crisp
- `LAG(x)` previous row · `LEAD(x)` next row (within partition, by ORDER BY).
- Running total: `SUM(x) OVER (PARTITION BY k ORDER BY d ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)`.
- Moving avg (7 rows): `AVG(x) OVER (… ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)` — needs one row per day.
- Default frame with ORDER BY = RANGE … CURRENT ROW → ties included. Prefer explicit ROWS.
- `LAST_VALUE` needs a frame to UNBOUNDED FOLLOWING.
- Share of total: `x / SUM(x) OVER (PARTITION BY k)`.
- % change: `(x - LAG(x)) / NULLIF(LAG(x), 0)`.

=== memory
- **LAG looks back, LEAD looks ahead.**
- **"Frames are the window's walls."**
- Trigger: *"rolling 7-day avg looks wrong"* → missing days, ROWS vs RANGE.
- Trigger: *"LAST_VALUE returns the same value"* → default frame.

=== data
flashcards:
  - q: "What does LAG(revenue) OVER (ORDER BY sale_date) return on the first row?"
    a: "NULL (no previous row), unless a default is given: LAG(revenue, 1, 0)."
  - q: "Write the frame for a running total."
    a: "ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW"
  - q: "ROWS vs RANGE?"
    a: "ROWS counts physical rows; RANGE includes rows whose ORDER BY value is within the range (ties are peers)."
  - q: "Why might a 7-row moving average not be a 7-day average?"
    a: "If some days are missing, 7 rows span more than 7 days. Fill gaps with a date spine."
  - q: "Why does LAST_VALUE often return the current row's value?"
    a: "The default frame ends at the CURRENT ROW."
quiz:
  - q: "Which computes each order's amount minus the customer's previous order amount?"
    options:
      - "amount - LAG(amount) OVER (ORDER BY order_date)"
      - "amount - LAG(amount) OVER (PARTITION BY customer_id ORDER BY order_date)"
      - "amount - LEAD(amount) OVER (PARTITION BY customer_id)"
      - "amount - MAX(amount) OVER (PARTITION BY customer_id)"
    answer: 1
  - q: "`SUM(x) OVER (ORDER BY d)` with two rows on the same date d gives…"
    options:
      - "different running totals for the two rows"
      - "the same running total for both (RANGE default includes peers)"
      - "an error"
      - "NULL"
    answer: 1
recall:
  - q: "How would you calculate a 7-day moving average of daily revenue, and what can go wrong?"
    keyPoints:
      - "AVG over ORDER BY date"
      - "ROWS BETWEEN 6 PRECEDING AND CURRENT ROW"
      - "partition by store if several stores"
      - "missing days make rows not equal days"
      - "fill gaps with a date spine or use RANGE"
exercises:
  - id: sql-window-analytics-1
    lang: sql
    kind: coding
    difficulty: 2
    title: Day-over-day revenue change
    prompt: |
      For **store 1**, return `sale_date`, `revenue`, `prev_revenue` (previous row's revenue) and `change` (`revenue - prev_revenue`, rounded 2) in date order.
    starter: |
      SELECT sale_date, revenue
      FROM daily_sales
      WHERE store_id = 1
    solution: |
      SELECT sale_date, revenue,
             LAG(revenue) OVER (ORDER BY sale_date) AS prev_revenue,
             ROUND(revenue - LAG(revenue) OVER (ORDER BY sale_date), 2) AS change
      FROM daily_sales
      WHERE store_id = 1
      ORDER BY sale_date;
    ordered: true
    hints:
      - "LAG(revenue) OVER (ORDER BY sale_date)"
  - id: sql-window-analytics-2
    lang: sql
    kind: coding
    difficulty: 2
    title: Running revenue per store
    prompt: |
      Return `store_id`, `sale_date`, `revenue`, `running_revenue` (cumulative revenue per store in date order, rounded 2). Order by store_id, sale_date.
    starter: |
      SELECT store_id, sale_date, revenue
      FROM daily_sales
    solution: |
      SELECT store_id, sale_date, revenue,
             ROUND(SUM(revenue) OVER (PARTITION BY store_id ORDER BY sale_date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW), 2) AS running_revenue
      FROM daily_sales
      ORDER BY store_id, sale_date;
    ordered: true
    hints:
      - "PARTITION BY store_id ORDER BY sale_date"
      - "Make the frame explicit with ROWS."
  - id: sql-window-analytics-3
    lang: sql
    kind: coding
    difficulty: 3
    title: 3-row moving average
    prompt: |
      For all stores, return `store_id`, `sale_date`, `revenue`, and `ma_3` — the average of the current and two previous rows of that store (rounded 2). Order by store_id, sale_date.
    starter: |
      SELECT store_id, sale_date, revenue
      FROM daily_sales
    solution: |
      SELECT store_id, sale_date, revenue,
             ROUND(AVG(revenue) OVER (PARTITION BY store_id ORDER BY sale_date ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 2) AS ma_3
      FROM daily_sales
      ORDER BY store_id, sale_date;
    ordered: true
    hints:
      - "ROWS BETWEEN 2 PRECEDING AND CURRENT ROW"
    explain: |
      `daily_sales` has missing dates, so some 3-row windows span more than 3 days. In production you would join to a date spine first — see the recursive CTE topic.
  - id: sql-window-analytics-4
    lang: sql
    kind: scenario
    difficulty: 3
    title: Days between orders
    prompt: |
      For customers **1 to 5**, list each order with `customer_id`, `order_id`, `order_date`, and `days_since_prev` — days since that customer's previous order (NULL for their first). In SQLite: `julianday(a) - julianday(b)`. Order by customer_id, order_date, order_id.
    starter: |
      SELECT customer_id, order_id, order_date
      FROM orders
      WHERE customer_id BETWEEN 1 AND 5
    solution: |
      SELECT customer_id, order_id, order_date,
             CAST(julianday(order_date) - julianday(LAG(order_date) OVER (PARTITION BY customer_id ORDER BY order_date, order_id)) AS INTEGER) AS days_since_prev
      FROM orders
      WHERE customer_id BETWEEN 1 AND 5
      ORDER BY customer_id, order_date, order_id;
    ordered: true
    hints:
      - "LAG(order_date) per customer."
      - "Subtract with julianday() and CAST to INTEGER."
interview:
  - q: "How do you compute a running total and a moving average in SQL? What is the difference between ROWS and RANGE frames?"
    type: concept
    level: 2
    keyPoints:
      - "SUM over ORDER BY with frame unbounded preceding to current row"
      - "AVG with ROWS BETWEEN n PRECEDING AND CURRENT ROW"
      - "ROWS counts physical rows"
      - "RANGE treats ties as peers / value based"
      - "gaps in dates affect row-based windows"
