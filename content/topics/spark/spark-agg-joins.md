=== lesson
--- step concept: Aggregations
```python
by_channel = (orders.filter(F.col("status") != "cancelled")
    .groupBy("channel")
    .agg(F.count("*").alias("orders"),
         F.round(F.sum("amount"), 2).alias("revenue"),
         F.countDistinct("customer_id").alias("customers"))
    .orderBy(F.desc("revenue")))
```
`groupBy` is a **wide** transformation — rows with the same key must meet on one executor (shuffle).

[[quiz:spark-agg-joins:q0]]

--- step practice: Revenue per customer
[[exercise:spark-agg-joins-1]]

--- step concept: Joins
```python
enriched = orders.join(customers, on="customer_id", how="left")     # shared column name → one output column
by_city  = enriched.groupBy("city").agg(F.sum("amount").alias("revenue"))
missing  = customers.join(orders, "customer_id", "left_anti")       # customers without orders
```
Join types: `inner`, `left`, `right`, `full`, `left_semi`, `left_anti`, `cross`. Joining on an expression with columns of the same name creates **ambiguous** columns — prefer `on="col"` or rename first.

[[exercise:spark-agg-joins-2]]

--- step concept: Window functions
```python
from pyspark.sql import Window
w = Window.partitionBy("customer_id").orderBy(F.desc("order_date"), F.desc("order_id"))
latest = orders.withColumn("rn", F.row_number().over(w)).filter("rn = 1").drop("rn")
```

[[exercise:spark-agg-joins-3]]
[[recall:spark-agg-joins:r0]]

=== detailed
## groupBy / agg
- `df.groupBy(keys).agg(F.sum(...).alias(...), …)`; shortcuts `.count()`, `.sum("x")`, `.avg()`.
- Aggregate functions: `count, countDistinct (exact, expensive), approx_count_distinct, sum, avg, min, max, first, last, collect_list, collect_set, percentile_approx`.
- `F.count("col")` ignores nulls; `F.count("*")` counts rows.
- Execution: partial aggregation on each partition (map-side combine) → shuffle by key → final aggregation. Skewed keys create stragglers.

## Joins
- `a.join(b, on="key", how="left")` or `on=["k1","k2"]` (keys merged into one column) or `on=a.k == b.k` (both columns kept → drop one).
- Strategies (chosen by Catalyst, visible in `explain()`):
  - **Broadcast hash join** — small side (< `spark.sql.autoBroadcastJoinThreshold`, 10 MB default) sent to all executors; no shuffle of the big side. Force with `F.broadcast(small)`.
  - **Sort-merge join** — both sides shuffled and sorted by key; default for big–big joins.
  - Shuffle hash join; broadcast nested loop (non-equi joins — expensive).
- `left_semi` = filter by existence (no columns from right); `left_anti` = rows without a match.
- Null keys never match (like SQL).

## Window functions
`Window.partitionBy(...).orderBy(...)` + `row_number, rank, dense_rank, lag, lead, sum/avg over`, frames with `.rowsBetween(Window.unboundedPreceding, Window.currentRow)`. Partitioning by a skewed or absent key funnels data into few tasks.

## Deduplication
- Exact duplicates: `dropDuplicates()`; by key (arbitrary row): `dropDuplicates(["id"])`; **deterministic latest**: `row_number` over a window ordered by timestamp + tie-breaker.

## Common mistakes
> [!MISTAKE] Ambiguous column after `a.join(b, a.id == b.id)` → use `on="id"` or alias/drop.

> [!MISTAKE] `dropDuplicates(["id"])` when you need the *latest* row — it keeps an arbitrary one.

> [!MISTAKE] Fan-out from joining to a non-unique key (same as SQL) — check counts.

=== crisp
- `groupBy(k).agg(F.sum(x).alias(...), F.count("*"), F.countDistinct(...))` → shuffle by key (map-side partial agg first).
- `a.join(b, on="key", how="left")` — `on=` string/list keeps one key column; expression joins keep both (ambiguity).
- Types: inner, left, right, full, **left_semi** (exists), **left_anti** (not exists), cross.
- Strategies: **broadcast hash** (small side < 10 MB default; `F.broadcast`) vs **sort-merge** (big–big, shuffles both).
- Windows: `Window.partitionBy().orderBy()` + `row_number/rank/lag/sum over`.
- Latest per key: `row_number() over (partition by key order by ts desc, id desc) == 1` (not `dropDuplicates`).
- Watch fan-out and skew; check `explain()`.

=== memory
- **"Semi = exists, anti = missing."**
- **"Broadcast the small, shuffle the big only if you must."**
- `dropDuplicates` picks *any*; `row_number` picks *the one you mean*.

=== data
flashcards:
  - q: "How do you find customers with no orders in PySpark?"
    a: "customers.join(orders, 'customer_id', 'left_anti')"
  - q: "What is a broadcast join?"
    a: "The small DataFrame is copied to every executor so the large one is joined without being shuffled."
  - q: "Default broadcast threshold?"
    a: "spark.sql.autoBroadcastJoinThreshold = 10 MB (AQE can also convert joins at runtime)."
  - q: "How do you keep the latest record per key deterministically?"
    a: "row_number().over(Window.partitionBy(key).orderBy(desc(ts), desc(id))) == 1"
  - q: "Why might `a.join(b, a.id == b.id)` cause errors later?"
    a: "Both id columns are kept, so referencing 'id' becomes ambiguous — join on='id' or drop one."
