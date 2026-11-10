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
