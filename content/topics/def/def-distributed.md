=== lesson
--- step concept: Scale up or scale out
When data outgrows one machine you can:
- **Scale up** — a bigger machine (more CPU, RAM). Simple, but there's a ceiling and it gets expensive.
- **Scale out** — many ordinary machines working in parallel. No ceiling, but now you must split the work.

BigQuery, Spark and Dataflow all scale **out**.

--- step concept: Partitioning splits the work
Data is cut into **partitions** (chunks). Each worker processes its partitions independently:

```text
orders (1 TB) → 1000 partitions → 100 workers × 10 partitions each
```
Operations that work row by row — `filter`, `select`, adding a column — need nothing from other partitions. They're called **narrow** and run fully in parallel.

--- step concept: The shuffle
`GROUP BY customer_id`, `JOIN ON customer_id`, `ORDER BY`, `DISTINCT` need all rows with the same key **on the same worker**. Data is re-sent across the network by key — a **shuffle**. It's the slowest, most expensive step in most jobs.

[[quiz:def-distributed:q0]]

--- step concept: Skew — one worker does all the work
If one key has far more rows than the others (a "guest" user id, a NULL key, one giant customer), the worker holding it runs for hours while the rest sit idle. The job is only as fast as its **slowest task**.

[[quiz:def-distributed:q1]]

--- step scenario: The one slow task
[[exercise:def-distributed-1]]

--- step check: Make it cheaper
[[quiz:def-distributed:q2]]

--- step interview: Explain it
[[recall:def-distributed:r0]]

=== detailed
## Why distributed processing
A single laptop reads maybe 500 MB/s from disk. 5 TB takes nearly 3 hours just to read. Split across 1,000 workers, the same read takes seconds. Distributed engines (Spark, BigQuery, Dataflow) handle the splitting, scheduling and retries.

## Key ideas
| Idea | Meaning |
|---|---|
| partition | a chunk of data processed by one task |
| task | unit of work on one partition |
| stage | group of tasks that run without a shuffle |
| narrow transformation | each output partition depends on one input partition (filter, map) |
| wide transformation | needs data from many partitions → shuffle (groupBy, join, distinct, orderBy) |
| shuffle | redistributing data by key over the network |
| skew | uneven partition sizes → stragglers |

## Reducing shuffle cost
- **Filter and select early** so less data is shuffled.
- **Broadcast joins**: send the small table (a few hundred MB at most) to every worker; the big table doesn't move.
- **Pre-aggregate** before joining.
- **Partition/cluster** stored data on common join/filter keys.

## Handling skew
- Find it: one task much slower than the median; or `GROUP BY key ORDER BY COUNT(*) DESC`.
- Filter or separately process junk keys (NULL, `-1`, `guest`).
- **Salting**: add a random suffix to the hot key so its rows spread across workers, aggregate, then combine.
- Spark's **Adaptive Query Execution** can split skewed partitions automatically.

## Other realities
- **Failures are normal** at scale — engines retry tasks; your writes must be idempotent.
- **Data locality** — moving compute to data is cheaper than moving data.
- **Too many small partitions** → scheduling overhead; too few large ones → no parallelism and memory errors.

> [!REAL] In BigQuery you don't manage workers, but the same ideas show up in the query plan: "Repartition" stages are shuffles, and a stage where max time ≫ average time is skew.

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
  - q: "A job with 200 tasks: 199 finish in 2 minutes, one runs for 2 hours. The most likely cause is…"
    options: ["not enough workers", "the cluster is too big", "the file format", "data skew on the join or group key"]
    answer: 3
    explain: "One partition holds far more data than the others — usually a hot or NULL key."
  - q: "Which change usually reduces shuffle the most when joining 5 TB of events with a 50 MB lookup table?"
    options: ["sort both tables first", "use DISTINCT on events", "broadcast the small table", "add more partitions to the lookup table"]
    answer: 2
    explain: "Broadcasting copies the small table to every worker so the big table does not move."
recall:
  - q: "Explain partitioning, shuffles and skew in distributed processing and how you would fix a skewed join."
    keyPoints:
      - "scale out across many workers"
      - "narrow vs wide transformations"
      - "shuffle moves data by key over the network"
      - "skew: one hot key creates a straggler task"
      - "broadcast small tables, filter early"
      - "salting or AQE for skew"
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
