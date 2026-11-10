=== crisp
**Data warehouse** (Inmon's definition): a **subject-oriented, integrated, time-variant, non-volatile** collection of data supporting decisions.
- Subject-oriented: organised around business subjects (sales, customers), not applications.
- Integrated: consistent keys, codes and units across sources.
- Time-variant: keeps history.
- Non-volatile: loaded and read, not updated transactionally.

| | Kimball (bottom-up) | Inmon (top-down) |
|---|---|---|
| Core | dimensional data marts per business process, linked by **conformed dimensions** (bus architecture) | normalised (3NF) enterprise data warehouse, marts derived from it |
| Speed to value | fast, incremental | slower, big upfront design |
| Strength | usability, performance | integration, single version of truth |

**Data Vault** (hubs, links, satellites) — a third, audit-friendly approach for many changing sources.

**Layers:** sources → staging (raw copy) → integration/core → presentation marts → BI. Modern ELT does this **inside** the cloud warehouse (dbt).

=== memory
- Inmon's four: **S-I-T-N** — "Subject, Integrated, Time-variant, Non-volatile."
- **Kimball builds marts that share dimensions; Inmon builds the warehouse first.**

=== data
flashcards:
  - q: "Four characteristics of a data warehouse (Inmon)?"
    a: "Subject-oriented, integrated, time-variant, non-volatile."
  - q: "Kimball vs Inmon in one line?"
    a: "Kimball: bottom-up dimensional marts with conformed dimensions. Inmon: top-down normalised EDW feeding marts."
  - q: "What is a data mart?"
    a: "A subject-specific subset of the warehouse for a business area (e.g. sales mart)."
quiz:
  - q: "'Conformed dimensions' are central to which approach?"
    options: ["Inmon", "Kimball", "OLTP design", "Data swamp"]
    answer: 1
interview:
  - q: "Compare the Kimball and Inmon approaches to data warehousing."
    type: concept
    level: 2
    keyPoints:
      - "Kimball bottom up dimensional marts"
      - "conformed dimensions and bus matrix"
      - "Inmon top down normalised enterprise warehouse"
      - "trade-off speed vs integration"
      - "modern hybrids with ELT layers"
