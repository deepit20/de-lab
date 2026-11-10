// FSRS-4.5 spaced-repetition scheduler (Free Spaced Repetition Scheduler, default parameters).
// Ratings: 1 Again (forgot), 2 Hard (recalled with effort / hints), 3 Good, 4 Easy.
// The app derives ratings from real performance (hints used, attempts, correctness), not only self-grading.
import type { Card } from '../db'
import { DAY } from './util'

const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755]
const DECAY = -0.5
const FACTOR = 19 / 81
export type Rating = 1 | 2 | 3 | 4

export const retrievability = (elapsedDays: number, s: number) => Math.pow(1 + (FACTOR * elapsedDays) / Math.max(s, 0.01), DECAY)
const interval = (s: number, retention: number) => Math.max(1, Math.round((s / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1)))
const initD = (g: Rating) => clampD(W[4] - (g - 3) * W[5])
const clampD = (d: number) => Math.min(10, Math.max(1, d))
function nextD(d: number, g: Rating) { const nd = d - W[6] * (g - 3); return clampD(W[7] * initD(3) + (1 - W[7]) * nd) }
function recallS(d: number, s: number, r: number, g: Rating) {
  const hard = g === 2 ? W[15] : 1
  const easy = g === 4 ? W[16] : 1
  return s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp((1 - r) * W[10]) - 1) * hard * easy)
}
const forgetS = (d: number, s: number, r: number) => W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14])

export function newCard(id: string, topicId: string, kind: Card['kind'], extra: Partial<Card> = {}): Card {
  return { id, topicId, kind, s: 0, d: 0, due: Date.now(), reps: 0, lapses: 0, state: 0, createdAt: Date.now(), ...extra }
}

export function review(card: Card, g: Rating, retention = 0.9, now = Date.now()): { card: Card; r: number; elapsedDays: number } {
  const c = { ...card }
  const elapsedDays = c.last ? Math.max(0, (now - c.last) / DAY) : 0
  let r = 1
  if (c.state === 0 || c.reps === 0) {
    c.d = initD(g)
    c.s = W[g - 1]
  } else {
    r = retrievability(elapsedDays, c.s)
    c.d = nextD(c.d, g)
    c.s = g === 1 ? Math.min(c.s, forgetS(c.d, c.s, r)) : recallS(c.d, c.s, r, g)
  }
  if (g === 1) { c.lapses += c.state === 2 ? 1 : 0; c.state = c.reps === 0 ? 1 : 3 } else c.state = 2
  c.reps += 1
  c.last = now
  // Failed items come back the same day (10 min); hard ones a little sooner than FSRS suggests.
  const days = g === 1 ? 0 : interval(c.s, retention)
  c.due = g === 1 ? now + 10 * 60000 : now + days * DAY
  return { card: c, r, elapsedDays }
}

export const cardRetrievability = (c: Card, now = Date.now()) => (c.reps === 0 || !c.last ? 0 : retrievability((now - c.last) / DAY, c.s))

/** Map real performance on an exercise/quiz to an FSRS rating. */
export function ratingFromPerformance(p: { correct: boolean; hints: number; attempts: number; fast?: boolean }): Rating {
  if (!p.correct) return 1
  if (p.hints >= 2 || p.attempts >= 3) return 2
  if (p.hints === 1 || p.attempts === 2) return 2
  return p.fast ? 4 : 3
}
