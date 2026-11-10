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
