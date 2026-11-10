=== lesson
--- step concept: Skip data you don't need
- **Partitioning** divides a table into segments, typically one per **day** of a DATE/TIMESTAMP column (or ingestion time, or integer ranges). A filter on the partition column lets BigQuery **prune** partitions — they are never read or billed.
- **Clustering** sorts the data **within each partition** by up to **4 columns**. Filters (and aggregations) on those columns let BigQuery skip storage blocks whose min/max ranges can't match.

```sql
CREATE TABLE analytics.events
PARTITION BY DATE(event_ts)
CLUSTER BY country, event_type
OPTIONS (require_partition_filter = TRUE, partition_expiration_days = 400)
AS SELECT * FROM staging.events;
```

[[quiz:bq-partition-cluster:q0]]

--- step example: Pruning or not?
| Query filter | Partition pruning? |
|---|---|
| `WHERE DATE(event_ts) = '2025-06-01'` | ✓ |
| `WHERE event_ts >= '2025-06-01' AND event_ts < '2025-06-02'` | ✓ |
| `WHERE event_ts >= (SELECT MAX(ts) FROM other)` | ✗ often not (dynamic value) — use a scripting variable |
| `WHERE FORMAT_DATE('%Y%m', DATE(event_ts)) = '202506'` | ✗ function hides the column |
| no filter on event_ts | ✗ full scan (blocked if require_partition_filter) |

--- step check: Design choices
[[exercise:bq-partition-cluster-1]]
[[exercise:bq-partition-cluster-2]]

--- step scenario: Redesign a costly table
[[exercise:bq-partition-cluster-3]]
[[recall:bq-partition-cluster:r0]]

=== detailed
## Partitioning
Types:
- **Time-unit column**: `PARTITION BY DATE(ts)` / `TIMESTAMP_TRUNC(ts, HOUR)` / MONTH / YEAR.
- **Ingestion time**: `_PARTITIONTIME` / `_PARTITIONDATE` (when data arrived).
- **Integer range**: `RANGE_BUCKET(customer_id, GENERATE_ARRAY(0, 1000000, 10000))`.
Limits: up to 10,000 partitions per table (≈27 years of daily partitions); hourly partitions burn through that quickly.

