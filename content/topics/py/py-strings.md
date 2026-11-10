=== lesson
--- step concept: Strings are immutable sequences
A `str` is an immutable sequence of characters. Every "change" creates a **new** string — methods return results, they never modify in place.
```python
name = "  Diya SHARMA "
clean = name.strip().title()   # 'Diya Sharma'
print(name)                     # unchanged: '  Diya SHARMA '
```
> [!WHY] Raw data is full of messy text: stray spaces, inconsistent case, different separators. Cleaning strings correctly is the first step of almost every ingestion job.

[[quiz:py-strings:q0]]

--- step example: The cleaning toolkit
```python
s = "  Order-123 | DELIVERED  "
s.strip()                # remove surrounding whitespace
s.lower(), s.upper()     # case
s.replace("-", "_")      # substitute
s.split("|")             # ['  Order-123 ', ' DELIVERED  ']
"|".join(["a", "b"])     # 'a|b'
s.strip().startswith("Order")
f"{3.14159:.2f}"          # '3.14' — f-strings for formatting
```
Slicing: `s[start:stop:step]`, negative indexes count from the end: `"2025-06-01"[:4] == "2025"`.

--- step practice: Normalise an email
[[exercise:py-strings-1]]

--- step practice: Parse a log line
[[exercise:py-strings-2]]

--- step challenge: Phone numbers
[[exercise:py-strings-3]]

=== detailed
## What strings are
Immutable sequences of Unicode code points. Immutability makes them hashable (usable as dict keys) and safe to share, but means building a string piece by piece in a loop with `+=` creates many intermediate copies — use `"".join(parts)`.

## Essential methods
| Task | Method |
|---|---|
| trim | `strip()`, `lstrip()`, `rstrip()` (also `strip(".,")` for specific chars) |
| case | `lower()`, `upper()`, `title()`, `casefold()` (aggressive lower for comparisons) |
| search | `in`, `find()` (−1 if absent), `index()` (raises), `startswith/endswith` (accept tuples) |
| split/join | `split(sep, maxsplit)`, `rsplit`, `splitlines`, `sep.join(iterable)` |
| replace | `replace(old, new, count)` |
| test | `isdigit()`, `isalpha()`, `isalnum()`, `isspace()` |
| pad | `zfill(5)`, `rjust`, `ljust`, `center` |

`split()` with **no argument** splits on any run of whitespace and drops empty strings — usually what you want for messy text.

## f-strings
```python
f"{name!r}"         # repr
f"{amount:,.2f}"    # 12,345.68
f"{ratio:.1%}"      # 12.3%
f"{n:05d}"          # 00042
f"{dt:%Y-%m-%d}"    # date formatting
```

## Regular expressions (re)
For patterns beyond simple methods: `re.search`, `re.findall`, `re.sub`, `re.fullmatch`, named groups `(?P<level>\w+)`. Compile once (`re.compile`) when used in a loop. Prefer simple string methods when they suffice — they are faster and clearer.

## Encoding
Text on disk is bytes. Always pass `encoding="utf-8"` when opening files; decoding errors (`UnicodeDecodeError`) usually mean the file is in another encoding (e.g. `cp1252`, `latin-1`). `errors="replace"` keeps the pipeline running but loses characters — log it.

## Performance considerations
- `"".join(list_of_parts)` is O(n); repeated `+=` can be O(n²).
- `in` on a string is a substring search; for membership in many values use a `set`.

## Common mistakes
> [!MISTAKE] Calling `s.strip()` and expecting `s` to change — strings are immutable; assign the result.

> [!MISTAKE] `s.split(" ")` on text with double spaces gives empty strings — use `s.split()`.

> [!MISTAKE] Comparing user input case-sensitively (`"Delivered" != "delivered"`).

=== crisp
- Strings are **immutable** → methods return new strings: `s = s.strip()`.
- Clean: `strip`, `lower`/`casefold`, `replace`, `split()` (no arg = any whitespace), `"sep".join(list)`.
- Search: `in`, `find` (−1), `startswith(("a","b"))`.
- Slice: `s[a:b]`, `s[-3:]`, `s[::-1]`.
- f-strings: `{x:,.2f}`, `{p:.1%}`, `{n:05d}`, `{d:%Y-%m-%d}`.
- Regex for patterns: `re.search/findall/sub`, named groups, compile once.
- Files: always `encoding="utf-8"`.
- Build big strings with `join`, not `+=` in loops.

=== memory
- **"Strings never change — they get replaced."**
- `split()` empty-handed eats all whitespace.
- Trigger: *"my strip didn't work"* → forgot to assign.

