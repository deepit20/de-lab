=== lesson
--- step concept: Check data at the door
The cheapest place to catch bad data is **before** it is loaded. A pipeline that loads anything and lets dashboards discover the problem turns a 5-minute fix into a week of distrust.

Validation checks come in layers:
1. **File/batch level** — did the file arrive? Is it empty? Is the row count plausible?
2. **Schema** — expected columns and types present?
3. **Row level** — required fields not null, values in range, valid formats.
4. **Cross-dataset** — keys exist in dimensions, totals reconcile with the source.

--- step practice: A schema contract check
A **data contract** lists the columns a producer promises. Required columns missing → stop. Unknown extra columns → warn.

[[exercise:etl-validation-1]]

--- step concept: Fail, quarantine or warn?
- **Fail the run** — when the batch is unusable (missing required column, empty file, row count down 90%).
- **Quarantine** bad rows — move them to an error table with the reason, load the rest.
- **Warn** — log/alert for soft problems (a new category value) and continue.

[[quiz:etl-validation:q0]]
[[quiz:etl-validation:q1]]

--- step check: Tools
[[quiz:etl-validation:q2]]

--- step interview: Explain it
[[recall:etl-validation:r0]]

=== detailed
## Types of checks
| Check | Example | Typical action |
|---|---|---|
| freshness | file for today exists; max(updated_at) within 2 h | fail / alert |
| volume | row count within ±30% of the 7-day average | fail or warn |
| schema | required columns present, types parse | fail |
| completeness | `order_id`, `amount` not null | quarantine rows |
| uniqueness | one row per `order_id` | fail or dedupe |
| validity | `amount >= 0`, status in allowed set, email format | quarantine |
| referential integrity | `customer_id` exists in `dim_customer` | unknown member + alert |
| reconciliation | warehouse revenue = source system revenue | alert |

## Data contracts
A contract (often YAML) owned with the producing team:
```yaml
dataset: orders
owner: checkout-team
columns:
  order_id: {type: integer, required: true, unique: true}
  amount:   {type: numeric, required: true, min: 0}
  status:   {type: string, allowed: [placed, paid, shipped, delivered, cancelled, returned]}
freshness: 2h
```
The pipeline validates every batch against it; breaking changes need a version bump and notice.

## Quarantine pattern
- Valid rows → target; invalid rows → `errors.orders_rejected` with `reason`, `batch_id`, `raw_row`.
- Alert when rejected rows exceed a threshold (e.g. > 1%).
- Reprocess quarantined rows after fixes.

## Where validation runs
- In Python during ingestion (pydantic, pandera, custom checks).
- In SQL after loading to staging (dbt tests, assertions in Dataform, BigQuery `ASSERT`).
- As dedicated tools: Great Expectations / Soda, Dataplex data quality.

## Write-audit-publish
1. **Write** the new data to a staging table or branch.
2. **Audit** it with the checks.
3. **Publish** (swap/merge into the production table) only if checks pass — consumers never see bad data.

> [!WARN] Silent coercion is validation's enemy — `SAFE_CAST` turning every bad amount into NULL without counting them hides the problem. Count and report what you coerce.

=== crisp
**Validate at the boundaries:**
1. **Before load (ingestion):** file/partition exists, non-empty, schema matches (columns, types, order), encoding, row count within expected range, parse error rate.
2. **After load (staging):** keys unique & not null, referential integrity, accepted values, ranges, freshness.
3. **Before publishing (marts):** business rules, reconciliation with source totals, anomaly detection on metrics.

**Patterns:**
- **Write-Audit-Publish (WAP):** write to a staging/branch table → run checks → publish (swap/insert) only if they pass. Consumers never see bad data.
- **Quarantine:** route invalid rows to `<table>_rejects` with `reason`, `raw_payload`, `ingested_at`; alert if reject rate > threshold.
- **Schema checks:** compare incoming columns to the expected contract; new optional columns → warn; missing/renamed/type-changed → fail.
- **Data contracts:** producers publish schema + semantics + SLAs; CI checks breaking changes.

**Tools:** dbt tests (`unique`, `not_null`, `accepted_values`, `relationships`, dbt-expectations), Great Expectations / Soda, Dataplex data quality, BigQuery `ASSERT` statements in scripts.

=== memory
- **"Write, Audit, Publish."**
- **"Quarantine, don't delete."**

=== data
flashcards:
  - q: "What is the Write-Audit-Publish pattern?"
    a: "Write data to a staging area, run quality checks, and publish to consumers only if checks pass."
  - q: "What goes in a reject/quarantine table?"
    a: "The invalid record (raw), the reason, source and timestamps — so it can be fixed and reprocessed."
  - q: "Name four built-in dbt tests."
    a: "unique, not_null, accepted_values, relationships."
quiz:
  - q: "An incoming file is missing the `amount` column. Best action?"
    options: ["Load it anyway", "Fail the load and alert — breaking schema change", "Fill amount with 0", "Silently skip the file"]
    answer: 1
  - q: "3 of 50,000 rows have a negative amount. Best default action?"
    options: ["ignore it", "quarantine the 3 rows with a reason and load the rest", "fail the whole pipeline every time", "set them to 0 silently"]
    answer: 1
    explain: "Quarantining keeps good data flowing while making bad rows visible and fixable."
  - q: "In the write-audit-publish pattern, consumers see new data…"
    options: ["only after it passes the checks", "as soon as it is written", "before checks run", "never"]
    answer: 0
    explain: "Data is written to staging, audited, and published only when the audit passes."
recall:
  - q: "What validation checks would you add to an ingestion pipeline and how do you decide to fail, quarantine or warn?"
    keyPoints:
      - "freshness and volume checks"
      - "schema contract: required columns and types"
      - "row-level: not null, ranges, allowed values"
      - "uniqueness and referential integrity"
      - "fail for unusable batches, quarantine bad rows, warn for soft issues"
      - "write-audit-publish"
exercises:
  - id: etl-validation-1
    lang: python
    kind: coding
    difficulty: 2
    title: Schema contract check
    prompt: |
      Write `check_schema(header, contract)` where `header` is the list of incoming column names and `contract` is a dict `{column: required_bool}`. Return a dict with:
      - `missing_required` — sorted required columns not in header
      - `missing_optional` — sorted optional columns not in header
      - `unexpected` — sorted header columns not in the contract
      - `ok` — True if no required columns are missing
    starter: |
      def check_schema(header, contract):
          pass
    solution: |
      def check_schema(header, contract):
          h = set(header)
          missing_required = sorted(c for c, req in contract.items() if req and c not in h)
          missing_optional = sorted(c for c, req in contract.items() if not req and c not in h)
          unexpected = sorted(h - set(contract))
          return {"missing_required": missing_required, "missing_optional": missing_optional, "unexpected": unexpected, "ok": not missing_required}
    tests:
      - call: "check_schema(['order_id', 'amount', 'promo'], {'order_id': True, 'amount': True, 'channel': False})"
        expect: "{'missing_required': [], 'missing_optional': ['channel'], 'unexpected': ['promo'], 'ok': True}"
      - call: "check_schema(['order_id'], {'order_id': True, 'amount': True})['ok']"
        expect: "False"
interview:
  - q: "How do you prevent bad data from reaching dashboards?"
    type: design
    level: 2
    keyPoints:
      - "validation at ingestion staging and marts"
      - "write audit publish"
      - "blocking tests for critical checks"
      - "quarantine invalid rows"
      - "schema contracts"
      - "alerting and ownership"
