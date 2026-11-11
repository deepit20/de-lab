=== lesson
--- step concept: Four ways to load a table
| Strategy | What happens | Rerun safe? |
|---|---|---|
| **Full refresh** | drop and rebuild the whole table | yes |
| **Append** | add new rows to the end | **no** — reruns duplicate |
| **Upsert / MERGE** | insert new keys, update existing ones | yes |
| **Partition overwrite** | replace only the affected date partitions | yes |

> [!THINK] Your daily job appended yesterday's orders, failed halfway, and Airflow retried it. What does the table look like now?

--- step concept: Full refresh
Simple and always correct: `CREATE OR REPLACE TABLE … AS SELECT …`. Fine for small tables (dimensions, lookups) — but cost and time grow with total size, not with what changed.

--- step concept: Append and upsert
**Append** is fast and cheap for immutable events (logs, clicks) **if** you guard against duplicates: load into staging, then insert only rows whose id isn't already there.

**Upsert (MERGE)** matches on a **business key** and updates or inserts — the default for entity tables (customers, orders that change status).

--- step concept: Partition overwrite
For date-partitioned facts, recompute just the partitions for the run's window and **replace** them. Run it twice — same result. This is the workhorse of idempotent batch pipelines.

```sql
-- BigQuery: write to a single partition with WRITE_TRUNCATE
bq query --destination_table 'mart.daily_sales$20250314' --replace ...
```
[[quiz:etl-load-strategies:q0]]

--- step check: Choose a strategy
[[quiz:etl-load-strategies:q1]]
[[quiz:etl-load-strategies:q2]]

--- step interview: Explain it
[[recall:etl-load-strategies:r0]]

=== detailed
## Comparison
| | Full refresh | Append | Upsert / MERGE | Partition overwrite |
|---|---|---|---|---|
| Work per run | whole table | new rows | changed rows (+ target scan) | affected partitions |
| Idempotent | yes | no (unless deduped) | yes | yes |
| Handles updates | yes | no | yes | yes, within window |
| Handles deletes | yes | no | with `WHEN NOT MATCHED BY SOURCE` / soft-delete flags | yes, within window |
| Best for | small dims, lookups | immutable events | entities with changes | date-partitioned facts, aggregates |

## Making append safe
- Load to a staging table first; insert with `WHERE NOT EXISTS` on the event id.
- Or deduplicate downstream with `QUALIFY ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY _loaded_at DESC) = 1`.
- Track loaded files in a manifest table so the same file isn't loaded twice.

## Upsert details
- Needs a reliable **business key** and one source row per key.
- Optionally compare a **hash** of columns to update only changed rows.
- For SCD Type 2, MERGE closes the old version and inserts the new one.

## Partition overwrite details
- Process a window `[start, end)` and overwrite exactly the matching partitions.
- BigQuery: destination `table$YYYYMMDD` with `WRITE_TRUNCATE`; or `DELETE` the window then `INSERT` inside one multi-statement transaction.
- Spark: `spark.sql.sources.partitionOverwriteMode=dynamic` with `mode("overwrite")`.
- Late data: reprocess the last N days (e.g. 3) each run to pick up late events.

## Choosing
- Is the table small? → full refresh.
- Are rows immutable events? → append with dedup, or partition overwrite by event date.
- Do rows change? → MERGE on business key.
- Are you building daily aggregates? → partition overwrite.

> [!REAL] Interviewers often ask "what if the job runs twice?" — the right answer names the load strategy that makes reruns safe.

=== crisp
| Strategy | How | Idempotent? | Use when |
|---|---|---|---|
| **Full refresh** | replace the whole table (`CREATE OR REPLACE`, `WRITE_TRUNCATE`) | ✓ | small tables, dimensions, logic changes |
| **Append** | `INSERT` new rows only | ✗ unless deduped by key | immutable events/logs with unique ids |
| **Upsert / MERGE** | update existing keys, insert new | ✓ (with unique source keys) | mutable entities (customers, orders) |
| **Partition overwrite** | replace only affected partitions (`table$YYYYMMDD`, dynamic overwrite) | ✓ | daily facts, reprocessing a date range |
| **Delete + insert** | delete the slice, insert it again (in a transaction) | ✓ | engines without MERGE / partitions |
| **SCD2 merge** | close old versions, insert new | ✓ | dimension history |

- Always know the **unit of reprocessing** (table, partition, key).
- Prefer strategies whose retry leaves the same state (idempotent).
- Large MERGE in BigQuery: add a target partition filter in `ON` to limit scans.

=== memory
- **"Replace, append, merge, overwrite."** Only *append* needs extra care.

=== data
flashcards:
  - q: "Which load strategy is NOT idempotent by itself?"
    a: "Append (blind INSERT) — retries duplicate rows unless deduplicated by key."
  - q: "When is partition overwrite the best choice?"
    a: "For date-partitioned facts where a run (re)computes whole days."
  - q: "What is required for a MERGE to be safe?"
    a: "Unique keys in the source (deduplicate first)."
quiz:
  - q: "Daily recomputation of yesterday's aggregated sales table partition — best strategy?"
    options: ["Append", "Partition overwrite", "Full refresh of 5 years", "Manual edit"]
    answer: 1
  - q: "Which strategy is NOT idempotent on its own?"
    options: ["full refresh", "partition overwrite", "MERGE on a business key", "plain append"]
    answer: 3
    explain: "Appending the same batch twice inserts duplicates unless you deduplicate."
  - q: "Customers change addresses and you need the current address per customer. Best load?"
    options: ["overwrite yesterday's partition only", "load nothing", "MERGE (upsert) on customer_id", "append every snapshot without keys"]
    answer: 2
    explain: "Upsert updates existing customers and inserts new ones."
recall:
  - q: "Compare full refresh, append, upsert and partition overwrite, and say which you'd use for a daily sales fact."
    keyPoints:
      - "full refresh simple but cost grows with table size"
      - "append fast but duplicates on rerun"
      - "MERGE on business key for changing entities"
      - "partition overwrite for date-partitioned facts"
      - "idempotency on reruns"
      - "reprocess recent days for late data"
interview:
  - q: "Describe different load strategies and when you'd use each."
    type: concept
    level: 2
    keyPoints:
      - "full refresh for small or changing logic"
      - "append for immutable events"
      - "merge upsert for mutable entities"
      - "partition overwrite for date based facts"
      - "idempotency considerations"
