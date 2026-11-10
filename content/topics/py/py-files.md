=== lesson
--- step concept: Files are the edges of most pipelines
Raw data often arrives as files: CSV exports, JSON dumps, logs. The safe way to open a file is a `with` block — the file is closed automatically, even if an error happens:
```python
with open("/data/orders.csv", encoding="utf-8", newline="") as f:
    header = f.readline()
    for line in f:              # streams line by line — constant memory
        ...
```
Modes: `"r"` read (default), `"w"` write (truncates!), `"a"` append, `"x"` create-only, add `"b"` for bytes.

> [!WHY] Streaming line by line lets a laptop process files far bigger than its memory. `f.read()` loads everything at once.

[[quiz:py-files:q0]]

--- step example: The csv module
Never split CSV lines on commas yourself — quoted fields can contain commas.
```python
import csv
with open("/data/orders.csv", newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)          # each row -> dict keyed by header
    rows = [r for r in reader if r["status"] != "cancelled"]

with open("/out/clean.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=["order_id", "amount"])
    writer.writeheader()
    writer.writerows({"order_id": r["order_id"], "amount": r["amount"]} for r in rows)
```
All values come back as **strings** — convert types explicitly.

--- step practice: Summarise a CSV
[[exercise:py-files-1]]

--- step practice: Validate rows and quarantine bad ones
[[exercise:py-files-2]]

--- step challenge: Transform file to file
[[exercise:py-files-3]]
[[recall:py-files:r0]]

=== detailed
## Opening files
`open(path, mode="r", encoding="utf-8", newline="")` returns a file object. Always use `with` (a context manager) so the file is closed and buffers flushed. Use `pathlib.Path` for paths: `Path("/data") / "orders.csv"`, `.exists()`, `.glob("*.csv")`, `.stem`, `.suffix`.

## Reading strategies
| Method | Memory | Use |
|---|---|---|
| `for line in f` | constant | large files, logs |
| `f.readline()` | one line | headers |
| `f.read()` | whole file | small files only |
| `csv.reader / DictReader` | streaming | CSV with quoting |

## CSV specifics
- Open with `newline=""` (lets the csv module handle line endings, including newlines inside quoted fields).
- `DictReader` uses the first row as keys; `DictWriter(fieldnames=…)` writes dicts.
- Delimiters: `csv.reader(f, delimiter=";")`; TSV: `delimiter="\t"`.
- Everything is text: convert with `int()`, `float()`, `Decimal()`, date parsing — and handle failures.
- Header drift (renamed/reordered columns) is a real failure mode — validate the header against the expected columns.

## Writing safely
- `"w"` truncates immediately. To avoid half-written outputs when a job crashes, write to a **temporary file** and `os.replace(tmp, final)` (atomic rename on the same filesystem). Downstream readers never see a partial file.
- Write outputs deterministically (sorted, fixed column order) so reruns produce identical files — helps idempotency and diffing.

## Bad records
Real files contain malformed rows. Options:
1. **Fail fast** — reject the whole file (strict contracts, financial data).
2. **Quarantine** — write bad rows with an error reason to a reject file / table, continue with good rows, alert if the reject rate exceeds a threshold.
3. **Coerce** — default values (only when the business agrees).

## Binary and large files
- `rb`/`wb` for images, Parquet, gzip (`gzip.open(path, "rt")` reads compressed text).
- For analytics-scale files use columnar formats (Parquet) and tools (pandas/pyarrow, Spark) rather than row-by-row Python.

## Common mistakes
> [!MISTAKE] `line.split(",")` on CSV with quoted commas.

> [!MISTAKE] Forgetting `encoding` → platform-dependent decoding (Windows cp1252) → `UnicodeDecodeError`.

> [!MISTAKE] Opening the output with `"w"` before validating input → previous good output is wiped on failure.

> [!MISTAKE] Treating CSV numbers as numbers without conversion ("10" > "9" is False as strings).

