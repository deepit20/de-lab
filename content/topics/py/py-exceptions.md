=== lesson
--- step concept: Errors are information
An exception stops normal execution and travels **up the call stack** until something handles it. If nothing does, the program ends with a traceback.
```python
try:
    amount = float(row["amount"])
except KeyError:
    log.warning("row without amount: %s", row)
    amount = None
except ValueError as e:
    raise ValueError(f"bad amount {row['amount']!r} in order {row.get('order_id')}") from e
else:
    pass          # runs only if no exception
finally:
    pass          # always runs (cleanup)
```
> [!WHY] In a pipeline you must decide, for each failure, whether to **recover** (skip/quarantine/retry), **enrich and re-raise**, or **fail fast**. Swallowing errors silently is the worst choice — the job "succeeds" with wrong data.

[[quiz:py-exceptions:q0]]

--- step practice: Safe conversion
[[exercise:py-exceptions-1]]

--- step concept: Reading a traceback
Read it **bottom-up**: the last line is the exception type and message; the lines above show the call chain, with the deepest frame (where it happened) last. Find the first frame in *your* code.

[[exercise:py-exceptions-2]]

--- step challenge: Retry transient failures
[[exercise:py-exceptions-3]]
[[recall:py-exceptions:r0]]

=== detailed
## The hierarchy
`BaseException` → `Exception` → `ValueError`, `TypeError`, `KeyError` (`LookupError`), `IndexError`, `OSError` (`FileNotFoundError`, `PermissionError`, `TimeoutError`, `ConnectionError`), `ZeroDivisionError` … Catch the **most specific** class you can handle. `except Exception` is a last-resort boundary (e.g. around one record in a batch), and should log with the traceback.

> [!WARN] Bare `except:` also catches `KeyboardInterrupt` and `SystemExit` — you can no longer stop the program cleanly.

## try / except / else / finally
- `except (A, B) as e:` — several types.
- `else:` — code that should run only on success (keeps the try block small).
- `finally:` — cleanup that must always happen (prefer context managers: `with`).

## Raising
- `raise ValueError("clear message with context")`.
- `raise NewError(...) from e` — chains the original cause (visible in the traceback).
- Bare `raise` inside except re-raises the current exception unchanged.
- Custom exceptions for domain failures: `class DataQualityError(Exception): pass` — lets orchestration distinguish "bad data" from "infrastructure down".

## Error-handling strategies in pipelines
| Failure | Strategy |
|---|---|
| Transient (timeout, 429, 503, connection reset) | **retry** with exponential backoff + jitter, limited attempts |
| Bad record | **quarantine** with reason, continue, alert on rate |
| Bad batch / contract violation | **fail fast**, don't load partial data |
| Programming bug | fail loudly; fix code |

Retries must be **idempotent** (re-running a step must not duplicate data).

## EAFP vs LBYL
Python style favours *Easier to Ask Forgiveness than Permission*: `try: d[k] except KeyError:` rather than checking `if k in d` first — but use `.get()` when a missing key is normal, not exceptional.

## Logging exceptions
`logger.exception("failed to load %s", path)` inside an except block logs the full traceback at ERROR level.

## Common mistakes
> [!MISTAKE] `except Exception: pass` — silent data loss.

> [!MISTAKE] Huge try blocks hiding where the error came from.

> [!MISTAKE] Retrying non-transient errors (a 400 Bad Request will fail every time).

> [!MISTAKE] Losing context: `raise Exception("failed")` without `from e` or details.

=== crisp
- Catch **specific** exceptions; never bare `except:`; never `except: pass`.
- `try / except / else (success only) / finally (always)`.
- Re-raise with context: `raise X("msg with ids") from e`; bare `raise` re-raises.
- Traceback: read **bottom-up**; last line = type + message; find your frame.
- Pipelines: transient → retry with backoff (idempotent!) · bad record → quarantine · broken contract → fail fast.
- Custom exceptions (`DataQualityError`) make failures actionable.
- `logger.exception(...)` logs the traceback.

=== memory
- **"Catch what you can handle, let the rest fly."**
- **Traceback = read it from the bottom.**
- Retry only what might succeed next time: **timeouts, 429, 5xx** — not 400s.

=== data
flashcards:
  - q: "Why is a bare `except:` dangerous?"
    a: "It catches everything including KeyboardInterrupt/SystemExit and hides bugs."
  - q: "When does the `else` block of a try run?"
    a: "Only if the try block raised no exception."
  - q: "What does `raise NewError(...) from e` do?"
    a: "Raises a new exception and records the original as its cause in the traceback."
  - q: "Which errors should a pipeline retry?"
    a: "Transient ones: timeouts, connection errors, HTTP 429/5xx — with backoff and a limit."
  - q: "How do you read a Python traceback?"
    a: "From the bottom: exception type and message last; the frames above show the call path."
quiz:
  - q: "A job calls an API that occasionally returns HTTP 503. Best handling?"
    options: ["except Exception: pass", "retry with exponential backoff, limited attempts", "retry forever immediately", "fail the whole pipeline permanently"]
    answer: 1
