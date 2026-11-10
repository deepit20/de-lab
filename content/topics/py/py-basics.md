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
