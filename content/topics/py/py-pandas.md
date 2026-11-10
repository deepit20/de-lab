=== lesson
--- step concept: DataFrames — tables in Python
pandas gives you a **DataFrame**: a table of named, typed columns (each a `Series`) with an index. Operations are **vectorised** — they apply to whole columns at once (in optimised C), instead of Python loops.
```python
import pandas as pd
orders = pd.read_csv("/data/orders.csv", parse_dates=["order_date"])
orders.shape, orders.dtypes
orders.head()
orders[orders["status"] != "cancelled"]["amount"].sum()
```
> [!WHY] pandas is the standard tool for small-to-medium transformations, validation scripts, exploratory checks and API ingestion. It maps closely to SQL — and to PySpark, which deliberately copied much of its API.

*(The first run downloads pandas into the browser — about 10–20 seconds, cached afterwards.)*

[[quiz:py-pandas:q0]]

--- step example: SQL ↔ pandas
| SQL | pandas |
|---|---|
| `WHERE status = 'x'` | `df[df.status == 'x']` / `df.query("status == 'x'")` |
| `SELECT a, b` | `df[["a", "b"]]` |
| `GROUP BY c` + aggs | `df.groupby("c").agg(total=("amount", "sum"))` |
| `JOIN` | `a.merge(b, on="key", how="left")` |
| `ORDER BY` | `df.sort_values("amount", ascending=False)` |
| `CASE WHEN` | `np.where(cond, a, b)` / `.map()` |
| `ROW_NUMBER` | `df.groupby(k).cumcount() + 1` |

--- step practice: Aggregate
[[exercise:py-pandas-1]]

--- step practice: Join and enrich
[[exercise:py-pandas-2]]

--- step scenario: Clean and deduplicate
[[exercise:py-pandas-3]]
[[recall:py-pandas:r0]]

=== detailed
## Core objects
- `Series` — one typed column with an index. `DataFrame` — dict of Series sharing an index.
- `dtypes`: `int64`, `float64`, `object` (strings/mixed), `bool`, `datetime64[ns]`, `category`; nullable `Int64`, `string`, `boolean`.
- Missing values: `NaN`/`NaT`/`None`; test with `isna()`, fill with `fillna()`, drop with `dropna()`.

## Reading & writing
`read_csv(path, dtype={...}, parse_dates=[...], usecols=[...], chunksize=100_000)`, `read_json(lines=True)`, `read_parquet`; `to_csv(index=False)`, `to_parquet`. Specify `dtype` for ids (leading zeros!) and `usecols` to save memory.

## Selecting
- `df["col"]`, `df[["a","b"]]`, boolean masks `df[(df.a > 1) & (df.b == "x")]` (use `&`, `|`, `~` with parentheses).
- `.loc[row_labels, cols]` (label-based), `.iloc[i, j]` (position-based).
- Avoid chained assignment `df[mask]["x"] = 1` → `SettingWithCopyWarning`; use `df.loc[mask, "x"] = 1`.

## Transforming
- New columns: `df["net"] = df.amount * 0.9`, `df.assign(net=lambda d: d.amount * 0.9)`.
- Strings: `.str.strip().str.lower()`; dates: `.dt.to_period("M")`, `.dt.date`.
- Group: `groupby(keys).agg(name=(col, func))`, `.transform("sum")` (keeps row count — like a window function), `.cumcount()`.
- Join: `merge(how="left", on=..., validate="m:1", indicator=True)` — `validate` catches unexpected duplicates (fan-out!), `indicator` shows unmatched rows.
- Reshape: `pivot_table`, `melt`, `explode` (lists → rows), `json_normalize` (nested JSON → columns).
- Dedupe: `sort_values(...).drop_duplicates(subset=[key], keep="last")`.

## Performance
- Vectorise; avoid `iterrows()` (very slow) and `apply(axis=1)` when a column operation exists.
- Use categories for repeated strings, appropriate dtypes, `usecols`.
- pandas is **single-machine, in-memory** (rule of thumb: data should fit in RAM with room 5–10×). Beyond that: chunking, Polars/DuckDB, Spark, or the warehouse.

## Common mistakes
> [!MISTAKE] `df[df.a > 1 and df.b < 5]` → use `&` and parentheses.

