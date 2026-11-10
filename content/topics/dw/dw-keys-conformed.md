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
