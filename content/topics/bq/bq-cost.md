=== crisp
**Reduce bytes scanned (on-demand):**
1. Select only needed columns — never `SELECT *` on wide tables (use `SELECT * EXCEPT(...)` if needed).
2. Filter on **partition** columns directly; cluster on common filters.
3. `LIMIT` doesn't reduce cost; use the table **preview** to look at data for free.
4. **Dry run** to see bytes before running; set **maximum bytes billed** per query to fail expensive mistakes.
5. Pre-aggregate: summary tables, **materialized views** (auto-refreshed, used automatically by matching queries), BI Engine for dashboards.
6. Avoid repeatedly referencing an expensive CTE (may be computed per reference) → temp table.
7. Use `APPROX_COUNT_DISTINCT` / `APPROX_QUANTILES` where exactness isn't required.
8. Incremental models: process only new partitions instead of rebuilding full history daily.

**Reduce slot time / speed up:** filter early, reduce data before joins, join big-to-small (broadcast), avoid skewed keys, avoid `ORDER BY` without `LIMIT` on huge results, avoid cross joins, use window functions over self-joins.

**Govern:** project/user **custom quotas**, budgets & alerts, labels for cost attribution, INFORMATION_SCHEMA.JOBS to find the top-cost queries, capacity (Editions) pricing for heavy steady workloads.

**Storage:** partition expiration, table expiration for temp data, long-term storage discount (90 days unmodified), physical vs logical billing.

=== memory
- **"Columns, partitions, previews, dry runs."**
- **"Pre-compute what dashboards repeat."**
- Find the culprits: `INFORMATION_SCHEMA.JOBS` ordered by `total_bytes_billed`.

=== data
flashcards:
  - q: "How do you see a query's cost before running it?"
    a: "Dry run (console validator / bq --dry_run) shows bytes to be processed."
  - q: "What does 'maximum bytes billed' do?"
    a: "Fails the query if it would bill more than the limit — a safety net."
  - q: "How can a dashboard querying the same aggregation every 5 minutes be made cheaper?"
    a: "Materialized view or summary table, BI Engine, and partition-filtered queries."
  - q: "Where do you find which queries cost the most?"
    a: "INFORMATION_SCHEMA.JOBS (total_bytes_billed, total_slot_ms, user_email)."
quiz:
  - q: "Which does NOT reduce on-demand bytes billed?"
    options: ["Selecting fewer columns", "Partition filter", "Adding LIMIT 10", "Clustering + filter on cluster column"]
    answer: 2
exercises:
  - id: bq-cost-1
    lang: text
    kind: scenario
    difficulty: 2
    title: Find and fix the expensive queries
    prompt: |
      The BigQuery bill doubled last month. Write the INFORMATION_SCHEMA query you'd use to find the top 10 most expensive queries of the last 30 days (region `region-asia-south1`), and list three fixes you would look for.
    solution: |
      ```sql
      SELECT user_email, job_id, query,
             total_bytes_billed / POW(1024, 4) AS tib_billed,
             total_slot_ms / 1000 / 3600 AS slot_hours,
             creation_time
      FROM `region-asia-south1`.INFORMATION_SCHEMA.JOBS
      WHERE creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
        AND job_type = 'QUERY' AND statement_type != 'SCRIPT'
      ORDER BY total_bytes_billed DESC
      LIMIT 10;
      ```
      Fixes: `SELECT *` → explicit columns; missing/ineffective partition filters (functions on the partition column) → direct filters + `require_partition_filter`; dashboards re-querying raw data → materialized views/summary tables/BI Engine; full rebuilds → incremental models; scheduled queries running too often.
    review:
      - "Queries INFORMATION_SCHEMA.JOBS"
      - "Orders by total_bytes_billed"
      - "Filters last 30 days"
      - "At least three concrete fixes"
interview:
  - q: "How do you optimise cost and performance in BigQuery?"
    type: concept
    level: 2
    keyPoints:
      - "select only needed columns"
      - "partition and cluster and filter correctly"
      - "dry run and maximum bytes billed"
      - "materialized views and summary tables"
      - "incremental processing"
      - "monitor with INFORMATION_SCHEMA JOBS"
