=== lesson
--- step concept: Data that is wrong is worse than no data
Bad data silently produces wrong decisions. Data quality is measured along **dimensions**:

| Dimension | Question | Example check |
|---|---|---|
| Completeness | Is anything missing? | `email` not null rate ≥ 95%; yesterday's partition exists |
| Uniqueness | Any duplicates? | `order_id` unique |
| Validity | Does it follow the rules/format? | `status IN (…)`, amount ≥ 0, valid email |
| Accuracy | Does it match reality? | totals reconcile with the payment provider |
| Consistency | Do related data agree? | every `orders.customer_id` exists in customers |
| Timeliness / freshness | Is it up to date? | max(loaded_at) < 2 hours ago |

> [!WHY] Most data incidents are found by the *users* ("this dashboard looks wrong"). Automated checks let the pipeline find them first.

[[quiz:def-data-quality:q0]]

--- step example: Checks as SQL
```sql
-- uniqueness: should return 0 rows
SELECT order_id, COUNT(*) FROM orders GROUP BY order_id HAVING COUNT(*) > 1;
-- referential integrity
SELECT o.order_id FROM orders o LEFT JOIN customers c USING (customer_id) WHERE c.customer_id IS NULL;
-- validity
SELECT * FROM orders WHERE amount < 0 OR status NOT IN ('delivered','shipped','cancelled','returned');
```
A test **passes when it returns no rows** — the convention used by dbt.

--- step practice: Write the checks
[[exercise:def-data-quality-1]]
[[exercise:def-data-quality-2]]

--- step scenario: What to do when a check fails
[[exercise:def-data-quality-3]]
[[recall:def-data-quality:r0]]

=== detailed
## Why it matters
Decisions, ML models, finance numbers and customer communications depend on data. Quality issues compound downstream: one duplicated source row can inflate dozens of reports. Trust, once lost, is slow to rebuild.

## Dimensions (with typical checks)
- **Completeness**: null rates, required fields, row counts vs expectation, partition presence.
- **Uniqueness**: primary/business keys unique, no duplicate events.
- **Validity**: types, formats (regex), allowed values (accepted_values), ranges, cross-field rules (`ship_date >= order_date`).
- **Accuracy**: reconciliation with source/system of record, sampling against reality.
- **Consistency**: referential integrity, same metric equal across marts, units/currencies consistent.
- **Timeliness/Freshness**: data arrives within SLA; `max(updated_at)` recent.

## Where to check
| Stage | Checks | On failure |
|---|---|---|
| Ingestion (bronze) | schema, file present, row count, parse errors | quarantine bad records; alert |
| Staging (silver) | uniqueness, not null, validity, referential integrity | block promotion to gold |
| Marts (gold) | business rules, reconciliation, anomaly detection on metrics | block or warn + notify owners |

## Severity and actions
- **Error (blocking)**: stop the pipeline / don't publish (e.g. duplicate primary keys in a finance fact).
- **Warning**: publish, alert, track (e.g. null rate slightly above normal).
- **Quarantine**: route bad rows to an error table with reason; process the rest.

## Anomaly detection
Static thresholds miss slow drifts; compare against history: row count ±3σ of the last 30 days, sudden drop in distinct users, metric jumps. Tools: Dataplex data quality, dbt tests + packages, Great Expectations / Soda, Monte Carlo-style observability.

## Data contracts
Agreements with producers on schema, semantics, freshness and quality. Breaking changes are negotiated, not discovered in production.

## Common mistakes
> [!MISTAKE] Checking only that the job succeeded, not that the data is right.

> [!MISTAKE] Too many noisy alerts → people ignore them. Tune severities.

> [!MISTAKE] Fixing data manually in the target without fixing the cause.

=== crisp
**Dimensions:** completeness · uniqueness · validity · accuracy · consistency · timeliness.
- Express checks as queries that should return **zero rows**.
- Uniqueness: `GROUP BY key HAVING COUNT(*) > 1`. Integrity: anti-join to parent. Validity: allowed values / ranges / formats. Freshness: `max(loaded_at)` vs SLA. Volume: row count vs history.
- Check at every layer: ingestion → staging → marts.
- Severity: **error = block**, **warn = alert**, **quarantine = isolate bad rows**.
- Detect anomalies vs history, not only static thresholds.
- Data contracts with producers; fix root causes, not just the target.

=== memory
- **"CUVACT"**: Completeness, Uniqueness, Validity, Accuracy, Consistency, Timeliness.
- **"A good test returns nothing."**
- "Job succeeded" ≠ "data is correct".

=== data
flashcards:
  - q: "Name the six common data quality dimensions."
    a: "Completeness, uniqueness, validity, accuracy, consistency, timeliness."
  - q: "How do you express a uniqueness check in SQL?"
    a: "SELECT key, COUNT(*) FROM t GROUP BY key HAVING COUNT(*) > 1 — should return no rows."
  - q: "What is a freshness check?"
    a: "Verifying the latest data timestamp is within the agreed SLA (e.g. less than 2 hours old)."
  - q: "Block vs warn vs quarantine?"
    a: "Block: stop publishing. Warn: publish and alert. Quarantine: isolate bad rows and process good ones."
  - q: "What is a data contract?"
    a: "An agreement with data producers about schema, meaning, freshness and quality guarantees."
quiz:
  - q: "orders.customer_id values that don't exist in customers violate…"
    options: ["timeliness", "uniqueness", "consistency / referential integrity", "completeness"]
    answer: 2
