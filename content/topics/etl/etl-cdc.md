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
