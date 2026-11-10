=== lesson
--- step concept: Your first DAG
```python
from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.empty import EmptyOperator

def extract(**context):
    print("extracting data for", context["ds"])

with DAG(
    dag_id="orders_daily",
    start_date=datetime(2025, 1, 1),
    schedule="@daily",
    catchup=False,
    default_args={"retries": 2, "retry_delay": timedelta(minutes=5)},
    tags=["orders"],
) as dag:
    start = EmptyOperator(task_id="start")
    extract_task = PythonOperator(task_id="extract", python_callable=extract)   # pass the function, don't call it
    start >> extract_task
```
The practice sandbox runs an **Airflow emulator**: it builds the real task graph from your code, draws it, validates it, and `dag.test()` simulates a run (retries, XComs, trigger rules) — no scheduler needed.

[[quiz:af-dags:q0]]

--- step example: Dependencies
```python
a >> b >> c          # a then b then c
a >> [b, c] >> d     # fan-out then fan-in
chain(a, b, c)       # same as a >> b >> c
b.set_upstream(a)    # same as a >> b
```

--- step practice: Build an ETL DAG
[[exercise:af-dags-1]]

--- step practice: Fan-out / fan-in
[[exercise:af-dags-2]]

--- step check: Fix a broken DAG
[[exercise:af-dags-3]]
[[recall:af-dags:r0]]

=== detailed
## Anatomy of a DAG file
1. **Imports** (keep them light).
2. **Callables / config** (functions used by tasks).
3. **DAG definition**: `dag_id`, `start_date`, `schedule`, `catchup`, `default_args`, `tags`, `max_active_runs`, `params`.
4. **Tasks** created from operators inside the `with DAG(...)` block.
5. **Dependencies** with `>>`, `<<`, `chain`, `cross_downstream`.

## default_args
Applied to every task: `owner`, `retries`, `retry_delay`, `retry_exponential_backoff`, `email_on_failure`, `on_failure_callback`, `execution_timeout`, `depends_on_past`.

## Operators you'll use most (GCP)
| Operator | Use |
|---|---|
| `PythonOperator` / `@task` | light Python logic, API calls |
| `BashOperator` | CLI tools (dbt, gsutil) |
| `BigQueryInsertJobOperator` | run SQL / load jobs in BigQuery |
| `GCSToBigQueryOperator` | load files from GCS |
| `GCSObjectExistenceSensor` | wait for a file |
| `DataprocSubmitJobOperator` | run Spark |
| `EmptyOperator` | grouping/structure (start/end markers) |

## Templating (Jinja)
Many operator fields are templated: `"SELECT * FROM t WHERE dt = '{{ ds }}'"`. Common macros: `{{ ds }}` (logical date `YYYY-MM-DD`), `{{ ds_nodash }}`, `{{ data_interval_start }}`, `{{ data_interval_end }}`, `{{ params.x }}`, `{{ var.value.name }}`. Templates render at **runtime**, keeping tasks idempotent per interval.

## Good task design
- **Atomic**: one clear responsibility; fails/retries independently.
- **Idempotent**: rerunnable for the same interval.
- **Thin**: delegate heavy work to BigQuery/Spark; pass references (table names, GCS paths), not data.
- **Deterministic task_ids**; avoid generating tasks from slow external calls at parse time.

## Common mistakes
> [!MISTAKE] `python_callable=extract()` — calls the function at parse time and passes its return value. Pass `extract`.

> [!MISTAKE] Dynamic `start_date=datetime.now()` — schedules never trigger reliably. Use a fixed date.

> [!MISTAKE] Duplicate `task_id`s or cycles → DAG import errors.

> [!MISTAKE] Huge data in XCom.

