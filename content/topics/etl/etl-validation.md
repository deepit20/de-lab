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
