=== lesson
--- step concept: Pulling data from APIs
Many sources are REST APIs: you send HTTP requests, you get JSON back. A production-quality extractor handles four things:
1. **Authentication** — API keys / OAuth tokens from a secret store, never hard-coded.
2. **Pagination** — results arrive in pages (`page=2`, `offset`, or a `next_cursor`).
3. **Rate limits** — HTTP `429 Too Many Requests` (often with `Retry-After`).
4. **Failures** — timeouts and `5xx` errors are transient → retry with backoff; `4xx` (except 429) are usually your bug → fail.

```python
import requests, time
def get_page(url, params, token):
    r = requests.get(url, params=params, headers={"Authorization": f"Bearer {token}"}, timeout=30)
    if r.status_code == 429:
        time.sleep(int(r.headers.get("Retry-After", 5)))
        return get_page(url, params, token)
    r.raise_for_status()
    return r.json()
```
*(The practice sandbox has no internet, so the exercises use a simulated API with the same behaviour.)*

[[quiz:py-apis:q0]]

--- step practice: Follow the cursor
[[exercise:py-apis-1]]

--- step practice: Survive rate limits
[[exercise:py-apis-2]]

--- step scenario: Incremental extraction
[[exercise:py-apis-3]]
[[recall:py-apis:r0]]

=== detailed
## HTTP essentials
- Methods: GET (read), POST (create/query), PUT/PATCH (update), DELETE.
- Status codes: `2xx` success · `3xx` redirect · `4xx` client error (400 bad request, 401 unauthorised, 403 forbidden, 404 not found, 429 rate limited) · `5xx` server error (500, 502, 503, 504).
- Always set a **timeout** (`requests.get(..., timeout=30)`) — the default is to wait forever.

## Pagination styles
| Style | Request | Stop when |
|---|---|---|
| Page number | `?page=3&per_page=100` | empty page / page > total_pages |
| Offset/limit | `?offset=300&limit=100` | fewer than limit returned |
| Cursor | `?cursor=abc` | `next_cursor` is null |
| Link header | `Link: <…>; rel="next"` | no next link |

Cursor pagination is the most robust when data changes during extraction (offsets can skip or duplicate records as rows are inserted).

## Rate limits and retries
- Respect `Retry-After`; otherwise **exponential backoff with jitter**: `sleep(base * 2**attempt + random.uniform(0, 1))`.
- Cap attempts; log each retry; raise after the last.
- Use `requests.Session` with `urllib3.Retry` adapters, or libraries like `tenacity`.
- Throttle proactively to stay under limits (e.g. max N requests/second).

## Incremental extraction
Don't re-download everything daily. Use a **watermark**: request records `updated_since = last_successful_max_updated_at`, store the new max **only after the load succeeds**. Overlap the window slightly (e.g. minus 5 minutes) and deduplicate downstream to handle late updates and clock skew.

## Landing the data
- Write the **raw responses** (JSON Lines, partitioned by extraction date) to object storage (GCS) first — the bronze layer — then load/transform. Enables reprocessing and debugging.
- Record metadata: request params, page count, record count, extraction timestamp.
- Validate: expected fields present, counts reasonable vs history.

## Security
Tokens come from environment variables / Secret Manager / Airflow connections. Never log full tokens or commit them.

## Common mistakes
> [!MISTAKE] No timeout → job hangs forever.

> [!MISTAKE] Retrying 400/401 errors.

> [!MISTAKE] Updating the watermark before the load is committed → data loss on failure.

> [!MISTAKE] Offset pagination on a changing dataset → missing/duplicated records.

=== crisp
- Always: **timeout**, auth from secrets, `raise_for_status()`.
- Pagination: page / offset / **cursor** (most robust) / Link header. Loop until no next.
- 429 → wait `Retry-After`; 5xx/timeouts → exponential backoff + jitter, capped; 4xx → don't retry, fix.
- Incremental: `updated_since = watermark`; advance watermark **after** successful load; small overlap + dedup.
- Land raw JSON first (bronze), with metadata; transform later.
- `requests.Session` + retry adapter or `tenacity`.

