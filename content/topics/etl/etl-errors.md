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
