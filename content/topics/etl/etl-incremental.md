=== lesson
--- step concept: Don't reprocess everything every day
A **full load** re-reads the entire source each run — simple and self-healing, but cost and time grow with history. An **incremental load** processes only what changed since the last successful run, tracked by a **watermark** (high-water mark):

```
run N:   extract WHERE updated_at >  :last_watermark  AND updated_at <= :run_end
         load (MERGE on key)
         on success → save watermark = :run_end (or max(updated_at) loaded)
```
> [!WHY] Incremental pipelines let a 5-year table refresh in minutes. They also introduce the classic interview topics: late data, deletes, idempotency and backfills.

[[quiz:etl-incremental:q0]]

--- step concept: The hard parts
1. **Late-arriving / out-of-order data** — a row updated at 23:59 may be committed after your 00:00 extraction. Use an **overlap/lookback window** (re-read the last N hours) and dedup with MERGE.
2. **Deletes** — `updated_at` doesn't show deleted rows. Need soft-delete flags, CDC, or periodic full reconciliation.
3. **Unreliable timestamps** — `updated_at` not updated by every code path, clock skew → CDC from the transaction log is more reliable.
4. **Watermark timing** — advance it only **after** the load commits.

--- step practice: Incremental extract
[[exercise:etl-incremental-1]]

--- step practice: Apply the batch with MERGE
[[exercise:etl-incremental-2]]

--- step scenario: Missing rows
[[exercise:etl-incremental-3]]
[[recall:etl-incremental:r0]]

=== detailed
## Full vs incremental
| | Full refresh | Incremental |
|---|---|---|
| Logic | simple (`CREATE OR REPLACE`) | watermark, merge, dedup |
| Cost | grows with history | proportional to change |
| Self-healing | yes (recomputes everything) | errors persist until fixed/backfilled |
| Deletes | handled automatically | need special handling |
Rule of thumb: full refresh for small tables/dimensions; incremental for large facts/events.

## Watermark strategies
- **Timestamp column** (`updated_at`, `created_at`) — common; requires an index on the source and reliable updates.
- **Monotonic id** (`id > last_id`) — only for append-only inserts.
- **Partition/date-based** — process `dt = {{ ds }}` partitions (files/events).
- **Log position** — CDC offset / LSN / binlog position.
Store watermarks in a control table or use the orchestrator's logical interval (Airflow `data_interval_start/end` — then each run is explicitly bounded, which makes reruns and backfills trivial).

## Loading increments
- **Append** (facts that never change, deduplicated by event id),
- **MERGE/upsert** by business key (mutable entities),
- **Partition overwrite** of affected dates (when changes are confined to recent partitions).

## Lookback windows
Extract `updated_at > watermark - interval '2 hours'` to catch late commits; the overlap is safe because the MERGE is idempotent. In BigQuery/dbt incremental models: `where updated_at > (select max(updated_at) from {{ this }}) - interval 3 day`.

## Deletes
- Source soft-deletes (`is_deleted`, `deleted_at`) flow naturally.
- Hard deletes: CDC (delete events), or periodic **key reconciliation** (compare full key list → mark missing as deleted).

## dbt incremental models
```sql
{{ config(materialized='incremental', unique_key='order_id', incremental_strategy='merge',
          partition_by={'field': 'order_date', 'data_type': 'date'}) }}
select * from {{ ref('stg_orders') }}
{% if is_incremental() %}
  where updated_at > (select max(updated_at) from {{ this }}) - interval 3 day
{% endif %}
```

## Backfills
Incremental logic must also be runnable for any historical interval (parameterised windows) — or provide a full-refresh mode (`dbt run --full-refresh`).

