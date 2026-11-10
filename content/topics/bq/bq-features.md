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
