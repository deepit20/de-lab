=== lesson
--- step concept: Calculations across rows — without collapsing them
GROUP BY returns one row per group. A **window function** computes across a set of related rows but **keeps every row**.

```sql
SELECT order_id, customer_id, amount,
       ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY amount DESC) AS rn
FROM orders;
```
- `PARTITION BY` — which rows belong together (like GROUP BY, but no collapsing)
- `ORDER BY` — the order inside each partition
- the function — what to compute

> [!WHY] Deduplication, "latest record per key", top-N per group and ranking are daily data engineering tasks. Window functions solve them in one pass.

[[quiz:sql-window-ranking:q0]]

--- step example: ROW_NUMBER vs RANK vs DENSE_RANK
For amounts 500, 400, 400, 300:

| amount | ROW_NUMBER | RANK | DENSE_RANK |
|---|---|---|---|
| 500 | 1 | 1 | 1 |
| 400 | 2 | 2 | 2 |
| 400 | 3 | 2 | 2 |
| 300 | 4 | 4 | 3 |

ROW_NUMBER is unique (ties broken arbitrarily unless you add a tie-breaker); RANK leaves gaps; DENSE_RANK does not.

[[quiz:sql-window-ranking:q1]]

--- step practice: Rank products
[[exercise:sql-window-ranking-1]]

--- step concept: Filtering on a window result
Window functions are evaluated **after WHERE**, so you cannot filter them in the same query level. Wrap in a CTE:
```sql
WITH ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC, order_id DESC) AS rn
  FROM orders
)
SELECT * FROM ranked WHERE rn = 1;   -- latest order per customer
```
(BigQuery and Snowflake also offer `QUALIFY rn = 1`.)

[[exercise:sql-window-ranking-2]]

--- step scenario: Deduplicate a raw feed
[[exercise:sql-window-ranking-3]]

--- step challenge: Top 3 per group
[[exercise:sql-window-ranking-4]]
[[recall:sql-window-ranking:r0]]

=== detailed
## What window functions are
A window function computes a value for each row using a "window" of related rows defined by `OVER (PARTITION BY … ORDER BY … frame)`. Unlike aggregates with GROUP BY, the number of rows does not change.

## Syntax
```sql
function(args) OVER (
  PARTITION BY col_a, col_b     -- optional: independent groups
  ORDER BY col_c DESC           -- order within the partition
  ROWS BETWEEN … AND …          -- optional frame (next topic)
)
```

## Ranking functions
| Function | Ties | Gaps | Typical use |
|---|---|---|---|
| `ROW_NUMBER()` | unique numbers | – | dedup, latest record, pagination |
| `RANK()` | same rank | yes (1,2,2,4) | competition ranking |
| `DENSE_RANK()` | same rank | no (1,2,2,3) | "top 3 distinct salaries" |
| `NTILE(n)` | – | – | quartiles / buckets |
| `PERCENT_RANK()` / `CUME_DIST()` | – | – | percentiles |

## Deduplication pattern (the most important one)
```sql
WITH ranked AS (
  SELECT *,
         ROW_NUMBER() OVER (PARTITION BY customer_id      -- the business key
                            ORDER BY updated_at DESC,      -- which version wins
                                     stg_id DESC) AS rn     -- deterministic tie-breaker
  FROM stg_customers
)
SELECT * FROM ranked WHERE rn = 1;
```
> [!REAL] This is how you keep the latest version per key when a source sends updates, how you remove duplicate events after an at-least-once delivery, and how you build the "current" view from a change log.

> [!WARN] Without a deterministic tie-breaker, ROW_NUMBER can pick a **different** row on each run when two rows tie — your pipeline becomes non-deterministic (and non-idempotent).

## Top-N per group
`ROW_NUMBER() <= N` gives exactly N rows per group; `DENSE_RANK() <= N` gives all rows within the top N distinct values (possibly more than N rows). Clarify which the business wants.

## Where windows run in the logical order
FROM → WHERE → GROUP BY → HAVING → **window functions** → SELECT list → DISTINCT → ORDER BY → LIMIT. Hence: windows can use aggregates (`SUM(SUM(x)) OVER ()`), but WHERE cannot use windows.

