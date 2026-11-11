=== lesson
--- step concept: A CTE that calls itself
A recursive CTE has three parts:

```sql
WITH RECURSIVE chain AS (
  SELECT emp_id, name, manager_id, 0 AS depth      -- 1. anchor: where to start
  FROM employees WHERE manager_id IS NULL
  UNION ALL
  SELECT e.emp_id, e.name, e.manager_id, c.depth + 1 -- 2. recursive member: next level
  FROM employees e JOIN chain c ON e.manager_id = c.emp_id
)                                                   -- 3. stops when no new rows appear
SELECT * FROM chain;
```
The database runs the anchor once, then keeps running the recursive part on the **rows produced in the previous round** until a round returns nothing.

[[quiz:sql-recursive-cte:q0]]

--- step practice: Walk the org chart
[[exercise:sql-recursive-cte-1]]

--- step example: Generating a date spine
Recursion can also **generate** rows. A date spine lists every day in a range so missing days show up as 0 instead of disappearing:

```sql
WITH RECURSIVE days(d) AS (
  SELECT '2025-01-01'
  UNION ALL
  SELECT date(d, '+1 day') FROM days WHERE d < '2025-01-31'
)
SELECT days.d, COALESCE(s.revenue, 0) AS revenue
FROM days LEFT JOIN daily_sales s ON s.sale_date = days.d;
```
BigQuery has `GENERATE_DATE_ARRAY` for this, but the recursive pattern works everywhere.

--- step scenario: Fill the gaps
[[exercise:sql-recursive-cte-2]]

--- step check: Guard against infinite loops
A bad hierarchy (A manages B, B manages A) makes recursion run forever. Always add a stopping condition such as `WHERE depth < 20`, or track the visited path.

[[quiz:sql-recursive-cte:q1]]
[[quiz:sql-recursive-cte:q2]]

--- step interview: Explain it
[[recall:sql-recursive-cte:r0]]

=== detailed
## Anatomy
```sql
WITH RECURSIVE name (cols) AS (
  anchor_query              -- runs once
  UNION ALL
  recursive_query           -- references name; runs on the previous round's rows
)
SELECT ... FROM name;
```
- `UNION ALL` keeps duplicates and is faster; `UNION` removes duplicates and can stop cycles in some databases.
- The recursive member must **join to the CTE itself** and should eventually produce no rows.
- In BigQuery: `WITH RECURSIVE` is supported; there is an iteration limit (default 500).

## Use cases in data engineering
| Use case | Anchor | Recursive step |
|---|---|---|
| org hierarchy | the CEO (manager IS NULL) | employees whose manager is in the previous level |
| category tree | root categories | children of previous level |
| bill of materials | the finished product | its components |
| date spine | start date | previous date + 1 day, until end date |
| number series | 1 | n + 1, until limit |

## Carrying information down the tree
Add columns that accumulate:
```sql
c.depth + 1 AS depth,
c.path || ' > ' || e.name AS path
```
The path is also how you **detect cycles**: stop when `path LIKE '%' || e.name || '%'`.

## Date spines and gaps
Business reports need a row for every day, even days with no sales. Join facts **to** the spine with a `LEFT JOIN` so the spine drives the rows, and `COALESCE` missing measures to 0.

> [!REAL] Warehouses often have a permanent `dim_date` table instead of generating the spine every time. A recursive CTE is how you build it once.

## Pitfalls
- Forgetting the termination condition → the query hits the recursion limit or runs forever.
- Data cycles in hierarchies → add a depth limit or path check.
- Exploding row counts in graphs where a node has many parents.

=== crisp
A **recursive CTE** repeatedly applies a query to its own previous output until no new rows appear.
```sql
WITH RECURSIVE chain AS (
  SELECT emp_id, name, manager_id, 0 AS depth          -- anchor: starting rows
  FROM employees WHERE manager_id IS NULL
  UNION ALL
  SELECT e.emp_id, e.name, e.manager_id, c.depth + 1   -- recursive member: joins to previous level
  FROM employees e JOIN chain c ON e.manager_id = c.emp_id
)
SELECT * FROM chain;
```
- Anchor + `UNION ALL` + recursive member referencing the CTE.
- Stops when the recursive member returns no rows → add a guard (`WHERE depth < 20`) against cycles.
- **Date spine** (fill gaps for rolling metrics / reports with zero days):
```sql
WITH RECURSIVE days(d) AS (
  SELECT '2025-01-01' UNION ALL SELECT date(d, '+1 day') FROM days WHERE d < '2025-03-01'
) SELECT d FROM days;
```
- BigQuery alternative for dates: `UNNEST(GENERATE_DATE_ARRAY('2025-01-01', '2025-03-01'))`.

