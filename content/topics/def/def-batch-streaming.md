=== lesson
--- step concept: How fresh does the data need to be?
- **Batch** processes a bounded chunk of data on a schedule: "every night, process yesterday's orders".
- **Streaming** processes unbounded data continuously, event by event or in micro-batches: "update the fraud score within seconds of each payment".

| | Batch | Streaming |
|---|---|---|
| Latency | minutes–hours | milliseconds–seconds |
| Data | bounded (a day, a file) | unbounded (never ends) |
| Complexity | lower | higher (state, ordering, late data) |
| Cost | efficient, bursty | always-on |
| Tools | Airflow + SQL/Spark, scheduled queries | Pub/Sub/Kafka + Dataflow/Flink/Spark Structured Streaming |

> [!THINK] Ask the business "what decision changes if the data is 1 hour old instead of 1 second old?" Most reporting does not need streaming.

[[quiz:def-batch-streaming:q0]]

--- step concept: Time in streaming
- **Event time** — when it happened (in the event payload).
- **Processing time** — when your system sees it.
Events arrive **late** and **out of order** (mobile offline, retries). Streaming engines group by event-time **windows** (tumbling, sliding, session) and use **watermarks** — "I believe I've seen everything up to 10:05" — to decide when a window is complete and how long to wait for stragglers.

--- step check: Pick the processing model
[[exercise:def-batch-streaming-1]]
[[exercise:def-batch-streaming-2]]

--- step scenario: Delivery guarantees
[[exercise:def-batch-streaming-3]]
[[recall:def-batch-streaming:r0]]

=== detailed
## Batch processing
Bounded input, scheduled runs (cron/Airflow), results written in bulk. Easy to reason about, test and rerun (`process dt=2025-06-01` again). Latency equals schedule interval + runtime. Most warehouse ELT is batch.

## Stream processing
Unbounded input from a log/message system (Kafka, Pub/Sub, Kinesis). The processor keeps running, maintains **state** (counts, sessions, joins) and emits results continuously.

### Windows
| Window | Example |
|---|---|
| Tumbling | non-overlapping 5-minute buckets |
| Sliding / hopping | 10-minute window every 1 minute |
| Session | activity separated by > 30 min inactivity |

### Event time, watermarks, late data
Results grouped by processing time are wrong when events are delayed. Event-time processing + **watermarks** bound how long to wait; **allowed lateness** lets late events update results; anything later goes to a side output / dead-letter.

### Delivery semantics
- **At-most-once** — may lose messages, never duplicates.
- **At-least-once** — never loses, may duplicate (most common) → consumers must be **idempotent** or deduplicate by event id.
- **Exactly-once** — each event affects results once; achieved via transactional sinks/checkpointing (Flink, Dataflow, Kafka transactions) — "effectively once" end to end requires idempotent sinks.

## Micro-batch
Spark Structured Streaming processes small batches every few seconds — streaming semantics with batch machinery. Latency ~seconds.

## Lambda vs Kappa
- **Lambda** — batch layer (accurate, recomputed) + speed layer (fast, approximate), merged at serving. Two codebases.
- **Kappa** — everything as a stream; reprocess history by replaying the log. One codebase.
Modern tools (Beam/Dataflow, Spark, Flink) let the same code run in batch and streaming.

## Choosing
Start with batch unless the use case needs sub-minute freshness (fraud, alerting, real-time personalisation, operational monitoring). Hybrid is common: stream raw events into the warehouse (BigQuery Storage Write API) and run batch/near-real-time transformations on top.

=== crisp
- **Batch** = bounded data on a schedule; simple, cheap, rerunnable; latency = schedule.
- **Streaming** = unbounded data continuously; low latency; needs state, windows, late-data handling.
- Event time ≠ processing time; **watermark** = "complete up to T"; allowed lateness; dead-letter for very late.
- Windows: tumbling, sliding, session.
- Delivery: at-most-once / **at-least-once (duplicates → idempotent consumers)** / exactly-once (transactions + checkpoints).
- Micro-batch (Spark) ≈ seconds latency. Lambda (batch + speed layers) vs Kappa (stream only, replay log).
- Default to batch; stream when the decision needs seconds-fresh data.

