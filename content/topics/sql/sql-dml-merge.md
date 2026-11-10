=== lesson
--- step concept: Changing data safely
- `INSERT` adds rows, `UPDATE` changes rows, `DELETE` removes rows.
- An **upsert** (update-or-insert) applies a batch of changes to a target: update rows whose key exists, insert the rest. In BigQuery/Snowflake/SQL Server this is `MERGE`; in SQLite/Postgres it is `INSERT … ON CONFLICT … DO UPDATE`.

> [!WHY] Loading data into a warehouse is mostly upserts: apply today's changed customers to the customer table without duplicating them.

```sql
-- BigQuery / standard MERGE
MERGE dim_customer t
USING stg_latest s
ON t.customer_id = s.customer_id
WHEN MATCHED AND s.updated_at > t.updated_at THEN
  UPDATE SET name = s.name, email = s.email, city = s.city, updated_at = s.updated_at
WHEN NOT MATCHED THEN
  INSERT (customer_id, name, email, city, updated_at) VALUES (s.customer_id, s.name, s.email, s.city, s.updated_at);
```
```sql
-- SQLite / Postgres equivalent
INSERT INTO dim_customer (customer_id, name, email, city, updated_at)
SELECT customer_id, name, email, city, updated_at FROM stg_latest WHERE true
ON CONFLICT (customer_id) DO UPDATE SET
  name = excluded.name, email = excluded.email, city = excluded.city, updated_at = excluded.updated_at
WHERE excluded.updated_at > dim_customer.updated_at;
```

[[quiz:sql-dml-merge:q0]]

--- step practice: Idempotent updates
Running a statement twice should leave the data in the same state as running it once — that property is **idempotency**, and pipelines depend on it because jobs get retried.

[[exercise:sql-dml-merge-1]]

--- step practice: Remove exact duplicates
[[exercise:sql-dml-merge-2]]

--- step scenario: Upsert the CRM feed
[[exercise:sql-dml-merge-3]]
[[recall:sql-dml-merge:r0]]

=== detailed
## DML statements
| Statement | Notes |
|---|---|
| `INSERT INTO t (cols) VALUES …` / `INSERT INTO t SELECT …` | always list columns explicitly |
| `UPDATE t SET c = … WHERE …` | **always** write the WHERE first; check with a SELECT using the same WHERE |
| `DELETE FROM t WHERE …` | same; prefer soft deletes (`is_deleted`) for auditability |
| `TRUNCATE t` | removes all rows fast, minimal logging, no WHERE |
| `MERGE` | upsert + optional delete in one atomic statement |

## Upserts and MERGE
`MERGE` compares a **source** (changes) with a **target** on a key:
- `WHEN MATCHED [AND condition] THEN UPDATE …` (or `DELETE`)
- `WHEN NOT MATCHED [BY TARGET] THEN INSERT …`
- `WHEN NOT MATCHED BY SOURCE THEN DELETE` (BigQuery/SQL Server: remove target rows absent from a full snapshot)

> [!WARN] MERGE fails (BigQuery: "UPDATE/MERGE must match at most one source row for each target row") if the source has **duplicate keys**. Always deduplicate the source first — usually with `ROW_NUMBER() … = 1`.

## Idempotency
A load is idempotent if re-running it gives the same result:
- ✗ `UPDATE products SET price = price * 1.1` — every retry adds another 10%.
- ✓ `UPDATE products SET price = new.price FROM price_changes new …` — sets an absolute value.
- ✗ `INSERT INTO fact SELECT … FROM staging` — retry duplicates rows.
- ✓ MERGE on a key, or delete-then-insert the partition being loaded inside one transaction.

> [!REAL] Airflow retries failed tasks automatically. A non-idempotent task that failed *after* its INSERT committed will insert the same rows twice on retry.

## Transactions
`BEGIN; … COMMIT;` makes several statements atomic: all succeed or none (`ROLLBACK`). Warehouses differ: BigQuery supports multi-statement transactions; each DML statement is atomic on its own.

## Performance in warehouses
- BigQuery bills DML by bytes scanned and has DML quotas — batch changes, avoid row-by-row updates.
- Restrict MERGE target scans with a partition filter in the ON clause (`AND t.dt >= '2025-06-01'`).
- Columnar warehouses rewrite whole storage blocks on update; frequent small updates are expensive. Append + periodic compaction or partition overwrite is often cheaper.

