=== lesson
--- step concept: Lookups in constant time
A **dict** maps keys to values; a **set** holds unique keys. Both are hash tables: checking `key in d` takes about the same time whether the dict has 10 or 10 million entries (average O(1)). A list must scan element by element (O(n)).

```python
customer = {"id": 7, "name": "Isha", "city": "Pune"}
customer["city"]            # 'Pune'
customer.get("email")       # None instead of KeyError
customer.get("email", "-")  # default
seen = {1, 2, 3}
2 in seen                   # True, fast
```
> [!WHY] Joins in Python (enrich orders with customer data), deduplication and counting are all dict/set problems. Choosing a dict instead of a nested loop turns minutes into milliseconds.

[[quiz:py-dicts-sets:q0]]

--- step example: Counting and grouping
```python
from collections import Counter, defaultdict

statuses = ["delivered", "shipped", "delivered", "cancelled"]
Counter(statuses)                    # Counter({'delivered': 2, 'shipped': 1, 'cancelled': 1})

by_city = defaultdict(list)
for c in customers:
    by_city[c["city"]].append(c["name"])

totals = {}
for o in orders:
    totals[o["customer_id"]] = totals.get(o["customer_id"], 0) + o["amount"]
```

--- step practice: Group revenue by key
[[exercise:py-dicts-sets-1]]

--- step practice: A hash join in Python
[[exercise:py-dicts-sets-2]]

--- step challenge: Set operations for data checks
[[exercise:py-dicts-sets-3]]
[[recall:py-dicts-sets:r0]]

=== detailed
## Dictionaries
- Keys must be **hashable** (immutable: str, int, tuple of immutables). Lists cannot be keys.
- Insertion order is preserved (Python 3.7+).
- Access: `d[k]` (KeyError if missing), `d.get(k, default)`, `d.setdefault(k, [])`.
- Iterate: `for k, v in d.items()`.
- Merge: `{**a, **b}` or `a | b` (3.9+) — right side wins.
- Remove: `d.pop(k, None)`, `del d[k]`.

## Sets
- Unique, unordered, hashable elements; `set()` for empty (`{}` is an empty dict!).
- Operations: `a | b` union, `a & b` intersection, `a - b` difference, `a ^ b` symmetric difference, `a <= b` subset.
- Ideal for: deduplication, membership tests, comparing key sets between source and target.

## collections helpers
| Tool | Use |
|---|---|
| `Counter` | frequencies, `most_common(n)` |
| `defaultdict(list/int)` | group/accumulate without key checks |
| `OrderedDict` | rarely needed now; has `move_to_end` (LRU caches) |
| `namedtuple` | lightweight records |

## Complexity
| Operation | list | set/dict |
|---|---|---|
| `x in` | O(n) | O(1) average |
| append/add | O(1) | O(1) |
| lookup by key | — | O(1) |

> [!PERF] `for o in orders: for c in customers: if c["id"] == o["customer_id"]` is O(n·m). Building `cust_by_id = {c["id"]: c for c in customers}` first makes the join O(n + m) — the same idea as a hash join in a database.

## Data engineering uses
- Hash joins / enrichment in small batch jobs.
- Deduplication by key (keep latest: `latest[key] = rec if newer`).
- Reconciliation: `source_ids - target_ids` = missing rows.
- Config and parsed JSON are dicts.

## Common mistakes
> [!MISTAKE] `d[k]` on optional fields from APIs → KeyError. Use `.get`.

> [!MISTAKE] Mutating a dict while iterating it (`RuntimeError: dictionary changed size`). Iterate over `list(d)`.

> [!MISTAKE] `{}` meaning an empty set.

=== crisp
- dict = key → value hash table; set = unique keys. Membership & lookup ≈ O(1).
- Keys must be hashable (str, int, tuple). Order preserved (3.7+).
- `d.get(k, default)` for optional keys; `d.items()` to iterate pairs.
- `Counter` for counts, `defaultdict(list)` for grouping, `d.get(k, 0) + x` for sums.
- Sets: `|` union, `&` intersection, `-` difference. `set()` is empty set; `{}` is a dict.
- Replace nested loops with a dict lookup → hash join, O(n+m).
- Don't modify a dict while iterating over it.

=== memory
- **"Lists search, dicts know."**
- **"Missing in target = source − target."**
- Trigger: *"script is slow with nested loops"* → build a dict index first.
- Trigger: *"KeyError on API data"* → `.get()`.

=== data
flashcards:
  - q: "Average time complexity of `x in some_set` vs `x in some_list`?"
    a: "Set: O(1). List: O(n)."
  - q: "How do you find IDs present in the source but missing in the target?"
    a: "set(source_ids) - set(target_ids)"
  - q: "Why can't a list be a dict key?"
    a: "Lists are mutable, therefore not hashable. Use a tuple."
  - q: "Count occurrences of each status in a list?"
    a: "collections.Counter(statuses)"
  - q: "What is `{}`?"
    a: "An empty dict. Use set() for an empty set."
