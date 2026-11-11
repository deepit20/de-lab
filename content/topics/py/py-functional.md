=== lesson
--- step concept: Lambdas are tiny throwaway functions
```python
def get_amount(row):
    return row["amount"]

get_amount = lambda row: row["amount"]   # same thing, one expression
```
Their main use is as a **key** for `sorted`, `min`, `max`:

```python
biggest = max(orders, key=lambda o: o["amount"])
by_date = sorted(orders, key=lambda o: (o["order_date"], o["id"]))
```

--- step concept: any() and all()
```python
any(o["amount"] < 0 for o in orders)        # is there at least one negative?
all(o["status"] != "unknown" for o in orders)  # are all statuses known?
```
Both **short-circuit** — they stop as soon as the answer is known. `all([])` is `True` (nothing failed), which matters for empty batches.

[[quiz:py-functional:q0]]

--- step practice: Validate a batch
[[exercise:py-functional-1]]

--- step example: map and filter vs comprehensions
```python
list(map(lambda o: o["amount"], orders))
list(filter(lambda o: o["status"] == "paid", orders))
# usually clearer as comprehensions:
[o["amount"] for o in orders]
[o for o in orders if o["status"] == "paid"]
```
`map`/`filter` return **lazy** iterators; wrap in `list()` to see the values.

[[quiz:py-functional:q1]]

--- step check: Pick the right tool
[[quiz:py-functional:q2]]

--- step interview: Explain it
[[recall:py-functional:r0]]

=== detailed
## Functions are values
In Python a function can be stored in a variable, passed to another function, and returned. That is what makes `key=` arguments, callbacks and Airflow `python_callable=` work.

## Lambda
- Syntax: `lambda args: expression` — one expression, no statements.
- Use for short keys and callbacks. If it needs a name or more than one line, write a `def`.

## Built-ins that take a key
| Function | Example |
|---|---|
| `sorted` | `sorted(rows, key=lambda r: r["ts"])` |
| `min` / `max` | `max(rows, key=lambda r: r["amount"])` |
| `itertools.groupby` | group **sorted** rows by a key |

## any / all
- `any(iterable)` → True if at least one item is truthy.
- `all(iterable)` → True if every item is truthy; `all([])` is True.
- Pass a **generator expression** so items are evaluated lazily and the scan stops early.

> [!MISTAKE] `all(...)` returns True for an empty batch. If an empty batch should fail, check `rows and all(...)`.

## map / filter / reduce
- `map(f, xs)` applies `f` to each item; `filter(pred, xs)` keeps items where `pred` is truthy.
- `functools.reduce(f, xs, start)` folds a list into one value — usually `sum`, `max` or a loop is clearer.
- Comprehensions are the idiomatic Python choice; you'll still see `map` in Spark RDD code.

## Pure functions
A function that returns a value based only on its inputs, without side effects, is easy to test and safe to retry — exactly what you want for transformations.

> [!REAL] PySpark's `F.col(...)` expressions and pandas' `.apply(lambda ...)` build on the same idea: pass a function or expression to the engine and let it run it for every row.

=== crisp
- `lambda args: expression` — a tiny unnamed function, usually passed as an argument.
- `sorted(rows, key=lambda r: r["amount"], reverse=True)`; `max(rows, key=lambda r: r["amount"])`.
- `operator.itemgetter("amount")` / `attrgetter` — faster, readable alternatives to lambdas.
- `map(f, xs)` and `filter(pred, xs)` return **lazy iterators**; comprehensions are usually clearer.
- `any(cond for x in xs)`, `all(cond for x in xs)` — short-circuit checks (great for validation).
- `functools.reduce` for folds (rarely needed — prefer `sum`, `max`, loops).
- `functools.partial(f, x=1)` pre-fills arguments (handy for callbacks).

=== memory
- **"key= tells sorted *what* to compare."**
- **any = at least one, all = every one (empty → all is True!).**

=== data
flashcards:
  - q: "Get the order with the largest amount from a list of dicts."
    a: "max(orders, key=lambda o: o['amount'])"
  - q: "What does all([]) return?"
    a: "True (vacuous truth) — be careful in validation code."
  - q: "What do map and filter return in Python 3?"
    a: "Lazy iterators, not lists."
quiz:
  - q: "`any(x > 10 for x in [1, 5, 20])` is…"
    options: ["False", "True", "20", "[False, False, True]"]
    answer: 1
  - q: "`all([])` returns…"
    options: ["False", "None", "error", "True"]
    answer: 3
    explain: "There are no falsy items, so all() is True. Check for emptiness separately if needed."
  - q: "Which returns the order with the largest amount?"
    options: ["sorted(orders)[-1]", "orders.max('amount')", "max(orders, key=lambda o: o['amount'])", "max(o['amount'] for o in orders)"]
    answer: 2
    explain: "The key function decides the comparison but max returns the whole item. The generator version returns only the number."
recall:
  - q: "When do you use lambda, any/all and comprehensions in data code?"
    keyPoints:
      - "lambda for short key functions"
      - "sorted/min/max take key="
      - "any and all short-circuit"
      - "all of an empty list is True"
      - "comprehensions are clearer than map/filter"
      - "pure functions are easy to test"
exercises:
  - id: py-functional-1
    lang: python
    kind: coding
    difficulty: 1
    title: Validate a batch
    prompt: |
      Write `batch_ok(rows)` that returns True only if the batch is **non-empty**, **every** row has a positive `amount`, and **no** row has `status == 'unknown'`. Use `all()` and `any()`.
    starter: |
      def batch_ok(rows):
          pass
    solution: |
      def batch_ok(rows):
          return bool(rows) and all(r["amount"] > 0 for r in rows) and not any(r["status"] == "unknown" for r in rows)
    tests:
      - call: "batch_ok([{'amount': 1, 'status': 'ok'}])"
        expect: "True"
      - call: "batch_ok([])"
        expect: "False"
        label: empty batch is not OK
      - call: "batch_ok([{'amount': 1, 'status': 'unknown'}])"
        expect: "False"
        hidden: true
interview:
  - q: "When would you use a lambda, and when is a named function better?"
    type: concept
    level: 1
    keyPoints:
      - "lambda for short key or callback functions"
      - "named function when logic is complex or reused"
      - "named functions are testable and readable"
      - "itemgetter as an alternative"
