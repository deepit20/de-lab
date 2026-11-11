=== lesson
--- step concept: Why print() isn't enough
At 3 a.m. nobody is watching your terminal. Production code needs messages that have a **level**, a **timestamp**, the **module** they came from, and go to a place that is kept (files, Cloud Logging, Airflow task logs). That's the `logging` module.

```python
import logging
logger = logging.getLogger(__name__)

logger.info("loaded %d rows into %s", 1200, "stg_orders")
```

--- step concept: Levels filter the noise
`DEBUG` < `INFO` < `WARNING` < `ERROR` < `CRITICAL`. The configured level shows that level **and above**.

```python
logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(name)s: %(message)s")
```
[[quiz:py-logging:q0]]

--- step example: Logging errors with the stack trace
```python
try:
    load(rows)
except Exception:
    logger.exception("load failed for batch %s", batch_id)  # ERROR + traceback
    raise                                                  # don't hide the failure
```
`logger.exception` is `logger.error` plus the full traceback — only use it inside `except`.

--- step practice: Log a load step
[[exercise:py-logging-1]]

--- step check: Good log messages
[[quiz:py-logging:q1]]
[[quiz:py-logging:q2]]

--- step interview: Explain it
[[recall:py-logging:r0]]

=== detailed
## The pieces
| Piece | Role |
|---|---|
| **Logger** | `logging.getLogger(__name__)` — named after the module; you call `.info()` etc. on it |
| **Level** | severity threshold |
| **Handler** | where records go: console, file, Cloud Logging |
| **Formatter** | the text layout: time, level, name, message |

Configure handlers **once** at the entry point (`main()` or the framework). Library and module code only does `logger = logging.getLogger(__name__)`.

## Levels and when to use them
| Level | Use for |
|---|---|
| DEBUG | detailed values while developing (SQL text, row samples) |
| INFO | normal milestones: started, rows read, rows written, duration |
| WARNING | something odd but handled: 3 rows rejected, retrying |
| ERROR | an operation failed |
| CRITICAL | the whole job cannot continue |

## Writing useful messages
- Include **identifiers and counts**: batch id, table, partition date, rows in/out.
- Use lazy formatting: `logger.info("rows=%d", n)` — formatting happens only if the level is enabled.
- One line per event, so logs are searchable.
- **Never log secrets or PII** (passwords, tokens, full emails).
- Structured (JSON) logs make filtering in Cloud Logging easy: `{"event": "load_done", "rows": 1200}`.

## Exceptions
- `logger.exception(...)` inside `except` records the traceback.
- Log **and re-raise** (or raise a clearer error). Swallowing exceptions makes the orchestrator mark a broken task as successful.

> [!REAL] In Airflow, anything logged by a task appears in that task's log in the UI. A line like `INFO loaded 0 rows for 2025-03-14` is often the first clue that an upstream source was empty.

> [!MISTAKE] Calling `logging.basicConfig` inside a library or many modules — only the first call has an effect, and libraries shouldn't decide the app's log format.

=== crisp
```python
import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger(__name__)

log.info("loaded %d rows into %s", n, table)      # lazy %-formatting
try:
    load()
except Exception:
    log.exception("load failed for %s", table)    # ERROR + traceback
    raise
```
- Levels: DEBUG < INFO < WARNING < ERROR < CRITICAL. Production usually INFO.
- One logger per module: `getLogger(__name__)`; configure handlers once at the entry point.
- Log **context**: run id, table, partition/date, row counts, durations — enough to debug without re-running.
- Never log secrets or full PII.
- Structured (JSON) logs are searchable in Cloud Logging.
- `print` has no levels, timestamps, routing or filtering → not for production.

=== memory
- **"Log what, where, how many, how long."**
- `log.exception` = error + traceback, only inside `except`.

=== data
flashcards:
  - q: "Why use logging instead of print in pipelines?"
    a: "Levels, timestamps, module names, configurable handlers/destinations and filtering."
  - q: "What does logger.exception() do?"
    a: "Logs at ERROR level including the current traceback (use inside except)."
  - q: "Why `log.info('rows=%d', n)` rather than an f-string?"
    a: "The message is only formatted if the level is enabled, and log aggregators can group by template."
quiz:
  - q: "With level=WARNING, which call is shown?"
    options: ["log.debug", "log.info", "log.error", "none"]
    answer: 2
  - q: "Inside an `except` block, which call records the error together with its traceback?"
    options: ["logger.info(...)", "print(...)", "logger.debug(...)", "logger.exception(...)"]
    answer: 3
    explain: "logger.exception logs at ERROR level and appends the current traceback."
  - q: "Which log line is most useful when a nightly load looks wrong?"
    options: ["\"error!!\"", "\"step 3\"", "\"loaded 0 rows into stg_orders for 2025-03-14 (expected > 1000)\"", "\"done\""]
    answer: 2
    explain: "Good log lines carry identifiers, counts and context so you can debug without rerunning."
recall:
  - q: "How would you set up logging for a Python pipeline and what should the log lines contain?"
    keyPoints:
      - "getLogger(__name__) in each module"
      - "configure level and format once at the entry point"
      - "INFO for milestones and row counts"
      - "logger.exception in except, then re-raise"
      - "include batch ids, tables, dates"
      - "never log secrets or PII"
exercises:
  - id: py-logging-1
    lang: python
    kind: coding
    difficulty: 2
    title: Log a load step
    prompt: |
      Write `load_rows(rows, logger)` that "loads" rows (just count them): log at INFO `"loaded %d rows"` on success. If any row is missing `"id"`, log at ERROR with `logger.error("missing id in %d rows", n_bad)` and raise `ValueError`. Return the count.
    starter: |
      import logging

      def load_rows(rows, logger):
          pass
    solution: |
      import logging

      def load_rows(rows, logger):
          bad = [r for r in rows if "id" not in r]
          if bad:
              logger.error("missing id in %d rows", len(bad))
              raise ValueError("rows without id")
          logger.info("loaded %d rows", len(rows))
          return len(rows)
    tests:
      - call: "load_rows([{'id': 1}], __import__('logging').getLogger('t'))"
        expect: "1"
    check: |
      import logging
      class H(logging.Handler):
          def __init__(self):
              super().__init__(); self.records = []
          def emit(self, r):
              self.records.append((r.levelname, r.getMessage()))
      lg = logging.getLogger('check'); lg.setLevel(logging.DEBUG); h = H(); lg.addHandler(h)
      load_rows([{'id': 1}, {'id': 2}], lg)
      assert ('INFO', 'loaded 2 rows') in h.records, f'expected INFO "loaded 2 rows", got {h.records}'
      try:
          load_rows([{'x': 1}], lg)
          raise AssertionError('should raise ValueError')
      except ValueError:
          pass
      assert ('ERROR', 'missing id in 1 rows') in h.records, 'expected an ERROR log line'
interview:
  - q: "What should a data pipeline log, and what should it never log?"
    type: concept
    level: 1
    keyPoints:
      - "run id, source, target, partition"
      - "row counts and durations"
      - "errors with tracebacks"
      - "never secrets or credentials"
      - "avoid raw PII"
