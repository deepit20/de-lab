=== lesson
--- step concept: NULL means "unknown", not zero or empty
`NULL` is the absence of a value. Any comparison with an unknown is itself **unknown** — SQL uses *three-valued logic*: TRUE, FALSE, UNKNOWN.

```sql
SELECT NULL = NULL;    -- NULL (unknown), not TRUE
SELECT NULL <> 1;      -- NULL
SELECT 5 + NULL;       -- NULL
```
WHERE keeps a row only if the condition is **TRUE**. UNKNOWN rows are silently dropped.

> [!THINK] Before reading on: how many customers does `WHERE email <> 'x@example.com'` return if 7 emails are NULL?

[[quiz:sql-nulls:q0]]

--- step example: Tools for NULLs
```sql
SELECT name,
       email IS NULL                  AS missing_email,
       COALESCE(email, 'no-email')    AS email_or_default,
       NULLIF(segment, '')            AS segment_clean
FROM customers;
```
- `IS NULL` / `IS NOT NULL` — the only correct tests
- `COALESCE(a, b, c)` — first non-NULL value
- `NULLIF(a, b)` — NULL if a = b (classic use: avoid divide-by-zero `x / NULLIF(y, 0)`)

--- step practice: Find the missing data
[[exercise:sql-nulls-1]]

--- step check: Aggregates and NULLs
`COUNT(*)` counts rows. `COUNT(col)` counts **non-NULL** values. `SUM`, `AVG`, `MIN`, `MAX` ignore NULLs — so `AVG(col)` is the average of known values only.

[[quiz:sql-nulls:q1]]
[[exercise:sql-nulls-2]]

--- step scenario: The NOT IN trap
`NOT IN (subquery)` returns **no rows at all** if the subquery contains a NULL, because `x NOT IN (1, NULL)` = `x <> 1 AND x <> NULL` = UNKNOWN.

[[exercise:sql-nulls-3]]

--- step interview: Explain it
[[recall:sql-nulls:r0]]

=== detailed
## What NULL is
NULL represents a **missing or unknown** value. It is not 0, not `''`, not `'NULL'`. It exists because real data is incomplete: an email not provided, a ship date not yet known, a manager that does not exist for the CEO.

## Three-valued logic
| a | b | a AND b | a OR b |
|---|---|---|---|
| TRUE | UNKNOWN | UNKNOWN | TRUE |
| FALSE | UNKNOWN | FALSE | UNKNOWN |
| UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |

`NOT UNKNOWN` is UNKNOWN. WHERE, JOIN … ON and HAVING keep rows only when the condition is TRUE. CHECK constraints, by contrast, *pass* on UNKNOWN.

## Where NULLs bite
- **Comparisons:** `col = NULL` is never true. Use `IS NULL`.
- **Negative filters:** `WHERE status <> 'cancelled'` silently drops rows whose status is NULL. If those should be included: `WHERE status <> 'cancelled' OR status IS NULL` or `COALESCE(status,'') <> 'cancelled'`.
- **NOT IN:** one NULL in the list makes the whole predicate UNKNOWN → zero rows. Use `NOT EXISTS`.
- **Arithmetic & concatenation:** `price * NULL` is NULL; `'a' || NULL` is NULL in SQLite/Postgres (BigQuery `CONCAT` also returns NULL).
- **Joins:** `NULL = NULL` is not true, so NULL keys never match in an equi-join.
- **Aggregates:** ignored by SUM/AVG/MIN/MAX/COUNT(col). `AVG` over a column with NULLs is the average of known values — which may or may not be what the business means.
- **GROUP BY / DISTINCT:** all NULLs fall into **one** group (here NULLs are treated as equal).
- **Sorting:** NULLs sort first ascending in SQLite and BigQuery; last in Postgres/Oracle.

## Functions
| Function | Meaning |
|---|---|
| `COALESCE(a,b,…)` | first non-NULL |
| `NULLIF(a,b)` | NULL when a = b |
| `IFNULL(a,b)` (SQLite/BigQuery) | two-arg COALESCE |
| `a IS DISTINCT FROM b` (Postgres/BigQuery) | NULL-safe inequality |

## Data engineering angle
> [!REAL] In pipelines, NULL handling is a **data contract** question: is NULL allowed for this column? What does it mean? Decide explicitly, document it, and test it (`not_null` tests in dbt). Never let `COALESCE(x, 0)` silently turn "unknown" into "zero revenue" without the business agreeing.

> [!WARN] Comparing old vs new rows in change detection (`WHERE old.col <> new.col`) misses changes to/from NULL. Use `IS DISTINCT FROM` or COALESCE both sides.

## Interview questions
- What is three-valued logic?
- Why might `NOT IN` return no rows?
- Difference between `COUNT(*)`, `COUNT(col)` and `COUNT(DISTINCT col)`?

=== crisp
- NULL = unknown. Any comparison with NULL → UNKNOWN → row dropped by WHERE.
- Test with `IS NULL` / `IS NOT NULL`. Never `= NULL`.
- `COALESCE(a,b)` first non-null · `NULLIF(a,b)` null if equal · `x / NULLIF(y,0)` avoids divide-by-zero.
- `COUNT(*)` rows · `COUNT(col)` non-null values · SUM/AVG/MIN/MAX ignore NULLs.
- `NOT IN (… NULL …)` → zero rows. Prefer `NOT EXISTS`.
- `<>` filters drop NULL rows too.
- NULL keys never match in joins; NULLs form one group in GROUP BY.
- Change detection: use `IS DISTINCT FROM` (NULL-safe).

