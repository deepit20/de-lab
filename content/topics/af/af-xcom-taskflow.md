=== lesson
--- step concept: Tasks don't share memory
Each Airflow task may run on a different worker, in a different process, at a different time. A Python variable set in one task **doesn't exist** in the next. To pass small values between tasks Airflow has **XCom** ("cross-communication") — values stored in the metadata database.

```python
def extract(ti):
    ti.xcom_push(key="row_count", value=120)

def report(ti):
    n = ti.xcom_pull(task_ids="extract", key="row_count")
```
A `PythonOperator`'s **return value** is pushed automatically under the key `return_value`.

--- step concept: The TaskFlow API
TaskFlow turns plain functions into tasks and passes return values through XCom for you:

```python
from airflow.decorators import dag, task

@dag(schedule="@daily", start_date=datetime(2025, 1, 1), catchup=False)
def orders_tf():
    @task
    def extract():
        return {"rows": 120, "path": "gs://raw/orders.json"}

    @task
    def load(meta):
        print(f"loading {meta['rows']} rows from {meta['path']}")

    load(extract())     # dependency + data passing in one line

orders_tf()
```
[[quiz:af-xcom-taskflow:q0]]

--- step practice: TaskFlow pipeline with XCom
[[exercise:af-xcom-taskflow-1]]

--- step concept: Pass references, not data
XCom is stored in the Airflow database — it's for **small** things: a row count, a file path, a date, a status. Pass `gs://bucket/path` and let the next task read the file; never push a DataFrame or 100,000 rows.

[[quiz:af-xcom-taskflow:q1]]

--- step check: Mixing styles
[[quiz:af-xcom-taskflow:q2]]

--- step interview: Explain it
[[recall:af-xcom-taskflow:r0]]

=== detailed
## XCom basics
| Concept | Detail |
|---|---|
| storage | Airflow metadata DB (or a custom XCom backend, e.g. GCS) |
| key | default `return_value`; custom keys via `xcom_push(key=...)` |
| scope | per DAG run, per task (and map index) |
| push | `ti.xcom_push(key, value)` or `return value` |
| pull | `ti.xcom_pull(task_ids="t", key="k")` |
| templating | `{{ ti.xcom_pull(task_ids='extract') }}` inside operator fields |
| values | must be serializable (JSON by default) |

## TaskFlow API
- `@dag` and `@task` decorators; calling a task function inside the DAG returns an **XComArg** (a placeholder), not the real value.
- `load(extract())` creates the dependency `extract >> load` and passes the value at run time.
- `@task(multiple_outputs=True)` lets downstream tasks use `result["rows"]` as separate XComs.
- Works with traditional operators: `extract() >> BigQueryInsertJobOperator(...)`, or pass `XComArg(op)` / `op.output` into a task.
- `@task.branch`, `@task.sensor`, `@task.virtualenv`, `@task.kubernetes` variants exist.

## Dynamic task mapping
```python
@task
def list_files(): return ["a.csv", "b.csv", "c.csv"]

@task
def load(path): ...

load.expand(path=list_files())   # one task instance per file, created at run time
```

## Size and design rules
- Keep XComs to **KB**, not MB. Big payloads slow the database and the UI.
- Pass **pointers** (GCS paths, table names, partition dates).
- Make tasks idempotent: reading the same pointer on retry gives the same result.
- Don't use XCom as a general state store between DAG runs — use a table.

> [!MISTAKE] Inside the DAG body, `meta = extract(); print(meta["rows"])` doesn't print 120 — at parse time `meta` is only a reference. Use it inside another task.

=== crisp
**XCom** ("cross-communication") passes **small** values between tasks via the metadata DB.
```python
def extract(ti, **_):
    ti.xcom_push(key="row_count", value=120)   # or simply: return 120  (key "return_value")
def report(ti, **_):
    n = ti.xcom_pull(task_ids="extract")       # 120
```
**TaskFlow API** (`@dag`, `@task`) makes XCom implicit — return values become XComs and passing them creates dependencies:
```python
from airflow.decorators import dag, task
@dag(start_date=datetime(2025, 1, 1), schedule="@daily", catchup=False)
def orders_pipeline():
    @task
    def extract(ds=None): return {"path": f"gs://raw/orders/{ds}.json", "rows": 120}
    @task
    def load(meta: dict): print("loading", meta["rows"], "rows from", meta["path"])
    load(extract())          # dependency extract >> load created automatically
orders_pipeline()
```
- XCom is for **metadata** (paths, counts, ids) — **not datasets**. Large data → GCS/BigQuery, pass the reference.
- TaskFlow tasks can access context via parameters (`ds`, `ti`, `logical_date`).
- Mix TaskFlow and classic operators freely (`extract() >> bq_task`).

