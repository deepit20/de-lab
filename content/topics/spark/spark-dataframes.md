=== lesson
--- step concept: The DataFrame API
```python
from pyspark.sql import SparkSession, functions as F

spark = SparkSession.builder.appName("orders").getOrCreate()
orders = spark.read.csv("/data/orders.csv", header=True, inferSchema=True)

orders.printSchema()
clean = (orders
    .filter(F.col("status") != "cancelled")                       # WHERE
    .withColumn("amount_inr", F.round(F.col("amount") * 83, 2))   # new column
    .withColumn("is_large", F.col("amount") >= 300)
    .select("order_id", "customer_id", "order_date", "amount_inr", "is_large"))
clean.show(5)
```
Think in **columns and expressions**, not loops. `F.col("x")` refers to a column; operators build expressions; nothing runs until `.show()`.

*(The practice engine is a single-process PySpark emulator: same API for the common functions, so your code transfers to real Spark.)*

[[quiz:spark-dataframes:q0]]

--- step example: Conditions and nulls
```python
F.when(F.col("amount") >= 300, "large").when(F.col("amount") >= 100, "medium").otherwise("small")
(F.col("a") > 1) & (F.col("b") == "x")      # use & | ~ with parentheses, not and/or
F.col("email").isNull()
F.coalesce(F.col("email"), F.lit("unknown"))
df.na.fill({"city": "unknown"}); df.dropna(subset=["customer_id"])
```

--- step practice: Clean and enrich
[[exercise:spark-dataframes-1]]

--- step practice: Derive categories
[[exercise:spark-dataframes-2]]

--- step check: Debug a DataFrame error
[[exercise:spark-dataframes-3]]
[[recall:spark-dataframes:r0]]

=== detailed
## Creating DataFrames
- `spark.read.csv(path, header=True, inferSchema=True)` / `.json` / `.parquet` / `.format("bigquery").option("table", …)`.
- Explicit schema (faster, safer than inference): `StructType([StructField("order_id", IntegerType()), …])` or DDL string `"order_id INT, amount DOUBLE"`.
- `spark.createDataFrame([(1, "a")], ["id", "label"])`.

## Selecting & expressions
- `select("a", "b")`, `select(F.col("a").alias("x"))`, `selectExpr("amount * 2 as dbl")`.
- `withColumn(name, expr)` adds/replaces; `withColumnRenamed`, `drop`.
- `filter`/`where` with Column expressions or SQL strings.
- Functions in `pyspark.sql.functions`: `col, lit, when/otherwise, coalesce, round, upper/lower/trim, concat_ws, regexp_replace, split, to_date, year/month, datediff, current_date`.

## Booleans
Python's `and/or/not` don't work on Columns (`ValueError: Cannot convert column into bool`) — use `&`, `|`, `~` and parenthesise each comparison.

## Nulls
Same three-valued logic as SQL: `col == None` doesn't work — use `isNull()/isNotNull()`; `na.fill`, `na.drop`, `coalesce`.

## Avoid Python UDFs when possible
`@F.udf` runs row-by-row in Python workers (serialisation overhead, no Catalyst optimisation). Built-in functions or `pandas_udf` (vectorised with Arrow) are much faster.

## Actions to inspect
`show(n, truncate=False)`, `printSchema()`, `count()`, `take(n)`, `describe()`, `explain()`. Avoid `collect()` on big data.

## Common mistakes
> [!MISTAKE] `F.col("a") > 1 and F.col("b") < 5` → use `&` with parentheses.

> [!MISTAKE] Chaining many `withColumn` in a loop (hundreds) bloats the plan — use one `select` with all expressions.

> [!MISTAKE] Relying on `inferSchema` in production — types change between files; define schemas.

=== crisp
- `spark.read.csv(path, header=True, inferSchema=True)` (prod: explicit schema) · `.parquet` · `.json`.
- `select`, `filter/where`, `withColumn`, `withColumnRenamed`, `drop`, `distinct`, `limit`.
- `F.col`, `F.lit`, `F.when(...).otherwise(...)`, `F.coalesce`, `F.round`, `F.upper/trim`, `F.to_date`, `F.year`.
- Booleans: `(cond1) & (cond2)`, `|`, `~` — never `and/or`.
- Nulls: `isNull()`, `na.fill`, `dropna`.
- Prefer built-in functions over Python UDFs (or use `pandas_udf`).
- Inspect: `printSchema`, `show`, `explain`; avoid `collect`.

=== memory
- **"Columns, not loops."**
- **"& and | with brackets"** — same rule as pandas.
- **`when … otherwise` = CASE WHEN … ELSE.**

=== data
flashcards:
  - q: "How do you add a computed column in PySpark?"
    a: "df.withColumn('new', F.col('a') * 2)"
  - q: "How do you combine filter conditions?"
    a: "df.filter((F.col('a') > 1) & (F.col('b') == 'x')) — & / | / ~ with parentheses."
  - q: "PySpark equivalent of CASE WHEN?"
    a: "F.when(cond, value).when(...).otherwise(default)"
  - q: "Why avoid Python UDFs?"
    a: "They run row by row in Python, bypass Catalyst and add serialisation overhead; built-ins are much faster."
  - q: "How do you test a column for NULL?"
    a: "F.col('x').isNull()"
