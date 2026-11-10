=== lesson
--- step concept: An orchestrator, not a processing engine
**Apache Airflow** schedules and monitors workflows defined as Python code. It decides **what runs, when, in which order, and what happens on failure** — the heavy lifting itself happens elsewhere (BigQuery, Spark, APIs).

Core vocabulary:
- **DAG** — Directed Acyclic Graph: a workflow of tasks with dependencies and a schedule.
- **Task** — one unit of work (a node in the DAG), created from an **operator**.
- **Operator** — a template for a task: `PythonOperator`, `BashOperator`, `BigQueryInsertJobOperator`, sensors…
- **DAG run** — one execution of the DAG for a **logical date / data interval**.
- **Task instance** — one execution of a task within a DAG run, with a state (queued, running, success, failed, up_for_retry, skipped…).

[[quiz:af-concepts:q0]]

--- step concept: Architecture
| Component | Job |
|---|---|
| **Scheduler** | parses DAG files, creates DAG runs, decides which tasks are ready, sends them to the executor |
| **Executor** | how tasks run: Local, Celery (worker pool), Kubernetes (pod per task) |
| **Workers** | processes/pods that actually execute tasks |
| **Metadata DB** | Postgres/MySQL storing DAG runs, task states, XComs, connections |
| **Webserver / API** | the UI: graph, grid, logs, trigger, clear |
| **DAG processor / triggerer** | parse DAG files; run deferrable operators asynchronously |

> [!WARN] The scheduler **re-parses every DAG file** frequently. Code at the top level of a DAG file (DB queries, API calls, heavy imports) runs on every parse — keep it out.

--- step check: What does what?
[[exercise:af-concepts-1]]
[[exercise:af-concepts-2]]
[[recall:af-concepts:r0]]

=== detailed
## What Airflow is (and isn't)
Airflow is a **workflow orchestrator**: scheduling, dependency management, retries, alerting, backfills, a UI and an audit trail. It is not a data processing engine — tasks should call systems that process data (BigQuery jobs, Spark/Dataproc, Dataflow, dbt) or do light Python work. Passing large datasets between tasks through Airflow (XCom) is an anti-pattern.

## DAGs
A DAG file is Python that *declares* tasks and dependencies:
```python
with DAG("orders_daily", start_date=datetime(2025, 1, 1), schedule="@daily", catchup=False,
         default_args={"retries": 2, "retry_delay": timedelta(minutes=5)}) as dag:
    extract >> transform >> load
```
"Acyclic": no cycles — a task can't (indirectly) depend on itself.

## Task lifecycle
`none → scheduled → queued → running → success` or `failed` (→ `up_for_retry` → … ), plus `skipped` (branching), `upstream_failed` (a dependency failed), `deferred` (waiting asynchronously).

## Executors
- **SequentialExecutor** (dev only), **LocalExecutor** (parallel processes on one machine),
- **CeleryExecutor** (queue + worker fleet), **KubernetesExecutor** (pod per task, isolation), CeleryKubernetes (mix).
Cloud Composer runs Airflow on GKE with Celery workers that autoscale.

