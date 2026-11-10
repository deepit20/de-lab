=== crisp
- **Scale up** (bigger machine) is simple but capped and expensive; **scale out** (more machines) is how BigQuery, Spark and Dataflow handle TBs.
- **Partitioning** splits data so each worker processes a piece in parallel ("divide and conquer").
- **Narrow** operations (filter, map, select) work within a partition → no data movement.
- **Wide** operations (GROUP BY, JOIN, DISTINCT, ORDER BY, window) need rows with the same key on the same worker → a **shuffle**: data is redistributed over the network. Shuffles dominate cost and time.
- **Data skew**: one key holds a huge share of rows → one worker (a **straggler**) runs far longer than the rest. Fixes: salting keys, broadcast the small side, pre-aggregate, handle hot keys separately, adaptive execution (AQE).
- **Broadcast join**: copy a small table to every worker → join without shuffling the big table.
- Fault tolerance: work is split into tasks that can be retried on another worker; lineage/checkpoints allow recomputation.
- Separation of **storage and compute** (BigQuery, GCS + Dataproc): scale each independently.

=== memory
- **"Narrow stays home, wide takes the bus (shuffle)."**
- **Skew = one checkout lane with 90% of the customers.**

=== data
flashcards:
  - q: "What is a shuffle?"
    a: "Redistributing data across workers by key so related rows end up together — required for joins, group-bys, distinct and sorts."
  - q: "Narrow vs wide transformation?"
    a: "Narrow: each output partition depends on one input partition (no shuffle). Wide: depends on many (shuffle)."
  - q: "What is data skew and one fix?"
    a: "Uneven key distribution overloading a few workers; fix with salting, broadcasting, or splitting hot keys."
  - q: "Why does broadcasting a small table speed up a join?"
    a: "The large table no longer needs to be shuffled — each worker joins locally against its copy."
quiz:
  - q: "Which operation triggers a shuffle?"
    options: ["filter(amount > 0)", "select(col_a)", "groupBy(customer_id).sum()", "withColumn(x * 2)"]
    answer: 2
exercises:
  - id: def-distributed-1
    lang: text
    kind: scenario
    difficulty: 3
    title: The one slow task
    prompt: |
      A join of `events` (5 TB) with `users` (2 GB) on `user_id` takes 3 hours; the job UI shows 199 tasks finishing in 2 minutes and 1 task running for 2.5 hours. Explain what is happening and give three possible fixes.
    solution: |
      **Data skew**: one `user_id` (e.g. NULL, a bot, or a test account) has a huge share of events, so the shuffle sends all of them to one task — a straggler.

      Fixes:
      1. **Broadcast join** the 2 GB `users` table (or a filtered/projected version) so `events` is not shuffled by user_id at all.
      2. **Handle the hot key** separately: filter out NULL/bot ids, or process them in a separate path.
      3. **Salting**: add a random salt 0..N to the hot key on the big side and replicate the small side N times, spreading the hot key across tasks.
      4. Enable **Adaptive Query Execution** skew-join handling (Spark 3) which splits skewed partitions automatically.
    review:
      - "Identifies data skew / straggler"
      - "Broadcast the small table"
      - "Handle hot keys (NULLs/bots) separately"
      - "Salting"
      - "AQE skew join"
interview:
  - q: "What is a shuffle in distributed processing and why is it expensive?"
    type: concept
    level: 2
    keyPoints:
      - "redistributes data by key across nodes"
      - "network and disk I/O"
      - "needed for joins, aggregations, sorts"
      - "can cause skew"
      - "minimise with filtering early and broadcast joins"
