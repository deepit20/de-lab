=== lesson
--- step concept: What a join really does
A join pairs rows from two tables where the **ON condition is TRUE**. Think of it in two stages:
1. Conceptually build every pair (left row × right row).
2. Keep the pairs where ON is true; then, for outer joins, add back unmatched rows padded with NULLs.

| Join | Keeps |
|---|---|
| `INNER JOIN` | only matched pairs |
| `LEFT JOIN` | all left rows; right columns NULL when no match |
| `RIGHT JOIN` | mirror of LEFT |
| `FULL OUTER JOIN` | all rows from both sides |
| `CROSS JOIN` | every combination (no ON) |

> [!WHY] Joins are where most silent data errors come from: rows disappear (wrong join type) or multiply (one-to-many relationships). You must always know the **cardinality**: 1:1, 1:many or many:many.

[[quiz:sql-joins:q0]]

--- step example: Inner vs left
```sql
-- customers WITH their order counts (customers without orders disappear)
SELECT c.customer_id, c.name, COUNT(*) AS orders
FROM customers c
JOIN orders o ON o.customer_id = c.customer_id
GROUP BY c.customer_id, c.name;

-- ALL customers, 0 for those without orders
SELECT c.customer_id, c.name, COUNT(o.order_id) AS orders
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id
GROUP BY c.customer_id, c.name;
```
Note `COUNT(o.order_id)` — `COUNT(*)` would count the NULL-padded row as 1.

--- step practice: Orders with customer names
[[exercise:sql-joins-1]]

--- step check: The WHERE-kills-LEFT-JOIN trap
A filter on the **right** table in WHERE turns a LEFT JOIN back into an INNER JOIN, because NULL-padded rows fail the condition. Put such filters in the **ON** clause.

[[quiz:sql-joins:q1]]
[[exercise:sql-joins-2]]

--- step challenge: Three tables
[[exercise:sql-joins-3]]

--- step scenario: Fan-out
[[exercise:sql-joins-4]]

--- step interview: Explain joins clearly
[[recall:sql-joins:r0]]

=== detailed
## What a join is
A join combines rows from two relations based on a predicate. Logically it is a filtered Cartesian product; physically the engine uses smarter algorithms (below).

## Join types
- **INNER** — only rows where the predicate matches on both sides.
- **LEFT (OUTER)** — every left row once or more; unmatched left rows get NULLs for right columns. The workhorse of analytics ("all customers, with orders if any").
- **RIGHT** — mirror image; rewrite as LEFT for readability.
- **FULL OUTER** — union of LEFT and RIGHT results; used for reconciliation ("rows in source but not target and vice versa").
- **CROSS** — Cartesian product; used deliberately for date spines × entities, or generating combinations.
- **SEMI / ANTI** — "exists / not exists" filters (next topic).
- **SELF** — a table joined to itself (employee → manager).

## Cardinality and fan-out
| Relationship | Effect of joining |
|---|---|
| 1 : 1 | row count unchanged |
| 1 : many | the "one" side is repeated → its measures double count if summed |
| many : many | explosive growth — usually a bug (missing key column) |

> [!TIP] Before and after any important join, compare `COUNT(*)` and `COUNT(DISTINCT key)`. Production pipelines add a uniqueness test on the join key of the "one" side.

## ON vs WHERE in outer joins
```sql
-- keeps all customers; only joins their 2025 orders
LEFT JOIN orders o ON o.customer_id = c.customer_id AND o.order_date >= '2025-01-01'
-- drops customers with no 2025 orders (filter runs after the join)
LEFT JOIN orders o ON o.customer_id = c.customer_id
WHERE o.order_date >= '2025-01-01'
```
For INNER joins the two forms are equivalent.

## NULL keys
`NULL = NULL` is not true, so rows with NULL keys never match. If NULL should match NULL, use a NULL-safe comparison (`IS NOT DISTINCT FROM`) or COALESCE to a sentinel — deliberately.

## How engines execute joins
| Algorithm | Good when |
|---|---|
| Nested loop (with index) | small outer table, indexed inner |
| Hash join | large unsorted inputs, equality predicates |
| Sort-merge join | both inputs large/sorted (Spark default for big-big joins) |
| Broadcast join | one side small enough to copy to every worker (Spark/BigQuery) |

