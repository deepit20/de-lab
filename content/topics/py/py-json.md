=== lesson
--- step concept: JSON is how systems talk
APIs, event streams and NoSQL exports use **JSON**: objects (`{}` → dict), arrays (`[]` → list), strings, numbers, `true/false` (→ True/False), `null` (→ None).
```python
import json
payload = '{"id": 7, "user": {"id": 3, "tier": "gold"}, "items": [{"sku": "A1", "qty": 2}]}'
event = json.loads(payload)        # str  -> Python objects
event["user"]["tier"]               # 'gold'
text = json.dumps(event, indent=2)  # Python -> str
```
`load/dump` work with files; `loads/dumps` with strings.

> [!WHY] Warehouses want **flat tables**; sources send **nested JSON**. Flattening safely — with missing keys, nulls and arrays — is core DE work.

[[quiz:py-json:q0]]

--- step example: JSON Lines
Large event files are usually **JSON Lines** (`.jsonl`): one JSON object per line. Read it line by line:
```python
with open("/data/events.jsonl") as f:
    events = [json.loads(line) for line in f if line.strip()]
```
`json.load(f)` on a JSONL file fails with *Extra data* — a classic error.

--- step practice: Flatten an event
[[exercise:py-json-1]]

--- step practice: Count events from JSONL
[[exercise:py-json-2]]

--- step challenge: Explode arrays to rows
[[exercise:py-json-3]]
[[recall:py-json:r0]]

=== detailed
## Mapping
| JSON | Python |
|---|---|
| object | dict |
| array | list |
| string | str |
| number | int / float |
| true / false | True / False |
| null | None |

Dates have **no JSON type** — they arrive as strings (ISO 8601 hopefully) or epoch numbers; parse explicitly.

## API
- `json.loads(s)`, `json.load(f)` — parse.
- `json.dumps(obj, indent=2, sort_keys=True, default=str, ensure_ascii=False)` — serialise. `default=str` handles datetimes/Decimals.
- Errors: `json.JSONDecodeError` (subclass of ValueError) with line/column.

## Safe navigation of nested data
```python
tier = (event.get("user") or {}).get("tier")              # handles missing AND null user
sku = event.get("items", [{}])[0].get("sku") if event.get("items") else None
```
For deep paths write a helper: `def dig(d, *keys, default=None)`.

## Flattening patterns
- **Nested objects → columns**: `user.id`, `user.tier` (pandas `json_normalize` does this).
- **Arrays → child rows**: one row per item with the parent id (relational) — or keep as `ARRAY<STRUCT>` in BigQuery and `UNNEST` later.
- **Schema drift**: new keys appear, types change (`"qty": "2"`). Decide: ignore unknown keys, store raw JSON in a `payload` column, or fail.

> [!REAL] A robust ingestion stores the **raw payload** (bronze layer) and flattens into typed columns downstream. When a parsing bug is found you can re-process history from raw.

## Performance
`json` is fine for MBs. For GBs: stream JSONL, use `orjson` (fast), or let the warehouse parse (`JSON_VALUE` in BigQuery, `from_json` in Spark).

## Common mistakes
> [!MISTAKE] `json.load` on JSON Lines.

> [!MISTAKE] `event["user"]["tier"]` when user is missing or null → KeyError/TypeError.

> [!MISTAKE] Assuming numbers are numbers — APIs often send strings.

=== crisp
- `json.loads` (str→obj), `json.load` (file→obj), `dumps/dump` (obj→str/file).
- object→dict, array→list, null→None, true→True. No date type.
- JSON Lines: `json.loads(line)` per line — `json.load` fails with "Extra data".
- Safe access: `(d.get("user") or {}).get("tier")`.
- Flatten objects → prefixed columns; arrays → child rows (or keep nested + UNNEST).
- Keep the raw payload; parse downstream; expect schema drift.
- `dumps(default=str)` for datetimes/Decimals.

=== memory
- **"s = string":** load**s**/dump**s** work on strings.
- **"One line, one event"** for JSONL.
- Trigger: *"JSONDecodeError: Extra data"* → it's JSONL.
- Trigger: *"'NoneType' object is not subscriptable"* → a null nested object.

=== data
flashcards:
  - q: "json.load vs json.loads?"
    a: "load reads from a file object; loads parses a string."
  - q: "How do you read a JSON Lines file?"
    a: "Iterate the file and json.loads each non-empty line."
  - q: "Safe way to read event['user']['tier'] when user may be missing or null?"
    a: "(event.get('user') or {}).get('tier')"
  - q: "What does JSON null become in Python?"
    a: "None"
  - q: "How do you serialise a dict containing datetimes?"
    a: "json.dumps(obj, default=str) (or convert to ISO strings first)."
