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
