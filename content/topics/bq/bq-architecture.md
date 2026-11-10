=== lesson
--- step concept: What happens when you run a BigQuery query
BigQuery is a **serverless, columnar, massively parallel** warehouse. Three ideas explain almost everything about its speed and cost:

1. **Separation of storage and compute** — data lives in **Colossus** (Google's distributed file system) in the columnar **Capacitor** format; compute (**Dremel** query engine) is allocated per query in units called **slots**. Connected by Google's petabit network (**Jupiter**).
2. **Columnar storage** — a query reads only the columns it references. Cost (on-demand) = **bytes of those columns scanned**.
3. **Massive parallelism** — a query is turned into a tree of stages; thousands of slots read, filter and partially aggregate in parallel, then **shuffle** intermediate results to the next stage.

[[quiz:bq-architecture:q0]]

--- step example: Reading the execution graph
In the console's *Execution details*, each **stage** shows: input rows, records read/written, slot time, and **shuffle** bytes. A stage with far longer compute time than the others signals **skew**; huge shuffle output signals an expensive join/aggregation.

Pricing models:
- **On-demand** — pay per TB scanned (first 1 TB/month free).
- **Capacity (Editions)** — reserve/autoscale slots, pay per slot-hour; bytes scanned no longer billed directly.
Storage is billed separately (active vs long-term — tables unmodified for 90 days are cheaper).

--- step check: Predict the cost
[[exercise:bq-architecture-1]]
[[exercise:bq-architecture-2]]

--- step scenario: Explain it to a colleague
[[exercise:bq-architecture-3]]
[[recall:bq-architecture:r0]]

=== detailed
## Architecture
| Component | Role |
|---|---|
| **Colossus** | distributed storage; data replicated across zones |
| **Capacitor** | columnar storage format with encoding/compression and per-block stats |
| **Dremel** | query engine: execution tree of stages, scaling to thousands of workers |
| **Slots** | units of compute (CPU+RAM+network) allocated to query stages |
| **Jupiter** | data-centre network enabling storage/compute separation and fast shuffles |
| **Shuffle tier** | in-memory distributed shuffle between stages |

Because storage and compute are separate, a table can be queried by thousands of concurrent queries without "loading" it into a cluster, and there is no cluster to size or index to maintain.

## Query execution
SQL → logical plan → stages. Leaf stages scan columns (with partition pruning and cluster block pruning), filter, and compute partial aggregates; intermediate stages shuffle by key and combine; the root returns results. Joins are **broadcast** (small side copied to workers) or **hash/shuffle** joins.

## Resources: datasets, tables, jobs
- **Project → dataset → table/view/routine**. Datasets have a **location** (region or multi-region); you cannot join across locations.
- Table types: native, external (GCS/Drive/BigLake), views, materialized views, snapshots, clones.
- Every query/load/export is a **job** with statistics (bytes processed, slot ms).

## Cost model
- On-demand: bytes scanned of referenced columns after pruning; minimum 10 MB per table per query. `LIMIT` does not reduce it. Cached results (identical query within 24h, unchanged tables) are free.
- Capacity: slot reservations/autoscaling (Standard/Enterprise editions); good for predictable heavy workloads.
- Storage: logical or physical (compressed) billing; long-term discount after 90 days untouched.
- Use **dry runs** (`--dry_run`, the console validator) to see bytes before running.

## Strengths and limits
- ✓ Petabyte scans in seconds, no infrastructure, standard SQL, nested data, ML (BigQuery ML), streaming ingestion.
- ✗ Not for high-frequency single-row updates (DML quotas, per-statement cost); no traditional indexes (use partitioning/clustering, search indexes); cross-region joins impossible.

=== crisp
- **Serverless, columnar, MPP.** Storage (**Colossus**, **Capacitor** columnar format) separate from compute (**Dremel** engine, **slots**), linked by **Jupiter** network.
- Query = tree of **stages**; leaves scan/filter/partially aggregate; **shuffle** between stages; broadcast vs hash joins.
- On-demand cost = **bytes of referenced columns scanned** (after pruning). `LIMIT` doesn't help; `SELECT *` hurts; cache is free.
- Capacity/Editions = pay for slots, not bytes. Storage billed separately; long-term (90 days) cheaper.
- Hierarchy: project → dataset (has a **location**) → tables. No cross-location joins.
- Not an OLTP DB: avoid frequent single-row DML.
- Dry run before expensive queries; inspect execution details for skew/shuffle.

=== memory
- **"Colossus stores, Dremel thinks, slots do the work, Jupiter carries the data."**
- **"You pay for columns, not rows."**

=== data
flashcards:
  - q: "What are BigQuery slots?"
    a: "Units of compute capacity (CPU, memory, network) that execute query stages."
  - q: "What determines on-demand query cost?"
    a: "Bytes scanned from the referenced columns after partition/cluster pruning."
  - q: "Does LIMIT 10 reduce bytes billed?"
    a: "No — the scan happens before the limit is applied."
  - q: "What does separation of storage and compute mean in BigQuery?"
    a: "Data sits in Colossus independently; compute slots are allocated per query, so each scales separately."
  - q: "Name BigQuery's storage format and query engine."
    a: "Capacitor (columnar format) and Dremel (query engine)."
quiz:
  - q: "A query selects 2 columns (10 GB each) from a 1 TB table with 50 columns, no filters. Approximate bytes billed on-demand?"
    options: ["1 TB", "20 GB", "10 MB", "Depends on LIMIT"]
    answer: 1
recall:
  - q: "Explain BigQuery's architecture and how it affects query cost."
    keyPoints:
      - "serverless with separation of storage and compute"
      - "columnar storage Capacitor in Colossus"
      - "Dremel execution with slots in parallel stages"
      - "shuffle between stages"
      - "on-demand cost based on bytes scanned of selected columns"
      - "partitioning clustering and fewer columns reduce cost"
exercises:
  - id: bq-architecture-1
    lang: mcq
    kind: concept
    difficulty: 1
    title: Cheapest query
    prompt: |
      `events` is 3 TB with 60 columns, not partitioned. Which query scans the **fewest bytes** on-demand?
    choices:
      - "SELECT * FROM events LIMIT 100"
      - "SELECT user_id, event_type FROM events"
      - "SELECT * FROM events WHERE user_id = 42"
      - "SELECT COUNT(*) FROM events WHERE event_type = 'purchase'"
    answer: 3
    explain: |
      The COUNT query reads only `event_type` (one column). Query B reads two columns; A and C read all 60 columns (filters on non-partitioned, non-clustered columns don't prune).
  - id: bq-architecture-2
    lang: mcq
    kind: concept
    difficulty: 2
    title: The slow stage
    prompt: |
      In a query's execution graph one stage's max compute time is 40× its average, while other stages are balanced. Most likely cause?
    choices: ["Too few columns selected", "Data skew on the join/group key", "The query result was cached", "Long-term storage pricing"]
    answer: 1
  - id: bq-architecture-3
    lang: text
    kind: scenario
    difficulty: 2
    title: Why is BigQuery fast without indexes?
    prompt: |
      A colleague from a SQL Server background asks: "How can BigQuery scan terabytes in seconds when it has no indexes?" Answer in a way they'd understand.
    solution: |
      Instead of using indexes to *avoid* reading data, BigQuery makes reading data extremely fast and selective:
      - **Columnar storage**: it reads only the columns you query, heavily compressed — a 3-column query on a 60-column table reads ~5% of it.
      - **Pruning**: partitioning (usually by date) skips whole partitions; clustering sorts data so blocks that can't match are skipped using min/max metadata.
      - **Massive parallelism**: the query is split across thousands of workers (slots), each scanning a slice; results are combined through fast in-memory shuffles.
      - **Separation of storage and compute**: no cluster to load; compute is allocated on demand over Google's fast network.
      The trade-off: point lookups and frequent single-row updates are not its strength — that's what OLTP databases with indexes are for.
    review:
      - "Columnar storage reads only needed columns"
      - "Partition and cluster pruning"
      - "Massive parallelism with slots"
      - "Separation of storage and compute"
      - "Mentions trade-off vs OLTP indexes"
interview:
  - q: "How does BigQuery execute a query, and how is it billed?"
    type: concept
    level: 2
    keyPoints:
      - "Dremel tree of stages executed by slots"
      - "columnar Capacitor storage in Colossus"
      - "shuffle between stages"
      - "on-demand bytes scanned or capacity slot pricing"
      - "storage billed separately"
