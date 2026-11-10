=== lesson
--- step concept: Nested and repeated data
BigQuery tables can store **STRUCT** (a record with named fields) and **ARRAY** (a repeated list) columns. An order can carry its items inside one row:
```
order_id | customer STRUCT<id, tier> | items ARRAY<STRUCT<sku, qty, price>>
1001     | {id: 7, tier: 'gold'}     | [{sku:'A', qty:2, price:3.0}, {sku:'B', qty:1, price:9.9}]
```
> [!WHY] Storing children with their parent avoids a join on every query and matches the shape of JSON sources. It's Google's recommended denormalisation for BigQuery.

Access struct fields with dots: `customer.tier`. Turn an array into rows with **UNNEST**:
```sql
SELECT o.order_id, i.sku, i.qty * i.price AS line_total
FROM orders o, UNNEST(o.items) AS i;           -- comma = CROSS JOIN (correlated)
```

[[quiz:bq-nested:q0]]

--- step example: Keeping orders with no items
`, UNNEST(items)` is an inner (cross) join → orders with an **empty array disappear**. Use `LEFT JOIN UNNEST(o.items) AS i` to keep them.

Aggregating back into arrays:
```sql
SELECT customer_id, ARRAY_AGG(STRUCT(order_id, amount) ORDER BY order_date DESC LIMIT 5) AS last_5_orders
FROM orders GROUP BY customer_id;
```

--- step practice: UNNEST in the practice database
The practice engine is SQLite, whose `json_each()` plays the role of `UNNEST` for a JSON array — the reasoning is identical.

[[exercise:bq-nested-1]]

--- step check: Write the BigQuery version
[[exercise:bq-nested-2]]
[[recall:bq-nested:r0]]

=== detailed
## Types
- `STRUCT<a INT64, b STRING>` — a record; access `col.a`. Can nest.
- `ARRAY<T>` — ordered list of same-typed elements; no NULL elements in stored arrays; an ARRAY of STRUCT is the usual "child rows" pattern.
- Schema mode in load jobs: a field with mode **REPEATED** is an array; **RECORD** is a struct.

## UNNEST patterns
```sql
-- flatten
SELECT o.order_id, item.sku FROM orders o CROSS JOIN UNNEST(o.items) AS item;
-- keep parents with empty arrays
SELECT o.order_id, item.sku FROM orders o LEFT JOIN UNNEST(o.items) AS item;
-- position
SELECT o.order_id, item, pos FROM orders o, UNNEST(o.items) AS item WITH OFFSET AS pos;
-- filter parents by a child property (no flattening in output)
SELECT order_id FROM orders WHERE EXISTS (SELECT 1 FROM UNNEST(items) i WHERE i.sku = 'A');
-- aggregate inside a row
SELECT order_id, (SELECT SUM(i.qty * i.price) FROM UNNEST(items) i) AS order_total FROM orders;
```

## Building nested data
`ARRAY_AGG(STRUCT(...))` with optional `ORDER BY` / `LIMIT` inside; `ARRAY_LENGTH(arr)`; `ARRAY_CONCAT`; `GENERATE_DATE_ARRAY` + `UNNEST` for date spines.

## JSON
- Native `JSON` type plus `JSON_VALUE(j, '$.user.id')`, `JSON_QUERY`, `JSON_EXTRACT_ARRAY` → `UNNEST`.
- Load JSON into typed STRUCT/ARRAY columns when the schema is stable (faster, cheaper); keep `JSON` for volatile payloads.

## Performance and cost
- Nested columns are columnar too: selecting `items.sku` reads only that sub-column.
- Avoids join shuffles for parent-child data that's always queried together.
- But unnesting huge arrays multiplies rows; aggregate inside the row (`SELECT … FROM UNNEST(...)`) where possible.
- Updating one child element means rewriting the parent row — nested models suit append-mostly data.

## Common mistakes
> [!MISTAKE] Comma-UNNEST dropping parents with empty arrays.

> [!MISTAKE] Summing a parent-level value after UNNEST → multiplied by the number of children (the same fan-out as joins!).

> [!MISTAKE] Forgetting the alias — `UNNEST(items)` without `AS i` then referencing fields ambiguously.

=== crisp
- `STRUCT` = record (`col.field`); `ARRAY` = repeated values; `ARRAY<STRUCT>` = child rows inside the parent.
- Flatten: `FROM t, UNNEST(t.arr) AS x` (cross join — drops empty arrays) or `LEFT JOIN UNNEST(t.arr) AS x` (keeps parents).
- `WITH OFFSET` for positions; `EXISTS (SELECT 1 FROM UNNEST(arr) x WHERE …)` to filter parents.
- Per-row aggregates without flattening: `(SELECT SUM(x.v) FROM UNNEST(arr) x)`.
- Build arrays: `ARRAY_AGG(STRUCT(...) ORDER BY … LIMIT n)`.
- JSON: `JSON_VALUE`, `JSON_EXTRACT_ARRAY` + UNNEST; typed STRUCTs for stable schemas.
- Benefits: no join, columnar sub-fields. Watch fan-out after UNNEST.