=== memory
- **"Timeout, paginate, back off, land raw."**
- **4xx = your fault, 5xx = their fault, 429 = slow down.**
- Watermark rule: **"commit the data, then move the bookmark."**

=== data
flashcards:
  - q: "Which HTTP status codes should an extractor retry?"
    a: "429 (respecting Retry-After), 5xx and timeouts/connection errors. Not other 4xx."
  - q: "Why is cursor pagination safer than offset pagination?"
    a: "Offsets shift when rows are inserted/deleted during extraction, causing skipped or duplicate records."
  - q: "When should the watermark for incremental API extraction be updated?"
    a: "Only after the data for that run is successfully loaded."
  - q: "What is the default timeout of requests.get?"
    a: "None — it can wait forever. Always pass timeout=."
  - q: "Why land raw API responses before transforming?"
    a: "To reprocess history after bugs, debug issues, and decouple extraction from transformation."
quiz:
  - q: "An API returns 401 Unauthorized. Your extractor should…"
    options: ["retry 10 times", "fail and alert — credentials need fixing", "sleep and retry forever", "ignore and continue"]
    answer: 1
recall:
  - q: "Describe how you would build a reliable daily extractor for a paginated, rate-limited REST API."
    keyPoints:
      - "auth token from a secret store"
      - "follow pagination until no next page"
      - "timeouts and retries with exponential backoff"
      - "respect 429 Retry-After"
      - "incremental watermark updated after successful load"
      - "land raw responses with metadata"
      - "validate record counts"
