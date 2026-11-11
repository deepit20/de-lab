=== lesson
--- step concept: Data engineers build the roads
Analysts and scientists answer questions **with** data. Data engineers make sure the data **arrives** — correct, on time, documented and affordable — every day, without someone running scripts by hand.

| Role | Main output |
|---|---|
| Data engineer | reliable pipelines, platforms, data models |
| Analytics engineer | clean, tested models in the warehouse (often dbt) |
| Data analyst | reports, dashboards, answers to business questions |
| Data scientist | experiments, forecasts, ML models |

> [!THINK] Think of a dashboard you have used. Who made sure its numbers were there at 9 a.m.?

--- step concept: The data lifecycle
**Generation → Ingestion → Storage → Transformation → Serving**

1. **Generation** — apps, payments, sensors, SaaS tools create data.
2. **Ingestion** — batch files, APIs, CDC streams move it into your platform.
3. **Storage** — data lake (GCS) and warehouse (BigQuery).
4. **Transformation** — clean, join, model (SQL, dbt, Spark).
5. **Serving** — dashboards, ML features, reverse ETL, APIs.

[[quiz:def-role-lifecycle:q1]]

--- step concept: The undercurrents
Across every stage: **security** (who can see what), **data management** (quality, lineage, catalog), **orchestration** (Airflow schedules and dependencies), **DataOps** (CI/CD, tests, monitoring) and **cost**.

--- step check: What "production" means
A pipeline is production-ready when it runs on a schedule, recovers from failure, is monitored and alerts someone, is tested, documented, and has an owner.

[[quiz:def-role-lifecycle:q0]]
[[quiz:def-role-lifecycle:q2]]

--- step scenario: Map your own work
[[exercise:def-role-lifecycle-1]]

--- step interview: Explain it
[[recall:def-role-lifecycle:r0]]

=== detailed
## What a data engineer does
- Designs and builds **pipelines** that move data from sources to where it's used.
- Models data in the warehouse so it's easy and cheap to query.
- Makes pipelines **reliable**: retries, idempotent loads, monitoring, alerting.
- Guards **quality** and **access**: tests, contracts, PII handling, permissions.
- Controls **cost** and performance: partitioning, incremental processing.
- Works with analysts, scientists, product engineers and the business.

## Roles compared
| | Data engineer | Analytics engineer | Data analyst | Data scientist |
|---|---|---|---|---|
| Main tools | Python, SQL, Airflow, Spark, cloud | SQL, dbt, Git | SQL, BI tools, Excel | Python, stats, ML |
| Cares most about | reliability, scale, cost | clean modelled tables | insight, communication | prediction, experiments |
| Typical output | pipeline, platform | `fct_orders`, tests, docs | dashboard, analysis | model, experiment readout |

An analyst moving into DE already has the most important skill — SQL and an understanding of what the business needs from data.

## Lifecycle stages in detail
| Stage | Questions you ask | GCP examples |
|---|---|---|
| Generation | Who owns the source? How often does it change? | Cloud SQL, SaaS APIs, app events |
| Ingestion | Batch or streaming? Full or incremental? | Pub/Sub, Datastream, Storage Transfer, Airflow |
| Storage | Lake, warehouse or both? Formats? Retention? | GCS, BigQuery |
| Transformation | Where do cleaning and business rules live? | BigQuery SQL, dbt, Dataflow, Dataproc |
| Serving | Who consumes it, how fresh must it be? | Looker, BigQuery BI Engine, Vertex AI |

## Production readiness checklist
- Scheduled and orchestrated (no manual steps).
- **Idempotent**: reruns don't duplicate data.
- Retries for transient errors; alerts for real failures.
- Data quality tests and freshness checks.
- Version control, code review, CI.
- Documentation and a named **owner**.
- Cost understood and monitored.

> [!REAL] Interviewers love "walk me through a pipeline end to end". Answer with the lifecycle: where data comes from, how you ingest it, where you store it, how you transform and test it, who uses it, and how you know it's working.

