=== lesson
--- step concept: Partitions are the unit of parallelism
A DataFrame is split into **partitions**; each task processes one. Too few partitions → idle cores and huge tasks (spill/OOM). Too many → scheduling overhead and tiny files.

- Reading files: roughly one partition per file block (~128 MB, `spark.sql.files.maxPartitionBytes`).
- After a shuffle: `spark.sql.shuffle.partitions` (default **200**) — or chosen adaptively by AQE.

[[quiz:spark-partitions:q0]]

--- step concept: Narrow vs wide
- **Narrow** transformations: each output partition depends on **one** input partition — `filter`, `select`, `withColumn`, `map`, `union`. Pipelined in one stage, no data movement.
- **Wide** transformations: output partitions need data from **many** input partitions — `groupBy`, `join` (non-broadcast), `distinct`, `orderBy`, `repartition`, window functions. Require a **shuffle**: write intermediate data, transfer over the network, read on the other side. New stage.

> [!PERF] Shuffles are usually the most expensive part of a Spark job. Reduce the data **before** shuffling (filter early, select fewer columns, pre-aggregate) and avoid unnecessary ones.

[[exercise:spark-partitions-1]]

--- step concept: repartition vs coalesce
- `repartition(n)` / `repartition(n, "col")` — **full shuffle**, can increase or decrease partitions, balances data, or co-locates by key.
- `coalesce(n)` — **merges** partitions without a shuffle, only decreases; may produce uneven partitions. Typical before writing to avoid thousands of small files.

[[exercise:spark-partitions-2]]
[[exercise:spark-partitions-3]]
[[recall:spark-partitions:r0]]

=== detailed
## Partition sizing
Aim for partitions of roughly **100–200 MB** in memory and enough partitions for 2–4× the number of cores. Signs of trouble in the Spark UI:
- a few tasks much slower than the median → **skew**,
- "spill (memory/disk)" → partitions too big or not enough memory,
- thousands of millisecond tasks → too many partitions.

## Shuffle mechanics
Map side: each task partitions its output by key (hash) and writes shuffle files. Reduce side: each task fetches its key range from all map outputs. Cost = disk I/O + network + serialisation; failures may require recomputation. `spark.sql.shuffle.partitions` controls reduce-side parallelism (200 default — often too many for small data, too few for TBs).

## Adaptive Query Execution (AQE, Spark 3+)
At runtime, using real shuffle statistics:
- **coalesces** small shuffle partitions,
- switches sort-merge joins to **broadcast** when one side turns out small,
- **splits skewed partitions** in joins.
Enabled by default in recent Spark (`spark.sql.adaptive.enabled=true`).

## Partitioning on write
`df.write.partitionBy("dt").parquet(path)` creates folders `dt=2025-06-01/…` → readers prune by folder. Different from in-memory partitions! Combining: `df.repartition("dt").write.partitionBy("dt")` gives roughly one file per date folder; without it each task may write a file into every folder (small-files explosion).

## Bucketing
Pre-shuffles data into a fixed number of buckets by key at write time (`bucketBy`) so later joins on that key avoid shuffles — useful for repeated joins of large tables in Hive-metastore setups.

## Skew handling
- Broadcast the small side.
- Salt hot keys: add `salt = rand() * N` to the big side, explode the small side N times, join on (key, salt).
- Filter/handle NULL or dominant keys separately.
- AQE skew join.

=== crisp
- **Partition** = unit of parallelism; **1 task per partition per stage**.
- Read partitions ≈ 128 MB file splits; shuffle partitions = `spark.sql.shuffle.partitions` (200) or AQE.
- **Narrow** (filter, select, withColumn, union) — no shuffle. **Wide** (groupBy, join, distinct, orderBy, window, repartition) — **shuffle**, new stage.
- Shuffles = disk + network + serialisation → reduce data before them.
- `repartition(n[, col])` full shuffle, up or down, balanced/co-located. `coalesce(n)` no shuffle, down only (pre-write).
- Target ~100–200 MB partitions; 2–4× cores.
- AQE: coalesce partitions, dynamic broadcast, skew split.
- `write.partitionBy("dt")` = folder layout for pruning (≠ in-memory partitions).

=== memory
- **"Narrow stays in its lane; wide needs the highway (shuffle)."**
- **"Repartition reshuffles the deck; coalesce just stacks piles together."**
- 200 = the default shuffle partitions number to remember.

