=== lesson
--- step concept: Dimensions change over time
A customer moves from Pune to Mumbai. Should last year's sales count under Pune or Mumbai? **Slowly Changing Dimension (SCD)** types answer that:

| Type | Behaviour | History |
|---|---|---|
| 0 | never change (original value kept) | n/a |
| 1 | **overwrite** the old value | lost |
| 2 | **add a new row** with validity dates | full |
| 3 | add a "previous value" column | one step |
| 4 | history in a separate table | full (separate) |
| 6 | 1 + 2 + 3 combined (current value on every row) | full |

> [!WHY] SCD2 lets you report "as it was" (sales attributed to the city at the time) and "as it is" (current city) — a question auditors and finance teams ask constantly.

[[quiz:dw-scd:q0]]

--- step example: An SCD2 table
| customer_sk | customer_id | city | valid_from | valid_to | is_current |
|---|---|---|---|---|---|
| 101 | 7 | Pune | 2023-01-01 | 2025-03-14 | false |
| 245 | 7 | Mumbai | 2025-03-15 | 9999-12-31 | true |

Facts store `customer_sk`, so each sale points to the version **valid at the time of the sale**.

--- step practice: Point-in-time lookup
[[exercise:dw-scd-1]]

--- step practice: Apply changes as SCD2
[[exercise:dw-scd-2]]

--- step scenario: Choose the type
[[exercise:dw-scd-3]]
[[recall:dw-scd:r0]]

=== detailed
## The problem
Dimension attributes change (address, segment, product category, sales rep). The modelling decision is whether analysis needs the **history** of an attribute.

## Type 1 — overwrite
`UPDATE dim SET city = 'Mumbai' WHERE customer_id = 7`. Simple; all history now reports Mumbai. Use for corrections (typos) or attributes where history doesn't matter.

## Type 2 — row versioning
Each change creates a new row with a new **surrogate key**; the old row is closed:
- columns: `valid_from`, `valid_to` (or NULL / 9999-12-31 for open), `is_current`, optionally `version` and a `hash_diff` of tracked attributes.
- Fact rows reference the surrogate key valid when the event happened (lookup by `natural_key` and `event_date BETWEEN valid_from AND valid_to`).
- Current view: `WHERE is_current`.

### SCD2 load algorithm
1. Stage the latest source records (deduplicated).
2. Compare tracked attributes with the current dimension row (hash or column-by-column with NULL-safe comparison).
3. For changed keys: **close** the current row (`valid_to = change_date - 1 day / timestamp`, `is_current = false`).
4. **Insert** new versions for changed keys and new keys (`valid_from = change_date`, open `valid_to`).
5. Unchanged keys: nothing.
In BigQuery this is a single `MERGE` with a union trick, or two statements in a transaction; in dbt it is a **snapshot**.

> [!WARN] Use half-open or non-overlapping intervals and test that each natural key has exactly one current row and no overlapping validity ranges.

## Type 3 — previous value column
`current_city`, `previous_city` — supports "before/after" comparisons for one change only.

## Type 4 / 6
Type 4 keeps a small current dimension plus a history table. Type 6 (hybrid) stores SCD2 rows *and* a `current_city` column updated on all versions (Type 1 on that column) — both "as was" and "as is" without extra joins.

## Late-arriving data
- **Late-arriving fact**: a sale from 3 days ago arrives today → look up the dimension version valid on the **sale date**, not today.
- **Late-arriving dimension / early fact**: fact arrives before its customer exists → insert an "unknown/inferred" member and update it when the dimension arrives.

## Choosing
Decide per attribute with the business: which attributes need history (segment, region, price tier), which are corrections (name typos). Track only the attributes you need — every tracked change multiplies rows.

=== crisp
- **Type 0** keep original · **Type 1** overwrite (no history) · **Type 2** new row per change with `valid_from/valid_to/is_current` + new surrogate key (full history) · **Type 3** previous-value column · **Type 4** separate history table · **Type 6** = 2 + current-value column.
- Facts store the **surrogate key valid at event time** → "as was" reporting; `is_current` → "as is".
- SCD2 load: stage & dedup → detect changes (hash, NULL-safe) → close old row → insert new version → ignore unchanged.
- Tests: one current row per natural key; no overlapping ranges.
- Late facts → lookup by event date. Early facts → inferred/unknown member.
- dbt **snapshots** implement SCD2.