## Performance
Each distinct `OVER (PARTITION BY … ORDER BY …)` requires sorting each partition. In distributed engines rows are shuffled by the partition key. Huge single partitions (no PARTITION BY, or a skewed key) run on one worker — a common cause of "Resources exceeded" in BigQuery.

## Common mistakes
> [!MISTAKE] Filtering `WHERE ROW_NUMBER() … = 1` in the same SELECT — not allowed.

> [!MISTAKE] Missing tie-breaker → non-deterministic dedup.

> [!MISTAKE] Using RANK for "top 3" and getting 5 rows (ties) — or ROW_NUMBER and silently dropping a tie.

## Interview questions
- Difference between ROW_NUMBER, RANK and DENSE_RANK?
- How do you deduplicate a table keeping the latest record per key?
- Find the second highest salary per department.

=== crisp
- Window = compute across related rows, **keep all rows**: `f() OVER (PARTITION BY … ORDER BY …)`.
- ROW_NUMBER 1,2,3,4 · RANK 1,2,2,4 · DENSE_RANK 1,2,2,3.
- Dedup / latest per key: `ROW_NUMBER() OVER (PARTITION BY key ORDER BY updated_at DESC, id DESC) = 1` in a CTE.
- Always add a **deterministic tie-breaker**.
- Filter window results in an outer query (or `QUALIFY` in BigQuery).
- Evaluated after WHERE/GROUP BY/HAVING, before ORDER BY.
- Top-N: ROW_NUMBER = exactly N; DENSE_RANK = top N values incl. ties.

=== memory
- **"PARTITION = groups that don't collapse."**
- **R-D-R:** RANK skips, DENSE doesn't, ROW_NUMBER never repeats.
- Trigger: *"latest record per key" / "dedup"* → ROW_NUMBER … = 1.
- Trigger: *"window function in WHERE error"* → wrap in CTE.

=== data
flashcards:
  - q: "Amounts 500, 400, 400, 300 — RANK and DENSE_RANK of 300?"
    a: "RANK = 4, DENSE_RANK = 3."
  - q: "How do you keep only the latest row per customer_id?"
    a: "ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY updated_at DESC, id DESC) AS rn in a CTE, then WHERE rn = 1."
  - q: "Why can't you filter a window function in WHERE?"
    a: "Window functions are evaluated after WHERE."
  - q: "What happens with ROW_NUMBER dedup if ties have no tie-breaker?"
    a: "The chosen row is arbitrary and can change between runs — non-deterministic output."
  - q: "What does PARTITION BY do?"
    a: "Splits rows into independent groups for the window calculation without collapsing them."
quiz:
  - q: "A window function differs from GROUP BY aggregation because…"
    options:
      - "it is faster"
      - "it keeps every input row"
      - "it ignores NULLs"
      - "it cannot use ORDER BY"
    answer: 1
  - q: "You need the top 3 salaries per department, including everyone tied on those salaries. Use…"
    options: ["ROW_NUMBER() <= 3", "DENSE_RANK() <= 3", "NTILE(3)", "LIMIT 3"]
    answer: 1
recall:
  - q: "Explain how you would deduplicate a staging table that contains several versions of each record."
    keyPoints:
      - "partition by the business key"
      - "order by updated timestamp descending"
      - "deterministic tie-breaker"
      - "ROW_NUMBER equals 1"
      - "filter in an outer query or QUALIFY"
