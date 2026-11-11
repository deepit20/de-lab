=== lesson
--- step concept: A model is just a SELECT
In dbt each `.sql` file is a **model**: one SELECT statement. dbt wraps it in the DDL to create a view or table.

```sql
-- models/staging/stg_orders.sql
SELECT order_id, customer_id, CAST(amount AS NUMERIC) AS amount, LOWER(status) AS status
FROM {{ source('shop', 'orders') }}
```
```sql
-- models/marts/fct_orders.sql
SELECT o.*, c.segment
FROM {{ ref('stg_orders') }} o
JOIN {{ ref('stg_customers') }} c USING (customer_id)
```
`ref()` links models: dbt builds the **dependency graph (DAG)** from them and runs models in the right order.

--- step concept: Materializations
| Materialization | Result | Use |
|---|---|---|
| `view` | a view | light staging models |
| `table` | rebuilt every run | marts that are fast enough to rebuild |
| `incremental` | inserts/merges only new rows | large facts |
| `ephemeral` | inlined as a CTE | small reusable logic |

[[quiz:etl-dbt:q0]]

--- step example: An incremental model
```sql
{{ config(materialized='incremental', unique_key='order_id') }}
SELECT * FROM {{ ref('stg_orders') }}
{% if is_incremental() %}
WHERE updated_at > (SELECT MAX(updated_at) FROM {{ this }})
{% endif %}
```
First run builds everything; later runs process only new/changed rows and merge them on `unique_key`.

--- step concept: Tests and docs live with the code
```yaml
models:
  - name: fct_orders
    description: One row per order.
    columns:
      - name: order_id
        tests: [unique, not_null]
      - name: customer_id
        tests:
          - relationships: {to: ref('dim_customer'), field: customer_id}
```
`dbt build` runs models **and** their tests; `dbt docs generate` produces a browsable catalog with lineage.

[[quiz:etl-dbt:q1]]

--- step check: Sources, seeds, snapshots
[[quiz:etl-dbt:q2]]

--- step interview: Explain it
[[recall:etl-dbt:r0]]

=== detailed
## What dbt is
dbt (data build tool) handles the **T** of ELT inside the warehouse. You write SELECTs plus YAML; dbt handles DDL, dependency order, incremental logic, testing, documentation and environments. It brings software practices — Git, code review, CI, tests — to SQL.

## Project structure
```text
models/
  staging/      stg_<source>__<table>.sql   (1:1 with sources, renames/casts)
  intermediate/ int_<purpose>.sql
  marts/        fct_<process>.sql, dim_<entity>.sql
seeds/          small CSVs (country codes, mappings)
snapshots/      SCD Type 2 history
tests/          custom SQL tests
macros/         reusable Jinja/SQL
```

## Key concepts
| Concept | Purpose |
|---|---|
| `source()` | declare raw tables; enables freshness checks and lineage |
| `ref()` | reference another model; builds the DAG; resolves schema per environment |
| materializations | view / table / incremental / ephemeral |
| tests | generic (`unique`, `not_null`, `accepted_values`, `relationships`) and singular (custom SQL returning failing rows) |
| seeds | version-controlled CSVs loaded as tables |
| snapshots | track changes to mutable sources → SCD Type 2 with `dbt_valid_from/to` |
| macros & Jinja | reuse SQL, loops, environment logic |
| packages | e.g. `dbt_utils` |

## Incremental strategies (BigQuery)
- `merge` with `unique_key` (default).
- `insert_overwrite` with `partition_by` — replaces affected partitions; cheapest for date-partitioned facts.
- Handle late data with a lookback: `WHERE event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 3 DAY)`.
- `dbt run --full-refresh` rebuilds from scratch after logic changes.

## Commands
- `dbt run` builds models; `dbt test` runs tests; `dbt build` does both in DAG order.
- Selection: `dbt build --select +fct_orders` (model and its parents), `fct_orders+` (and children), `state:modified+` in CI.
- `dbt source freshness` checks source SLAs.

