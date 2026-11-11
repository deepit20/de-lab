=== lesson
--- step concept: Find the slow part first
Open the **Spark UI**: look for the stage that takes longest, how many bytes it **shuffles**, and whether one task is far slower than the rest (skew). Most slow Spark jobs have one of four causes: too much shuffle, a skewed key, a recomputed DataFrame, or bad partition sizes.

--- step concept: Broadcast joins
Joining a huge table with a small one normally shuffles **both**. A **broadcast join** copies the small table to every executor, so the big table never moves.

```python
from pyspark.sql import functions as F
enriched = orders.join(F.broadcast(customers.select("customer_id", "segment")), "customer_id")
```
Spark broadcasts automatically below `spark.sql.autoBroadcastJoinThreshold` (10 MB by default).

[[exercise:spark-performance-1]]

--- step concept: Cache only what you reuse
`df.cache()` keeps a DataFrame in memory **after** the first action. It helps only when the same DataFrame feeds **several** actions; otherwise it just uses memory.

[[quiz:spark-performance:q0]]

--- step concept: Skew and AQE
**Adaptive Query Execution** (on by default in Spark 3) re-optimises at run time: merges tiny shuffle partitions, switches to broadcast when a side turns out small, and **splits skewed partitions**. For extreme hot keys, **salt** them: add a random suffix, aggregate, then aggregate again.

[[quiz:spark-performance:q1]]

--- step check: Quick wins
[[quiz:spark-performance:q2]]

--- step interview: Explain it
[[recall:spark-performance:r0]]

=== detailed
## Tuning checklist
1. **Read less:** select needed columns and filter early — with Parquet these push down to the file scan (column pruning, predicate pushdown, partition pruning).
2. **Shuffle less:** broadcast small tables, pre-aggregate before joins, avoid unnecessary `distinct`/`orderBy`.
3. **Balance work:** fix skew; right-size partitions (~100–200 MB each).
4. **Don't recompute:** cache/persist DataFrames reused by multiple actions; `unpersist()` when done.
5. **Avoid Python UDFs** when a built-in function exists — they move data between the JVM and Python. If needed, use pandas (vectorised) UDFs.
6. **Write sensibly:** avoid thousands of tiny files.

## Joins
| Strategy | When |
|---|---|
| broadcast hash join | one side small enough to fit in executor memory |
| sort-merge join | both sides large (default) |
| shuffle hash join | medium side, sometimes chosen by AQE |
Use `F.broadcast(df)` or the SQL hint `/*+ BROADCAST(t) */`. Check `df.explain()` for `BroadcastHashJoin`.

## Partitions
- `spark.sql.shuffle.partitions` (default 200) sets partitions after a shuffle — AQE coalesces small ones automatically.
- `repartition(n, col)` — full shuffle; use to increase parallelism or co-locate by key.
- `coalesce(n)` — merges partitions without a shuffle; use to reduce file count before writing.

## Caching
- `cache()` = `persist(MEMORY_AND_DISK)` for DataFrames.
- Lazy: materialised at the first action.
- Worth it for iterative algorithms or a DataFrame used by several outputs; not for single-use pipelines.

## Skew
- Detect: Spark UI task durations (max ≫ median); count rows per key.
- Fix: AQE skew join (`spark.sql.adaptive.skewJoin.enabled`), filter junk keys (NULL, -1), broadcast, or **salting**:
```python
salted = big.withColumn("salt", (F.rand() * 10).cast("int"))
```
and replicate the small side 10× with salt values 0–9 before joining on `(key, salt)`.

## Memory errors
- "OOM on executor": too-large partitions, skew, or a huge broadcast → more partitions, fix skew, lower broadcast threshold.
- "OOM on driver": `collect()`/`toPandas()` on big data → write results out instead.

> [!MISTAKE] `df.count()` "just to check" between steps triggers a full computation each time.

=== crisp
**Tuning checklist (in order of impact):**
1. **Read less**: columnar formats (Parquet), partition pruning (filter on partition columns), column pruning (select early), predicate pushdown.
2. **Shuffle less**: filter/aggregate before joins; **broadcast** small tables (`F.broadcast(dim)`); avoid unnecessary `distinct`/`orderBy`; one `select` instead of many `withColumn`s.
3. **Handle skew**: AQE skew join, salting hot keys, separate NULL/dominant keys.
4. **Right-size partitions**: ~100–200 MB; tune `spark.sql.shuffle.partitions`; enable **AQE**.
5. **Cache wisely**: `cache()/persist()` only DataFrames reused by several actions; `unpersist()` after; caching is lazy (materialised on first action).
6. **Avoid Python UDFs** → built-in functions or `pandas_udf` (Arrow-vectorised).
7. **Write well**: `repartition` by output partition columns or `coalesce` to avoid small files; sensible `partitionBy`.
8. **Resources**: executor memory/cores (e.g. 4–5 cores per executor), dynamic allocation; watch spill and GC in the UI.
9. **Never `collect()` big data**; use `explain()` and the Spark UI (stages, task time distribution, shuffle read/write, spill) to find the bottleneck.