quiz:
  - q: "Enriching 1M orders with 100k customers, the fastest approach is…"
    options:
      - "nested loop over both lists"
      - "build a dict {customer_id: customer} then look up per order"
      - "sort both lists then compare"
      - "convert both to strings"
    answer: 1
recall:
  - q: "Explain how you would join two lists of records in Python efficiently and why it is fast."
    keyPoints:
      - "build a dict keyed by the join key"
      - "single pass over the other list with lookups"
      - "hash table lookup is O(1) average"
      - "O(n + m) instead of O(n * m)"
      - "handle missing keys with get"
exercises:
  - id: py-dicts-sets-1
    lang: python
    kind: coding
    difficulty: 1
    title: Revenue per customer
    prompt: |
      Write `revenue_by_customer(orders)` where `orders` is a list of dicts with `customer_id`, `status`, `amount`. Return a dict `{customer_id: total_amount}` for non-cancelled orders, with totals rounded to 2 decimals.
    starter: |
      def revenue_by_customer(orders):
          totals = {}
          return totals
    solution: |
      def revenue_by_customer(orders):
          totals = {}
          for o in orders:
              if o["status"] == "cancelled":
                  continue
              totals[o["customer_id"]] = totals.get(o["customer_id"], 0) + o["amount"]
          return {k: round(v, 2) for k, v in totals.items()}
    tests:
      - call: "revenue_by_customer([{'customer_id': 1, 'status': 'delivered', 'amount': 10.5}, {'customer_id': 1, 'status': 'shipped', 'amount': 4.5}, {'customer_id': 2, 'status': 'cancelled', 'amount': 99}])"
        expect: "{1: 15.0}"
      - call: "revenue_by_customer([])"
        expect: "{}"
        hidden: true
        label: empty input
      - call: "revenue_by_customer([{'customer_id': 3, 'status': 'delivered', 'amount': 0.1}, {'customer_id': 3, 'status': 'delivered', 'amount': 0.2}])"
        expect: "{3: 0.3}"
        hidden: true
        label: float rounding
    hints:
      - "totals.get(key, 0) + amount"
  - id: py-dicts-sets-2
    lang: python
    kind: coding
    difficulty: 2
    title: Enrich orders with customer city
    prompt: |
      Write `enrich(orders, customers)` returning a **new** list of order dicts, each with an added `city` key from the matching customer (`customers` have `customer_id` and `city`). Unknown customers get `city = None`. Do not use a nested loop.
    starter: |
      def enrich(orders, customers):
          pass
    solution: |
      def enrich(orders, customers):
          city_by_id = {c["customer_id"]: c["city"] for c in customers}
          return [{**o, "city": city_by_id.get(o["customer_id"])} for o in orders]
    tests:
      - call: "enrich([{'order_id': 1, 'customer_id': 7}], [{'customer_id': 7, 'city': 'Pune'}])"
        expect: "[{'order_id': 1, 'customer_id': 7, 'city': 'Pune'}]"
      - call: "enrich([{'order_id': 2, 'customer_id': 99}], [{'customer_id': 7, 'city': 'Pune'}])"
        expect: "[{'order_id': 2, 'customer_id': 99, 'city': None}]"
        hidden: true
        label: unknown customer
    check: |
      src = [{'order_id': 1, 'customer_id': 7}]
      enrich(src, [{'customer_id': 7, 'city': 'Pune'}])
      assert 'city' not in src[0], "enrich() modified the input list — build new dicts with {**o, ...}"
    hints:
      - "Build a dict customer_id → city first."
      - "{**o, 'city': ...} creates a new dict without changing the original."
  - id: py-dicts-sets-3
    lang: python
    kind: scenario
    difficulty: 2
    title: Reconcile source and target IDs
    prompt: |
      After a load, compare key lists. Write `reconcile(source_ids, target_ids)` returning a dict with:
      - `missing` — sorted list of ids in source but not target
      - `unexpected` — sorted list in target but not source
      - `duplicates_in_source` — sorted list of ids appearing more than once in source
    starter: |
      def reconcile(source_ids, target_ids):
          pass
    solution: |
      from collections import Counter
      def reconcile(source_ids, target_ids):
          s, t = set(source_ids), set(target_ids)
          dup = [k for k, n in Counter(source_ids).items() if n > 1]
          return {"missing": sorted(s - t), "unexpected": sorted(t - s), "duplicates_in_source": sorted(dup)}
    tests:
      - call: "reconcile([1, 2, 3, 3, 4], [1, 2, 5])"
        expect: "{'missing': [3, 4], 'unexpected': [5], 'duplicates_in_source': [3]}"
      - call: "reconcile([], [])"
        expect: "{'missing': [], 'unexpected': [], 'duplicates_in_source': []}"
        hidden: true
        label: empty lists
    hints:
      - "Set difference both ways; Counter for duplicates."
interview:
  - q: "When would you use a dict or set instead of a list in a data processing script?"
    type: concept
    level: 1
    keyPoints:
      - "fast membership and lookups O(1)"
      - "deduplication"
      - "joining / enrichment by key"
      - "counting and grouping"
      - "list for ordered sequences / iteration"