recall:
  - q: "What data quality checks would you add to a daily orders pipeline, and what happens when they fail?"
    keyPoints:
      - "row count and partition presence"
      - "unique order id"
      - "not null on key columns"
      - "valid status values and non negative amounts"
      - "referential integrity to customers"
      - "freshness"
      - "block, warn or quarantine depending on severity"
exercises:
  - id: def-data-quality-1
    lang: sql
    kind: coding
    difficulty: 2
    title: Uniqueness and integrity checks
    prompt: |
      Write **one query** that returns the problems found in `stg_customers` as rows with two columns: `check_name` and `failing_rows`:
      - `'duplicate_customer_versions'` — number of `customer_id`s with more than one row
      - `'null_email'` — number of rows with NULL email
      - `'unknown_customer'` — number of rows whose customer_id does not exist in `customers`
      Use `UNION ALL`. Order by check_name.
    starter: |
      SELECT 'duplicate_customer_versions' AS check_name, COUNT(*) AS failing_rows
      FROM (SELECT customer_id FROM stg_customers GROUP BY customer_id HAVING COUNT(*) > 1)
      UNION ALL
      -- more checks
    solution: |
      SELECT 'duplicate_customer_versions' AS check_name, COUNT(*) AS failing_rows
      FROM (SELECT customer_id FROM stg_customers GROUP BY customer_id HAVING COUNT(*) > 1)
      UNION ALL
      SELECT 'null_email', COUNT(*) FROM stg_customers WHERE email IS NULL
      UNION ALL
      SELECT 'unknown_customer', COUNT(*) FROM stg_customers s
      WHERE NOT EXISTS (SELECT 1 FROM customers c WHERE c.customer_id = s.customer_id)
      ORDER BY check_name;
    ordered: true
    hints:
      - "Each check is a SELECT returning one row; glue them with UNION ALL."
      - "Unknown customers = anti join."
  - id: def-data-quality-2
    lang: python
    kind: coding
    difficulty: 2
    title: A tiny check framework
    prompt: |
      Write `run_checks(rows)` for order dicts (`order_id`, `amount`, `status`) returning a dict `{check_name: number_of_failures}` for:
      - `unique_order_id` — count of rows whose order_id appeared earlier
      - `non_negative_amount` — rows with amount < 0
      - `valid_status` — rows whose status is not in {"delivered", "shipped", "cancelled", "returned"}
      - `not_null_amount` — rows where amount is None
      (A None amount counts only for not_null_amount.)
    starter: |
      def run_checks(rows):
          pass
    solution: |
      def run_checks(rows):
          allowed = {"delivered", "shipped", "cancelled", "returned"}
          seen, dup = set(), 0
          for r in rows:
              if r["order_id"] in seen:
                  dup += 1
              seen.add(r["order_id"])
          return {
              "unique_order_id": dup,
              "non_negative_amount": sum(1 for r in rows if r["amount"] is not None and r["amount"] < 0),
              "valid_status": sum(1 for r in rows if r["status"] not in allowed),
              "not_null_amount": sum(1 for r in rows if r["amount"] is None),
          }
    tests:
      - call: "run_checks([{'order_id': 1, 'amount': 5, 'status': 'delivered'}, {'order_id': 1, 'amount': -2, 'status': 'lost'}, {'order_id': 2, 'amount': None, 'status': 'shipped'}])"
        expect: "{'unique_order_id': 1, 'non_negative_amount': 1, 'valid_status': 1, 'not_null_amount': 1}"
      - call: "run_checks([])"
        expect: "{'unique_order_id': 0, 'non_negative_amount': 0, 'valid_status': 0, 'not_null_amount': 0}"
        hidden: true
        label: empty batch
  - id: def-data-quality-3
    lang: text
    kind: scenario
    difficulty: 3
    title: The failed uniqueness test
    prompt: |
      At 6:00 your nightly pipeline's test `unique(order_id)` on `fct_orders` fails: 1,240 duplicate order_ids appeared today. The CFO's dashboard refreshes at 8:00. What do you do — immediately and afterwards?
    solution: |
      **Immediately**
      1. **Stop the bleed**: keep `fct_orders` from publishing (blocking test) — the dashboard keeps yesterday's correct data; notify stakeholders that today's numbers are delayed.
      2. **Scope**: which partitions/sources have duplicates? Compare with source counts; check whether a job was retried or a source resent a file.
      3. **Root cause** candidates: a non-idempotent append after a retry, a source sending overlapping extracts, a join fan-out introduced by a code change, CDC replay.
      4. **Fix & rerun**: deduplicate (MERGE on order_id / overwrite the partition) and rerun the affected partition; re-run tests; publish; confirm totals reconcile.

      **Afterwards**
      - Make the load idempotent (MERGE or partition overwrite), add dedup in staging, add a volume anomaly check, write an incident note (cause, impact, fix, prevention).
    review:
      - "Block publishing / keep last good data"
      - "Communicate to stakeholders"
      - "Investigate scope and root cause"
      - "Fix with idempotent reload / dedup and rerun tests"
      - "Prevent recurrence and write a post-mortem"
interview:
  - q: "How do you ensure data quality in your pipelines?"
    type: concept
    level: 2
    keyPoints:
      - "define dimensions: completeness uniqueness validity consistency timeliness"
      - "automated tests at each layer"
      - "severity levels block warn quarantine"
      - "anomaly detection vs history"
      - "alerting and ownership"
      - "data contracts with producers"
  - q: "Your dashboard numbers suddenly dropped by 30%. How do you investigate?"
    type: scenario
    level: 2
    keyPoints:
      - "check whether it is real or a data issue"
      - "freshness: did all partitions load"
      - "row counts by source and day"
      - "recent code or source schema changes"
      - "joins or filters dropping rows"
      - "communicate status to stakeholders"