=== crisp
- `with DAG(dag_id, start_date=<fixed>, schedule, catchup, default_args) as dag:` then tasks from operators.
- `PythonOperator(task_id=…, python_callable=func)` — **pass the function, don't call it**.
- Dependencies: `a >> b`, `a >> [b, c] >> d`, `chain()`, `set_upstream/downstream`.
- `default_args`: retries, retry_delay, on_failure_callback, execution_timeout, owner.
- Jinja templates: `{{ ds }}`, `{{ data_interval_start }}`, `{{ params.x }}` — rendered at runtime.
- Tasks: atomic, idempotent, thin (push work to BigQuery/Spark), pass references not data.
- Never `start_date=datetime.now()`; unique task_ids; no cycles.

=== memory
- **"Pass the function, not the call."**
- **`>>` reads as "then".**
- Good task = **A-I-T**: Atomic, Idempotent, Thin.

=== data
flashcards:
  - q: "What's wrong with `PythonOperator(task_id='x', python_callable=load())`?"
    a: "load() runs at DAG parse time; python_callable must be the function object `load`."
  - q: "How do you make b and c run in parallel after a, and d after both?"
    a: "a >> [b, c] >> d"
  - q: "What does {{ ds }} render to?"
    a: "The DAG run's logical date as YYYY-MM-DD."
  - q: "Why must start_date be fixed, not datetime.now()?"
    a: "A moving start date means the scheduler never sees a completed interval to schedule."
  - q: "What are default_args used for?"
    a: "Default parameters applied to every task in the DAG (retries, retry_delay, owner, callbacks...)."
quiz:
  - q: "`a >> [b, c]` means…"
    options: ["b then c then a", "b and c both run after a", "a runs after b and c", "a, b, c in parallel"]
    answer: 1
recall:
  - q: "Describe how you write an Airflow DAG and what makes a well-designed task."
    keyPoints:
      - "DAG with fixed start date, schedule, catchup, default args"
      - "tasks created from operators"
      - "dependencies with bitshift operators"
      - "templated logical date parameters"
      - "atomic idempotent tasks"
      - "heavy work delegated to external systems"
