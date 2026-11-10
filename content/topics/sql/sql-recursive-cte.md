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
