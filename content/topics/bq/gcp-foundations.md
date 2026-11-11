=== lesson
--- step concept: How GCP is organised
**Organisation → Folders → Projects → Resources**

A **project** is the unit for billing, APIs and permissions. Typical setup: `acme-data-dev`, `acme-data-prod`. Resources — buckets, BigQuery datasets, Composer environments — live inside a project.

Permissions set at a higher level are **inherited** downward.

--- step concept: IAM — who can do what
IAM grants a **role** to a **principal** on a **resource**:
- Principals: users, groups, **service accounts** (identities for programs).
- Roles: bundles of permissions, e.g. `roles/bigquery.dataEditor`, `roles/storage.objectViewer`.

**Least privilege:** grant the smallest role, on the smallest resource, that does the job.

[[quiz:gcp-foundations:q0]]

--- step concept: Regions and multi-regions
Resources live in a **location**: a region (`asia-south1`, Mumbai) or a multi-region (`US`, `EU`). BigQuery can only join datasets in the **same location**, and data residency rules may require a specific region.

[[quiz:gcp-foundations:q1]]

--- step concept: Cloud Storage
GCS stores **objects** in **buckets**: `gs://acme-raw/orders/dt=2025-03-14/part-000.json`. Choose a **storage class** by how often you read data, and add **lifecycle rules** to move or delete old files automatically.

| Class | For | Min. storage duration |
|---|---|---|
| Standard | hot data | none |
| Nearline | ~monthly access | 30 days |
| Coldline | ~quarterly | 90 days |
| Archive | yearly / compliance | 365 days |

[[quiz:gcp-foundations:q2]]

--- step interview: Explain it
[[recall:gcp-foundations:r0]]

=== detailed
## Resource hierarchy
| Level | Purpose |
|---|---|
| Organisation | the company; org policies (e.g. allowed regions) |
| Folder | teams or environments |
| Project | billing, APIs, IAM boundary; separate dev/test/prod |
| Resource | bucket, dataset, table, VM, Composer environment |

Use **separate projects per environment** so a dev mistake can't touch prod data, and costs are visible per environment.

## IAM
- **Basic roles** (Owner, Editor, Viewer) are too broad for production.
- **Predefined roles** fit most needs: `bigquery.dataViewer`, `bigquery.dataEditor`, `bigquery.jobUser`, `storage.objectAdmin`.
- **Custom roles** for special cases.
- Grant to **groups**, not individuals, so joiners/leavers are handled in one place.
- BigQuery permissions can be set at project, dataset, table, and even column (policy tags) level.

## Service accounts
A pipeline should run as its **own service account** (e.g. `orders-pipeline@acme-data-prod.iam.gserviceaccount.com`) with only the roles it needs:
- read the landing bucket → `storage.objectViewer` on that bucket,
- load and query → `bigquery.jobUser` on the project + `bigquery.dataEditor` on the target dataset.

> [!WARN] Avoid downloading service account **keys** (JSON files). They leak into Git and laptops. On GCP, attach the service account to the workload (Composer, Cloud Run) or use Workload Identity.

## Locations
- Region (single place) vs multi-region (several regions in one geography; higher availability).
- BigQuery queries can't join datasets in different locations; plan dataset locations up front.
- Keep GCS buckets and BigQuery datasets in the same location to avoid egress costs and transfer delays.

## Cloud Storage details
- Objects are immutable — "updating" replaces the object; versioning can keep old versions.
- No real folders: `dt=2025-03-14/` is just part of the name, but tools treat it as a folder (and as a **Hive partition** when loading).
- Lifecycle rules: e.g. move raw files to Coldline after 30 days, delete after 400 days.
- Uniform bucket-level access is recommended over per-object ACLs.

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
  - q: "Your BigQuery query joins a dataset in `US` with one in `asia-south1`. What happens?"
    options: ["it works but is slower", "BigQuery copies the data automatically", "it works only on weekends", "the query fails — datasets must be in the same location"]
    answer: 3
    explain: "BigQuery processes a query in one location; copy or recreate the data so both are in the same location."
  - q: "Raw files are read for 2 weeks and then kept only for audits. What should you set up?"
    options: ["Standard class forever", "a cron job on a VM", "a lifecycle rule moving them to a colder class and deleting them later", "manual deletion every month"]
    answer: 2
    explain: "Lifecycle rules change storage class or delete objects automatically by age."
recall:
  - q: "How would you set up GCP projects, IAM and storage for a new data pipeline?"
    keyPoints:
      - "organisation, folders, projects, resources"
      - "separate dev and prod projects"
      - "dedicated service account per pipeline"
      - "least privilege predefined roles, granted to groups"
      - "same location for GCS and BigQuery"
      - "storage classes and lifecycle rules"
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
