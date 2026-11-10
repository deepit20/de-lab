=== crisp
- **IaaS** (VMs: Compute Engine) → **PaaS** (managed platforms: Cloud SQL, Dataproc) → **Serverless** (no servers to manage, pay per use: BigQuery, Cloud Run, Cloud Functions, Dataflow) → **SaaS** (finished apps).
- Storage kinds: **object** (GCS — files/blobs, cheap, infinitely scalable, the data lake), **block** (VM disks), **databases** (Cloud SQL/Spanner for OLTP, BigQuery for OLAP).
- **Separation of storage and compute**: data lives in cheap storage; compute scales up/down independently (BigQuery slots, ephemeral Dataproc clusters).
- **Elasticity**: provision for the job, not the peak; autoscaling.
- **Cost is an engineering metric**: you pay for bytes scanned, compute time, storage, egress. Tag/label resources, set budgets & alerts, choose pricing models (on-demand vs reserved).
- **Shared responsibility**: provider secures the infrastructure; you secure identities, access, data and configuration.
- Regions & zones: put compute near data; multi-region for durability; data residency rules.

=== memory
- **"Serverless = you bring the code/SQL, they bring the servers."**
- **"Storage is cheap, compute is rented, egress is a toll."**

=== data
flashcards:
  - q: "What does separation of storage and compute enable?"
    a: "Scaling and paying for compute independently of data size; many engines on the same data."
  - q: "Object storage example and typical use?"
    a: "Google Cloud Storage — data lake files, raw landing, archives."
  - q: "What is serverless in data engineering?"
    a: "Managed services where you don't provision servers and pay per use, e.g. BigQuery, Cloud Run, Dataflow."
quiz:
  - q: "Which is serverless?"
    options: ["A Compute Engine VM", "BigQuery", "A self-managed Hadoop cluster", "An on-prem server"]
    answer: 1
interview:
  - q: "What are the advantages of cloud data warehouses over on-premise systems?"
    type: concept
    level: 1
    keyPoints:
      - "elastic scaling"
      - "separation of storage and compute"
      - "managed operations no hardware"
      - "pay per use"
      - "integration with cloud services"
      - "need for cost governance"