=== memory
- **"1 forgets, 2 remembers, 3 remembers once."**
- **"Close the old, open the new."**
- Picture: SCD2 = a passport history — every old passport is kept with its validity dates.

=== data
flashcards:
  - q: "What does SCD Type 1 do?"
    a: "Overwrites the attribute — history is lost."
  - q: "What columns does an SCD Type 2 dimension usually add?"
    a: "Surrogate key, valid_from, valid_to, is_current (optionally version, hash_diff)."
  - q: "How does a fact row find the right SCD2 version?"
    a: "Lookup by natural key where the event date is between valid_from and valid_to (store that surrogate key in the fact)."
  - q: "What is SCD Type 3?"
    a: "A column holding the previous value alongside the current one — one level of history."
  - q: "Which data tests should an SCD2 table have?"
    a: "Exactly one current row per natural key, and no overlapping validity intervals."
  - q: "How does dbt implement SCD2?"
    a: "With snapshots (timestamp or check strategy)."
quiz:
  - q: "Finance wants last year's revenue by the region the customer was in at the time of sale. Which SCD type?"
    options: ["Type 1", "Type 2", "Type 0", "No dimension needed"]
    answer: 1
recall:
  - q: "Explain SCD Type 1, 2 and 3 and describe how you would load an SCD Type 2 dimension."
    keyPoints:
      - "type 1 overwrites and loses history"
      - "type 2 adds a new row with validity dates"
      - "type 3 keeps previous value in a column"
      - "detect changed records by comparing attributes or hash"
      - "close the current row and insert the new version"
      - "facts reference surrogate keys valid at event time"