> [!PERF] In distributed systems a join of two large tables needs a **shuffle** of both sides by the join key. Broadcasting the small side avoids it. Skewed keys (one customer with 30% of rows) overload one worker.

## Common mistakes
> [!MISTAKE] Filtering the right table in WHERE after a LEFT JOIN.

> [!MISTAKE] `COUNT(*)` after a LEFT JOIN counts unmatched rows as 1 — use `COUNT(right.key)`.

> [!MISTAKE] Joining on a non-unique column (name, email) and multiplying rows.

> [!MISTAKE] Summing header amounts after joining to lines.

## Interview questions
- Difference between INNER and LEFT JOIN? When would a LEFT JOIN behave like an INNER JOIN?
- How do you find rows in table A that are missing from table B?
- What is a broadcast join and when is it used?

=== crisp
- INNER = matches only · LEFT = all left + matches (NULLs otherwise) · FULL = everything · CROSS = all combinations.
- Know cardinality: 1:1, 1:N (fan-out), N:M (explosion).
- Right-table filters go in **ON** for LEFT joins; in WHERE they turn it into INNER.
- After LEFT JOIN count with `COUNT(right.key)`, not `COUNT(*)`.
- NULL keys never match.
- Validate: compare row counts before/after joins.
- Engines: nested loop, hash, sort-merge, broadcast. Big-big joins shuffle.

=== memory
- **"LEFT keeps the left."**
- **"Filter the right in the ON, or the LEFT is gone."**
- Trigger: *"rows disappeared"* → INNER join or WHERE on right table.
- Trigger: *"rows multiplied"* → 1:N or N:M join.
- Picture: LEFT JOIN = left table with optional sticky notes from the right.

=== data
flashcards:
  - q: "What does a LEFT JOIN return for left rows with no match?"
    a: "The left row once, with NULLs in all right-table columns."
  - q: "Why can a WHERE condition turn a LEFT JOIN into an INNER JOIN?"
    a: "Unmatched rows have NULLs on the right; a WHERE condition on those columns is UNKNOWN, so they are dropped."
  - q: "What is fan-out?"
    a: "Row multiplication when joining a one-side row to many rows on the other side."
  - q: "COUNT(*) vs COUNT(o.order_id) after customers LEFT JOIN orders?"
    a: "COUNT(*) counts 1 for customers with no orders; COUNT(o.order_id) correctly gives 0."
  - q: "What is a broadcast join?"
    a: "Copying the small table to every worker so the large table is joined without shuffling it."
quiz:
  - q: "120 customers, 110 of them have orders. `customers c LEFT JOIN orders o` then `COUNT(DISTINCT c.customer_id)` gives…"
    options: ["110", "120", "900", "it depends on WHERE"]
    answer: 1
    explain: "LEFT JOIN keeps every customer at least once."
  - q: "Where should `o.status = 'delivered'` go to keep customers without delivered orders?"
    options: ["WHERE", "ON clause of the LEFT JOIN", "HAVING", "GROUP BY"]
    answer: 1
recall:
  - q: "Explain INNER vs LEFT joins and how a join can silently change your row count."
    keyPoints:
      - "INNER keeps only matching rows"
      - "LEFT keeps all left rows with NULLs"
      - "one-to-many join duplicates rows"
      - "WHERE on the right table removes unmatched rows"
      - "check row counts before and after"
