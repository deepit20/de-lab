=== lesson
--- step concept: Data people can find, trust and safely use
Governance answers four questions:
- **What data do we have?** → catalog and metadata
- **Where did it come from, what uses it?** → lineage
- **Who may see it?** → access control and PII handling
- **What is promised about it?** → data contracts and quality rules

--- step concept: Metadata and lineage
**Metadata** is data about data: owner, description, schema, freshness, tags like `pii`. A **catalog** (Dataplex, DataHub) makes it searchable.

**Lineage** maps the flow: `raw.orders → stg_orders → fct_orders → revenue_dashboard`. Before changing a column you check what's **downstream** of it.

[[quiz:def-governance:q0]]

--- step concept: Protecting PII
Personally identifiable information — names, emails, phones, addresses, IDs — needs:
- **Least-privilege access**: only roles that need it can see it.
- **Masking**: show `d*****@gmail.com` to most users.
- **Hashing/tokenising**: `SHA256(email)` keeps a joinable key without the raw value.
- **Retention**: delete when it's no longer needed (and on user request).

[[quiz:def-governance:q1]]

--- step scenario: Sharing customer data with marketing
[[exercise:def-governance-1]]

--- step check: Data contracts
[[quiz:def-governance:q2]]

--- step interview: Explain it
[[recall:def-governance:r0]]

=== detailed
## Why governance matters
Without it, the same metric is computed five ways, nobody knows if a table is still updated, a column rename breaks ten dashboards, and personal data leaks to people who shouldn't see it. Regulations (GDPR, India's DPDP Act) make some of this legally required.

## Building blocks
| Block | What it is | GCP / tools |
|---|---|---|
| catalog | searchable inventory of datasets with descriptions, owners, tags | Dataplex Catalog, DataHub, dbt docs |
| lineage | graph of which jobs read/write which tables/columns | Dataplex lineage, dbt DAG, OpenLineage |
| access control | who can read which data | IAM, authorized views, row-level security, column-level policy tags |
| quality | rules and tests on the data | dbt tests, Dataplex data quality, Great Expectations |
| contracts | producer–consumer agreement on schema and semantics | YAML contracts, schema registry |
| retention | how long data is kept | table/partition expiration, GCS lifecycle rules |

## PII techniques
- **Classify** columns (`pii: email`) so policies can be automatic.
- **Column-level security** with BigQuery policy tags: only a fine-grained reader role sees raw values.
- **Dynamic data masking**: other users see masked values automatically.
- **Authorized views**: share a view exposing only safe columns, without granting access to the base table.
- **Row-level security**: e.g. regional managers see only their region.
- **Pseudonymise** with hashing (add a secret salt) when analysts need to count or join people but not identify them.

## Data contracts
A contract states: schema (names, types, nullability), meaning of fields, freshness/SLA, allowed values, and how changes are communicated. Breaking changes require a new version, not a silent rename.

> [!REAL] Most "data incidents" are not crashes; they are a source team renaming `amount` to `amount_inr` without telling anyone. Contracts plus lineage turn that into a reviewed change instead of a broken dashboard.

=== crisp
- **Metadata & catalog**: what datasets exist, what columns mean, owner, freshness, sensitivity (GCP: Dataplex / Data Catalog).
- **Lineage**: which sources and jobs produce a table/column, and what depends on it → impact analysis before changes, root-cause during incidents.
- **Access control**: least privilege, role/group-based, dataset/table/column/row-level security (BigQuery authorized views, policy tags, row access policies).
- **PII handling**: classify sensitive columns; minimise collection; mask, tokenise or hash (salted) where analysis doesn't need raw values; encrypt; restrict; set retention and deletion (GDPR/DPDP "right to erasure").
- **Data contracts**: producer–consumer agreements on schema, semantics, SLAs; breaking changes are versioned and announced.
- **Auditability**: who accessed or changed what (Cloud Audit Logs).

=== memory
- **"Know it (catalog), trace it (lineage), guard it (access), respect it (PII)."**
- Hashing ≠ anonymising — unsalted hashes of emails/phones can be reversed by lookup.

=== data
flashcards:
  - q: "What is data lineage used for?"
    a: "Understanding where data comes from and what depends on it — impact analysis and debugging."
  - q: "Name three ways to protect PII in a warehouse."
    a: "Column-level security/policy tags, masking or tokenisation, salted hashing, row-level policies, retention limits."
  - q: "Why is an unsalted hash of a phone number weak protection?"
    a: "The input space is small — attackers can hash all possible numbers and match."
quiz:
  - q: "Before renaming a column in a shared table, the most useful tool is…"
    options: ["a bigger warehouse", "lineage / impact analysis", "more indexes", "a CSV export"]
    answer: 1
  - q: "Analysts need to count unique customers but must not see emails. Best approach?"
    options: ["export to a spreadsheet", "expose a salted hash of the email instead of the raw value", "give them the raw table and ask them not to look", "delete the email column everywhere"]
    answer: 1
    explain: "A salted hash is a stable joinable key without revealing the personal value."
  - q: "A data contract between a source team and the data team should include…"
    options: ["schema, meaning, freshness and how breaking changes are announced", "only the table name", "the dashboard colours", "the source team's passwords"]
    answer: 0
    explain: "Contracts make expectations explicit so changes are negotiated instead of discovered."
recall:
  - q: "What does data governance cover and how would you protect PII in BigQuery?"
    keyPoints:
      - "catalog and metadata"
      - "lineage for impact analysis"
      - "least-privilege access"
      - "policy tags, masking, authorized views, row-level security"
      - "hashing or tokenising identifiers"
      - "retention and data contracts"
exercises:
  - id: def-governance-1
    lang: text
    kind: scenario
    difficulty: 2
    title: Sharing customer data with marketing
    prompt: |
      Marketing analysts need customer-level purchase behaviour in BigQuery for segmentation, but must not see emails or phone numbers. Support staff need emails for a small set of customers. Propose a design.
    solution: |
      - Tag `email`, `phone` with **policy tags** (column-level security); only the support group gets the Fine-Grained Reader role.
      - Give marketing an **authorized view** / dataset exposing a **pseudonymous customer key** (salted hash or surrogate key) plus behaviour columns — no direct identifiers.
      - Optionally **dynamic data masking** so masked values appear for unauthorised users.
      - Row-level policies if regions must be separated.
      - Document in the catalog; audit access with Cloud Audit Logs; retention rules for raw PII.
    review:
      - "Column-level security / policy tags on PII"
      - "Pseudonymous key for analysis"
      - "Authorized views or masking for marketing"
      - "Least-privilege access for support"
      - "Auditing and documentation"
interview:
  - q: "How do you handle PII in a data platform?"
    type: concept
    level: 2
    keyPoints:
      - "identify and classify sensitive data"
      - "minimise and restrict access"
      - "mask tokenise or hash with salt"
      - "column and row level security"
      - "retention and deletion policies"
      - "audit logs"
