=== lesson
--- step concept: A class bundles data with behaviour
```python
class Batch:
    def __init__(self, source, rows):
        self.source = source      # attributes live on the instance
        self.rows = rows

    def size(self):               # a method; self is the instance
        return len(self.rows)

b = Batch("orders_api", [{"id": 1}, {"id": 2}])
b.size()    # 2
```
`__init__` runs when you create an instance. `self` is how a method reaches its own data.

--- step concept: Dataclasses for records
Most data objects are just **named fields**. `@dataclass` writes `__init__`, `__repr__` and `__eq__` for you:

```python
from dataclasses import dataclass

@dataclass
class Order:
    order_id: int
    amount: float
    status: str = "placed"

    @property
    def is_paid(self):
        return self.status in {"paid", "shipped", "delivered"}
```
[[quiz:py-oop:q1]]

--- step practice: An Order dataclass
A `@classmethod` is an alternative constructor — perfect for `Order.from_dict(row)`.

[[exercise:py-oop-1]]

--- step concept: Composition over inheritance
Prefer objects that **hold** other objects (a `Pipeline` has an `Extractor` and a `Loader`) over deep inheritance trees. They're easier to test — swap in a fake loader.

[[quiz:py-oop:q0]]

--- step check: Class or function?
[[quiz:py-oop:q2]]

--- step interview: Explain it
[[recall:py-oop:r0]]

=== detailed
## Vocabulary
| Term | Meaning |
|---|---|
| class | a blueprint (`class Order:`) |
| instance / object | one thing built from it (`Order(1, 50.0)`) |
| attribute | data on the instance (`self.amount`) |
| method | function defined in the class; first argument `self` |
| `@property` | a method read like an attribute (`order.is_paid`) |
| `@classmethod` | receives the class (`cls`); used for alternative constructors |
| `@staticmethod` | plain function grouped in the class |

## Dataclasses
```python
@dataclass(frozen=True)
class Partition:
    table: str
    dt: str
```
- `frozen=True` makes instances immutable and hashable.
- Type hints document the fields (they aren't enforced at run time — use pydantic for validation).
- `field(default_factory=list)` for mutable defaults.

## Inheritance vs composition
- Inheritance (`class CsvSource(Source)`) is fine for a small shared interface with a few implementations.
- Composition (`Pipeline(extractor, loader)`) keeps parts independent and testable.
- Airflow operators are a real example of inheritance: every operator extends `BaseOperator` and implements `execute(context)`.

## When a function is better
If a class has only `__init__` and one method, it's a function in disguise. Use classes when you have **state that lives across several calls** (a client with a connection, a buffer) or many related operations on the same data.

> [!REAL] Typical DE classes: API clients (holding a session and auth), config objects (dataclasses loaded from YAML), and custom Airflow operators/hooks.

> [!MISTAKE] Class-level mutable attributes (`class Batch: rows = []`) are shared by **all** instances. Create them in `__init__`.

=== crisp
```python
from dataclasses import dataclass, field

@dataclass(frozen=True)
class Order:
    order_id: int
    amount: float
    status: str = "new"
    tags: list = field(default_factory=list)   # never a mutable default directly

    @property
    def is_billable(self) -> bool:
        return self.status not in ("cancelled", "returned")
```
- Class = blueprint; instance = object; `self` = the current instance; `__init__` sets state.
- `@dataclass` generates `__init__`, `__repr__`, `__eq__` for record-like classes; `frozen=True` makes them immutable.
- `@property` — computed attribute; `@classmethod` — alternative constructors (`Order.from_row(row)`); `@staticmethod` — utility.
- **Composition over inheritance**: a `Pipeline` *has* an `Extractor` and a `Loader`, rather than deep class trees.
- Use classes when you need state + behaviour together (clients, connections, configs); plain functions for stateless transforms.

=== memory
- **"Dataclass = record with free boilerplate."**
- **"Has-a beats is-a."**

=== data
flashcards:
  - q: "What does @dataclass generate?"
    a: "__init__, __repr__ and __eq__ (and more options like ordering/frozen)."
  - q: "How do you give a dataclass a list default safely?"
    a: "field(default_factory=list)"
  - q: "What is a classmethod commonly used for?"
    a: "Alternative constructors, e.g. Order.from_row(row)."
quiz:
  - q: "When is a plain function better than a class?"
    options: ["When you need to store connection state", "For a stateless transformation of input to output", "When modelling a record", "Never"]
    answer: 1
  - q: "What does `@dataclass` generate for you?"
    options: ["a database table", "type checking at run time", "a JSON schema", "__init__, __repr__ and __eq__ from the fields"]
    answer: 3
    explain: "Dataclasses generate the boilerplate methods. Type hints are not enforced at run time."
  - q: "`Order.from_dict(row)` is best implemented as…"
    options: ["a module-level variable", "__eq__", "a @classmethod", "a @property"]
    answer: 2
    explain: "Class methods receive the class and are the standard pattern for alternative constructors."
recall:
  - q: "When would you use a dataclass, a regular class, or a plain function in a pipeline?"
    keyPoints:
      - "dataclass for record-like data with named fields"
      - "class when state lives across several calls, e.g. an API client"
      - "function when there is no state"
      - "classmethod as alternative constructor"
      - "prefer composition over deep inheritance"
exercises:
  - id: py-oop-1
    lang: python
    kind: coding
    difficulty: 2
    title: An Order dataclass
    prompt: |
      Define a dataclass `Order` with `order_id: int`, `amount: float`, `status: str`, a property `is_billable` (False for `cancelled` and `returned`), and a classmethod `from_row(row)` that builds an Order from a CSV dict of strings.
    starter: |
      from dataclasses import dataclass

      @dataclass
      class Order:
          pass
    solution: |
      from dataclasses import dataclass

      @dataclass
      class Order:
          order_id: int
          amount: float
          status: str

          @property
          def is_billable(self):
              return self.status not in ("cancelled", "returned")

          @classmethod
          def from_row(cls, row):
              return cls(int(row["order_id"]), float(row["amount"]), row["status"])
    tests:
      - call: "Order.from_row({'order_id': '3', 'amount': '9.5', 'status': 'delivered'})"
        expect: "Order(3, 9.5, 'delivered')"
      - call: "Order(1, 2.0, 'returned').is_billable"
        expect: "False"
interview:
  - q: "When would you use a class in a data pipeline codebase?"
    type: concept
    level: 2
    keyPoints:
      - "bundle state and behaviour like API clients or connections"
      - "dataclasses for typed records and configs"
      - "composition over inheritance"
      - "keep transforms as pure functions"