exercises:
  - id: sql-joins-1
    lang: sql
    kind: coding
    difficulty: 1
    title: Orders with customer names
    prompt: |
      List the 10 **largest** orders with the customer's name. Return `order_id`, `name`, `city`, `amount`, largest first (ties: order_id).
    starter: |
      SELECT o.order_id
      FROM orders o
    solution: |
      SELECT o.order_id, c.name, c.city, o.amount
      FROM orders o
      JOIN customers c ON c.customer_id = o.customer_id
      ORDER BY o.amount DESC, o.order_id
      LIMIT 10;
    ordered: true
    hints:
      - "JOIN customers c ON c.customer_id = o.customer_id"
  - id: sql-joins-2
    lang: sql
    kind: debug
    difficulty: 2
    title: "Debug: where did my customers go?"
    prompt: |
      The report must show **every customer** with the number of **delivered** orders they have (0 if none). It currently misses customers. Fix it. Return `customer_id`, `name`, `delivered_orders`, ordered by `customer_id`.
    starter: |
      SELECT c.customer_id, c.name, COUNT(*) AS delivered_orders
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.customer_id
      WHERE o.status = 'delivered'
      GROUP BY c.customer_id, c.name
      ORDER BY c.customer_id;
    solution: |
      SELECT c.customer_id, c.name, COUNT(o.order_id) AS delivered_orders
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.customer_id AND o.status = 'delivered'
      GROUP BY c.customer_id, c.name
      ORDER BY c.customer_id;
    ordered: true
    hints:
      - "How many rows should the result have? Compare with SELECT COUNT(*) FROM customers."
      - "Move the status filter into the ON clause."
      - "COUNT(*) counts the NULL-padded row as 1 — count a right-side column."
    explain: |
      Two bugs: the WHERE filter discarded NULL-padded rows (turning the LEFT JOIN into an INNER JOIN), and `COUNT(*)` would report 1 instead of 0 for customers without matches.
  - id: sql-joins-3
    lang: sql
    kind: coding
    difficulty: 2
    title: Units sold per category and channel
    prompt: |
      For **delivered** orders, return `category`, `channel` and `units` (sum of quantity). Order by category, then units desc.
    starter: |
      SELECT p.category, o.channel
      FROM order_items oi
    solution: |
      SELECT p.category, o.channel, SUM(oi.quantity) AS units
      FROM order_items oi
      JOIN orders o ON o.order_id = oi.order_id
      JOIN products p ON p.product_id = oi.product_id
      WHERE o.status = 'delivered'
      GROUP BY p.category, o.channel
      ORDER BY p.category, units DESC;
    ordered: true
    hints:
      - "Start from order_items (the line grain) and join to orders and products."
  - id: sql-joins-4
    lang: sql
    kind: scenario
    difficulty: 3
    title: Reconcile orders and items
    prompt: |
      A late-arriving load corrupted some data. Write the data quality check: find orders whose `amount` does **not** match the sum of their items (`quantity * unit_price`) by more than 0.01, **and** orders that have **no items at all**. Return `order_id`, `amount`, `items_total` (rounded 2; NULL when no items). Order by order_id.

      *(For this exercise the database has a few injected defects.)*
    starter: |
      WITH items AS (
        SELECT order_id, SUM(quantity * unit_price) AS items_total
        FROM order_items
        GROUP BY order_id
      )
      SELECT
    solution: |
      WITH items AS (
        SELECT order_id, SUM(quantity * unit_price) AS items_total
        FROM order_items
        GROUP BY order_id
      )
      SELECT o.order_id, o.amount, ROUND(i.items_total, 2) AS items_total
      FROM orders o
      LEFT JOIN items i ON i.order_id = o.order_id
      WHERE i.order_id IS NULL OR ABS(o.amount - i.items_total) > 0.01
      ORDER BY o.order_id;
    ordered: true
    setup: |
      INSERT INTO orders VALUES (901, 3, '2025-06-01', 'delivered', 'web', 99.5);
      INSERT INTO orders VALUES (902, 8, '2025-06-02', 'shipped', 'app', 42.0);
      UPDATE orders SET amount = amount + 5 WHERE order_id IN (17, 245);
    hints:
      - "Aggregate items to the order grain first, then join (no fan-out)."
      - "LEFT JOIN so orders without items survive; detect them with IS NULL."
    explain: |
      Aggregating **before** joining keeps the grain at one row per order. This pattern — aggregate, LEFT JOIN, compare — is the basis of reconciliation tests in pipelines.
interview:
  - q: "Explain the difference between INNER JOIN and LEFT JOIN. When does a LEFT JOIN behave like an INNER JOIN?"
    type: concept
    level: 1
    keyPoints:
      - "INNER keeps only matched rows"
      - "LEFT keeps all rows of the left table"
      - "unmatched right columns are NULL"
      - "a WHERE filter on right columns removes NULL rows"
      - "put the filter in ON instead"
  - q: "How would you find records present in a source table but missing in the target table?"
    type: coding
    level: 2
    keyPoints:
      - "LEFT JOIN target and filter target key IS NULL"
      - "or NOT EXISTS"
      - "avoid NOT IN with NULLs"
      - "FULL OUTER JOIN to see both directions"
    followUps:
      - "How would you do this for 1 billion rows in BigQuery?"
