=== lesson
--- step concept: Asking "does a match exist?"
Sometimes you don't want columns from the other table — you only want to know whether a match **exists**.
- **Semi join**: keep left rows that have at least one match → `WHERE EXISTS (…)` or `IN (…)`.
- **Anti join**: keep left rows with **no** match → `WHERE NOT EXISTS (…)` or `LEFT JOIN … WHERE right.key IS NULL`.

A semi join never duplicates left rows, unlike an INNER JOIN to a 1:N table.

```sql
-- customers who placed at least one app order (each customer once)
SELECT c.customer_id, c.name
FROM customers c
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id AND o.channel = 'app');
```

[[quiz:sql-semi-anti-self:q0]]

--- step practice: Customers who never ordered
[[exercise:sql-semi-anti-self-1]]

--- step concept: Self joins
A self join joins a table to itself using two aliases — the classic case is a hierarchy stored as `manager_id → emp_id`.
```sql
SELECT e.name AS employee, m.name AS manager
FROM employees e
LEFT JOIN employees m ON m.emp_id = e.manager_id;
```

[[exercise:sql-semi-anti-self-2]]

--- step challenge: Compare rows within a table
[[exercise:sql-semi-anti-self-3]]

=== detailed
## Semi joins
A semi join returns each left row **at most once** if a matching right row exists. Write it with `EXISTS` (clearest), `IN (subquery)`, or an INNER JOIN to a **de-duplicated** right side. Optimisers usually execute `EXISTS` and `IN` identically.

## Anti joins
Return left rows with **no** match:
```sql
-- 1. NOT EXISTS (NULL-safe, usually best)
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id)
-- 2. LEFT JOIN + IS NULL
LEFT JOIN orders o ON o.customer_id = c.customer_id WHERE o.customer_id IS NULL
-- 3. NOT IN — only if the subquery can never return NULL
WHERE c.customer_id NOT IN (SELECT customer_id FROM orders WHERE customer_id IS NOT NULL)
```
> [!REAL] Anti joins are the core of pipeline checks: orphaned foreign keys, records missing from the target after a load, new records to insert in an incremental load.

## Self joins
Use two aliases of one table. Typical uses:
- hierarchies: employee → manager (one level; for arbitrary depth use a recursive CTE),
- comparing rows: pairs of employees in the same department earning more than each other,
- "previous row" before window functions existed (today prefer `LAG`).

Use `LEFT JOIN` for hierarchies so the root (manager NULL) is kept. Use inequality predicates like `a.id < b.id` to avoid self-pairs and duplicate pairs.

## Performance
`EXISTS` can stop at the first match. `LEFT JOIN … IS NULL` may build the full join first, though modern optimisers convert both to the same anti-join plan. In BigQuery/Spark, anti joins on large tables shuffle both sides; broadcast the small side if possible.

## Common mistakes
> [!MISTAKE] Using an INNER JOIN to a 1:N table as a filter → duplicated left rows, then "fixing" with DISTINCT.

> [!MISTAKE] `NOT IN` against a nullable column.

> [!MISTAKE] Self join with INNER JOIN drops the CEO.

=== crisp
- **Semi join** = keep left rows that have a match → `EXISTS` / `IN`. No duplicates.
- **Anti join** = keep left rows with no match → `NOT EXISTS` or `LEFT JOIN … WHERE r.key IS NULL`.
- Avoid `NOT IN` with nullable columns.
- **Self join** = same table, two aliases (`e` employee, `m` manager). LEFT JOIN keeps the root.
- `a.id < b.id` → unique pairs without self-pairs.
- Pipelines: anti joins find orphans, missing loads, new rows.

=== memory
- **EXISTS asks a yes/no question.** It never adds columns or rows.
- **Anti join = "who is missing?"**
- Self join picture: two copies of the org chart side by side.

=== data
flashcards:
  - q: "What is a semi join?"
    a: "Returns left rows that have at least one match on the right — each left row at most once (EXISTS / IN)."
  - q: "Three ways to write an anti join?"
    a: "NOT EXISTS, LEFT JOIN … WHERE right.key IS NULL, NOT IN (only if no NULLs)."
  - q: "Why use LEFT JOIN in an employee → manager self join?"
    a: "So employees without a manager (the root) are kept."
  - q: "How do you list unique pairs from a self join?"
    a: "Join on a.id < b.id (removes self-pairs and mirrored duplicates)."
quiz:
  - q: "Which returns each customer at most once?"
    options:
      - "customers JOIN orders"
      - "customers WHERE EXISTS (orders …)"
      - "customers CROSS JOIN orders"
      - "customers LEFT JOIN orders"
    answer: 1
recall:
  - q: "When would you use an anti join in a data pipeline? Give two examples."
    keyPoints:
      - "find rows with no match in another table"
      - "orphaned foreign keys"
      - "records missing in target after load"
      - "new records for incremental insert"
      - "NOT EXISTS or LEFT JOIN IS NULL"
exercises:
  - id: sql-semi-anti-self-1
    lang: sql
    kind: coding
    difficulty: 1
    title: Customers who never ordered
    prompt: |
      Return `customer_id`, `name`, `signup_date` of customers who have **never placed an order**, ordered by `customer_id`.
    starter: |
      SELECT c.customer_id, c.name, c.signup_date
      FROM customers c
    solution: |
      SELECT c.customer_id, c.name, c.signup_date
      FROM customers c
      WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id)
      ORDER BY c.customer_id;
    ordered: true
    hints:
      - "This is an anti join."
      - "WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id)"
  - id: sql-semi-anti-self-2
    lang: sql
    kind: coding
    difficulty: 2
    title: Employees and their managers
    prompt: |
      Return `employee`, `dept`, `manager` (manager's name, NULL for the CEO) for every employee, ordered by `emp_id`.
    starter: |
      SELECT e.name AS employee
      FROM employees e
    solution: |
      SELECT e.name AS employee, e.dept, m.name AS manager
      FROM employees e
      LEFT JOIN employees m ON m.emp_id = e.manager_id
      ORDER BY e.emp_id;
    ordered: true
    hints:
      - "Join employees to itself: alias e for the employee, m for the manager."
      - "LEFT JOIN, so the CEO stays."
  - id: sql-semi-anti-self-3
    lang: sql
    kind: coding
    difficulty: 3
    title: Earning more than their manager
    prompt: |
      Find employees who earn **more than their own manager**. Return `employee`, `salary`, `manager`, `manager_salary`, ordered by the salary difference (largest first). Empty is a valid answer.
    starter: |
      SELECT
    solution: |
      SELECT e.name AS employee, e.salary, m.name AS manager, m.salary AS manager_salary
      FROM employees e
      JOIN employees m ON m.emp_id = e.manager_id
      WHERE e.salary > m.salary
      ORDER BY e.salary - m.salary DESC;
    ordered: true
    hints:
      - "Self join employee → manager, then compare the two salary columns."
interview:
  - q: "What is the difference between a semi join and an inner join? Why does it matter?"
    type: concept
    level: 2
    keyPoints:
      - "semi join returns each left row at most once"
      - "inner join to a one-to-many table duplicates rows"
      - "semi join written with EXISTS or IN"
      - "no columns from the right table"
