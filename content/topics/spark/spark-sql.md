=== lesson
--- step concept: Write SQL against a DataFrame
Any DataFrame can be registered as a **temporary view** and queried with SQL:

```python
orders.createOrReplaceTempView("orders")

by_status = spark.sql("""
    SELECT status, COUNT(*) AS orders
    FROM orders
    GROUP BY status
    ORDER BY orders DESC
""")
```
`spark.sql(...)` returns a **DataFrame** — you can keep transforming it with DataFrame code.

[[quiz:spark-sql:q0]]

--- step practice: Spark SQL over a temp view
[[exercise:spark-sql-1]]

--- step concept: Same engine, same speed
SQL and DataFrame code are both turned into the same logical plan and optimised by **Catalyst**. Choose whichever is clearer: SQL for big joins and aggregations your team already knows, DataFrames for step-by-step logic, functions and loops over columns.

```python
df.groupBy("status").count()          # ≡ SELECT status, COUNT(*) … GROUP BY status
```
[[quiz:spark-sql:q1]]

--- step check: Temp views vs tables
[[quiz:spark-sql:q2]]

--- step interview: Explain it
[[recall:spark-sql:r0]]

=== detailed
## Temp views
| | Lifetime | Visible to |
|---|---|---|
| `createOrReplaceTempView("v")` | the SparkSession | that session |
| `createOrReplaceGlobalTempView("v")` → `global_temp.v` | the Spark application | all sessions in the app |
| catalog table (`saveAsTable`, `CREATE TABLE`) | permanent, in the metastore | anyone with access |

A temp view stores **no data** — it's a name for the DataFrame's plan.

## Mixing SQL and DataFrames
```python
from pyspark.sql import functions as F
spark.sql("SELECT * FROM orders WHERE status = 'delivered'") \
     .withColumn("month", F.date_format("order_date", "yyyy-MM")) \
     .groupBy("month").agg(F.sum("amount").alias("revenue"))
```
- `F.expr("amount * 1.18")` and `df.selectExpr("amount * 1.18 AS gross")` embed SQL expressions in DataFrame code.
- `spark.table("orders")` returns a view or table as a DataFrame.

## Catalyst optimizer
1. Parse SQL / DataFrame calls into an unresolved logical plan.
2. Resolve names and types using the catalog.
3. Optimise: predicate pushdown, column pruning, constant folding, join reordering.
4. Choose a physical plan (e.g. broadcast vs sort-merge join), generate code.
`df.explain()` shows the plans — identical for equivalent SQL and DataFrame code.

## Spark SQL extras
- Window functions, CTEs, `CASE`, `QUALIFY`-style patterns via subqueries.
- Reading files directly: ``SELECT * FROM parquet.`/data/orders/` ``.
- `CREATE TABLE … USING parquet PARTITIONED BY (dt)`.
- Hints: `SELECT /*+ BROADCAST(c) */ …`.

> [!TIP] Analysts moving to Spark can be productive on day one with SQL; then learn DataFrame code for things SQL makes awkward (dynamic column lists, reusable functions, unit tests).

=== crisp
```python
orders.createOrReplaceTempView("orders")
top = spark.sql("""
  SELECT channel, ROUND(SUM(amount), 2) AS revenue
  FROM orders WHERE status <> 'cancelled'
  GROUP BY channel ORDER BY revenue DESC
""")
top.show()
```
- `spark.sql()` returns a DataFrame — mix SQL and DataFrame steps freely.
- SQL and DataFrame code compile to the **same Catalyst plan** → same performance; choose for readability.
- **Temp views** live for the SparkSession; **global temp views** (`global_temp.x`) across sessions; **catalog tables** (`saveAsTable`, Hive metastore/Unity Catalog) persist.
- Spark SQL supports CTEs, window functions, `explode`, `LATERAL VIEW`, `MERGE` (with Delta/Iceberg).

=== memory
- **"SQL or DataFrame — Catalyst doesn't care."**

=== data
flashcards:
  - q: "How do you query a DataFrame with SQL?"
    a: "df.createOrReplaceTempView('name') then spark.sql('SELECT … FROM name')."
  - q: "Is Spark SQL slower than the DataFrame API?"
    a: "No — both are optimised by Catalyst into the same physical plan."
quiz:
  - q: "spark.sql(...) returns…"
    options: ["a Python list", "a DataFrame", "a pandas DataFrame", "nothing"]
    answer: 1
  - q: "Is a Spark SQL query faster than the equivalent DataFrame code?"
    options: ["yes, always", "no, SQL is always slower", "only on Mondays", "no — both compile to the same Catalyst-optimised plan"]
    answer: 3
    explain: "SQL and DataFrame APIs share the optimizer; performance is the same for equivalent logic."
  - q: "`createOrReplaceTempView('orders')` stores…"
    options: ["a permanent table in the metastore", "a CSV file", "no data — just a name for the DataFrame's plan in this session", "a copy of the data on disk"]
    answer: 2
    explain: "Temp views are session-scoped names; data is computed when a query runs."
recall:
  - q: "How do Spark SQL and the DataFrame API relate, and when would you use each?"
    keyPoints:
      - "createOrReplaceTempView then spark.sql"
      - "spark.sql returns a DataFrame"
      - "both use the Catalyst optimizer, same performance"
      - "temp vs global temp views vs catalog tables"
      - "SQL for familiar joins/aggregations, DataFrames for dynamic logic"
      - "explain() shows the plan"
exercises:
  - id: spark-sql-1
    lang: python
    kind: coding
    difficulty: 1
    title: Spark SQL over a temp view
    prompt: |
      Register orders as a temp view `orders` and use `spark.sql` to compute `by_status`: count of orders per `status` ordered by count desc (column names `status`, `n`). Store the result DataFrame in `by_status`.
    starter: |
      from pyspark.sql import SparkSession

      spark = SparkSession.builder.getOrCreate()
      orders = spark.read.csv("/data/orders.csv", header=True, inferSchema=True)

    solution: |
      from pyspark.sql import SparkSession

      spark = SparkSession.builder.getOrCreate()
      orders = spark.read.csv("/data/orders.csv", header=True, inferSchema=True)
      orders.createOrReplaceTempView("orders")
      by_status = spark.sql("SELECT status, COUNT(*) AS n FROM orders GROUP BY status ORDER BY n DESC")
      by_status.show()
    tests:
      - call: "by_status.columns"
        expect: "['status', 'n']"
      - call: "sum(r.n for r in by_status.collect())"
        expect: "900"
interview:
  - q: "When would you use Spark SQL instead of the DataFrame API?"
    type: concept
    level: 1
    keyPoints:
      - "same optimizer and performance"
      - "SQL for readability and analyst familiarity"
      - "DataFrame API for programmatic composition and reuse"
      - "can mix both"
