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