=== crisp
- **Full** = reprocess everything (simple, self-healing, expensive). **Incremental** = only changes since **watermark** (cheap, more logic).
- Watermarks: updated_at · increasing id (append-only) · date partitions · CDC log position · orchestrator interval.
- Advance the watermark **only after** a successful load.
- **Lookback/overlap** window for late commits + **idempotent MERGE/dedup**.
- Deletes are invisible to updated_at → soft-delete flags, CDC, or key reconciliation.
- Load modes: append (immutable facts) · MERGE (mutable entities) · partition overwrite.
- dbt: `materialized='incremental'`, `unique_key`, `is_incremental()`; `--full-refresh` for rebuilds.

=== memory
- **"Move the bookmark after you finish the chapter."**
- **"Overlap + MERGE = no gaps, no duplicates."**
- Trigger: *"rows missing after incremental load"* → late commits or watermark advanced too early.

=== data
flashcards:
  - q: "What is a watermark in incremental loading?"
    a: "The position (e.g. max updated_at) up to which data has been successfully processed; the next run starts after it."
  - q: "Why add a lookback/overlap window?"
    a: "To catch rows committed late or with clock skew; the overlap is deduplicated by an idempotent MERGE."
  - q: "Why can't updated_at-based extraction see hard deletes?"
    a: "Deleted rows no longer exist in the source, so no updated timestamp appears — use CDC or reconciliation."
  - q: "When is a full refresh better than incremental?"
    a: "For small tables, when logic changes often, or when correctness/self-healing matters more than cost."
  - q: "In dbt, which macro distinguishes incremental runs?"
    a: "is_incremental()"
quiz:
  - q: "A job saves the new watermark, then the load fails. Next run…"
    options: ["reloads the failed data", "skips the failed data — it's lost", "duplicates data", "fails again"]
    answer: 1
recall:
  - q: "How do you design an incremental load and handle late-arriving data and deletes?"
    keyPoints:
      - "watermark based on updated timestamp or log position"
      - "update watermark only after successful load"
      - "lookback window to catch late data"
      - "idempotent merge or dedup"
      - "deletes via soft delete flags CDC or reconciliation"
      - "support backfills / full refresh"
