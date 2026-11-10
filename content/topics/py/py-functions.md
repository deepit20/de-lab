=== lesson
--- step concept: Functions are the unit of a pipeline
A function takes inputs, does one job and returns an output. Pipelines are just functions composed: `load(transform(extract()))`.
```python
def net_amount(amount, discount_pct=0.0, tax_pct=18.0):
    """Return the amount after discount, plus tax, rounded to 2 decimals."""
    discounted = amount * (1 - discount_pct / 100)
    return round(discounted * (1 + tax_pct / 100), 2)

net_amount(100)                    # positional
net_amount(100, tax_pct=5)         # keyword — clearer
```
> [!WHY] Small **pure** functions (output depends only on inputs, no side effects) are easy to test, reuse and reason about — the foundation of reliable transformations.

[[quiz:py-functions:q0]]

--- step practice: Write a pure transform
[[exercise:py-functions-1]]

--- step concept: *args, **kwargs and scope
```python
def log(event, *args, **fields):     # args -> tuple, fields -> dict
    print(event, args, fields)
log("loaded", 3, table="orders", rows=120)
```
**Scope (LEGB):** Local → Enclosing → Global → Built-in. Assigning to a name inside a function makes it local.

--- step check: The mutable default trap
```python
def add_tag(tag, tags=[]):     # ✗ the SAME list is reused across calls
    tags.append(tag)
    return tags
add_tag("a"); add_tag("b")      # ['a', 'b'] !
```
Default values are evaluated **once**, when the function is defined. Use `tags=None` and create the list inside.

[[exercise:py-functions-2]]

--- step challenge: Compose a mini pipeline
[[exercise:py-functions-3]]
[[recall:py-functions:r0]]

=== detailed
## Defining functions
- `def name(params): """docstring"""; return value` — no `return` means `None`.
- Return several values as a tuple: `return total, count` → `t, c = f()`.
- Type hints document intent: `def f(rows: list[dict], limit: int = 10) -> int:` (not enforced at runtime).

## Parameters
| Kind | Example | Notes |
|---|---|---|
| positional | `f(1, 2)` | order matters |
| keyword | `f(a=1, b=2)` | self-documenting |
| default | `def f(a, b=2)` | evaluated **once** at definition |
| `*args` | `def f(*args)` | extra positionals as tuple |
| `**kwargs` | `def f(**kw)` | extra keywords as dict |
| keyword-only | `def f(a, *, dry_run=False)` | must be passed by name — great for flags |

Unpacking at the call site: `f(*my_list, **my_dict)`.

## Scope
LEGB lookup. Reading a global inside a function works; **assigning** creates a local unless declared `global`/`nonlocal`. Avoid globals — pass values in, return results.

## Pure functions and side effects
A **pure** function: same inputs → same outputs, no external changes (no file writes, no mutation of arguments). Keep transformations pure; push I/O (reading files, calling APIs, writing to the warehouse) to the edges. Then:
- unit tests need no files or network,
- retries are safe,
- logic can move to Spark/Airflow unchanged.

## Mutating arguments
Lists and dicts are passed by **object reference**: a function that appends to a list argument changes the caller's list. Return new objects instead (`[*rows, new]`, `{**d, "k": v}`) unless mutation is the documented purpose.

## Functions are objects
They can be passed around (`sorted(rows, key=get_amount)`), stored in dicts (dispatch tables: `{"csv": read_csv, "json": read_json}[fmt](path)`), and returned (closures, decorators).

## Common mistakes
> [!MISTAKE] Mutable default arguments.

> [!MISTAKE] Forgetting `return` → function returns None → `'NoneType' object is not subscriptable` later.

> [!MISTAKE] Functions that both compute and print/write — hard to test.

> [!MISTAKE] Huge functions; aim for one responsibility each.

=== crisp
- `def f(a, b=2, *args, c, **kw)`; no return → `None`.
- Keyword args for clarity; keyword-only (`*, dry_run=False`) for flags.
- Defaults evaluated **once** → never `def f(x=[])`; use `None`.
- LEGB scope; assigning inside makes a local. Avoid globals.
- Lists/dicts are passed by reference → mutation leaks to the caller. Return new objects.
- **Pure functions** for transforms; I/O at the edges → testable & retry-safe.
- Functions are values: pass as `key=`, store in dicts (dispatch).

=== memory
- **"Defaults are baked once."**
- **"Pure in the middle, I/O at the edges."**
- Trigger: *"'NoneType' object is not subscriptable"* → missing return.
- Trigger: *"list keeps growing between calls"* → mutable default.

