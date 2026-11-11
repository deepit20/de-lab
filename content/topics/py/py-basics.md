=== lesson
--- step concept: Names point to values
In Python a variable is a **name attached to a value**; the value carries the type, not the name.

```python
amount = 120        # int
amount = 120.5      # now a float — same name, new value
status = "paid"     # str
is_valid = True     # bool
manager = None      # "no value"
type(amount)        # <class 'float'>
```
Core types you'll use daily: `int`, `float`, `str`, `bool`, `None`, plus containers `list`, `tuple`, `dict`, `set`.

--- step concept: Truthiness
In an `if`, every value counts as true or false. These are **falsy**: `0`, `0.0`, `""`, `[]`, `{}`, `set()`, `None`, `False`. Everything else is truthy — including `[0]` and `"0"`.

```python
rows = []
if not rows:
    print("nothing to load")
```
[[quiz:py-basics:q0]]

--- step practice: Keep the zeros
In data, `0` is often a **valid value** (zero revenue), but truthiness treats it like "missing". Watch out.

[[exercise:py-basics-1]]

--- step concept: Mutable vs immutable, `is` vs `==`
- **Immutable:** `int`, `float`, `str`, `tuple`, `bool`, `None` — "changing" them creates a new value.
- **Mutable:** `list`, `dict`, `set` — changed in place, and every name pointing to them sees the change.

```python
a = [1, 2]; b = a; b.append(3)
print(a)      # [1, 2, 3]  — same list!
a == [1, 2, 3]  # True  — equal values
a is b          # True  — same object
x is None       # the correct way to test for None
```
[[quiz:py-basics:q1]]

--- step check: Operators that surprise
`7 / 2` is `3.5`, `7 // 2` is `3` (floor division), `7 % 2` is `1`, `2 ** 3` is `8`. `0.1 + 0.2 == 0.3` is **False** because of floating point — use `round()` or `decimal.Decimal` for money.

[[quiz:py-basics:q2]]

--- step interview: Explain it
[[recall:py-basics:r0]]

=== detailed
## Dynamic typing
Python checks types at **run time**. A name can be re-bound to any type. That makes scripts quick to write, and it is why tests and type hints (`def load(rows: list[dict]) -> int:`) matter in pipelines.

## Built-in types
| Type | Example | Mutable? | Typical DE use |
|---|---|---|---|
| `int` | `42` | no | counts, ids |
| `float` | `3.14` | no | measures (not money) |
| `str` | `"orders.csv"` | no | paths, names, SQL |
| `bool` | `True` | no | flags |
| `None` | `None` | — | missing value |
| `list` | `[1, 2]` | yes | rows, batches |
| `tuple` | `(1, "a")` | no | fixed records, dict keys |
| `dict` | `{"id": 1}` | yes | a JSON row, a config |
| `set` | `{1, 2}` | yes | unique ids, membership |

## Truthiness rules
Falsy: `False`, `None`, `0`, `0.0`, `""`, `[]`, `()`, `{}`, `set()`. Everything else is truthy.

> [!MISTAKE] `if amount:` skips rows with `amount == 0`. When zero is meaningful, test explicitly: `if amount is not None:`.

## Identity vs equality
- `==` compares **values**.
- `is` compares **identity** (same object in memory). Use it only for `None`, `True`, `False`.

## Mutability consequences
- Passing a list into a function lets the function modify the caller's list.
- **Default argument trap:** `def f(rows=[])` shares one list across all calls. Use `rows=None` and create the list inside.
- Copy with `list(xs)`, `xs[:]`, `dict(d)`, or `copy.deepcopy` for nested structures.

## Numbers
- `/` always returns float; `//` floor-divides; `%` remainder; `**` power.
- Floats are approximate. For money use `Decimal("10.10")` or integer paise/cents.
- `int("42")`, `float("3.5")`, `str(42)` convert; `int("abc")` raises `ValueError`.

=== crisp
- **Dynamic typing:** names point to objects; the object has the type. `type(x)`, `isinstance(x, int)`.
- Core types: `int`, `float`, `str`, `bool`, `None`; containers `list`, `tuple`, `dict`, `set`.
- **Mutable:** list, dict, set (change in place). **Immutable:** int, float, str, tuple, frozenset.
- **Falsy:** `0`, `0.0`, `""`, `[]`, `{}`, `set()`, `None`, `False` — everything else is truthy.
- `==` equality of value · `is` identity (same object) → use `is` only for `None`: `if x is None`.
- Division: `/` float, `//` floor, `%` remainder, `**` power. `0.1 + 0.2 != 0.3` → `math.isclose` or `Decimal` for money.
- Conversion: `int("42")`, `float("3.5")`, `str(7)`, `bool("")`.
- Assignment shares objects: `b = a` (same list!) vs `b = a.copy()`.

=== memory
- **"Empty is false."**
- **"`is` for None, `==` for everything else."**
- Floats are approximations — money goes in `Decimal`.

=== data
flashcards:
  - q: "Name five falsy values."
    a: "0, 0.0, '', [], {}, None, False (any five)."
  - q: "When should you use `is` instead of `==`?"
    a: "For identity checks — practically only `x is None`."
  - q: "Why is 0.1 + 0.2 == 0.3 False?"
    a: "Binary floating point cannot represent 0.1 exactly; use math.isclose or Decimal."
  - q: "After `b = a` where a is a list, what happens on b.append(1)?"
    a: "a changes too — both names refer to the same list."
quiz:
  - q: "`bool([0])` is…"
    options: ["False", "True", "error", "None"]
    answer: 1
    explain: "A non-empty list is truthy, even if it contains 0."
  - q: "`a = [1]; b = a; b.append(2)`. What is `a`?"
    options: ["error", "[1, 2]", "[1]", "[2]"]
    answer: 1
    explain: "Both names point to the same list object, so the change is visible through `a`."
  - q: "Which is the correct way to test for a missing value?"
    options: ["x is None", "x == None", "not x", "x == ''"]
    answer: 0
    explain: "`is None` checks identity with the single None object; `not x` would also catch 0 and empty strings."
recall:
  - q: "Explain truthiness and mutability in Python and a bug each one can cause in a pipeline."
    keyPoints:
      - "0, empty containers, None are falsy"
      - "if amount: drops zero values"
      - "lists and dicts are mutable"
      - "two names can point to the same object"
      - "default mutable argument trap"
      - "use is None, not == None"
exercises:
  - id: py-basics-1
    lang: python
    kind: predict
    difficulty: 1
    title: Truthiness filter
    prompt: |
      Write `non_empty(values)` returning only the values that are **truthy**, but keep the number `0` (zero is a valid amount!). `None`, `""`, `[]` must be dropped.
    starter: |
      def non_empty(values):
          pass
    solution: |
      def non_empty(values):
          return [v for v in values if not isinstance(v, bool) and (v or v == 0)]
    tests:
      - call: "non_empty([0, None, '', 5, [], 'a', 0.0])"
        expect: "[0, 5, 'a', 0.0]"
      - call: "non_empty([False, None])"
        expect: "[]"
        hidden: true
        label: False is not a number here
    hints:
      - "`if v` drops 0 — add an explicit check for numeric zero."
      - "bool is a subclass of int in Python: False == 0 is True!"
interview:
  - q: "What is the difference between mutable and immutable types in Python, and why does it matter?"
    type: concept
    level: 1
    keyPoints:
      - "mutable objects can change in place: list dict set"
      - "immutable cannot: int str tuple"
      - "shared references see mutations"
      - "only immutable objects are hashable dict keys"
      - "mutable default arguments bug"
