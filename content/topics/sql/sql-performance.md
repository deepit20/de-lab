=== lesson
--- step concept: How a database finds rows
Without help, a database answers `WHERE customer_id = 42` by reading **every row** — a full table scan. An **index** is a separate sorted structure (usually a B-tree) mapping values to row locations, so the engine can jump straight to matching rows.

| Access path | Cost |
|---|---|
| Full scan | reads all N rows |
| Index seek | ~log(N) steps + matching rows |

> [!WHY] In OLTP databases (Postgres, MySQL) indexes are the main performance tool. In columnar warehouses (BigQuery) there are no traditional indexes — **partitioning, clustering and selecting fewer columns** play that role. The thinking is the same: *read less data*.

[[quiz:sql-performance:q0]]

--- step example: Reading a query plan
In the SQL playground run:
```sql
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 42;
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE channel = 'web';
```
The first says `SEARCH orders USING INDEX idx_orders_customer` (there is an index on customer_id). The second says `SCAN orders` (no index on channel).

--- step concept: Sargable predicates
A predicate is **sargable** (Search-ARGument-able) when the engine can use an index or partition pruning for it. Wrapping the column in a function usually breaks that:
- ✗ `WHERE strftime('%Y', order_date) = '2025'`
- ✓ `WHERE order_date >= '2025-01-01' AND order_date < '2026-01-01'`

[[exercise:sql-performance-1]]

--- step check: Choosing the right fix
[[exercise:sql-performance-2]]
[[exercise:sql-performance-3]]

--- step interview: Explain your approach
[[recall:sql-performance:r0]]

=== detailed
## Why queries are slow
Almost always: **reading or moving too much data**. Typical causes:
1. Full scans where a selective filter could use an index / partition.
2. Selecting unnecessary columns (critical in columnar stores).
3. Joins that explode rows (fan-out) or shuffle huge tables.
4. Sorting/aggregating big intermediate results.
5. Repeating expensive work (CTE evaluated twice, correlated subqueries).
6. Data skew — one key with most rows.

## Indexes (row stores)
- **B-tree index**: sorted keys → supports `=`, ranges, `ORDER BY`, prefix `LIKE 'abc%'`.
- **Composite index** `(a, b)`: usable for filters on `a`, or `a` and `b` (leftmost prefix rule), not for `b` alone.
- **Covering index**: contains all columns the query needs → no table lookup.
- Costs: extra storage, slower writes (every INSERT/UPDATE maintains indexes). Index columns that are filtered/joined often and are selective.
- Low-cardinality columns (status with 4 values) rarely benefit.

## Query plans
`EXPLAIN` (Postgres/SQLite: `EXPLAIN QUERY PLAN`; BigQuery: *Execution details* tab) shows the chosen access paths and join algorithms. Learn to spot: SCAN vs SEARCH, temp B-trees for sorting, hash vs nested loop joins, bytes shuffled per stage, skewed stages.

## Columnar warehouses (BigQuery, Snowflake, Redshift)
- Storage is **by column** — `SELECT *` reads every column; selecting 3 of 50 columns reads ~6% of the data.
- **Partitioning** (by date/ingestion time/integer range) lets the engine skip whole partitions → filter on the partition column directly.
- **Clustering** sorts data within partitions by up to 4 columns → block pruning for filters on those columns.
- `LIMIT` does **not** reduce bytes scanned.
- Approximate functions (`APPROX_COUNT_DISTINCT`) trade small error for big savings.
- Pre-aggregate (materialized views, aggregate tables) for repeated dashboards.

## Rewrite techniques
| Problem | Rewrite |
|---|---|
| function on filtered column | compare raw column to computed constant range |
| `OR` across different columns | `UNION ALL` of two selective queries |
| correlated subquery | join to pre-aggregated CTE or window function |
| `SELECT DISTINCT` to hide join duplicates | fix the join / aggregate first |
| `NOT IN` subquery | `NOT EXISTS` |
| join then filter | filter (and aggregate) before joining |
| `UNION` | `UNION ALL` when duplicates are impossible |

## A systematic approach (interview answer)
1. Measure: runtime, bytes scanned, rows per stage.
2. Read the plan: find the most expensive step.
3. Reduce data early: filters, partition pruning, fewer columns.
4. Fix joins: correct keys, pre-aggregate, broadcast small tables, handle skew.
5. Add structure: index / partition / cluster / materialize.
6. Re-measure and confirm results are unchanged.

=== crisp
- Slow = reading or moving too much data.
- **Index** (B-tree) → seek instead of scan. Composite index uses the **leftmost prefix**. Indexes slow writes.
- **Sargable**: don't wrap filtered columns in functions — use ranges.
- `EXPLAIN QUERY PLAN`: SCAN = full read, SEARCH USING INDEX = seek, TEMP B-TREE = sort.
- Columnar: select fewer columns; partition + cluster; filter on partition column; LIMIT doesn't cut cost.
- Filter & aggregate **before** joining; `UNION ALL` over `UNION`; `NOT EXISTS` over `NOT IN`.
- Method: measure → plan → reduce data → fix joins → add structure → re-measure.

=== memory
- **"Read less, move less, sort less."**
- **Sargable:** "keep the column naked".
- Composite index (a,b) is a phone book sorted by surname then first name: great for surname, useless for first name alone.
- Trigger: *"BigQuery query is expensive"* → columns scanned, partition filter, clustering.

