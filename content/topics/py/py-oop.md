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
