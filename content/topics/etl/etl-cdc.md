=== lesson
--- step concept: Copy only what changed
Copying a 50-million-row table every night to find the 20,000 rows that changed is slow and expensive. **Change data capture (CDC)** extracts just the inserts, updates and deletes.

--- step concept: Query-based vs log-based
- **Query-based:** `SELECT * FROM orders WHERE updated_at > :last_watermark`. Easy, but misses **hard deletes**, depends on `updated_at` always being set, and puts load on the source.
- **Log-based:** read the database's transaction log (MySQL binlog, Postgres WAL) with tools like **Debezium** or **Datastream**. Captures every change, including deletes, with low impact on the source.

[[quiz:etl-cdc:q0]]

--- step concept: Change events
Log-based CDC produces events like:

| lsn | op | customer_id | city |
|---|---|---|---|
| 101 | c | 7 | Pune |
| 105 | u | 7 | Mumbai |
| 110 | d | 7 | NULL |

`lsn` (log sequence number) gives the **order**. To apply a batch you keep only the **latest event per key**, then insert/update/delete.

[[quiz:etl-cdc:q1]]

--- step practice: Compact a CDC batch
[[exercise:etl-cdc-1]]

--- step check: Applying in order
[[quiz:etl-cdc:q2]]

--- step interview: Explain it
[[recall:etl-cdc:r0]]

=== detailed
## Approaches
| | Query-based (timestamp/watermark) | Log-based |
|---|---|---|
| How | poll with `WHERE updated_at > watermark` | read transaction log |
| Deletes | missed (unless soft deletes) | captured |
| Intermediate changes | only the latest state at poll time | every change |
| Source load | queries on the source | minimal |
| Setup | simple | needs log access, connector |
| Tools | Airflow + SQL | Debezium + Kafka, Datastream, Fivetran |

A third option, **snapshot diff** (compare full extracts), works for sources with no timestamps or logs but is expensive.

## Watermarks
- Store the max `updated_at` processed; next run starts from it.
- Use `>=` with deduplication or a small overlap to avoid missing rows committed late with the same timestamp.
- Watermarks on a source clock can go backwards (clock skew, backdated updates) — overlap protects you.

## Deletes
- **Soft delete:** source sets `is_deleted = true` → captured by query-based CDC as an update.
- **Hard delete:** row disappears → only log-based CDC sees it, as a `d` event (often followed by a Kafka **tombstone** with a null value).
- Warehouse options: physically delete, or keep the row with `_deleted_at` for history.

## Applying changes
1. Land raw events (append-only, bronze).
2. **Compact**: latest event per key by `lsn`/commit timestamp — `ROW_NUMBER() OVER (PARTITION BY key ORDER BY lsn DESC) = 1`.
3. **MERGE** into the target:
```sql
MERGE dim_customer T USING latest S ON T.customer_id = S.customer_id
WHEN MATCHED AND S.op = 'd' THEN DELETE
WHEN MATCHED THEN UPDATE SET city = S.city
WHEN NOT MATCHED AND S.op != 'd' THEN INSERT (customer_id, city) VALUES (S.customer_id, S.city);
```
Ordering must use the **log position**, not arrival time — events can arrive out of order.

## GCP
**Datastream** reads MySQL/Postgres/Oracle/SQL Server logs and writes to BigQuery (with automatic merge) or GCS.

> [!REAL] CDC feeds also give you history for free: keep all events in bronze and you can build SCD Type 2 dimensions from them.

=== crisp
**Change Data Capture** = capturing every insert/update/delete in a source database and applying it downstream.
| Type | How | Pros | Cons |
|---|---|---|---|
| **Query-based** | poll `WHERE updated_at > watermark` | simple, no DB config | misses hard deletes, depends on reliable timestamps, load on source |
| **Log-based** | read the DB transaction log (MySQL binlog, Postgres WAL) | all changes incl. deletes, commit order, low source impact | setup/permissions, tooling (Debezium, Datastream) |
| Trigger-based | DB triggers write to change tables | complete | slows writes, intrusive |

