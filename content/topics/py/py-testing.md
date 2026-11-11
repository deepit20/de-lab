=== lesson
--- step concept: A test is code that checks code
```python
# transform.py
def net_amount(amount, discount):
    return round(amount - discount, 2)

# test_transform.py
from transform import net_amount

def test_net_amount():
    assert net_amount(100, 15.5) == 84.5
```
Run `pytest`: it finds files named `test_*.py` and functions named `test_*`, runs them, and reports which `assert`s failed.

--- step concept: Arrange – Act – Assert
```python
def test_dedup_keeps_latest():
    rows = [{"id": 1, "updated_at": "2025-01-01"},          # Arrange
            {"id": 1, "updated_at": "2025-02-01"}]
    result = dedup_latest(rows)                            # Act
    assert result == [{"id": 1, "updated_at": "2025-02-01"}]  # Assert
```
Small, hand-made inputs make the expected answer obvious.

[[quiz:py-testing:q0]]

--- step practice: Write tests for a dedup function
[[exercise:py-testing-1]]

--- step example: Fixtures and parametrize
```python
import pytest

@pytest.fixture
def orders():
    return [{"id": 1, "amount": 50}, {"id": 2, "amount": 0}]

@pytest.mark.parametrize("raw, expected", [(" A@X.COM ", "a@x.com"), ("", None)])
def test_clean_email(raw, expected):
    assert clean_email(raw) == expected
```
A **fixture** builds shared test data; **parametrize** runs one test over many cases.

[[quiz:py-testing:q1]]

--- step check: What to test in a pipeline
[[quiz:py-testing:q2]]

--- step interview: Explain it
[[recall:py-testing:r0]]

=== detailed
## Why test pipelines
Data code fails quietly: a wrong join doesn't crash, it just doubles revenue. Tests catch logic errors **before** bad numbers reach a dashboard, and let you refactor safely.

## Kinds of tests
| Kind | Checks | Example |
|---|---|---|
| unit | one function with tiny inputs | `clean_email(" A@X.COM ") == "a@x.com"` |
| integration | parts together, real-ish systems | load a sample file into a test dataset |
| data tests | the data itself in production | dbt `unique`, `not_null`, row counts |
| end-to-end | whole DAG on a small date range | run in a staging environment |

## pytest essentials
- Plain `assert`; pytest shows the values on failure.
- `pytest.raises(ValueError)` to test that bad input fails loudly.
- `tmp_path` fixture gives a temporary folder for file I/O tests.
- `pytest -k dedup` runs matching tests; `-x` stops at the first failure.

## What to test in transformations
- **Happy path** with a few normal rows.
- **Edge cases:** empty input, one row, duplicates, NULL/None values, zero amounts.
- **Boundaries:** window start/end, time zones, month end.
- **Schema:** output columns and types.
- **Idempotency:** running twice gives the same result.

## Make code testable
- Separate pure logic from I/O: `transform(rows) -> rows` instead of a function that reads S3, transforms and writes BigQuery in one go.
- Pass dependencies in (dates, clients) rather than creating them inside.

> [!REAL] CI runs tests on every pull request. Teams typically also run an **Airflow DAG import test** — load every DAG file and fail if any has an import error.

> [!MISTAKE] Testing with a copy of production data: slow, private, and the expected result is unknowable. Hand-craft 3–5 rows where you know the answer.

=== crisp
```python
# tests/test_transform.py
import pytest
from my_pipeline.transform import parse_amount

def test_parses_commas():
    assert parse_amount("1,250.50") == 1250.5          # Arrange-Act-Assert

@pytest.mark.parametrize("raw", ["", None, "abc"])
def test_bad_values_become_none(raw):
    assert parse_amount(raw) is None

def test_rejects_negative():
    with pytest.raises(ValueError):
        validate({"amount": -1})

@pytest.fixture
def orders():
    return [{"id": 1, "amount": 10.0}, {"id": 2, "amount": 5.0}]
```
- Run with `pytest -q`; files `test_*.py`, functions `test_*`.
- **Unit tests** for pure transforms (fast, no I/O); **integration tests** for connections/loads; **data tests** (dbt/Great Expectations) for the data itself.
- Test **edge cases**: empty input, NULLs, duplicates, wrong types, boundary dates, time zones.
- Small, hand-made inputs that make the expected output obvious.
- Run tests in CI on every change.

