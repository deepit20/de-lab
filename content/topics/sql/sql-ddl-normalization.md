=== lesson
--- step concept: Tables protect their own data
**DDL** (Data Definition Language) creates the structure. **Constraints** make the database reject bad rows for you:

```sql
CREATE TABLE payments (
  payment_id INTEGER PRIMARY KEY,                    -- unique + not null
  order_id   INTEGER NOT NULL REFERENCES orders(order_id),
  method     TEXT    NOT NULL CHECK (method IN ('card','upi','cash')),
  amount     NUMERIC NOT NULL CHECK (amount > 0),
  ref_code   TEXT UNIQUE
);
```
A constraint is a rule checked on **every** insert and update — cheaper than discovering the problem in a dashboard.

> [!THINK] Which constraint stops a payment from pointing to an order that doesn't exist?

--- step practice: Design a constrained table
[[exercise:sql-ddl-normalization-1]]

--- step concept: Normalisation in three steps
Normalisation removes **repeated facts** so each fact is stored once.

- **1NF** — one value per cell, no repeating groups (`product_1, product_2, …` → separate rows).
- **2NF** — every column depends on the **whole** key. In `(order_id, product_id) → product_name`, the name depends only on `product_id` → move it to `products`.
- **3NF** — no column depends on another non-key column. `customer_city` depends on `customer_id`, not on the order → move it to `customers`.

[[quiz:sql-ddl-normalization:q0]]

--- step scenario: Normalise a spreadsheet
[[exercise:sql-ddl-normalization-2]]

--- step check: Normalise or denormalise?
- **OLTP (apps):** normalise — many small writes, each fact updated in one place.
- **Analytics (warehouses):** denormalise into star schemas or wide tables — few writes, many big reads, fewer joins.

[[quiz:sql-ddl-normalization:q1]]
[[quiz:sql-ddl-normalization:q2]]

--- step interview: Explain it
[[recall:sql-ddl-normalization:r0]]

=== detailed
## DDL statements
| Statement | Purpose |
|---|---|
| `CREATE TABLE` | define columns, types, constraints |
| `ALTER TABLE` | add/rename/drop columns |
| `DROP TABLE` | delete table and data |
| `CREATE VIEW` | saved query |
| `CREATE INDEX` | speed up lookups (OLTP) |

## Constraints
| Constraint | Guarantees |
|---|---|
| `PRIMARY KEY` | unique and not null; identifies a row |
| `FOREIGN KEY … REFERENCES` | value exists in the parent table |
| `UNIQUE` | no duplicates (NULLs allowed in most DBs) |
| `NOT NULL` | value must be present |
| `CHECK (expr)` | business rule, e.g. `amount > 0` |
| `DEFAULT` | value used when none is given |

> [!WARN] BigQuery accepts primary and foreign keys as **unenforced** metadata (they help the optimizer) but does not reject duplicates. In warehouses, uniqueness is enforced by **tests** (dbt `unique`, `not_null`).

## Data types
- Money: `NUMERIC`/`DECIMAL` — floats give `0.1 + 0.2 = 0.30000000000000004`.
- IDs: integers or strings; never floats.
- Dates: `DATE`; event times: `TIMESTAMP` in UTC.
- Pick the smallest type that safely fits; it matters for storage and scan cost.

## Normal forms with an example
Spreadsheet: `order_id, order_date, customer_name, customer_email, customer_city, product_1, qty_1, price_1, product_2, …`

1. **1NF:** split repeating product columns into `order_lines(order_id, line_no, product, qty, price)`.
2. **2NF:** `product_name` and list price depend only on `product_id` → `products(product_id, name, list_price)`.
3. **3NF:** customer details depend on the customer, not the order → `customers(customer_id, name, email, city)`; `orders(order_id, order_date, customer_id)`.

Anomalies normalisation prevents:
- **Update anomaly:** a customer moves city — you must update 200 order rows.
- **Insert anomaly:** you can't store a new product until someone orders it.
- **Delete anomaly:** deleting the last order deletes the customer's details.

## When to denormalise
Analytics workloads read far more than they write. Star schemas (facts + denormalised dimensions) and wide tables reduce joins and are easier for analysts. Columnar warehouses compress repeated values well, so duplication is cheap.

=== crisp
**DDL:** `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`, `CREATE INDEX`, `CREATE VIEW`.
```sql
CREATE TABLE orders (
  order_id    INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
  amount      NUMERIC(12,2) CHECK (amount >= 0),
  status      TEXT NOT NULL DEFAULT 'new'
);
```
**Constraints:** PRIMARY KEY (unique + not null), FOREIGN KEY (referential integrity), UNIQUE, NOT NULL, CHECK, DEFAULT. Warehouses (BigQuery) often **don't enforce** PK/FK → you test them in the pipeline instead.

**Normal forms** (OLTP design):
- **1NF** — atomic values, no repeating groups (no `phone1, phone2, phone3`; no comma lists).
- **2NF** — every non-key column depends on the **whole** key (no partial dependency on part of a composite key).
- **3NF** — no **transitive** dependency (non-key → non-key, e.g. `zip → city` stored in orders).
"The key, the whole key, and nothing but the key."

**Denormalisation** in analytics: fewer joins, faster reads (star schemas, wide tables, nested fields in BigQuery) at the cost of redundancy and harder updates.

