=== lesson
--- step concept: Safe to run twice
A pipeline step is **idempotent** if running it once or many times with the same input produces the **same final state**.

Why it matters: jobs fail and get **retried** (Airflow retries, pod restarts, network blips). Engineers **rerun** days after fixing bugs. Schedulers **backfill** history. If a step isn't idempotent, every rerun risks duplicates or double-applied changes.

| Not idempotent | Idempotent |
|---|---|
| `INSERT INTO fact SELECT … FROM today` | `DELETE` today's partition then insert, atomically — or overwrite the partition |
| `UPDATE t SET balance = balance + x` | `MERGE … SET balance = source.balance` |
| append each API page to a file | write `dt=2025-06-01/data.json` (overwrite) |
| "process files since last run time = now()" | process the explicit window `[data_interval_start, data_interval_end)` |

[[quiz:def-idempotency:q0]]

--- step example: Partition overwrite
```sql
-- BigQuery: replace exactly one day, safely re-runnable
DELETE FROM mart.fct_orders WHERE order_date = '2025-06-01';
INSERT INTO mart.fct_orders SELECT … FROM staging.orders WHERE order_date = '2025-06-01';
-- (in a transaction, or use a partition-decorated load with WRITE_TRUNCATE:  fct_orders$20250601)
```
Each run is parameterised by **the logical date it processes**, never by "now".

--- step check: Spot the problem
[[exercise:def-idempotency-1]]
[[exercise:def-idempotency-2]]

--- step scenario: Backfilling a year
[[exercise:def-idempotency-3]]
[[recall:def-idempotency:r0]]

=== detailed
## Definition
`f(f(x)) = f(x)` — applying the operation again does not change the result. For pipelines: rerunning a task for the same logical interval leaves the target identical.

## Sources of non-idempotency
1. **Appends** without dedup (INSERT, file append).
2. **Relative updates** (`x = x + 1`).
3. **Time-dependent logic** (`WHERE updated_at > NOW() - 1 day`, `CURRENT_DATE()` inside transforms) — a rerun tomorrow processes a different window.
4. **Non-deterministic logic** — `ROW_NUMBER()` without tie-breaker, `LIMIT` without ORDER BY, random sampling, generated UUIDs as keys.
5. **Side effects** — sending emails, calling external APIs that create records.

## Techniques
- **Parameterise by logical date/interval** (Airflow `data_interval_start/end`, `{{ ds }}`), not wall-clock time.
- **Overwrite partitions** (`WRITE_TRUNCATE` on `table$YYYYMMDD`, Spark dynamic partition overwrite, `INSERT OVERWRITE`).
- **MERGE / upsert** on natural/business keys; dedupe source first.
- **Deterministic keys**: derive surrogate keys by hashing business keys (`FARM_FINGERPRINT(customer_id)`, `md5(...)`) rather than random UUIDs.
- **Atomic swaps**: build into a temp table/location, then swap/rename in one step.
- **Idempotency keys** for external side effects (payment APIs accept an `Idempotency-Key` header; store "already sent" markers for emails).
- **Exactly-once-ish ingestion**: dedupe by event id downstream.

## Backfills and reruns
Because each run handles one explicit interval and overwrites its output, you can rerun any day, or backfill a year as 365 independent runs (in parallel, bounded by `max_active_runs`). Track which intervals succeeded.

## Testing idempotency
Run the job twice on the same input in a test environment and assert the target is identical (row counts, checksums).

=== crisp
- **Idempotent** = rerun with same input → same final state. Needed for retries, reruns, backfills.
- Killers: blind appends, relative updates, `NOW()`/`CURRENT_DATE` in logic, non-deterministic ordering/keys, external side effects.
- Fixes: **parameterise by logical interval**, **overwrite partitions**, **MERGE on keys**, deterministic (hashed) keys, atomic swap, idempotency keys for APIs.
- Backfill = many independent interval runs → only safe if idempotent.
- Test: run twice, compare outputs.

=== memory
- **"Press the button twice — nothing changes."**
- **"Dates are parameters, not clocks."**
- Trigger: *"duplicates after retry"* / *"numbers changed after rerun"* → idempotency bug.

=== data
flashcards:
  - q: "What does idempotent mean for a pipeline task?"
    a: "Running it multiple times for the same input/interval leaves the same final state as running it once."
  - q: "Why is `WHERE updated_at > CURRENT_DATE() - 1` bad in a daily job?"
    a: "The window depends on when it runs; reruns/backfills process the wrong data. Use the run's logical interval."
  - q: "Two techniques for idempotent loads into a warehouse?"
    a: "Partition overwrite for the processed interval, and MERGE/upsert on business keys."
  - q: "How do you make surrogate keys deterministic?"
    a: "Hash the business key(s) instead of generating random UUIDs or sequences."
  - q: "How do you make an API side effect (e.g. charging a card) safe to retry?"
    a: "Send an idempotency key so the server recognises repeated requests."