=== data
flashcards:
  - q: "What is a sargable predicate?"
    a: "One the engine can use an index/partition pruning for — the column is compared directly, not wrapped in a function."
  - q: "Composite index on (customer_id, order_date): which filters can use it?"
    a: "customer_id alone, or customer_id + order_date. Not order_date alone (leftmost prefix rule)."
  - q: "Why is SELECT * expensive in BigQuery?"
    a: "Columnar storage: cost is proportional to the columns read, and * reads them all."
  - q: "Does LIMIT reduce bytes billed in BigQuery?"
    a: "No — it only trims the output after the scan."
  - q: "Downside of adding many indexes?"
    a: "More storage and slower inserts/updates (each index must be maintained)."
quiz:
  - q: "Which predicate can use an index on order_date?"
    options:
      - "WHERE strftime('%Y', order_date) = '2025'"
      - "WHERE order_date >= '2025-01-01' AND order_date < '2026-01-01'"
      - "WHERE substr(order_date, 1, 4) = '2025'"
      - "WHERE order_date LIKE '%2025%'"
    answer: 1
recall:
  - q: "A query got slow. Walk through how you would investigate and fix it."
    keyPoints:
      - "measure runtime and data scanned"
      - "read the execution plan"
      - "find the most expensive step"
      - "filter early and select fewer columns"
      - "check joins for fan-out or skew"
      - "add index / partition / cluster / pre-aggregation"
      - "verify results are unchanged"
exercises:
  - id: sql-performance-1
    lang: sql
    kind: coding
    difficulty: 2
    title: Make it sargable
    prompt: |
      Rewrite this query so the filter compares `order_date` **directly** (a range), returning exactly the same rows: count of orders per `channel` placed in **June 2025**.
      ```sql
      SELECT channel, COUNT(*) AS orders
      FROM orders
      WHERE strftime('%Y-%m', order_date) = '2025-06'
      GROUP BY channel ORDER BY channel;
      ```
    starter: |
      SELECT channel, COUNT(*) AS orders
      FROM orders
      WHERE strftime('%Y-%m', order_date) = '2025-06'
      GROUP BY channel
      ORDER BY channel;
    solution: |
      SELECT channel, COUNT(*) AS orders
      FROM orders
      WHERE order_date >= '2025-06-01' AND order_date < '2025-07-01'
      GROUP BY channel
      ORDER BY channel;
    ordered: true
    hints:
      - "Use >= first day AND < first day of next month."
    explain: |
      Same result, but now an index or a BigQuery date partition on `order_date` can be used.
  - id: sql-performance-2
    lang: mcq
    kind: concept
    difficulty: 2
    title: Which index helps?
    prompt: |
      This query runs thousands of times a day on a large Postgres `orders` table:
      ```sql
      SELECT order_id, amount FROM orders
      WHERE customer_id = $1 AND order_date >= $2
      ORDER BY order_date DESC LIMIT 20;
      ```
      Which index is best?
    choices:
      - "INDEX (order_date)"
      - "INDEX (customer_id, order_date)"
      - "INDEX (order_date, customer_id)"
      - "INDEX (status)"
    answer: 1
    explain: |
      Equality column first, then the range/sort column: the engine seeks to the customer, then reads its orders already sorted by date and stops after 20. Adding `amount` (`INCLUDE (amount)` in Postgres) would make it covering.
  - id: sql-performance-3
    lang: text
    kind: scenario
    difficulty: 3
    title: The expensive BigQuery dashboard
    prompt: |
      A Looker Studio dashboard runs this every 15 minutes against a 4 TB events table (partitioned by `event_date`, not clustered) and costs a lot:
      ```sql
      SELECT * FROM analytics.events
      WHERE DATE(event_timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND country = 'IN'
      LIMIT 1000;
      ```
      List the problems and how you would fix them.
    solution: |
      - **SELECT \*** reads every column → select only the columns the dashboard uses.
      - The filter is on `DATE(event_timestamp)`, not the **partition column** `event_date` → partition pruning may not happen; filter on `event_date` directly.
      - **LIMIT doesn't reduce bytes scanned.**
      - Frequent `country` filter → **cluster** by `country` (and other common filters).
      - Runs every 15 minutes on raw data → build a small **aggregated table / materialized view** refreshed incrementally, and point the dashboard at it; enable BI Engine/caching.
      - Optionally require partition filters on the table (`require_partition_filter = true`).
    review:
      - "Select only needed columns instead of *"
      - "Filter on the partition column event_date"
      - "LIMIT does not reduce cost"
      - "Cluster by country"
      - "Pre-aggregate / materialized view for the dashboard"
interview:
  - q: "How do indexes work, and when can they hurt performance?"
    type: concept
    level: 2
    keyPoints:
      - "B-tree sorted structure for fast lookup"
      - "turns full scan into seek"
      - "composite index leftmost prefix"
      - "slows inserts and updates"
      - "extra storage"
      - "not useful for low-selectivity columns"
  - q: "A BigQuery query scans 2 TB every run. How do you reduce cost?"
    type: scenario
    level: 2
    keyPoints:
      - "select only required columns"
      - "partition and filter on partition column"
      - "clustering on common filters"
      - "pre-aggregate or materialized views"
      - "check bytes processed in dry run"
