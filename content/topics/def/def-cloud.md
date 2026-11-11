=== lesson
--- step concept: Renting instead of owning
The cloud lets you rent computers, storage and managed services by the second instead of buying servers. The question is **how much you manage yourself**:

| Model | You manage | Example |
|---|---|---|
| IaaS | OS, software, scaling | Compute Engine VM |
| PaaS | your code/config | Cloud Composer, Dataproc |
| Serverless | just the job | BigQuery, Cloud Run, Dataflow |
| SaaS | nothing — you just use it | Looker, Google Sheets |

[[quiz:def-cloud:q0]]

--- step concept: Three kinds of storage
- **Object storage** (GCS, S3): files of any size addressed by a path. Cheap, durable, unlimited — the **data lake**.
- **Block storage** (persistent disks): a hard drive attached to one VM.
- **Databases/warehouses** (Cloud SQL, BigQuery): structured data you query.

[[quiz:def-cloud:q1]]

--- step concept: Storage and compute are separate
In BigQuery, data sits in storage and a pool of compute is borrowed **only while a query runs**. You can store petabytes cheaply and pay for compute only when you use it — and many teams can query the same data at once.

--- step check: Cost is an engineering metric
[[quiz:def-cloud:q2]]

--- step interview: Explain it
[[recall:def-cloud:r0]]

=== detailed
## Why the cloud for data
- **Elastic**: scale to a thousand workers for one hour, then back to zero.
- **Managed services** remove patching, backups and capacity planning.
- **Pay as you go**: no upfront hardware.
- **Global**: regions close to users and data residency options.

## Service models
| | IaaS | PaaS | Serverless | SaaS |
|---|---|---|---|---|
| Unit you rent | VM | platform/cluster | request, query, job | application seat |
| Scaling | you | partly you | automatic | vendor |
| Idle cost | yes | yes | ~none | subscription |
| GCP | Compute Engine | Composer, Dataproc, Cloud SQL | BigQuery, Cloud Run, Functions, Dataflow | Looker, Workspace |

## Storage types
| | Object (GCS) | Block (Persistent Disk) | Warehouse (BigQuery) |
|---|---|---|---|
| Access | HTTP API by path | mounted file system on a VM | SQL |
| Best for | raw files, lake, backups, exports | VM's operating system and local data | analytics |
| Scale | unlimited | fixed size | petabytes |

## Separation of storage and compute
Traditional databases bundle disk and CPU in one server — to get more CPU you buy more disk. Cloud warehouses separate them: storage is replicated and cheap; compute is a shared pool allocated per query. Results: independent scaling, many concurrent teams, and the cost model "bytes scanned" or "slot hours".

## Cost as an engineering metric
- Know the **pricing unit**: BigQuery on-demand bills bytes scanned; Dataproc bills VM time; GCS bills GB-month plus operations and egress.
- Biggest wins: partition and cluster tables, avoid `SELECT *`, delete or expire old data, shut down idle clusters, use storage classes.
- Set **budgets and alerts**, label resources by team/pipeline.

> [!REAL] Interviewers ask "how would you reduce cost?" — answer with the pricing unit first ("BigQuery charges by bytes scanned, so…") then the levers.

> [!WARN] **Egress** — moving data out of a region or out of the cloud — is often the hidden line on the bill. Keep compute in the same region as the data.

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
  - q: "Where would you keep raw JSON files landed from an API before loading them?"
    options: ["Cloud SQL", "Object storage like Cloud Storage", "A VM's boot disk", "A spreadsheet"]
    answer: 1
    explain: "Object storage is cheap, durable and scales without limits — the standard landing zone."
  - q: "Why does separating storage and compute matter?"
    options: ["you can store lots of data cheaply and pay for compute only while queries run", "it makes data smaller", "it removes the need for SQL", "it guarantees zero cost"]
    answer: 0
    explain: "Each side scales and is billed independently; many users can query the same data."
recall:
  - q: "Explain IaaS, PaaS and serverless with GCP examples and how you'd keep cloud data costs under control."
    keyPoints:
      - "IaaS VMs, PaaS managed platforms, serverless per job"
      - "object vs block vs warehouse storage"
      - "separation of storage and compute"
      - "know the pricing unit"
      - "partitioning, lifecycle rules, idle clusters"
      - "budgets, labels, egress"
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
