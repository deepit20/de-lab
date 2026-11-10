// All learning events flow through here so progress, competency, revision and analytics stay connected.
import { db, getProfile, type Card, type Mistake, type TopicProgress } from '../db'
import type { Dim, Exercise } from '../types'
import { newCard, ratingFromPerformance, review, type Rating } from './fsrs'
import { dayKeyOf } from './util'
import { loadCards } from '../content'

const exDim = (k: Exercise['kind']): Dim => (k === 'debug' ? 'debug' : k === 'scenario' ? 'apply' : k === 'predict' || k === 'concept' ? 'understand' : 'implement')
const exSource = (k: Exercise['kind']) => (k === 'debug' ? 'debug' : k === 'scenario' ? 'scenario' : k === 'predict' ? 'predict' : 'exercise')

export async function touchTopic(topicId: string, patch: Partial<TopicProgress> = {}) {
  const now = Date.now()
  const cur = (await db.progress.get(topicId)) || { topicId, status: 'not_started', step: 0, seconds: 0 } as TopicProgress
  const next: TopicProgress = { ...cur, ...patch, lastAt: now, firstAt: cur.firstAt || now }
  if (next.status === 'not_started') next.status = 'in_progress'
  await db.progress.put(next)
  return next
}

/** Topic-level SRS card: lets revision schedule a whole topic, fed by exercise/quiz performance. */
async function bumpTopicCard(topicId: string, rating: Rating) {
  const id = `topic:${topicId}`
  const p = await getProfile()
  const c = (await db.cards.get(id)) || newCard(id, topicId, 'topic')
  // Only reschedule if the card is due, or performance was poor (so weak spots come back sooner)
  if (c.reps > 0 && c.due > Date.now() && rating >= 3) return
  const r = review(c, rating, p.settings.retention)
  await db.cards.put(r.card)
}

/** Adds a topic's flashcards to revision. `spreadDays` staggers first reviews (used for prior knowledge so day one isn't a wall of cards). */
export async function ensureFlashcards(topicId: string, spreadDays = 0) {
  const all = await loadCards()
  const set = all[topicId]
  if (!set) return 0
  const existing = new Set((await db.cards.where('topicId').equals(topicId).toArray()).map((c) => c.id))
  const fresh: Card[] = []
  for (const f of set.flashcards) if (!existing.has(f.id)) fresh.push(newCard(f.id, topicId, 'flash', spreadDays ? { due: Date.now() + Math.floor(1 + Math.random() * spreadDays) * 86400000 } : {}))
  if (fresh.length) await db.cards.bulkPut(fresh)
  if (!existing.has(`topic:${topicId}`)) await db.cards.put({ ...newCard(`topic:${topicId}`, topicId, 'topic'), due: Date.now() + 86400000 })
  return fresh.length
}

export async function recordExercise(ex: Exercise, o: { code: string; passed: boolean; score: number; hints: number; ms: number; mode: 'learn' | 'practice' | 'timed' | 'interview' | 'revision'; feedback?: string[]; error?: string }) {
  const now = Date.now()
  const prev = await db.attempts.where('exerciseId').equals(ex.id).toArray()
  const attemptNo = prev.length + 1
  const alreadySolved = prev.some((a) => a.passed)
  await db.attempts.add({ exerciseId: ex.id, topicId: ex.topic, code: o.code, passed: o.passed, score: o.score, hints: o.hints, ms: o.ms, mode: o.mode, at: now, feedback: o.feedback, error: o.error })
  // Evidence: the first success on an item counts fully; re-solving a seen item is weaker evidence (memory of the answer).
  const failsBefore = prev.filter((a) => !a.passed).length
  const score = o.passed ? Math.max(0.5, o.score - Math.min(0.3, failsBefore * 0.08)) * (alreadySolved ? 0.85 : 1) : Math.min(0.25, o.score * 0.3)
  await db.evidence.add({ topicId: ex.topic, itemId: ex.id, dim: exDim(ex.kind), score, hints: o.hints, independent: o.hints === 0 && o.mode !== 'learn' ? true : o.hints === 0, source: o.mode === 'timed' ? 'timed' : exSource(ex.kind), at: now })
  if (o.passed || attemptNo >= 2) await bumpTopicCard(ex.topic, ratingFromPerformance({ correct: o.passed, hints: o.hints, attempts: failsBefore + 1, fast: o.ms < ex.minutes * 30000 }))
  await touchTopic(ex.topic)
  return { attemptNo, alreadySolved }
}

export async function recordQuiz(topicId: string, qid: string, correct: boolean, source: 'quiz' | 'verify' = 'quiz') {
  await db.evidence.add({ topicId, itemId: qid, dim: 'understand', score: correct ? 1 : 0, hints: 0, independent: true, source, at: Date.now() })
  if (!correct) {
    // missed quiz questions become review cards so they come back
    const id = `quizcard:${qid}`
    if (!(await db.cards.get(id))) await db.cards.put(newCard(id, topicId, 'quiz'))
  }
}

export async function recordRecall(topicId: string, itemId: string, score: number, dim: Dim = 'explain', source = 'recall') {
  await db.evidence.add({ topicId, itemId, dim, score, hints: 0, independent: true, source, at: Date.now() })
}

export async function recordReview(card: Card, rating: Rating, mode = 'scheduled') {
  const p = await getProfile()
  const r = review(card, rating, p.settings.retention)
  await db.cards.put(r.card)
  await db.reviews.add({ cardId: card.id, topicId: card.topicId, rating, at: Date.now(), elapsedDays: r.elapsedDays, r: r.r, mode })
  if (card.kind !== 'custom' && card.kind !== 'mistake') await db.evidence.add({ topicId: card.topicId, itemId: card.id, dim: 'understand', score: rating >= 3 ? 1 : rating === 2 ? 0.6 : 0, hints: 0, independent: true, source: 'flash', at: Date.now() })
  return r.card
}

export async function addMistake(m: Omit<Mistake, 'id' | 'at'>) {
  const id = await db.mistakes.add({ ...m, at: Date.now() })
  // every mistake becomes a review card: "what was wrong and why"
  await db.cards.put(newCard(`mistake:${id}`, m.topicId || 'general', 'mistake', { front: m.title, back: `**Wrong:** ${m.wrong}\n\n**Correct:** ${m.correct}\n\n**Lesson:** ${m.lesson}` }))
  return id
}

export async function logActivity(kind: string, seconds: number, topicId?: string, ref?: string) {
  if (seconds < 5) return
  const at = Date.now()
  await db.activity.add({ at, day: dayKeyOf(at), seconds: Math.round(seconds), kind, topicId, ref })
  if (topicId) { const p = await db.progress.get(topicId); if (p) await db.progress.put({ ...p, seconds: (p.seconds || 0) + Math.round(seconds) }) }
}
