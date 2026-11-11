=== lesson
--- step concept: A table that never stops growing
Structured Streaming treats a stream as an **unbounded table**: new events are new rows. You write the same DataFrame code as for batch, and Spark runs it **incrementally** in small **micro-batches**.

```python
events = (spark.readStream.format("kafka")
          .option("kafka.bootstrap.servers", "broker:9092")
          .option("subscribe", "clicks").load())

counts = events.groupBy("page").count()

(counts.writeStream.outputMode("complete")
       .format("console").start())
```

--- step concept: Triggers and output modes
**Triggers** — how often to run: default (as soon as possible), `processingTime="1 minute"`, or `availableNow=True` (process everything available, then stop).

**Output modes** — what to write each time:
- `append` — only new final rows (needs a watermark for aggregations)
- `update` — rows that changed
- `complete` — the whole result table (small aggregates only)

[[quiz:spark-streaming:q0]]

--- step concept: Late data and watermarks
Events arrive late (phones offline, network delays). A **watermark** says how late you'll accept: "keep windows open for 10 minutes after the latest event time seen". After that the window is final and its state is dropped.

```python
(events.withWatermark("event_time", "10 minutes")
       .groupBy(F.window("event_time", "5 minutes"), "page").count())
```
[[quiz:spark-streaming:q1]]

--- step concept: Checkpoints and exactly-once
A **checkpoint location** stores offsets and state so a restarted query continues where it stopped. With a replayable source (Kafka, files) and an idempotent or transactional sink (Delta, `foreachBatch` + MERGE), results are **exactly-once**.

[[quiz:spark-streaming:q2]]

--- step interview: Explain it
[[recall:spark-streaming:r0]]

=== detailed
## Model
- Input: unbounded table fed by a source (Kafka, files in a folder, Kinesis, rate source for tests).
- Query: normal DataFrame/SQL operations.
- Result table: updated each trigger; written to a sink by output mode.
- Engine: micro-batches (default) or continuous processing (experimental, low-latency).

## Triggers
| Trigger | Behaviour |
|---|---|
| default | next micro-batch as soon as the previous one finishes |
| `processingTime='1 minute'` | fixed interval |
| `availableNow=True` | process all available data in batches, then stop — cheap scheduled incremental jobs |
| `once=True` | older single-batch version of availableNow |

## Output modes
| Mode | Writes | Works with |
|---|---|---|
| append | new rows that will never change | non-aggregations; aggregations with watermark |
| update | changed rows | aggregations; sinks that can upsert |
| complete | full result | aggregations with small results |

## Event time, windows, watermarks
- **Event time** = when it happened; **processing time** = when Spark sees it.
- Tumbling windows `window(ts, "5 minutes")`, sliding windows `window(ts, "10 minutes", "5 minutes")`.
- Watermark = max event time seen − delay threshold. Older events are dropped; state for closed windows is removed — otherwise state grows forever.
- Stream–stream joins also need watermarks to bound state.

## Fault tolerance
- `option("checkpointLocation", "gs://…/checkpoints/clicks")` — one per query, never shared or deleted casually.
- Replayable source + checkpoint + idempotent sink = exactly-once.
- `foreachBatch(fn)` lets you write each micro-batch with batch code, e.g. MERGE into a Delta/BigQuery table; dedupe by event id because a batch may be retried.

## Operating
- Monitor input rate vs processing rate, batch duration, state size, watermark lag.
- Changing query logic may require a new checkpoint.

> [!REAL] On GCP the equivalent managed path is Pub/Sub → Dataflow (Beam), with the same concepts: windows, watermarks, triggers, late data.

=== crisp
**Structured Streaming** treats a stream as an **unbounded table**; you write the same DataFrame code, Spark runs it incrementally in **micro-batches** (or continuous mode).
```python
events = (spark.readStream.format("kafka").option("subscribe", "clicks").load()
          .select(F.from_json(F.col("value").cast("string"), schema).alias("e")).select("e.*"))
counts = (events
    .withWatermark("event_time", "10 minutes")
    .groupBy(F.window("event_time", "5 minutes"), "page")
    .count())
(counts.writeStream.outputMode("append").format("parquet")
    .option("checkpointLocation", "gs://chk/clicks_counts").option("path", "gs://lake/clicks_counts")
    .trigger(processingTime="1 minute").start())
```
- **Triggers**: `processingTime`, `availableNow` (process backlog then stop — batch-like), continuous.
- **Output modes**: `append` (only finalised rows — needs watermark for aggregations), `update` (changed rows), `complete` (whole result table).
- **Watermark** = how late data may arrive; lets Spark finalise windows and drop old state.
- **Checkpointing** (offsets + state) enables recovery and, with idempotent/transactional sinks, **exactly-once**.
- State stores for aggregations, deduplication (`dropDuplicates` with watermark), stream–stream joins.

=== memory
- **"A stream is a table that never stops growing."**
- **No checkpoint, no recovery.**
- Watermark + append = results only once windows close.

=== data
flashcards:
  - q: "Structured Streaming's core model?"
    a: "An unbounded input table processed incrementally with the same DataFrame/SQL API."
  - q: "What does withWatermark do?"
    a: "Defines how late events can arrive so Spark can finalise windows and discard old state."
  - q: "Three output modes?"
    a: "append, update, complete."
  - q: "Why is checkpointLocation required?"
    a: "It stores offsets and state so the query can recover after failure without losing or duplicating data."
quiz:
  - q: "Which trigger processes all available data and then stops (good for cheap incremental batch)?"
    options: ["processingTime='1 second'", "availableNow", "continuous", "once per row"]
    answer: 1
  - q: "What happens to state when a watermark passes the end of a window?"
    options: ["all data is reprocessed", "the window is finalised and its state can be dropped", "state is kept forever", "the query restarts"]
    answer: 1
    explain: "Watermarks bound how long Spark waits for late data, which keeps state size under control."
  - q: "What lets a restarted streaming query resume without losing or duplicating data?"
    options: ["a checkpoint location plus a replayable source and idempotent sink", "caching the DataFrame", "complete output mode", "a larger cluster"]
    answer: 0
    explain: "The checkpoint stores offsets and state; replay plus idempotent writes give exactly-once results."
recall:
  - q: "Explain Structured Streaming: the unbounded table model, triggers, output modes, watermarks and checkpoints."
    keyPoints:
      - "stream as an unbounded table processed in micro-batches"
      - "triggers: default, processingTime, availableNow"
      - "append, update, complete output modes"
      - "event time windows and watermarks for late data"
      - "checkpoint location stores offsets and state"
      - "exactly-once with replayable source and idempotent sink"
interview:
  - q: "How does Spark Structured Streaming handle late data and failures?"
    type: concept
    level: 3
    keyPoints:
      - "event time windows"
      - "watermarks bound lateness and state"
      - "late data beyond watermark dropped"
      - "checkpointing of offsets and state"
      - "exactly once with replayable source and idempotent sink"
