=== lesson
--- step concept: What you pay for
BigQuery bills **storage** and **compute** separately.
- **On-demand compute:** price per TB of **bytes scanned** by each query.
- **Capacity (editions):** you buy **slots** (units of compute) per hour; queries share them.

Because storage is columnar, bytes scanned = **only the columns you select**, in **only the partitions you read**.

> [!THINK] A 2 TB table has 40 columns. Roughly how much does `SELECT order_id, amount` scan compared with `SELECT *`?

--- step concept: The biggest levers
1. **Select only needed columns** — never `SELECT *` on big tables.
2. **Partition** by date and **filter on the partition column** — pruning skips whole partitions.
3. **Cluster** on common filter/join columns — skips blocks inside partitions.
4. **Pre-aggregate** with summary tables or materialized views for repeated dashboards.
5. **Require partition filters** on huge tables so nobody scans everything by accident.

[[quiz:bq-cost:q0]]

--- step example: Look before you run
- The editor's **dry run** shows "This query will process 1.2 TB".
- `LIMIT 10` does **not** reduce bytes scanned on a normal table — use the **table preview** instead.
- Set **maximum bytes billed** on scheduled jobs so a bad query fails instead of costing thousands.

[[quiz:bq-cost:q1]]

--- step scenario: Find and fix the expensive queries
`INFORMATION_SCHEMA.JOBS` records every query with its `total_bytes_billed` and user.

[[exercise:bq-cost-1]]

--- step check: Storage costs too
[[quiz:bq-cost:q2]]

--- step interview: Explain it
[[recall:bq-cost:r0]]

=== detailed
## Pricing model
| Part | Billed by | Notes |
|---|---|---|
| On-demand queries | TB scanned (min 10 MB per table) | first TB per month free |
| Capacity (Standard/Enterprise editions) | slot-hours | autoscaling or baseline commitments; predictable cost |
| Active storage | GB-month | tables/partitions modified in last 90 days |
| Long-term storage | ~half price | untouched for 90 days — automatic |
| Streaming inserts / Storage Write API | GB ingested | batch loads from GCS are free |

## Reduce bytes scanned
- **Column pruning:** list columns; `SELECT * EXCEPT(big_json)` when you need almost everything.
- **Partition pruning:** `WHERE event_date BETWEEN '2025-03-01' AND '2025-03-07'`. Filters must be on the partition column directly — wrapping it in a function or comparing to a subquery can prevent pruning.
- **Clustering:** order data within partitions by up to 4 columns; filters on them skip blocks. The dry-run estimate is an upper bound; actual bytes may be lower.
- **Materialized views / summary tables** for dashboards that hit the same aggregate repeatedly.
- **BI Engine** caches data in memory for dashboards.
- **Query cache:** identical repeated queries within 24 h are free (unless the table changed).

## Guardrails
- `require_partition_filter = TRUE` on large partitioned tables.
- **Maximum bytes billed** per query/job.
- Custom **quotas** per user/project per day.
- **Budgets and alerts** in Cloud Billing; labels on jobs for cost attribution.

## Find expensive queries
```sql
SELECT user_email, query, total_bytes_billed / POW(1024, 4) AS tb_billed
FROM `region-asia-south1`.INFORMATION_SCHEMA.JOBS
WHERE creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
  AND job_type = 'QUERY'
ORDER BY total_bytes_billed DESC
LIMIT 10;
```

## Storage optimisation
- Partition expiration for data you only need for N days.
- Table expiration for temporary/scratch datasets.
- Long-term pricing applies automatically — don't rewrite old partitions needlessly (it resets the 90-day clock).

> [!MISTAKE] `SELECT * FROM big_table LIMIT 10` still scans the whole table on-demand.

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
  - q: "A query filters `WHERE DATE(event_ts) = '2025-03-14'` on a table partitioned by `event_date`. Problem?"
    options: ["it scans only one column", "it filters on a different column, so no partitions are pruned", "nothing — it is optimal", "DATE() is not allowed"]
    answer: 1
    explain: "Pruning needs a filter on the partitioning column itself: WHERE event_date = '2025-03-14'."
  - q: "Partitions that haven't been modified for 90 days are…"
    options: ["billed at the cheaper long-term storage rate automatically", "deleted", "moved to Coldline", "billed double"]
    answer: 0
    explain: "Long-term storage pricing kicks in automatically; nothing changes about how you query it."
recall:
  - q: "How is BigQuery billed and how would you cut a team's query costs?"
    keyPoints:
      - "on-demand bytes scanned vs capacity slots"
      - "columnar: select only needed columns"
      - "partition pruning and clustering"
      - "LIMIT does not reduce bytes"
      - "materialized views or summary tables"
      - "max bytes billed, require partition filter, INFORMATION_SCHEMA.JOBS"
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
