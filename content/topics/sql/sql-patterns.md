=== lesson
--- step concept: Interview problems have shapes
Most SQL interview questions are variations of a handful of patterns. Recognise the shape, and the solution follows:

| Pattern | Signal in the question | Core tool |
|---|---|---|
| Top-N per group | "top 3 … per …", "highest in each" | ROW_NUMBER / DENSE_RANK |
| Latest record | "most recent", "current" | ROW_NUMBER … = 1 |
| Running / cumulative | "cumulative", "running", "to date" | SUM() OVER (ORDER BY) |
| Period over period | "growth", "vs last month", "YoY" | LAG |
| Gaps & islands | "consecutive", "streak", "missing dates" | ROW_NUMBER difference trick |
| Sessionisation | "sessions", "inactive for 30 min" | LAG + running SUM of flags |
| Funnel / conversion | "% who viewed then bought" | conditional aggregation |

[[quiz:sql-patterns:q0]]

--- step example: Gaps and islands
Consecutive dates share a constant: `date − row_number`. Each streak (island) gets its own constant:
```sql
WITH d AS (
  SELECT store_id, sale_date,
         julianday(sale_date) - ROW_NUMBER() OVER (PARTITION BY store_id ORDER BY sale_date) AS grp
  FROM daily_sales
)
SELECT store_id, MIN(sale_date) AS start_date, MAX(sale_date) AS end_date, COUNT(*) AS days
FROM d GROUP BY store_id, grp ORDER BY store_id, start_date;
```

[[exercise:sql-patterns-1]]

--- step practice: Sessionise clickstream
A new session starts when the gap since the user's previous event is **more than 30 minutes**.
1. Flag: `CASE WHEN prev IS NULL OR gap > 30 min THEN 1 ELSE 0 END`
2. Session number: running `SUM(flag)` per user.

[[exercise:sql-patterns-2]]

--- step practice: Month-over-month growth
[[exercise:sql-patterns-3]]

--- step challenge: Funnel conversion
[[exercise:sql-patterns-4]]
[[recall:sql-patterns:r0]]

=== detailed
## How to approach any SQL interview problem
1. **Restate** the question and the expected output (columns + grain). Ask about ties, NULLs, time zones, duplicates.
2. **Identify the pattern.**
3. **Build in CTE steps**, checking each intermediate grain.
4. **Edge cases**: empty groups, ties, first row (LAG is NULL), division by zero.
5. **Talk about performance** if relevant (partitions, indexes, scale).

## Top-N per group
`ROW_NUMBER() OVER (PARTITION BY g ORDER BY metric DESC, tiebreak) <= N` — exactly N. Use `DENSE_RANK` if ties should all be included. Ask which the interviewer wants.

## Gaps and islands
- **Islands** (streaks): `value - ROW_NUMBER()` is constant within a run of consecutive values (dates via `julianday`/`DATE_DIFF`). Group by it.
- **Gaps** (missing values): `LEAD(date) - date > 1`, or anti-join against a generated date spine (recursive CTE / `GENERATE_DATE_ARRAY` in BigQuery).

## Sessionisation
```sql
WITH e AS (
  SELECT *, LAG(event_time) OVER (PARTITION BY user_id ORDER BY event_time) AS prev
  FROM web_events
), f AS (
  SELECT *, CASE WHEN prev IS NULL OR (julianday(event_time) - julianday(prev)) * 1440 > 30 THEN 1 ELSE 0 END AS new_session
  FROM e
)
SELECT *, SUM(new_session) OVER (PARTITION BY user_id ORDER BY event_time ROWS UNBOUNDED PRECEDING) AS session_no FROM f;
```

## Period-over-period
Aggregate to the period first, then `LAG(metric) OVER (ORDER BY period)`; growth `% = 100.0 * (cur - prev) / NULLIF(prev, 0)`. For YoY use `LAG(metric, 12)` on monthly data — **only if no months are missing**; safer is a self join on `period = prev_period + 12 months`.

## Funnels
Per user (or session) compute flags with conditional aggregation, then aggregate the flags:
```sql
WITH u AS (
  SELECT user_id,
         MAX(event_type = 'page_view')   AS viewed,
         MAX(event_type = 'add_to_cart') AS carted,
         MAX(event_type = 'purchase')    AS bought
  FROM web_events GROUP BY user_id
)
SELECT SUM(viewed), SUM(carted), SUM(bought), ROUND(100.0 * SUM(bought) / SUM(viewed), 1) AS conv_pct FROM u;
```
Strict funnels also require ordering (view **before** cart **before** purchase) — compare `MIN(event_time)` per step.

