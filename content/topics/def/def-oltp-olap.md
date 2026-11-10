=== lesson
--- step concept: Two kinds of workload
**OLTP** (Online Transaction Processing) systems run the business: placing an order, updating a profile, booking a seat. Many tiny reads/writes of individual rows, high concurrency, strict consistency.

**OLAP** (Online Analytical Processing) systems *analyse* the business: revenue by month, churn by segment. Few large queries scanning millions of rows over a few columns.

| | OLTP | OLAP |
|---|---|---|
| Typical query | `UPDATE orders SET status=… WHERE id=42` | `SUM(amount) GROUP BY month` |
| Rows touched | few | millions–billions |
| Users | thousands of app users | analysts, dashboards, ML |
| Design | normalised (3NF) | denormalised (star schema, wide tables) |
| Storage | row-oriented | column-oriented |
| Examples | Postgres, MySQL, Cloud SQL, Spanner | BigQuery, Snowflake, Redshift |

> [!WHY] Data engineering exists largely because of this split: data is **created** in OLTP systems and must be **moved and reshaped** into OLAP systems — without slowing down production databases.

[[quiz:def-oltp-olap:q0]]

--- step example: Why columnar storage wins for analytics
A table with 50 columns and 1 billion rows. Query: `SELECT country, SUM(amount) FROM sales GROUP BY country`.
- **Row store:** reads every row in full → all 50 columns from disk.
- **Column store:** reads only `country` and `amount` → ~4% of the data, and each column compresses extremely well (similar values together).

The reverse is true for "fetch order 42 with all its fields": a row store reads one contiguous record; a column store must stitch 50 columns together.

--- step check: Classify the workload
[[exercise:def-oltp-olap-1]]

--- step scenario: Don't query production
[[exercise:def-oltp-olap-2]]
[[recall:def-oltp-olap:r0]]

=== detailed
## OLTP
- Purpose: record business events reliably as they happen.
- Workload: short transactions, point lookups by key, many concurrent writers.
- Guarantees: **ACID** (Atomicity, Consistency, Isolation, Durability).
- Design: normalised schemas avoid update anomalies; B-tree indexes on keys.
- Storage: row-oriented pages — a whole record is stored together.

## OLAP
- Purpose: answer questions across large history.
- Workload: large scans, aggregations, joins of facts with dimensions; mostly append + read.
- Design: dimensional models (facts & dimensions), denormalised wide tables, nested data.
- Storage: **columnar** — each column stored separately, compressed (run-length, dictionary encoding), with min/max statistics per block to skip data.
- Execution: massively parallel (MPP) — the work is split across many workers.

## Why not run analytics on the OLTP database?
1. **Performance impact** — heavy scans compete with customer transactions (locks, CPU, I/O).
2. **Wrong storage layout** for scans.
3. **History** — OLTP keeps current state; analytics needs history (what was the customer's tier in March?).
4. **Integration** — analytics combines many sources (CRM, payments, web events).

So we **extract** from OLTP (ideally from a replica or via CDC from the transaction log), and **load** into a warehouse.

## HTAP and the middle ground
Some systems try to do both (Spanner + Data Boost, AlloyDB columnar engine, TiDB, SingleStore). Read replicas offload simple reporting. But the separation of concerns remains the default architecture.

## Interview angle
> [!INTERVIEW] A strong answer contrasts workload, design, storage and examples — and explains *why columnar storage is faster for analytics* (I/O and compression) and *why we don't query production directly*.

=== crisp
- **OLTP** = run the business: many small, concurrent, ACID transactions on few rows. Row store, normalised. (Postgres, MySQL, Cloud SQL)
- **OLAP** = analyse the business: few big scans/aggregations over many rows, few columns. Column store, denormalised. (BigQuery, Snowflake, Redshift)
- Columnar wins analytics: reads only needed columns + high compression + block skipping.
- Row store wins point lookups / full-record writes.
- Don't run analytics on production OLTP: load impact, no history, wrong layout, single source. → extract (replica / CDC) → warehouse.

=== memory
- **"T for Transactions, A for Analytics."**
- Picture: OLTP = cashier till (fast single sales); OLAP = month-end report (reads all receipts).
- Row store = filing cabinet of complete forms; column store = one ledger per field.

=== data
flashcards:
  - q: "OLTP vs OLAP in one line each?"
    a: "OLTP: many small transactions running the business. OLAP: large analytical queries over history."
  - q: "Why are column stores faster for aggregations?"
    a: "They read only the needed columns and compress them well, cutting I/O drastically."
  - q: "Name two reasons not to run heavy analytics on the production database."
    a: "It slows down customer transactions; it lacks history and other sources; its row layout is inefficient for scans."
  - q: "What does ACID stand for?"
    a: "Atomicity, Consistency, Isolation, Durability."
  - q: "Is BigQuery OLTP or OLAP?"
    a: "OLAP — a columnar, massively parallel analytical warehouse."
quiz:
  - q: "Which query suits a columnar warehouse best?"
    options:
      - "Update one customer's email"
      - "Average order value by month over 3 years"
      - "Insert a single new order"
      - "Lock a seat for booking"
    answer: 1
recall:
  - q: "Explain the difference between OLTP and OLAP systems and why data engineers move data between them."
    keyPoints:
      - "OLTP handles many small transactions"
      - "OLAP handles large analytical queries"
      - "row versus columnar storage"
      - "normalised versus denormalised design"
      - "analytics on production hurts performance"
      - "warehouse integrates sources and keeps history"
exercises:
  - id: def-oltp-olap-1
    lang: mcq
    kind: concept
    difficulty: 1
    title: Pick the system
    prompt: |
      A product manager wants a dashboard of **daily active users by country for the last 2 years**, refreshed hourly. The app's user activity is written to Postgres. Where should the dashboard query run?
    choices:
      - "Directly on the production Postgres primary"
      - "On a columnar warehouse (e.g. BigQuery) fed from Postgres"
      - "On the application's in-memory cache"
      - "On a spreadsheet export"
    answer: 1
    explain: |
      A 2-year aggregation is an OLAP workload: columnar scans, history, no impact on customer-facing writes. Replicate (batch or CDC) from Postgres into the warehouse.
  - id: def-oltp-olap-2
    lang: text
    kind: scenario
    difficulty: 2
    title: The report that slowed checkout
    prompt: |
      Every morning at 9:00 a finance report runs a large query directly against the production MySQL database, and checkout latency spikes. Explain what is happening and propose an architecture to fix it.
    solution: |
      **What happens:** the report is an analytical (OLAP) query — large scans, joins, sorts — competing for CPU, memory, I/O and locks with the OLTP checkout transactions on the same primary.

      **Fix (short term):** run reports on a **read replica**; schedule off-peak.

      **Fix (proper):** replicate MySQL into a **warehouse** (BigQuery) — daily/hourly batch extracts from a replica or **CDC** from the binlog (Datastream/Debezium). Model the data (facts/dimensions), and point the finance report at the warehouse. Benefits: no load on production, columnar performance, history, and the ability to join other sources.
    review:
      - "Identifies OLAP query competing with OLTP workload"
      - "Mentions read replica as quick fix"
      - "Proposes replication into a warehouse"
      - "Mentions CDC or batch extraction from replica"
      - "Notes benefits: performance, history, integration"
interview:
  - q: "What is the difference between OLTP and OLAP? Why are analytical databases usually columnar?"
    type: concept
    level: 1
    keyPoints:
      - "OLTP many small transactions, OLAP large scans and aggregations"
      - "normalised vs denormalised"
      - "columnar reads only required columns"
      - "better compression"
      - "examples Postgres vs BigQuery"
