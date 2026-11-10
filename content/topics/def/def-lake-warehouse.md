=== lesson
--- step concept: Where analytical data lives
- **Data warehouse** — structured, modelled, SQL-first storage optimised for analytics (BigQuery, Snowflake, Redshift). Schema-on-write: data is cleaned and typed when loaded.
- **Data lake** — cheap object storage (GCS, S3, ADLS) holding files of any kind: raw JSON, CSV, Parquet, images, logs. Schema-on-read: structure is applied when you query.
- **Lakehouse** — open table formats (Iceberg, Delta, Hudi) on lake storage give warehouse features (ACID, schema enforcement, time travel) to files, queried by many engines.

> [!WHY] Real platforms usually combine them: land raw data in the lake (cheap, replayable), model it into the warehouse (fast, governed).

[[quiz:def-lake-warehouse:q0]]

--- step example: A typical GCP layout
```
Sources → GCS (raw / bronze, partitioned by date) → BigQuery staging → BigQuery marts → dashboards
                 ↑ replayable history                 ↑ cleaned          ↑ business-ready
```
BigQuery can also query lake files directly via **external tables / BigLake**.

--- step check: Which fits?
[[exercise:def-lake-warehouse-1]]

--- step scenario: Avoiding the data swamp
[[exercise:def-lake-warehouse-2]]
[[recall:def-lake-warehouse:r0]]

=== detailed
## Data warehouse
- Central, integrated, historical store for analytics.
- **Schema-on-write**: types, constraints and models defined up front.
- Strengths: performance for SQL, governance (access control, column-level security), consistency, easy for analysts.
- Weaknesses: less suited to unstructured data; storage historically more expensive (now cheap in cloud warehouses); proprietary storage formats.

## Data lake
- Object storage with files in open formats; scales cheaply to petabytes.
- **Schema-on-read**: flexible, store first, decide later.
- Strengths: any data type (logs, images, ML features), cheap, replayable raw history, many engines (Spark, Presto/Trino, BigQuery external tables).
- Weaknesses: without discipline becomes a **data swamp** — unknown files, no ownership, duplicated/inconsistent data, no transactions (concurrent writers can corrupt tables), hard governance.

## Lakehouse
Open **table formats** add a metadata/transaction layer over Parquet files:
- ACID commits, concurrent writers,
- schema enforcement and evolution,
- **time travel** (query a table as of a version/time),
- partition evolution, MERGE/UPDATE/DELETE on files.
Examples: Delta Lake (Databricks), Apache Iceberg (BigQuery BigLake, Snowflake, Trino), Apache Hudi.

## Comparison
| | Warehouse | Lake | Lakehouse |
|---|---|---|---|
| Storage | managed, proprietary | object storage files | object storage + table format |
| Schema | on write | on read | on write (enforced) + evolution |
| Data types | structured / semi | anything | structured / semi (+ files nearby) |
| Transactions | yes | no | yes |
| Main users | analysts, BI | engineers, data scientists | both |

## Layered architecture (medallion)
- **Bronze** — raw, as received, immutable, partitioned by ingestion date.
- **Silver** — cleaned, deduplicated, typed, conformed.
- **Gold** — business-level aggregates and dimensional models for consumption.

## Choosing in practice
For a BigQuery-centric company: GCS for raw landing/archive and large files, BigQuery for staging + marts (or BigLake Iceberg tables when multiple engines must share data). The choice is less "lake vs warehouse" than **which layer lives where**, with clear ownership and contracts.

=== crisp
- **Warehouse**: structured, modelled, SQL, schema-on-write, governed, fast (BigQuery).
- **Lake**: object storage (GCS), any files, cheap, schema-on-read; risk = **data swamp**.
- **Lakehouse**: open table formats (Iceberg/Delta/Hudi) → ACID, schema enforcement, time travel on lake files.
- Common pattern: raw → lake (bronze, replayable) → warehouse staging/marts (silver/gold).
- Medallion: bronze raw · silver clean/conformed · gold business-ready.
- BigQuery reads lake files via external tables / BigLake.

=== memory
- **Warehouse = library (catalogued). Lake = storage unit (everything, maybe chaos). Lakehouse = storage unit with a librarian.**
- **"Bronze keeps, Silver cleans, Gold serves."**

=== data
flashcards:
  - q: "Schema-on-write vs schema-on-read?"
    a: "On write: structure enforced when loading (warehouse). On read: structure applied at query time (lake)."
  - q: "What does a lakehouse table format add to a data lake?"
    a: "ACID transactions, schema enforcement/evolution, time travel and efficient updates on files."
  - q: "What is a data swamp?"
    a: "A lake without metadata, ownership or quality controls — data nobody can find or trust."
  - q: "Medallion layers?"
    a: "Bronze (raw), Silver (cleaned/conformed), Gold (business-ready aggregates/models)."
quiz:
  - q: "Where would you keep 5 years of raw API JSON responses for possible reprocessing, cheaply?"
    options: ["BigQuery native table only", "Object storage (GCS) in the lake / bronze layer", "The OLTP database", "A spreadsheet"]
    answer: 1
recall:
  - q: "Compare a data lake, a data warehouse and a lakehouse."
    keyPoints:
      - "warehouse structured schema on write optimised for SQL"
      - "lake object storage any format schema on read"
      - "lake risk of data swamp"
      - "lakehouse adds ACID and table formats on lake files"
      - "typical combination raw in lake modelled in warehouse"
exercises:
  - id: def-lake-warehouse-1
    lang: mcq
    kind: concept
    difficulty: 1
    title: Where should it go?
    prompt: |
      Data scientists need millions of product **images** plus their labels, and analysts need fast SQL dashboards on **order revenue**. Which split is sensible?
    choices:
      - "Both in the warehouse"
      - "Images in the lake (GCS); orders modelled in the warehouse (BigQuery)"
      - "Both in the OLTP database"
      - "Images in the warehouse; orders in the lake"
    answer: 1
  - id: def-lake-warehouse-2
    lang: text
    kind: scenario
    difficulty: 2
    title: Rescue the swamp
    prompt: |
      Your company's GCS bucket has 4 years of files from 30 sources: inconsistent folder names, unknown owners, several copies of the same data, and analysts don't trust any of it. Propose how to organise it.
    solution: |
      - **Layered zones**: `raw/` (bronze, immutable, as received), `clean/` (silver), `curated/` (gold) — or move silver/gold into BigQuery.
      - **Naming & partitioning convention**: `raw/<source>/<entity>/ingest_date=YYYY-MM-DD/…`.
      - **Catalog & ownership**: register datasets in a catalog (Dataplex/Data Catalog) with owner, description, schema, freshness, PII tags.
      - **Formats**: convert analytical data to Parquet; adopt a table format (Iceberg via BigLake) for tables needing updates.
      - **Quality**: data contracts with source owners; tests on silver/gold; dedupe copies.
      - **Lifecycle & access**: retention rules, IAM per zone, delete orphaned data.
    review:
      - "Layered zones (raw / clean / curated)"
      - "Naming and partition conventions"
      - "Catalog with ownership and metadata"
      - "Quality checks / contracts"
      - "Access control and lifecycle rules"
interview:
  - q: "What is the difference between a data lake and a data warehouse? What is a lakehouse?"
    type: concept
    level: 2
    keyPoints:
      - "lake stores raw files of any type cheaply"
      - "warehouse stores structured modelled data for SQL"
      - "schema on read vs schema on write"
      - "lakehouse adds ACID and schema to lake via Iceberg or Delta"
      - "often used together in layers"
