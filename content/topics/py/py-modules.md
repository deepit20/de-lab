=== lesson
--- step concept: A module is just a .py file
```python
# utils.py
def clean_email(s):
    return s.strip().lower() or None

# pipeline.py
from utils import clean_email
import utils            # or the whole module: utils.clean_email(...)
```
A **package** is a folder of modules (with an `__init__.py`). Python finds them via the current folder, installed packages and `sys.path`.

--- step concept: Importing runs the file
When you import a module, Python **executes** its top-level code once. That's why scripts use:

```python
def main():
    run_pipeline()

if __name__ == "__main__":   # True only when run directly: python pipeline.py
    main()
```
[[quiz:py-modules:q0]]

--- step example: A pipeline project layout
```text
orders-pipeline/
├─ pyproject.toml          # dependencies + project metadata
├─ src/orders_pipeline/
│  ├─ __init__.py
│  ├─ extract.py
│  ├─ transform.py
│  └─ load.py
├─ dags/orders_dag.py      # thin: only wires tasks together
└─ tests/test_transform.py
```
Business logic lives in importable modules; the DAG and CLI only call it. That makes it testable.

--- step concept: Virtual environments
Every project gets its own isolated set of packages:

```bash
python -m venv .venv
.venv\Scripts\activate         # Windows   (source .venv/bin/activate on Mac/Linux)
pip install pandas==2.2.3
pip freeze > requirements.txt
```
[[quiz:py-modules:q1]]

--- step check: Reproducible installs
[[quiz:py-modules:q2]]

--- step interview: Explain it
[[recall:py-modules:r0]]

=== detailed
## Import forms
| Form | Effect |
|---|---|
| `import pandas as pd` | module object under an alias |
| `from os import path` | one name |
| `from .transform import clean` | relative import inside a package |
| `from x import *` | avoid — hides where names come from |

Imports are cached in `sys.modules`; a module runs only once per process.

## `if __name__ == "__main__":`
`__name__` is `"__main__"` when the file is executed directly and the module name when it is imported. Put script behaviour behind this guard so other code (tests, Airflow) can import the functions without side effects.

> [!WARN] Airflow parses DAG files every few seconds. Top-level code — API calls, database queries, reading big files — runs on **every parse** and slows the scheduler. Keep DAG files thin.

## Project layout
- `src/` layout avoids accidentally importing from the working folder.
- Separate **I/O** (extract/load) from **pure logic** (transform) so the logic can be unit-tested with small inputs.
- Configuration in env vars or YAML, not hard-coded.

## Dependencies
- **venv** isolates packages per project.
- `requirements.txt` (pinned with `==`) or `pyproject.toml` lists what to install.
- **Pin versions** so the same code gives the same results next month; upgrade deliberately.
- Lock tools (`pip-tools`, `uv`, `poetry`) generate fully pinned files including sub-dependencies.

> [!REAL] Cloud Composer installs PyPI packages per environment. A package that isn't pinned can upgrade on the next environment update and break every DAG that uses it.

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
  - q: "Code under `if __name__ == \"__main__\":` runs when…"
    options: ["never", "the file is executed directly", "the file is imported", "always"]
    answer: 1
    explain: "When imported, __name__ is the module name, so the guarded block is skipped."
  - q: "Why pin versions like `pandas==2.2.3`?"
    options: ["so installs are reproducible and an upgrade can't silently break the pipeline", "pip requires it", "it makes code faster", "it reduces disk usage"]
    answer: 0
    explain: "Unpinned dependencies can change between installs and introduce breaking changes."
recall:
  - q: "How do you structure and package a Python pipeline project so it is testable and reproducible?"
    keyPoints:
      - "logic in importable modules, entry points thin"
      - "if __name__ == '__main__' guard"
      - "importing executes top-level code"
      - "virtual environment per project"
      - "pinned requirements or pyproject"
      - "keep Airflow DAG files light"
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