=== crisp
- `with open(p, encoding="utf-8", newline="") as f:` — always `with`, always encoding.
- Stream large files: `for line in f`. `f.read()` only for small files.
- CSV: `csv.DictReader` / `csv.DictWriter` — never split on commas manually. Values are **strings**.
- Modes: `r`, `w` (truncates!), `a`, `x`, `b`.
- Atomic output: write temp file → `os.replace(tmp, final)`.
- Bad rows: fail fast vs quarantine (with reason) vs coerce; alert on reject rate.
- `pathlib.Path` for paths; `gzip.open(p, "rt")` for .gz.

=== memory
- **"With opens, with closes."**
- **"CSV gives you strings, never numbers."**
- **"Write to temp, rename to final."**
- Trigger: *"UnicodeDecodeError"* → encoding.
- Trigger: *"columns shifted"* → manual split on quoted commas.

=== data
flashcards:
  - q: "Why use `with open(...)`?"
    a: "It closes the file automatically, even when an exception occurs."
  - q: "Why open CSV files with newline=''?"
    a: "So the csv module handles line endings itself, including newlines inside quoted fields."
  - q: "What type are values from csv.DictReader?"
    a: "Strings (or '' for empty) — convert explicitly."
  - q: "How do you avoid leaving a half-written output file?"
    a: "Write to a temp file, then os.replace(tmp, final) atomically."
  - q: "What happens when you open an existing file with mode 'w'?"
    a: "It is truncated to zero length immediately."
quiz:
  - q: "Best way to process a 20 GB log file on an 8 GB laptop?"
    options: ["f.read() then split", "iterate `for line in f`", "readlines()", "it is impossible"]
    answer: 1
recall:
  - q: "How should a file ingestion job handle malformed rows?"
    keyPoints:
      - "validate each row against expected schema"
      - "quarantine bad rows with an error reason"
      - "continue with good rows or fail fast depending on contract"
      - "alert when reject rate exceeds threshold"
      - "never silently drop data"
