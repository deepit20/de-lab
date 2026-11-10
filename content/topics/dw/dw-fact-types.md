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
