=== lesson
--- step concept: Choose a path at run time
A **branch** task decides which downstream task(s) run. It returns the `task_id` (or list of ids) to follow; every other direct downstream task is **skipped**.

```python
def choose(**context):
    return "full_load" if context["logical_date"].day == 1 else "incremental_load"

choose = BranchPythonOperator(task_id="choose", python_callable=choose)
choose >> [full_load, incremental_load]
```
TaskFlow version: `@task.branch`.

--- step practice: Branch on the day of month
[[exercise:af-branching-1]]

--- step concept: Trigger rules
By default a task runs only when **all** its upstream tasks succeeded (`all_success`). After a branch, one upstream is always *skipped*, so a join task with the default rule would be skipped too. Trigger rules change that:

| Rule | Runs when |
|---|---|
| `all_success` (default) | every upstream succeeded |
| `all_done` | every upstream finished, whatever the result |
| `one_failed` | at least one upstream failed |
| `none_failed_min_one_success` | nothing failed and at least one succeeded — the usual **join after a branch** |

[[quiz:af-branching:q0]]
[[quiz:af-branching:q1]]

--- step concept: Sensors wait for a condition
A **sensor** keeps checking until something is true — a file exists in GCS, a partition landed, another DAG finished.
- `mode="poke"` holds a worker slot the whole time.
- `mode="reschedule"` releases the slot between checks.
- **Deferrable** operators hand the wait to the triggerer — the cheapest option.

Always set a `timeout`.

[[quiz:af-branching:q2]]

--- step interview: Explain it
[[recall:af-branching:r0]]

=== detailed
## Branching
- `BranchPythonOperator` / `@task.branch` return a task_id, a list of task_ids, or `None` (skip all).
- Returned ids must be **direct downstream** tasks.
- Skips propagate: tasks downstream of a skipped task are skipped too (with default rules).
- Other branching operators: `BranchDateTimeOperator`, `BranchDayOfWeekOperator`, `ShortCircuitOperator` (skip everything downstream if the condition is false).

## Trigger rules
| Rule | Typical use |
|---|---|
| `all_success` | normal dependencies |
| `all_failed` | cleanup only if everything failed |
| `all_done` | cleanup/teardown that must always run |
| `one_success` | continue as soon as any source is ready |
| `one_failed` | alerting task |
| `none_failed` | join where skips are fine but failures are not |
| `none_failed_min_one_success` | join after a branch |
| `none_skipped` | require every branch to have run |
| `always` | run no matter what |

## Sensors
| Sensor | Waits for |
|---|---|
| `GCSObjectExistenceSensor` | a file in a bucket |
| `BigQueryTablePartitionExistenceSensor` | a partition |
| `ExternalTaskSensor` | a task in another DAG |
| `@task.sensor` / `PythonSensor` | your own condition |

Settings: `poke_interval`, `timeout`, `mode`, `soft_fail` (skip instead of fail on timeout), `exponential_backoff`.

> [!PERF] Hundreds of sensors in poke mode can occupy every worker slot so no real work runs. Use reschedule mode or deferrable operators (`deferrable=True`) for long waits.

## Avoiding surprises
- After a branch, give the join task `trigger_rule="none_failed_min_one_success"`.
- Draw the graph: check every task after a branch and decide what should happen when its upstream is skipped.
- Alerting tasks with `one_failed` should not themselves be skipped by an upstream branch.
- Datasets / data-aware scheduling can replace cross-DAG sensors: DAG B runs when DAG A updates a dataset.

=== crisp
**Branching:** `BranchPythonOperator` (or `@task.branch`) returns the task_id(s) to follow; the other direct downstream tasks are **skipped**.
```python
def choose(**ctx):
    return "full_load" if ctx["logical_date"].day == 1 else "incremental_load"
branch = BranchPythonOperator(task_id="choose", python_callable=choose)
join = EmptyOperator(task_id="join", trigger_rule="none_failed_min_one_success")
branch >> [full, incr] >> join
```
**Trigger rules** (when a task runs, based on upstream states):
| Rule | Runs when |
|---|---|
| `all_success` (default) | all upstream succeeded |
| `all_done` | all upstream finished (any state) — cleanup tasks |
| `one_failed` | at least one upstream failed — alerting tasks |
| `all_failed` | all upstream failed |
| `none_failed` | no upstream failed (success or skipped) |
| `none_failed_min_one_success` | no failures and ≥1 success — the **join after a branch** |
| `always` | regardless |
> [!WARN] A join after a branch with the default `all_success` gets **skipped** (one upstream is skipped).

