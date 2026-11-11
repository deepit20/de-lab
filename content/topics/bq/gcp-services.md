=== lesson
--- step concept: The GCP data toolbox
| Need | Service |
|---|---|
| receive events in real time | **Pub/Sub** |
| batch or streaming transformation code (Apache Beam) | **Dataflow** |
| run Spark/Hadoop jobs | **Dataproc** |
| schedule and orchestrate pipelines (Airflow) | **Cloud Composer** |
| small event-driven code (a file landed → do X) | **Cloud Functions / Cloud Run** |
| store files | **Cloud Storage** |
| warehouse and SQL | **BigQuery** |

--- step concept: Pub/Sub
Publishers send messages to a **topic**; each **subscription** gets a copy. It decouples producers from consumers and buffers spikes. Delivery is **at-least-once** — consumers must handle duplicates (dedupe on a message/event id).

--- step concept: Dataflow vs Dataproc
- **Dataflow** — serverless, autoscaling Apache Beam. One programming model for batch **and** streaming, with event-time windows, watermarks and late data handling.
- **Dataproc** — managed Spark clusters. Best when you already have Spark code or need the Spark ecosystem; spin up ephemeral clusters per job to save cost.

[[quiz:gcp-services:q0]]
[[quiz:gcp-services:q1]]

--- step concept: Composer and Cloud Functions
**Composer** is managed Airflow: it *orchestrates* — it tells BigQuery, Dataflow and Dataproc what to do and when; it shouldn't do heavy processing itself. **Cloud Functions/Run** are glue: a file lands in GCS → trigger a load or validation.

[[quiz:gcp-services:q2]]

--- step interview: Explain it
[[recall:gcp-services:r0]]

=== detailed
## Reference architectures
**Batch:** Source → (Composer schedules) → extract to **GCS** → load to **BigQuery** raw → SQL/dbt transforms → marts → Looker.

**Streaming:** App events → **Pub/Sub** → **Dataflow** (parse, dedupe, window, enrich) → **BigQuery** (Storage Write API) → real-time dashboard. Raw events also archived to GCS.

## Pub/Sub
- Topic, subscription (pull or push), acknowledgement deadline, retention (up to 31 days on topics), dead-letter topics for poison messages.
- Ordering keys when order matters per key.
- **BigQuery subscriptions** write messages straight into a table — no code — when no transformation is needed.

## Dataflow
- Apache Beam pipelines in Python/Java: `PCollection`, `ParDo`, `GroupByKey`, windows.
- Event time vs processing time; **watermarks** estimate completeness; **triggers** decide when to emit; allowed lateness controls state.
- Google-provided **templates** (Pub/Sub → BigQuery, GCS → BigQuery) for common jobs.

## Dataproc
- Managed Spark/Hadoop/Hive/Presto with GCS as storage (not HDFS).
- **Ephemeral clusters**: create → run job → delete, orchestrated by Composer. Or **Dataproc Serverless** for Spark batches without managing clusters.
- Preemptible/spot secondary workers to reduce cost.

## Cloud Composer
- Airflow with GCP operators: `BigQueryInsertJobOperator`, `GCSToBigQueryOperator`, `DataflowStartFlexTemplateOperator`, `DataprocSubmitJobOperator`.
- Keep the workers light: push work to the services above.

## Cloud Functions / Cloud Run
- Event triggers: GCS object finalised, Pub/Sub message, HTTP, Eventarc.
- Small tasks: validate a file, start a load, call an API, send an alert.
- Time and memory limits make them unsuitable for big transformations.

## Choosing
| Situation | Pick |
|---|---|
| SQL transformations on warehouse data | BigQuery (+ dbt/scheduled queries) |
| Streaming with windows and late data | Pub/Sub + Dataflow |
| Existing PySpark codebase | Dataproc (Serverless) |
| Many dependent steps on a schedule | Composer |
| React to a single file or event | Cloud Functions/Run |