quiz:
  - q: "Which join returns only left rows that have a match, without right columns?"
    options: ["inner", "left", "left_semi", "left_anti"]
    answer: 2
recall:
  - q: "Explain how Spark executes aggregations and joins, including broadcast joins."
    keyPoints:
      - "groupBy causes shuffle by key"
      - "partial aggregation before shuffle"
      - "sort merge join shuffles both sides"
      - "broadcast join copies small table to executors"
      - "skewed keys create stragglers"
      - "semi and anti joins"
exercises:
  - id: spark-agg-joins-1
    lang: python
    kind: coding
    difficulty: 2
    title: Revenue per customer
    prompt: |
      Compute `cust_rev`: for non-cancelled orders, per `customer_id`: `orders` (count), `revenue` (sum, rounded 2). Sort by revenue descending. Then `top3 = [r.customer_id for r in cust_rev.take(3)]`.
    starter: |
      from pyspark.sql import SparkSession, functions as F

      spark = SparkSession.builder.getOrCreate()
      orders = spark.read.csv("/data/orders.csv", header=True, inferSchema=True)

    solution: |
      from pyspark.sql import SparkSession, functions as F

      spark = SparkSession.builder.getOrCreate()
      orders = spark.read.csv("/data/orders.csv", header=True, inferSchema=True)
      cust_rev = (orders.filter(F.col("status") != "cancelled")
          .groupBy("customer_id")
          .agg(F.count("*").alias("orders"), F.round(F.sum("amount"), 2).alias("revenue"))
          .orderBy(F.desc("revenue")))
      top3 = [r.customer_id for r in cust_rev.take(3)]
      cust_rev.show(5)
    tests:
      - call: "cust_rev.columns"
        expect: "['customer_id', 'orders', 'revenue']"
      - call: "len(top3)"
        expect: "3"
    check: |
      import csv, collections
      tot = collections.defaultdict(float)
      for r in csv.DictReader(open('/data/orders.csv')):
          if r['status'] != 'cancelled':
              tot[int(r['customer_id'])] += float(r['amount'])
      exp = [k for k, _ in sorted(tot.items(), key=lambda kv: -kv[1])[:3]]
      assert top3 == exp, f'top3 should be {exp}, got {top3}'
  - id: spark-agg-joins-2
    lang: python
    kind: coding
    difficulty: 2
    title: Revenue by city with a join
    prompt: |
      Join non-cancelled orders with `/data/customers.csv` (left join on `customer_id`) and compute `city_rev` = revenue per `city` (rounded 2), sorted descending. Also compute `no_orders` = number of customers who never ordered, using a **left_anti** join.
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
      valid = orders.filter(F.col("status") != "cancelled")
      city_rev = (valid.join(customers.select("customer_id", "city"), on="customer_id", how="left")
          .groupBy("city").agg(F.round(F.sum("amount"), 2).alias("revenue"))
          .orderBy(F.desc("revenue")))
      no_orders = customers.join(orders, on="customer_id", how="left_anti").count()
      city_rev.show()
      print(no_orders)
    tests:
      - call: "no_orders"
        expect: "10"
      - call: "city_rev.count()"
        expect: "10"
      - call: "city_rev.columns"
        expect: "['city', 'revenue']"
  - id: spark-agg-joins-3
    lang: python
    kind: coding
    difficulty: 3
    title: Latest order per customer
    prompt: |
      Using a window, build `latest` with each customer's most recent order (by `order_date` desc, then `order_id` desc): columns `customer_id`, `order_id`, `order_date`. Store `n_latest = latest.count()`.
    starter: |
      from pyspark.sql import SparkSession, functions as F, Window

      spark = SparkSession.builder.getOrCreate()
      orders = spark.read.csv("/data/orders.csv", header=True, inferSchema=True)

    solution: |
      from pyspark.sql import SparkSession, functions as F, Window

      spark = SparkSession.builder.getOrCreate()
      orders = spark.read.csv("/data/orders.csv", header=True, inferSchema=True)
      w = Window.partitionBy("customer_id").orderBy(F.desc("order_date"), F.desc("order_id"))
      latest = (orders.withColumn("rn", F.row_number().over(w))
          .filter(F.col("rn") == 1)
          .select("customer_id", "order_id", "order_date"))
      n_latest = latest.count()
      latest.orderBy("customer_id").show(5)
    tests:
      - call: "n_latest"
        expect: "110"
      - call: "latest.columns"
        expect: "['customer_id', 'order_id', 'order_date']"
    check: |
      import csv
      best = {}
      for r in csv.DictReader(open('/data/orders.csv')):
          k = int(r['customer_id']); key = (r['order_date'], int(r['order_id']))
          if k not in best or key > best[k]:
              best[k] = key
      got = {r.customer_id: r.order_id for r in latest.collect()}
      assert all(got[k] == v[1] for k, v in best.items()), 'Some customers have the wrong latest order — check the window ordering and tie-breaker'
interview:
  - q: "How does Spark decide between a broadcast join and a sort-merge join? When would you force a broadcast?"
    type: concept
    level: 3
    keyPoints:
      - "size threshold autoBroadcastJoinThreshold"
      - "broadcast avoids shuffling the large table"
      - "sort merge for two large tables shuffles both"
      - "force with broadcast hint when small table stats are wrong"
      - "AQE can switch at runtime"
      - "memory limits of broadcasting"
