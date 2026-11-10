=== lesson
--- step concept: Measurements and context
Dimensional modelling (Kimball) splits analytical data into two kinds of tables:
- **Fact tables** record **business events/measurements** — an order line, a payment, a page view. They hold **numeric measures** (quantity, amount) and **foreign keys** to dimensions. Long and narrow; they grow fast.
- **Dimension tables** hold the **descriptive context** you filter and group by — customer, product, date, store. Wide and relatively small.

A fact surrounded by its dimensions is a **star schema**:
```
            dim_date
               |
dim_customer — fct_order_lines — dim_product
               |
           dim_channel
```
> [!WHY] Business questions are "measure **by** context": revenue *by* month *by* category *by* city. Star schemas make those queries simple (one join per dimension) and fast.

[[quiz:dw-facts-dimensions:q0]]

--- step concept: Declare the grain first
The **grain** is what one fact row represents — the most important design decision. Kimball's four steps:
1. Choose the **business process** (sales).
2. Declare the **grain** ("one row per order line").
3. Identify the **dimensions** (date, customer, product, channel).
4. Identify the **facts/measures** (quantity, unit price, line amount, discount).

Prefer the **lowest (atomic) grain** available: you can always aggregate up, never drill down.

[[exercise:dw-facts-dimensions-1]]

--- step example: Query a star
[[exercise:dw-facts-dimensions-2]]

--- step check: Star vs snowflake
**Snowflaking** normalises dimensions further (product → category table → department table). It saves a little storage but adds joins; in modern columnar warehouses star schemas (or even one wide denormalised table) are usually preferred.

[[quiz:dw-facts-dimensions:q1]]

--- step scenario: Design a model
[[exercise:dw-facts-dimensions-3]]
[[recall:dw-facts-dimensions:r0]]

=== detailed
## Why dimensional modelling
OLTP schemas (3NF) are optimised for writing; analysts face dozens of joins and ambiguous meaning. Dimensional models reorganise data around **business processes** so that queries are intuitive, consistent and fast.

## Fact tables
- One row per event at the declared grain.
- Contain foreign keys to dimensions + measures (+ degenerate dimensions like `order_number` that have no dimension table).
- Measures types: **additive** (sum across all dimensions: amount, quantity), **semi-additive** (sum across some: account balance — not across time), **non-additive** (ratios, percentages, unit price — store the components instead).
- Types (see next topic): transaction, periodic snapshot, accumulating snapshot, factless.

## Dimension tables
- One row per member (customer, product…), with a **surrogate key** (integer or hash) as primary key plus the **natural/business key**.
- Many descriptive attributes, often denormalised (product name, brand, category, department in one table).
- Special dimensions: **date dimension** (calendar attributes: weekday, month, fiscal period, holiday flags), **junk dimension** (misc flags), **role-playing** (same date dim as order_date, ship_date), **conformed** dimensions shared across facts.
- Changing attributes are handled with **slowly changing dimension** techniques.

## Grain
Mixing grains in one fact (order headers and order lines) causes double counting. Header-level values (shipping fee) must be allocated to lines or kept in a separate header fact.

## Star vs snowflake vs wide table
| | Star | Snowflake | One Big Table |
|---|---|---|---|
| Dimensions | denormalised | normalised | merged into the fact |
| Joins per query | few | more | none |
| Storage | moderate | least | most |
| Usability | high | lower | highest for simple use |
| Updates to attributes | easy | easy | rewrite many rows |
In BigQuery, wide tables with nested/repeated fields are also common; star schemas remain the clearest way to share conformed dimensions across many facts.

## Common mistakes
> [!MISTAKE] Not declaring the grain → mixed-grain facts and double counting.

> [!MISTAKE] Storing ratios/averages as facts — they can't be summed. Store numerator and denominator.

> [!MISTAKE] Using natural keys from source systems as the only key → collisions across sources and no history.

> [!MISTAKE] Text descriptions in the fact table instead of dimensions.

=== crisp
- **Fact** = business event at a declared grain: FKs to dimensions + numeric measures. Long, narrow, fast-growing.
- **Dimension** = descriptive context (who/what/where/when): surrogate key + natural key + attributes. Wide, smaller.
- **Star**: fact in the middle, one join per dimension. **Snowflake**: normalised dimensions (more joins).
- Kimball 4 steps: **process → grain → dimensions → facts**.
- Choose the **atomic grain**; aggregate later.
- Measures: additive / semi-additive (balances) / non-additive (ratios → store components).
- Date dimension, role-playing dims, degenerate dims (order_number), junk dims, conformed dims.

=== memory
- **"Facts are verbs (sold, paid, clicked); dimensions are nouns (customer, product, date)."**
- **"Grain first, always."**
- Trigger: *"numbers double when I add a column"* → mixed grain.

=== data
flashcards:
  - q: "What does a fact table contain?"
    a: "Foreign keys to dimensions and numeric measures, one row per event at the declared grain."
  - q: "What does a dimension table contain?"
    a: "Descriptive attributes for filtering/grouping, a surrogate key and the natural key."
  - q: "Kimball's four design steps?"
    a: "Select the business process, declare the grain, identify dimensions, identify facts."
  - q: "Why choose the atomic (lowest) grain?"
    a: "You can always aggregate up but never drill below the stored grain."
  - q: "What is a semi-additive measure?"
    a: "One that can be summed across some dimensions but not others — e.g. account balance across time."
  - q: "What is a degenerate dimension?"
    a: "A dimension key with no dimension table, stored in the fact (e.g. order_number)."
