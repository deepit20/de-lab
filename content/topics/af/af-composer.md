=== lesson
--- step concept: Composer is managed Airflow
**Cloud Composer** runs Airflow for you on Google Kubernetes Engine: scheduler, workers, web UI, metadata database, upgrades and scaling. You bring the DAGs.

Each **environment** has an Airflow version, a service account, a region, Python packages, and its own **GCS bucket**.

--- step concept: DAGs live in a bucket
```text
gs://<env-bucket>/dags/orders_dag.py      ← DAG files (synced to scheduler and workers)
gs://<env-bucket>/dags/sql/fct_orders.sql
gs://<env-bucket>/plugins/
gs://<env-bucket>/data/                   ← shared files
```
Copy a file into `dags/` and within a minute or two the scheduler picks it up.

[[quiz:af-composer:q0]]

--- step concept: Packages, connections and identity
- Install PyPI packages per environment (pinned versions!).
- Tasks run as the environment's **service account** — grant it only the roles the DAGs need.
- Store secrets in **Secret Manager** and enable it as the Airflow secrets backend.

[[quiz:af-composer:q1]]

--- step concept: CI/CD for DAGs
A pull request triggers CI:
1. **Lint** (ruff/flake8) and unit tests.
2. **DAG import test** — load every DAG with `DagBag`, fail on import errors or cycles.
3. On merge: **deploy** — `gsutil rsync` (or `gcloud composer environments storage dags import`) the `dags/` folder to the dev environment, then prod.

[[quiz:af-composer:q2]]

--- step interview: Explain it
[[recall:af-composer:r0]]

=== detailed
## Architecture
| Component | Role |
|---|---|
| scheduler | parses DAGs, creates task instances |
| workers (GKE pods) | run tasks; autoscale |
| triggerer | runs deferrable operators' async waits |
| web server | Airflow UI |
| metadata DB (Cloud SQL) | DAG runs, task states, XComs |
| environment bucket (GCS) | `dags/`, `plugins/`, `data/`, logs |

Composer 2/3 autoscale workers and charge for the environment's compute even when idle, so right-size environments and avoid one per developer.

## Environments
- Choose region close to your data (same as BigQuery datasets/GCS buckets).
- Separate **dev** and **prod** environments (often in separate projects).
- Airflow and Composer versions are upgraded deliberately; test DAGs on the new version first.
- Configuration overrides (`core.parallelism`, etc.), env vars, and PyPI packages per environment.

## Identity and secrets
- Environment service account runs tasks: grant `bigquery.jobUser`, `bigquery.dataEditor` on target datasets, `storage.objectViewer` on sources — not Editor.
- Secret Manager backend: secret `airflow-connections-orders_db` becomes connection `orders_db`.
- Avoid service-account key files in the bucket.

## Deploying DAGs
```bash
gcloud composer environments storage dags import \
  --environment prod-composer --location asia-south1 --source dags/
```
- Keep DAGs in Git; deploy only from CI after tests pass.
- Import test example:
```python
from airflow.models import DagBag
def test_no_import_errors():
    bag = DagBag(dag_folder="dags/", include_examples=False)
    assert bag.import_errors == {}
```
- Promote dev → prod via the same pipeline with different variables.

## Operating
- Logs per task in Cloud Logging and the UI; monitoring dashboards in the Composer console.
- Watch DAG parse time (heavy top-level code), scheduler heartbeat, worker CPU/memory, queued tasks.
- Push heavy processing to BigQuery/Dataflow/Dataproc; Composer workers should mostly wait.

> [!REAL] "Composer vs Cloud Scheduler + Cloud Run?" — Composer for many interdependent tasks, retries, backfills and visibility; lighter tools for a handful of independent scheduled jobs.

=== crisp
- **Cloud Composer** = Google-managed Apache Airflow running on **GKE**; Google manages scheduler, workers (autoscaling), web UI, metadata DB (Cloud SQL) and upgrades.
- DAG files live in the environment's **GCS bucket** (`gs://<env-bucket>/dags/`); Composer syncs them to Airflow. Plugins/data in sibling folders.
- Environment config: Airflow version, **PyPI packages**, environment variables, worker size/count, private IP networking.
- Identity: the environment's **service account** runs tasks → grant least-privilege roles (BigQuery job user/data editor, GCS object access). Use **Secret Manager** as the secrets backend for connections.
- GCP operators: `BigQueryInsertJobOperator`, `GCSToBigQueryOperator`, `DataprocSubmitJobOperator`, `DataflowStartFlexTemplateOperator`, `CloudRunExecuteJobOperator`…
- **CI/CD for DAGs**: lint (ruff/flake8), unit tests + DagBag import test → deploy by syncing to the bucket (`gcloud composer environments storage dags import` or `gsutil rsync`) from main; separate dev/prod environments.
- Cost: an environment runs 24×7 (scheduler, DB, web) even when idle — consolidate DAGs, right-size workers.

=== memory
- **"Composer = Airflow + GKE + a GCS dags/ folder."**
- Deploy = **copy files to the bucket**, test before you copy.

=== data
flashcards:
  - q: "Where do DAG files live in Cloud Composer?"
    a: "In the environment's Cloud Storage bucket under dags/."
  - q: "How are credentials best handled in Composer?"
    a: "Environment service account with least privilege + Secret Manager secrets backend for connections."
  - q: "What runs underneath Cloud Composer?"
    a: "Airflow components on Google Kubernetes Engine, with Cloud SQL for the metadata DB."
quiz:
  - q: "How do you deploy a new DAG to Composer?"
    options: ["Upload it to the environment's GCS dags/ folder (ideally via CI)", "Email it to Google", "Restart GKE", "Paste into the UI"]
    answer: 0
  - q: "Your Composer tasks can't write to a BigQuery dataset. What do you check first?"
    options: ["the DAG file's colour", "the GCS storage class", "the Airflow UI theme", "the IAM roles of the environment's service account on that dataset"]
    answer: 3
    explain: "Tasks run as the environment's service account; it needs the right BigQuery roles."
  - q: "What should CI do before deploying DAGs to Composer?"
    options: ["restart the environment", "delete old DAG runs", "lint, run tests and a DagBag import test", "nothing — upload directly"]
    answer: 2
    explain: "An import test catches broken DAGs before they reach the scheduler."
recall:
  - q: "Explain how Cloud Composer works and how you would deploy DAGs to it safely."
    keyPoints:
      - "managed Airflow on GKE"
      - "DAGs synced from the environment's GCS bucket"
      - "environment service account with least privilege"
      - "Secret Manager as secrets backend"
      - "pinned PyPI packages per environment"
      - "CI: lint, tests, DagBag import test, then deploy dev then prod"
interview:
  - q: "How would you set up CI/CD for Airflow DAGs on Cloud Composer?"
    type: design
    level: 2
    keyPoints:
      - "DAGs in version control"
      - "lint and unit tests"
      - "DagBag import test for errors and cycles"
      - "deploy by syncing to the Composer bucket"
      - "separate dev and prod environments"
      - "secrets via Secret Manager"
