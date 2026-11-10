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
