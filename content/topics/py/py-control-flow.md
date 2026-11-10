=== crisp
- `if / elif / else`; prefer **guard clauses** (`if bad: return`) over deep nesting.
- `for item in iterable` — iterate items directly, not indexes.
- `enumerate(xs, start=1)` → (index, item); `zip(a, b)` → pairs (stops at shortest; `strict=True` in 3.10+).
- `range(start, stop, step)` — stop is exclusive.
- `break` exits the loop, `continue` skips to the next item; `for … else:` runs if no break happened.
- `while cond:` — make sure something changes `cond` → avoid infinite loops; add a max-iterations guard for retries/polling.
- `match` (3.10+) for structured branching.
- Iterate dicts with `.items()`; never modify a list while looping over it — build a new one.

=== memory
- **"Guard early, return early."**
- **"range stops before stop."**
- Trigger: *"code froze"* → while loop condition never changes.

=== data
flashcards:
  - q: "What does `for … else` do?"
    a: "The else block runs only if the loop finished without hitting break."
  - q: "How do you loop with both index and value?"
    a: "for i, v in enumerate(values):"
  - q: "What does zip do with lists of different length?"
    a: "Stops at the shortest (use strict=True to raise instead)."
quiz:
  - q: "`list(range(2, 8, 2))` is…"
    options: ["[2, 4, 6, 8]", "[2, 4, 6]", "[4, 6, 8]", "[2, 8]"]
    answer: 1
exercises:
  - id: py-control-flow-1
    lang: python
    kind: coding
    difficulty: 1
    title: First failing check
    prompt: |
      Write `first_failure(results)` where `results` is a list of `(check_name, passed)` tuples. Return the name of the **first** failed check, or `"all passed"`. Use a loop with `break`/`return` (stop as soon as you find one).
    starter: |
      def first_failure(results):
          pass
    solution: |
      def first_failure(results):
          for name, passed in results:
              if not passed:
                  return name
          return "all passed"
    tests:
      - call: "first_failure([('not_null', True), ('unique', False), ('range', False)])"
        expect: "'unique'"
      - call: "first_failure([])"
        expect: "'all passed'"
  - id: py-control-flow-2
    lang: python
    kind: debug
    difficulty: 1
    title: "Debug: the poller that never stops"
    prompt: |
      `wait_for_file(check)` polls `check()` until it returns True — but if the file never arrives it loops forever. Add a `max_polls=5` parameter and return `False` after that many unsuccessful polls (return `True` as soon as check() is True).
    starter: |
      def wait_for_file(check):
          while not check():
              pass
          return True
    solution: |
      def wait_for_file(check, max_polls=5):
          for _ in range(max_polls):
              if check():
                  return True
          return False
    tests:
      - call: "wait_for_file(lambda: False)"
        expect: "False"
      - call: "wait_for_file(lambda: True)"
        expect: "True"
    hints:
      - "Replace the while loop with a bounded for loop."
interview:
  - q: "How do you avoid infinite loops when polling or retrying in a pipeline?"
    type: concept
    level: 1
    keyPoints:
      - "bounded number of attempts"
      - "timeout / deadline"
      - "sleep between polls"
      - "fail with a clear error after giving up"
