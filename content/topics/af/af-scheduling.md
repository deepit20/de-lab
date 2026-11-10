=== lesson
--- step concept: Runs are for intervals, not moments
The most confusing — and most-asked — Airflow concept: a DAG run **covers a data interval**, and runs **after** that interval ends.

For `schedule="@daily"`, `start_date=2025-06-01`:
| DAG run | logical_date (`ds`) | data_interval | actually starts |
|---|---|---|---|
| 1st | 2025-06-01 | 06-01 00:00 → 06-02 00:00 | ~2025-06-02 00:00 |
| 2nd | 2025-06-02 | 06-02 → 06-03 | ~2025-06-03 00:00 |

So the run labelled **1 June processes 1 June's data, and starts on 2 June**. (Older docs call logical_date `execution_date`.)

> [!WHY] This design makes runs **idempotent per interval**: rerunning "the 2025-06-01 run" always processes exactly 1 June, whenever you rerun it.

[[quiz:af-scheduling:q0]]

--- step concept: catchup and backfill
- `catchup=True` (default!): when a DAG is turned on, Airflow creates runs for **every missed interval** since `start_date`.
- `catchup=False`: only the latest interval is scheduled.
- **Backfill**: deliberately run historical intervals — `airflow dags backfill -s 2025-01-01 -e 2025-01-31 my_dag`, or clear past task instances in the UI.
- `max_active_runs` limits how many runs execute simultaneously.

[[exercise:af-scheduling-1]]

--- step practice: Use the data interval
[[exercise:af-scheduling-2]]

--- step scenario: The surprise 400 runs
[[exercise:af-scheduling-3]]
[[recall:af-scheduling:r0]]

=== detailed
## Schedules
- Presets: `@once`, `@hourly`, `@daily`, `@weekly`, `@monthly`, `@yearly`, `None` (manual/trigger only).
- Cron: `"30 2 * * *"` (02:30 daily), `"0 6 * * 1-5"` (weekdays 06:00).
- `timedelta(hours=6)`; **Timetables** for custom calendars (business days, fiscal periods); **Datasets** (data-aware scheduling: run when an upstream task updates a dataset).
- Time zone: by default UTC; use a timezone-aware `start_date` (pendulum) for local schedules (DST!).

## Data intervals
Each run has `data_interval_start` and `data_interval_end`; `logical_date` = `data_interval_start` for interval schedules. Templates: `{{ ds }}`, `{{ data_interval_start }}`, `{{ data_interval_end }}`, `{{ ds_nodash }}`. Use them in SQL:
```sql
WHERE event_ts >= '{{ data_interval_start }}' AND event_ts < '{{ data_interval_end }}'
```
and write to the matching partition (`table${{ ds_nodash }}`) → each run is self-contained.

## start_date rules
- Fixed and in the past; never `datetime.now()`.
- The first run happens at `start_date + one interval`.
- Changing `start_date` or `schedule` of an existing DAG can create confusing history — prefer a new dag_id for major changes.

## catchup, backfill, reruns
| Need | Tool |
|---|---|
| don't run history on deploy | `catchup=False` |
| process last year once | `airflow dags backfill` / clear runs, with `max_active_runs` |
| rerun a failed day | clear the failed task instances (downstream too) |
| tasks must run in order across days | `depends_on_past=True` (use sparingly) |
| wait for yesterday's run of another DAG | `ExternalTaskSensor` or Datasets |

Backfills are safe **only** if tasks are idempotent and use the interval macros instead of `now()`.

## Manual triggers
`airflow dags trigger my_dag --conf '{"date": "2025-06-01"}'` — manual runs have a logical date of the trigger time unless specified; use `params`/`dag_run.conf` for ad-hoc parameters.

=== crisp
- A DAG run covers a **data interval** and starts **after it ends**. `@daily` run with `ds=2025-06-01` processes 1 June, starts ~2 June 00:00.
- `logical_date` (old: execution_date) = `data_interval_start`. Use `{{ ds }}`, `{{ data_interval_start/end }}` in tasks.
- First run = `start_date` + 1 interval. `start_date` fixed, in the past, never `now()`.
- `catchup=True` (default) schedules every missed interval since start_date; set `catchup=False` unless you want history.
- Backfill: `airflow dags backfill -s … -e …` or clear runs; limit with `max_active_runs`. Requires idempotent, interval-based tasks.
- Schedules: presets, cron strings, timedelta, timetables, **Datasets** (data-aware).
- Default time zone UTC — be explicit.

=== memory
- **"The 1 June run wakes up on 2 June."**
- **"Catchup catches you out"** — it defaults to True.
- **"Interval in, partition out."**

=== data
flashcards:
  - q: "A @daily DAG run has ds = 2025-06-01. When does it start and what data does it cover?"
    a: "It starts around 2025-06-02 00:00 and covers 2025-06-01 00:00 to 2025-06-02 00:00."
  - q: "What does catchup=True do?"
    a: "Creates DAG runs for all intervals between start_date and now that haven't run yet."
  - q: "What is the default value of catchup?"
    a: "True (configurable globally), so set catchup explicitly."
  - q: "Which macros bound a run's data?"
    a: "{{ data_interval_start }} and {{ data_interval_end }} (and {{ ds }} for the date)."
  - q: "How do you run a DAG for January 2025 after the fact?"
    a: "airflow dags backfill -s 2025-01-01 -e 2025-01-31 <dag_id> (or clear those runs), with idempotent tasks."
  - q: "What are Airflow Datasets used for?"
    a: "Data-aware scheduling: a DAG runs when tasks that produce a dataset have updated it."
