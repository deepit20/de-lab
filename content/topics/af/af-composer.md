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
