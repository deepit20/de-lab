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
