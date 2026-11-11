=== lesson
--- step concept: Lists are ordered, changeable collections
```python
ids = [101, 102, 103]
ids[0]       # 101  (index starts at 0)
ids[-1]      # 103  (last)
ids[1:3]     # [102, 103] (slice: start included, end excluded)
ids.append(104)          # add one item
ids.extend([105, 106])   # add many items
len(ids)                 # 6
```
> [!MISTAKE] `ids.append([105, 106])` adds **one** item — a nested list.

--- step concept: Sorting without surprises
- `sorted(xs)` returns a **new** list.
- `xs.sort()` sorts **in place** and returns `None`.

```python
orders = [{"id": 1, "amount": 50}, {"id": 2, "amount": 200}]
top = sorted(orders, key=lambda o: o["amount"], reverse=True)
```
[[quiz:py-lists-tuples:q0]]

--- step practice: Sort by two keys
Sorting by several keys: return a tuple from the key function. For "ascending then descending" on numbers, negate the number.

[[exercise:py-lists-tuples-1]]

--- step concept: Tuples are fixed records
```python
row = (101, "2025-03-01", 250.0)
order_id, order_date, amount = row      # unpacking
first, *rest = [1, 2, 3]               # first=1, rest=[2, 3]
```
Tuples can't change, so they are safe to share and can be **dict keys** or set members: `seen.add((customer_id, order_date))`.

[[quiz:py-lists-tuples:q1]]

--- step check: Copies vs references
`b = a` does **not** copy a list. `b = a.copy()` (or `a[:]`) makes a **shallow** copy — the outer list is new, but nested dicts are still shared.

[[quiz:py-lists-tuples:q2]]

--- step interview: Explain it
[[recall:py-lists-tuples:r0]]

=== detailed
## Lists
| Operation | Example | Notes |
|---|---|---|
| index | `xs[0]`, `xs[-1]` | IndexError if out of range |
| slice | `xs[1:4]`, `xs[::-1]` | returns a new list |
| add | `append(x)`, `extend(ys)`, `insert(i, x)` | in place |
| remove | `pop()`, `pop(i)`, `remove(x)` | `remove` deletes first match |
| search | `x in xs`, `xs.index(x)` | linear time — use a set for many lookups |
| combine | `xs + ys` | new list |

## Sorting
- `sorted(iterable, key=..., reverse=...)` — works on any iterable, returns a list.
- `list.sort()` — in place, returns `None`.
- Python's sort is **stable**: equal keys keep their original order, so you can sort in two passes (secondary key first, then primary).
- Multi-key: `key=lambda o: (o["channel"], -o["amount"])`.
- `operator.itemgetter("amount")` is a fast alternative to a lambda.

## Tuples
- Immutable, ordered; ideal for records with fixed positions.
- **Unpacking** makes code readable: `for order_id, amount in pairs:`.
- `namedtuple` or `@dataclass` adds field names when positions get confusing.
- Hashable (if their items are) → usable as dict keys for composite keys.

## Copies
```python
import copy
a = [{"id": 1}]
b = a.copy()           # shallow: b[0] is a[0]
c = copy.deepcopy(a)   # deep: nested dict copied too
```
> [!REAL] Pipelines often keep the raw batch and build a cleaned one. If you mutate the dicts of a shallow copy you also change the raw batch — and your "before vs after" counts lie.

## Performance notes
- Appending is fast; inserting at the front (`insert(0, x)`) is slow — use `collections.deque`.
- Membership tests on large lists are slow; convert to a `set` first.

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
  - q: "`[1, 2, 3, 4, 5][1:4]` is…"
    options: ["[1, 2, 3]", "[2, 3, 4]", "[1, 2, 3, 4]", "[2, 3, 4, 5]"]
    answer: 1
    explain: "Slices include the start index and exclude the end index."
  - q: "`b = a.copy()` where `a` is a list of dicts. Changing `b[0]['x']` also changes `a[0]['x']` because…"
    options: ["copy() is shallow — the dicts are shared", "copy() does nothing", "lists are immutable", "dicts are copied automatically"]
    answer: 0
    explain: "A shallow copy creates a new outer list holding the same inner objects. Use copy.deepcopy for nested data."
recall:
  - q: "Explain sorted vs sort, how to sort by multiple keys, and the shallow copy pitfall."
    keyPoints:
      - "sorted returns a new list"
      - "list.sort is in place and returns None"
      - "key function returning a tuple"
      - "negate numbers for descending inside a tuple"
      - "shallow copy shares nested objects"
      - "tuples are immutable and hashable"
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
