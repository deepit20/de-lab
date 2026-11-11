=== lesson
--- step concept: Bronze, silver, gold
The **medallion** architecture organises data by how refined it is:

- **Bronze (raw)** — exactly what the source sent, plus load metadata (file name, load time). Append-only. Lets you reprocess anything.
- **Silver (clean)** — typed, deduplicated, standardised, conformed keys. One trustworthy version of each entity.
- **Gold (business-ready)** — facts, dimensions, aggregates and metrics for dashboards and ML.

[[quiz:dw-medallion:q0]]

--- step concept: The dbt flavour
dbt projects use the same idea with different names:
- `staging/` — one model per source table: rename, cast, light cleaning (1:1 with source).
- `intermediate/` — joins and business logic building blocks.
- `marts/` — `fct_` and `dim_` tables that people query.

--- step concept: Star schema or one wide table?
In columnar warehouses like BigQuery, joins are cheap but not free, and repeated values compress well. Many teams serve both: a **star schema** for flexible analysis, plus **wide denormalised tables** (`orders_enriched`) for the most common dashboards.

[[quiz:dw-medallion:q1]]

--- step check: Test and document each layer
[[quiz:dw-medallion:q2]]

--- step interview: Explain it
[[recall:dw-medallion:r0]]

=== detailed
## Why layers
- **Reprocessing:** bugs are found weeks later; with raw data kept in bronze you rebuild silver and gold without asking the source again.
- **Separation of concerns:** cleaning rules live in one place; business logic in another.
- **Trust:** consumers read gold, which is tested; they never build dashboards on raw data.
- **Debugging:** you can compare layers to find where a number went wrong.

## Layer responsibilities
| Layer | Contains | Typical work | Tests |
|---|---|---|---|
| Bronze / raw | source data as received | append, add `_loaded_at`, `_source_file` | row counts vs source, freshness |
| Silver / staging + intermediate | clean entity tables | cast types, trim, dedupe (CDC compaction), conform codes, surrogate keys | unique, not_null, accepted_values |
| Gold / marts | facts, dimensions, aggregates | joins, business rules, metrics | relationships, reconciliation to finance |

## Where things belong
- **Deduplication of a CDC or retried feed:** silver.
- **Renaming `cust_nm` to `customer_name`:** staging (silver).
- **"Active customer = ordered in last 90 days":** gold — it's a business definition.
- **PII masking:** as early as possible; keep raw PII access tightly restricted.

## Wide tables vs star schemas
| | Star schema | Wide table |
|---|---|---|
| Flexibility | high — combine any dimension | limited to columns included |
| Ease for BI users | needs joins (or a semantic layer) | very easy |
| Storage | less duplication | duplication (compresses well in columnar) |
| Updates | change a dimension once | rebuild the wide table |

> [!REAL] On Databricks the layers are Delta tables; on GCP they're often BigQuery datasets named `raw_`, `stg_`/`int_`, `mart_` — with GCS as the bronze landing zone for files.

=== crisp
**Medallion / layered architecture:**
| Layer | Also called | Content | Rules |
|---|---|---|---|
| **Bronze** | raw, landing, staging-raw | data exactly as received + ingestion metadata | append-only, immutable, replayable |
| **Silver** | staging, cleaned, intermediate, core | typed, deduplicated, standardised, conformed keys | tested; one row per entity/event |
| **Gold** | marts, presentation | business-level facts/dimensions, aggregates, metrics | documented, owned, SLA |

**dbt-style folders:** `models/staging` (1:1 with sources: rename, cast, light cleaning) → `models/intermediate` (joins, business logic) → `models/marts` (facts, dims, metrics for consumers).

- Each layer has a clear **contract** and tests; consumers read only gold (or silver for exploration).
- Raw is kept so you can **rebuild** silver/gold after logic fixes.
- **Wide denormalised tables vs star schemas**: columnar warehouses make wide "one big tables" cheap and BI-friendly; star schemas keep conformed dimensions reusable. Many teams expose stars *and* a few wide reporting tables built from them.

=== memory
- **"Bronze keeps, Silver cleans, Gold serves."**
- Never let dashboards read bronze.

=== data
flashcards:
  - q: "What belongs in the bronze layer?"
    a: "Raw data as received, append-only, with ingestion metadata — replayable."
  - q: "What happens in silver?"
    a: "Typing, cleaning, deduplication, standardisation and conformed keys — tested."
  - q: "Why keep raw data after transforming it?"
    a: "To rebuild downstream layers after bugs or logic changes and for auditing."
quiz:
  - q: "Where should deduplication of a CDC feed happen?"
    options: ["Bronze", "Silver", "Only in the dashboard", "Never"]
    answer: 1
  - q: "Which layer should hold the business rule 'an active customer ordered in the last 90 days'?"
    options: ["bronze / raw", "the source system", "the landing bucket", "gold / marts"]
    answer: 3
    explain: "Business definitions belong in the business-ready layer, built on cleaned silver data."
  - q: "Why keep the bronze layer unchanged?"
    options: ["it is required by SQL", "to save storage", "so you can rebuild silver and gold after a bug without re-extracting", "because raw data is faster to query"]
    answer: 2
    explain: "Raw, append-only data is the safety net for reprocessing."
recall:
  - q: "Explain the medallion architecture and what belongs in each layer."
    keyPoints:
      - "bronze raw, append-only, load metadata"
      - "silver cleaned, typed, deduplicated, conformed"
      - "gold facts, dimensions, metrics"
      - "dbt staging, intermediate, marts"
      - "tests at each layer"
      - "wide tables vs star schemas trade-off"
interview:
  - q: "Describe how you would layer data in a warehouse or lakehouse and why."
    type: design
    level: 2
    keyPoints:
      - "raw bronze kept immutable"
      - "silver cleaned deduplicated typed"
      - "gold business ready marts"
      - "tests and contracts per layer"
      - "ability to reprocess from raw"
