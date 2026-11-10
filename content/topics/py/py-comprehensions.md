=== lesson
--- step concept: Transform and filter in one expression
A comprehension builds a new collection from an iterable:
```python
amounts = [o["amount"] for o in orders]                          # list
big     = [o for o in orders if o["amount"] > 300]               # filter
by_id   = {c["customer_id"]: c for c in customers}               # dict
cities  = {c["city"] for c in customers}                         # set
total   = sum(o["amount"] for o in orders)                       # generator expression
```
Read it as: *"[expression] **for** item **in** iterable **if** condition"*.

> [!TIP] Use a comprehension when the logic fits on one or two readable lines. Anything with several conditions, side effects or try/except belongs in a normal loop or a helper function.

[[quiz:py-comprehensions:q0]]

--- step practice: Clean a column
[[exercise:py-comprehensions-1]]

--- step concept: Conditional expressions and nesting
```python
labels = ["big" if a > 300 else "small" for a in amounts]   # if/else goes BEFORE for
pairs  = [(o, i) for o in range(3) for i in range(2)]        # nested: outer loop first
flat   = [x for row in matrix for x in row]                  # flatten
```

[[exercise:py-comprehensions-2]]

--- step challenge: Invert and group
[[exercise:py-comprehensions-3]]

=== detailed
## Forms
| Form | Syntax | Result |
|---|---|---|
| list | `[f(x) for x in xs if p(x)]` | list |
| set | `{f(x) for x in xs}` | set |
| dict | `{k(x): v(x) for x in xs}` | dict |
| generator | `(f(x) for x in xs)` | lazy iterator |

## Filter vs conditional expression
- **Filter** (`if` after `for`) decides whether an item is included.
- **Conditional expression** (`a if cond else b` before `for`) decides what value is produced for every item.

## Nesting order
`[x for row in matrix for x in row]` reads like the equivalent loops written top to bottom:
```python
for row in matrix:
    for x in row:
        out.append(x)
```

## Generator expressions
`sum(o["amount"] for o in orders)` never builds the intermediate list — constant memory. Use them when you only iterate once (sum, max, any, all, join, writing to a file).

## Readability rules
- One `for` and one `if` → fine. Two `for`s → acceptable for flattening. More → write a loop.
- Don't use comprehensions for side effects (`[print(x) for x in xs]`).
- Name intermediate results; extract a helper function for complex transforms.

## Performance
Comprehensions are usually faster than the equivalent `append` loop (no attribute lookup for `append` per iteration), but the difference is small. Memory matters more: prefer generators for large data.

=== crisp
- `[f(x) for x in xs if cond]` · `{k: v for …}` · `{x for …}` · `(x for …)` (lazy).
- `if` **after** for = filter; `a if c else b` **before** for = choose value.
- Nested: outer loop first — `[x for row in m for x in row]`.
- Generator expressions in `sum/any/all/max/"".join` → no intermediate list.
- Keep it readable: complex logic → loop or helper function. No side effects.

=== memory
- **"Value, loop, filter."** `[value for item in items if test]`
- `if-else` at the front, plain `if` at the back.

=== data
flashcards:
  - q: "Where does a plain filter `if` go in a list comprehension?"
    a: "After the for: [x for x in xs if x > 0]"
  - q: "Where does `a if cond else b` go?"
    a: "Before the for: ['big' if x > 300 else 'small' for x in xs]"
  - q: "Flatten [[1,2],[3]] with a comprehension."
    a: "[x for row in rows for x in row]"
  - q: "Why use `sum(x for x in xs)` instead of `sum([x for x in xs])`?"
    a: "The generator avoids building an intermediate list (less memory)."
quiz:
  - q: "Which is valid Python?"
    options:
      - "[x for x in xs if x > 0 else 0]"
      - "[x if x > 0 else 0 for x in xs]"
      - "[for x in xs: x]"
      - "[x for x in xs where x > 0]"
    answer: 1
exercises:
  - id: py-comprehensions-1
    lang: python
    kind: coding
    difficulty: 1
    title: Clean amounts
    prompt: |
      Write `clean_amounts(values)` that takes a list of strings like `"1,200.50"`, `" 99 "`, `""`, `None` and returns a list of floats for the **non-empty** values (remove commas and spaces). Use a comprehension.
    starter: |
      def clean_amounts(values):
          return []
    solution: |
      def clean_amounts(values):
          return [float(v.replace(",", "").strip()) for v in values if v and v.strip()]
    tests:
      - call: "clean_amounts(['1,200.50', ' 99 ', '', None])"
        expect: "[1200.5, 99.0]"
      - call: "clean_amounts([])"
        expect: "[]"
        hidden: true
        label: empty list
      - call: "clean_amounts(['   '])"
        expect: "[]"
        hidden: true
        label: whitespace only
    hints:
      - "Filter with `if v and v.strip()`."
  - id: py-comprehensions-2
    lang: python
    kind: coding
    difficulty: 2
    title: Label and index
    prompt: |
      Write `index_orders(orders)` returning a dict `{order_id: label}` where label is `"large"` when amount ≥ 300, otherwise `"regular"` — skip cancelled orders. One dict comprehension.
    starter: |
      def index_orders(orders):
          pass
    solution: |
      def index_orders(orders):
          return {o["order_id"]: ("large" if o["amount"] >= 300 else "regular") for o in orders if o["status"] != "cancelled"}
    tests:
      - call: "index_orders([{'order_id': 1, 'amount': 300, 'status': 'delivered'}, {'order_id': 2, 'amount': 20, 'status': 'shipped'}, {'order_id': 3, 'amount': 900, 'status': 'cancelled'}])"
        expect: "{1: 'large', 2: 'regular'}"
    hints:
      - "{key: (a if cond else b) for o in orders if filter}"
  - id: py-comprehensions-3
    lang: python
    kind: coding
    difficulty: 2
    title: Customers per city
    prompt: |
      Write `customers_per_city(customers)` returning `{city: sorted list of names}`. Hint: a set comprehension for the cities, then a dict comprehension. (A `defaultdict` loop is also fine — compare readability.)
    starter: |
      def customers_per_city(customers):
          pass
    solution: |
      def customers_per_city(customers):
          cities = {c["city"] for c in customers}
          return {city: sorted(c["name"] for c in customers if c["city"] == city) for city in cities}
    tests:
      - call: "customers_per_city([{'name': 'B', 'city': 'Pune'}, {'name': 'A', 'city': 'Pune'}, {'name': 'C', 'city': 'Goa'}])"
        expect: "{'Pune': ['A', 'B'], 'Goa': ['C']}"
    explain: |
      This version is O(cities × customers). For large data the `defaultdict(list)` single-pass loop is O(n) — readability and complexity both matter.
interview:
  - q: "When would you not use a list comprehension?"
    type: concept
    level: 1
    keyPoints:
      - "complex logic with many conditions reduces readability"
      - "side effects like printing or writing"
      - "large data where a generator avoids memory use"
      - "error handling needs try/except in a loop"