- Money: `NUMERIC/DECIMAL`, never FLOAT.
- Timestamps: UTC, `TIMESTAMP` type.

=== memory
- **"The key (1NF), the whole key (2NF), and nothing but the key (3NF)."**
- OLTP → normalise (integrity, writes). OLAP → denormalise (reads).
- Trigger: *"same customer city differs across rows"* → update anomaly from denormalisation.

=== data
flashcards:
  - q: "What does a PRIMARY KEY guarantee?"
    a: "Uniqueness and NOT NULL for the key column(s)."
  - q: "2NF in one sentence?"
    a: "No non-key column depends on only part of a composite key."
  - q: "3NF in one sentence?"
    a: "No non-key column depends on another non-key column (no transitive dependencies)."
  - q: "Why denormalise in a warehouse?"
    a: "Fewer joins and faster analytical reads; storage is cheap and data is mostly append-only."
  - q: "Why not FLOAT for money?"
    a: "Binary floating point cannot represent decimals exactly → rounding errors. Use NUMERIC/DECIMAL."
quiz:
  - q: "A table (order_id, product_id, product_name, qty) with key (order_id, product_id) violates…"
    options: ["1NF", "2NF — product_name depends only on product_id", "3NF only", "none"]
    answer: 1
  - q: "BigQuery primary keys are…"
    options: ["only allowed on partitioned tables", "unenforced metadata — duplicates are not rejected", "enforced like in Postgres", "not supported at all"]
    answer: 1
    explain: "BigQuery accepts PK/FK as NOT ENFORCED hints for the optimizer; use tests to guarantee uniqueness."
  - q: "Which data type should store invoice amounts?"
    options: ["NUMERIC / DECIMAL", "FLOAT", "STRING", "INTEGER of rupees"]
    answer: 0
    explain: "Decimal types store exact values; floats introduce rounding errors in money."
recall:
  - q: "Walk through normalising a flat orders spreadsheet to 3NF and say when you would denormalise again."
    keyPoints:
      - "1NF: split repeating groups into rows"
      - "2NF: remove partial dependencies on part of the key"
      - "3NF: remove transitive dependencies"
      - "prevents update, insert and delete anomalies"
      - "warehouses denormalise into star schemas for reads"
      - "constraints enforce rules in OLTP; tests in warehouses"
exercises:
  - id: sql-ddl-normalization-1
    lang: sql
    kind: coding
    difficulty: 2
    title: Design a constrained table
    prompt: |
      Create a table `payments` with: `payment_id` (integer primary key), `order_id` (integer, not null, references orders), `paid_at` (text, not null), `method` (text, must be one of 'card', 'upi', 'cash'), `amount` (numeric, must be > 0).

      Then insert two valid rows: (1, 10, '2025-06-01 10:00:00', 'upi', 120.5) and (2, 11, '2025-06-02 09:30:00', 'card', 80). The checker selects from `payments`.
    starter: |
      CREATE TABLE payments (
      );
    solution: |
      CREATE TABLE payments (
        payment_id INTEGER PRIMARY KEY,
        order_id   INTEGER NOT NULL REFERENCES orders(order_id),
        paid_at    TEXT NOT NULL,
        method     TEXT CHECK (method IN ('card', 'upi', 'cash')),
        amount     NUMERIC CHECK (amount > 0)
      );
      INSERT INTO payments VALUES (1, 10, '2025-06-01 10:00:00', 'upi', 120.5);
      INSERT INTO payments VALUES (2, 11, '2025-06-02 09:30:00', 'card', 80);
    check: |
      SELECT payment_id, order_id, method, amount FROM payments ORDER BY payment_id;
    ordered: true
    hints:
      - "CHECK (method IN ('card','upi','cash')) and CHECK (amount > 0)."
  - id: sql-ddl-normalization-2
    lang: text
    kind: scenario
    difficulty: 2
    title: Normalise a spreadsheet
    prompt: |
      A team keeps orders in one sheet with columns: `order_id, order_date, customer_name, customer_email, customer_city, product_1, qty_1, price_1, product_2, qty_2, price_2`. Propose a normalised design (tables, keys) and name the problems the current design causes.
    solution: |
      **Tables:** `customers(customer_id PK, name, email UNIQUE, city)`, `products(product_id PK, name, price)`, `orders(order_id PK, customer_id FK, order_date)`, `order_items(order_id FK, product_id FK, qty, unit_price, PK(order_id, product_id))`.

      **Problems today:** repeating groups (product_1/product_2 → violates 1NF, max 2 items), customer data repeated on every order (update anomalies: change of city must be edited everywhere; inconsistent spellings), cannot add a customer without an order (insert anomaly), deleting the only order deletes the customer (delete anomaly), price history unclear (store unit_price on the line).
    review:
      - "Separate customers, products, orders and order_items tables"
      - "Primary and foreign keys identified"
      - "Repeating product columns violate 1NF"
      - "Update / insert / delete anomalies explained"
      - "Unit price stored on the order line"
interview:
  - q: "Explain normalisation and when you would deliberately denormalise."
    type: concept
    level: 2
    keyPoints:
      - "remove redundancy and anomalies"
      - "1NF atomic values, 2NF full key dependency, 3NF no transitive dependency"
      - "OLTP favours normalisation"
      - "analytics favours denormalisation / star schema for read performance"
      - "trade-off: redundancy and update complexity"
