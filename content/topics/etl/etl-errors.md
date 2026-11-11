=== lesson
--- step concept: Two kinds of failure
- **Transient** — the network blipped, an API returned 503, BigQuery said "rate limit exceeded". Trying again in a minute will probably work.
- **Permanent** — a column is missing, credentials are wrong, the SQL has a bug. Retrying 10 times just wastes time and delays the alert.

Good pipelines **retry transient errors** and **fail fast with a clear message** on permanent ones.

[[quiz:etl-errors:q0]]

--- step concept: Retries with backoff
```python
for attempt in range(5):
    try:
        return call_api()
    except TransientError:
        time.sleep(min(2 ** attempt + random.random(), 60))   # 1s, 2s, 4s, 8s… plus jitter
raise RuntimeError("API still failing after 5 attempts")
```
**Exponential backoff** gives the other system time to recover; **jitter** stops all workers retrying at the same moment.

--- step concept: Retries are only safe if the task is idempotent
A retried task runs again **from the start**. If it appends rows, the retry duplicates them. Combine retries with idempotent loads (partition overwrite, MERGE) and you can retry anything safely.

[[quiz:etl-errors:q1]]

--- step scenario: The 3 a.m. failure
[[exercise:etl-errors-1]]

--- step check: Recover and backfill
[[quiz:etl-errors:q2]]

--- step interview: Explain it
[[recall:etl-errors:r0]]

=== detailed
## Classify errors
| Error | Type | Response |
|---|---|---|
| timeout, 429, 500/502/503, connection reset | transient | retry with backoff |
| BigQuery `rateLimitExceeded`, `backendError` | transient | retry |
| 401/403, missing permission | permanent | fail + alert, fix config |
| schema mismatch, missing column | permanent (data) | fail or quarantine, contact producer |
| SQL syntax/logic error | permanent (code) | fail, fix and redeploy |
| upstream data not ready | wait | sensor / reschedule, not a failure |

## Retry rules
- Exponential backoff with jitter, a **maximum** number of attempts and a total deadline.
- Retry at the **smallest safe unit** (one API page, one task) — not the whole pipeline.
- Respect `Retry-After` headers.
- Airflow: `retries`, `retry_delay`, `retry_exponential_backoff=True`, `max_retry_delay`.

