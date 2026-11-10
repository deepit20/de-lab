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
