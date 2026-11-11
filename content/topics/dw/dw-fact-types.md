=== lesson
--- step concept: Declare the grain first
The **grain** is what one row of a fact table means: "one row per order line", "one row per product per warehouse per day". Decide it **before** choosing columns — every measure and dimension must be true at that grain.

> [!THINK] What's the grain of your company's daily sales report?

--- step concept: Three classic fact tables
| Type | One row per… | Example |
|---|---|---|
| **Transaction** | event | each payment, each order line |
| **Periodic snapshot** | entity per period | stock level per product per day |
| **Accumulating snapshot** | process instance, updated as it moves | one row per order with placed/paid/shipped/delivered dates |

[[quiz:dw-fact-types:q0]]

--- step practice: Build an accumulating snapshot
Pivot the events of each order into one row with a timestamp per milestone.

[[exercise:dw-fact-types-1]]

--- step concept: Can you add it up?
- **Additive** — sum across every dimension: revenue, quantity.
- **Semi-additive** — sum across some dimensions but **not time**: account balance, stock level (use the last value or the average over days).
- **Non-additive** — never sum: ratios, percentages, unit prices. Store the parts (numerator, denominator) and divide at query time.

[[quiz:dw-fact-types:q1]]

--- step check: Facts without measures
A **factless fact** records that something happened (a student attended a class) or was possible (a product was on promotion) — you analyse it with `COUNT(*)`.

[[quiz:dw-fact-types:q2]]

--- step interview: Explain it
[[recall:dw-fact-types:r0]]

=== detailed
## Kimball's four steps
1. Choose the **business process** (orders, shipments, inventory).
2. Declare the **grain**.
3. Identify the **dimensions** (who, what, where, when).
4. Identify the **facts** (numeric measures true at that grain).

## Fact table types
| | Transaction | Periodic snapshot | Accumulating snapshot |
|---|---|---|---|
| Grain | one event | one entity per period | one process instance |
| Rows | inserted, never updated | inserted every period | inserted once, **updated** as milestones happen |
| Size | grows with activity | grows with entities × periods | one row per instance |
| Dates | one event date | snapshot date | many date keys (placed, paid, shipped…) |
| Typical question | how much did we sell? | what was the balance at month end? | how long from order to delivery? |

## Accumulating snapshot SQL
```sql
SELECT order_id,
       MIN(CASE WHEN event = 'placed'    THEN event_time END) AS placed_at,
       MIN(CASE WHEN event = 'shipped'   THEN event_time END) AS shipped_at,
       MIN(CASE WHEN event = 'delivered' THEN event_time END) AS delivered_at
FROM order_events
GROUP BY order_id;
```
Then compute lags such as `julianday(delivered_at) - julianday(placed_at)`.

## Additivity
| Measure | Additive across time? | How to aggregate |
|---|---|---|
| revenue, quantity | yes | SUM |
| account balance, inventory level | **no** | last value of the period, or AVG |
| conversion rate, margin % | never | SUM(numerator) / SUM(denominator) |

> [!MISTAKE] Summing daily stock snapshots for a month gives 30× the real stock. Pick the month-end snapshot instead.

> [!MISTAKE] Averaging percentages: the average of 50% (of 2 orders) and 10% (of 1000 orders) is not 30%.

## Factless facts
- **Event tracking:** attendance, page views without measures, logins.
- **Coverage:** which products were on promotion in which stores — combine with sales facts to find promoted products that did *not* sell.

=== crisp
| Fact type | Grain | Example | Behaviour |
|---|---|---|---|
| **Transaction** | one row per event | order line, payment | insert-only, most common |
| **Periodic snapshot** | one row per entity per period | daily inventory per product, month-end account balance | regular inserts, dense |
| **Accumulating snapshot** | one row per process instance, updated as milestones happen | order: placed → paid → shipped → delivered timestamps & lags | rows updated over time |
| **Factless** | event or coverage with no measure | student attendance, promotion coverage | count rows |

**Measures:**
- **Additive** — summable across all dimensions (quantity, amount).
- **Semi-additive** — not across time (balance, inventory level) → use AVG/last value over time.
- **Non-additive** — ratios/percentages/unit prices → store numerator & denominator, compute at query time.

=== memory
- **Transaction = "what happened", Periodic = "how things stood", Accumulating = "how far along".**
- Balances don't add up over days.