## Idempotency makes recovery boring
- Deterministic inputs (process the run's window, not "now").
- Idempotent writes (overwrite partition, MERGE).
- Atomic publish (write to temp, then swap).
Then a retry, a manual rerun, and a backfill are all the same operation.

## Alerting
- Alert on **final** failure, not on every retry.
- Include: pipeline, task, run date, error message, link to logs, owner.
- Also alert on **silent** failures: success with 0 rows, data not fresh by the SLA.

## Recovery playbook
1. Read the log; classify the error.
2. Fix the cause (code, config, or ask the source team).
3. Clear/rerun the failed task and downstream tasks for the affected dates.
4. Backfill any missed dates (`airflow dags backfill -s 2025-03-10 -e 2025-03-14`).
5. Verify counts and notify consumers.
6. Write a short post-mortem: cause, impact, fix, prevention (a new test or contract).

## Dead-letter queues
For streaming and row-level errors: send unprocessable messages to a dead-letter topic/table with the error, so one bad message doesn't block the stream.

=== crisp
**Classify the failure first:**
| Failure | Examples | Response |
|---|---|---|
| Transient | timeout, 429, 503, preempted worker, lock | **retry** with exponential backoff + jitter (bounded) |
| Data | bad records, schema change, duplicates | **quarantine** or **fail fast** + alert owner |
| Logic/bug | wrong join, exception in code | fail loudly; fix; **backfill** |
| Upstream late/missing | file not arrived | sensor wait with timeout → alert; don't load partial |
| Infrastructure | quota, permissions, disk | alert platform/on-call |

**Recovery toolkit:**
- **Idempotent, interval-based tasks** → safe retries, reruns, backfills.
- **Checkpoints**: split work into steps/partitions so a rerun resumes, not restarts.
- **Dead-letter queue/table** for poison messages.
- **Atomic publish** (temp table + swap / WAP) → no half-written outputs.
- **Time travel / snapshots** to restore (BigQuery `FOR SYSTEM_TIME AS OF`).
- **Alerting**: failure callbacks, SLA misses, freshness checks — to a channel someone watches; runbooks for common failures.
- **Post-mortems**: cause, impact, fix, prevention — blameless.

=== memory
- **"Retry the weather, quarantine the data, fix the code."**
- Retries without idempotency = duplicates.

=== data
flashcards:
  - q: "Which failures should be retried automatically?"
    a: "Transient ones — timeouts, rate limits (429), 5xx, preemptions — with backoff and a cap."
  - q: "What is a dead-letter queue?"
    a: "A place where messages/records that repeatedly fail processing are sent for later inspection, so the pipeline continues."
  - q: "How do you avoid consumers reading half-written output?"
    a: "Write to a temporary location/table and atomically swap or publish after checks."
quiz:
  - q: "A task fails due to a BigQuery 'Exceeded rate limits' error. Best first response?"
    options: ["Delete the table", "Automatic retry with exponential backoff", "Disable the DAG permanently", "Ignore it"]
    answer: 1
  - q: "Why add random jitter to retry delays?"
    options: ["to retry forever", "so many workers don't retry at exactly the same moment and overload the service again", "to make logs prettier", "because sleep() needs it"]
    answer: 1
    explain: "Jitter spreads retries out, avoiding a thundering herd."
  - q: "After fixing a bug that broke 4 days of loads, what do you run?"
    options: ["a backfill of the 4 affected dates (safe because the loads are idempotent)", "only today's run", "delete the table", "nothing — tomorrow's run will catch up automatically"]
    answer: 0
    explain: "Backfilling reprocesses the missed windows; idempotent loads make reruns safe."
recall:
  - q: "How do you design error handling, retries and recovery for a batch pipeline?"
    keyPoints:
      - "transient vs permanent errors"
      - "retry transient with exponential backoff and jitter"
      - "fail fast with clear messages on permanent errors"
      - "idempotent tasks make retries safe"
      - "alert on final failure and on silent failures"
      - "fix, rerun, backfill, verify, post-mortem"
exercises:
  - id: etl-errors-1
    lang: text
    kind: scenario
    difficulty: 3
    title: The 3 a.m. failure
    prompt: |
      Your nightly pipeline (extract API → GCS → BigQuery staging → dbt marts) failed at the dbt step because a source added a new value to `status` and an `accepted_values` test failed. Dashboards refresh at 8 am. Walk through your response.
    solution: |
      1. **Assess**: the failure is a *data/contract* issue, not transient — retries won't help. Raw and staging data loaded fine; marts weren't published (good — tests blocked bad data).
      2. **Decide quickly with the business owner**: is the new status legitimate (e.g. `partially_refunded`)? If yes, update the model mapping and the test's accepted values; if unknown, map it to `other`/quarantine those rows and publish the rest.
      3. **Fix & rerun** only the failed models (`dbt build --select state:… / model+`) for that day — idempotent.
      4. **Communicate**: notify dashboard users if data will be late or partially incomplete.
      5. **Prevent**: data contract with the source team (enum changes announced), `warn`-level test for new enum values in staging with `error` in marts, alert routing, runbook entry, post-mortem.
    review:
      - "Identifies data/contract failure (not transient)"
      - "Confirms meaning with business/source owner"
      - "Fixes mapping/test and reruns idempotently"
      - "Communicates impact"
      - "Prevention: contracts, test severities, runbook"
interview:
  - q: "How do you design pipelines to recover from failures?"
    type: design
    level: 3
    keyPoints:
      - "classify transient vs data vs logic failures"
      - "retries with backoff for transient errors"
      - "idempotent tasks for safe reruns"
      - "dead letter or quarantine for bad records"
      - "atomic publish"
      - "alerting runbooks and backfills"