## Other classics
- Second highest value: `DENSE_RANK() = 2`, or `MAX(x) WHERE x < (SELECT MAX(x) …)`.
- Duplicates: `GROUP BY key HAVING COUNT(*) > 1`.
- Cumulative share / Pareto: `SUM(x) OVER (ORDER BY x DESC) / SUM(x) OVER ()`.
- Median: `PERCENTILE_CONT(0.5) WITHIN GROUP` / BigQuery `APPROX_QUANTILES(x, 2)[OFFSET(1)]`.
- Pivot: conditional aggregation `SUM(CASE WHEN … THEN … END)`.

=== crisp
- Restate → pattern → CTE steps → edge cases → performance.
- Top-N: ROW_NUMBER ≤ N (exact) / DENSE_RANK ≤ N (ties).
- Latest: ROW_NUMBER … ORDER BY ts DESC = 1.
- Islands: `day_number − ROW_NUMBER()` constant per streak → GROUP BY it.
- Gaps: `LEAD(d) − d > 1` or anti-join a date spine.
- Sessions: LAG gap > threshold → flag 1 → running SUM(flag) = session id.
- MoM/YoY: aggregate first, then LAG; `% = (cur−prev)/NULLIF(prev,0)`.
- Funnel: per-user MAX(condition) flags → SUM flags.

=== memory
- **Islands trick:** "dates minus row numbers stay still while the streak lasts."
- **Sessions:** "flag the gaps, then count the flags."
- **Funnel:** "flag per user, sum the flags."
- Trigger words: *consecutive* → islands; *inactive for* → sessions; *each/per … top* → ROW_NUMBER.

=== data
flashcards:
  - q: "What is the gaps-and-islands trick?"
    a: "For consecutive values, value − ROW_NUMBER() is constant within each streak; group by that difference."
  - q: "How do you sessionise events with a 30-minute timeout?"
    a: "LAG the previous timestamp per user, flag a new session when the gap > 30 min (or first event), then running SUM of the flags."
  - q: "Formula for percent growth that avoids division by zero?"
    a: "100.0 * (cur − prev) / NULLIF(prev, 0)"
  - q: "Why is LAG(x, 12) risky for YoY on monthly data?"
    a: "If any month is missing, 12 rows back is not 12 months back."
quiz:
  - q: "'Find each user's longest streak of consecutive login days' is which pattern?"
    options: ["Top-N per group", "Gaps and islands", "Funnel", "Pivot"]
    answer: 1
recall:
  - q: "Explain the gaps-and-islands technique and when you would use it."
    keyPoints:
      - "consecutive sequences of dates or numbers"
      - "row number over ordered values"
      - "value minus row number constant within a streak"
      - "group by the difference"
      - "min and max give start and end"