## Operators, sensors, hooks
- **Operators** do something (run SQL, call Python, launch a job).
- **Sensors** wait for something (file in GCS, partition exists, another DAG's task) — use `mode="reschedule"` or deferrable versions to avoid occupying worker slots.
- **Hooks** are reusable connection clients (BigQueryHook, GCSHook) used inside operators.
- **Providers** packages (`apache-airflow-providers-google`) supply GCP operators.

## Connections & variables
Credentials live in **Connections** (or a secrets backend like Secret Manager), referenced by `conn_id`; config in **Variables** — never hard-code secrets in DAG files.

=== crisp
- Airflow = **orchestrator** (schedule, dependencies, retries, monitoring), **not** a data processing engine.
- **DAG** = tasks + dependencies + schedule (no cycles). **Task** = node from an **operator**. **DAG run** = one execution per logical date/data interval. **Task instance** = task in a run, with state.
- Components: **scheduler** (parses DAGs, schedules), **executor** (Local/Celery/Kubernetes), **workers**, **metadata DB**, **webserver**, triggerer.
- Operators do, **sensors** wait (use reschedule/deferrable), **hooks** connect.
- Secrets in **Connections**/secret backend; config in Variables.
- No heavy top-level code in DAG files (re-parsed constantly).
- States: scheduled → queued → running → success / failed / up_for_retry / skipped / upstream_failed.

=== memory
- **"Airflow is the conductor, not the orchestra."**
- **D-A-G = Directed (arrows), Acyclic (no loops), Graph (tasks).**
- Components: **S-E-W-M-W** — Scheduler, Executor, Workers, Metadata DB, Webserver.

=== data
flashcards:
  - q: "What is a DAG in Airflow?"
    a: "A Directed Acyclic Graph of tasks with dependencies and a schedule, defined in Python."
  - q: "Operator vs task vs task instance?"
    a: "Operator: template/class. Task: an instance of an operator in a DAG. Task instance: one run of that task for a specific DAG run."
  - q: "What does the scheduler do?"
    a: "Parses DAG files, creates DAG runs, determines which task instances are ready and sends them to the executor."
  - q: "Why avoid heavy top-level code in DAG files?"
    a: "The scheduler re-parses DAG files frequently, so that code runs constantly and slows/breaks scheduling."
  - q: "What is the metadata database used for?"
    a: "Storing DAG runs, task instance states, XComs, connections, variables and history."
  - q: "Sensor modes?"
    a: "poke (holds a worker slot while waiting) vs reschedule (frees the slot between checks); deferrable sensors use the triggerer."
quiz:
  - q: "Where should the transformation of 500 GB of data happen in an Airflow pipeline?"
    options:
      - "Inside a PythonOperator using pandas on the worker"
      - "In BigQuery/Spark, triggered by an Airflow operator"
      - "In XCom"
      - "In the scheduler"
    answer: 1
recall:
  - q: "Explain what Airflow is and describe its main components."
    keyPoints:
      - "workflow orchestrator defined in Python"
      - "DAG of tasks with dependencies and schedule"
      - "scheduler decides what runs"
      - "executor and workers run tasks"
      - "metadata database stores state"
      - "webserver UI"
      - "not a data processing engine"
exercises:
  - id: af-concepts-1
    lang: mcq
    kind: concept
    difficulty: 1
    title: Which component?
    prompt: |
      Task states, DAG run history and XCom values are stored in…
    choices: ["the webserver", "the metadata database", "the DAG file", "the executor's memory"]
    answer: 1
  - id: af-concepts-2
    lang: mcq
    kind: concept
    difficulty: 2
    title: The slow scheduler
    prompt: |
      After a new DAG file was added, the whole Airflow scheduler became slow. The file starts with `rows = bigquery.Client().query("SELECT ...").result()` at the top level to build task lists. Why is this a problem?
    choices:
      - "BigQuery is not supported by Airflow"
      - "Top-level code runs every time the scheduler parses the file (every few seconds/minutes)"
      - "The query runs only once a day"
      - "Tasks cannot be created dynamically"
    answer: 1
    explain: |
      Move the query into a task (or cache config in a Variable / file updated by a separate job). DAG parsing must be fast and side-effect free.
interview:
  - q: "What is Apache Airflow and how does it work internally?"
    type: concept
    level: 2
    keyPoints:
      - "orchestrates workflows as DAGs in Python"
      - "scheduler parses DAGs and schedules task instances"
      - "executor sends tasks to workers"
      - "metadata DB holds state"
      - "webserver for monitoring"
      - "retries, alerts and backfills"
  - q: "What is the difference between an operator, a sensor and a hook?"
    type: concept
    level: 2
    keyPoints:
      - "operator performs an action"
      - "sensor waits for a condition"
      - "hook is a reusable interface to an external system"
      - "sensor reschedule or deferrable mode"