=== data
flashcards:
  - q: "Narrow vs wide transformation?"
    a: "Narrow: each output partition depends on one input partition (no shuffle). Wide: needs data from many partitions (shuffle)."
  - q: "repartition vs coalesce?"
    a: "repartition does a full shuffle and can increase/decrease; coalesce merges partitions without a shuffle and can only decrease."
  - q: "Default spark.sql.shuffle.partitions?"
    a: "200."
  - q: "What does AQE do?"
    a: "Re-optimises at runtime: coalesces shuffle partitions, switches to broadcast joins, splits skewed partitions."
  - q: "Why `repartition('dt')` before `write.partitionBy('dt')`?"
    a: "So each date's rows sit in one task, producing few files per folder instead of one per task per folder."
quiz:
  - q: "Which is a narrow transformation?"
    options: ["groupBy().sum()", "join (sort-merge)", "filter()", "distinct()"]
    answer: 2
recall:
  - q: "Explain partitions, shuffles and the difference between repartition and coalesce."
    keyPoints:
      - "partition is the unit of parallel work"
      - "narrow transformations avoid shuffle"
      - "wide transformations shuffle data across the network"
      - "shuffle partitions setting default 200"
      - "repartition full shuffle up or down"
      - "coalesce reduces without shuffle"
      - "AQE adapts partitions at runtime"
exercises:
  - id: spark-partitions-1
    lang: mcq
    kind: concept
    difficulty: 2
    title: Spot the shuffles
    prompt: |
      Which pipeline triggers **no** shuffle?
    choices:
      - "df.filter(...).select(...).withColumn(...)"
      - "df.groupBy('a').count()"
      - "df.distinct()"
      - "big.join(other_big, 'id')"
    answer: 0
  - id: spark-partitions-2
    lang: python
    kind: predict
    difficulty: 2
    title: repartition vs coalesce in the plan
    prompt: |
      In the emulator, create `wide = orders.repartition(16, "customer_id")` and `narrow = wide.coalesce(4)`. Print `wide.rdd.getNumPartitions()`, `narrow.rdd.getNumPartitions()` and call `narrow.explain()` to see which step shuffles. Store the two numbers in `parts = (…, …)`.
    starter: |
      from pyspark.sql import SparkSession

      spark = SparkSession.builder.getOrCreate()
      orders = spark.read.csv("/data/orders.csv", header=True, inferSchema=True)

    solution: |
      from pyspark.sql import SparkSession

      spark = SparkSession.builder.getOrCreate()
      orders = spark.read.csv("/data/orders.csv", header=True, inferSchema=True)
      wide = orders.repartition(16, "customer_id")
      narrow = wide.coalesce(4)
      parts = (wide.rdd.getNumPartitions(), narrow.rdd.getNumPartitions())
      print(parts)
      narrow.explain()
    tests:
      - call: "parts"
        expect: "(16, 4)"
  - id: spark-partitions-3
    lang: text
    kind: scenario
    difficulty: 3
    title: 50,000 output files
    prompt: |
      A daily job reads 2 TB, does a `groupBy` and writes with `.write.partitionBy("event_date", "country").parquet(path)`. Each run produces ~50,000 tiny files and downstream reads are slow. Explain why and fix it.
    solution: |
      **Why:** after the groupBy there are `spark.sql.shuffle.partitions` (e.g. 200+) tasks; **each task writes one file into every (event_date, country) folder it holds data for**. With many dates × countries × 200 tasks → tens of thousands of small files.

      **Fix:**
      - `df.repartition("event_date", "country").write.partitionBy("event_date", "country")` → rows for one folder land in one task → ~1 file per folder (or add a salt/`maxRecordsPerFile` for big folders).
      - Reduce shuffle partitions / enable AQE coalescing; or `coalesce(n)` before writing when the output is small.
      - Reconsider partitioning granularity (country may be better as a clustering/sort column than a folder).
      - Compact existing data (or use Delta/Iceberg OPTIMIZE).
    review:
      - "Explains tasks × partition folders → many files"
      - "repartition by the partition columns before write"
      - "Shuffle partitions / AQE / coalesce tuning"
      - "Reconsider partition granularity"
      - "Compaction of existing files"
interview:
  - q: "What is a shuffle in Spark, when does it happen and how do you minimise it?"
    type: concept
    level: 2
    keyPoints:
      - "redistribution of data across executors by key"
      - "caused by wide transformations groupBy join distinct orderBy"
      - "expensive disk network serialization"
      - "filter and project early"
      - "broadcast small tables"
      - "tune shuffle partitions and AQE"
  - q: "repartition vs coalesce — when do you use each?"
    type: concept
    level: 2
    keyPoints:
      - "repartition full shuffle increases or decreases"
      - "repartition by column co-locates keys"
      - "coalesce merges without shuffle only decreases"
      - "coalesce before writing to reduce files"
      - "coalesce can create uneven partitions"
