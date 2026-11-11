=== lesson
--- step concept: date, datetime, timedelta
```python
from datetime import date, datetime, timedelta, timezone

d = date(2025, 3, 14)
ts = datetime(2025, 3, 14, 9, 30)
d + timedelta(days=1)          # date(2025, 3, 15)
(date(2025, 3, 31) - d).days   # 17
```
Pipelines constantly move between **text** and these objects.

--- step example: Parse and format
```python
datetime.strptime("14/03/2025 09:30", "%d/%m/%Y %H:%M")   # text → datetime
ts.strftime("%Y-%m-%d")                                  # datetime → text
ts.isoformat()                                           # '2025-03-14T09:30:00'
date.fromisoformat("2025-03-14")
```
`strptime` = **p**arse, `strftime` = **f**ormat.

--- step practice: Daily windows
Incremental loads process one window at a time: `[start, end)` — start included, end excluded — so windows never overlap.

[[exercise:py-datetime-1]]

--- step concept: Time zones — store UTC
A **naive** datetime has no time zone; an **aware** one does. Convert to UTC as soon as data enters, convert back only for display.

```python
from zoneinfo import ZoneInfo
local = datetime(2025, 6, 1, 23, 30, tzinfo=ZoneInfo("Asia/Kolkata"))
local.astimezone(timezone.utc)    # 2025-06-01 18:00:00+00:00
```
[[quiz:py-datetime:q0]]

[[exercise:py-datetime-2]]

--- step check: Dates in partitions
[[quiz:py-datetime:q1]]
[[quiz:py-datetime:q2]]

--- step interview: Explain it
[[recall:py-datetime:r0]]

=== detailed
## Types
| Type | Holds | Example |
|---|---|---|
| `date` | calendar day | `date(2025, 3, 14)` |
| `datetime` | day + time (+ optional tz) | `datetime(2025, 3, 14, 9, 30)` |
| `timedelta` | a duration | `timedelta(hours=6)` |
| `timezone` / `ZoneInfo` | offset / named zone | `ZoneInfo("Asia/Kolkata")` |

## Format codes
| Code | Meaning | Example |
|---|---|---|
| `%Y` | 4-digit year | 2025 |
| `%m` | month 01–12 | 03 |
| `%d` | day 01–31 | 14 |
| `%H:%M:%S` | 24h time | 09:30:00 |
| `%z` | UTC offset | +0530 |

