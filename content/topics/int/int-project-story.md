=== lesson
--- step concept: Interviewers want a story with numbers
"Tell me about a project" is in almost every interview. A strong answer follows one structure:

**Context → Problem → Your actions → Result → What you'd improve**

- **Context:** the team, the data, the scale (sources, volumes, users).
- **Problem:** what was broken, slow, manual or missing.
- **Actions:** what **you** designed and built — use "I", not only "we".
- **Result:** a measurable outcome.
- **Improve:** one honest thing you'd do differently.

--- step concept: Prepare your numbers
Before the interview, write down for each project: data volume (rows/GB per day), number of sources/tables, run time before and after, latency/freshness, cost, number of users, incidents reduced. Approximate is fine — "about 2 million rows a day" beats "a lot of data".

[[quiz:int-project-story:q0]]

--- step concept: Defend your decisions
Expect "why?" questions: *Why BigQuery and not Postgres? Why daily, not streaming? Why MERGE?* Answer with the **trade-off**: what you chose, the alternative, and why it fit the requirements (cost, freshness, team skills).

[[quiz:int-project-story:q1]]

--- step concept: STAR for behavioural questions
For "tell me about a time you…": **Situation, Task, Action, Result**. Keep the situation short, spend most time on your actions, finish with the result and the lesson learned.

[[quiz:int-project-story:q2]]

--- step scenario: Write your project pitch
[[exercise:int-project-story-1]]

--- step interview: Practise out loud
[[recall:int-project-story:r0]]

=== detailed
## The project answer template
1. **One-line summary:** "I built a daily pipeline that brings order and payment data from three sources into BigQuery for the finance dashboard."
2. **Context and scale:** sources, volumes, frequency, consumers.
3. **Architecture:** ingestion → storage → transformation → serving; tools at each step.
4. **Your role:** what you personally designed, built, debugged.
5. **A key decision and its trade-off.**
6. **A challenge and how you solved it** (late data, duplicates, a slow query, a schema change).
7. **Result with numbers.**
8. **What you'd improve next.**

Aim for **2 minutes**; let the interviewer pull on details.

## Strong vs weak statements
| Weak | Strong |
|---|---|
| "We made the pipeline faster." | "I partitioned the fact table by date and switched to incremental MERGE, cutting run time from 90 to 12 minutes and query cost by ~70%." |
| "I worked on data quality." | "I added 25 dbt tests and a row-count check; incidents reported by users dropped from about 6 a month to 1." |
| "It was a big dataset." | "About 40 million events a day, ~15 GB compressed." |

## Using projects from DE Lab
If you don't have production experience yet, present a DE Lab project the same way: real design decisions, what broke and how you fixed it, what you'd change at 100× scale. Be honest that it is a personal project — depth of understanding matters more than where it ran.

## Behavioural questions (STAR)
Common ones: a pipeline failure you handled, a disagreement with a stakeholder, a time you had to learn a tool quickly, a mistake you made, prioritising under pressure.
- **Situation** (1–2 sentences), **Task** (your responsibility), **Action** (most detail), **Result** (numbers + lesson).
- Prepare 5–6 stories that can be adapted to many questions.

## Follow-ups to expect
- What would you do if the data grew 100×?
- How did you test it? How did you know it was correct?
- What happens if a run fails halfway?
- What was the hardest bug?
- What would you change today?

> [!TIP] Record yourself answering once — you'll hear filler words and missing numbers immediately.

=== crisp
**Project explanation (≈ 2–3 minutes), then let them dig in:**
1. **Context** — business problem and who used the result.
2. **Scale** — data sources, volumes, frequency, team.
3. **Architecture** — draw the flow: sources → ingestion → storage → transformation → serving.
4. **Your role** — what *you* designed/built (say "I", not only "we").
5. **Key decisions & trade-offs** — 2–3 with alternatives you rejected and why.
6. **Challenges** — one hard problem (bug, performance, data quality) and how you solved it.
7. **Results** — numbers: runtime ↓, cost ↓, freshness ↑, manual hours saved, users served.
8. **Improvements** — what you'd change now.

**STAR for behavioural questions:** **S**ituation → **T**ask → **A**ction (your actions, specific) → **R**esult (measurable) — plus **L**earning.

