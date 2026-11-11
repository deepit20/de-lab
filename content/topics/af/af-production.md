=== lesson
--- step concept: default_args set the safety net
`default_args` apply to every task in a DAG:

```python
default_args = {
    "owner": "data-eng",
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
    "retry_exponential_backoff": True,
    "on_failure_callback": alert,
    "execution_timeout": timedelta(hours=1),
}
```
Retries handle transient errors; the callback tells a human only when retries are exhausted; the timeout stops a hung task.

[[quiz:af-production:q0]]

--- step practice: Production-ready default_args
[[exercise:af-production-1]]

--- step concept: Connections and secrets
Never put passwords or keys in DAG code. Airflow **Connections** store host, login and secrets by id (`conn_id="orders_db"`) and hooks/operators look them up. In production, back them with a **secrets backend** such as Google Secret Manager.

[[quiz:af-production:q1]]

--- step concept: Idempotent, atomic tasks
- Use the run's `data_interval_start/end` (or `{{ ds }}`), never `datetime.now()`.
- Overwrite partitions or MERGE — never blind appends.
- One task = one logical step that can be retried on its own.
- Keep top-level DAG code light — the scheduler parses files constantly.

--- step check: SLAs and monitoring
[[quiz:af-production:q2]]

--- step interview: Explain it
[[recall:af-production:r0]]

=== detailed
## Reliability settings
| Setting | Purpose |
|---|---|
| `retries`, `retry_delay`, `retry_exponential_backoff`, `max_retry_delay` | recover from transient errors |
| `execution_timeout` | kill hung tasks |
| `dagrun_timeout` | cap a whole run |
| `on_failure_callback` / `on_retry_callback` / `on_success_callback` | alerts and hooks |
| `max_active_runs` | limit concurrent runs (important for backfills) |
| `max_active_tasks`, pools | protect source systems and quotas |
| `depends_on_past` | run only if the previous run of this task succeeded |
| `catchup` | whether to create runs for missed past intervals |

## SLAs and freshness
- Airflow 2's `sla=` on tasks flagged tasks finishing late; it was removed in Airflow 3, where newer releases offer deadline alerts instead.
- Better: a **freshness check** task or monitoring query that alerts if the target table isn't updated by its deadline, plus dashboards on task duration.

## Connections, variables, secrets
- Connections hold credentials; Variables hold config (use sparingly — each `Variable.get` at top level hits the DB on every parse).
- Secrets backend (Secret Manager, Vault) keeps secrets out of the metadata DB.
- On GCP prefer **service accounts** over stored keys.

## Best practices checklist
- **Idempotent** tasks using templated dates.
- **Atomic** writes (stage then swap/merge).
- Light DAG files: no heavy imports or API calls at top level.
- Push work to the right engine (BigQuery, Dataflow) — Airflow orchestrates.
- Pin provider package versions; test DAG imports in CI.
- Meaningful task ids, `owner`, `tags`, `doc_md`.
- Use pools for rate-limited systems.
- Alert once on final failure with context (DAG, task, date, log link).

## Backfills and catchup
- `catchup=False` for most DAGs; run backfills deliberately: `airflow dags backfill -s 2025-03-01 -e 2025-03-07 orders`.
- Idempotent tasks make backfills safe; `max_active_runs` keeps them from overwhelming the warehouse.

> [!REAL] Interviewers ask "how do you make an Airflow DAG production-ready?" — retries with backoff, timeouts, alerts, idempotent tasks with templated dates, secrets in a backend, CI import tests, and monitoring of freshness and duration.

=== crisp
**Reliability settings**
- `retries`, `retry_delay`, `retry_exponential_backoff=True`, `max_retry_delay` — for transient failures.
- `execution_timeout` — kill hung tasks. Sensors: `timeout`.
- `on_failure_callback` / `on_retry_callback` → Slack/email/PagerDuty with dag, task, ds and log URL.
- **SLAs** / deadline alerts — notify when a task hasn't finished by an expected time (e.g. marts by 06:30).
- `max_active_runs`, `max_active_tasks`, **pools** — protect warehouses/APIs from too much concurrency.
- `depends_on_past` only when order across runs truly matters.

**Best practices**
1. **Idempotent** tasks using `data_interval_*` macros; overwrite partitions / MERGE.
2. **Atomic & thin** tasks; heavy work in BigQuery/Spark; XCom only metadata.
3. **No top-level work** in DAG files; light imports; no `Variable.get` at parse time (use templates `{{ var.value.x }}`).
4. **Secrets** in Connections / Secret Manager backend — never in code.
5. Fixed `start_date`, explicit `catchup`, unique stable `dag_id`/`task_id`.
6. **Test** DAGs in CI: import test (no import errors, no cycles), unit-test callables, `dag.test()`.
7. Clear **ownership**, tags, docs (`doc_md`), and runbooks.
8. Keep DAGs small and composable (Datasets / TriggerDagRunOperator) rather than one giant DAG.

