=== lesson
--- step concept: Decisions with if / elif / else
```python
if amount >= 300:
    size = "large"
elif amount >= 100:
    size = "medium"
else:
    size = "small"
```
**Guard clauses** exit early so the main logic isn't buried in nesting:

```python
def process(row):
    if row is None:
        return None
    if row["status"] == "cancelled":
        return None
    return row["amount"] * 1.18
```

--- step concept: Loops over anything iterable
```python
for row in rows: ...                       # each item
for i in range(3): ...                     # 0, 1, 2
for i, row in enumerate(rows, start=1): ... # counter + item
for name, amt in zip(names, amounts): ...  # walk two lists together
```
[[quiz:py-control-flow:q0]]

--- step practice: Stop at the first failure
`break` leaves the loop immediately; `continue` skips to the next item. A `for … else` block runs only if the loop **didn't** break.

[[exercise:py-control-flow-1]]

--- step scenario: Loops that must end
`while` loops repeat until a condition is false. In pipelines (polling for a file, retrying an API) they must **always have a limit**, or the job hangs forever.

```python
attempt = 0
while attempt < 5:
    if check():
        return True
    attempt += 1
return False
```
[[exercise:py-control-flow-2]]

--- step check: Read the loop
[[quiz:py-control-flow:q1]]
[[quiz:py-control-flow:q2]]

--- step interview: Explain it
[[recall:py-control-flow:r0]]

=== detailed
## Conditions
- `if / elif / else` — the first true branch runs.
- Combine with `and`, `or`, `not`; chain comparisons: `0 < x <= 100`.
- Membership: `if status in {"paid", "shipped"}:` (a set is fastest for lookups).
- Conditional expression: `label = "big" if amount > 100 else "small"`.

## Guard clauses
Handle the invalid cases first and `return`/`continue` early. Code reads top to bottom with one level of indentation instead of a pyramid of `if`s.

## for loops
| Pattern | Use |
|---|---|
| `for x in xs` | process each item |
| `range(start, stop, step)` | counters; `stop` is **excluded** |
| `enumerate(xs, start=1)` | line numbers for error messages |
| `zip(a, b)` | pair two sequences (stops at the shortest) |
| `for k, v in d.items()` | key and value of a dict |
| `reversed(xs)`, `sorted(xs)` | different orders without changing `xs` |

## break, continue, else
```python
for name, ok in results:
    if not ok:
        print("first failure:", name)
        break
else:
    print("all passed")   # runs only when no break happened
```

## while loops
Use when you don't know the number of iterations in advance (polling, pagination). Always include:
- a maximum attempts or deadline,
- a sleep/backoff between attempts when calling external systems,
- a clear return value or exception when the limit is reached.

> [!MISTAKE] Modifying a list while looping over it skips items. Build a new list (`[r for r in rows if keep(r)]`) instead.

> [!REAL] Pagination loops (`while next_page_token:`) are the most common `while` in data engineering — always cap pages to protect against an API that keeps returning the same token.

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
  - q: "When does the `else` block of a `for` loop run?"
    options: ["when the loop is empty only", "after every iteration", "when an exception occurs", "when the loop finished without break"]
    answer: 3
    explain: "for/else runs the else block only if the loop was not exited with break."
  - q: "`for i, x in enumerate(['a', 'b'], start=1)` produces…"
    options: ["('a', 1), ('b', 2)", "1, 2", "(1, 'a'), (2, 'b')", "(0, 'a'), (1, 'b')"]
    answer: 2
    explain: "enumerate yields (counter, item) pairs starting at the given start value."
recall:
  - q: "How do you write a safe polling loop for a file that might never arrive?"
    keyPoints:
      - "while loop with a maximum number of attempts"
      - "sleep or back off between checks"
      - "return False or raise when the limit is reached"
      - "never loop without an exit condition"
      - "log each attempt"
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
