=== lesson
--- step concept: Why not just query the app database?
App databases (OLTP) are built for many small writes. Reporting on them is slow, hurts the app, and every source has its own names and codes. A **data warehouse** collects data from all sources into one place designed for analysis.

Bill Inmon's classic definition — a warehouse is:
- **Integrated** — one definition of "customer" across all sources
- **Subject-oriented** — organised around sales, customers, products, not apps
- **Time-variant** — keeps history
- **Non-volatile** — loaded and read, not edited row by row

--- step concept: Kimball vs Inmon
- **Inmon (top-down):** build a normalised (3NF) **enterprise warehouse** first, then derive data marts from it.
- **Kimball (bottom-up):** build **dimensional** star schemas one business process at a time, joined through **conformed dimensions**.

[[quiz:dw-concepts:q0]]
[[quiz:dw-concepts:q1]]

--- step concept: Layers
Most warehouses have layers:
**staging** (raw copies) → **integration/core** (cleaned, conformed) → **presentation/marts** (star schemas, aggregates for BI).

--- step concept: The modern variant — ELT in the cloud
Cloud warehouses like BigQuery are cheap to store in and powerful to compute in, so teams **load raw data first** and transform inside the warehouse with SQL/dbt. The layers are the same ideas with new names: bronze/silver/gold or staging/intermediate/marts.

[[quiz:dw-concepts:q2]]

--- step interview: Explain it
[[recall:dw-concepts:r0]]

=== detailed
## OLTP vs warehouse
| | OLTP database | Data warehouse |
|---|---|---|
| Purpose | run the business (orders, payments) | analyse the business |
| Workload | many small reads/writes | few large scans and aggregations |
| Model | normalised (3NF) | dimensional / denormalised |
| History | current state | full history |
| Users | applications | analysts, BI, data science |

## Inmon vs Kimball
| | Inmon | Kimball |
|---|---|---|
| Direction | top-down | bottom-up |
| Core | normalised enterprise data warehouse | dimensional star schemas |
| Marts | derived from the EDW | the marts *are* the warehouse, joined by conformed dimensions |
| Strength | single integrated source of truth | fast to deliver, easy for users |
| Weakness | long time to first value | needs discipline on conformed dimensions |

Kimball's **bus architecture** lists business processes (rows) against shared dimensions (columns) so each new star fits with the others.

In practice most modern teams use a hybrid: an integrated cleaned layer (Inmon-ish) feeding dimensional marts (Kimball).

## Layers
- **Staging / raw / bronze** — source data as-is, plus load metadata.
- **Core / integration / silver** — cleaned types, deduplicated, conformed keys and codes.
- **Marts / presentation / gold** — facts and dimensions, business metrics, aggregates.

## ETL → ELT
Old on-premise warehouses had expensive compute, so data was transformed **before** loading (ETL tools). Cloud warehouses invert it: load raw data quickly, transform with SQL in the warehouse (ELT), keep raw data for reprocessing.

> [!INTERVIEW] "Kimball or Inmon?" — say what each is, then: "In BigQuery I'd load raw data, build a cleaned conformed layer, and serve Kimball-style star schemas from it, because analysts find them easy and they reuse conformed dimensions."

=== crisp
**Data warehouse** (Inmon's definition): a **subject-oriented, integrated, time-variant, non-volatile** collection of data supporting decisions.
- Subject-oriented: organised around business subjects (sales, customers), not applications.
- Integrated: consistent keys, codes and units across sources.
- Time-variant: keeps history.
- Non-volatile: loaded and read, not updated transactionally.

| | Kimball (bottom-up) | Inmon (top-down) |
|---|---|---|
| Core | dimensional data marts per business process, linked by **conformed dimensions** (bus architecture) | normalised (3NF) enterprise data warehouse, marts derived from it |
| Speed to value | fast, incremental | slower, big upfront design |
| Strength | usability, performance | integration, single version of truth |

**Data Vault** (hubs, links, satellites) — a third, audit-friendly approach for many changing sources.

**Layers:** sources → staging (raw copy) → integration/core → presentation marts → BI. Modern ELT does this **inside** the cloud warehouse (dbt).

=== memory
- Inmon's four: **S-I-T-N** — "Subject, Integrated, Time-variant, Non-volatile."
- **Kimball builds marts that share dimensions; Inmon builds the warehouse first.**

=== data
flashcards:
  - q: "Four characteristics of a data warehouse (Inmon)?"
    a: "Subject-oriented, integrated, time-variant, non-volatile."
  - q: "Kimball vs Inmon in one line?"
    a: "Kimball: bottom-up dimensional marts with conformed dimensions. Inmon: top-down normalised EDW feeding marts."
  - q: "What is a data mart?"
    a: "A subject-specific subset of the warehouse for a business area (e.g. sales mart)."
quiz:
  - q: "'Conformed dimensions' are central to which approach?"
    options: ["Inmon", "Kimball", "OLTP design", "Data swamp"]
    answer: 1
  - q: "Which characteristic means a warehouse keeps history rather than only the current state?"
    options: ["normalised", "time-variant", "non-volatile", "subject-oriented"]
    answer: 1
    explain: "Time-variant: every record is associated with a time so you can analyse change over time."
  - q: "Why did ELT replace ETL in cloud warehouses?"
    options: ["warehouse compute is elastic and cheap, so transform after loading raw data", "SQL can no longer transform data", "ETL tools stopped working", "ELT needs no storage"]
    answer: 0
    explain: "Loading raw first keeps the original data and uses the warehouse's scalable compute for transformations."
recall:
  - q: "Explain why data warehouses exist and compare Kimball with Inmon."
    keyPoints:
      - "OLTP is built for transactions, not analysis"
      - "integrated, subject-oriented, time-variant, non-volatile"
      - "Inmon top-down normalised EDW"
      - "Kimball bottom-up star schemas"
      - "conformed dimensions and bus matrix"
      - "layers and modern ELT"
interview:
  - q: "Compare the Kimball and Inmon approaches to data warehousing."
    type: concept
    level: 2
    keyPoints:
      - "Kimball bottom up dimensional marts"
      - "conformed dimensions and bus matrix"
      - "Inmon top down normalised enterprise warehouse"
      - "trade-off speed vs integration"
      - "modern hybrids with ELT layers"