quiz:
  - q: "Which column belongs in a dimension rather than the fact?"
    options: ["quantity", "line_amount", "product_category", "discount_amount"]
    answer: 2
  - q: "A snowflake schema differs from a star schema because…"
    options: ["it has no fact table", "dimensions are normalised into sub-tables", "it is only for streaming", "facts are denormalised"]
    answer: 1
recall:
  - q: "Explain facts, dimensions, grain and the star schema with an e-commerce example."
    keyPoints:
      - "fact table stores measurable events like order lines"
      - "dimensions describe context like customer product date"
      - "grain defines what one fact row is"
      - "star schema joins fact to each dimension"
      - "measures additive vs non additive"
      - "surrogate keys"
exercises:
  - id: dw-facts-dimensions-1
    lang: mcq
    kind: concept
    difficulty: 1
    title: Declare the grain
    prompt: |
      You model sales so analysts can see revenue by product, by day and by customer. The source has order headers and order lines. What grain should the fact table have?
    choices:
      - "One row per order"
      - "One row per order line (product within an order)"
      - "One row per customer per month"
      - "One row per product"
    answer: 1
    explain: |
      Product is only known at the line level; choosing the line grain (atomic) supports all three analyses. Orders, months and customers are aggregations of it.
  - id: dw-facts-dimensions-2
    lang: sql
    kind: coding
    difficulty: 2
    title: Query a star schema
    prompt: |
      The setup builds a small star: `fct_sales(date_key, customer_key, product_key, quantity, amount)`, `dim_date(date_key, date, month, year)`, `dim_customer(customer_key, customer_id, segment, city)`, `dim_product(product_key, product_id, name, category)`.

      Return revenue by `year`, `segment` and `category` (rounded 2), ordered by year, segment, revenue desc.
    setup: |
      CREATE TABLE dim_date AS SELECT DISTINCT CAST(strftime('%Y%m%d', order_date) AS INTEGER) AS date_key, order_date AS date, strftime('%m', order_date) AS month, strftime('%Y', order_date) AS year FROM orders;
      CREATE TABLE dim_customer AS SELECT customer_id + 1000 AS customer_key, customer_id, segment, city FROM customers;
      CREATE TABLE dim_product AS SELECT product_id + 500 AS product_key, product_id, name, category FROM products;
      CREATE TABLE fct_sales AS
        SELECT CAST(strftime('%Y%m%d', o.order_date) AS INTEGER) AS date_key, o.customer_id + 1000 AS customer_key, oi.product_id + 500 AS product_key, oi.quantity, oi.quantity * oi.unit_price AS amount
        FROM order_items oi JOIN orders o ON o.order_id = oi.order_id WHERE o.status = 'delivered';
    starter: |
      SELECT d.year, c.segment, p.category, ROUND(SUM(f.amount), 2) AS revenue
      FROM fct_sales f
    solution: |
      SELECT d.year, c.segment, p.category, ROUND(SUM(f.amount), 2) AS revenue
      FROM fct_sales f
      JOIN dim_date d ON d.date_key = f.date_key
      JOIN dim_customer c ON c.customer_key = f.customer_key
      JOIN dim_product p ON p.product_key = f.product_key
      GROUP BY d.year, c.segment, p.category
      ORDER BY d.year, c.segment, revenue DESC;
    ordered: true
    hints:
      - "One join per dimension on its surrogate key."
  - id: dw-facts-dimensions-3
    lang: text
    kind: scenario
    difficulty: 3
    title: Model a food-delivery business
    prompt: |
      A food-delivery company wants to analyse orders: revenue, delivery time, discounts, by restaurant, cuisine, city, customer, rider and time of day. Design the star schema: name the fact table(s), the grain, the dimensions and the measures.
    solution: |
      **Business process:** order delivery. **Fact:** `fct_order_items` at grain **one row per item in an order** (if item-level analysis is needed) and/or `fct_orders` at **one row per order** for order-level measures like delivery time and delivery fee.

      **Dimensions:** `dim_date` (order date; role-playing for delivery date), `dim_time_of_day`, `dim_customer`, `dim_restaurant` (cuisine, city, rating band), `dim_rider`, `dim_city/geography`, `dim_promotion`, `dim_menu_item`.

      **Measures:** item quantity, item gross amount, discount amount, net amount; order-level: delivery fee, delivery minutes (from accumulating snapshot of order lifecycle timestamps), tip.

      **Notes:** keep ratios (avg delivery time) as sums + counts; allocate order-level discounts to items or keep in the order-level fact; surrogate keys + SCD2 on restaurant/rider attributes if history matters.
    review:
      - "Explicit grain declared"
      - "Fact table(s) named with measures"
      - "Dimensions include date/time, customer, restaurant, rider, location"
      - "Handles order-level vs item-level measures"
      - "Mentions surrogate keys / SCD or non-additive measures"
interview:
  - q: "What is the difference between a fact table and a dimension table? How do you decide the grain?"
    type: concept
    level: 1
    keyPoints:
      - "facts store measurable events with numeric measures"
      - "dimensions store descriptive attributes"
      - "grain is what one fact row represents"
      - "choose the lowest atomic grain"
      - "Kimball four steps"
  - q: "Star schema vs snowflake schema — which would you use in BigQuery and why?"
    type: design
    level: 2
    keyPoints:
      - "star denormalises dimensions, fewer joins"
      - "snowflake normalises dimensions, more joins"
      - "columnar storage makes redundancy cheap"
      - "star simpler for BI users"
      - "wide tables or nested fields also an option"