recall:
  - q: "Describe how you would handle different kinds of failures in a data pipeline."
    keyPoints:
      - "transient failures retried with backoff"
      - "retries must be idempotent"
      - "bad records quarantined with reason"
      - "contract violations fail fast"
      - "never swallow errors silently"
      - "log with context and alert"
exercises:
  - id: py-exceptions-1
    lang: python
    kind: coding
    difficulty: 1
    title: Safe number parsing
    prompt: |
      Write `parse_amount(value)` returning a float, or `None` if `value` is `None`, empty/whitespace, or not a number. Remove thousands commas first. Catch only the exception you expect.
    starter: |
      def parse_amount(value):
          pass
    solution: |
      def parse_amount(value):
          if value is None:
              return None
          text = str(value).replace(",", "").strip()
          if not text:
              return None
          try:
              return float(text)
          except ValueError:
              return None
    tests:
      - call: "parse_amount('1,250.75')"
        expect: "1250.75"
      - call: "parse_amount('abc')"
        expect: "None"
      - call: "parse_amount('  ')"
        expect: "None"
        hidden: true
        label: whitespace
      - call: "parse_amount(None)"
        expect: "None"
        hidden: true
        label: None
      - call: "parse_amount(42)"
        expect: "42.0"
        hidden: true
        label: int input
    hints:
      - "float('abc') raises ValueError."
  - id: py-exceptions-2
    lang: python
    kind: debug
    difficulty: 2
    title: "Debug: the job that always succeeds"
    prompt: |
      `load_all` reports success but silently loses rows. Rewrite it so that it **returns** `(loaded_count, errors)` where `errors` is a list of `(order_id, error_message)` for rows that failed, and it never hides failures. `load_one` must stay unchanged.
    starter: |
      def load_one(row):
          if row["amount"] < 0:
              raise ValueError("negative amount")
          return True

      def load_all(rows):
          loaded = 0
          for row in rows:
              try:
                  load_one(row)
                  loaded += 1
              except:
                  pass
          return loaded
    solution: |
      def load_one(row):
          if row["amount"] < 0:
              raise ValueError("negative amount")
          return True

      def load_all(rows):
          loaded, errors = 0, []
          for row in rows:
              try:
                  load_one(row)
              except (ValueError, KeyError) as e:
                  errors.append((row.get("order_id"), str(e)))
              else:
                  loaded += 1
          return loaded, errors
    tests:
      - call: "load_all([{'order_id': 1, 'amount': 5}, {'order_id': 2, 'amount': -1}, {'order_id': 3}])"
        expect: "(1, [(2, 'negative amount'), (3, \"'amount'\")])"
    hints:
      - "Catch specific exceptions (ValueError, KeyError) and record them."
      - "str(KeyError('amount')) is \"'amount'\"."
  - id: py-exceptions-3
    lang: python
    kind: coding
    difficulty: 3
    title: Retry with backoff
    prompt: |
      Write `with_retry(fn, attempts=3, base_delay=0.0)` that calls `fn()` and returns its result. On `TimeoutError` or `ConnectionError` retry, waiting `base_delay * 2**i` seconds between attempts; after the last attempt re-raise the error. Any **other** exception must be raised immediately (no retry). Track sleeps with `time.sleep`.
    starter: |
      import time

      def with_retry(fn, attempts=3, base_delay=0.0):
          pass
    solution: |
      import time

      def with_retry(fn, attempts=3, base_delay=0.0):
          for i in range(attempts):
              try:
                  return fn()
              except (TimeoutError, ConnectionError):
                  if i == attempts - 1:
                      raise
                  time.sleep(base_delay * 2 ** i)
    tests:
      - call: "with_retry(lambda: 42)"
        expect: "42"
    check: |
      calls = {'n': 0}
      def flaky():
          calls['n'] += 1
          if calls['n'] < 3:
              raise TimeoutError('slow')
          return 'ok'
      assert with_retry(flaky, attempts=3) == 'ok', 'Should succeed on the 3rd attempt'
      calls['n'] = 0
      try:
          with_retry(lambda: (_ for _ in ()).throw(ConnectionError('down')), attempts=2)
          raise AssertionError('Should re-raise after the last attempt')
      except ConnectionError:
          pass
      n = {'c': 0}
      def bad():
          n['c'] += 1
          raise ValueError('400 bad request')
      try:
          with_retry(bad, attempts=5)
      except ValueError:
          pass
      assert n['c'] == 1, 'Non-transient errors must not be retried'
    hints:
      - "Loop over range(attempts); return on success."
      - "Inside except: if it was the last attempt, `raise` (bare) to re-raise."
interview:
  - q: "What is the difference between retrying and failing fast? Give examples of when you use each in a pipeline."
    type: scenario
    level: 2
    keyPoints:
      - "retry transient errors like timeouts and rate limits"
      - "exponential backoff with limits"
      - "idempotent operations required for retries"
      - "fail fast on bad data contracts or programming errors"
      - "quarantine individual bad records"