exercises:
  - id: af-dags-1
    lang: python
    kind: coding
    difficulty: 2
    title: Build an extract-transform-load DAG
    prompt: |
      Create a DAG `sales_etl` (start_date 2025-01-01, `schedule="@daily"`, `catchup=False`, default `retries=2`) with three PythonOperators `extract`, `transform`, `load` running in that order. Each callable just prints a message. End your code with `dag.test()` to simulate a run.
    starter: |
      from datetime import datetime, timedelta
      from airflow import DAG
      from airflow.operators.python import PythonOperator

      def extract():
          print("extract")

      def transform():
          print("transform")

      def load():
          print("load")

      # define the DAG here

    solution: |
      from datetime import datetime, timedelta
      from airflow import DAG
      from airflow.operators.python import PythonOperator

      def extract():
          print("extract")

      def transform():
          print("transform")

      def load():
          print("load")

      with DAG("sales_etl", start_date=datetime(2025, 1, 1), schedule="@daily", catchup=False,
               default_args={"retries": 2, "retry_delay": timedelta(minutes=5)}) as dag:
          e = PythonOperator(task_id="extract", python_callable=extract)
          t = PythonOperator(task_id="transform", python_callable=transform)
          l = PythonOperator(task_id="load", python_callable=load)
          e >> t >> l

      dag.test()
    tests:
      - call: "dag.dag_id"
        expect: "'sales_etl'"
      - call: "dag.topological()"
        expect: "['extract', 'transform', 'load']"
        label: order extract → transform → load
      - call: "dag.get_task('load').retries"
        expect: "2"
        label: retries from default_args
      - call: "dag.catchup"
        expect: "False"
        hidden: true
    hints:
      - "with DAG('sales_etl', start_date=datetime(2025, 1, 1), schedule='@daily', catchup=False, default_args={'retries': 2}) as dag:"
      - "e >> t >> l"
  - id: af-dags-2
    lang: python
    kind: coding
    difficulty: 2
    title: Parallel loads, one report
    prompt: |
      Build DAG `daily_marts`: an `EmptyOperator` `start`, then three PythonOperators `load_orders`, `load_customers`, `load_products` that run **in parallel** after start, then a PythonOperator `build_report` that runs only after **all three** loads. Use one shared callable that prints its task id (hint: `**context` → `context['task'].task_id`). Call `dag.test()`.
    starter: |
      from datetime import datetime
      from airflow import DAG
      from airflow.operators.python import PythonOperator
      from airflow.operators.empty import EmptyOperator

      def run(**context):
          print("running", context["task"].task_id)

    solution: |
      from datetime import datetime
      from airflow import DAG
      from airflow.operators.python import PythonOperator
      from airflow.operators.empty import EmptyOperator

      def run(**context):
          print("running", context["task"].task_id)

      with DAG("daily_marts", start_date=datetime(2025, 1, 1), schedule="@daily", catchup=False) as dag:
          start = EmptyOperator(task_id="start")
          loads = [PythonOperator(task_id=f"load_{t}", python_callable=run) for t in ("orders", "customers", "products")]
          report = PythonOperator(task_id="build_report", python_callable=run)
          start >> loads >> report

      dag.test()
    tests:
      - call: "sorted(dag.get_task('start').downstream)"
        expect: "['load_customers', 'load_orders', 'load_products']"
      - call: "sorted(dag.get_task('build_report').upstream)"
        expect: "['load_customers', 'load_orders', 'load_products']"
      - call: "dag.topological()[-1]"
        expect: "'build_report'"
    hints:
      - "start >> [a, b, c] >> report"
  - id: af-dags-3
    lang: python
    kind: debug
    difficulty: 2
    title: "Debug: the DAG that won't import"
    prompt: |
      This DAG file has **three** bugs: the callable is invoked at parse time, two tasks share an id, and the dependencies form a cycle. Fix them so the DAG is `extract >> validate >> load` and `dag.test()` succeeds.
    starter: |
      from datetime import datetime
      from airflow import DAG
      from airflow.operators.python import PythonOperator

      def extract():
          print("extract")
          return 100

      def validate():
          print("validate")

      def load():
          print("load")

      with DAG("orders_load", start_date=datetime(2025, 1, 1), schedule="@daily", catchup=False) as dag:
          e = PythonOperator(task_id="extract", python_callable=extract())
          v = PythonOperator(task_id="validate", python_callable=validate)
          l = PythonOperator(task_id="validate", python_callable=load)
          e >> v >> l >> e

      dag.test()
    solution: |
      from datetime import datetime
      from airflow import DAG
      from airflow.operators.python import PythonOperator

      def extract():
          print("extract")
          return 100

      def validate():
          print("validate")

      def load():
          print("load")

      with DAG("orders_load", start_date=datetime(2025, 1, 1), schedule="@daily", catchup=False) as dag:
          e = PythonOperator(task_id="extract", python_callable=extract)
          v = PythonOperator(task_id="validate", python_callable=validate)
          l = PythonOperator(task_id="load", python_callable=load)
          e >> v >> l

      dag.test()
    tests:
      - call: "dag.topological()"
        expect: "['extract', 'validate', 'load']"
      - call: "dag._last"
        expect: "{'extract': 'success', 'validate': 'success', 'load': 'success'}"
        label: simulated run succeeded
    hints:
      - "Read the error message from the top — fix one problem at a time."
      - "python_callable needs the function, not its result."
interview:
  - q: "Walk me through writing a DAG that loads a file from GCS into BigQuery every day."
    type: design
    level: 2
    keyPoints:
      - "DAG with fixed start date daily schedule catchup choice"
      - "sensor waits for the file with timeout"
      - "GCSToBigQuery load into dated partition"
      - "validation task"
      - "transformation in BigQuery"
      - "retries and failure alerts"
      - "templated ds for idempotent partition"