Prepare stories for: a project you're proud of · a failure/mistake · a disagreement · a tight deadline · learning something fast · improving a process.

> [!TIP] Use your background as a strength: analysts understand how data is *consumed*, developers how software is built and tested, students can point to well-documented projects. Frame stories around building reliable data for the people who use it (e.g. automating a manual report refresh into a scheduled, tested pipeline).

=== memory
- **"C-S-A-R-D-C-R-I"** … or simply: **Why → What → How → Hard part → Result → Next.**
- STAR**L** — don't forget the Learning.
- Numbers make stories believable.

=== data
flashcards:
  - q: "What does STAR stand for?"
    a: "Situation, Task, Action, Result (often + Learning)."
  - q: "What should a project explanation always include?"
    a: "Context, scale, architecture, your role, decisions & trade-offs, a challenge, measurable results, improvements."
  - q: "Why say 'I' rather than 'we' in interviews?"
    a: "Interviewers assess your personal contribution and decisions."
quiz:
  - q: "Which is the strongest result statement?"
    options: ["The pipeline was better", "We improved things a lot", "I cut the daily refresh from 3 hours to 20 minutes and removed 5 manual steps", "It worked"]
    answer: 2
  - q: "In a project answer, where should most of your time go?"
    options: ["the company history", "a list of every tool you know", "the problems caused by teammates", "your own actions and decisions, with trade-offs"]
    answer: 3
    explain: "Interviewers assess what you did and how you think; context should be brief."
  - q: "In STAR, the 'Result' should include…"
    options: ["only the tools used", "nothing — it is optional", "a measurable outcome and what you learned", "the situation again"]
    answer: 2
    explain: "Close with impact (ideally a number) and a lesson, showing reflection."
recall:
  - q: "Give your 2-minute explanation of one data project, including a key decision and a result with numbers."
    keyPoints:
      - "one-line summary"
      - "context and scale with numbers"
      - "architecture end to end"
      - "my role using I"
      - "a decision and its trade-off"
      - "result with numbers and what I'd improve"
exercises:
  - id: int-project-story-1
    lang: text
    kind: scenario
    difficulty: 2
    title: Write your project pitch
    prompt: |
      Write a 150–250 word explanation of a real project (from work or one built in DE Lab) following: context → scale → architecture → your role → one key decision with trade-off → one challenge → measurable result → improvement.
    solution: |
      *Example:* "Our sales team relied on a Power BI report refreshed manually from Excel exports every morning (context). Data came from the ERP (~200k orders/month) and a CRM API (scale). I built a pipeline where a Composer DAG extracts orders incrementally using an `updated_at` watermark and the CRM API with cursor pagination, lands raw files in GCS, loads them into BigQuery, and dbt models build a star schema with `fct_orders` and SCD2 `dim_customer` (architecture). I designed the models and wrote the DAG and tests (role). I chose ELT in BigQuery over Python transformations so analysts could maintain SQL models, accepting higher warehouse cost, controlled with partitioning (decision). The hardest issue was duplicate orders from late commits; I added a 1-hour lookback with MERGE on order_id and a uniqueness test (challenge). Refresh went from 2 hours of manual work to an automated 15-minute run with alerts (result). Next I'd add CDC via Datastream to remove the timestamp dependency (improvement)."
    review:
      - "Business context and users"
      - "Scale / volumes"
      - "Architecture flow"
      - "Personal role (I)"
      - "Decision with trade-off"
      - "Challenge and solution"
      - "Measurable result"
      - "Improvement"
interview:
  - q: "Walk me through a data project you are proud of."
    type: behavioral
    level: 2
    keyPoints:
      - "business context and users"
      - "architecture and tools"
      - "your specific contribution"
      - "key decisions and trade-offs"
      - "challenge and how you solved it"
      - "measurable impact"
      - "what you would improve"
  - q: "Tell me about a time a pipeline or report you owned produced wrong data. What did you do?"
    type: behavioral
    level: 2
    keyPoints:
      - "situation and impact"
      - "how it was detected"
      - "communication with stakeholders"
      - "root cause analysis"
      - "fix and prevention like tests or alerts"
      - "learning"
