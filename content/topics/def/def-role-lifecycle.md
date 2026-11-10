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
