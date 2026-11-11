=== lesson
--- step concept: Views, materialized views, tables
| | Stores data? | Fresh? | Cost when read |
|---|---|---|---|
| **View** | no — a saved query | always | full query each time |
| **Materialized view** | yes, maintained automatically | near real-time | small — reads precomputed results |
| **Table** | yes | when you rebuild it | only the table |

Views are great for hiding complexity or exposing safe columns; materialized views for repeated aggregates; tables for heavy transformations you control.

[[quiz:bq-features:q0]]

--- step example: MERGE for upserts
```sql
MERGE mart.dim_customer T
USING stg.customers_today S
ON T.customer_id = S.customer_id
WHEN MATCHED AND T.city != S.city THEN
  UPDATE SET city = S.city, updated_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN
  INSERT (customer_id, city, updated_at) VALUES (S.customer_id, S.city, CURRENT_TIMESTAMP());
```
One atomic statement inserts new rows and updates changed ones. Add a partition filter on `T` when the target is huge.

[[quiz:bq-features:q1]]

--- step concept: Scheduled queries
For simple ELT — "rebuild this summary table every morning" — BigQuery can run a query on a schedule and write the result to a table. When there are dependencies, retries and alerts across many steps, use an orchestrator (Airflow) instead.

--- step scenario: Time travel saves the day
BigQuery keeps every table's history for up to **7 days**: `SELECT * FROM t FOR SYSTEM_TIME AS OF TIMESTAMP '…'`.

[[exercise:bq-features-1]]

--- step check: Pick the feature
[[quiz:bq-features:q2]]

--- step interview: Explain it
[[recall:bq-features:r0]]

=== detailed
## Views
- Logical only — the query runs each time.
- **Authorized views** let users query the view without access to the underlying tables (column/row filtering).
- Good for: renaming, hiding PII, simple joins, stable interfaces over changing tables.

## Materialized views
- Precomputed and **incrementally refreshed** by BigQuery as base tables change.
- The optimizer can **automatically rewrite** queries against the base table to use the MV.
- Limitations: restricted SQL (aggregations, some joins); best for `GROUP BY` summaries over large append-heavy tables.

## MERGE
```sql
MERGE target T USING source S ON <match condition>
WHEN MATCHED [AND cond] THEN UPDATE SET ... | DELETE
WHEN NOT MATCHED [BY TARGET] THEN INSERT ...
WHEN NOT MATCHED BY SOURCE [AND cond] THEN DELETE | UPDATE ...
```
- Atomic: all changes or none.
- Source must have **one row per key**, or MERGE errors ("must match at most one source row") — deduplicate first.
- Use `IS DISTINCT FROM`-style comparisons for NULL-safe change detection.
- For partitioned targets add a filter like `T.order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)` in the `ON` clause to limit scanned partitions.

## Scheduled queries
- Managed by the BigQuery Data Transfer Service.
- Parameters `@run_date`, `@run_time` for date-based loads; write disposition append/truncate; destination table templates like `sales_{run_date}`.
- No cross-step dependency management — that's an orchestrator's job.

## Recovery features
- **Time travel:** query or restore a table as it was up to 7 days ago (`FOR SYSTEM_TIME AS OF`).
- **Fail-safe:** a further 7 days, recoverable only via support.
- **Table snapshots:** cheap point-in-time copies kept as long as you like; take one before risky changes.
- **Table clones:** writable copies that only store differences — great for testing.

```sql
CREATE OR REPLACE TABLE mart.dim_customer AS
SELECT * FROM mart.dim_customer FOR SYSTEM_TIME AS OF TIMESTAMP '2025-03-14 10:10:00+05:30';
```

=== crisp
| Object | Stored? | Freshness | Use |
|---|---|---|---|
| **View** | no (query saved) | always current | reuse logic, security (authorized views) |
| **Materialized view** | yes, auto-refreshed incrementally | near-current | repeated aggregations; queries auto-rewritten to use it |
| **Table** (from CTAS/scheduled query/dbt) | yes | as of last build | modelled layers, complex logic |

