=== lesson
--- step concept: How a query is actually processed
You write SQL in this order: `SELECT … FROM … WHERE … GROUP BY … HAVING … ORDER BY … LIMIT`.
The database **evaluates** it in a different order:

1. `FROM` / `JOIN` — which rows exist
2. `WHERE` — keep only matching rows
3. `GROUP BY` — collapse rows into groups
4. `HAVING` — keep only matching groups
5. `SELECT` — compute output columns (aliases are born here)
6. `ORDER BY` — sort
7. `LIMIT` — cut

> [!WHY] This single idea explains a whole family of errors: you cannot use a SELECT alias in WHERE (it does not exist yet), you can use it in ORDER BY (it does), and you cannot filter an aggregate in WHERE (groups do not exist yet).

[[quiz:sql-select-basics:q0]]

--- step example: Filtering precisely
```sql
SELECT order_id, order_date, channel, amount
FROM orders
WHERE status = 'delivered'
  AND channel IN ('web', 'app')
  AND order_date BETWEEN '2025-01-01' AND '2025-03-31'
ORDER BY amount DESC
LIMIT 10;
```
- `IN` replaces a chain of `OR`s.
- `BETWEEN` is **inclusive** on both ends. With timestamps, `BETWEEN '2025-01-01' AND '2025-03-31'` misses everything after midnight on 31 March — prefer `>= '2025-01-01' AND < '2025-04-01'`.
- Dates stored as ISO text (`YYYY-MM-DD`) sort and compare correctly as strings.

--- step practice: Your turn
[[exercise:sql-select-basics-1]]

--- step check: AND / OR precedence
`AND` binds tighter than `OR`. `WHERE a OR b AND c` means `a OR (b AND c)`.
Always add parentheses when mixing them.

[[quiz:sql-select-basics:q1]]
[[exercise:sql-select-basics-2]]

--- step scenario: A stakeholder request
> [!REAL] "Can you give me the 5 most recent cancelled app orders over 100, newest first?"
Translate requests into: **which rows** (WHERE), **which columns** (SELECT), **what order** (ORDER BY), **how many** (LIMIT).

[[exercise:sql-select-basics-3]]

=== detailed
## What it is
`SELECT` reads rows from tables, filters them, shapes the output and orders it. Every other SQL feature builds on this skeleton.

## Logical processing order
| Step | Clause | What exists at this point |
|---|---|---|
| 1 | FROM / JOIN | raw rows of the joined tables |
| 2 | WHERE | filtered rows |
| 3 | GROUP BY | groups |
| 4 | HAVING | filtered groups |
| 5 | SELECT | output columns + aliases |
| 6 | DISTINCT | de-duplicated output |
| 7 | ORDER BY | sorted output (aliases usable) |
| 8 | LIMIT / OFFSET | final slice |

> [!INTERVIEW] "Why can't I use a column alias in WHERE?" is a classic. Answer with the processing order.

## Filtering operators
- Comparison: `=`, `<>`/`!=`, `<`, `>`, `<=`, `>=`
- Sets: `IN ('a','b')`, `NOT IN (...)` — beware NULLs in `NOT IN` (see NULL logic)
- Ranges: `BETWEEN a AND b` (inclusive)
- Patterns: `LIKE 'abc%'` (`%` = any characters, `_` = exactly one). Case sensitivity depends on the database (SQLite LIKE is case-insensitive for ASCII; BigQuery is case-sensitive).
- Nulls: `IS NULL`, `IS NOT NULL` — never `= NULL`.

## Sorting
- `ORDER BY col1 DESC, col2` — sort keys are applied left to right; add a **tie-breaker** (often a unique id) when you need deterministic output.
- NULL placement differs by engine (SQLite/BigQuery put NULLs first ascending). Use `NULLS LAST` where supported, or `ORDER BY col IS NULL, col`.
- Without ORDER BY, row order is **not guaranteed** — even if it looks stable.

## DISTINCT
`SELECT DISTINCT a, b` removes duplicate *combinations* of `a, b`, not duplicates of `a` alone. It costs a sort or hash, so do not sprinkle it to "fix" duplicates caused by a bad join — fix the join.

## Performance considerations
- Filter early and specifically; in columnar warehouses select only needed columns (`SELECT *` scans everything you pay for).
- `LIMIT` does not reduce bytes scanned in BigQuery — it only trims output.
- Sorting large results is expensive; sort only when needed.

## Common mistakes
> [!MISTAKE] `WHERE status = 'delivered' OR status = 'shipped' AND amount > 100` — the AND binds first. Use parentheses or `IN`.

> [!MISTAKE] Using `BETWEEN` with timestamps and losing the last day.

> [!MISTAKE] Relying on row order without `ORDER BY`.

## Interview questions
- What is the logical order of SQL clauses? Why does it matter?
- Difference between `WHERE` and `HAVING`?
- How does `DISTINCT` differ from `GROUP BY`?

=== crisp
**Logical order:** FROM → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → LIMIT.

- Alias from SELECT ✗ in WHERE, ✓ in ORDER BY.
- `BETWEEN` is inclusive; for dates use `>= start AND < next_day`.
- `AND` before `OR` → always parenthesise mixed conditions.
- `IS NULL` not `= NULL`.
- No `ORDER BY` → no guaranteed order. Add a unique tie-breaker.
- `DISTINCT` applies to the whole row of selected columns.
- `SELECT *` + `LIMIT` still scans every column in BigQuery.

