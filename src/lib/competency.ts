// Evidence-based competency model.
// Completion ≠ skill: a topic's level comes only from evidence (quizzes, independent exercises, debugging, scenarios,
// explanations, interviews, projects), weighted by hints used, independence, item diversity and recency.
import type { Evidence, TopicProgress } from '../db'
import type { Dim, TopicMeta } from '../types'
import { DAY } from './util'

export const LEVELS = ['Not started', 'Studied', 'Basic', 'Developing', 'Independent', 'Mastered'] as const
export const LEVEL_HINT = [
  'No study or evidence yet.',
  'You have read the material (or said you know it) but have not shown it yet.',
  'You can recognise and recall the key ideas.',
  'You can apply it with some support — keep practising without hints.',
  'You solved distinct problems on your own across the required skills.',
  'Independent, retained over time, and applied in scenarios or interviews.',
]
export interface Competency {
  topicId: string; level: number; peakLevel: number; label: string
  dims: Record<Dim, number>; peak: Record<Dim, number>; required: Dim[]; threshold: number
  evidence: number; items: number; independentWins: number; lastAt?: number; forgotten: boolean
  prior?: string; claimedOnly: boolean; next: string; why: string[]
}
export type Availability = Record<string, Partial<Record<Dim, number>>> // topic -> dim -> number of practice items available

const SOURCE_W: Record<string, number> = { quiz: 0.22, flash: 0.1, recall: 0.3, exercise: 0.4, debug: 0.45, scenario: 0.45, predict: 0.28, explain: 0.4, interview: 0.4, project: 0.55, verify: 0.3, timed: 0.45 }
const zero = (): Record<Dim, number> => ({ understand: 0, explain: 0, implement: 0, debug: 0, apply: 0, interview: 0 })

export function requiredDims(t: TopicMeta, avail?: Partial<Record<Dim, number>>): Dim[] {
  const has = (d: Dim) => (avail?.[d] || 0) > 0
  if (t.kind === 'code') {
    const r: Dim[] = ['understand', 'implement']
    if (t.complexity >= 2 && has('debug')) r.push('debug')
    if (t.complexity >= 3 && has('apply')) r.push('apply')
    return r
  }
  const r: Dim[] = ['understand', 'explain']
  if (has('apply') || t.kind === 'design') r.push('apply')
  return r
}

