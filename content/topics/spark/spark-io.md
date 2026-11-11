=== lesson
--- step concept: Reading data
```python
orders = (spark.read.format("csv")
          .option("header", True)
          .schema("order_id INT, customer_id INT, order_date DATE, amount DOUBLE, status STRING")
          .load("/data/orders.csv"))

events = spark.read.json("/data/events.jsonl")
sales  = spark.read.parquet("gs://lake/silver/sales/")
```
Give an explicit **schema** for production jobs: `inferSchema` reads the data an extra time and can guess wrong types (IDs with leading zeros, dates as strings).

--- step concept: Writing data
```python
(df.write
   .mode("overwrite")            # or "append", "error", "ignore"
   .partitionBy("order_month")   # one folder per value: order_month=2025-03/
   .parquet("/out/orders_by_month"))
```
Columnar formats (**Parquet**, ORC, Delta/Iceberg tables) compress well and let readers skip columns and partitions.

[[quiz:spark-io:q0]]

--- step practice: Write partitioned Parquet
[[exercise:spark-io-1]]

--- step concept: Idempotent reloads
`mode("overwrite")` with `partitionBy` normally **replaces the whole folder**. Set dynamic partition overwrite so a rerun replaces **only the partitions in the DataFrame**:

```python
spark.conf.set("spark.sql.sources.partitionOverwriteMode", "dynamic")
```
[[quiz:spark-io:q1]]

--- step check: The small-files problem
[[quiz:spark-io:q2]]

--- step interview: Explain it
[[recall:spark-io:r0]]

=== detailed
## Reader options
| Format | Useful options |
|---|---|
| CSV | `header`, `schema`, `sep`, `quote`, `escape`, `mode` (`PERMISSIVE`, `DROPMALFORMED`, `FAILFAST`), `columnNameOfCorruptRecord` |
| JSON | `multiLine`, `schema`, `mode` |
| Parquet | schema stored in files; `mergeSchema` when it evolves |
| JDBC | `url`, `dbtable`/`query`, `partitionColumn` + `lowerBound`/`upperBound`/`numPartitions` for parallel reads |

- Parquet partition folders `dt=2025-03-14/` become a `dt` column; filters on it prune folders.
- `spark.read…load(path)` is lazy: nothing is read until an action.

## Save modes
| Mode | If data exists |
|---|---|
| `error` / `errorifexists` (default) | fail |
| `append` | add files — duplicates on rerun |
| `overwrite` | replace (whole path, or only touched partitions with dynamic mode) |
| `ignore` | do nothing |

## Partitioning on write
- Partition by a column used in **filters** with **moderate cardinality**: date or month — not `user_id` (millions of folders).
- Target files of ~128 MB–1 GB. Too many small files slow every reader and the metastore.
- `bucketBy` (with `saveAsTable`) pre-shuffles by a join key for repeated joins.

## Small-files problem
Each task writes at least one file per partition value it holds. 200 shuffle partitions × 30 dates = up to 6,000 files.
- `coalesce(n)` before writing to reduce files (no shuffle).
- `repartition("dt")` to get roughly one file set per date.
- Table formats (Delta, Iceberg) offer compaction (`OPTIMIZE`).
- AQE coalescing helps after shuffles.

## Table formats
Delta Lake, Apache Iceberg and Hudi add ACID transactions, `MERGE`, time travel and schema evolution on top of Parquet files in object storage — the basis of the "lakehouse". BigQuery can read Iceberg via BigLake.

> [!REAL] On GCP: Dataproc Spark reads from `gs://` paths directly; the spark-bigquery connector reads/writes BigQuery tables (`spark.read.format("bigquery").load("project.dataset.table")`).

=== crisp
```python
schema = "order_id INT, customer_id INT, order_date DATE, status STRING, channel STRING, amount DOUBLE"
df = (spark.read.format("csv").option("header", True).schema(schema).load("gs://raw/orders/2025-06-01/"))

(df.repartition("order_date")
   .write.mode("overwrite")
   .partitionBy("order_date")
   .parquet("gs://lake/silver/orders/"))
```
- Formats: `csv`, `json`, `parquet`, `orc`, `avro`, `delta`/`iceberg`; BigQuery via the spark-bigquery connector (`format("bigquery")`).
- **Explicit schemas** in production (inferSchema scans data and guesses).
- Save modes: `errorifexists` (default), `append`, `overwrite`, `ignore`.
- `partitionBy("dt")` → folder per value → readers prune. Don't partition by high-cardinality columns.
- **Dynamic partition overwrite** — `spark.conf.set("spark.sql.sources.partitionOverwriteMode", "dynamic")` + `mode("overwrite")` replaces only the partitions present in the DataFrame → **idempotent daily reloads** (static mode would wipe the whole table!).
- Avoid small files: repartition by the partition column or coalesce before writing; `maxRecordsPerFile`.
- Bad records in CSV/JSON: `mode` option `PERMISSIVE` (default, `_corrupt_record` column), `DROPMALFORMED`, `FAILFAST`.

