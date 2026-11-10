=== lesson
--- step concept: Breaking a problem into steps
Complex questions are easier as a sequence of small result sets. SQL gives you three tools:
- **Scalar subquery** — returns one value: `WHERE amount > (SELECT AVG(amount) FROM orders)`
- **Derived table** — a subquery in FROM: `FROM (SELECT …) t`
- **CTE** (`WITH name AS (…)`) — a named step you can read top-to-bottom and reference several times.

```sql
WITH customer_revenue AS (          -- step 1: one row per customer
  SELECT customer_id, SUM(amount) AS revenue
  FROM orders WHERE status <> 'cancelled'
  GROUP BY customer_id
),
avg_rev AS (                         -- step 2: one value
  SELECT AVG(revenue) AS avg_revenue FROM customer_revenue
)
SELECT cr.*                          -- step 3: compare
FROM customer_revenue cr CROSS JOIN avg_rev a
WHERE cr.revenue > a.avg_revenue;
```
> [!TIP] Each CTE should have a clear grain. Name it after what one row is.

[[quiz:sql-subqueries-ctes:q0]]

--- step practice: Above-average orders
[[exercise:sql-subqueries-ctes-1]]

--- step concept: Correlated subqueries
A **correlated** subquery references the outer row, so it is logically evaluated per row:
```sql
SELECT o.order_id, o.customer_id, o.amount
FROM orders o
WHERE o.amount > (SELECT AVG(o2.amount) FROM orders o2 WHERE o2.customer_id = o.customer_id);
```
Powerful but can be slow; often rewritten as a join to an aggregated CTE or a window function.

[[exercise:sql-subqueries-ctes-2]]

--- step challenge: Multi-step logic
[[exercise:sql-subqueries-ctes-3]]
[[recall:sql-subqueries-ctes:r0]]

=== detailed
## Kinds of subqueries
| Kind | Returns | Example use |
|---|---|---|
| Scalar | one value | compare to an overall average |
| Row/table (IN, EXISTS) | a set | filter by membership |
| Derived table | a relation in FROM | pre-aggregate before joining |
| Correlated | value per outer row | compare a row to its own group |

## CTEs
`WITH a AS (…), b AS (…) SELECT …` — named, readable steps. Benefits:
- **Readability:** a pipeline of transformations, top to bottom.
- **Reuse:** reference the same step several times.
- **Testing:** run each CTE alone while debugging (`SELECT * FROM step2`).
- **Recursion:** `WITH RECURSIVE` for hierarchies and series.

> [!NOTE] Whether a CTE is materialised once or inlined depends on the engine. Postgres ≥12 inlines by default; BigQuery may evaluate a CTE referenced twice **twice** (and bill for it). For expensive reused steps in BigQuery, consider a temp table.

## Correlated subqueries vs alternatives
Correlated subqueries express "compare to my group" naturally, but a naive plan re-runs the subquery per row. Equivalent, usually faster forms:
```sql
-- join to an aggregate
WITH avg_by_c AS (SELECT customer_id, AVG(amount) a FROM orders GROUP BY customer_id)
SELECT o.* FROM orders o JOIN avg_by_c x USING (customer_id) WHERE o.amount > x.a;
-- window function
SELECT * FROM (SELECT o.*, AVG(amount) OVER (PARTITION BY customer_id) a FROM orders o) WHERE amount > a;
```

## dbt / ELT style
In dbt the convention is "import CTEs → logical CTEs → final SELECT":
```sql
with orders as (select * from {{ ref('stg_orders') }}),
     customers as (select * from {{ ref('stg_customers') }}),
     joined as (...),
     final as (...)
select * from final
```

## Common mistakes
> [!MISTAKE] Scalar subquery returning more than one row → runtime error (or arbitrary value in SQLite).

> [!MISTAKE] Deeply nested derived tables nobody can read — refactor into CTEs.

> [!MISTAKE] Assuming a CTE is computed once (cost surprises in BigQuery).

=== crisp
- Scalar subquery → one value · IN/EXISTS → set membership · derived table → relation in FROM.
- **CTE** = named step: `WITH x AS (…) SELECT … FROM x`. Read top-down; test each step.
- Give every CTE a clear grain and a name describing one row.
- Correlated subquery references the outer row → per-row logic; rewrite with join-to-aggregate or window for speed.
- BigQuery may re-evaluate a CTE each time it is referenced.
- `WITH RECURSIVE` for hierarchies and series.

=== memory
- **"CTEs are the recipe steps of a query."**
- Trigger: *"compare each row to its own group"* → correlated subquery or window AVG.
- Trigger: *"query is unreadable"* → refactor into CTEs.

