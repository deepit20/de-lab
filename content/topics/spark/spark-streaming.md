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