> [!MISTAKE] Merge fan-out going unnoticed → use `validate=`.

> [!MISTAKE] IDs read as numbers lose leading zeros → `dtype={"id": "string"}`.

> [!MISTAKE] Forgetting `index=False` when writing CSVs.

=== crisp
- DataFrame = table of typed Series. Vectorised column operations, not loops.
- `read_csv(dtype=, parse_dates=, usecols=)`; `to_csv(index=False)`; `to_parquet`.
- Filter: `df[(cond1) & (cond2)]`; set values: `df.loc[mask, "col"] = v`.
- Group: `df.groupby("k").agg(total=("amount","sum"), n=("id","count"))`; `transform` = window-like.
- Join: `a.merge(b, on="k", how="left", validate="m:1", indicator=True)`.
- Dedupe latest: `sort_values("updated_at").drop_duplicates("id", keep="last")`.
- Avoid `iterrows`; use `.str`, `.dt`, `np.where`.
- In-memory, single machine → big data needs Spark/warehouse/DuckDB.

=== memory
- **"& and |, with parentheses, always."**
- **"merge + validate = no silent fan-out."**
- pandas ↔ SQL: `groupby.agg` = GROUP BY, `merge` = JOIN, `transform` = window.

=== data
flashcards:
  - q: "pandas equivalent of SQL GROUP BY channel with SUM(amount)?"
    a: "df.groupby('channel').agg(revenue=('amount', 'sum'))"
  - q: "How do you combine two boolean conditions in a pandas filter?"
    a: "df[(df.a > 1) & (df.b == 'x')] — & / | with parentheses."
  - q: "What does merge(validate='m:1') do?"
    a: "Raises an error if the right side has duplicate keys (prevents silent fan-out)."
  - q: "groupby().transform('sum') vs agg('sum')?"
    a: "transform returns a value per original row (like a window function); agg returns one row per group."
  - q: "Why avoid iterrows()?"
    a: "It loops in Python row by row — orders of magnitude slower than vectorised operations."
quiz:
  - q: "Which keeps the latest record per customer_id?"
    options:
      - "df.drop_duplicates('customer_id')"
      - "df.sort_values('updated_at').drop_duplicates('customer_id', keep='last')"
      - "df.groupby('customer_id').first()"
      - "df.unique()"
    answer: 1
recall:
  - q: "When is pandas the right tool, and when should you move to Spark or the warehouse?"
    keyPoints:
      - "single machine in-memory processing"
      - "great for small to medium data and quick transformations"
      - "vectorised operations"
      - "data larger than memory needs chunking or distributed tools"
      - "warehouse SQL for large tables already loaded"