exercises:
  - id: etl-incremental-1
    lang: sql
    kind: coding
    difficulty: 2
    title: Extract the increment
    prompt: |
      `etl_watermarks(table_name, last_value)` stores the last loaded `updated_at` for `stg_customers`. Return the rows of `stg_customers` changed **after** the watermark **minus a 1-hour lookback**, ordered by updated_at, stg_id. Return `stg_id`, `customer_id`, `updated_at`.

      SQLite: `datetime(x, '-1 hour')`.
    setup: |
      CREATE TABLE etl_watermarks (table_name TEXT PRIMARY KEY, last_value TEXT);
      INSERT INTO etl_watermarks VALUES ('stg_customers', '2025-08-20 12:00:00');
    starter: |
      SELECT stg_id, customer_id, updated_at
      FROM stg_customers
      WHERE updated_at > (SELECT last_value FROM etl_watermarks WHERE table_name = 'stg_customers')
    solution: |
      SELECT stg_id, customer_id, updated_at
      FROM stg_customers
      WHERE updated_at > (SELECT datetime(last_value, '-1 hour') FROM etl_watermarks WHERE table_name = 'stg_customers')
      ORDER BY updated_at, stg_id;
    ordered: true
    hints:
      - "Subtract the lookback from the watermark with datetime(…, '-1 hour')."
  - id: etl-incremental-2
    lang: sql
    kind: coding
    difficulty: 3
    title: Merge the increment and move the watermark
    prompt: |
      Apply the increment to `dim_customer(customer_id PK, city, updated_at)`:
      1. take rows from `stg_customers` with `updated_at > watermark`, keep the **latest per customer** (tie-break stg_id),
      2. upsert into `dim_customer` (only overwrite if newer),
      3. **then** set the watermark to the max `updated_at` you loaded.
      The checker returns the watermark plus the number of rows in dim_customer.
    setup: |
      CREATE TABLE etl_watermarks (table_name TEXT PRIMARY KEY, last_value TEXT);
      INSERT INTO etl_watermarks VALUES ('stg_customers', '2025-07-01 00:00:00');
      CREATE TABLE dim_customer (customer_id INTEGER PRIMARY KEY, city TEXT, updated_at TEXT);
      INSERT INTO dim_customer SELECT customer_id, city, '2025-06-30 00:00:00' FROM customers WHERE customer_id <= 50;
    starter: |
      WITH inc AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY updated_at DESC, stg_id DESC) AS rn
        FROM stg_customers
        WHERE updated_at > (SELECT last_value FROM etl_watermarks WHERE table_name = 'stg_customers')
      )
      INSERT INTO dim_customer (customer_id, city, updated_at)
      SELECT customer_id, city, updated_at FROM inc WHERE rn = 1
      ON CONFLICT (customer_id) DO UPDATE SET city = excluded.city, updated_at = excluded.updated_at
      WHERE excluded.updated_at > dim_customer.updated_at;
      -- now move the watermark
    solution: |
      WITH inc AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY updated_at DESC, stg_id DESC) AS rn
        FROM stg_customers
        WHERE updated_at > (SELECT last_value FROM etl_watermarks WHERE table_name = 'stg_customers')
      )
      INSERT INTO dim_customer (customer_id, city, updated_at)
      SELECT customer_id, city, updated_at FROM inc WHERE rn = 1
      ON CONFLICT (customer_id) DO UPDATE SET city = excluded.city, updated_at = excluded.updated_at
      WHERE excluded.updated_at > dim_customer.updated_at;
      UPDATE etl_watermarks
      SET last_value = (SELECT MAX(updated_at) FROM stg_customers WHERE updated_at > last_value)
      WHERE table_name = 'stg_customers'
        AND EXISTS (SELECT 1 FROM stg_customers WHERE updated_at > last_value);
    check: |
      SELECT (SELECT last_value FROM etl_watermarks) AS watermark, (SELECT COUNT(*) FROM dim_customer) AS customers;
    hints:
      - "The new watermark is the MAX(updated_at) of the rows you just processed."
      - "Guard against an empty increment (keep the old watermark)."
  - id: etl-incremental-3
    lang: text
    kind: scenario
    difficulty: 3
    title: The orders that never arrived
    prompt: |
      An hourly incremental job extracts `orders WHERE updated_at > :watermark` from Postgres and sets the watermark to the job start time. Finance finds ~0.5% of orders missing in BigQuery, always ones created around the top of the hour. Explain and fix.
    solution: |
      **Cause:** long-running source transactions commit **after** the extraction started but carry an `updated_at` set **before** the job start time (the timestamp is taken when the row is written, not when the transaction commits). The next run asks for `updated_at > job_start_time` → those rows are skipped forever. Clock skew between servers makes it worse. Using job start time (not max loaded value) as watermark also amplifies the gap.

      **Fix:**
      - Use a **lookback window** (e.g. re-extract the last 30–60 minutes) and **MERGE on order_id** so the overlap is harmless.
      - Set the watermark to the **max updated_at actually loaded** (or run end minus a safety lag), and only after the load succeeds.
      - Better: switch to **CDC** (Datastream/Debezium) which reads committed changes from the WAL in commit order.
      - Add a **daily reconciliation** (counts/sums per day vs source) and a backfill for missing days.
    review:
      - "Explains late commits relative to updated_at"
      - "Lookback / overlap window"
      - "Idempotent MERGE for overlap"
      - "Watermark from loaded data, after success"
      - "CDC as robust alternative"
      - "Reconciliation check"
interview:
  - q: "How would you implement incremental loading from an operational database into BigQuery?"
    type: design
    level: 3
    keyPoints:
      - "watermark on updated_at or CDC"
      - "lookback window for late data"
      - "staging table then MERGE on primary key"
      - "watermark updated after success"
      - "handle deletes"
      - "reconciliation and backfill"
    followUps:
      - "What if the source has no updated_at column?"
      - "How do you handle schema changes?"