quiz:
  - q: "`json.load(open('events.jsonl'))` raises 'Extra data'. Why?"
    options: ["file is empty", "the file has one JSON object per line", "wrong encoding", "the JSON is nested"]
    answer: 1
recall:
  - q: "How would you ingest nested JSON events into a warehouse table robustly?"
    keyPoints:
      - "store the raw payload"
      - "parse with safe access for missing or null keys"
      - "flatten nested objects into columns"
      - "explode arrays into child rows or keep nested"
      - "handle schema drift and type changes"
      - "validate and quarantine bad records"
exercises:
  - id: py-json-1
    lang: python
    kind: coding
    difficulty: 2
    title: Flatten an event
    prompt: |
      Write `flatten(event)` for events like `{"id": 1, "user": {"id": 3, "tier": "gold"}, "type": "purchase", "amount": "12.5"}` returning
      `{"id": 1, "user_id": 3, "user_tier": "gold", "type": "purchase", "amount": 12.5}`.
      `user` may be missing or `null` (→ `user_id`/`user_tier` = None); `amount` may be missing (→ None) and may arrive as a string.
    starter: |
      def flatten(event):
          pass
    solution: |
      def flatten(event):
          user = event.get("user") or {}
          amount = event.get("amount")
          return {
              "id": event.get("id"),
              "user_id": user.get("id"),
              "user_tier": user.get("tier"),
              "type": event.get("type"),
              "amount": float(amount) if amount is not None else None,
          }
    tests:
      - call: "flatten({'id': 1, 'user': {'id': 3, 'tier': 'gold'}, 'type': 'purchase', 'amount': '12.5'})"
        expect: "{'id': 1, 'user_id': 3, 'user_tier': 'gold', 'type': 'purchase', 'amount': 12.5}"
      - call: "flatten({'id': 2, 'user': None, 'type': 'page_view'})"
        expect: "{'id': 2, 'user_id': None, 'user_tier': None, 'type': 'page_view', 'amount': None}"
        hidden: true
        label: null user and missing amount
    hints:
      - "user = event.get('user') or {} covers both missing and null."
  - id: py-json-2
    lang: python
    kind: coding
    difficulty: 2
    title: Event types from JSON Lines
    prompt: |
      Write `count_types(path)` that reads `/data/events.jsonl` (one JSON object per line, key `type`) and returns a dict `{type: count}`. Skip blank lines.
    starter: |
      import json

      def count_types(path):
          pass

      print(count_types("/data/events.jsonl"))
    solution: |
      import json
      from collections import Counter

      def count_types(path):
          counts = Counter()
          with open(path, encoding="utf-8") as f:
              for line in f:
                  if line.strip():
                      counts[json.loads(line)["type"]] += 1
          return dict(counts)

      print(count_types("/data/events.jsonl"))
    tests:
      - call: "sum(count_types('/data/events.jsonl').values())"
        expect: "400"
      - call: "sorted(count_types('/data/events.jsonl'))"
        expect: "['add_to_cart', 'page_view', 'purchase']"
    hints:
      - "json.loads per line; Counter for counting."
  - id: py-json-3
    lang: python
    kind: coding
    difficulty: 3
    title: Explode order items
    prompt: |
      Orders arrive as `{"order_id": 5, "items": [{"sku": "A", "qty": 2, "price": 3.0}, …]}`. Write `explode(orders)` returning one dict per item: `{"order_id", "sku", "qty", "line_total"}` (qty × price). Orders with no `items` key or an empty list produce no rows.
    starter: |
      def explode(orders):
          pass
    solution: |
      def explode(orders):
          rows = []
          for o in orders:
              for it in o.get("items") or []:
                  rows.append({"order_id": o["order_id"], "sku": it["sku"], "qty": it["qty"], "line_total": round(it["qty"] * it["price"], 2)})
          return rows
    tests:
      - call: "explode([{'order_id': 5, 'items': [{'sku': 'A', 'qty': 2, 'price': 3.0}, {'sku': 'B', 'qty': 1, 'price': 9.99}]}])"
        expect: "[{'order_id': 5, 'sku': 'A', 'qty': 2, 'line_total': 6.0}, {'order_id': 5, 'sku': 'B', 'qty': 1, 'line_total': 9.99}]"
      - call: "explode([{'order_id': 6}, {'order_id': 7, 'items': []}, {'order_id': 8, 'items': None}])"
        expect: "[]"
        hidden: true
        label: missing / empty / null items
interview:
  - q: "How do you handle schema changes in JSON source data?"
    type: scenario
    level: 2
    keyPoints:
      - "store raw payload so you can reprocess"
      - "tolerate new optional fields"
      - "detect type changes with validation"
      - "schema registry or data contracts with producers"
      - "alert and quarantine instead of silently dropping"