=== memory
- **AAA: Arrange, Act, Assert.**
- **"Test code with pytest, test data with checks."**
- Edge-case checklist: **E-N-D-T-B** — Empty, NULL, Duplicate, Type, Boundary.

=== data
flashcards:
  - q: "What does @pytest.mark.parametrize do?"
    a: "Runs the same test function with several sets of inputs."
  - q: "How do you assert that code raises an exception in pytest?"
    a: "with pytest.raises(ValueError): ..."
  - q: "Unit tests vs data tests?"
    a: "Unit tests check code logic on fixed inputs; data tests check properties of real data (not null, unique, ranges)."
quiz:
  - q: "Which is the best unit test input for a dedup function?"
    options: ["a copy of production data", "a tiny list with an obvious duplicate", "random data", "no input"]
    answer: 1
  - q: "A pytest fixture is used to…"
    options: ["deploy the code", "provide shared setup data or resources to tests", "mark a test as skipped", "speed up assertions"]
    answer: 1
    explain: "Fixtures build inputs (data, temp folders, clients) that tests receive as arguments."
  - q: "Which test is MOST likely to catch a real pipeline bug?"
    options: ["running the transform on an input with duplicates and NULLs", "checking the function exists", "testing that 1 + 1 == 2", "printing the output"]
    answer: 0
    explain: "Edge cases — duplicates, NULLs, empty batches — are where transformations break."
recall:
  - q: "How do you test a data transformation and what cases do you include?"
    keyPoints:
      - "Arrange, Act, Assert"
      - "small hand-made inputs with known answers"
      - "edge cases: empty, duplicates, NULLs, boundaries"
      - "fixtures and parametrize"
      - "separate pure logic from I/O"
      - "data tests in production as well"
exercises:
  - id: py-testing-1
    lang: python
    kind: coding
    difficulty: 2
    title: Write tests for a dedup function
    prompt: |
      `dedup_latest(rows)` keeps the latest `updated_at` per `id`. Write **test functions** (plain `assert`s, pytest-style) named `test_keeps_latest`, `test_empty`, and `test_single`. The checker runs your tests against a correct implementation **and** against a buggy one — your tests must pass on the first and catch the second.
    starter: |
      def dedup_latest(rows):
          latest = {}
          for r in rows:
              if r["id"] not in latest or r["updated_at"] > latest[r["id"]]["updated_at"]:
                  latest[r["id"]] = r
          return sorted(latest.values(), key=lambda r: r["id"])

      def test_keeps_latest():
          pass

      def test_empty():
          pass

      def test_single():
          pass
    solution: |
      def dedup_latest(rows):
          latest = {}
          for r in rows:
              if r["id"] not in latest or r["updated_at"] > latest[r["id"]]["updated_at"]:
                  latest[r["id"]] = r
          return sorted(latest.values(), key=lambda r: r["id"])

      def test_keeps_latest():
          rows = [{"id": 1, "updated_at": "2025-01-01", "v": "old"}, {"id": 1, "updated_at": "2025-02-01", "v": "new"}]
          assert dedup_latest(rows) == [rows[1]]

      def test_empty():
          assert dedup_latest([]) == []

      def test_single():
          r = {"id": 5, "updated_at": "2025-01-01"}
          assert dedup_latest([r]) == [r]
    check: |
      test_keeps_latest(); test_empty(); test_single()
      def buggy(rows):
          seen = {}
          for r in rows:
              seen.setdefault(r["id"], r)
          return list(seen.values())
      good = dedup_latest
      globals()['dedup_latest'] = buggy
      caught = False
      try:
          test_keeps_latest()
      except AssertionError:
          caught = True
      globals()['dedup_latest'] = good
      assert caught, "Your test_keeps_latest did not catch a bug that keeps the FIRST version instead of the latest"
interview:
  - q: "How do you test a data pipeline?"
    type: concept
    level: 2
    keyPoints:
      - "unit tests for transformation functions with small inputs"
      - "edge cases: empty, nulls, duplicates, types"
      - "integration tests for sources and sinks"
      - "data quality tests on outputs"
      - "run in CI before deployment"
