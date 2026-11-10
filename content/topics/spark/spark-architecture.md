=== lesson
--- step concept: One driver, many executors
A Spark application has:
- a **driver** — your program (`SparkSession`), which builds the plan, splits it into **jobs → stages → tasks**, and schedules tasks;
- **executors** — JVM processes on worker nodes that run tasks in parallel and cache data;
- a **cluster manager** — YARN, Kubernetes, Standalone (Dataproc uses YARN; Databricks its own) — that provides executors.

Data is split into **partitions**; **one task processes one partition**. 200 partitions on 50 cores → 4 waves of tasks.

[[quiz:spark-architecture:q0]]

--- step concept: Lazy evaluation
**Transformations** (`select`, `filter`, `withColumn`, `groupBy`, `join`) only build a **logical plan**. Nothing executes until an **action** (`count`, `show`, `collect`, `write`, `toPandas`) is called. Then the **Catalyst optimizer** rewrites the plan (pushes filters down to the source, prunes columns, reorders joins) and **Tungsten** generates efficient code.

```python
df = spark.read.parquet("gs://lake/orders")          # nothing read yet
big = df.filter(F.col("amount") > 300).select("order_id", "amount")
big.explain()                                        # shows the plan
big.count()                                          # ACTION → job runs now
```

--- step practice: See lazy evaluation
[[exercise:spark-architecture-1]]

--- step check: Jobs, stages, tasks
[[exercise:spark-architecture-2]]
[[recall:spark-architecture:r0]]

=== detailed
## Components
| Component | Responsibility |
|---|---|
| Driver | runs main program, SparkSession, builds DAG, schedules tasks, collects results |
| Executors | run tasks, hold cached partitions, report status |
| Cluster manager | allocates resources (YARN, Kubernetes, Standalone) |
| Tasks | smallest unit of work: one partition through one stage |

## Jobs, stages, tasks
- Each **action** triggers a **job**.
- A job is split into **stages** at **shuffle boundaries** (wide transformations).
- Each stage runs one **task per partition**.
The Spark UI (Jobs/Stages tabs) shows durations, shuffle read/write, spill and skew per task.

## Transformations vs actions
| Transformations (lazy) | Actions (trigger execution) |
|---|---|
| select, filter/where, withColumn, drop, join, groupBy().agg, orderBy, distinct, union, repartition | show, count, collect, take/first, write, toPandas, foreach |

Benefits of laziness: the optimizer sees the whole pipeline (predicate & projection pushdown, combining operations), avoids materialising intermediate results.

## Catalyst & Tungsten
Catalyst: analysis → logical optimisation (constant folding, predicate pushdown, column pruning, join reordering) → physical planning (choose broadcast vs sort-merge join) → code generation. Tungsten: off-heap memory management, cache-aware data structures, whole-stage codegen. DataFrame/SQL code benefits; Python UDFs and RDD code bypass much of it.

## RDD vs DataFrame
- **RDD** — low-level distributed collection of objects; no schema; no Catalyst optimisation; Python RDD code ships data to Python workers (slow).
- **DataFrame / Dataset** — distributed table with a schema; optimised by Catalyst; the default API. Use RDDs only for special low-level needs.

## Memory & failure
Executors split memory between execution (shuffles, joins, sorts) and storage (cache). Too little → **spill** to disk or OOM. Lost partitions are recomputed from **lineage** (the recorded transformations).

## collect() danger
`collect()` brings all data to the driver — OOM for large data. Use `show`, `take(n)`, `write`, or aggregate first.

=== crisp
- **Driver** (plans & schedules) + **executors** (run tasks, cache) + **cluster manager** (YARN/K8s).
- **Partition** = chunk of data; **task** = one partition through one stage.
- **Action → job → stages (split at shuffles) → tasks (one per partition).**
- **Transformations are lazy** (build plan); **actions** execute (show, count, collect, write).
- **Catalyst** optimises the plan (pushdown, pruning, join strategy); **Tungsten** executes efficiently. `df.explain()` shows it.
- DataFrames > RDDs (schema + optimisation). Python UDFs are slow — prefer built-in functions.
- Never `collect()` big data to the driver.
- Fault tolerance via **lineage** recomputation.