=== memory
**Mnemonic for the order:** *"**F**rank **W**ill **G**ive **H**er **S**ome **D**elicious **O**range **L**ollies"* → From, Where, Group, Having, Select, Distinct, Order, Limit.

- Trigger: *"alias error in WHERE"* → processing order.
- Trigger: *"missing last day"* → BETWEEN + timestamps.
- Commonly confused: `WHERE` filters **rows**; `HAVING` filters **groups**.

=== data
flashcards:
  - q: "In what logical order does a database evaluate SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT?"
    a: "FROM → WHERE → GROUP BY → HAVING → SELECT → (DISTINCT) → ORDER BY → LIMIT"
  - q: "Why can a SELECT alias be used in ORDER BY but not in WHERE?"
    a: "WHERE runs before SELECT creates the alias; ORDER BY runs after."
  - q: "Is BETWEEN inclusive or exclusive?"
    a: "Inclusive on both ends."
  - q: "How is `a OR b AND c` evaluated?"
    a: "`a OR (b AND c)` — AND binds tighter."
  - q: "What does `LIKE 'A_%'` match?"
    a: "Strings starting with A followed by at least one more character."
quiz:
  - q: "Which query fails?"
    options:
      - "SELECT amount * 2 AS dbl FROM orders ORDER BY dbl"
      - "SELECT amount * 2 AS dbl FROM orders WHERE dbl > 100"
      - "SELECT amount FROM orders WHERE amount * 2 > 100"
      - "SELECT amount AS a FROM orders ORDER BY a DESC"
    answer: 1
    explain: "WHERE is evaluated before SELECT, so the alias `dbl` does not exist yet."
  - q: "`WHERE channel = 'web' OR channel = 'app' AND amount > 100` returns…"
    options:
      - "web or app orders over 100"
      - "all web orders, plus app orders over 100"
      - "only orders over 100"
      - "an error"
    answer: 1
    explain: "AND binds first: `web OR (app AND amount > 100)`."
recall:
  - q: "Explain the logical processing order of a SQL query and one practical consequence."
    keyPoints:
      - "FROM and joins are evaluated first"
      - "WHERE filters rows before grouping"
      - "HAVING filters groups after GROUP BY"
      - "SELECT aliases are created after WHERE"
      - "ORDER BY can use aliases"
exercises:
  - id: sql-select-basics-1
    lang: sql
    kind: coding
    difficulty: 1
    title: Large delivered web orders
    prompt: |
      Return `order_id`, `order_date` and `amount` of **delivered** orders from the **web** channel with an amount of **at least 300**, largest amount first (ties: lower order_id first).
    starter: |
      SELECT
      FROM orders
    solution: |
      SELECT order_id, order_date, amount
      FROM orders
      WHERE status = 'delivered' AND channel = 'web' AND amount >= 300
      ORDER BY amount DESC, order_id;
    ordered: true
    hints:
      - "Three conditions in WHERE, joined with AND."
      - "Sort by two keys: `ORDER BY amount DESC, order_id`."
  - id: sql-select-basics-2
    lang: sql
    kind: debug
    difficulty: 1
    title: "Debug: the OR that leaked"
    prompt: |
      An analyst wanted *web or app orders over 250 in 2025*, but the query returns far too many rows. Fix it.
    starter: |
      SELECT order_id, channel, amount, order_date
      FROM orders
      WHERE channel = 'web' OR channel = 'app'
        AND amount > 250
        AND order_date >= '2025-01-01';
    solution: |
      SELECT order_id, channel, amount, order_date
      FROM orders
      WHERE channel IN ('web', 'app')
        AND amount > 250
        AND order_date >= '2025-01-01';
    hints:
      - "Which operator binds tighter, AND or OR?"
      - "Wrap the channel condition in parentheses, or use IN."
    explain: |
      `a OR b AND c AND d` is `a OR (b AND c AND d)`, so **every** web order leaked through. `IN` removes the ambiguity entirely.
  - id: sql-select-basics-3
    lang: sql
    kind: scenario
    difficulty: 1
    title: Recent cancelled app orders
    prompt: |
      "Give me the **5 most recent cancelled app orders** with amount **over 100** — newest first." Return `order_id`, `customer_id`, `order_date`, `amount`. Break date ties with the higher `order_id` first.
    starter: |
      SELECT
    solution: |
      SELECT order_id, customer_id, order_date, amount
      FROM orders
      WHERE status = 'cancelled' AND channel = 'app' AND amount > 100
      ORDER BY order_date DESC, order_id DESC
      LIMIT 5;
    ordered: true
    hints:
      - "Filter on status, channel and amount; sort newest first; LIMIT 5."
interview:
  - q: "Explain the logical order of execution of a SQL query. Why does it matter in practice?"
    type: concept
    level: 1
    keyPoints:
      - "FROM/JOIN first, then WHERE, GROUP BY, HAVING, SELECT, ORDER BY, LIMIT"
      - "Aliases are not visible in WHERE"
      - "Aggregates must be filtered in HAVING"
      - "Helps reason about errors and performance (filter early)"
    followUps:
      - "Where does a window function get evaluated?"
      - "Can ORDER BY reference a column not in SELECT?"
