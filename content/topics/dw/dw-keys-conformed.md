=== lesson
--- step concept: Natural keys vs surrogate keys
- A **natural key** comes from the source: `customer_id = 'C-1042'`, an email, a PAN.
- A **surrogate key** is a meaningless id the warehouse creates: `customer_sk = 58213`.

Why bother? With **SCD Type 2** the same customer has several rows (one per version of their address). The natural key repeats; each version needs its own key so facts point to the version that was true **at the time**.

[[quiz:dw-keys-conformed:q1]]

--- step concept: Late and unknown members
Facts sometimes arrive before their dimension row (a sale for a customer created 5 minutes ago). Don't drop the fact:
- point it to a special **"Unknown" member** (`customer_sk = -1`), or
- insert an **inferred member** placeholder and fill in details when the dimension arrives.

[[quiz:dw-keys-conformed:q0]]

--- step concept: Conformed dimensions
A **conformed dimension** means the same thing — same keys, same attributes, same values — in every fact table that uses it. `dim_date` and `dim_customer` shared by sales, returns and support facts let you compare them in one report ("drill across").

--- step concept: The bus matrix
A grid of **business processes** (rows) × **dimensions** (columns). A tick says the process uses that dimension. It's the plan that keeps every new star schema compatible with the others.

| Process | Date | Customer | Product | Store |
|---|---|---|---|---|
| Sales | ✔ | ✔ | ✔ | ✔ |
| Returns | ✔ | ✔ | ✔ | ✔ |
| Inventory | ✔ |  | ✔ | ✔ |

[[quiz:dw-keys-conformed:q2]]

--- step interview: Explain it
[[recall:dw-keys-conformed:r0]]

=== detailed
## Natural vs surrogate keys
| | Natural key | Surrogate key |
|---|---|---|
| Source | business system | warehouse |
| Meaning | has business meaning | none |
| Stability | can change, be reused, differ between sources | stable, owned by you |
| SCD2 | repeats for each version | unique per version |
| Joins | often strings, composite | small integers or hashes |

Generating surrogates:
- Sequences/identity columns in databases.
- In BigQuery/dbt: a **hash** of the natural key + version start date, e.g. `FARM_FINGERPRINT(CONCAT(customer_id, '|', CAST(valid_from AS STRING)))`, or `dbt_utils.generate_surrogate_key`.

Keep the natural key as a column too — it's how you match incoming source rows.

## Unknown and late-arriving members
- Pre-load special rows: `-1 Unknown`, `-2 Not applicable`.
- Fact load: `COALESCE(d.customer_sk, -1)` after a LEFT JOIN on the natural key.
- **Inferred members:** insert a stub dimension row with just the natural key; update it when the real data arrives (for SCD2, the stub becomes the first version).
- Monitor how many facts point to Unknown — a rising count means a broken upstream feed.

## Conformed dimensions
- Built **once**, reused by all facts.
- Same grain, keys, attribute names and values (e.g. `country = 'India'`, not `IN` in one mart and `India` in another).
- Subsets are allowed ("shrunken" dimensions such as `dim_month` from `dim_date`).
- They enable **drill-across** queries: aggregate each fact to the shared dimension, then join the results.

## Enterprise bus matrix
- Rows: business processes (each becomes a fact table).
- Columns: conformed dimensions.
- Used for planning, prioritising and spotting where a dimension must be agreed across teams.

> [!REAL] In interviews, "why surrogate keys?" has three answers: SCD2 history, independence from source key changes, and integrating several sources that use different ids for the same customer.

=== crisp
- **Natural (business) key**: the source system's identifier (customer_id `C-1027`). **Surrogate key**: warehouse-generated key (integer sequence or hash) for each dimension row.
- Why surrogates: SCD2 needs one key per version · integrate several sources whose natural keys collide · insulate from source key changes/reuse · smaller join keys.
- In BigQuery, sequences don't exist → use **hash keys**: `FARM_FINGERPRINT(CONCAT(source, '|', natural_key))` or `TO_HEX(MD5(...))` — deterministic, so reloads are idempotent. (For SCD2 versions include `valid_from` in the hash.)
- **Unknown member** rows (`sk = -1, name = 'Unknown'`) so facts with missing/late dimensions still join (no lost rows from INNER joins).
- **Conformed dimension**: one shared definition (same keys, attributes, values) used by many fact tables — enables drilling across processes (sales vs returns by the same `dim_product`).
- **Enterprise bus matrix**: rows = business processes (orders, returns, payments, web sessions), columns = dimensions (date, customer, product, store) → ✓ where used. The roadmap for an integrated warehouse.

=== memory
- **"Natural keys come from the source; surrogate keys belong to the warehouse."**
- **"Conformed = same dimension, everywhere."**

=== data
flashcards:
  - q: "Why use surrogate keys in dimensions?"
    a: "To version rows (SCD2), integrate multiple sources, and be independent of source key changes."
  - q: "How do you create surrogate keys in BigQuery deterministically?"
    a: "Hash the source + natural key (FARM_FINGERPRINT / MD5) instead of random UUIDs."
  - q: "What is a conformed dimension?"
    a: "A dimension with the same keys and attributes shared across multiple fact tables / marts."
  - q: "What is the bus matrix?"
    a: "A grid of business processes vs dimensions showing which conformed dimensions each fact uses."
  - q: "Why add an 'unknown' member row?"
    a: "So facts whose dimension value is missing or late still join instead of disappearing."
quiz:
  - q: "Facts loaded before their customer exists in dim_customer should…"
    options: ["be dropped", "reference an unknown/inferred member and be fixed later", "wait forever", "use NULL and INNER JOIN"]
    answer: 1
  - q: "Why does an SCD Type 2 dimension need surrogate keys?"
    options: ["to save storage", "each historical version of an entity needs its own unique key", "natural keys are always integers", "BigQuery requires it"]
    answer: 1
    explain: "The natural key repeats across versions, so facts need a key that identifies the version valid at that time."
  - q: "What does a bus matrix show?"
    options: ["which business processes use which conformed dimensions", "the network topology", "query costs per team", "the order tasks run in"]
    answer: 0
    explain: "Rows are processes (facts), columns are shared dimensions."
recall:
  - q: "Explain surrogate keys, unknown members and conformed dimensions."
    keyPoints:
      - "natural key from source, surrogate key from warehouse"
      - "surrogates needed for SCD2 versions"
      - "unknown member -1 for late facts"
      - "inferred members updated later"
      - "conformed dimensions shared across facts enable drill-across"
      - "bus matrix plans processes vs dimensions"
interview:
  - q: "What are surrogate keys and why are they used instead of natural keys in a warehouse?"
    type: concept
    level: 2
    keyPoints:
      - "warehouse generated key"
      - "supports SCD type 2 versions"
      - "integrates multiple sources"
      - "protects from source key changes"
      - "deterministic hash keys in BigQuery"
