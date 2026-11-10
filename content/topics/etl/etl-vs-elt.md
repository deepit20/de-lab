=== lesson
--- step concept: Where does the transformation happen?
- **ETL** — Extract → **Transform** (on a separate engine: Python, Spark, Informatica) → Load the finished result into the warehouse.
- **ELT** — Extract → **Load raw** into the warehouse → Transform **inside** the warehouse with SQL (dbt, Dataform, scheduled queries).

> [!WHY] Cloud warehouses (BigQuery, Snowflake) made compute elastic and cheap, so loading raw data first and transforming with SQL became the default: simpler stack, raw history kept, analysts can contribute transformations.

| | ETL | ELT |
|---|---|---|
| Transform engine | external (Spark, Python, ETL tool) | the warehouse (SQL) |
| Raw data in warehouse | usually not | yes |
| Good for | heavy non-SQL logic, PII removal before load, legacy | analytics engineering, fast iteration |
| Tools | Spark, Dataflow, Informatica, SSIS | dbt, Dataform, BigQuery SQL |

[[quiz:etl-vs-elt:q0]]

--- step concept: Anatomy of a pipeline
Every pipeline, whatever the tool, has the same parts:
1. **Source** and **extraction** method (full, incremental, CDC; API, files, DB).
2. **Landing** of raw data (bronze), with metadata.
3. **Validation** (schema, counts, quality).
4. **Transformation** (clean → model → aggregate).
5. **Load** strategy into targets (append, merge, overwrite partition).
6. **Orchestration** (schedule, dependencies, retries) and **monitoring** (alerts, freshness, logs).

--- step check: ETL or ELT?
[[exercise:etl-vs-elt-1]]

--- step scenario: Design a simple pipeline
[[exercise:etl-vs-elt-2]]
[[recall:etl-vs-elt:r0]]

=== detailed
## ETL
Classic data warehousing (1990s–2010s): warehouse compute was expensive and limited, so data was transformed on dedicated ETL servers and only conformed results were loaded. Still the right choice when:
- transformations are not SQL-friendly (ML feature extraction, complex parsing, image/audio),
- sensitive data must be removed/masked **before** it reaches the warehouse,
- the target isn't an analytical warehouse (feeding an operational system),
- large-scale streaming transformations (Dataflow/Flink).

## ELT
Load raw (or lightly typed) data quickly, transform with SQL in the warehouse:
- **Pros:** fewer moving parts, scalable warehouse compute, raw history available for reprocessing, transformations version-controlled as SQL (dbt), lineage and tests built in, analysts and engineers share one language.
- **Cons:** raw data (and PII) lands in the warehouse → governance needed; warehouse costs grow with careless SQL; not all logic is SQL-friendly.

## EtLT
In practice: Extract, light transform (type casting, PII hashing, dedup at ingestion), Load, then the heavy Transform in SQL.

## Reverse ETL
Push modelled warehouse data back into operational tools (CRM, marketing platforms) — e.g. Hightouch/Census or custom jobs.

## Choosing tools on GCP
- Files/APIs → Cloud Run/Functions or Composer tasks → GCS → BigQuery load jobs → dbt/Dataform models.
- Databases → Datastream (CDC) → BigQuery → SQL models.
- Streams → Pub/Sub → Dataflow (ETL) or BigQuery subscription (ELT).

=== crisp
- **ETL**: transform before loading, on an external engine. **ELT**: load raw, transform in the warehouse with SQL.
- ELT is the modern default with cloud warehouses: simple, scalable, raw kept, SQL + dbt, tests & lineage.
- ETL still wins for non-SQL logic, removing PII before load, operational targets, streaming transforms.
- **EtLT**: light cleaning/PII hashing at ingestion, heavy modelling in SQL.
- Pipeline anatomy: extract → land raw → validate → transform → load strategy → orchestrate & monitor.
- **Reverse ETL**: warehouse → operational tools.

