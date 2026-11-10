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