=== data
flashcards:
  - q: "Three main fact table types?"
    a: "Transaction, periodic snapshot, accumulating snapshot (plus factless)."
  - q: "Example of an accumulating snapshot?"
    a: "One row per order with placed/paid/shipped/delivered dates and durations, updated as each milestone occurs."
  - q: "Why can't you SUM account balances across months?"
    a: "Balance is semi-additive — summing over time double counts; use end-of-period or average."
  - q: "How do you store a conversion rate in a fact table?"
    a: "Store numerator and denominator (e.g. purchases and visits) and compute the ratio in queries."
quiz:
  - q: "Daily stock level per warehouse per product is a…"
    options: ["transaction fact", "periodic snapshot", "accumulating snapshot", "factless fact"]
    answer: 1
  - q: "How should you report the total account balance for March from a daily balance snapshot?"
    options: ["sum all daily balances in March", "count the rows", "sum the first and last day", "take the balance on the last day of March"]
    answer: 3
    explain: "Balances are semi-additive: they cannot be summed over time."
  - q: "A table recording which products were on promotion in which store each day, with no measures, is a…"
    options: ["accumulating snapshot", "bridge table", "factless fact table (coverage)", "dimension table"]
    answer: 2
    explain: "Factless facts record events or coverage; you analyse them with counts."
recall:
  - q: "Compare transaction, periodic snapshot and accumulating snapshot facts and explain additive vs semi-additive measures."
    keyPoints:
      - "declare the grain first"
      - "transaction: one row per event, insert only"
      - "periodic snapshot: state per period"
      - "accumulating snapshot: one row per process, updated with milestone dates"
      - "additive, semi-additive, non-additive"
      - "store numerator and denominator for ratios"
exercises:
  - id: dw-fact-types-1
    lang: sql
    kind: coding
    difficulty: 2
    title: Build an accumulating snapshot
    prompt: |
      `order_events(order_id, event, event_time)` has events `placed`, `paid`, `shipped`, `delivered`. Build one row per order: `order_id`, `placed_at`, `paid_at`, `shipped_at`, `delivered_at` (NULL if not reached) and `hours_to_deliver` (delivered − placed in hours, rounded 1). Order by order_id.
    setup: |
      CREATE TABLE order_events (order_id INTEGER, event TEXT, event_time TEXT);
      INSERT INTO order_events VALUES
        (1,'placed','2025-06-01 10:00:00'),(1,'paid','2025-06-01 10:05:00'),(1,'shipped','2025-06-02 09:00:00'),(1,'delivered','2025-06-03 15:30:00'),
        (2,'placed','2025-06-02 12:00:00'),(2,'paid','2025-06-02 12:01:00'),
        (3,'placed','2025-06-03 08:00:00'),(3,'paid','2025-06-03 08:30:00'),(3,'shipped','2025-06-03 18:00:00'),(3,'delivered','2025-06-04 08:00:00');
    starter: |
      SELECT order_id,
             MAX(CASE WHEN event = 'placed' THEN event_time END) AS placed_at
      FROM order_events
      GROUP BY order_id
    solution: |
      SELECT order_id,
             MAX(CASE WHEN event = 'placed' THEN event_time END) AS placed_at,
             MAX(CASE WHEN event = 'paid' THEN event_time END) AS paid_at,
             MAX(CASE WHEN event = 'shipped' THEN event_time END) AS shipped_at,
             MAX(CASE WHEN event = 'delivered' THEN event_time END) AS delivered_at,
             ROUND((julianday(MAX(CASE WHEN event = 'delivered' THEN event_time END)) - julianday(MAX(CASE WHEN event = 'placed' THEN event_time END))) * 24, 1) AS hours_to_deliver
      FROM order_events
      GROUP BY order_id
      ORDER BY order_id;
    ordered: true
    hints:
      - "Pivot each milestone with MAX(CASE WHEN event = … THEN event_time END)."
interview:
  - q: "Describe transaction, periodic snapshot and accumulating snapshot fact tables with examples."
    type: concept
    level: 2
    keyPoints:
      - "transaction one row per event"
      - "periodic snapshot state per period"
      - "accumulating snapshot one row per process updated at milestones"
      - "semi-additive measures in snapshots"
