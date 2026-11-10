// Demo mode: fills the app with ~6 weeks of realistic sample progress so visitors (and screenshots)
// see a living workspace immediately. Triggered by "Explore the demo" on the welcome screen or `?demo=1`.
import { db, getProfile, type Card, type Evidence, type Attempt, type Activity, type ReviewLog, type TopicProgress, type InterviewSession } from '../db'
import { loadExercises, topicsInOrder } from '../content'
import { newCard } from './fsrs'
import { DAY, dayKeyOf } from './util'
import type { Dim } from '../types'

function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }

export async function loadDemo() {
  const r = rng(7)
  const now = Date.now()
  const ex = await loadExercises()
  await Promise.all([db.progress.clear(), db.evidence.clear(), db.attempts.clear(), db.cards.clear(), db.reviews.clear(), db.activity.clear(), db.plans.clear(), db.interviews.clear(), db.notes.clear(), db.mistakes.clear(), db.projects.clear(), db.highlights.clear(), db.bookmarks.clear()])

  // Learner has worked through SQL, most of Python and started DE fundamentals; strength fades along the roadmap.
  const studied = topicsInOrder.filter((t) => ['sql', 'py', 'def', 'dw'].includes(t.track)).slice(0, 34)
  const progress: TopicProgress[] = [], evidence: Evidence[] = [], attempts: Attempt[] = [], cards: Card[] = [], reviews: ReviewLog[] = []
  studied.forEach((t, i) => {
    const strength = Math.max(0.25, 1 - i / 40) // earlier topics are stronger
    const start = now - (42 - Math.floor(i * 1.1)) * DAY
    const finished = i < studied.length - 3
    progress.push({ topicId: t.id, status: finished ? 'studied' : 'in_progress', step: finished ? 6 : 2, firstAt: start, lastAt: start + 2 * DAY, completedAt: finished ? start + DAY : undefined, seconds: Math.round((t.minutes + r() * 30) * 60) })
    // concept checks
    for (let q = 0; q < 3; q++) evidence.push({ topicId: t.id, itemId: `${t.id}:q${q}`, dim: 'understand', score: r() < strength + 0.15 ? 1 : 0, hints: 0, independent: true, source: 'quiz', at: start + q * 3600000 })
    evidence.push({ topicId: t.id, itemId: `${t.id}:r0`, dim: 'explain', score: Math.min(1, strength * (0.7 + r() * 0.4)), hints: 0, independent: true, source: 'recall', at: start + DAY })
    // exercises
    Object.values(ex).filter((e) => e.topic === t.id && (e.lang === 'sql' || e.lang === 'python')).forEach((e, k) => {
      const tries = r() < strength ? 1 : 2
      const hints = r() < strength ? 0 : 1
      for (let a = 0; a < tries; a++) {
        const passed = a === tries - 1 && r() < strength + 0.25
        const at = start + (k + 1) * 5400000 + a * 600000
        attempts.push({ exerciseId: e.id, topicId: t.id, code: e.solution, passed, score: passed ? 1 : 0.2, hints, ms: (4 + r() * 10) * 60000, mode: 'practice', at })
        const dim: Dim = e.kind === 'debug' ? 'debug' : e.kind === 'scenario' ? 'apply' : e.kind === 'predict' ? 'understand' : 'implement'
        evidence.push({ topicId: t.id, itemId: e.id, dim, score: passed ? 1 : 0.2, hints, independent: hints === 0, source: e.kind === 'debug' ? 'debug' : e.kind === 'scenario' ? 'scenario' : 'exercise', at })
        // practised again recently on another day → retention evidence for the stronger topics
        if (passed && strength > 0.55 && k <= 1) evidence.push({ topicId: t.id, itemId: e.id, dim, score: 1, hints: 0, independent: true, source: 'exercise', at: now - (1 + Math.floor(r() * 5)) * DAY })
      }
    })
    // recent revision keeps earlier topics fresh
    if (strength > 0.5) for (let f = 0; f < 3; f++) evidence.push({ topicId: t.id, itemId: `${t.id}:fc${f}`, dim: 'understand', score: 1, hints: 0, independent: true, source: 'flash', at: now - (1 + Math.floor(r() * 6)) * DAY })
    if (strength > 0.7) evidence.push({ topicId: t.id, itemId: `iv:${t.id}`, dim: 'interview', score: 0.75, hints: 0, independent: true, source: 'interview', at: now - (2 + Math.floor(r() * 8)) * DAY })
    // flashcards in rotation, some due today
    for (let f = 0; f < 4; f++) {
      const c = newCard(`${t.id}:fc${f}`, t.id, 'flash')
      c.reps = 2 + Math.floor(r() * 3); c.state = 2; c.s = 3 + r() * 20; c.d = 4 + r() * 3; c.last = now - Math.floor(r() * 9) * DAY
      c.due = r() < 0.18 ? now - Math.floor(r() * 2) * DAY : now + Math.ceil(r() * 14) * DAY
      cards.push(c)
      for (let k = 0; k < c.reps; k++) reviews.push({ cardId: c.id, topicId: t.id, rating: r() < 0.87 ? 3 : r() < 0.5 ? 2 : 1, at: start + (k * 4 + 2) * DAY, elapsedDays: 3, r: 0.9, mode: 'scheduled' })
    }
  })
  // ~6 weeks of activity with a realistic rhythm (some days off)
  const activity: Activity[] = []
  for (let d = 44; d >= 0; d--) {
    const dt = now - d * DAY
    const wd = new Date(dt).getDay()
    if (r() < (wd === 0 || wd === 6 ? 0.15 : 0.22)) continue
    const mins = (wd === 0 || wd === 6 ? 70 : 40) + r() * 50
    for (const [kind, share] of [['learn', 0.45], ['practice', 0.3], ['revision', 0.15], ['interview', 0.1]] as const) activity.push({ at: dt, day: dayKeyOf(dt), seconds: Math.round(mins * share * 60), kind })
  }
  const interviews: InterviewSession[] = [52, 61, 58, 70, 76].map((score, i) => ({
    kind: i % 2 ? 'timed' : 'mock', mode: 'realistic', title: i % 2 ? 'Timed coding · SQL, Python' : 'Mock interview · SQL, Python, DE Fundamentals', tracks: ['sql', 'py'], durationMin: 30,
    items: [{ q: 'Explain the difference between WHERE and HAVING.', answer: 'WHERE filters rows before grouping; HAVING filters groups after aggregation and can use aggregate functions…', sec: 140, score }],
    overall: score, breakdown: { correctness: score + 4, depth: score - 8, communication: score + 6 }, at: now - (30 - i * 7) * DAY, ai: false, status: 'done',
  }))

  await db.transaction('rw', [db.progress, db.evidence, db.attempts, db.cards, db.reviews, db.activity, db.interviews, db.notes, db.mistakes, db.projects], async () => {
    await db.progress.bulkPut(progress); await db.evidence.bulkAdd(evidence); await db.attempts.bulkAdd(attempts)
    await db.cards.bulkPut(cards); await db.reviews.bulkAdd(reviews); await db.activity.bulkAdd(activity); await db.interviews.bulkAdd(interviews)
    await db.notes.add({ topicId: 'sql-window-ranking', title: 'Dedup pattern I keep forgetting', kind: 'example', body: '```sql\nWITH ranked AS (\n  SELECT *, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY updated_at DESC, id DESC) AS rn\n  FROM stg_customers\n)\nSELECT * FROM ranked WHERE rn = 1;\n```\nAlways add a **tie-breaker** or reruns can pick a different row.', createdAt: now - 20 * DAY, updatedAt: now - 20 * DAY, history: [] })
    await db.mistakes.add({ topicId: 'sql-nulls', title: 'NOT IN returned no rows', category: 'assumption', what: 'Query for employees who manage nobody returned 0 rows.', wrong: 'NOT IN ignores NULLs in the subquery', correct: 'One NULL makes every NOT IN comparison UNKNOWN', lesson: 'Use NOT EXISTS for anti joins', at: now - 25 * DAY })
    await db.projects.put({ id: 'p-sql-analytics', status: 'active', milestones: { m0: true, m1: true, m2: true }, files: { 'kpis.sql': "-- grain: one row per month\nSELECT strftime('%Y-%m', order_date) AS month, COUNT(*) AS orders, ROUND(SUM(amount), 2) AS revenue\nFROM orders WHERE status <> 'cancelled'\nGROUP BY month ORDER BY month;" }, design: '## Metric definitions\n- **Revenue**: delivered + shipped orders, gross of returns', reflection: '', rubric: { correct: 4, definitions: 4, sql: 3 }, log: [{ at: now - 6 * DAY, text: 'Project started' }], startedAt: now - 6 * DAY, updatedAt: now - DAY })
  })
  const p = await getProfile()
  await db.profile.put({ ...p, name: 'Alex', background: 'analyst', goal: 'Land a Data Engineering role this year', onboarded: true, settings: { ...p.settings, weekMinutes: [120, 60, 60, 60, 60, 45, 120] } })
  try { localStorage.setItem('de-lab-demo', '1') } catch { /* ignore */ }
}

export const isDemo = () => { try { return localStorage.getItem('de-lab-demo') === '1' } catch { return false } }

/** Leave demo mode: wipe sample data and return to the welcome screen. */
export async function exitDemo() {
  try { localStorage.removeItem('de-lab-demo') } catch { /* ignore */ }
  await db.delete()
  location.href = location.pathname
}