## Common mistakes
> [!MISTAKE] UPDATE/DELETE without WHERE.

> [!MISTAKE] MERGE with a non-unique source key.

> [!MISTAKE] Relative updates (`x = x + 1`) in retried jobs.

> [!MISTAKE] Change detection with `<>` that ignores NULL → use `IS DISTINCT FROM`.

=== crisp
- INSERT / UPDATE / DELETE; always list columns; write WHERE first and test it with SELECT.
- **Upsert** = update if key exists else insert. `MERGE` (BigQuery/Snowflake) or `INSERT … ON CONFLICT (key) DO UPDATE SET col = excluded.col` (SQLite/Postgres).
- MERGE needs a **unique source key** → dedup with ROW_NUMBER first.
- **Idempotent** = same result if re-run. Set absolute values, upsert on keys, overwrite partitions. Never `x = x * 1.1` in a retried job.
- Exact duplicates: keep `MIN(rowid)` per full row.
- Soft delete (`is_deleted`) keeps history and auditability.
- Warehouses: DML scans cost money; batch it; filter partitions in MERGE ON.

=== memory
- **"MERGE = Match → update, No match → insert."**
- **Idempotent ≈ "press the button twice, same result."**
- Trigger: *"MERGE error: multiple source rows"* → duplicate keys in source.
- Trigger: *"numbers doubled after retry"* → non-idempotent INSERT/UPDATE.

=== data
flashcards:
  - q: "What is an upsert?"
    a: "Update rows whose key already exists in the target, insert the others."
  - q: "Why must the MERGE source have unique keys?"
    a: "A target row may match at most one source row; duplicates make the update ambiguous (BigQuery errors)."
  - q: "Is `UPDATE products SET price = price * 1.1` idempotent?"
    a: "No — each re-run increases prices again. Set absolute values from a source instead."
  - q: "SQLite/Postgres syntax for upsert?"
    a: "INSERT … ON CONFLICT (key) DO UPDATE SET col = excluded.col [WHERE …]"
  - q: "How do you make a daily load of a partition idempotent?"
    a: "Delete/overwrite that partition then insert (atomically), or MERGE on a key."
quiz:
  - q: "A daily job runs `INSERT INTO fact_sales SELECT * FROM staging_sales_today`. It fails after the insert and Airflow retries it. Result?"
    options:
      - "Nothing changes"
      - "Today's rows are duplicated"
      - "The table is truncated"
      - "The insert is rolled back automatically"
    answer: 1
    explain: "The first insert committed; the retry inserts the same rows again. Use MERGE or partition overwrite."
recall:
  - q: "Explain what makes a data load idempotent and give two techniques."
    keyPoints:
      - "re-running gives the same final state"
      - "retries are common in pipelines"
      - "MERGE / upsert on a business key"
      - "delete or overwrite the partition before insert"
      - "avoid relative updates"
      - "deduplicate the source"
