=== lesson
--- step concept: A framework for pipeline design questions
"Design a pipeline that…" questions have no single right answer. You're evaluated on **structure, trade-offs and reliability thinking**. Use this framework (aim ~35 minutes):

1. **Requirements** (5 min) — functional: sources, outputs, consumers, freshness (latency), history. Non-functional: volume, growth, SLAs, cost, compliance/PII.
2. **Estimates** — events/day, bytes/event → GB/day, TB/year; peak rates.
3. **High-level architecture** — ingestion → storage (raw) → processing → modelled storage → serving; draw boxes.
4. **Data model** — key tables, grain, partitioning/clustering.
5. **Deep dives** — 1–2 hard parts: late data, dedup, incremental loads, backfills, schema evolution, skew.
6. **Reliability** — idempotency, retries, data quality checks, monitoring/alerting, recovery.
7. **Trade-offs & evolution** — what you'd do differently at 10× scale, cheaper/faster alternatives.

[[quiz:int-system-design:q0]]

--- step example: Daily sales analytics on GCP
```
POS DB (Cloud SQL) ──Datastream CDC──► BigQuery raw (bronze, partitioned by ingest date)
Payment API ──Cloud Run job (hourly, watermark)──► GCS raw JSON ──load──► BigQuery raw
                                    │
                 Composer (Airflow) orchestrates dbt: staging → fct_sales / dim_* → marts
                                    │
                 data tests (unique, not_null, reconciliation) → publish → Looker Studio
                 monitoring: freshness, row-count anomalies, failure alerts to Slack
```

--- step practice: Your turn
[[exercise:int-system-design-1]]

--- step scenario: Real-time variant
[[exercise:int-system-design-2]]
[[recall:int-system-design:r0]]

=== detailed
## 1. Requirements — questions to ask
- Who consumes the data, and for what decisions? Dashboards, ML, operational use?
- Freshness: daily, hourly, minutes, seconds? (drives batch vs streaming)
- Sources: databases, APIs, files, events? Volumes and formats? Do they send updates/deletes?
- History: do we need point-in-time ("as was") reporting? (SCD2)
- Quality/SLA: by when must data be ready? What's the cost of wrong data?
- Constraints: cloud provider, budget, team skills, PII/regulations, retention.

## 2. Estimation example
50 M events/day × 1 KB = 50 GB/day ≈ 18 TB/year raw (Parquet ~4–5× smaller). Peak 3× average → ~1,700 events/s. This informs partitioning (daily partitions ~50 GB fine), streaming throughput, cost.

## 3. Building blocks (GCP flavour)
| Layer | Options |
|---|---|
| Ingestion batch | Cloud Run/Functions jobs, Composer tasks, Storage Transfer, load jobs |
| Ingestion CDC | Datastream, Debezium on Kafka |
| Ingestion streaming | Pub/Sub (+ Dataflow), BigQuery Storage Write API |
| Raw storage | GCS (bronze), BigQuery raw datasets |
| Processing | BigQuery SQL + dbt/Dataform (ELT), Dataflow (streaming/complex), Dataproc Spark |
| Orchestration | Cloud Composer (Airflow), Workflows, scheduled queries |
| Serving | BigQuery marts, BI Engine, Looker/Looker Studio, reverse ETL, APIs |
| Governance | Dataplex, IAM, policy tags, audit logs |

## 5. Common deep dives
- **Exactly-once / dedup**: event ids, MERGE, `ROW_NUMBER` dedup in staging.
- **Late data**: event-time partitions, lookback windows, reprocessing recent partitions.
- **Incremental processing**: watermarks, partition overwrite, dbt incremental models.
- **Schema evolution**: raw JSON retention, contracts, additive changes, alerting on breaking changes.
- **Backfills**: idempotent interval-based tasks; controlled concurrency.
- **Skew & scale**: partitioning, clustering, broadcast joins, pre-aggregation.

## 6. Reliability checklist
Idempotent tasks · retries with backoff · data quality gates (block publishing) · freshness & volume monitoring · alerting with runbooks · lineage for impact analysis · cost monitoring · access control & PII masking · disaster recovery (time travel, raw replay).

## 7. Trade-off language
"I chose **batch** because the business decides daily; streaming would add cost and complexity for no decision value. If freshness requirements tighten, the raw layer and models stay the same — I'd add Pub/Sub + Dataflow ingestion."

=== crisp
**Framework:** Requirements → Estimates → Architecture → Data model → Deep dives → Reliability → Trade-offs.
- Ask: consumers, freshness, sources & volumes, updates/deletes, history, SLA, PII, budget.
- Estimate: events/day × size → GB/day → TB/year; peak rate.
- Layers: ingest (batch/CDC/stream) → raw (GCS/BQ bronze) → transform (dbt/Dataflow/Spark) → marts → serve.
- Deep dives: dedup/exactly-once, late data, incremental, schema evolution, backfill, skew.
- Reliability: idempotency, retries, DQ gates, monitoring/alerts, lineage, cost, security, recovery.
- Always justify choices and name alternatives.

=== memory
- **"R-E-A-D-D-R-T"**: Requirements, Estimates, Architecture, Data model, Deep dive, Reliability, Trade-offs.
- **"Draw boxes left to right: source → raw → clean → marts → users."**