=== memory
- **"UNNEST turns a list into rows; ARRAY_AGG turns rows back into a list."**
- **"Comma UNNEST drops the childless."**

=== data
flashcards:
  - q: "What does UNNEST do?"
    a: "Turns an ARRAY into a set of rows that can be joined to the parent row."
  - q: "Why might `FROM orders, UNNEST(items)` lose orders?"
    a: "It's a cross join: orders with an empty items array produce no rows. Use LEFT JOIN UNNEST."
  - q: "How do you build an array of the last 5 orders per customer?"
    a: "ARRAY_AGG(STRUCT(order_id, amount) ORDER BY order_date DESC LIMIT 5)"
  - q: "How do you filter orders containing SKU 'A' without flattening the output?"
    a: "WHERE EXISTS (SELECT 1 FROM UNNEST(items) i WHERE i.sku = 'A')"
  - q: "Why are nested/repeated fields recommended in BigQuery?"
    a: "They avoid joins for parent-child data and stay columnar, reducing shuffles and cost."
quiz:
  - q: "After `FROM orders o, UNNEST(o.items) i`, summing `o.shipping_fee` gives…"
    options: ["the correct total", "an inflated total (fee repeated per item)", "NULL", "an error"]
    answer: 1
recall:
  - q: "Explain STRUCT, ARRAY and UNNEST in BigQuery and when to use nested data."
    keyPoints:
      - "STRUCT groups fields into a record"
      - "ARRAY stores repeated values"
      - "UNNEST flattens arrays into rows"
      - "LEFT JOIN UNNEST keeps empty arrays"
      - "nested avoids joins and shuffles"
      - "watch fan-out when aggregating parent fields"
exercises:
  - id: bq-nested-1
    lang: sql
    kind: coding
    difficulty: 2
    title: Flatten JSON arrays (SQLite json_each ≈ UNNEST)
    prompt: |
      `api_orders(order_id, payload)` stores each order's items as a JSON array in `payload`, e.g. `[{"sku":"A","qty":2,"price":3.0}]`. Return one row per item: `order_id`, `sku`, `line_total` (qty × price, rounded 2), **and** keep orders with no items (sku and line_total NULL). Order by order_id, sku.

      SQLite: `LEFT JOIN json_each(o.payload) j` and `json_extract(j.value, '$.sku')`.
    setup: |
      CREATE TABLE api_orders (order_id INTEGER, payload TEXT);
      INSERT INTO api_orders VALUES
        (1, '[{"sku":"A","qty":2,"price":3.0},{"sku":"B","qty":1,"price":9.99}]'),
        (2, '[]'),
        (3, '[{"sku":"C","qty":5,"price":1.2}]');
    starter: |
      SELECT o.order_id,
             json_extract(j.value, '$.sku') AS sku
      FROM api_orders o
    solution: |
      SELECT o.order_id,
             json_extract(j.value, '$.sku') AS sku,
             ROUND(json_extract(j.value, '$.qty') * json_extract(j.value, '$.price'), 2) AS line_total
      FROM api_orders o
      LEFT JOIN json_each(o.payload) j
      ORDER BY o.order_id, sku;
    ordered: true
    hints:
      - "LEFT JOIN json_each(o.payload) j keeps order 2."
    explain: |
      The BigQuery equivalent: `SELECT o.order_id, i.sku, ROUND(i.qty * i.price, 2) FROM orders o LEFT JOIN UNNEST(o.items) AS i`.
  - id: bq-nested-2
    lang: text
    kind: coding
    difficulty: 3
    title: Top product per order (BigQuery SQL)
    prompt: |
      Table `orders(order_id INT64, order_date DATE, items ARRAY<STRUCT<sku STRING, qty INT64, price NUMERIC>>)`, partitioned by order_date. Write BigQuery SQL returning, for June 2025, each `order_id`, `order_total` (sum of qty × price) and `top_sku` (the item with the highest line total) — **without** a GROUP BY over the whole table.
    solution: |
      ```sql
      SELECT
        order_id,
        (SELECT SUM(i.qty * i.price) FROM UNNEST(items) AS i) AS order_total,
        (SELECT i.sku FROM UNNEST(items) AS i ORDER BY i.qty * i.price DESC LIMIT 1) AS top_sku
      FROM orders
      WHERE order_date BETWEEN '2025-06-01' AND '2025-06-30';
      ```
      Correlated subqueries over `UNNEST(items)` compute per-row results without flattening or a shuffle, and the date filter prunes partitions.
    review:
      - "Uses UNNEST(items) in correlated subqueries"
      - "SUM(qty * price) for total"
      - "ORDER BY ... LIMIT 1 for top sku"
      - "Filters on partition column order_date"
interview:
  - q: "How do you work with nested and repeated fields in BigQuery? When would you use them instead of separate tables?"
    type: concept
    level: 3
    keyPoints:
      - "STRUCT and ARRAY types"
      - "UNNEST to flatten"
      - "LEFT JOIN UNNEST for empty arrays"
      - "avoid joins for data always queried together"
      - "append mostly data, JSON sources"
      - "risk of fan-out"