exercises:
  - id: sql-dml-merge-1
    lang: sql
    kind: debug
    difficulty: 2
    title: "Debug: the price update that keeps growing"
    prompt: |
      A table `price_changes(product_id, new_price)` contains approved new prices. The current job runs `UPDATE products SET price = price * 1.1 WHERE product_id IN (SELECT product_id FROM price_changes)` — and prices grow every time the job is retried.

      Write an **idempotent** UPDATE that sets each listed product's price to its `new_price`. The checker runs your statement and then inspects the `products` table.
    setup: |
      CREATE TABLE price_changes (product_id INTEGER PRIMARY KEY, new_price REAL);
      INSERT INTO price_changes VALUES (1, 19.99), (5, 299.0), (12, 45.5), (20, 15.0);
    starter: |
      UPDATE products
      SET price = price * 1.1
      WHERE product_id IN (SELECT product_id FROM price_changes);
    solution: |
      UPDATE products
      SET price = (SELECT pc.new_price FROM price_changes pc WHERE pc.product_id = products.product_id)
      WHERE product_id IN (SELECT product_id FROM price_changes);
    check: |
      SELECT product_id, price FROM products ORDER BY product_id;
    ordered: true
    hints:
      - "Set an absolute value taken from price_changes, not a multiple of the current value."
      - "A correlated subquery in SET can look up the new price for each product."
    explain: |
      Re-running this statement leaves the same prices — it is idempotent. Postgres/BigQuery also allow `UPDATE … FROM price_changes` joins.
  - id: sql-dml-merge-2
    lang: sql
    kind: coding
    difficulty: 2
    title: Delete exact duplicate events
    prompt: |
      `events_raw` received some events twice (at-least-once delivery). Delete the duplicates, keeping **one** copy of each identical row. The checker then counts rows and distinct event ids.

      Hint: SQLite has a hidden `rowid` on every table.
    setup: |
      CREATE TABLE events_raw AS SELECT event_id, user_id, event_type, event_time FROM web_events;
      INSERT INTO events_raw SELECT event_id, user_id, event_type, event_time FROM web_events WHERE event_id % 7 = 0;
    starter: |
      DELETE FROM events_raw
      WHERE
    solution: |
      DELETE FROM events_raw
      WHERE rowid NOT IN (
        SELECT MIN(rowid) FROM events_raw GROUP BY event_id, user_id, event_type, event_time
      );
    check: |
      SELECT COUNT(*) AS row_count, COUNT(DISTINCT event_id) AS distinct_ids FROM events_raw;
    hints:
      - "Group by all columns to find identical rows."
      - "Keep MIN(rowid) per group, delete the rest."
  - id: sql-dml-merge-3
    lang: sql
    kind: scenario
    difficulty: 3
    title: Upsert the CRM feed into dim_customer
    prompt: |
      `dim_customer` holds a snapshot of customers 1–60 as of 2024-12-31. Apply `stg_customers`:
      1. Deduplicate the feed — latest `updated_at` per customer, tie-break highest `stg_id`.
      2. **Update** existing customers only if the feed version is newer; **insert** customers that are new.
      3. Store `TRIM(name)` and `LOWER(email)`.

      Use `INSERT … ON CONFLICT(customer_id) DO UPDATE`. The checker inspects `dim_customer` afterwards.
    setup: |
      CREATE TABLE dim_customer (customer_id INTEGER PRIMARY KEY, name TEXT, email TEXT, city TEXT, updated_at TEXT);
      INSERT INTO dim_customer SELECT customer_id, name, email, city, '2024-12-31 00:00:00' FROM customers WHERE customer_id <= 60;
    starter: |
      WITH latest AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY updated_at DESC, stg_id DESC) AS rn
        FROM stg_customers
      )
      INSERT INTO dim_customer (customer_id, name, email, city, updated_at)
      SELECT
    solution: |
      WITH latest AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY updated_at DESC, stg_id DESC) AS rn
        FROM stg_customers
      )
      INSERT INTO dim_customer (customer_id, name, email, city, updated_at)
      SELECT customer_id, TRIM(name), LOWER(email), city, updated_at
      FROM latest
      WHERE rn = 1
      ON CONFLICT (customer_id) DO UPDATE SET
        name = excluded.name, email = excluded.email, city = excluded.city, updated_at = excluded.updated_at
      WHERE excluded.updated_at > dim_customer.updated_at;
    check: |
      SELECT customer_id, name, email, city, updated_at FROM dim_customer ORDER BY customer_id;
    ordered: true
    hints:
      - "Select from the deduplicated CTE where rn = 1."
      - "ON CONFLICT (customer_id) DO UPDATE SET col = excluded.col"
      - "Add WHERE excluded.updated_at > dim_customer.updated_at so older versions never overwrite newer data."
    explain: |
      This is exactly the BigQuery `MERGE … WHEN MATCHED AND s.updated_at > t.updated_at THEN UPDATE … WHEN NOT MATCHED THEN INSERT` pattern. Run it twice — the result does not change: idempotent.
interview:
  - q: "How would you load daily changed customer records into a warehouse table without creating duplicates, even if the job is retried?"
    type: scenario
    level: 2
    keyPoints:
      - "deduplicate the source per business key"
      - "MERGE / upsert on the key"
      - "only update if the source record is newer"
      - "idempotent so retries are safe"
      - "filter target partitions to control cost"
    followUps:
      - "How would you also keep history of changes?"
      - "What if the source sends deletes?"
