=== crisp
**Conditional aggregation** = an aggregate over a CASE expression — several filtered metrics in **one pass**:
```sql
SELECT channel,
       COUNT(*)                                              AS orders,
       SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
       ROUND(100.0 * AVG(CASE WHEN status = 'cancelled' THEN 1.0 ELSE 0 END), 1) AS cancel_pct,
       SUM(CASE WHEN status = 'delivered' THEN amount END)   AS delivered_revenue
FROM orders GROUP BY channel;
```
- **Pivot** rows to columns: one `SUM(CASE WHEN category = 'X' THEN v END) AS x` per value.
- `COUNT(DISTINCT CASE WHEN cond THEN id END)` counts unique ids meeting a condition.
- BigQuery shortcuts: `COUNTIF(cond)`, `SUM(IF(cond, x, 0))`, `PIVOT` operator.
- Ratios: `100.0 * …` to avoid integer division; `NULLIF(den, 0)`.

=== memory
- **"One scan, many filters."**
- `AVG(CASE WHEN cond THEN 1.0 ELSE 0 END)` = share of rows meeting cond.

=== data
flashcards:
  - q: "How do you count cancelled orders per channel in one GROUP BY?"
    a: "SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)"
  - q: "How do you pivot categories into columns without PIVOT?"
    a: "One SUM(CASE WHEN category = 'X' THEN value END) AS x column per category."
  - q: "BigQuery shortcut for counting rows meeting a condition?"
    a: "COUNTIF(condition)"
quiz:
  - q: "`AVG(CASE WHEN status = 'returned' THEN 1.0 ELSE 0 END)` computes…"
    options: ["number of returns", "share of orders returned", "average returned amount", "error"]
    answer: 1
exercises:
  - id: sql-conditional-agg-1
    lang: sql
    kind: coding
    difficulty: 2
    title: Status breakdown per channel
    prompt: |
      Per `channel` return `orders`, `delivered`, `cancelled`, `returned` (counts) and `cancel_pct` (cancelled / orders × 100, rounded 1). Order by channel.
    starter: |
      SELECT channel, COUNT(*) AS orders
      FROM orders
      GROUP BY channel
    solution: |
      SELECT channel, COUNT(*) AS orders,
             SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
             SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
             SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END) AS returned,
             ROUND(100.0 * SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) / COUNT(*), 1) AS cancel_pct
      FROM orders
      GROUP BY channel
      ORDER BY channel;
    ordered: true
    hints:
      - "SUM(CASE WHEN … THEN 1 ELSE 0 END) per status."
  - id: sql-conditional-agg-2
    lang: sql
    kind: coding
    difficulty: 2
    title: Pivot revenue by category and year
    prompt: |
      Return one row per `category` with delivered line revenue (`quantity * unit_price`) in two columns: `rev_2024` and `rev_2025` (rounded 2). Order by category.
    starter: |
      SELECT p.category
      FROM order_items oi
      JOIN orders o ON o.order_id = oi.order_id
      JOIN products p ON p.product_id = oi.product_id
    solution: |
      SELECT p.category,
             ROUND(SUM(CASE WHEN o.order_date < '2025-01-01' THEN oi.quantity * oi.unit_price ELSE 0 END), 2) AS rev_2024,
             ROUND(SUM(CASE WHEN o.order_date >= '2025-01-01' THEN oi.quantity * oi.unit_price ELSE 0 END), 2) AS rev_2025
      FROM order_items oi
      JOIN orders o ON o.order_id = oi.order_id
      JOIN products p ON p.product_id = oi.product_id
      WHERE o.status = 'delivered'
      GROUP BY p.category
      ORDER BY p.category;
    ordered: true
    hints:
      - "One SUM(CASE …) per year column."
interview:
  - q: "How would you compute several differently-filtered metrics in a single query efficiently?"
    type: concept
    level: 2
    keyPoints:
      - "conditional aggregation with CASE inside aggregates"
      - "single scan instead of multiple queries"
      - "COUNTIF / SUM(IF()) in BigQuery"
      - "pivot pattern"