- **Scheduled queries**: run SQL on a schedule (e.g. daily `INSERT`/`MERGE` with `@run_date`) — simple ELT without an orchestrator; limited dependencies/retries → use Airflow/dbt as complexity grows.
- **MERGE** for upserts and SCD into partitioned tables; add a partition filter on the target in the `ON` clause to limit scanned bytes.
- **Time travel**: query a table as it was up to 7 days ago — `SELECT * FROM t FOR SYSTEM_TIME AS OF TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)`; restore accidentally deleted/overwritten data. **Fail-safe** gives 7 more days (via support).
- **Snapshots** (point-in-time read-only copies, cheap) and **clones** (writable, copy-on-write) for backups and testing.
- **Scripting & procedures**: `DECLARE`, `SET`, `IF`, `LOOP`, `BEGIN … EXCEPTION`, transactions (`BEGIN TRANSACTION … COMMIT`).
- **BigQuery ML**: `CREATE MODEL` in SQL; **Search indexes** for needle-in-haystack lookups.

=== memory
- **"View = recipe, materialized view = pre-cooked meal kept warm, table = frozen meal."**
- **"Oops in BigQuery? Time travel FOR SYSTEM_TIME AS OF."**

=== data
flashcards:
  - q: "View vs materialized view?"
    a: "A view stores only the query (computed at read time); a materialized view stores precomputed results refreshed automatically."
  - q: "How do you recover a table overwritten 2 hours ago?"
    a: "Time travel: SELECT … FOR SYSTEM_TIME AS OF a timestamp before the overwrite, then restore (CTAS / copy)."
  - q: "How far back does BigQuery time travel go by default?"
    a: "7 days (configurable 2–7)."
  - q: "Snapshot vs clone?"
    a: "Snapshot: read-only point-in-time copy. Clone: writable copy sharing storage until changed."
quiz:
  - q: "A dashboard repeatedly runs the same daily aggregate over a huge table. Best fit?"
    options: ["View", "Materialized view", "Temporary table", "Cross join"]
    answer: 1
  - q: "A MERGE fails with 'UPDATE/MERGE must match at most one source row for each target row'. Fix?"
    options: ["add LIMIT 1", "switch to INSERT", "partition the source", "deduplicate the source to one row per key before merging"]
    answer: 3
    explain: "Each target row may match only one source row; compact the source to the latest row per key."
  - q: "You need to share revenue by region with another team without giving access to the raw table. Use…"
    options: ["the raw table with Viewer role", "a scheduled query to Sheets", "an authorized view", "a table copy emailed weekly"]
    answer: 2
    explain: "Authorized views expose only the query result while the base table stays private."
recall:
  - q: "Compare views, materialized views and tables, and explain how MERGE and time travel are used in BigQuery pipelines."
    keyPoints:
      - "views are saved queries, run every time"
      - "materialized views precompute and refresh incrementally"
      - "MERGE does atomic upserts and needs one source row per key"
      - "partition filter in MERGE to limit cost"
      - "time travel up to 7 days"
      - "snapshots before risky changes"
exercises:
  - id: bq-features-1
    lang: text
    kind: scenario
    difficulty: 2
    title: "Recover from a bad MERGE"
    prompt: |
      At 10:15 a buggy MERGE overwrote `mart.dim_customer` with wrong city values. It's now 11:00. Describe (with BigQuery SQL) how you restore the table and prevent the bad job from running again.
    solution: |
      1. **Pause** the scheduler/Airflow DAG that runs the MERGE.
      2. Inspect the pre-incident state with time travel:
      ```sql
      SELECT * FROM mart.dim_customer FOR SYSTEM_TIME AS OF TIMESTAMP '2025-06-01 10:10:00+05:30';
      ```
      3. Restore:
      ```sql
      CREATE OR REPLACE TABLE mart.dim_customer AS
      SELECT * FROM mart.dim_customer FOR SYSTEM_TIME AS OF TIMESTAMP '2025-06-01 10:10:00+05:30';
      ```
      (or copy into a new table first, compare, then swap; CREATE OR REPLACE resets time-travel history, so keeping a snapshot of the bad state helps the investigation.)
      4. Rebuild dependent tables; fix the MERGE (test on a clone), add data tests (e.g. accepted values / change-volume anomaly) before publishing.
    review:
      - "Stops the failing job first"
      - "Uses FOR SYSTEM_TIME AS OF"
      - "Restores via copy / CREATE OR REPLACE"
      - "Rebuilds downstream and adds tests"
interview:
  - q: "What is the difference between a view, a materialized view and a table in BigQuery?"
    type: concept
    level: 1
    keyPoints:
      - "view is a saved query evaluated at read time"
      - "materialized view stores precomputed results refreshed incrementally"
      - "table stores data from a load or query"
      - "cost and freshness trade-offs"