=== memory
- **"Anchor, then climb."**
- Trigger: *"org chart / bill of materials / folder tree"* → recursive CTE.
- Trigger: *"days with no sales are missing from the report"* → date spine + LEFT JOIN.

=== data
flashcards:
  - q: "Two parts of a recursive CTE?"
    a: "An anchor member (starting rows) and a recursive member that references the CTE, combined with UNION ALL."
  - q: "How do you protect a recursive CTE from cycles?"
    a: "Carry a depth/path column and stop at a maximum depth, or check the path for repeats."
  - q: "What is a date spine for?"
    a: "A complete list of dates to LEFT JOIN facts onto, so missing days appear with zeros."
quiz:
  - q: "A recursive CTE stops when…"
    options: ["it reaches 100 rows", "the recursive member returns no new rows", "the anchor is empty", "UNION removes duplicates"]
    answer: 1
  - q: "Which part of a recursive CTE runs only once?"
    options: ["the UNION ALL", "the anchor member", "the recursive member", "the final SELECT"]
    answer: 1
    explain: "The anchor seeds the result; the recursive member then runs repeatedly on the previous round's rows."
  - q: "You need one row for every day of March even when no sales happened. You should…"
    options: ["generate a date spine and LEFT JOIN sales to it", "INNER JOIN sales to a date spine", "GROUP BY sale_date", "use DISTINCT sale_date"]
    answer: 0
    explain: "The spine drives the rows; LEFT JOIN keeps days with no sales, and COALESCE turns their NULL revenue into 0."
recall:
  - q: "Explain how a recursive CTE works and give two data engineering uses."
    keyPoints:
      - "anchor member runs once"
      - "recursive member joins to the CTE"
      - "stops when a round returns no rows"
      - "hierarchies like org charts"
      - "date spines to fill gaps"
      - "guard against cycles with a depth limit"
exercises:
  - id: sql-recursive-cte-1
    lang: sql
    kind: coding
    difficulty: 3
    title: Org chart depth
    prompt: |
      Return every employee with their `depth` in the hierarchy (CEO = 0). Columns `emp_id`, `name`, `depth`. Order by depth, emp_id.
    starter: |
      WITH RECURSIVE chain AS (
        SELECT emp_id, name, 0 AS depth FROM employees WHERE manager_id IS NULL
        UNION ALL
        -- recursive member here
      )
      SELECT emp_id, name, depth FROM chain ORDER BY depth, emp_id;
    solution: |
      WITH RECURSIVE chain AS (
        SELECT emp_id, name, 0 AS depth FROM employees WHERE manager_id IS NULL
        UNION ALL
        SELECT e.emp_id, e.name, c.depth + 1 FROM employees e JOIN chain c ON e.manager_id = c.emp_id
      )
      SELECT emp_id, name, depth FROM chain ORDER BY depth, emp_id;
    ordered: true
    hints:
      - "Join employees whose manager_id is an emp_id already in chain."
  - id: sql-recursive-cte-2
    lang: sql
    kind: scenario
    difficulty: 3
    title: Fill the missing days
    prompt: |
      Store 1 has missing dates in `daily_sales`. Build a date spine from store 1's first to last sale_date and return `sale_date` and `revenue` (0 for missing days), ordered by date.
    starter: |
      WITH RECURSIVE bounds AS (
        SELECT MIN(sale_date) AS lo, MAX(sale_date) AS hi FROM daily_sales WHERE store_id = 1
      ),
      days(d) AS (
        -- anchor and recursion
      )
      SELECT
    solution: |
      WITH RECURSIVE bounds AS (
        SELECT MIN(sale_date) AS lo, MAX(sale_date) AS hi FROM daily_sales WHERE store_id = 1
      ),
      days(d) AS (
        SELECT lo FROM bounds
        UNION ALL
        SELECT date(d, '+1 day') FROM days, bounds WHERE d < hi
      )
      SELECT d AS sale_date, COALESCE(s.revenue, 0) AS revenue
      FROM days
      LEFT JOIN daily_sales s ON s.sale_date = d AND s.store_id = 1
      ORDER BY d;
    ordered: true
    hints:
      - "Anchor: the first date. Recursion: date(d, '+1 day') while d < last date."
      - "LEFT JOIN the sales and COALESCE revenue to 0."
interview:
  - q: "How would you report daily revenue including days with no sales?"
    type: coding
    level: 2
    keyPoints:
      - "generate a date spine (recursive CTE or GENERATE_DATE_ARRAY / calendar table)"
      - "LEFT JOIN facts to the spine"
      - "COALESCE missing values to zero"
      - "a dim_date table in the warehouse"