quiz:
  - q: "A DAG with start_date 2025-01-01, @daily, catchup=True is deployed on 2025-03-01. What happens?"
    options:
      - "One run for today"
      - "About 59 runs are created for Jan 1 – Feb 28"
      - "Nothing until tomorrow"
      - "An error"
    answer: 1
recall:
  - q: "Explain logical date, data interval and catchup in Airflow."
    keyPoints:
      - "each run covers a data interval"
      - "run starts after the interval ends"
      - "logical date equals interval start"
      - "catchup creates runs for missed intervals since start date"
      - "use interval macros for idempotent processing"
      - "backfill for historical intervals"
exercises:
  - id: af-scheduling-1
    lang: mcq
    kind: concept
    difficulty: 2
    title: When does it run?
    prompt: |
      `schedule="0 6 * * *"` (06:00 UTC daily), `start_date=datetime(2025, 6, 1)`, `catchup=False`, deployed on 2025-06-01 at 09:00 UTC. When does the **first** run start and what is its `ds`?
    choices:
      - "Immediately; ds = 2025-06-01"
      - "2025-06-02 06:00; ds = 2025-06-01 (interval 06-01 06:00 → 06-02 06:00)"
      - "2025-06-01 06:00; ds = 2025-06-01"
      - "2025-06-02 06:00; ds = 2025-06-02"
    answer: 1
    explain: |
      The first complete interval after start_date is 06-01 06:00 → 06-02 06:00; it runs when it ends, labelled with its start.
  - id: af-scheduling-2
    lang: python
    kind: coding
    difficulty: 2
    title: Interval-based SQL
    prompt: |
      Write `build_sql(data_interval_start, data_interval_end)` returning the SQL string
      `SELECT * FROM raw.events WHERE event_ts >= '<start>' AND event_ts < '<end>'`
      using ISO strings of the two datetimes (`.isoformat()`), and `target_partition(ds)` returning `"mart.events$" + ds without dashes`.
      These are exactly what `{{ data_interval_start }}` and `{{ ds_nodash }}` give you in templates.
    starter: |
      from datetime import datetime

      def build_sql(data_interval_start, data_interval_end):
          pass

      def target_partition(ds):
          pass
    solution: |
      from datetime import datetime

      def build_sql(data_interval_start, data_interval_end):
          return (f"SELECT * FROM raw.events WHERE event_ts >= '{data_interval_start.isoformat()}' "
                  f"AND event_ts < '{data_interval_end.isoformat()}'")

      def target_partition(ds):
          return "mart.events$" + ds.replace("-", "")
    tests:
      - call: "build_sql(datetime(2025, 6, 1), datetime(2025, 6, 2))"
        expect: "\"SELECT * FROM raw.events WHERE event_ts >= '2025-06-01T00:00:00' AND event_ts < '2025-06-02T00:00:00'\""
      - call: "target_partition('2025-06-01')"
        expect: "'mart.events$20250601'"
  - id: af-scheduling-3
    lang: text
    kind: scenario
    difficulty: 2
    title: The surprise 400 runs
    prompt: |
      A teammate deployed a new DAG with `start_date=datetime(2024, 1, 1)` and the default settings. Within minutes Airflow queued ~400 runs and BigQuery costs spiked. What happened, what do you do now, and how should it have been configured?
    solution: |
      **What happened:** `catchup` defaults to **True**, so Airflow created a run for every daily interval since 2024-01-01 (~400) and started executing them (limited only by `max_active_runs`, default 16).

      **Now:** pause the DAG; mark queued/running historic runs as failed/success or delete them; check whether partial writes happened (if tasks are idempotent and interval-based, rerunning later is safe; if not, clean up duplicates).

      **Config:** `catchup=False` (unless history is wanted), a recent `start_date`, `max_active_runs=1–3`, and when history *is* needed run a controlled **backfill** for a chosen range during low-traffic hours with cost estimates.
    review:
      - "Identifies catchup default True"
      - "Pause DAG and clean up queued runs"
      - "Checks for duplicate/partial data"
      - "catchup=False and sensible start_date"
      - "Controlled backfill with max_active_runs"
interview:
  - q: "Explain execution_date / logical_date and data intervals in Airflow. Why does a daily DAG run 'one day late'?"
    type: concept
    level: 3
    keyPoints:
      - "run represents a data interval"
      - "triggered after the interval completes"
      - "logical date is the interval start"
      - "ensures complete data for the period"
      - "idempotent reruns per interval"
  - q: "What is catchup and how do you backfill a DAG safely?"
    type: concept
    level: 2
    keyPoints:
      - "catchup schedules missed intervals since start date"
      - "set catchup False to avoid surprise runs"
      - "airflow dags backfill or clearing runs"
      - "idempotent tasks and interval macros"
      - "limit concurrency with max active runs"
