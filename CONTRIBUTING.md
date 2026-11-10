# Contributing to DE Lab

Thanks for helping! The fastest way to make DE Lab better is **content**: lessons, notes, exercises and interview questions. Code contributions are welcome too.

## Setup
```bash
npm install
npm run dev          # http://localhost:5178 — content recompiles when you save a file in content/
```

## Adding or improving a topic
The roadmap is `content/curriculum.yaml` (tracks → modules → topics with `kind`, `complexity`, `minutes`, `prereqs`).
Each topic's content lives in `content/topics/<track>/<topic-id>.md` with these sections:

```
=== lesson
--- step concept: What it is
Markdown… then embed checks on their own line:
[[quiz:<topic-id>:q0]]   [[recall:<topic-id>:r0]]   [[exercise:<exercise-id>]]
--- step example: …
--- step practice: …          (kinds: concept, example, practice, check, challenge, scenario, interview)

=== detailed
Full reference notes. Callouts: > [!TIP] > [!WHY] > [!WARN] > [!MISTAKE] > [!INTERVIEW] > [!REAL] > [!PERF] > [!THINK]

=== crisp
Short revision notes.

=== memory
Mnemonics, triggers, commonly confused ideas.

=== data
flashcards: [{ q, a }]
quiz:       [{ q, options: [...], answer: <0-based index>, explain }]
recall:     [{ q, keyPoints: [...], answer }]
exercises:  see below
interview:  [{ q, type, level, keyPoints: [...], answer, followUps: [...] }]
```
A topic counts as **full** when it has a lesson and detailed notes; with only crisp notes it is **essential**.

### Exercises (`data.exercises`)
| Field | Notes |
|---|---|
| `id` | unique, e.g. `sql-joins-3` |
| `lang` | `sql`, `python`, `mcq` (with `choices` + `answer`) or `text` (with `solution` as model answer + `review` checklist) |
| `kind` | `coding`, `debug`, `scenario`, `predict`, `concept` |
| `difficulty` | 1–3 |
| `prompt`, `starter`, `solution`, `hints`, `explain` | Markdown / code |
| SQL only | `ordered: true` if row order matters; `setup` (SQL run first); `check` (query whose result is compared after DML); `repeat: 2` to test idempotency |
| Python only | `tests: [{ call, expect, hidden?, label? }]` (both are Python expressions), optional `check` (asserts), `stdout` |

Practice data: tables `customers, products, orders, order_items, employees, web_events, stg_customers, daily_sales`; files in `/data` (see `public/workers/seed.js`). The `pyspark` and `airflow` packages are emulators in `public/workers/shims/`.

**Always run `npm run validate`** before opening a pull request — it executes every reference solution against its tests.

### YAML tips
Quote strings containing `: ` or starting with `{ [ * & !`, or use block scalars (`|`). The build prints YAML errors with line numbers.

## Other content
`content/projects.yaml`, `content/interview/*.yaml`, `content/english.yaml`, `content/communication.yaml`, `content/skills.yaml` (keywords used for job-description analysis).

## Code
- `npm run typecheck` must pass. Keep the app **local-first**: no backend, no telemetry, no required accounts.
- Learning events go through `src/lib/record.ts` so competency, revision and analytics stay consistent.
- Keep the initial bundle small: lazy-load heavy features.

## Accuracy
Technical correctness matters more than volume. If you change a fact in notes, keep the detailed, crisp and memory sections consistent, and prefer concepts that stay true across tool versions.