=== crisp
| Service | What it is | Typical DE use |
|---|---|---|
| **Pub/Sub** | managed global messaging (topics → subscriptions), at-least-once (exactly-once option) | event ingestion, decoupling producers/consumers, streaming into BigQuery (BigQuery subscriptions) |
| **Dataflow** | managed **Apache Beam** runner, autoscaling, batch + streaming | streaming ETL with windows/watermarks, large batch transforms |
| **Dataproc** | managed **Spark/Hadoop** clusters (also serverless Spark) | lift-and-shift Spark jobs, PySpark processing |
| **Cloud Composer** | managed **Apache Airflow** | orchestration of pipelines across services |
| **Cloud Functions / Cloud Run** | serverless code triggered by events/HTTP; containers | lightweight ingestion (API pulls, file-arrival triggers), glue code |
| **Datastream** | serverless **CDC** from MySQL/Postgres/Oracle | replicate OLTP changes into BigQuery/GCS |
| **Dataplex / Data Catalog** | data governance, discovery, quality | catalog, lineage, DQ scans |
| **Cloud Scheduler** | cron as a service | trigger simple jobs |

**Choosing:** SQL-only transforms on warehouse data → BigQuery (+ dbt/Dataform, scheduled queries). Streaming with complex event-time logic → Pub/Sub + Dataflow. Existing Spark code → Dataproc. Orchestrating many steps → Composer.

=== memory
- **"Pub/Sub carries, Dataflow transforms streams, Dataproc runs Spark, Composer conducts, Functions glue, Datastream replicates."**

=== data
flashcards:
  - q: "What is Cloud Composer?"
    a: "Google's managed Apache Airflow service."
  - q: "Dataflow vs Dataproc?"
    a: "Dataflow: serverless Apache Beam (batch+streaming, autoscaling). Dataproc: managed Spark/Hadoop clusters."
  - q: "Which service provides CDC from Cloud SQL/MySQL into BigQuery?"
    a: "Datastream."
  - q: "Pub/Sub delivery guarantee by default?"
    a: "At-least-once (exactly-once delivery available for pull subscriptions)."
quiz:
  - q: "Real-time clickstream needs event-time windows with late data handling before landing in BigQuery. Best fit?"
    options: ["Cloud Scheduler + BigQuery", "Pub/Sub + Dataflow", "Cloud Storage only", "Composer alone"]
    answer: 1
  - q: "Pub/Sub delivers messages at-least-once. What must the consumer do?"
    options: ["use only one subscription", "handle duplicates, e.g. dedupe on an event id", "nothing — duplicates are impossible", "acknowledge messages twice"]
    answer: 1
    explain: "Redelivery can happen, so downstream processing must be idempotent."
  - q: "A data file lands in GCS and you want to immediately start a BigQuery load. Simplest service?"
    options: ["Cloud Functions / Cloud Run triggered by the GCS event", "a Dataproc cluster", "a Dataflow streaming job", "a VM polling every second"]
    answer: 0
    explain: "Event-driven functions are the lightweight glue for single events like a file landing."
recall:
  - q: "Describe a batch and a streaming architecture on GCP and when you would choose Dataflow, Dataproc and Composer."
    keyPoints:
      - "Pub/Sub for event ingestion, at-least-once"
      - "Dataflow: serverless Beam, batch and streaming, windows and watermarks"
      - "Dataproc: managed Spark, ephemeral clusters"
      - "Composer orchestrates, doesn't process"
      - "Cloud Functions for event-driven glue"
      - "BigQuery as the warehouse"
interview:
  - q: "Design a GCP architecture to ingest app events in real time and make them queryable in BigQuery within a minute."
    type: design
    level: 3
    keyPoints:
      - "app publishes to Pub/Sub"
      - "Dataflow streaming job for parsing, dedup, windows"
      - "write to BigQuery via Storage Write API"
      - "dead-letter topic for bad messages"
      - "raw archive to GCS"
      - "monitoring and alerting"