=== data
flashcards:
  - q: "Why is `def f(items=[])` dangerous?"
    a: "The default list is created once and shared across calls, so it accumulates values."
  - q: "What does a function without a return statement return?"
    a: "None."
  - q: "What is a pure function and why do pipelines like them?"
    a: "Output depends only on inputs, no side effects → easy to test, reuse, retry and parallelise."
  - q: "What do *args and **kwargs collect?"
    a: "*args: extra positional arguments as a tuple; **kwargs: extra keyword arguments as a dict."
  - q: "How do you force a parameter to be passed by keyword?"
    a: "Put it after a bare *: def run(path, *, dry_run=False)."
quiz:
  - q: "`def f(x, acc=[]): acc.append(x); return acc` — what does `f(1); print(f(2))` print?"
    options: ["[2]", "[1, 2]", "[1]", "error"]
    answer: 1
    explain: "The same default list is reused."
recall:
  - q: "Why should data transformation logic be written as small pure functions?"
    keyPoints:
      - "same input gives same output"
      - "no side effects"
      - "easy to unit test without files or network"
      - "safe to retry"
      - "reusable and composable"
      - "I/O at the edges"
exercises:
  - id: py-functions-1
    lang: python
    kind: coding
    difficulty: 1
    title: A pure transform
    prompt: |
      Write `to_record(row)` that converts a raw CSV row dict (all values strings) into a typed record **without modifying the input**:
      `{'order_id': '12', 'amount': '99.50', 'status': ' Delivered '}` → `{'order_id': 12, 'amount': 99.5, 'status': 'delivered'}`.
    starter: |
      def to_record(row):
          pass
    solution: |
      def to_record(row):
          return {"order_id": int(row["order_id"]), "amount": float(row["amount"]), "status": row["status"].strip().lower()}
    tests:
      - call: "to_record({'order_id': '12', 'amount': '99.50', 'status': ' Delivered '})"
        expect: "{'order_id': 12, 'amount': 99.5, 'status': 'delivered'}"
    check: |
      r = {'order_id': '1', 'amount': '2', 'status': 'X'}
      to_record(r)
      assert r == {'order_id': '1', 'amount': '2', 'status': 'X'}, "The input dict was modified — return a new dict instead."
    hints:
      - "Return a brand-new dict built from the row values."
  - id: py-functions-2
    lang: python
    kind: debug
    difficulty: 2
    title: "Debug: the batch that remembers"
    prompt: |
      `make_batch` should return a list of the given ids with a header marker, but each call returns ids from previous calls too. Fix it **without changing how it is called**.
    starter: |
      def make_batch(ids, batch=[]):
          batch.append("HEADER")
          for i in ids:
              batch.append(i)
          return batch
    solution: |
      def make_batch(ids, batch=None):
          if batch is None:
              batch = []
          batch.append("HEADER")
          for i in ids:
              batch.append(i)
          return batch
    tests:
      - call: "make_batch([1, 2])"
        expect: "['HEADER', 1, 2]"
      - call: "(make_batch([1]), make_batch([2]))[1]"
        expect: "['HEADER', 2]"
        label: second call is independent
    hints:
      - "When is the default list created?"
      - "Use None as the default and create the list inside."
  - id: py-functions-3
    lang: python
    kind: coding
    difficulty: 2
    title: Compose a mini pipeline
    prompt: |
      Write three small functions and compose them:
      - `parse(lines)` — list of `"id,amount"` strings → list of `(int, float)`; skip blank lines
      - `keep_positive(records)` — keep amount > 0
      - `total(records)` — sum of amounts rounded to 2
      - `run(lines)` — returns `total(keep_positive(parse(lines)))`
    starter: |
      def parse(lines):
          pass

      def keep_positive(records):
          pass

      def total(records):
          pass

      def run(lines):
          return total(keep_positive(parse(lines)))
    solution: |
      def parse(lines):
          out = []
          for line in lines:
              if not line.strip():
                  continue
              i, a = line.split(",")
              out.append((int(i), float(a)))
          return out

      def keep_positive(records):
          return [r for r in records if r[1] > 0]

      def total(records):
          return round(sum(a for _, a in records), 2)

      def run(lines):
          return total(keep_positive(parse(lines)))
    tests:
      - call: "parse(['1,10.5', '', '2,-3'])"
        expect: "[(1, 10.5), (2, -3.0)]"
      - call: "run(['1,10.5', '', '2,-3', '3,4.25'])"
        expect: "14.75"
      - call: "run([])"
        expect: "0"
        hidden: true
        label: empty input
interview:
  - q: "What are *args and **kwargs? And what is the problem with mutable default arguments?"
    type: concept
    level: 1
    keyPoints:
      - "*args collects extra positional args as tuple"
      - "**kwargs collects extra keyword args as dict"
      - "defaults evaluated once at definition"
      - "mutable default shared across calls"
      - "use None and create inside"
