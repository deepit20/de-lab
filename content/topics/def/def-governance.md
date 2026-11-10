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