## Time zone rules for data engineers
1. **Store UTC** in warehouses (`TIMESTAMP` in BigQuery is UTC).
2. Convert at the **edges**: on ingestion (source local time → UTC) and in reports (UTC → user's zone).
3. Never compare naive and aware datetimes — Python raises `TypeError`.
4. Daylight saving: some local times don't exist or occur twice; named zones (`ZoneInfo`) handle this, fixed offsets don't.
5. Decide which **business date** an event belongs to: an order at 23:30 IST on 1 June is 18:00 UTC on 1 June, but 01:30 IST on 2 June is 20:00 UTC on 1 June.

## Windows and partitions
- Use half-open intervals `[start, end)`: `WHERE ts >= start AND ts < end`.
- Airflow passes `data_interval_start` / `data_interval_end` — use them instead of `datetime.now()` so reruns process the same window.
- Partition columns are usually a `DATE` derived from the event timestamp in UTC.

> [!MISTAKE] Using `datetime.now()` inside a transformation makes reruns produce different results. Pass the run date in.

> [!MISTAKE] `BETWEEN '2025-03-01' AND '2025-03-31'` on a timestamp misses everything after midnight on the 31st.

=== crisp
```python
from datetime import datetime, date, timedelta, timezone
from zoneinfo import ZoneInfo

ts = datetime.fromisoformat("2025-06-01T10:30:00+05:30")   # aware
utc = ts.astimezone(timezone.utc)                            # 05:00 UTC
d = date(2025, 6, 1) + timedelta(days=7)
datetime.strptime("01/06/2025", "%d/%m/%Y")                  # parse custom format
ts.strftime("%Y-%m-%d")                                      # format
ts.astimezone(ZoneInfo("Asia/Kolkata"))
```
- **Naive** datetime has no time zone; **aware** has `tzinfo`. Never mix them.
- **Store and process in UTC**; convert to local time only for display/reporting.
- "Daily" partitions: be explicit about **which day** — UTC day vs business-local day differ around midnight.
- Incremental windows: half-open intervals `[start, end)` — `>= start AND < end` — no overlaps, no gaps.
- `datetime.now(timezone.utc)` not `datetime.utcnow()` (naive, deprecated).
- ISO 8601 strings sort chronologically as text.

=== memory
- **"UTC inside, local outside."**
- **"Half-open windows never overlap."**
- strptime = **p**arse, strftime = **f**ormat.

=== data
flashcards:
  - q: "Naive vs aware datetime?"
    a: "Aware has tzinfo (a time zone/offset); naive does not."
  - q: "Why store timestamps in UTC?"
    a: "Unambiguous, no DST jumps, consistent across systems; convert to local only at the edges."
  - q: "strptime vs strftime?"
    a: "strptime parses a string into a datetime; strftime formats a datetime into a string."
  - q: "Why use [start, end) windows for incremental loads?"
    a: "Consecutive windows neither overlap nor leave gaps."
quiz:
  - q: "An event at 2025-06-01 23:30 IST belongs to which UTC date?"
    options: ["2025-06-01", "2025-06-02", "2025-05-31", "depends on DST"]
    answer: 0
    explain: "IST is UTC+5:30, so 23:30 IST = 18:00 UTC on 2025-06-01."
  - q: "Why should a backfill use the run's logical date instead of `datetime.now()`?"
    options: ["it saves storage", "so rerunning a past date processes the same window", "now() is slow", "now() is not allowed in Python"]
    answer: 1
    explain: "Idempotent reruns need the window to depend on the run's date, not on when it happens to execute."
  - q: "Which filter correctly selects all events on 2025-03-31 for a TIMESTAMP column `ts`?"
    options: ["ts >= '2025-03-31' AND ts < '2025-04-01'", "ts BETWEEN '2025-03-31' AND '2025-03-31'", "ts = '2025-03-31'", "ts <= '2025-03-31'"]
    answer: 0
    explain: "A half-open interval covers the whole day, including times after midnight."
recall:
  - q: "What are your rules for handling dates, times and time zones in a pipeline?"
    keyPoints:
      - "store UTC, convert at the edges"
      - "aware vs naive datetimes"
      - "strptime to parse, strftime to format"
      - "half-open windows [start, end)"
      - "use the run's logical date, not now()"
      - "named zones handle daylight saving"
exercises:
  - id: py-datetime-1
    lang: python
    kind: coding
    difficulty: 2
    title: Daily windows
    prompt: |
      Write `daily_windows(start, end)` taking ISO date strings and returning a list of `(window_start, window_end)` ISO **date** string pairs covering `[start, end)` one day at a time.
      `daily_windows("2025-06-01", "2025-06-04")` → `[("2025-06-01","2025-06-02"), ("2025-06-02","2025-06-03"), ("2025-06-03","2025-06-04")]`
    starter: |
      from datetime import date, timedelta

      def daily_windows(start, end):
          pass
    solution: |
      from datetime import date, timedelta

      def daily_windows(start, end):
          s, e = date.fromisoformat(start), date.fromisoformat(end)
          out = []
          while s < e:
              out.append((s.isoformat(), (s + timedelta(days=1)).isoformat()))
              s += timedelta(days=1)
          return out
    tests:
      - call: "daily_windows('2025-06-01', '2025-06-04')"
        expect: "[('2025-06-01', '2025-06-02'), ('2025-06-02', '2025-06-03'), ('2025-06-03', '2025-06-04')]"
      - call: "daily_windows('2025-06-01', '2025-06-01')"
        expect: "[]"
        hidden: true
        label: empty range
      - call: "len(daily_windows('2024-02-28', '2024-03-01'))"
        expect: "2"
        hidden: true
        label: leap year
  - id: py-datetime-2
    lang: python
    kind: coding
    difficulty: 2
    title: Convert to UTC
    prompt: |
      Write `to_utc_iso(local_str, tz_name)` that parses a naive local timestamp `"YYYY-MM-DD HH:MM:SS"` in time zone `tz_name` and returns the UTC ISO string like `"2025-06-01T04:30:00+00:00"`.
    starter: |
      from datetime import datetime, timezone
      from zoneinfo import ZoneInfo

      def to_utc_iso(local_str, tz_name):
          pass
    solution: |
      from datetime import datetime, timezone
      from zoneinfo import ZoneInfo

      def to_utc_iso(local_str, tz_name):
          local = datetime.strptime(local_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=ZoneInfo(tz_name))
          return local.astimezone(timezone.utc).isoformat()
    tests:
      - call: "to_utc_iso('2025-06-01 10:00:00', 'Asia/Kolkata')"
        expect: "'2025-06-01T04:30:00+00:00'"
      - call: "to_utc_iso('2025-01-15 09:00:00', 'Europe/London')"
        expect: "'2025-01-15T09:00:00+00:00'"
        hidden: true
        label: winter London = UTC
interview:
  - q: "How do you handle time zones in a data pipeline?"
    type: concept
    level: 2
    keyPoints:
      - "store timestamps in UTC"
      - "use aware datetimes"
      - "convert to local only for reporting"
      - "be explicit about which day defines a partition"
      - "half-open intervals for windows"
