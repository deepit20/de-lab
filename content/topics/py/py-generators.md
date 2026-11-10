=== lesson
--- step concept: Producing values lazily
A **generator** function uses `yield` instead of `return`. Calling it returns an iterator that produces values **one at a time, on demand**:
```python
def read_rows(path):
    with open(path) as f:
        next(f)                       # skip header
        for line in f:
            yield line.rstrip("\n").split(",")

rows = read_rows("/data/orders.csv")  # nothing has been read yet!
first = next(rows)                    # reads one line
```
> [!WHY] Generators let you build streaming pipelines — read → parse → filter → batch → load — where only one record (or one batch) is in memory at a time, no matter how big the input is.

[[quiz:py-generators:q0]]

--- step example: Chaining generators
```python
def parse(rows):
    for r in rows:
        yield {"id": int(r[0]), "amount": float(r[5])}

def only_large(recs, threshold):
    return (r for r in recs if r["amount"] >= threshold)   # generator expression

pipeline = only_large(parse(read_rows("/data/orders.csv")), 300)
print(sum(1 for _ in pipeline))
```
Each stage pulls from the previous one. Nothing runs until something consumes the end.

--- step practice: Batching
[[exercise:py-generators-1]]

--- step check: Generators are single-use
Once exhausted, a generator yields nothing more. Iterating it twice gives an empty second pass — a subtle bug.

[[quiz:py-generators:q1]]
[[exercise:py-generators-2]]

--- step challenge: Streaming pipeline
[[exercise:py-generators-3]]
[[recall:py-generators:r0]]

=== detailed
## Iterables, iterators, generators
- **Iterable**: anything you can loop over (`list`, `dict`, file, range) — has `__iter__`.
- **Iterator**: an object with `__next__` that remembers its position; raises `StopIteration` at the end.
- **Generator**: the easiest way to write an iterator — a function containing `yield`, or a generator expression `(x for x in xs)`.

## How yield works
Execution pauses at each `yield`, handing out a value; the local state is kept; the next `next()` resumes right after the `yield`. When the function ends, `StopIteration` is raised automatically (for-loops handle it).

## Why it matters for data engineering
| Eager (list) | Lazy (generator) |
|---|---|
| memory ∝ data size | memory ∝ one item / one batch |
| all work done up front | work done as consumed |
| reusable | single pass |