exercises:
  - id: dw-scd-1
    lang: sql
    kind: coding
    difficulty: 2
    title: Point-in-time attribution
    prompt: |
      `dim_customer_scd(customer_sk, customer_id, city, valid_from, valid_to)` is an SCD2 table (open rows have `valid_to = '9999-12-31'`). `sales(sale_id, customer_id, sale_date, amount)` stores only the natural key.

      Return revenue by the city the customer lived in **at the time of each sale**: `city`, `revenue` (rounded 2), ordered by city.
    setup: |
      CREATE TABLE dim_customer_scd (customer_sk INTEGER, customer_id INTEGER, city TEXT, valid_from TEXT, valid_to TEXT);
      INSERT INTO dim_customer_scd VALUES (1, 7, 'Pune', '2023-01-01', '2025-03-14'), (2, 7, 'Mumbai', '2025-03-15', '9999-12-31'),
        (3, 8, 'Delhi', '2024-01-01', '9999-12-31'), (4, 9, 'Chennai', '2024-01-01', '2024-12-31'), (5, 9, 'Bengaluru', '2025-01-01', '9999-12-31');
      CREATE TABLE sales (sale_id INTEGER, customer_id INTEGER, sale_date TEXT, amount REAL);
      INSERT INTO sales VALUES (1, 7, '2025-01-10', 100), (2, 7, '2025-04-01', 250), (3, 8, '2025-02-02', 80),
        (4, 9, '2024-06-30', 40), (5, 9, '2025-05-05', 60), (6, 7, '2025-03-15', 10);
    starter: |
      SELECT d.city, ROUND(SUM(s.amount), 2) AS revenue
      FROM sales s
      JOIN dim_customer_scd d ON d.customer_id = s.customer_id
    solution: |
      SELECT d.city, ROUND(SUM(s.amount), 2) AS revenue
      FROM sales s
      JOIN dim_customer_scd d
        ON d.customer_id = s.customer_id
       AND s.sale_date BETWEEN d.valid_from AND d.valid_to
      GROUP BY d.city
      ORDER BY d.city;
    ordered: true
    hints:
      - "Joining only on customer_id matches every version (fan-out)."
      - "Add the condition sale_date BETWEEN valid_from AND valid_to."
  - id: dw-scd-2
    lang: sql
    kind: scenario
    difficulty: 3
    title: Apply a change batch as SCD2
    prompt: |
      Today is **2025-06-01**. `stg_changes(customer_id, city)` holds today's source state for some customers. Update `dim_customer_scd` (columns `customer_sk, customer_id, city, valid_from, valid_to, is_current`):
      1. For customers whose city **changed**: close the current row (`valid_to = '2025-05-31'`, `is_current = 0`) and insert a new current row (`valid_from = '2025-06-01'`, `valid_to = '9999-12-31'`, `is_current = 1`).
      2. **New** customers: insert a current row.
      3. Unchanged customers: do nothing.
      New `customer_sk` values: use `(SELECT MAX(customer_sk) FROM dim_customer_scd) + ROW_NUMBER() OVER (ORDER BY customer_id)`.
      The checker lists the whole table ordered by customer_id, valid_from (ignoring surrogate keys).
    setup: |
      CREATE TABLE dim_customer_scd (customer_sk INTEGER, customer_id INTEGER, city TEXT, valid_from TEXT, valid_to TEXT, is_current INTEGER);
      INSERT INTO dim_customer_scd VALUES (1, 7, 'Pune', '2023-01-01', '9999-12-31', 1), (2, 8, 'Delhi', '2024-01-01', '9999-12-31', 1), (3, 9, 'Goa', '2024-02-01', '9999-12-31', 1);
      CREATE TABLE stg_changes (customer_id INTEGER, city TEXT);
      INSERT INTO stg_changes VALUES (7, 'Mumbai'), (8, 'Delhi'), (10, 'Hyderabad');
    starter: |
      -- 1. insert new versions for changed + new customers (do this BEFORE closing, or compute changes first)
      -- 2. close the old current rows of changed customers
    solution: |
      CREATE TEMP TABLE changed AS
        SELECT s.customer_id, s.city
        FROM stg_changes s
        LEFT JOIN dim_customer_scd d ON d.customer_id = s.customer_id AND d.is_current = 1
        WHERE d.customer_id IS NULL OR d.city IS NOT s.city;
      UPDATE dim_customer_scd
        SET valid_to = '2025-05-31', is_current = 0
        WHERE is_current = 1 AND customer_id IN (SELECT customer_id FROM changed);
      INSERT INTO dim_customer_scd (customer_sk, customer_id, city, valid_from, valid_to, is_current)
        SELECT (SELECT MAX(customer_sk) FROM dim_customer_scd) + ROW_NUMBER() OVER (ORDER BY customer_id), customer_id, city, '2025-06-01', '9999-12-31', 1
        FROM changed;
    check: |
      SELECT customer_id, city, valid_from, valid_to, is_current FROM dim_customer_scd ORDER BY customer_id, valid_from;
    ordered: true
    hints:
      - "First compute the set of changed-or-new customers (compare with the CURRENT row, NULL-safe: `IS NOT`)."
      - "Then close their current rows, then insert the new versions."
    explain: |
      Capturing the change set first avoids the trap where, after closing rows, every customer looks "new". In BigQuery or Snowflake this is often a single MERGE; in dbt, a snapshot.
  - id: dw-scd-3
    lang: text
    kind: scenario
    difficulty: 2
    title: Which SCD type, attribute by attribute?
    prompt: |
      For a `dim_customer` decide the SCD handling for: `name` (typo fixes happen), `email`, `loyalty_tier` (Bronze/Silver/Gold — marketing measures upgrades), `city` (finance reports revenue by region at time of sale), `date_of_birth`. Justify each.
    solution: |
      - **name** — Type 1: changes are corrections; history adds no value.
      - **email** — Type 1 (current contact); if needed for audit, keep history in a separate (Type 4) table, mind PII.
      - **loyalty_tier** — Type 2 (or Type 6 to also have the current tier on all rows): marketing analyses behaviour before/after upgrades.
      - **city** — Type 2: revenue must be attributed to the region at the time of sale.
      - **date_of_birth** — Type 0/1: fixed fact; corrections overwrite.
    review:
      - "Name as Type 1 (corrections)"
      - "Loyalty tier tracked with history (Type 2 or 6)"
      - "City Type 2 for point-in-time reporting"
      - "Date of birth Type 0/1"
      - "Justification tied to business questions"
interview:
  - q: "Explain slowly changing dimensions. How would you implement SCD Type 2 in BigQuery?"
    type: design
    level: 3
    keyPoints:
      - "attributes change over time and history may matter"
      - "type 1 overwrite type 2 new row type 3 previous column"
      - "valid_from valid_to is_current surrogate key"
      - "detect changes via hash comparison"
      - "MERGE to close old rows and insert new versions"
      - "facts join on event date within validity"
    followUps:
      - "How do you handle late-arriving facts?"
      - "How do you test an SCD2 table?"