Benefits: **cost** (pruned partitions aren't billed), **speed**, **lifecycle** (`partition_expiration_days`), and **partition-level operations**: overwrite one day with `WRITE_TRUNCATE` into `table$20250601`, delete a day cheaply, long-term storage pricing per partition.

Options: `require_partition_filter = TRUE` forces every query to filter on the partition column — a cheap guardrail.

## Clustering
- Up to 4 columns; **order matters** (sorted by the first, then the second…).
- Good cluster columns: frequently filtered/joined, **high cardinality** (user_id, customer_id, country+city), used with equality or range filters.
- BigQuery performs **automatic re-clustering** in the background at no cost.
- Unlike partition pruning, the bytes saved by clustering aren't known before the query runs — dry-run estimates show the upper bound.
- Works on non-partitioned tables too.

## Choosing
| Situation | Recommendation |
|---|---|
| Most queries filter by date | partition by that date |
| Also filter by customer/country | + cluster by those |
| Many small partitions (< ~1 GB each) | consider clustering only, or monthly partitions |
| Need to filter on high-cardinality id | cluster (can't partition by it) |

## Common mistakes
> [!MISTAKE] Filtering with a function on the partition column, or comparing it to a subquery result → no pruning.

> [!MISTAKE] Partitioning by a column nobody filters on.

> [!MISTAKE] Hourly partitions on a small table → too many tiny partitions.

> [!MISTAKE] Cluster column order not matching filters (filtering only on the 3rd cluster column gives little benefit).

=== crisp
- **Partition** = split into segments (daily DATE/TIMESTAMP, ingestion time, integer range); filters on it **prune** whole partitions → not scanned, not billed.
- **Cluster** = sort within partitions by ≤ 4 columns (order matters) → block pruning on filters; auto re-clustering; savings shown only after the run.
- Filter the partition column **directly** (no functions, no subquery-derived values) to get pruning.
- `require_partition_filter = TRUE` guardrail; `partition_expiration_days` lifecycle.
- Partition-level ops: `WRITE_TRUNCATE` into `table$YYYYMMDD` for idempotent daily reloads.
- Max 10,000 partitions; avoid tiny partitions (< ~1 GB) → cluster instead.
- Partition by date, cluster by high-cardinality filter columns (customer_id, country).

=== memory
- **"Partition = which drawers to open. Cluster = how the files are sorted inside each drawer."**
- **"Naked partition column in WHERE."**

=== data
flashcards:
  - q: "Partitioning vs clustering in BigQuery?"
    a: "Partitioning splits the table into segments (e.g. by day) that can be skipped entirely; clustering sorts data within partitions by up to 4 columns to skip blocks."
  - q: "Maximum number of clustering columns?"
    a: "Four (order matters)."
  - q: "Why might `WHERE FORMAT_DATE('%Y%m', d) = '202506'` scan the whole table?"
    a: "Wrapping the partition column in a function prevents partition pruning."
  - q: "What does require_partition_filter do?"
    a: "Rejects queries that don't filter on the partition column."
  - q: "How do you idempotently reload one day of a partitioned table?"
    a: "Write with WRITE_TRUNCATE to the partition decorator table$YYYYMMDD (or DELETE + INSERT for that date)."
  - q: "When is clustering better than partitioning?"
    a: "When filtering on high-cardinality columns, or when partitions would be tiny."
quiz:
  - q: "Queries filter by `order_date` and `customer_id`. Best design?"
    options:
      - "PARTITION BY customer_id CLUSTER BY order_date"
      - "PARTITION BY order_date CLUSTER BY customer_id"
      - "No partitioning; add an index"
      - "PARTITION BY order_date CLUSTER BY status"
    answer: 1
recall:
  - q: "Explain partitioning and clustering in BigQuery and how you choose columns for each."
    keyPoints:
      - "partitioning splits by date or integer range"
      - "partition pruning avoids scanning and billing"
      - "clustering sorts within partitions up to four columns"
      - "block pruning on clustered filters"
      - "partition on the common date filter"
      - "cluster on frequently filtered high cardinality columns"
      - "filter partition column directly"
exercises:
  - id: bq-partition-cluster-1
    lang: mcq
    kind: concept
    difficulty: 2
    title: Pruning or not
    prompt: |
      `sales` is partitioned by `sale_date` (DATE). Which filter prunes partitions?
    choices:
      - "WHERE EXTRACT(YEAR FROM sale_date) = 2025"
      - "WHERE sale_date BETWEEN '2025-01-01' AND '2025-01-31'"
      - "WHERE CAST(sale_date AS STRING) LIKE '2025-01%'"
      - "WHERE sale_date = (SELECT MAX(sale_date) FROM other_table)"
    answer: 1
  - id: bq-partition-cluster-2
    lang: text
    kind: scenario
    difficulty: 2
    title: Write the DDL
    prompt: |
      Create (BigQuery SQL) a table `mart.fct_orders` from `staging.orders` partitioned by the date of `order_ts`, clustered for queries that filter by `customer_id` and `channel`, keeping 2 years of partitions and forcing queries to filter by date.
    solution: |
      ```sql
      CREATE TABLE mart.fct_orders
      PARTITION BY DATE(order_ts)
      CLUSTER BY customer_id, channel
      OPTIONS (
        partition_expiration_days = 730,
        require_partition_filter = TRUE
      ) AS
      SELECT * FROM staging.orders;
      ```
    review:
      - "PARTITION BY DATE(order_ts)"
      - "CLUSTER BY customer_id, channel"
      - "partition_expiration_days ~730"
      - "require_partition_filter = TRUE"
  - id: bq-partition-cluster-3
    lang: text
    kind: scenario
    difficulty: 3
    title: Redesign the clickstream table
    prompt: |
      `raw.clicks` (8 TB, growing 30 GB/day) is unpartitioned. Common queries: last 7 days of clicks for a given `user_id`; daily counts by `country` for the last 90 days; occasional full-history analyses. Monthly bill is high. Propose a redesign and migration.
    solution: |
      **Design:** `PARTITION BY DATE(click_ts)` (daily, ~30 GB each), `CLUSTER BY user_id, country` (or `country, user_id` if country filters dominate — pick the order by the most frequent filter). `require_partition_filter = TRUE` to stop accidental full scans; consider expiration or archiving old partitions to GCS.

      **Migrate:** `CREATE TABLE … PARTITION BY … CLUSTER BY … AS SELECT * FROM raw.clicks` (or copy in date chunks), validate counts, switch writers to the new table, update views/dashboards, drop the old table.

      **Also:** pre-aggregate daily counts by country into a small table / materialized view for the dashboard; select only needed columns; teach users to filter on `click_ts` directly.
    review:
      - "Partition by date of click timestamp"
      - "Cluster by user_id and/or country with reasoning"
      - "require_partition_filter guardrail"
      - "Migration plan with validation"
      - "Pre-aggregation for repeated dashboards"
interview:
  - q: "How do partitioning and clustering reduce cost in BigQuery? How would you choose them for a large events table?"
    type: design
    level: 2
    keyPoints:
      - "partition pruning skips partitions entirely"
      - "clustering skips blocks within partitions"
      - "partition by event date"
      - "cluster by frequently filtered high cardinality columns"
      - "require partition filter"
      - "filter on partition column directly"
