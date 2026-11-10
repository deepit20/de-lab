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
