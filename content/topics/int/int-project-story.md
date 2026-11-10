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