export function computeCompetency(t: TopicMeta, ev: Evidence[], prog: TopicProgress | undefined, avail?: Partial<Record<Dim, number>>, now = Date.now()): Competency {
  const threshold = t.complexity === 1 ? 0.55 : t.complexity === 2 ? 0.62 : 0.7
  const required = requiredDims(t, avail)
  const peak = zero(), cur = zero()
  const byDim: Record<string, Evidence[]> = {}
  for (const e of ev) (byDim[e.dim] ||= []).push(e)
  let independentWins = 0
  const itemSet = new Set<string>()
  const successDays = new Set<string>()
  for (const [dim, list] of Object.entries(byDim)) {
    const items: Record<string, Evidence[]> = {}
    for (const e of list) (items[e.itemId] ||= []).push(e)
    const days = new Set(list.filter((e) => e.score >= 0.6).map((e) => Math.floor(e.at / DAY)))
    const halfLife = 12 * Math.pow(2, Math.min(days.size, 5) - 1) // more spaced successes → slower forgetting
    let missPeak = 1, missCur = 1
    for (const [itemId, evs] of Object.entries(items)) {
      itemSet.add(itemId)
      let best = 0, bestAt = 0
      for (const e of evs) {
        const eff = e.score * Math.max(0.35, 1 - 0.2 * e.hints) * (e.independent ? 1 : 0.75)
        if (eff >= best) { best = eff; bestAt = e.at }
        if (e.independent && e.hints === 0 && e.score >= 0.8 && dim !== 'understand') independentWins++
        if (e.score >= 0.6) successDays.add(String(Math.floor(e.at / DAY)))
      }
      const w = Math.max(...evs.map((e) => SOURCE_W[e.source] ?? 0.3))
      const age = (now - bestAt) / DAY
      const keep = 0.45 + 0.55 * Math.pow(0.5, age / halfLife)
      missPeak *= 1 - w * best
      missCur *= 1 - w * best * keep
    }
    peak[dim as Dim] = 1 - missPeak
    cur[dim as Dim] = 1 - missCur
  }
  // explanation skill also shows up in interview answers
  for (const d of [peak, cur]) d.explain = Math.max(d.explain, d.interview * 0.8)

  const levelOf = (d: Record<Dim, number>, recencyOk: boolean) => {
    const anyEvidence = ev.length > 0
    if (!anyEvidence) return prog && (prog.status !== 'not_started' || (prog.prior && prog.prior !== 'none')) ? 1 : 0
    const practical = Math.max(d.implement, d.debug, d.apply, d.explain)
    let lvl = 1
    if (d.understand >= 0.35) lvl = 2
    if (d.understand >= 0.5 && practical >= 0.3) lvl = 3
    if (lvl >= 3 && required.every((r) => d[r] >= threshold) && independentWins >= 1) lvl = 4
    if (lvl === 4 && recencyOk && (d.interview >= 0.35 || d.apply >= 0.55 || t.kind === 'code' && d.debug >= 0.5)) lvl = 5
    return lvl
  }
  const dayList = [...successDays].map(Number).sort((a, b) => a - b)
  const spanned = dayList.length >= 2 && dayList[dayList.length - 1] - dayList[0] >= 5
  const peakLevel = levelOf(peak, spanned)
  const level = levelOf(cur, spanned)
  const lastAt = ev.length ? Math.max(...ev.map((e) => e.at)) : prog?.lastAt
  const claimedOnly = !ev.length && !!prog?.prior && prog.prior !== 'none'

  const why: string[] = []
  const missing = required.filter((r) => cur[r] < threshold)
  if (claimedOnly) why.push(`Marked as previously studied (${prog?.prior}) — not yet verified.`)
  if (ev.length) why.push(`${itemSet.size} distinct item(s), ${ev.length} piece(s) of evidence.`)
  if (independentWins === 0 && ev.length) why.push('No hint-free independent success on a practical task yet.')
  if (missing.length && ev.length) why.push('Below target: ' + missing.join(', ') + '.')
  if (peakLevel > level) why.push('Some skills have faded since you last practised — a quick review will restore them.')
  if (level >= 4 && !spanned) why.push('Prove retention: succeed again on a different day (≥5 days later).')

  let next = 'Start the lesson.'
  if (claimedOnly) next = 'Take the quick verification check.'
  else if (level === 1) next = 'Answer the concept checks and flashcards.'
  else if (level === 2) next = t.kind === 'code' ? 'Solve a coding exercise without hints.' : 'Explain the concept in your own words, then try a scenario.'
  else if (level === 3) next = missing.length ? `Strengthen: ${missing.join(', ')} — try without hints.` : 'Solve one more problem without any hints.'
  else if (level === 4) next = spanned ? 'Apply it in a scenario or mock interview to reach mastery.' : 'Come back in a few days and solve a new problem to prove retention.'
  else if (level === 5) next = 'Maintained by scheduled revision.'
  if (peakLevel > level) next = 'Refresh with a quick revision session.'

  return { topicId: t.id, level, peakLevel, label: claimedOnly ? 'Claimed' : LEVELS[level], dims: cur, peak, required, threshold, evidence: ev.length, items: itemSet.size, independentWins, lastAt, forgotten: peakLevel >= 3 && level < peakLevel, prior: prog?.prior, claimedOnly, next, why }
}

export function computeAll(topics: TopicMeta[], evidence: Evidence[], progress: TopicProgress[], avail: Availability) {
  const evBy: Record<string, Evidence[]> = {}
  for (const e of evidence) (evBy[e.topicId] ||= []).push(e)
  const pBy = Object.fromEntries(progress.map((p) => [p.topicId, p]))
  const out: Record<string, Competency> = {}
  for (const t of topics) out[t.id] = computeCompetency(t, evBy[t.id] || [], pBy[t.id], avail[t.id])
  return out
}

export const levelColor = (l: number) => ['var(--lv0)', 'var(--lv1)', 'var(--lv2)', 'var(--lv3)', 'var(--lv4)', 'var(--lv5)'][l] || 'var(--lv0)'