quiz:
  - q: "Which daily load is idempotent?"
    options:
      - "INSERT INTO sales SELECT * FROM staging"
      - "Overwrite partition sales$20250601 with staging data for 2025-06-01"
      - "UPDATE totals SET revenue = revenue + today_revenue"
      - "Append yesterday's file to sales.csv"
    answer: 1
recall:
  - q: "What is idempotency and how do you design pipelines to be idempotent?"
    keyPoints:
      - "same result when rerun"
      - "needed for retries reruns and backfills"
      - "parameterise by logical date not current time"
      - "overwrite partitions or merge on keys"
      - "deterministic logic and keys"
      - "avoid relative updates and blind appends"
exercises:
  - id: def-idempotency-1
    lang: mcq
    kind: concept
    difficulty: 2
    title: The rerun that changed history
    prompt: |
      A daily SQL model computes `WHERE order_date = CURRENT_DATE() - 1`. On 10 June you rerun the failed run of 3 June. What happens?
    choices:
      - "3 June is reprocessed correctly"
      - "9 June is processed again instead of 3 June"
      - "Nothing — the query errors"
      - "Both days are processed"
    answer: 1
    explain: |
      The window is tied to the wall clock. Use the run's logical date (e.g. Airflow `{{ ds }}`) as a parameter.
  - id: def-idempotency-2
    lang: sql
    kind: coding
    difficulty: 2
    title: Make the daily load idempotent
    prompt: |
      `fct_daily` holds one row per `sale_date, store_id`. The setup already loaded 2025-01-10 once. Write the statements that (re)load **2025-01-10** from `daily_sales` so that running your code any number of times leaves exactly one correct row per store for that date. The checker runs your code **twice in a row** (like a retry) and then counts rows.
    setup: |
      CREATE TABLE fct_daily (sale_date TEXT, store_id INTEGER, revenue REAL);
      INSERT INTO fct_daily SELECT sale_date, store_id, revenue FROM daily_sales WHERE sale_date = '2025-01-10';
    starter: |
      INSERT INTO fct_daily
      SELECT sale_date, store_id, revenue FROM daily_sales WHERE sale_date = '2025-01-10';
    solution: |
      DELETE FROM fct_daily WHERE sale_date = '2025-01-10';
      INSERT INTO fct_daily
      SELECT sale_date, store_id, revenue FROM daily_sales WHERE sale_date = '2025-01-10';
    repeat: 2
    check: |
      SELECT sale_date, store_id, COUNT(*) AS copies FROM fct_daily GROUP BY sale_date, store_id ORDER BY store_id;
    ordered: true
    hints:
      - "Remove that day's rows before inserting them again."
    explain: |
      Delete-then-insert of exactly the processed partition (inside a transaction) — or `WRITE_TRUNCATE` into `fct_daily$20250110` in BigQuery — is the classic idempotent pattern.
  - id: def-idempotency-3
    lang: text
    kind: scenario
    difficulty: 3
    title: Backfill one year
    prompt: |
      A bug in currency conversion affected `fct_revenue` for the past 12 months. The pipeline runs daily in Airflow. Describe how you would backfill safely.
    solution: |
      1. **Fix and test** the transformation on a few sample days in a dev dataset; compare old vs new outputs.
      2. Confirm each run is **idempotent and interval-parameterised** (uses `data_interval_start/end`, overwrites its own partition / MERGEs).
      3. **Backfill** with `airflow dags backfill -s 2024-06-01 -e 2025-05-31` (or clear task instances), with `max_active_runs` limited to protect the warehouse and quotas; optionally write to a shadow table first and swap.
      4. **Validate**: row counts per day, reconciliation with source totals, spot-check conversions; run data tests.
      5. **Downstream**: rebuild dependent models/aggregates; refresh dashboards; communicate the correction and the period affected.
      6. **Monitor cost** (bytes scanned) and record the backfill in the incident log.
    review:
      - "Fix and validate on a sample first"
      - "Relies on idempotent, interval-based runs"
      - "Uses Airflow backfill / clearing with limited concurrency"
      - "Validates results and reconciles"
      - "Rebuilds downstream and communicates"
interview:
  - q: "What does idempotent mean in data pipelines and why is it important?"
    type: concept
    level: 2
    keyPoints:
      - "same result when executed multiple times"
      - "retries and reruns are common"
      - "prevents duplicates and double counting"
      - "partition overwrite or merge"
      - "logical date parameters"
    followUps:
      - "How would you make a streaming sink idempotent?"