=== data
flashcards:
  - q: "First step in a pipeline design interview?"
    a: "Clarify requirements: consumers, freshness, sources, volumes, history, SLAs, constraints."
  - q: "What decides batch vs streaming in a design?"
    a: "Freshness requirements and whether faster data changes decisions — balanced against cost and complexity."
  - q: "Name five reliability elements every pipeline design should mention."
    a: "Idempotency, retries, data quality checks, monitoring/alerting, recovery/backfill (also lineage, access control)."
  - q: "50M events/day at 1 KB each is roughly how much per day?"
    a: "About 50 GB/day (~18 TB/year uncompressed)."
quiz:
  - q: "In a design interview the interviewer says 'dashboards are viewed each morning'. This suggests…"
    options: ["a streaming architecture with Flink", "a daily batch pipeline is sufficient", "no pipeline", "real-time websockets"]
    answer: 1
recall:
  - q: "Walk through the framework you use for a data pipeline system design question."
    keyPoints:
      - "clarify functional and non functional requirements"
      - "estimate volumes"
      - "high level architecture from ingestion to serving"
      - "data model with grain and partitioning"
      - "deep dive on hard parts like late data or dedup"
      - "reliability quality monitoring"
      - "trade-offs and alternatives"
exercises:
  - id: int-system-design-1
    lang: text
    kind: scenario
    difficulty: 3
    title: Design — marketing attribution pipeline
    prompt: |
      Design a pipeline that combines **Google Ads spend** (API, daily), **website events** (5 M/day, JSON via Pub/Sub) and **orders** (Cloud SQL Postgres) so marketing can see cost per acquisition by campaign each morning. Cover the framework steps.
    solution: |
      **Requirements:** daily freshness by 8am; CPA by campaign/day/channel; history 2+ years; PII (emails) restricted.
      **Estimates:** 5 M events × ~1 KB = 5 GB/day; orders ~20k/day; ads data small.
      **Architecture:**
      - Ads API → Cloud Run job (Composer-triggered, cursor pagination, retries, watermark) → GCS raw JSON → BigQuery `raw.ads`.
      - Events → Pub/Sub → BigQuery subscription (or Dataflow for parsing/dedup) → `raw.events` partitioned by event date.
      - Orders → Datastream CDC → `raw.orders` → dedup latest by key.
      - dbt models: `stg_*` (types, dedup by event_id/order_id), `int_sessions` (sessionise, attribute UTM campaign), `fct_orders_attributed` (last-click attribution join on session/user), `fct_ad_spend`, mart `campaign_daily_cpa = spend / attributed orders`.
      **Data model:** facts partitioned by date, clustered by campaign_id; `dim_campaign` (SCD2 if names/budgets change).
      **Deep dive:** late events (lookback 3 days, reprocess recent partitions), dedup (event_id), attribution window, currency conversion.
      **Reliability:** idempotent partition overwrites, DQ tests (spend reconciles with Ads UI ±1%, unique keys, freshness), alerts, backfill capability.
      **Trade-offs:** last-click is simple but biased; batch daily is enough (no streaming processing needed); BigQuery subscription vs Dataflow depending on parsing needs.
    review:
      - "Clarifies requirements (freshness, metrics, history, PII)"
      - "Volume estimate"
      - "Ingestion per source (API, Pub/Sub, CDC)"
      - "Layered transformations with dedup and attribution"
      - "Partitioning / data model"
      - "Reliability: idempotency, tests, alerts, late data"
      - "States trade-offs"
  - id: int-system-design-2
    lang: text
    kind: scenario
    difficulty: 3
    title: Design — real-time fraud signals
    prompt: |
      Card transactions (2,000/s peak) must be scored for fraud within **2 seconds**, and analysts need the full history in BigQuery for model training. Sketch the architecture and explain how you handle duplicates, late events and failures.
    solution: |
      **Path 1 (real time):** payment service → **Pub/Sub** topic `transactions` → **Dataflow streaming** job: parse, dedup by `transaction_id` (stateful, within a time window), enrich with customer features (side input / low-latency store like Bigtable/Redis), call model (Vertex AI endpoint) → publish decision to `fraud-decisions` topic consumed by the payment service. Latency budget ~1–2 s.
      **Path 2 (analytics):** same events → BigQuery via Storage Write API (exactly-once stream) into `raw.transactions` partitioned by event date; decisions too; daily batch models build features/training sets.
      **Duplicates:** unique id + dedup in Dataflow state; idempotent sinks; BigQuery dedup view as safety net.
      **Late events:** event-time windows + watermarks for aggregate features; late data updates features via allowed lateness; batch recomputation nightly.
      **Failures:** Pub/Sub retains messages (replay), Dataflow checkpoints/autoscaling, dead-letter topic for malformed messages, fallback rule-based scoring if model endpoint times out, alerts on lag (oldest unacked message age).
      **Trade-offs:** cost of always-on streaming vs necessity of 2 s latency; feature store complexity.
    review:
      - "Pub/Sub + streaming processor (Dataflow)"
      - "Low-latency feature lookup and model call"
      - "Separate analytics path to BigQuery"
      - "Dedup by transaction id"
      - "Watermarks / late data"
      - "Failure handling: replay, dead-letter, fallback, monitoring"
interview:
  - q: "Design a data pipeline that ingests data from multiple sources into BigQuery for daily reporting."
    type: design
    level: 3
    keyPoints:
      - "clarify sources freshness and volume"
      - "raw landing layer"
      - "incremental ingestion and CDC"
      - "transform with dbt layers"
      - "orchestration with Composer"
      - "data quality gates"
      - "monitoring and backfill"
      - "partitioning and cost"
    followUps:
      - "How would you handle a source schema change?"
      - "How would you backfill two years of data?"
      - "What changes at 100x the data volume?"