quiz:
  - q: "`df.filter(F.col('a') > 1 and F.col('b') < 2)` raises…"
    options: ["nothing, it works", "ValueError: Cannot convert column into bool", "AnalysisException", "TypeError: missing column"]
    answer: 1
recall:
  - q: "How do you clean and transform data with the PySpark DataFrame API?"
    keyPoints:
      - "read with schema"
      - "filter rows with column expressions"
      - "withColumn and select for new columns"
      - "when otherwise for conditions"
      - "handle nulls with isNull fillna dropna"
      - "prefer built in functions over UDFs"
exercises:
  - id: spark-dataframes-1
    lang: python
    kind: coding
    difficulty: 2
    title: Clean and enrich orders
    prompt: |
      Read `/data/orders.csv`. Build `clean` with non-cancelled orders and columns: `order_id`, `customer_id`, `channel` (upper-case), `amount`, `amount_with_tax` (amount × 1.18 rounded to 2). Show 5 rows.
    starter: |
      from pyspark.sql import SparkSession, functions as F

      spark = SparkSession.builder.getOrCreate()
      orders = spark.read.csv("/data/orders.csv", header=True, inferSchema=True)

    solution: |
      from pyspark.sql import SparkSession, functions as F

      spark = SparkSession.builder.getOrCreate()
      orders = spark.read.csv("/data/orders.csv", header=True, inferSchema=True)
      clean = (orders
          .filter(F.col("status") != "cancelled")
          .withColumn("channel", F.upper(F.col("channel")))
          .withColumn("amount_with_tax", F.round(F.col("amount") * 1.18, 2))
          .select("order_id", "customer_id", "channel", "amount", "amount_with_tax"))
      clean.show(5)
    tests:
      - call: "clean.columns"
        expect: "['order_id', 'customer_id', 'channel', 'amount', 'amount_with_tax']"
      - call: "sorted(set(r.channel for r in clean.collect()))"
        expect: "['APP', 'STORE', 'WEB']"
      - call: "clean.count() == orders.filter(F.col('status') != 'cancelled').count()"
        expect: "True"
      - call: "all(abs(r.amount_with_tax - round(r.amount * 1.18, 2)) < 0.011 for r in clean.collect())"
        expect: "True"
        hidden: true
        label: tax rounding
  - id: spark-dataframes-2
    lang: python
    kind: coding
    difficulty: 2
    title: Size buckets with when/otherwise
    prompt: |
      From the orders DataFrame create `sized` with an extra column `size`: `"large"` (amount ≥ 300), `"medium"` (≥ 100), otherwise `"small"`. Then `counts` = number of orders per size as a Python dict `{size: count}` (use `groupBy().count()` and `collect()` — fine because the result is tiny).
    starter: |
      from pyspark.sql import SparkSession, functions as F

      spark = SparkSession.builder.getOrCreate()
      orders = spark.read.csv("/data/orders.csv", header=True, inferSchema=True)

    solution: |
      from pyspark.sql import SparkSession, functions as F

      spark = SparkSession.builder.getOrCreate()
      orders = spark.read.csv("/data/orders.csv", header=True, inferSchema=True)
      sized = orders.withColumn("size", F.when(F.col("amount") >= 300, "large").when(F.col("amount") >= 100, "medium").otherwise("small"))
      counts = {r["size"]: r["count"] for r in sized.groupBy("size").count().collect()}
      print(counts)
    tests:
      - call: "sorted(counts)"
        expect: "['large', 'medium', 'small']"
      - call: "sum(counts.values())"
        expect: "900"
  - id: spark-dataframes-3
    lang: python
    kind: debug
    difficulty: 2
    title: "Debug: cannot convert column into bool"
    prompt: |
      This code should keep **web** orders with amount between 100 and 300 (inclusive), but it crashes. Fix it so `mid_web` is correct.
    starter: |
      from pyspark.sql import SparkSession, functions as F

      spark = SparkSession.builder.getOrCreate()
      orders = spark.read.csv("/data/orders.csv", header=True, inferSchema=True)
      mid_web = orders.filter(F.col("channel") == "web" and F.col("amount") >= 100 and F.col("amount") <= 300)
      print(mid_web.count())
    solution: |
      from pyspark.sql import SparkSession, functions as F

      spark = SparkSession.builder.getOrCreate()
      orders = spark.read.csv("/data/orders.csv", header=True, inferSchema=True)
      mid_web = orders.filter((F.col("channel") == "web") & (F.col("amount") >= 100) & (F.col("amount") <= 300))
      print(mid_web.count())
    tests:
      - call: "mid_web.count() == sum(1 for r in __import__('csv').DictReader(open('/data/orders.csv')) if r['channel'] == 'web' and 100 <= float(r['amount']) <= 300)"
        expect: "True"
    hints:
      - "Python's `and` tries to turn a Column into True/False."
      - "Use & with parentheses around each comparison (or .between(100, 300))."
interview:
  - q: "How do you add a conditional column and filter with multiple conditions in PySpark?"
    type: coding
    level: 1
    keyPoints:
      - "withColumn with when otherwise"
      - "filter with & and | and parentheses"
      - "col and lit functions"
      - "null handling with isNull"