=== memory
- **"The driver is the manager; executors are the team; partitions are the work items."**
- **"Nothing happens until you ask for an answer."** (lazy)
- Stage boundary = **shuffle**.

=== data
flashcards:
  - q: "What does the Spark driver do?"
    a: "Runs the main program, builds the execution plan (DAG), schedules tasks on executors and collects results."
  - q: "What triggers execution in Spark?"
    a: "An action such as count, show, collect or write."
  - q: "How are stages determined?"
    a: "A job is split into stages at shuffle boundaries (wide transformations)."
  - q: "One task processes…"
    a: "One partition for one stage."
  - q: "Why prefer DataFrames over RDDs?"
    a: "Schema + Catalyst optimisations + Tungsten execution; RDD code is opaque to the optimizer."
  - q: "Why is collect() dangerous?"
    a: "It pulls all rows to the driver's memory, risking out-of-memory errors."
quiz:
  - q: "Which line causes Spark to actually read data?"
    options: ["df = spark.read.parquet(path)", "df2 = df.filter(col('x') > 1)", "df3 = df2.select('x')", "df3.count()"]
    answer: 3
recall:
  - q: "Explain Spark's architecture and lazy evaluation."
    keyPoints:
      - "driver plans and schedules"
      - "executors run tasks on partitions"
      - "cluster manager allocates resources"
      - "transformations build a plan lazily"
      - "actions trigger jobs"
      - "jobs split into stages at shuffles"
      - "Catalyst optimizes the plan"
exercises:
  - id: spark-architecture-1
    lang: python
    kind: predict
    difficulty: 1
    title: Transformations vs actions
    prompt: |
      Using the PySpark emulator, read `/data/orders.csv`, build a filtered DataFrame `big` of orders with amount > 300 selecting `order_id` and `amount`, print its plan with `big.explain()`, then trigger an action and store the result in `n_big` (the count).
    starter: |
      from pyspark.sql import SparkSession, functions as F

      spark = SparkSession.builder.appName("lazy").getOrCreate()
      orders = spark.read.csv("/data/orders.csv", header=True, inferSchema=True)

    solution: |
      from pyspark.sql import SparkSession, functions as F

      spark = SparkSession.builder.appName("lazy").getOrCreate()
      orders = spark.read.csv("/data/orders.csv", header=True, inferSchema=True)
      big = orders.filter(F.col("amount") > 300).select("order_id", "amount")
      big.explain()
      n_big = big.count()
      print(n_big)
    tests:
      - call: "n_big == sum(1 for r in __import__('csv').DictReader(open('/data/orders.csv')) if float(r['amount']) > 300)"
        expect: "True"
      - call: "big.columns"
        expect: "['order_id', 'amount']"
    hints:
      - "filter(F.col('amount') > 300).select('order_id', 'amount')"
      - "count() is the action."
  - id: spark-architecture-2
    lang: mcq
    kind: concept
    difficulty: 2
    title: Count the stages
    prompt: |
      `df.filter(...).withColumn(...).groupBy("country").agg(F.sum("amount")).orderBy("country").write.parquet(path)`
      How many shuffle boundaries does this (typically) create?
    choices: ["0", "1 (groupBy)", "2 (groupBy and orderBy)", "4 (every operation)"]
    answer: 2
    explain: |
      filter and withColumn are narrow (same stage). groupBy needs a shuffle by key; a global orderBy needs another (range partitioning). Write is an action that ends the job.
interview:
  - q: "Explain the difference between transformations and actions in Spark, and why lazy evaluation is useful."
    type: concept
    level: 2
    keyPoints:
      - "transformations return new DataFrames lazily"
      - "actions trigger execution and return results or write"
      - "optimizer sees the whole plan"
      - "predicate pushdown and column pruning"
      - "avoids unnecessary computation"
  - q: "What are the driver and executors in Spark?"
    type: concept
    level: 1
    keyPoints:
      - "driver runs the main program and schedules"
      - "executors run tasks on partitions"
      - "cluster manager allocates executors"
      - "results collected to driver can cause OOM"
