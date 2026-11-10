=== crisp
- Resource hierarchy: **Organization → Folders → Projects → Resources** (datasets, buckets, VMs). Billing and IAM attach to projects (and inherit downward).
- **IAM**: *who* (principal: user, group, **service account**) gets *which role* (set of permissions) on *which resource*. Use **predefined roles** (e.g. `roles/bigquery.dataViewer`, `roles/bigquery.jobUser`), groups instead of individuals, **least privilege**.
- **Service accounts** are identities for pipelines (Airflow/Composer, Cloud Run jobs). Prefer attached SAs / Workload Identity over downloaded JSON keys.
- **Regions** (asia-south1 = Mumbai) and **multi-regions** (US, EU). Keep compute and data co-located; BigQuery datasets can't be joined across locations; data residency rules.
- **Cloud Storage (GCS)**: buckets of objects; classes **Standard / Nearline (30d) / Coldline (90d) / Archive (365d)** — cheaper storage, higher retrieval cost; **lifecycle rules** (e.g. move raw files to Coldline after 90 days, delete after 2 years); object versioning; uniform bucket-level access.
- Typical DE bucket layout: `gs://<co>-raw/<source>/<entity>/ingest_date=YYYY-MM-DD/…`.

=== memory
- **"Who, what role, on what."**
- Storage classes by minimum days: **Standard 0, Nearline 30, Coldline 90, Archive 365.**

=== data
flashcards:
  - q: "GCP resource hierarchy?"
    a: "Organization → folders → projects → resources."
  - q: "What is a service account?"
    a: "A non-human identity used by applications/pipelines to call GCP APIs."
  - q: "GCS storage classes and when to use them?"
    a: "Standard (hot), Nearline (~monthly access), Coldline (~quarterly), Archive (~yearly / compliance)."
  - q: "What is least privilege?"
    a: "Granting only the minimum permissions needed for a task."
  - q: "Can you join BigQuery datasets in different locations?"
    a: "No — datasets must be in the same location (copy data first)."
quiz:
  - q: "An Airflow DAG must load files from GCS into BigQuery. Which identity should it use?"
    options: ["A developer's personal account", "A dedicated service account with minimal roles", "The project owner", "An anonymous user"]
    answer: 1
interview:
  - q: "How do you set up permissions for a pipeline that reads from GCS and writes to BigQuery?"
    type: design
    level: 2
    keyPoints:
      - "dedicated service account"
      - "storage object viewer on the bucket"
      - "BigQuery data editor on target dataset and job user on project"
      - "least privilege, no owner roles"
      - "avoid key files, use workload identity"