=== data
flashcards:
  - q: "What is a correlated subquery?"
    a: "A subquery that references columns of the outer query, so it is evaluated per outer row."
  - q: "Name two benefits of CTEs."
    a: "Readability (named steps), reuse, easy debugging per step, recursion."
  - q: "Two faster rewrites of 'rows above their group average'?"
    a: "Join to an aggregated CTE, or AVG(...) OVER (PARTITION BY group)."
  - q: "Is a CTE always computed only once?"
    a: "No — engine dependent; BigQuery may evaluate a CTE referenced twice twice."
quiz:
  - q: "`WHERE amount > (SELECT amount FROM orders WHERE customer_id = 5)` fails when…"
    options:
      - "customer 5 has exactly one order"
      - "customer 5 has several orders (subquery returns multiple rows)"
      - "amount has NULLs"
      - "never"
    answer: 1
    explain: "A scalar subquery must return at most one row."
recall:
  - q: "When would you choose a CTE over a nested subquery, and what should you be careful about?"
    keyPoints:
      - "readability with named steps"
      - "reuse the same step several times"
      - "debug each step independently"
      - "engine may evaluate CTE more than once"
      - "recursive CTE for hierarchies"
exercises:
  - id: sql-subqueries-ctes-1
    lang: sql
    kind: coding
    difficulty: 1
    title: Orders above the overall average
    prompt: |
      Return `order_id`, `amount` for **non-cancelled** orders whose amount is above the **average amount of all non-cancelled orders**. Order by amount desc, then order_id.
    starter: |
      SELECT order_id, amount
      FROM orders
    solution: |
      SELECT order_id, amount
      FROM orders
      WHERE status <> 'cancelled'
        AND amount > (SELECT AVG(amount) FROM orders WHERE status <> 'cancelled')
      ORDER BY amount DESC, order_id;
    ordered: true
    hints:
      - "A scalar subquery can compute the average."
      - "Apply the same status filter inside and outside."
  - id: sql-subqueries-ctes-2
    lang: sql
    kind: coding
    difficulty: 2
    title: Each customer's best order
    prompt: |
      For each customer, return their **largest** order: `customer_id`, `order_id`, `amount`. If a customer has ties for the largest amount, return all tied orders. Order by customer_id, order_id. Use a subquery or CTE (no window functions yet).
    starter: |
      WITH max_by_customer AS (
        SELECT customer_id, MAX(amount) AS max_amount
        FROM orders
        GROUP BY customer_id
      )
      SELECT
    solution: |
      WITH max_by_customer AS (
        SELECT customer_id, MAX(amount) AS max_amount
        FROM orders
        GROUP BY customer_id
      )
      SELECT o.customer_id, o.order_id, o.amount
      FROM orders o
      JOIN max_by_customer m ON m.customer_id = o.customer_id AND o.amount = m.max_amount
      ORDER BY o.customer_id, o.order_id;
    ordered: true
    hints:
      - "Step 1: max amount per customer. Step 2: join back to orders on customer AND amount."
  - id: sql-subqueries-ctes-3
    lang: sql
    kind: scenario
    difficulty: 3
    title: Segment share of revenue
    prompt: |
      For **delivered** orders, return each customer `segment` with `revenue` (rounded 2) and `pct_of_total` — its share of total delivered revenue as a percentage rounded to 1 decimal. Order by revenue desc.
    starter: |
      WITH seg AS (
        -- one row per segment
      )
      SELECT
    solution: |
      WITH seg AS (
        SELECT c.segment, SUM(o.amount) AS revenue
        FROM orders o
        JOIN customers c ON c.customer_id = o.customer_id
        WHERE o.status = 'delivered'
        GROUP BY c.segment
      ),
      total AS (SELECT SUM(revenue) AS t FROM seg)
      SELECT s.segment, ROUND(s.revenue, 2) AS revenue, ROUND(100.0 * s.revenue / t.t, 1) AS pct_of_total
      FROM seg s CROSS JOIN total t
      ORDER BY s.revenue DESC;
    ordered: true
    hints:
      - "CTE 1: revenue per segment. CTE 2: the grand total."
      - "CROSS JOIN the single-row total onto every segment row."
      - "Multiply by 100.0 to avoid integer division."
interview:
  - q: "How do CTEs differ from subqueries and temporary tables?"
    type: concept
    level: 2
    keyPoints:
      - "CTE is a named query scoped to one statement"
      - "improves readability and reuse"
      - "temp table is physically stored and reusable across statements"
      - "CTE may be inlined or re-evaluated"
      - "recursive CTEs"