exercises:
  - id: py-files-1
    lang: python
    kind: coding
    difficulty: 1
    title: Revenue by channel from CSV
    prompt: |
      Write `channel_revenue(path)` that reads the orders CSV (columns include `channel`, `status`, `amount`) with `csv.DictReader` and returns `{channel: revenue}` for non-cancelled orders, rounded to 2. Test it on `/data/orders.csv`.
    starter: |
      import csv

      def channel_revenue(path):
          pass

      print(channel_revenue("/data/orders.csv"))
    solution: |
      import csv

      def channel_revenue(path):
          totals = {}
          with open(path, newline="", encoding="utf-8") as f:
              for row in csv.DictReader(f):
                  if row["status"] == "cancelled":
                      continue
                  totals[row["channel"]] = totals.get(row["channel"], 0) + float(row["amount"])
          return {k: round(v, 2) for k, v in totals.items()}

      print(channel_revenue("/data/orders.csv"))
    tests:
      - call: "sorted(channel_revenue('/data/orders.csv'))"
        expect: "['app', 'store', 'web']"
      - call: "round(sum(channel_revenue('/data/orders.csv').values()), 2) > 0"
        expect: "True"
    check: |
      import csv
      exp = {}
      for r in csv.DictReader(open('/data/orders.csv', newline='')):
          if r['status'] != 'cancelled':
              exp[r['channel']] = exp.get(r['channel'], 0) + float(r['amount'])
      got = channel_revenue('/data/orders.csv')
      assert all(abs(got[k] - round(v, 2)) < 0.01 for k, v in exp.items()), "Totals don't match — did you convert amount with float() and skip cancelled orders?"
    hints:
      - "csv.DictReader(f) yields dicts; amount is a string → float()."
  - id: py-files-2
    lang: python
    kind: scenario
    difficulty: 2
    title: Quarantine bad rows
    prompt: |
      `/data/messy_customers.csv` has columns `customer_id,name,email,city,updated_at`. Write `split_valid(path)` returning `(good, bad)`:
      - **good**: list of dicts with `customer_id` as int, `email` lower-cased/trimmed
      - **bad**: list of `(line_number, reason)` for rows where `customer_id` is not an integer (reason `"bad id"`) or the email is non-empty but has no `@` (reason `"bad email"`). Line numbers start at 2 (first data row).
    starter: |
      import csv

      def split_valid(path):
          good, bad = [], []
          return good, bad

      good, bad = split_valid("/data/messy_customers.csv")
      print(len(good), "good,", len(bad), "bad:", bad[:5])
    solution: |
      import csv

      def split_valid(path):
          good, bad = [], []
          with open(path, newline="", encoding="utf-8") as f:
              for line_no, row in enumerate(csv.DictReader(f), start=2):
                  try:
                      cid = int(row["customer_id"])
                  except ValueError:
                      bad.append((line_no, "bad id"))
                      continue
                  email = row["email"].strip().lower()
                  if email and "@" not in email:
                      bad.append((line_no, "bad email"))
                      continue
                  good.append({**row, "customer_id": cid, "email": email})
          return good, bad

      good, bad = split_valid("/data/messy_customers.csv")
      print(len(good), "good,", len(bad), "bad:", bad[:5])
    tests:
      - call: "split_valid('/data/messy_customers.csv')[1]"
        expect: "[(7, 'bad id')]"
      - call: "all(isinstance(r['customer_id'], int) for r in split_valid('/data/messy_customers.csv')[0])"
        expect: "True"
    hints:
      - "enumerate(reader, start=2) gives file line numbers."
      - "Wrap int() in try/except ValueError."
  - id: py-files-3
    lang: python
    kind: coding
    difficulty: 2
    title: Write a clean extract atomically
    prompt: |
      Write `write_delivered(src, dst)` that reads the orders CSV and writes only **delivered** orders with columns `order_id,order_date,amount` to `dst`, sorted by `order_id` (as integers). Write to `dst + ".tmp"` first, then `os.replace` it into place. Return the number of rows written.
    starter: |
      import csv, os

      def write_delivered(src, dst):
          pass

      print(write_delivered("/data/orders.csv", "/out/delivered.csv"))
    solution: |
      import csv, os

      def write_delivered(src, dst):
          with open(src, newline="", encoding="utf-8") as f:
              rows = [r for r in csv.DictReader(f) if r["status"] == "delivered"]
          rows.sort(key=lambda r: int(r["order_id"]))
          tmp = dst + ".tmp"
          with open(tmp, "w", newline="", encoding="utf-8") as f:
              w = csv.DictWriter(f, fieldnames=["order_id", "order_date", "amount"], extrasaction="ignore")
              w.writeheader()
              w.writerows(rows)
          os.replace(tmp, dst)
          return len(rows)

      print(write_delivered("/data/orders.csv", "/out/delivered.csv"))
    tests:
      - call: "write_delivered('/data/orders.csv', 'delivered_test.csv') > 400"
        expect: "True"
      - call: "open('delivered_test.csv').readline().strip()"
        expect: "'order_id,order_date,amount'"
      - call: "__import__('os').path.exists('delivered_test.csv.tmp')"
        expect: "False"
        label: temp file renamed away
    hints:
      - "DictWriter(..., extrasaction='ignore') drops columns not in fieldnames."
      - "Sort with key=lambda r: int(r['order_id'])."
interview:
  - q: "How do you process a CSV file that is larger than memory in Python?"
    type: concept
    level: 2
    keyPoints:
      - "stream line by line with csv reader"
      - "process and aggregate incrementally"
      - "pandas chunksize or pyarrow for columnar"
      - "consider Spark / warehouse load for very large data"
      - "avoid read() / readlines()"