## How it fits with Airflow
Airflow (Composer) ingests raw data and then triggers `dbt build`; dbt manages the in-warehouse DAG. Alternatives on GCP: **Dataform** (Google's native equivalent).

=== crisp
**dbt (data build tool)** turns SQL `SELECT`s into managed warehouse models.
- A **model** = one `.sql` file with a SELECT; dbt wraps it in `CREATE TABLE/VIEW AS`.
- `{{ ref('stg_orders') }}` references another model → dbt builds the **DAG** and runs models in dependency order. `{{ source('crm', 'customers') }}` references raw tables (with freshness checks).
- **Materializations:** `view` (default), `table`, `incremental` (only new/changed rows; `unique_key`, `is_incremental()`), `ephemeral` (inlined CTE).
- **Tests** in YAML: `unique`, `not_null`, `accepted_values`, `relationships` + custom SQL tests (return failing rows). `dbt build` = run + test in DAG order.
- **Snapshots** implement SCD Type 2 (`strategy: timestamp` or `check`).
- **Seeds**: small CSVs (mappings) loaded as tables. **Macros** (Jinja) for reusable SQL. **Docs**: `dbt docs generate` → lineage graph + column descriptions.
- Project layout: `models/staging` → `intermediate` → `marts`; one staging model per source table.
- Environments via targets/profiles (dev dataset per developer, prod in CI/CD). GCP alternative: **Dataform**.

```sql
-- models/marts/fct_orders.sql
{{ config(materialized='incremental', unique_key='order_id') }}
select o.order_id, o.customer_id, o.order_date, o.amount
from {{ ref('stg_orders') }} o
{% if is_incremental() %} where o.updated_at > (select max(updated_at) from {{ this }}) {% endif %}
```

=== memory
- **"ref builds the DAG."**
- **"build = run + test."**
- Snapshot = SCD2 for free.

=== data
flashcards:
  - q: "What does ref() do in dbt?"
    a: "References another model, resolving its table name and creating a dependency so dbt builds models in DAG order."
  - q: "Four dbt materializations?"
    a: "view, table, incremental, ephemeral."
  - q: "How does dbt implement SCD Type 2?"
    a: "Snapshots (timestamp or check strategy) that add dbt_valid_from / dbt_valid_to columns."
  - q: "What does `dbt build` do?"
    a: "Runs models, tests, snapshots and seeds in dependency order, stopping downstream nodes when tests fail."
quiz:
  - q: "Which materialization processes only new rows on each run?"
    options: ["view", "table", "incremental", "ephemeral"]
    answer: 2
  - q: "What does `{{ ref('stg_orders') }}` do?"
    options: ["runs a test", "creates a source table", "deletes the model", "references another model and adds a dependency to the DAG"]
    answer: 3
    explain: "ref() resolves to the right table name for the environment and tells dbt to build stg_orders first."
  - q: "Which dbt feature records how rows in a mutable source change over time (SCD Type 2)?"
    options: ["ephemeral models", "macros", "snapshots", "seeds"]
    answer: 2
    explain: "Snapshots add dbt_valid_from / dbt_valid_to columns to track history."
recall:
  - q: "Explain how dbt works: models, ref, materializations and tests."
    keyPoints:
      - "models are SELECT statements"
      - "ref builds the dependency DAG"
      - "view, table, incremental, ephemeral"
      - "incremental with unique_key or insert_overwrite"
      - "generic tests unique, not_null, relationships, accepted_values"
      - "sources, seeds, snapshots; dbt build"
interview:
  - q: "What is dbt and how does it fit into an ELT architecture?"
    type: concept
    level: 2
    keyPoints:
      - "transformations as SELECT models in the warehouse"
      - "ref builds dependency DAG"
      - "materializations view table incremental"
      - "tests and documentation"
      - "version control and CI/CD"
      - "snapshots for SCD2"