=== crisp
**Data engineering** = building and operating the systems that make data **available, reliable and usable** for analytics, ML and products.

**Lifecycle:** Generation (apps, devices, SaaS) → **Ingestion** (batch/stream, APIs, CDC) → **Storage** (lake, warehouse) → **Transformation** (clean, model, aggregate) → **Serving** (BI, ML features, reverse ETL, APIs).

**Undercurrents** running through every stage: security & privacy, data management (catalog, lineage, quality), DataOps (testing, CI/CD, monitoring), orchestration, architecture, software engineering.

| Role | Focus |
|---|---|
| Data engineer | pipelines, platforms, reliability, scale |
| Analytics engineer | modelling in the warehouse (dbt), metrics, tests |
| Data analyst | answering business questions, dashboards |
| Data scientist / ML engineer | models, experiments, features |

**Production** means: scheduled & automated, monitored & alerting, tested, documented, recoverable, owned, cost-aware.

=== memory
- **"G-I-S-T-S"**: Generate, Ingest, Store, Transform, Serve.
- A pipeline is "done" when it's **automated, tested, monitored and owned** — not when it ran once.

=== data
flashcards:
  - q: "Stages of the data engineering lifecycle?"
    a: "Generation, ingestion, storage, transformation, serving."
  - q: "What are the 'undercurrents' of data engineering?"
    a: "Security, data management, DataOps, orchestration, architecture, software engineering."
  - q: "Data engineer vs analytics engineer?"
    a: "DE builds and operates pipelines/platforms; AE models and tests data in the warehouse for analysis."
quiz:
  - q: "Which is NOT part of making a pipeline production-ready?"
    options: ["Monitoring and alerting", "Automated tests", "Running it manually from a laptop each morning", "Documentation and ownership"]
    answer: 2
  - q: "Moving daily CSV exports from a vendor's SFTP into Cloud Storage is which lifecycle stage?"
    options: ["Generation", "Serving", "Transformation", "Ingestion"]
    answer: 3
    explain: "Ingestion moves data from the source system into your platform."
  - q: "Who would most typically own a tested `fct_orders` model built with dbt?"
    options: ["Backend app developer", "Network engineer", "Analytics engineer", "Data scientist"]
    answer: 2
    explain: "Analytics engineers focus on clean, tested, documented models inside the warehouse."
recall:
  - q: "Explain what a data engineer does using the data lifecycle, and what makes a pipeline production-ready."
    keyPoints:
      - "generation, ingestion, storage, transformation, serving"
      - "undercurrents: security, quality, orchestration, DataOps"
      - "reliable, scheduled, idempotent"
      - "monitoring and alerting"
      - "tests, docs, owner"
      - "difference from analyst and scientist"
exercises:
  - id: def-role-lifecycle-1
    lang: text
    kind: scenario
    difficulty: 1
    title: Map your current work
    prompt: |
      Describe a data flow from your own work, studies or a project (e.g. a dashboard or report) through the lifecycle stages: where data is generated, how it is ingested, where it is stored, how it is transformed and how it is served. Then name one thing that would need to change for it to be "production-grade".
    solution: |
      Example: **Generation** — orders in the ERP/SQL Server. **Ingestion** — nightly export / gateway refresh. **Storage** — SQL database or BigQuery dataset. **Transformation** — SQL views / Power Query steps / dbt models. **Serving** — Power BI dataset & report.

      Production-grade gaps often are: manual steps, no tests on data, no alerting when refresh fails, transformation logic hidden in the BI tool instead of version-controlled SQL, no documentation/owner.
    review:
      - "Names a concrete source (generation)"
      - "Explains ingestion method"
      - "Identifies storage"
      - "Describes transformation logic location"
      - "Describes serving layer"
      - "Identifies at least one production gap"
interview:
  - q: "Why do you want to become a data engineer?"
    type: behavioral
    level: 1
    keyPoints:
      - "concrete experience with data problems (work, studies or projects)"
      - "interest in building reliable systems not just reports"
      - "examples of automation, pipelines or projects already done"
      - "skills being built and how"
      - "how your background helps"