- Change events carry: operation (`c/u/d`), before/after images, **log position/LSN**, commit timestamp.
- Applying changes: land events (bronze) → keep the **latest event per key by log position** → MERGE into the target (delete when op = 'd' or set `is_deleted`).
- Order matters — always order by log position, not by event arrival time.
- Deletes: **tombstones** / soft deletes keep history.
- Initial **snapshot** + continuous stream (Datastream does both).

=== memory
- **"The log never lies"** — log-based CDC sees every committed change, in order, including deletes.
- Apply rule: **latest per key by LSN → MERGE (insert/update/delete).**

=== data
flashcards:
  - q: "Query-based vs log-based CDC?"
    a: "Query-based polls updated_at (misses deletes, needs timestamps); log-based reads the transaction log (all changes in commit order)."
  - q: "Which GCP service provides managed log-based CDC?"
    a: "Datastream."
  - q: "How do you apply a batch of CDC events to a table?"
    a: "Take the latest event per key ordered by log position, then MERGE: delete for 'd', upsert otherwise."
quiz:
  - q: "Which captures hard deletes?"
    options: ["SELECT … WHERE updated_at > watermark", "Log-based CDC", "Full snapshot comparison never", "Increasing id filter"]
    answer: 1
  - q: "Which column decides the order in which CDC events for one key are applied?"
    options: ["the row's city", "the log sequence number / commit position", "the time the event arrived in the warehouse", "the primary key"]
    answer: 1
    explain: "Events can arrive out of order; the source's log position reflects the true order of changes."
  - q: "A query-based CDC job filters `updated_at > last_watermark`. Which change will it miss?"
    options: ["a row that was hard-deleted in the source", "a new row", "an updated row with a new updated_at", "a row with a NULL city"]
    answer: 0
    explain: "Deleted rows no longer exist to be selected; only log-based CDC or soft deletes capture them."
recall:
  - q: "Explain query-based vs log-based CDC and how you apply change events in the warehouse."
    keyPoints:
      - "query-based uses updated_at watermark"
      - "misses hard deletes and intermediate changes"
      - "log-based reads binlog or WAL (Debezium, Datastream)"
      - "keep latest event per key by LSN"
      - "MERGE with insert, update, delete"
      - "land raw events append-only first"
exercises:
  - id: etl-cdc-1
    lang: sql
    kind: coding
    difficulty: 3
    title: Compact a CDC batch
    prompt: |
      `cdc_events(lsn, op, customer_id, city)` contains change events (`op` is `c`, `u` or `d`). For each customer keep only the **latest** event by `lsn`, and return the **resulting state**: `customer_id`, `city` for customers whose latest op is not a delete. Order by customer_id.
    setup: |
      CREATE TABLE cdc_events (lsn INTEGER, op TEXT, customer_id INTEGER, city TEXT);
      INSERT INTO cdc_events VALUES
        (101,'c',1,'Pune'),(102,'c',2,'Goa'),(103,'u',1,'Mumbai'),(104,'c',3,'Delhi'),
        (105,'d',2,NULL),(106,'u',3,'Noida'),(107,'u',1,'Thane'),(108,'c',4,'Kochi'),(109,'d',4,NULL),(110,'c',4,'Kochi');
    starter: |
      WITH latest AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY lsn DESC) AS rn
        FROM cdc_events
      )
      SELECT
    solution: |
      WITH latest AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY lsn DESC) AS rn
        FROM cdc_events
      )
      SELECT customer_id, city
      FROM latest
      WHERE rn = 1 AND op <> 'd'
      ORDER BY customer_id;
    ordered: true
    hints:
      - "Latest per key by lsn, then drop keys whose latest op is a delete."
interview:
  - q: "What is change data capture and how do you apply CDC events to a warehouse table?"
    type: concept
    level: 3
    keyPoints:
      - "captures inserts updates deletes from source"
      - "log based reads binlog or WAL"
      - "order events by log position"
      - "latest event per key"
      - "merge with delete handling"
      - "initial snapshot plus stream"