=== memory
- **"Retry, Timeout, Alert, Limit."**
- **"Parse fast, run idempotent, fail loud."**

=== data
flashcards:
  - q: "What does execution_timeout do?"
    a: "Fails a task that runs longer than the given duration (avoids hung tasks)."
  - q: "How do you protect a warehouse from too many concurrent Airflow queries?"
    a: "Pools (slot limits), max_active_tasks / max_active_runs."
  - q: "Why use templates like {{ var.value.x }} instead of Variable.get() at top level?"
    a: "Variable.get at top level hits the metadata DB on every parse; templates resolve at runtime."
  - q: "What should a failure callback include?"
    a: "DAG id, task id, logical date, error and a link to the log, sent to a monitored channel."
  - q: "What is a DAG import test?"
    a: "A CI test that loads all DAG files (DagBag) and fails on import errors, cycles or missing tags/owners."
quiz:
  - q: "A task calling a flaky API should have…"
    options: ["retries=0", "retries with exponential backoff and an execution_timeout", "depends_on_past=True", "catchup=True"]
    answer: 1
  - q: "Where should a DAG get its database password?"
    options: ["from XCom", "from an Airflow Connection backed by a secrets manager", "hard-coded in the DAG file", "from a comment in the code"]
    answer: 1
    explain: "Connections and secrets backends keep credentials out of code and Git."
  - q: "Which setting stops a stuck task from running forever?"
    options: ["execution_timeout", "retries", "catchup", "owner"]
    answer: 0
    explain: "execution_timeout fails the task when it runs longer than the limit, so retries and alerts can kick in."
recall:
  - q: "How do you make an Airflow DAG production-ready?"
    keyPoints:
      - "retries with delay and exponential backoff"
      - "execution_timeout and failure callbacks for alerts"
      - "idempotent tasks with templated dates"
      - "connections and secrets backend, no hard-coded credentials"
      - "light DAG files, push work to engines"
      - "pools, max_active_runs, CI import tests, freshness monitoring"
exercises:
  - id: af-production-1
    lang: python
    kind: coding
    difficulty: 2
    title: Production-ready default_args
    prompt: |
      Create `default_args` and DAG `prod_orders` so that: tasks retry **3** times with 5-minute delay, a failure calls `alert(context)` (provided), owner is `"data-eng"`. Add one PythonOperator `load` whose callable **fails the first two times** (simulate with the provided `flaky` function) and call `dag.test()` — the run must end in success thanks to retries.
    starter: |
      from datetime import datetime, timedelta
      from airflow import DAG
      from airflow.operators.python import PythonOperator

      ATTEMPTS = {"n": 0}
      def flaky():
          ATTEMPTS["n"] += 1
          if ATTEMPTS["n"] < 3:
              raise ConnectionError("API timeout")
          print("loaded!")

      def alert(context):
          print("ALERT:", context["task_instance"].task_id)

      default_args = {}

    solution: |
      from datetime import datetime, timedelta
      from airflow import DAG
      from airflow.operators.python import PythonOperator

      ATTEMPTS = {"n": 0}
      def flaky():
          ATTEMPTS["n"] += 1
          if ATTEMPTS["n"] < 3:
              raise ConnectionError("API timeout")
          print("loaded!")

      def alert(context):
          print("ALERT:", context["task_instance"].task_id)

      default_args = {"owner": "data-eng", "retries": 3, "retry_delay": timedelta(minutes=5), "on_failure_callback": alert}

      with DAG("prod_orders", start_date=datetime(2025, 1, 1), schedule="@daily", catchup=False, default_args=default_args) as dag:
          load = PythonOperator(task_id="load", python_callable=flaky)

      dag.test()
    tests:
      - call: "dag.get_task('load').retries"
        expect: "3"
      - call: "dag._last['load']"
        expect: "'success'"
        label: succeeded after retries
      - call: "dag.get_task('load').on_failure_callback is alert"
        expect: "True"
interview:
  - q: "What best practices do you follow when writing production Airflow DAGs?"
    type: concept
    level: 3
    keyPoints:
      - "idempotent tasks with interval macros"
      - "retries timeouts and alerts"
      - "no heavy top level code"
      - "secrets in connections or secret manager"
      - "thin tasks delegating heavy work"
      - "pools and concurrency limits"
      - "CI tests for DAG imports"