=== memory
- **"Overwrite + dynamic = only my partitions."** (static overwrite = everything gone)
- **Schema explicit, partitions coarse, files big.**

=== data
flashcards:
  - q: "What's the risk of `mode('overwrite')` with default (static) partition overwrite mode?"
    a: "It deletes the whole target directory/table, not just the partitions being written."
  - q: "How do you idempotently reload only today's partition with Spark?"
    a: "Set partitionOverwriteMode=dynamic and write with mode('overwrite').partitionBy('dt')."
  - q: "Why specify a schema instead of inferSchema?"
    a: "Faster (no extra scan) and stable types across files; prevents silent type changes."
  - q: "CSV read modes for bad records?"
    a: "PERMISSIVE (keep, corrupt column), DROPMALFORMED (drop), FAILFAST (error)."
quiz:
  - q: "Best partition column for a large events dataset?"
    options: ["user_id", "event_date", "event_id", "random()"]
    answer: 1
  - q: "Rerunning a job with `mode('overwrite').partitionBy('dt')` for one date wiped all other dates. What was missing?"
    options: ["a cache() call", "inferSchema", "mode('append')", "spark.sql.sources.partitionOverwriteMode = dynamic"]
    answer: 3
    explain: "Static overwrite replaces the whole output path; dynamic replaces only partitions present in the DataFrame."
  - q: "A daily job writes 4,000 files of 50 KB each. Best fix?"
    options: ["switch to CSV", "partition by user_id", "coalesce or repartition before writing", "increase shuffle partitions"]
    answer: 2
    explain: "Fewer, larger files make reading and listing faster."
recall:
  - q: "How do you read and write data in Spark reliably, and how do you avoid the small-files problem?"
    keyPoints:
      - "explicit schema instead of inferSchema"
      - "Parquet or table formats over CSV"
      - "save modes: overwrite, append, error, ignore"
      - "partitionBy a moderate-cardinality filter column like date"
      - "dynamic partition overwrite for idempotent reruns"
      - "coalesce or repartition before writing"
exercises:
  - id: spark-io-1
    lang: python
    kind: coding
    difficulty: 2
    title: Write partitioned Parquet
    prompt: |
      Read orders, keep **delivered** orders, add `order_month` = `F.date_format("order_date", "yyyy-MM")`, and write to `/out/orders_by_month` as Parquet **partitioned by `order_month`** with mode `overwrite`. Then read it back into `back` with `spark.read.parquet(...)`.
    starter: |
      from pyspark.sql import SparkSession, functions as F

      spark = SparkSession.builder.getOrCreate()
      orders = spark.read.csv("/data/orders.csv", header=True, inferSchema=True)

    solution: |
      from pyspark.sql import SparkSession, functions as F

      spark = SparkSession.builder.getOrCreate()
      orders = spark.read.csv("/data/orders.csv", header=True, inferSchema=True)
      delivered = orders.filter(F.col("status") == "delivered").withColumn("order_month", F.date_format("order_date", "yyyy-MM"))
      delivered.write.mode("overwrite").partitionBy("order_month").parquet("/out/orders_by_month")
      back = spark.read.parquet("/out/orders_by_month")
      print(back.count())
    tests:
      - call: "back.count() == orders.filter(F.col('status') == 'delivered').count()"
        expect: "True"
      - call: "'order_month' in back.columns"
        expect: "True"
      - call: "len([d for d in __import__('os').listdir('/out/orders_by_month') if d.startswith('order_month=')]) >= 12"
        expect: "True"
        label: one folder per month
interview:
  - q: "How do you make a Spark job that writes daily partitions safe to rerun?"
    type: design
    level: 2
    keyPoints:
      - "partition output by date"
      - "dynamic partition overwrite mode"
      - "process only the run's date"
      - "avoid append duplicates"
      - "atomic commits with Delta or Iceberg"