**Sensors** wait for a condition: `GCSObjectExistenceSensor`, `ExternalTaskSensor`, `PythonSensor`, `BigQueryTableExistenceSensor`. Set `timeout` and `poke_interval`; use `mode="reschedule"` or **deferrable** operators so waiting doesn't block worker slots; `soft_fail=True` to skip instead of fail.

=== memory
- **"After a branch, join with none_failed_min_one_success."**
- **Cleanup = all_done; alert = one_failed.**
- Sensors: **always set a timeout.**

=== data
flashcards:
  - q: "What does a BranchPythonOperator return?"
    a: "The task_id (or list of task_ids) to run next; other directly downstream tasks are skipped."
  - q: "Why does the join task after a branch get skipped?"
    a: "With the default all_success, a skipped upstream causes it to be skipped — use none_failed_min_one_success."
  - q: "Which trigger rule fits a cleanup task that must always run?"
    a: "all_done (or always)."
  - q: "poke vs reschedule sensor mode?"
    a: "poke keeps the worker slot while waiting; reschedule releases it between checks."
quiz:
  - q: "A task should send an alert if any of its upstream tasks failed. Trigger rule?"
    options: ["all_success", "one_failed", "none_failed", "all_done"]
    answer: 1
  - q: "A `report` task follows both branches of a branch task. With the default trigger rule it will…"
    options: ["run twice", "be skipped, because one upstream branch is always skipped", "always run", "fail"]
    answer: 1
    explain: "all_success requires every upstream to succeed; a skipped upstream propagates the skip."
  - q: "A sensor waits up to 6 hours for a vendor file. Best mode?"
    options: ["reschedule or deferrable, with a timeout", "poke with no timeout", "a while True loop in a PythonOperator", "no sensor; just fail"]
    answer: 0
    explain: "Reschedule/deferrable modes free worker slots between checks; a timeout prevents waiting forever."
recall:
  - q: "Explain branching, trigger rules and sensors in Airflow, including the join-after-branch problem."
    keyPoints:
      - "branch returns task_id(s) to follow; others are skipped"
      - "default all_success skips the join"
      - "none_failed_min_one_success for the join"
      - "one_failed for alerts, all_done for cleanup"
      - "sensors poke vs reschedule vs deferrable"
      - "always set sensor timeouts"
exercises:
  - id: af-branching-1
    lang: python
    kind: coding
    difficulty: 3
    title: Branch on the day of month
    prompt: |
      Build DAG `smart_load`: a BranchPythonOperator `choose` returning `"full_load"` if `context["logical_date"].day == 1`, else `"incremental_load"`; two PythonOperators `full_load`, `incremental_load`; and an EmptyOperator `publish` after both that must run in either case. Simulate with `dag.test(execution_date=datetime(2025, 6, 2))`.
    starter: |
      from datetime import datetime
      from airflow import DAG
      from airflow.operators.python import PythonOperator, BranchPythonOperator
      from airflow.operators.empty import EmptyOperator

      def choose(**context):
          pass

      def work(**context):
          print("running", context["task"].task_id)

    solution: |
      from datetime import datetime
      from airflow import DAG
      from airflow.operators.python import PythonOperator, BranchPythonOperator
      from airflow.operators.empty import EmptyOperator

      def choose(**context):
          return "full_load" if context["logical_date"].day == 1 else "incremental_load"

      def work(**context):
          print("running", context["task"].task_id)

      with DAG("smart_load", start_date=datetime(2025, 1, 1), schedule="@daily", catchup=False) as dag:
          branch = BranchPythonOperator(task_id="choose", python_callable=choose)
          full = PythonOperator(task_id="full_load", python_callable=work)
          incr = PythonOperator(task_id="incremental_load", python_callable=work)
          publish = EmptyOperator(task_id="publish", trigger_rule="none_failed_min_one_success")
          branch >> [full, incr] >> publish

      dag.test(execution_date=datetime(2025, 6, 2))
    tests:
      - call: "dag._last['incremental_load']"
        expect: "'success'"
      - call: "dag._last['full_load']"
        expect: "'skipped'"
      - call: "dag._last['publish']"
        expect: "'success'"
        label: join still runs
    hints:
      - "The join needs trigger_rule='none_failed_min_one_success'."
interview:
  - q: "How do branching and trigger rules work in Airflow? Give an example where the default trigger rule causes a problem."
    type: concept
    level: 3
    keyPoints:
      - "branch operator returns task ids to follow"
      - "other paths are skipped"
      - "default all_success skips the join"
      - "use none_failed_min_one_success"
      - "all_done for cleanup and one_failed for alerts"