=== memory
- **"Read less, shuffle less, skew less, cache only what you reuse."**
- **Diagnose before tuning:** Spark UI → slowest stage → why (shuffle? skew? spill?).

=== data
flashcards:
  - q: "When should you cache a DataFrame?"
    a: "When it is reused by multiple actions and expensive to recompute; unpersist when done."
  - q: "Name three causes of slow Spark jobs."
    a: "Large shuffles, data skew, spills from oversized partitions, Python UDFs, reading unnecessary data, small files."
  - q: "How do you force a broadcast join?"
    a: "big.join(F.broadcast(small), 'key')"
  - q: "What is salting?"
    a: "Adding a random suffix to hot join keys (and replicating the other side) to spread a skewed key across many tasks."
  - q: "Why are pandas UDFs faster than regular Python UDFs?"
    a: "They process batches via Apache Arrow (vectorised) instead of one row at a time."
quiz:
  - q: "A DataFrame is used once, by a single write. Should you cache it?"
    options: ["Yes, always cache", "No — caching only helps when reused", "Yes, cache then collect", "Only with coalesce"]
    answer: 1
  - q: "Which change usually gives the biggest speed-up when joining a 2 TB fact table with a 5 MB lookup?"
    options: ["convert to CSV", "broadcast the lookup table", "cache the fact table", "repartition the fact table to 10 partitions"]
    answer: 1
    explain: "Broadcasting removes the shuffle of the big table."
  - q: "Your job calls `toPandas()` on a 50 GB DataFrame and the driver crashes. Fix?"
    options: ["write the result to storage (or aggregate first) instead of collecting it", "add more executors", "cache it first", "increase shuffle partitions"]
    answer: 0
    explain: "collect/toPandas bring all data to the single driver; keep big data distributed."
recall:
  - q: "A Spark job is slow. Walk through how you'd diagnose and speed it up."
    keyPoints:
      - "Spark UI: longest stage, shuffle size, task skew"
      - "filter and select early for pushdown"
      - "broadcast small tables"
      - "cache only reused DataFrames"
      - "AQE and salting for skew"
      - "avoid Python UDFs and collect; right-size partitions and files"
exercises:
  - id: spark-performance-1
    lang: python
    kind: coding
    difficulty: 2
    title: Broadcast the dimension
    prompt: |
      Join orders with a small products-free dimension of customers using an explicit **broadcast** hint: `enriched = orders.join(F.broadcast(customers.select("customer_id", "segment")), "customer_id", "left")`. Then compute `seg_rev` = revenue per segment (rounded 2), and call `seg_rev.explain()` to see the BroadcastHashJoin in the plan.
    starter: |
      from pyspark.sql import SparkSession, functions as F

      spark = SparkSession.builder.getOrCreate()
      orders = spark.read.csv("/data/orders.csv", header=True, inferSchema=True)
      customers = spark.read.csv("/data/customers.csv", header=True, inferSchema=True)

    solution: |
      from pyspark.sql import SparkSession, functions as F

      spark = SparkSession.builder.getOrCreate()
      orders = spark.read.csv("/data/orders.csv", header=True, inferSchema=True)
      customers = spark.read.csv("/data/customers.csv", header=True, inferSchema=True)
      enriched = orders.join(F.broadcast(customers.select("customer_id", "segment")), "customer_id", "left")
      seg_rev = enriched.groupBy("segment").agg(F.round(F.sum("amount"), 2).alias("revenue"))
      seg_rev.show()
      seg_rev.explain()
    tests:
      - call: "sorted(r.segment for r in seg_rev.collect())"
        expect: "['Consumer', 'Corporate', 'SMB']"
      - call: "any('Broadcast' in step for step in seg_rev._plan)"
        expect: "True"
        label: broadcast used
interview:
  - q: "A Spark job that used to take 20 minutes now takes 3 hours. How do you troubleshoot it?"
    type: scenario
    level: 3
    keyPoints:
      - "check Spark UI for the slowest stage"
      - "look for skewed tasks"
      - "shuffle size and spill"
      - "input data growth or small files"
      - "join strategy change from broadcast to sort merge"
      - "fix with broadcast salting AQE partition tuning"