Streaming patterns: reading huge files, paging through APIs (`yield` each page's records), chunked database loads (`yield` batches of 10 000 rows for `executemany`), log processing.

## Useful tools
- `itertools.islice(gen, n)` — take first n.
- `itertools.chain(a, b)` — concatenate iterables.
- `itertools.groupby(sorted_iter, key)` — group consecutive items (input must be sorted by key).
- `itertools.batched(it, n)` (Python 3.12) — batches.
- `yield from other_gen` — delegate.
- `enumerate`, `zip`, `map`, `filter` are all lazy.

## Pitfalls
> [!MISTAKE] Iterating a generator twice (second pass empty) — materialise with `list()` if you need two passes.

> [!MISTAKE] Generator reading a file opened outside a `with` that already closed: `ValueError: I/O operation on closed file`. Put the `with` *inside* the generator.

> [!MISTAKE] `len(gen)` — generators have no length.

=== crisp
- `yield` → generator function; calling it returns a lazy iterator. `(x for x in xs)` = generator expression.
- Values produced **on demand**; memory = one item. Ideal for big files, API pages, batch loads.
- Chain stages: `load(batches(filter(parse(read()))))` — nothing runs until consumed.
- **Single-use**: second iteration is empty. No `len()`.
- `next(gen)`, `itertools.islice/chain/groupby`, `yield from`.
- Keep the `with open()` **inside** the generator.

=== memory
- **"yield = pause and hand over."**
- **"A generator is a tap, not a bucket."**
- Trigger: *"second loop printed nothing"* → exhausted generator.
- Trigger: *"MemoryError on big file"* → stream with generators.

=== data
flashcards:
  - q: "What does calling a generator function return?"
    a: "A generator (lazy iterator) — no body code runs until next() is called."
  - q: "What happens when you loop over an exhausted generator?"
    a: "Nothing — it yields no more values."
  - q: "Why are generators useful for large files?"
    a: "They process one record at a time, so memory stays constant regardless of file size."
  - q: "What does `yield from sub()` do?"
    a: "Yields every value produced by the sub-generator."
  - q: "How do you take the first 5 items of a generator?"
    a: "itertools.islice(gen, 5)"
quiz:
  - q: "`g = (x * 2 for x in range(3)); list(g); print(list(g))` prints…"
    options: ["[0, 2, 4]", "[]", "error", "[0, 2, 4, 0, 2, 4]"]
    answer: 1
  - q: "Which uses constant memory for a 10 GB file?"
    options: ["lines = f.readlines()", "data = f.read().split('\\n')", "for line in f: ...", "list(f)"]
    answer: 2
recall:
  - q: "Explain how generators enable streaming data pipelines in Python."
    keyPoints:
      - "yield produces values lazily"
      - "one item in memory at a time"
      - "stages chained so each pulls from the previous"
      - "nothing runs until consumed"
      - "single-use iterators"
exercises:
  - id: py-generators-1
    lang: python
    kind: coding
    difficulty: 2
    title: Batch any iterable
    prompt: |
      Write a generator `batches(iterable, size)` yielding lists of up to `size` items. It must work on **any** iterable (including other generators) without converting it to a list first.
    starter: |
      def batches(iterable, size):
          pass
    solution: |
      def batches(iterable, size):
          batch = []
          for item in iterable:
              batch.append(item)
              if len(batch) == size:
                  yield batch
                  batch = []
          if batch:
              yield batch
    tests:
      - call: "list(batches(range(7), 3))"
        expect: "[[0, 1, 2], [3, 4, 5], [6]]"
      - call: "list(batches([], 3))"
        expect: "[]"
        hidden: true
        label: empty input
      - call: "list(batches((x for x in range(4)), 2))"
        expect: "[[0, 1], [2, 3]]"
        hidden: true
        label: generator input
    check: |
      import types
      assert isinstance(batches([1], 1), types.GeneratorType), "batches must be a generator function (use yield)"
    hints:
      - "Accumulate into a list; yield it when full; reset."
      - "Don't forget the last partial batch."
  - id: py-generators-2
    lang: python
    kind: debug
    difficulty: 2
    title: "Debug: the report with zero rows"
    prompt: |
      `report(path)` should return `(count, total)` of order amounts, but `total` is always 0. Fix it while keeping `read_amounts` a generator.
    starter: |
      import csv

      def read_amounts(path):
          with open(path, newline="") as f:
              for row in csv.DictReader(f):
                  yield float(row["amount"])

      def report(path):
          amounts = read_amounts(path)
          count = sum(1 for _ in amounts)
          total = sum(amounts)
          return count, round(total, 2)

      print(report("/data/orders.csv"))
    solution: |
      import csv

      def read_amounts(path):
          with open(path, newline="") as f:
              for row in csv.DictReader(f):
                  yield float(row["amount"])

      def report(path):
          count, total = 0, 0.0
          for a in read_amounts(path):
              count += 1
              total += a
          return count, round(total, 2)

      print(report("/data/orders.csv"))
    tests:
      - call: "report('/data/orders.csv')[0]"
        expect: "900"
      - call: "report('/data/orders.csv')[1] > 10000"
        expect: "True"
    hints:
      - "What is left in the generator after the first sum?"
      - "Compute both values in a single pass."
  - id: py-generators-3
    lang: python
    kind: coding
    difficulty: 3
    title: A streaming log pipeline
    prompt: |
      Build `error_counts(path)` from three generator stages over `/data/pipeline.log`:
      1. `lines(path)` — yields stripped non-empty lines
      2. `parse(lines)` — yields `(level, pipeline)` from lines like `2025-06-01T00:00:00Z ERROR pipeline=orders_daily msg="…"`
      3. `errors_only(records)` — yields records with level `ERROR`

      `error_counts` returns `{pipeline: number_of_errors}`.
    starter: |
      def lines(path):
          pass

      def parse(lines):
          pass

      def errors_only(records):
          pass

      def error_counts(path):
          counts = {}
          for level, pipeline in errors_only(parse(lines(path))):
              counts[pipeline] = counts.get(pipeline, 0) + 1
          return counts

      print(error_counts("/data/pipeline.log"))
    solution: |
      def lines(path):
          with open(path, encoding="utf-8") as f:
              for line in f:
                  line = line.strip()
                  if line:
                      yield line

      def parse(lines):
          for line in lines:
              parts = line.split(" ", 3)
              yield parts[1], parts[2].split("=", 1)[1]

      def errors_only(records):
          return (r for r in records if r[0] == "ERROR")

      def error_counts(path):
          counts = {}
          for level, pipeline in errors_only(parse(lines(path))):
              counts[pipeline] = counts.get(pipeline, 0) + 1
          return counts

      print(error_counts("/data/pipeline.log"))
    tests:
      - call: "sum(error_counts('/data/pipeline.log').values()) > 0"
        expect: "True"
      - call: "set(error_counts('/data/pipeline.log')) <= {'orders_daily', 'customers_sync', 'events_stream'}"
        expect: "True"
    check: |
      import collections
      exp = collections.Counter(l.split()[2].split('=')[1] for l in open('/data/pipeline.log') if l.split()[1:2] == ['ERROR'])
      assert error_counts('/data/pipeline.log') == dict(exp), 'Counts do not match the log file'
interview:
  - q: "What is a generator in Python and when would you use one in data engineering?"
    type: concept
    level: 2
    keyPoints:
      - "function with yield producing values lazily"
      - "constant memory streaming"
      - "large files or paginated APIs"
      - "chaining pipeline stages"
      - "single pass only"
