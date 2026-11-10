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
