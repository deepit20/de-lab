=== crisp
- **list**: ordered, mutable — `append(x)` adds one, `extend(xs)` adds many, `insert`, `pop()`, `remove(x)`.
- **tuple**: ordered, immutable, hashable — records and dict keys: `("2025-06-01", "web")`.
- Slicing `xs[a:b:step]` returns a **copy**; `xs[-1]` last item.
- `sorted(xs, key=…, reverse=True)` returns new list; `xs.sort()` sorts in place and returns `None`.
- Sort by several keys: `key=lambda r: (r["city"], -r["amount"])`.
- Unpacking: `a, b = pair`, `first, *rest = xs`, swap `a, b = b, a`.
- Copies: `xs.copy()` / `list(xs)` are **shallow** — nested lists are shared; use `copy.deepcopy` for nested.
- `x in list` is O(n) — use a set for repeated membership tests.

=== memory
- **"sorted() gives, .sort() changes (and returns None)."**
- **append = one item, extend = many items.**
- Trigger: *"my list became None"* → `xs = xs.sort()`.

=== data
flashcards:
  - q: "append vs extend?"
    a: "append adds one element (even a list, as one element); extend adds each element of an iterable."
  - q: "What does `xs.sort()` return?"
    a: "None — it sorts in place. Use sorted(xs) for a new list."
  - q: "Why use tuples for records/keys?"
    a: "Immutable and hashable → usable as dict keys and set members, safe from accidental change."
  - q: "What is a shallow copy?"
    a: "A new outer list whose elements are the same objects — nested lists are shared."
quiz:
  - q: "`xs = [3, 1, 2]; ys = xs.sort(); print(ys)`"
    options: ["[1, 2, 3]", "None", "[3, 1, 2]", "error"]
    answer: 1
exercises:
  - id: py-lists-tuples-1
    lang: python
    kind: coding
    difficulty: 1
    title: Sort orders by two keys
    prompt: |
      Write `rank_orders(orders)` returning a **new** list of `order_id`s sorted by `channel` ascending, then `amount` descending. Don't modify the input.
    starter: |
      def rank_orders(orders):
          pass
    solution: |
      def rank_orders(orders):
          return [o["order_id"] for o in sorted(orders, key=lambda o: (o["channel"], -o["amount"]))]
    tests:
      - call: "rank_orders([{'order_id': 1, 'channel': 'web', 'amount': 5}, {'order_id': 2, 'channel': 'app', 'amount': 1}, {'order_id': 3, 'channel': 'web', 'amount': 9}])"
        expect: "[2, 3, 1]"
    hints:
      - "key=lambda o: (o['channel'], -o['amount'])"
interview:
  - q: "What is the difference between a list and a tuple? When would you use each?"
    type: concept
    level: 1
    keyPoints:
      - "list mutable, tuple immutable"
      - "tuple hashable can be dict key"
      - "tuple for fixed records, list for collections that change"
      - "tuples slightly faster and safer"