=== memory
- **"NULL is a question mark."** `? = ?` → `?`.
- Trigger: *"NOT IN returned nothing"* → a NULL in the list.
- Trigger: *"row count dropped after `<>` filter"* → NULL rows vanished.
- `COUNT(*)` counts **rows**; `COUNT(col)` counts **answers**.
- COALESCE = "**co**alesce to the first **a**vailable".

=== data
flashcards:
  - q: "What does `NULL = NULL` evaluate to?"
    a: "UNKNOWN (NULL) — not TRUE. Use `IS NULL`."
  - q: "COUNT(*) vs COUNT(email)?"
    a: "COUNT(*) counts all rows; COUNT(email) counts rows where email is not NULL."
  - q: "Why can `WHERE id NOT IN (SELECT manager_id FROM employees)` return zero rows?"
    a: "If any manager_id is NULL, `id <> NULL` is UNKNOWN for every row."
  - q: "How do you avoid divide-by-zero in SQL?"
    a: "`x / NULLIF(y, 0)` — returns NULL instead of erroring."
  - q: "Do NULL join keys match each other?"
    a: "No. NULL = NULL is not TRUE, so they never match in an equi-join."
  - q: "How does GROUP BY treat NULLs?"
    a: "All NULLs are put into a single group."
quiz:
  - q: "7 customers have NULL email. `SELECT COUNT(*) FROM customers WHERE email <> 'x@example.com'` returns…"
    options:
      - "120"
      - "120 minus 7 (NULL rows are dropped)"
      - "7"
      - "an error"
    answer: 1
    explain: "For NULL emails the comparison is UNKNOWN, so WHERE drops them."
  - q: "A column has values 10, NULL, 20. What is AVG(col)?"
    options: ["10", "15", "NULL", "30"]
    answer: 1
    explain: "AVG ignores NULLs: (10 + 20) / 2 = 15."
recall:
  - q: "Explain three-valued logic and give two ways NULLs cause silent bugs in queries."
    keyPoints:
      - "TRUE, FALSE and UNKNOWN"
      - "comparisons with NULL return UNKNOWN"
      - "WHERE keeps only TRUE rows"
      - "NOT IN with a NULL returns no rows"
      - "aggregates ignore NULLs"
      - "use IS NULL or COALESCE"
exercises:
  - id: sql-nulls-1
    lang: sql
    kind: coding
    difficulty: 1
    title: Customers we cannot email
    prompt: |
      Marketing wants to know which customers have **no email**. Return `customer_id`, `name`, `city` ordered by `customer_id`.
    starter: |
      SELECT customer_id, name, city
      FROM customers
      WHERE email = NULL
      ORDER BY customer_id;
    solution: |
      SELECT customer_id, name, city
      FROM customers
      WHERE email IS NULL
      ORDER BY customer_id;
    ordered: true
    hints:
      - "Run the starter. Why does `= NULL` return nothing?"
      - "Use `IS NULL`."
  - id: sql-nulls-2
    lang: sql
    kind: predict
    difficulty: 1
    title: Three counts
    prompt: |
      In one query return three columns from `customers`: `total_rows` (all rows), `with_email` (rows with an email) and `distinct_cities`.
    starter: |
      SELECT
      FROM customers;
    solution: |
      SELECT COUNT(*) AS total_rows, COUNT(email) AS with_email, COUNT(DISTINCT city) AS distinct_cities
      FROM customers;
    hints:
      - "COUNT(*) vs COUNT(column) vs COUNT(DISTINCT column)."
  - id: sql-nulls-3
    lang: sql
    kind: debug
    difficulty: 2
    title: "Debug: employees who manage nobody"
    prompt: |
      The query should list employees who are **not anyone's manager** (individual contributors). It returns zero rows. Explain why, then fix it. Return `emp_id`, `name` ordered by `emp_id`.
    starter: |
      SELECT emp_id, name
      FROM employees
      WHERE emp_id NOT IN (SELECT manager_id FROM employees)
      ORDER BY emp_id;
    solution: |
      SELECT e.emp_id, e.name
      FROM employees e
      WHERE NOT EXISTS (SELECT 1 FROM employees r WHERE r.manager_id = e.emp_id)
      ORDER BY e.emp_id;
    ordered: true
    hints:
      - "Look at the CEO's manager_id."
      - "One NULL in a NOT IN list makes every comparison UNKNOWN."
      - "Use NOT EXISTS, or filter `WHERE manager_id IS NOT NULL` inside the subquery."
    explain: |
      `x NOT IN (2, 3, NULL)` expands to `x <> 2 AND x <> 3 AND x <> NULL`; the last term is UNKNOWN, so the whole predicate is never TRUE. `NOT EXISTS` only asks "is there a matching row?", which is NULL-safe.
interview:
  - q: "Why might a NOT IN subquery return no rows, and how do you fix it?"
    type: concept
    level: 2
    keyPoints:
      - "a NULL in the subquery result"
      - "comparison with NULL is UNKNOWN"
      - "WHERE requires TRUE"
      - "use NOT EXISTS or filter NULLs out"
    followUps:
      - "Does NOT EXISTS have the same problem?"
      - "How would you write it as a LEFT JOIN?"
  - q: "In a pipeline, how do you decide whether to COALESCE a NULL to a default value?"
    type: scenario
    level: 2
    keyPoints:
      - "NULL means unknown, default changes meaning"
      - "agree semantics with business / data contract"
      - "document and test not_null expectations"
      - "keep raw value in staging, apply defaults in a modelled layer"
