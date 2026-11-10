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
