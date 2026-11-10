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
