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
