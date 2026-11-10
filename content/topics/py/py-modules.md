=== crisp
- A **module** is a `.py` file; a **package** is a folder of modules (with `__init__.py`).
- `import pkg.mod`, `from pkg.mod import func`; avoid `from x import *`.
- `if __name__ == "__main__":` — code that runs only when the file is executed directly, not when imported.
- **Never do work at import time** (no DB calls at module top level) — Airflow imports DAG files constantly.
- Typical pipeline repo:
```
my_pipeline/
  pyproject.toml / requirements.txt
  src/my_pipeline/{extract.py, transform.py, load.py, config.py}
  tests/test_transform.py
  dags/orders_daily.py
```
- **Virtual environments** isolate dependencies per project: `python -m venv .venv`, activate, `pip install -r requirements.txt`.
- **Pin versions** (`pandas==2.2.3`) for reproducible builds; lock files (`pip-tools`, `uv`, `poetry`).

=== memory
- **"One project, one venv."**
- **"Import should be cheap and side-effect free."**

=== data
flashcards:
  - q: "What does `if __name__ == '__main__':` do?"
    a: "Runs the block only when the file is executed directly, not when it is imported."
  - q: "Why use a virtual environment?"
    a: "To isolate each project's dependencies and versions from other projects and the system Python."
  - q: "Why pin dependency versions?"
    a: "Reproducible environments — a new library release cannot silently break the pipeline."
quiz:
  - q: "Why must Airflow DAG files avoid heavy work at the top level?"
    options: ["Airflow forbids imports", "The scheduler re-imports DAG files frequently, so top-level work runs constantly", "It is slower to read", "No reason"]
    answer: 1
interview:
  - q: "How do you structure a Python data pipeline project so it is maintainable and testable?"
    type: design
    level: 2
    keyPoints:
      - "separate extract transform load modules"
      - "pure transformation functions"
      - "config and secrets outside code"
      - "tests folder with unit tests"
      - "pinned dependencies in a virtual environment"
      - "CI to run lint and tests"