exercises:
  - id: sql-window-ranking-1
    lang: sql
    kind: coding
    difficulty: 2
    title: Rank products by price within category
    prompt: |
      For every product return `category`, `name`, `price` and `price_rank` — its **DENSE_RANK** by price (highest = 1) within its category. Order by category, price_rank, name.
    starter: |
      SELECT category, name, price
      FROM products
    solution: |
      SELECT category, name, price,
             DENSE_RANK() OVER (PARTITION BY category ORDER BY price DESC) AS price_rank
      FROM products
      ORDER BY category, price_rank, name;
    ordered: true
    hints:
      - "PARTITION BY category ORDER BY price DESC"
  - id: sql-window-ranking-2
    lang: sql
    kind: coding
    difficulty: 2
    title: Each customer's latest order
    prompt: |
      Return each customer's **most recent** order: `customer_id`, `order_id`, `order_date`, `status`. If two orders share the latest date, take the higher order_id. Order by customer_id.
    starter: |
      WITH ranked AS (
        SELECT
        FROM orders
      )
      SELECT customer_id, order_id, order_date, status
      FROM ranked
      WHERE rn = 1
      ORDER BY customer_id;
    solution: |
      WITH ranked AS (
        SELECT customer_id, order_id, order_date, status,
               ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC, order_id DESC) AS rn
        FROM orders
      )
      SELECT customer_id, order_id, order_date, status
      FROM ranked
      WHERE rn = 1
      ORDER BY customer_id;
    ordered: true
    hints:
      - "ROW_NUMBER partitioned by customer, newest first."
      - "Include order_id DESC as the tie-breaker."
  - id: sql-window-ranking-3
    lang: sql
    kind: scenario
    difficulty: 2
    title: Clean the CRM feed
    prompt: |
      `stg_customers` contains several versions per `customer_id` (and even an exact duplicate row). Produce the **current** record per customer: the row with the latest `updated_at`; ties broken by the highest `stg_id`. Return `customer_id`, `name` (trimmed), `email` (lower-cased), `city`, `updated_at`, ordered by customer_id.
    starter: |
      WITH ranked AS (
        SELECT *
        FROM stg_customers
      )
      SELECT
    solution: |
      WITH ranked AS (
        SELECT *,
               ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY updated_at DESC, stg_id DESC) AS rn
        FROM stg_customers
      )
      SELECT customer_id, TRIM(name) AS name, LOWER(email) AS email, city, updated_at
      FROM ranked
      WHERE rn = 1
      ORDER BY customer_id;
    ordered: true
    hints:
      - "Partition by the business key, order by recency."
      - "Clean the columns in the final SELECT with TRIM and LOWER."
    explain: |
      This is the standard "staging → current" step in ELT. Note it is **idempotent**: running it twice on the same input gives the same output, thanks to the deterministic tie-breaker.
  - id: sql-window-ranking-4
    lang: sql
    kind: coding
    difficulty: 3
    title: Top 3 products per category by revenue
    prompt: |
      Using delivered orders, compute each product's revenue (`quantity * unit_price`) and return the **top 3 products per category** (exactly 3 — break ties by product name). Return `category`, `name`, `revenue` (rounded 2), `rnk`. Order by category, rnk.
    starter: |
      WITH product_revenue AS (
        SELECT
      )
      SELECT
    solution: |
      WITH product_revenue AS (
        SELECT p.category, p.name, SUM(oi.quantity * oi.unit_price) AS revenue
        FROM order_items oi
        JOIN orders o ON o.order_id = oi.order_id
        JOIN products p ON p.product_id = oi.product_id
        WHERE o.status = 'delivered'
        GROUP BY p.category, p.name
      ),
      ranked AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY category ORDER BY revenue DESC, name) AS rnk
        FROM product_revenue
      )
      SELECT category, name, ROUND(revenue, 2) AS revenue, rnk
      FROM ranked
      WHERE rnk <= 3
      ORDER BY category, rnk;
    ordered: true
    hints:
      - "Aggregate first (product grain), then rank."
      - "Exactly 3 per group → ROW_NUMBER."
interview:
  - q: "What is the difference between ROW_NUMBER, RANK and DENSE_RANK? Give a use case for each."
    type: concept
    level: 2
    keyPoints:
      - "ROW_NUMBER unique sequential numbers"
      - "RANK same rank for ties with gaps"
      - "DENSE_RANK same rank for ties without gaps"
      - "ROW_NUMBER for deduplication / latest record"
      - "DENSE_RANK for nth highest distinct value"
  - q: "Write a query to find the second highest salary in each department."
    type: coding
    level: 2
    keyPoints:
      - "DENSE_RANK over partition by department order by salary desc"
      - "filter rank = 2 in outer query"
      - "consider ties and departments with one salary"
    followUps:
      - "What if two people share the highest salary?"