exercises:
  - id: py-pandas-1
    lang: python
    kind: coding
    difficulty: 2
    title: Monthly revenue with pandas
    prompt: |
      Write `monthly_revenue(path)` that reads the orders CSV and returns a DataFrame with columns `month` (string `YYYY-MM`), `orders`, `revenue` (rounded 2) for **delivered** orders, sorted by month, with a default RangeIndex.
    starter: |
      import pandas as pd

      def monthly_revenue(path):
          df = pd.read_csv(path, parse_dates=["order_date"])
          return df

      print(monthly_revenue("/data/orders.csv").head())
    solution: |
      import pandas as pd

      def monthly_revenue(path):
          df = pd.read_csv(path, parse_dates=["order_date"])
          d = df[df["status"] == "delivered"].copy()
          d["month"] = d["order_date"].dt.strftime("%Y-%m")
          out = d.groupby("month").agg(orders=("order_id", "count"), revenue=("amount", "sum")).reset_index()
          out["revenue"] = out["revenue"].round(2)
          return out.sort_values("month").reset_index(drop=True)

      print(monthly_revenue("/data/orders.csv").head())
    tests:
      - call: "list(monthly_revenue('/data/orders.csv').columns)"
        expect: "['month', 'orders', 'revenue']"
      - call: "monthly_revenue('/data/orders.csv')['month'].is_monotonic_increasing"
        expect: "True"
      - call: "int(monthly_revenue('/data/orders.csv')['orders'].sum()) == int((__import__('pandas').read_csv('/data/orders.csv').status == 'delivered').sum())"
        expect: "True"
        label: all delivered orders counted
    hints:
      - "Filter, then add a month column with .dt.strftime('%Y-%m')."
      - "groupby('month').agg(orders=('order_id','count'), revenue=('amount','sum'))"
  - id: py-pandas-2
    lang: python
    kind: coding
    difficulty: 2
    title: Revenue by customer city
    prompt: |
      Write `city_revenue(orders_path, customers_path)` returning a DataFrame with `city` and `revenue` (rounded 2, non-cancelled orders), sorted by revenue descending. Use `merge` with `validate="m:1"` so duplicate customers would raise an error.
    starter: |
      import pandas as pd

      def city_revenue(orders_path, customers_path):
          orders = pd.read_csv(orders_path)
          customers = pd.read_csv(customers_path)

      print(city_revenue("/data/orders.csv", "/data/customers.csv"))
    solution: |
      import pandas as pd

      def city_revenue(orders_path, customers_path):
          orders = pd.read_csv(orders_path)
          customers = pd.read_csv(customers_path)
          o = orders[orders["status"] != "cancelled"]
          m = o.merge(customers[["customer_id", "city"]], on="customer_id", how="left", validate="m:1")
          out = m.groupby("city", as_index=False)["amount"].sum().rename(columns={"amount": "revenue"})
          out["revenue"] = out["revenue"].round(2)
          return out.sort_values("revenue", ascending=False).reset_index(drop=True)

      print(city_revenue("/data/orders.csv", "/data/customers.csv"))
    tests:
      - call: "list(city_revenue('/data/orders.csv', '/data/customers.csv').columns)"
        expect: "['city', 'revenue']"
      - call: "city_revenue('/data/orders.csv', '/data/customers.csv')['revenue'].is_monotonic_decreasing"
        expect: "True"
      - call: "len(city_revenue('/data/orders.csv', '/data/customers.csv')) == 10"
        expect: "True"
        label: ten cities
  - id: py-pandas-3
    lang: python
    kind: scenario
    difficulty: 3
    title: Clean & deduplicate a customer extract
    prompt: |
      `/data/messy_customers.csv` has duplicate versions per customer, messy names/emails and a bad row. Write `clean_customers(path)` returning a DataFrame with one row per customer (latest `updated_at`), columns `customer_id` (int), `name` (stripped, title case), `email` (stripped, lower, NaN if empty), `city`, `updated_at`. Drop rows whose customer_id is not numeric. Sort by customer_id.
    starter: |
      import pandas as pd

      def clean_customers(path):
          df = pd.read_csv(path, dtype=str)
          return df

      print(clean_customers("/data/messy_customers.csv").head())
    solution: |
      import pandas as pd

      def clean_customers(path):
          df = pd.read_csv(path, dtype=str)
          df = df[df["customer_id"].str.fullmatch(r"\d+", na=False)].copy()
          df["customer_id"] = df["customer_id"].astype(int)
          df["name"] = df["name"].str.strip().str.title()
          df["email"] = df["email"].str.strip().str.lower().replace("", pd.NA)
          df = df.sort_values(["customer_id", "updated_at"]).drop_duplicates("customer_id", keep="last")
          return df[["customer_id", "name", "email", "city", "updated_at"]].reset_index(drop=True)

      print(clean_customers("/data/messy_customers.csv").head())
    tests:
      - call: "clean_customers('/data/messy_customers.csv')['customer_id'].is_unique"
        expect: "True"
      - call: "clean_customers('/data/messy_customers.csv')['customer_id'].is_monotonic_increasing"
        expect: "True"
      - call: "bool((clean_customers('/data/messy_customers.csv')['name'] == clean_customers('/data/messy_customers.csv')['name'].str.strip()).all())"
        expect: "True"
        label: names trimmed
interview:
  - q: "How would you deduplicate a pandas DataFrame keeping the latest record per key, and how do you guard against join fan-out?"
    type: coding
    level: 2
    keyPoints:
      - "sort by key and timestamp"
      - "drop_duplicates subset key keep last"
      - "merge validate one-to-one or many-to-one"
      - "compare row counts before and after"
      - "indicator to find unmatched rows"