exercises:
  - id: sql-patterns-1
    lang: sql
    kind: coding
    difficulty: 3
    title: Streaks of consecutive sales days
    prompt: |
      `daily_sales` has some missing dates. For each store, return every **streak of consecutive dates**: `store_id`, `start_date`, `end_date`, `days`. Order by store_id, start_date.
    starter: |
      WITH d AS (
        SELECT store_id, sale_date
        FROM daily_sales
      )
      SELECT
    solution: |
      WITH d AS (
        SELECT store_id, sale_date,
               julianday(sale_date) - ROW_NUMBER() OVER (PARTITION BY store_id ORDER BY sale_date) AS grp
        FROM daily_sales
      )
      SELECT store_id, MIN(sale_date) AS start_date, MAX(sale_date) AS end_date, COUNT(*) AS days
      FROM d
      GROUP BY store_id, grp
      ORDER BY store_id, start_date;
    ordered: true
    hints:
      - "Compute julianday(sale_date) − ROW_NUMBER() per store."
      - "Group by store and that difference."
  - id: sql-patterns-2
    lang: sql
    kind: coding
    difficulty: 3
    title: Count sessions per user
    prompt: |
      Sessionise `web_events`: a new session starts on a user's first event or when more than **30 minutes** passed since their previous event. Return `user_id` and `sessions` (number of sessions) for users **1–10**, ordered by user_id.

      Minutes between timestamps in SQLite: `(julianday(a) - julianday(b)) * 1440`.
    starter: |
      WITH e AS (
        SELECT user_id, event_time,
               LAG(event_time) OVER (PARTITION BY user_id ORDER BY event_time) AS prev_time
        FROM web_events
        WHERE user_id BETWEEN 1 AND 10
      )
      SELECT
    solution: |
      WITH e AS (
        SELECT user_id, event_time,
               LAG(event_time) OVER (PARTITION BY user_id ORDER BY event_time) AS prev_time
        FROM web_events
        WHERE user_id BETWEEN 1 AND 10
      ),
      f AS (
        SELECT user_id,
               CASE WHEN prev_time IS NULL OR (julianday(event_time) - julianday(prev_time)) * 1440 > 30 THEN 1 ELSE 0 END AS new_session
        FROM e
      )
      SELECT user_id, SUM(new_session) AS sessions
      FROM f
      GROUP BY user_id
      ORDER BY user_id;
    ordered: true
    hints:
      - "Flag 1 when prev_time is NULL or the gap exceeds 30 minutes."
      - "The number of sessions = the sum of the flags per user."
  - id: sql-patterns-3
    lang: sql
    kind: coding
    difficulty: 3
    title: Month-over-month revenue growth
    prompt: |
      For delivered orders, return `month` (YYYY-MM), `revenue` (rounded 2), `prev_revenue` (rounded 2) and `growth_pct` (rounded 1; NULL for the first month). Order by month.
    starter: |
      WITH monthly AS (
        SELECT strftime('%Y-%m', order_date) AS month, SUM(amount) AS revenue
        FROM orders
        WHERE status = 'delivered'
        GROUP BY month
      )
      SELECT
    solution: |
      WITH monthly AS (
        SELECT strftime('%Y-%m', order_date) AS month, SUM(amount) AS revenue
        FROM orders
        WHERE status = 'delivered'
        GROUP BY month
      )
      SELECT month,
             ROUND(revenue, 2) AS revenue,
             ROUND(LAG(revenue) OVER (ORDER BY month), 2) AS prev_revenue,
             ROUND(100.0 * (revenue - LAG(revenue) OVER (ORDER BY month)) / NULLIF(LAG(revenue) OVER (ORDER BY month), 0), 1) AS growth_pct
      FROM monthly
      ORDER BY month;
    ordered: true
    hints:
      - "Aggregate to months first, then LAG over month."
      - "100.0 * (cur − prev) / NULLIF(prev, 0)"
  - id: sql-patterns-4
    lang: sql
    kind: scenario
    difficulty: 3
    title: Purchase funnel
    prompt: |
      Build a per-user funnel from `web_events` and return **one row**: `viewers` (users with a page_view), `carters` (users with add_to_cart), `buyers` (users with a purchase), and `view_to_buy_pct` (buyers / viewers × 100, rounded 1).
    starter: |
      WITH u AS (
        SELECT user_id
        FROM web_events
        GROUP BY user_id
      )
      SELECT
    solution: |
      WITH u AS (
        SELECT user_id,
               MAX(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS viewed,
               MAX(CASE WHEN event_type = 'add_to_cart' THEN 1 ELSE 0 END) AS carted,
               MAX(CASE WHEN event_type = 'purchase' THEN 1 ELSE 0 END) AS bought
        FROM web_events
        GROUP BY user_id
      )
      SELECT SUM(viewed) AS viewers, SUM(carted) AS carters, SUM(bought) AS buyers,
             ROUND(100.0 * SUM(bought) / NULLIF(SUM(viewed), 0), 1) AS view_to_buy_pct
      FROM u;
    hints:
      - "One row per user with 0/1 flags using MAX(CASE …)."
      - "Then SUM the flags."
interview:
  - q: "Given a table of user logins (user_id, login_date), find each user's longest streak of consecutive days."
    type: coding
    level: 3
    keyPoints:
      - "deduplicate to one row per user per day"
      - "row_number per user ordered by date"
      - "date minus row number identifies islands"
      - "group by user and island, count days"
      - "take max per user"
    followUps:
      - "How would you handle time zones?"
      - "How does this scale to billions of rows?"
  - q: "How would you sessionise clickstream data in SQL?"
    type: coding
    level: 3
    keyPoints:
      - "LAG previous event timestamp per user"
      - "flag new session when gap exceeds threshold"
      - "running sum of flags gives session id"
      - "partition by user order by time"
