=== lesson
--- step concept: What DE interviews test
A typical Data Engineering loop:
| Round | What they assess | How to prepare here |
|---|---|---|
| Recruiter / HR screen | motivation, communication, basics | your story, "why DE" |
| **SQL** (live coding) | joins, aggregation, windows, edge cases | SQL track + timed coding rounds |
| **Python** (coding) | data manipulation, clean code, complexity | Python track + timed rounds |
| **DE concepts** | warehousing, pipelines, Spark/Airflow, BigQuery | question bank, mock interviews |
| **System / pipeline design** | architecture, trade-offs, scale, reliability | system design topic + scenario rounds |
| **Project deep-dive** | ownership, decisions, depth | project defence |
| **Behavioural** | collaboration, conflict, failures | STAR stories |

> [!INTERVIEW] Interviewers score **reasoning and communication** as much as the final answer. A correct query delivered silently scores lower than a well-explained, nearly-correct one.

[[quiz:int-strategy:q0]]

--- step concept: How to answer a coding question
1. **Clarify** — restate the problem; ask about grain, duplicates, NULLs, ties, time zones, expected output.
2. **Example** — sketch a tiny input and expected output.
3. **Plan out loud** — "I'll aggregate per customer first, then rank…"
4. **Write** clean code in steps (CTEs, small functions).
5. **Test** — walk through your example and edge cases.
6. **Optimise / discuss** — complexity, indexes, partitions, scale.

--- step concept: How to answer a concept question
Use **Define → Why → How → Example → Trade-off**:
> "*A slowly changing dimension is… We need it because… Type 2 works by… For example, in my sales model… The trade-off is table growth and more complex joins.*"

[[recall:int-strategy:r0]]

--- step practice: Try it
[[exercise:int-strategy-1]]

=== detailed
## Before the interview
- Read the job description: map required skills to your competency levels (Interview → JD prep).
- Prepare **3–4 stories** (project, failure, conflict, learning) in STAR form with numbers.
- Revise crisp notes of the core topics; do 2–3 timed SQL rounds.
- Prepare questions for them (team's stack, data volume, on-call, how quality is measured).

## During coding rounds
- Think aloud; it lets the interviewer give hints and credit reasoning.
- Start with a correct simple solution, then improve.
- Name things well; use CTEs; avoid clever one-liners.
- If stuck: go back to a small example; state what you know; ask a targeted question.
- Always mention edge cases: empty input, NULLs, duplicates, ties.

## During design rounds
Requirements → scale estimates → high-level architecture → data model → deep dive on 1–2 components → reliability/quality/monitoring → trade-offs and alternatives. (See the pipeline system design topic.)

## Communicating seniority
Junior-to-mid DE candidates stand out by: discussing **idempotency, data quality, monitoring and cost** unprompted; admitting what they don't know and reasoning towards it; connecting answers to real experience (whatever your background — analytics, software, studies — show how it helps you understand data and its consumers).

## After
Write down questions you struggled with → add them as personal notes / mistakes → they become revision cards.

=== crisp
- Rounds: screen · SQL · Python · DE concepts · system/pipeline design · project deep-dive · behavioural.
- Coding: **Clarify → Example → Plan aloud → Write in steps → Test edge cases → Optimise.**
- Concepts: **Define → Why → How → Example → Trade-off.**
- Behavioural: **STAR** with numbers.
- Think aloud; correct-simple first; mention NULLs/duplicates/ties; talk about idempotency, quality, monitoring, cost.
- After each interview: log what you missed → revision.

=== memory
- **C-E-P-W-T-O** for coding: Clarify, Example, Plan, Write, Test, Optimise.
- **D-W-H-E-T** for concepts: Define, Why, How, Example, Trade-off.
- **"Silence scores zero; reasoning scores points."**

=== data
flashcards:
  - q: "Six steps for answering a live coding question?"
    a: "Clarify, work an example, plan aloud, write in steps, test with edge cases, optimise/discuss."
  - q: "Structure for a concept answer?"
    a: "Define → why it exists → how it works → example → trade-off."
  - q: "What topics signal engineering maturity in a DE interview?"
    a: "Idempotency, data quality, monitoring/alerting, cost, failure recovery, trade-offs."
quiz:
  - q: "The interviewer asks for 'top customers per month'. Your first move?"
    options: ["Start typing SQL immediately", "Clarify: top by revenue or orders? how many? ties? cancelled orders?", "Ask for the answer", "Explain window functions in theory"]
    answer: 1
recall:
  - q: "Describe how you approach a live SQL coding question in an interview."
    keyPoints:
      - "clarify requirements and edge cases"
      - "work through a small example"
      - "plan the approach out loud"
      - "write step by step with CTEs"
      - "test with edge cases"
      - "discuss performance"
exercises:
  - id: int-strategy-1
    lang: text
    kind: scenario
    difficulty: 1
    title: Answer with D-W-H-E-T
    prompt: |
      Answer as you would in an interview, using **Define → Why → How → Example → Trade-off**: *"What is partitioning in BigQuery?"*
    solution: |
      **Define:** Partitioning splits a table into segments based on a column — usually a date — or ingestion time or an integer range.
      **Why:** Queries that filter on that column only read the relevant partitions, which cuts both runtime and cost, since BigQuery bills for bytes scanned.
      **How:** You declare `PARTITION BY DATE(event_ts)`; BigQuery stores each day separately; a `WHERE` on `event_ts` prunes the others. You can also expire old partitions and overwrite single partitions for idempotent reloads.
      **Example:** In a 4 TB clickstream table, a dashboard filtering the last 7 days reads ~7 partitions instead of the full table.
      **Trade-off:** Only one partition column; too-small partitions add overhead (cluster instead); and filters must use the column directly, otherwise pruning doesn't happen.
    review:
      - "Clear definition"
      - "Why: cost/performance"
      - "How it works / syntax"
      - "Concrete example"
      - "A trade-off or limitation"
interview:
  - q: "Tell me about yourself."
    type: behavioral
    level: 1
    keyPoints:
      - "current role or studies and relevant experience"
      - "current technical skills and growing DE skills"
      - "one concrete achievement with impact"
      - "why data engineering now"
      - "what you are looking for"
    followUps:
      - "Why are you leaving analytics?"