=== memory
- **"ETL cooks before serving; ELT brings groceries home and cooks in the kitchen (warehouse)."**
- Six parts: **Source, Land, Validate, Transform, Load, Orchestrate.**

=== data
flashcards:
  - q: "Main difference between ETL and ELT?"
    a: "ETL transforms data before loading it into the warehouse; ELT loads raw data and transforms it inside the warehouse."
  - q: "Why did ELT become popular?"
    a: "Cloud warehouses offer cheap elastic compute and storage, so SQL transformations in-warehouse are simpler and keep raw history."
  - q: "When is ETL still preferable?"
    a: "Non-SQL transformations, removing PII before load, operational targets, heavy streaming transforms."
  - q: "What is reverse ETL?"
    a: "Syncing modelled warehouse data back into operational systems like CRMs."
quiz:
  - q: "A company uses BigQuery and dbt to transform raw data loaded by Fivetran. This is…"
    options: ["ETL", "ELT", "Reverse ETL", "OLTP"]
    answer: 1
recall:
  - q: "Compare ETL and ELT and describe the components of a typical pipeline."
    keyPoints:
      - "ETL transforms before load on external engine"
      - "ELT loads raw then transforms in warehouse"
      - "ELT keeps raw history and uses SQL"
      - "ETL useful for non SQL logic or PII removal"
      - "pipeline extract land validate transform load orchestrate monitor"
exercises:
  - id: etl-vs-elt-1
    lang: mcq
    kind: concept
    difficulty: 2
    title: Health data with PII
    prompt: |
      A hospital wants analytics on appointment data in BigQuery, but regulations forbid patient names and phone numbers from ever being stored in the analytics environment. Which approach?
    choices:
      - "Pure ELT — load everything raw, mask later in views"
      - "ETL / EtLT — remove or tokenise PII during extraction, then load"
      - "Reverse ETL"
      - "Load into BigQuery and delete PII monthly"
    answer: 1
  - id: etl-vs-elt-2
    lang: text
    kind: scenario
    difficulty: 2
    title: A daily sales pipeline on GCP
    prompt: |
      Every night at 1 am a POS system drops a CSV of yesterday's sales into a GCS bucket. Design an ELT pipeline that produces a `daily_sales_by_store` table for a 7 am dashboard. Cover each pipeline part.
    solution: |
      1. **Source/extract**: POS exports `sales_YYYYMMDD.csv` to `gs://co-raw/pos/sales/ingest_date=YYYY-MM-DD/`.
      2. **Orchestrate**: Composer DAG at 1:30 with a **GCS sensor** for the file; `schedule='30 1 * * *'`, retries with backoff, `catchup` for missed days, SLA alert at 6:30.
      3. **Land/load raw**: BigQuery load job into `raw.pos_sales` partitioned by `sale_date` with `WRITE_TRUNCATE` on that day's partition (idempotent), explicit schema.
      4. **Validate**: file not empty, row count vs 7-day average, schema/required columns, no duplicate `transaction_id`, amounts ≥ 0 — fail or quarantine.
      5. **Transform (SQL/dbt)**: `stg_pos_sales` (types, dedup, clean store codes) → `fct_sales` → `daily_sales_by_store` (incremental by date).
      6. **Serve & monitor**: dashboard reads the mart; freshness check; alerts to Slack/email on failure.
    review:
      - "File arrival detection / scheduling"
      - "Raw landing in GCS and load to BigQuery"
      - "Idempotent load (partition overwrite)"
      - "Validation checks"
      - "SQL transformation layers"
      - "Monitoring / alerting / SLA"
interview:
  - q: "What is the difference between ETL and ELT? Which would you choose for a BigQuery-based platform and why?"
    type: concept
    level: 1
    keyPoints:
      - "ETL transforms before loading"
      - "ELT transforms inside the warehouse"
      - "BigQuery elastic compute favours ELT"
      - "raw data retained for reprocessing"
      - "exceptions: PII, non SQL logic"
