=== lesson
--- step concept: The format decides cost and speed
The same data stored as CSV, JSON, Parquet or Avro behaves very differently in size, speed and safety.

| Format | Layout | Schema | Compression | Best for |
|---|---|---|---|---|
| CSV | row, text | none (header only) | poor | small exchanges, spreadsheets |
| JSON / JSONL | row, text | self-describing, loose | poor | APIs, events, nested data |
| **Avro** | row, binary | embedded, strict, evolvable | good | streaming, Kafka, write-heavy ingestion |
| **Parquet** | **columnar**, binary | embedded | excellent | analytics, data lakes |
| ORC | columnar, binary | embedded | excellent | Hive/Hadoop ecosystems |

> [!WHY] Reading 2 of 40 columns from Parquet can be 10–50× cheaper than reading a CSV of the same data — in time and in cloud bills.

[[quiz:def-file-formats:q0]]

--- step example: Inside a Parquet file
A Parquet file is split into **row groups** (e.g. ~128 MB); each row group stores each **column chunk** separately, encoded (dictionary, run-length) and compressed (Snappy/ZSTD). The footer holds the schema and **min/max statistics** per column chunk.

So a query engine can:
1. read only the needed columns (**projection pushdown**),
2. skip row groups whose min/max cannot match the filter (**predicate pushdown**).

--- step check: Choose the format
[[exercise:def-file-formats-1]]
[[exercise:def-file-formats-2]]

--- step scenario: The small-files problem
[[exercise:def-file-formats-3]]
[[recall:def-file-formats:r0]]

=== detailed
## Row vs columnar
- **Row-oriented** (CSV, JSON, Avro): each record stored together. Cheap to append and to read whole records; good for streaming and ingestion.
- **Column-oriented** (Parquet, ORC): each column stored together. Read only needed columns; similar values compress well; ideal for analytical scans.

## CSV
Ubiquitous, human-readable — and fragile: no types (everything is text), no standard for NULL vs empty, quoting/escaping/delimiter/encoding issues, header drift, no compression without gzip (and gzip CSV is not splittable for parallel reads).

## JSON
Self-describing and nested — great for APIs and events. But verbose (keys repeated per record), slow to parse, loosely typed (numbers as strings), and schema drift is easy. Use **JSON Lines** for large files.

## Avro
Binary row format with a **schema** (JSON-defined) stored in the file header / schema registry. Strong support for **schema evolution** (add a field with a default, rename via aliases) → the standard for Kafka messages and CDC streams.

## Parquet
Columnar, binary, typed, with nested types, statistics and efficient encodings. Splittable for parallelism. Readers: BigQuery external/load, Spark, pandas/pyarrow, DuckDB. Table formats like **Delta Lake, Apache Iceberg, Apache Hudi** add ACID transactions, time travel and schema evolution on top of Parquet files.

## Compression
| Codec | Speed | Ratio | Note |
|---|---|---|---|
| Snappy | very fast | moderate | Parquet default |
| ZSTD | fast | high | modern default choice |
| GZIP | slow | high | CSV.gz not splittable |

## Partitioned layouts
Files are usually organised in folders: `gs://lake/orders/dt=2025-06-01/part-000.parquet`. Engines prune partitions from the path (Hive-style partitioning).

## The small-files problem
Thousands of tiny files (e.g. one per streaming micro-batch) are slow: per-file open/metadata overhead dominates, and query planning explodes. Target files of ~128 MB–1 GB; **compact** small files periodically; `coalesce` before writing in Spark.

## Choosing
- Ingestion/streaming, schema evolution → **Avro**.
- Analytics storage in a lake → **Parquet** (+ Iceberg/Delta for tables).
- Exchanging small data with humans/legacy systems → CSV.
- APIs/events → JSON, converted to Parquet when landed for analytics.

=== crisp
- CSV: text, untyped, fragile quoting/encoding; human-friendly; poor compression.
- JSON(L): nested, self-describing, verbose, loose types → APIs/events.
- **Avro**: binary **row** format + schema + evolution → Kafka/streaming/ingestion.
- **Parquet/ORC**: binary **columnar**, typed, compressed, min/max stats → analytics.
- Parquet → projection pushdown (columns) + predicate pushdown (skip row groups).
- Table formats (Iceberg, Delta, Hudi) = ACID + time travel on Parquet.
- Partition folders `dt=YYYY-MM-DD`; target 128 MB–1 GB files; compact small files.
- gzip CSV isn't splittable; Snappy/ZSTD for Parquet.