exercises:
  - id: py-apis-1
    lang: python
    kind: coding
    difficulty: 2
    title: Follow the cursor
    prompt: |
      `fake_api(cursor)` (already defined) returns `{"data": [...], "next_cursor": str or None}`. Write `fetch_all(api)` that calls `api(None)` first, then keeps following `next_cursor` until it is `None`, returning all records in order.
    starter: |
      PAGES = {None: ([1, 2, 3], "c1"), "c1": ([4, 5], "c2"), "c2": ([6], None)}
      def fake_api(cursor):
          data, nxt = PAGES[cursor]
          return {"data": list(data), "next_cursor": nxt}

      def fetch_all(api):
          pass

      print(fetch_all(fake_api))
    solution: |
      PAGES = {None: ([1, 2, 3], "c1"), "c1": ([4, 5], "c2"), "c2": ([6], None)}
      def fake_api(cursor):
          data, nxt = PAGES[cursor]
          return {"data": list(data), "next_cursor": nxt}

      def fetch_all(api):
          records, cursor = [], None
          while True:
              page = api(cursor)
              records.extend(page["data"])
              cursor = page["next_cursor"]
              if cursor is None:
                  return records

      print(fetch_all(fake_api))
    tests:
      - call: "fetch_all(fake_api)"
        expect: "[1, 2, 3, 4, 5, 6]"
      - call: "fetch_all(lambda c: {'data': [], 'next_cursor': None})"
        expect: "[]"
        hidden: true
        label: single empty page
    hints:
      - "Loop: call the API, extend results, move the cursor, stop at None."
  - id: py-apis-2
    lang: python
    kind: coding
    difficulty: 3
    title: Handle 429 and 503
    prompt: |
      `call()` returns a `Response`-like object with `.status` and `.json()`. Write `get_with_retry(call, max_attempts=4, sleep=lambda s: None)`:
      - 200 → return `.json()`
      - 429 → sleep `resp.retry_after` seconds, then retry
      - 500/502/503/504 → sleep `2 ** attempt` (attempt starting at 0), then retry
      - any other status → raise `ValueError(f"HTTP {status}")` immediately
      - after `max_attempts` failed attempts → raise `RuntimeError("gave up")`

      The `sleep` parameter lets tests run instantly — call it instead of `time.sleep`.
    starter: |
      class Resp:
          def __init__(self, status, body=None, retry_after=1):
              self.status, self.body, self.retry_after = status, body, retry_after
          def json(self):
              return self.body

      def get_with_retry(call, max_attempts=4, sleep=lambda s: None):
          pass
    solution: |
      class Resp:
          def __init__(self, status, body=None, retry_after=1):
              self.status, self.body, self.retry_after = status, body, retry_after
          def json(self):
              return self.body

      def get_with_retry(call, max_attempts=4, sleep=lambda s: None):
          for attempt in range(max_attempts):
              resp = call()
              if resp.status == 200:
                  return resp.json()
              if resp.status == 429:
                  sleep(resp.retry_after)
              elif resp.status in (500, 502, 503, 504):
                  sleep(2 ** attempt)
              else:
                  raise ValueError(f"HTTP {resp.status}")
          raise RuntimeError("gave up")
    tests:
      - call: "get_with_retry(lambda: Resp(200, {'ok': True}))"
        expect: "{'ok': True}"
    check: |
      seq = iter([Resp(503), Resp(429, retry_after=7), Resp(200, [1])])
      slept = []
      assert get_with_retry(lambda: next(seq), sleep=slept.append) == [1], 'should succeed on the third call'
      assert slept == [1, 7], f'expected sleeps [1, 7] (2**0 then Retry-After), got {slept}'
      try:
          get_with_retry(lambda: Resp(404))
          raise AssertionError('404 must raise ValueError immediately')
      except ValueError:
          pass
      try:
          get_with_retry(lambda: Resp(503), max_attempts=3)
          raise AssertionError('should give up after max_attempts')
      except RuntimeError:
          pass
  - id: py-apis-3
    lang: python
    kind: scenario
    difficulty: 3
    title: Watermark-based incremental pull
    prompt: |
      Write `incremental_pull(api, state, load)`:
      - `state` is a dict that may contain `"watermark"` (ISO timestamp string) — absent on the first run.
      - call `api(updated_since)` → list of records with `"id"` and `"updated_at"`; use `state["watermark"]` or `"1970-01-01T00:00:00"`.
      - pass the records to `load(records)` (which may raise!).
      - **only after `load` succeeds**, set `state["watermark"]` to the max `updated_at` of the records (unchanged if no records).
      - return the number of records loaded.
    starter: |
      def incremental_pull(api, state, load):
          pass
    solution: |
      def incremental_pull(api, state, load):
          since = state.get("watermark", "1970-01-01T00:00:00")
          records = api(since)
          load(records)
          if records:
              state["watermark"] = max(r["updated_at"] for r in records)
          return len(records)
    tests:
      - call: "incremental_pull(lambda s: [{'id': 1, 'updated_at': '2025-01-02T00:00:00'}, {'id': 2, 'updated_at': '2025-01-03T00:00:00'}], {}, lambda r: None)"
        expect: "2"
    check: |
      st = {}
      incremental_pull(lambda s: [{'id': 1, 'updated_at': '2025-01-02T00:00:00'}], st, lambda r: None)
      assert st == {'watermark': '2025-01-02T00:00:00'}, f'watermark not advanced: {st}'
      seen = []
      incremental_pull(lambda s: seen.append(s) or [], st, lambda r: None)
      assert seen == ['2025-01-02T00:00:00'], 'second run must ask for records since the watermark'
      def boom(r):
          raise IOError('warehouse down')
      try:
          incremental_pull(lambda s: [{'id': 9, 'updated_at': '2025-02-01T00:00:00'}], st, boom)
      except IOError:
          pass
      assert st['watermark'] == '2025-01-02T00:00:00', 'watermark must NOT move when the load fails'
    hints:
      - "Only touch state after load() returns."
      - "ISO timestamps compare correctly as strings, so max() works."
interview:
  - q: "How do you design an API ingestion job that is safe to rerun and does not miss data?"
    type: scenario
    level: 3
    keyPoints:
      - "incremental watermark updated only after successful load"
      - "overlap window and deduplicate downstream"
      - "idempotent load with merge on id"
      - "retries for transient errors with backoff"
      - "land raw data for reprocessing"
      - "monitor record counts"
    followUps:
      - "What if the API's updated_at is not reliable?"
      - "How do you backfill a year of history?"