=== data
flashcards:
  - q: "Why doesn't `s.strip()` change s?"
    a: "Strings are immutable; the method returns a new string. Assign it: s = s.strip()."
  - q: "Difference between `s.split()` and `s.split(' ')`?"
    a: "split() splits on any whitespace run and drops empty strings; split(' ') splits on each single space and can yield ''."
  - q: "Format 12345.678 as '12,345.68'."
    a: "f'{x:,.2f}'"
  - q: "Fast way to build a long string from many parts?"
    a: "''.join(parts)"
quiz:
  - q: "What is printed? `s = ' a '; s.upper(); print(repr(s))`"
    options: ["' A '", "' a '", "'A'", "'a'"]
    answer: 1
    explain: "upper() returns a new string that was discarded."
recall:
  - q: "Explain why Python strings are immutable and one consequence for data cleaning code."
    keyPoints:
      - "string cannot change after creation"
      - "methods return a new string"
      - "must assign the result"
      - "hashable so usable as dict keys"
      - "use join instead of += in loops"
exercises:
  - id: py-strings-1
    lang: python
    kind: coding
    difficulty: 1
    title: Normalise an email
    prompt: |
      Write `normalize_email(raw)` that trims whitespace and lower-cases the email. Return `None` if the result is empty or does not contain exactly one `@`.
    starter: |
      def normalize_email(raw):
          pass
    solution: |
      def normalize_email(raw):
          if raw is None:
              return None
          email = raw.strip().lower()
          if not email or email.count("@") != 1:
              return None
          return email
    tests:
      - call: normalize_email("  Diya.Rao@Example.com ")
        expect: "'diya.rao@example.com'"
      - call: normalize_email("")
        expect: "None"
      - call: normalize_email("no-at-sign")
        expect: "None"
        hidden: true
        label: missing @
      - call: normalize_email("a@b@c.com")
        expect: "None"
        hidden: true
        label: two @
      - call: normalize_email(None)
        expect: "None"
        hidden: true
        label: None input
    hints:
      - "strip() then lower(); check with .count('@')."
      - "Think about None input too."
  - id: py-strings-2
    lang: python
    kind: coding
    difficulty: 2
    title: Parse a pipeline log line
    prompt: |
      Log lines look like:
      `2025-06-01T03:21:00Z ERROR pipeline=orders_daily msg="load failed: timeout after 30s"`

      Write `parse_log(line)` returning a dict with keys `ts`, `level`, `pipeline`, `msg` (msg without the quotes). Use string methods (split with `maxsplit`) or `re`.
    starter: |
      def parse_log(line):
          pass
    solution: |
      def parse_log(line):
          ts, level, pipe, rest = line.strip().split(" ", 3)
          msg = rest.split("=", 1)[1].strip('"')
          return {"ts": ts, "level": level, "pipeline": pipe.split("=", 1)[1], "msg": msg}
    tests:
      - call: |-
          parse_log('2025-06-01T03:21:00Z ERROR pipeline=orders_daily msg="load failed: timeout after 30s"')
        expect: "{'ts': '2025-06-01T03:21:00Z', 'level': 'ERROR', 'pipeline': 'orders_daily', 'msg': 'load failed: timeout after 30s'}"
        label: example line
      - call: |-
          parse_log('2025-06-02T00:00:00Z INFO pipeline=events msg="rows loaded=10"')['msg']
        expect: "'rows loaded=10'"
        hidden: true
        label: "= inside the message"
    hints:
      - "line.split(' ', 3) gives exactly 4 parts — the message may contain spaces."
      - "split('=', 1) splits only at the first '='."
  - id: py-strings-3
    lang: python
    kind: coding
    difficulty: 2
    title: Standardise phone numbers
    prompt: |
      Write `clean_phone(raw)` that keeps only digits; if the result has 12 digits starting with `91`, drop the `91`; return the 10-digit string, or `None` if it is not 10 digits.
    starter: |
      def clean_phone(raw):
          pass
    solution: |
      def clean_phone(raw):
          digits = "".join(ch for ch in str(raw) if ch.isdigit())
          if len(digits) == 12 and digits.startswith("91"):
              digits = digits[2:]
          return digits if len(digits) == 10 else None
    tests:
      - call: clean_phone("+91 98765-43210")
        expect: "'9876543210'"
      - call: clean_phone("(987) 654 3210")
        expect: "'9876543210'"
      - call: clean_phone("12345")
        expect: "None"
      - call: clean_phone(9876543210)
        expect: "'9876543210'"
        hidden: true
        label: integer input
    hints:
      - "Build a string of only the characters where ch.isdigit()."
interview:
  - q: "How would you clean and standardise a messy text column (names, emails) in a Python ingestion step?"
    type: scenario
    level: 1
    keyPoints:
      - "strip whitespace and normalise case"
      - "validate format and handle None"
      - "keep raw value and write cleaned value separately"
      - "count / log rejected values"
      - "make the function pure and unit tested"