=== memory
- **"Avro for the Arrows (streams), Parquet for the Pivot tables (analytics)."**
- **"CSV has no types, only hope."**
- Small files = "a million envelopes with one word each".

=== data
flashcards:
  - q: "Row vs columnar format — one example of each."
    a: "Row: Avro (also CSV/JSON). Columnar: Parquet (also ORC)."
  - q: "What is predicate pushdown in Parquet?"
    a: "Using per-row-group min/max statistics to skip data that cannot match the filter."
  - q: "Why is Avro popular for Kafka/CDC?"
    a: "Compact binary rows with an explicit schema and good schema-evolution support."
  - q: "What is the small-files problem?"
    a: "Too many tiny files cause huge per-file overhead and slow planning; compact into larger files."
  - q: "Why is CSV risky for pipelines?"
    a: "No types or schema, ambiguous NULLs, quoting/encoding issues, header drift."
quiz:
  - q: "You store 3 years of clickstream for analytical queries that read 5 of 60 columns. Best format?"
    options: ["CSV", "JSON", "Parquet", "Avro"]
    answer: 2
recall:
  - q: "Compare CSV, JSON, Avro and Parquet and say when you would use each."
    keyPoints:
      - "CSV text without schema, for simple exchange"
      - "JSON nested and self-describing, for APIs and events"
      - "Avro row-based binary with schema evolution, for streaming"
      - "Parquet columnar compressed, for analytics"
      - "columnar enables column pruning and predicate pushdown"
exercises:
  - id: def-file-formats-1
    lang: mcq
    kind: concept
    difficulty: 1
    title: Format for a Kafka topic
    prompt: |
      Order events are published to Kafka by several microservices. Producers add new optional fields over time and consumers must not break. Which format fits best?
    choices: ["CSV", "Avro with a schema registry", "Parquet", "Plain text"]
    answer: 1
    explain: |
      Avro is a compact row format designed for record-at-a-time messaging, and a schema registry enforces compatible schema evolution (e.g. new fields with defaults).
  - id: def-file-formats-2
    lang: mcq
    kind: concept
    difficulty: 2
    title: Why is this query cheap?
    prompt: |
      A Spark job filters `WHERE event_date = '2025-06-01' AND country = 'IN'` and selects 3 columns from a 2 TB Parquet dataset stored as `events/event_date=…/`. It reads only 4 GB. Which combination explains it?
    choices:
      - "Caching only"
      - "Partition pruning + column projection + row-group statistics"
      - "Gzip compression"
      - "Broadcast join"
    answer: 1
  - id: def-file-formats-3
    lang: text
    kind: scenario
    difficulty: 2
    title: 200,000 tiny files
    prompt: |
      A streaming job writes a Parquet file every 10 seconds per partition into GCS. After three months, queries on this data in BigQuery/Spark have become very slow even though total size is only 300 GB. Explain the cause and how you would fix and prevent it.
    solution: |
      **Cause:** the **small-files problem** — hundreds of thousands of KB-sized files. Each file adds open/metadata/listing overhead and scheduling tasks; per-file footers are read; parallelism is wasted on tiny units; Parquet compression and statistics are ineffective on tiny row groups.

      **Fix:** run a **compaction** job that rewrites each partition into a few files of ~256 MB–1 GB (Spark `repartition`/`coalesce` then overwrite the partition; or Delta/Iceberg `OPTIMIZE` / rewrite data files).

      **Prevent:** larger micro-batch triggers, write buffering, partition by day not by minute, use a table format with auto-compaction, or stream into BigQuery directly (Storage Write API) instead of files.
    review:
      - "Names the small-files problem"
      - "Explains per-file overhead"
      - "Proposes compaction into larger files"
      - "Suggests prevention (bigger batches / table format / coarser partitions)"
interview:
  - q: "Why is Parquet preferred for analytical workloads?"
    type: concept
    level: 2
    keyPoints:
      - "columnar storage reads only needed columns"
      - "high compression from similar values"
      - "row group statistics enable predicate pushdown"
      - "typed schema embedded"
      - "splittable for parallel processing"