=== memory
- **"Batch is a bus on a timetable; streaming is a conveyor belt."**
- **At-least-once means 'expect duplicates'.**
- Watermark = "the tide line: everything below it has arrived."

=== data
flashcards:
  - q: "Event time vs processing time?"
    a: "Event time: when the event happened. Processing time: when the system processed it."
  - q: "What is a watermark in stream processing?"
    a: "An estimate that all events up to a certain event time have arrived, used to close windows."
  - q: "What does at-least-once delivery imply for consumers?"
    a: "Duplicates can occur, so processing must be idempotent or deduplicate by event id."
  - q: "Tumbling vs sliding windows?"
    a: "Tumbling: fixed, non-overlapping. Sliding: fixed size, overlapping, advancing by a smaller step."
  - q: "Lambda vs Kappa architecture?"
    a: "Lambda: separate batch and speed layers. Kappa: a single streaming path, reprocessing by replaying the log."
quiz:
  - q: "Which needs streaming most?"
    options: ["Monthly finance report", "Blocking a fraudulent card payment", "Weekly marketing dashboard", "Annual audit"]
    answer: 1
recall:
  - q: "Explain batch vs streaming and how late-arriving events are handled in streaming."
    keyPoints:
      - "batch processes bounded data on a schedule"
      - "streaming processes unbounded data continuously"
      - "event time versus processing time"
      - "windows group events by event time"
      - "watermarks decide when a window is complete"
      - "allowed lateness or dead letter for late events"
exercises:
  - id: def-batch-streaming-1
    lang: mcq
    kind: concept
    difficulty: 1
    title: Daily sales dashboard
    prompt: |
      Store managers look at yesterday's sales every morning at 9am. Which approach is simplest and sufficient?
    choices: ["Kafka + Flink streaming job", "Nightly batch pipeline (e.g. Airflow + SQL) finishing before 9am", "Lambda architecture", "Real-time websocket feed"]
    answer: 1
  - id: def-batch-streaming-2
    lang: mcq
    kind: concept
    difficulty: 2
    title: Late mobile events
    prompt: |
      A mobile app buffers events offline and sends them hours later. You count events per hour. Grouping by **processing time** will…
    choices:
      - "be correct because events arrive in order"
      - "attribute delayed events to the wrong (later) hour"
      - "drop the events"
      - "double count them"
    answer: 1
    explain: |
      Group by **event time** and allow lateness (or recompute recent windows in batch) so delayed events land in the hour they happened.
  - id: def-batch-streaming-3
    lang: text
    kind: scenario
    difficulty: 3
    title: Duplicates from Pub/Sub
    prompt: |
      Payments flow from Pub/Sub (at-least-once delivery) into a BigQuery table that feeds revenue reporting. Finance reports totals slightly higher than the payment provider. Explain why and how you would make totals correct.
    solution: |
      **Why:** at-least-once delivery (and subscriber retries after timeouts/acks lost) means some messages are delivered **more than once**; each delivery inserts a row, so revenue is double counted.

      **Fix:**
      - Every event carries a unique **event/payment id**.
      - Make the sink idempotent: write to a staging table and **MERGE on payment_id**, or deduplicate in the modelled layer with `ROW_NUMBER() OVER (PARTITION BY payment_id ORDER BY publish_time) = 1`.
      - Or use exactly-once processing (Dataflow with exactly-once mode / Pub/Sub exactly-once delivery + BigQuery Storage Write API with offsets) — still keep the id-based dedup as a safety net.
      - Add a **reconciliation check** against the provider's daily totals.
    review:
      - "At-least-once delivery causes duplicates"
      - "Unique event id"
      - "Idempotent sink: MERGE or dedup with ROW_NUMBER"
      - "Mentions exactly-once options"
      - "Reconciliation check against source"
interview:
  - q: "When would you choose streaming over batch, and what extra challenges does streaming introduce?"
    type: concept
    level: 2
    keyPoints:
      - "streaming when low latency changes a decision"
      - "batch is simpler and cheaper"
      - "state management"
      - "late and out of order events"
      - "watermarks and windows"
      - "delivery guarantees and duplicates"