=== memory
- **"XCom carries the receipt, not the parcel."**
- TaskFlow: **return = push, argument = pull + dependency.**

=== data
flashcards:
  - q: "What is XCom used for?"
    a: "Passing small pieces of data (metadata) between tasks, stored in the metadata DB."
  - q: "What happens to a PythonOperator's return value?"
    a: "It is pushed to XCom with key 'return_value'."
  - q: "How does TaskFlow create dependencies?"
    a: "Passing one @task's return value into another @task call creates the dependency and XCom transfer."
  - q: "Why not pass a 1 GB DataFrame via XCom?"
    a: "XCom lives in the metadata DB — it's for small values; store data in GCS/BigQuery and pass the path."
quiz:
  - q: "In TaskFlow, `load(extract())` means…"
    options: ["load runs before extract", "extract runs, its return value is passed to load, which runs after", "both run in parallel", "extract runs twice"]
    answer: 1
  - q: "What should a task push to XCom after writing a 2 GB file?"
    options: ["the file contents", "a pandas DataFrame", "nothing — XCom cannot hold strings", "the GCS path of the file"]
    answer: 3
    explain: "XCom lives in the metadata DB; pass small references and let the next task read the data."
  - q: "Inside the `@dag` function body, `meta = extract()` gives you…"
    options: ["None", "a string", "an XComArg reference resolved at run time", "the real dictionary returned by extract"]
    answer: 2
    explain: "DAG code runs at parse time; the value only exists when the task runs."
recall:
  - q: "Explain XCom and the TaskFlow API and what you should and shouldn't pass between tasks."
    keyPoints:
      - "tasks run in separate processes and workers"
      - "XCom stored in the metadata database"
      - "return value pushed as return_value"
      - "TaskFlow: load(extract()) sets dependency and passes data"
      - "pass small references like paths, not data"
      - "dynamic task mapping with expand"
exercises:
  - id: af-xcom-taskflow-1
    lang: python
    kind: coding
    difficulty: 2
    title: TaskFlow pipeline with XCom
    prompt: |
      Using the TaskFlow API, create a DAG `orders_tf` with tasks:
      - `extract()` returning `{"rows": 120, "path": "gs://raw/orders.json"}`
      - `validate(meta)` returning `meta["rows"] > 0`
      - `load(meta, ok)` that returns `f"loaded {meta['rows']} rows"` (raise ValueError if not ok)
      Wire them as `meta = extract(); ok = validate(meta); load(meta, ok)`. Build the DAG object as `dag = orders_tf()` and call `dag.test()`.
    starter: |
      from datetime import datetime
      from airflow.decorators import dag, task

      @dag(start_date=datetime(2025, 1, 1), schedule="@daily", catchup=False)
      def orders_tf():
          pass

      dag = orders_tf()
      dag.test()
    solution: |
      from datetime import datetime
      from airflow.decorators import dag, task

      @dag(start_date=datetime(2025, 1, 1), schedule="@daily", catchup=False)
      def orders_tf():
          @task
          def extract():
              return {"rows": 120, "path": "gs://raw/orders.json"}

          @task
          def validate(meta):
              return meta["rows"] > 0

          @task
          def load(meta, ok):
              if not ok:
                  raise ValueError("validation failed")
              return f"loaded {meta['rows']} rows"

          meta = extract()
          ok = validate(meta)
          load(meta, ok)

      dag = orders_tf()
      dag.test()
    tests:
      - call: "dag.topological()"
        expect: "['extract', 'validate', 'load']"
      - call: "sorted(dag.get_task('load').upstream)"
        expect: "['extract', 'validate']"
      - call: "dag._last['load']"
        expect: "'success'"
interview:
  - q: "How do tasks share data in Airflow, and what are the limits of XCom?"
    type: concept
    level: 2
    keyPoints:
      - "XCom push and pull or return values"
      - "TaskFlow passes return values implicitly"
      - "stored in metadata database"
      - "only small metadata"
      - "large data goes to GCS or BigQuery and pass references"
