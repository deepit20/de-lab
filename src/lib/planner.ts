// Adaptive daily planner: distributes today's available minutes across reviews, new learning,
// verification of prior knowledge, weak areas, retries, projects and interview practice.
// Missed days never create an impossible backlog: reviews are capped and prioritised by forgetting risk.
import type { Card, PlanItem, TopicProgress } from '../db'
import type { Competency } from './competency'
import { topicById, topicsInOrder } from '../content'
import { uid } from './util'
import { cardRetrievability } from './fsrs'

export interface PlanCtx {
  minutes: number
  due: Card[]
  comps: Record<string, Competency>
  progress: Record<string, TopicProgress>
  failed: { exerciseId: string; topicId: string; title: string }[]
  activeProject?: { id: string; title: string }
  interviewsLast7: number
  carry: PlanItem[]
  reviewShare: number
}

export function nextTopic(progress: Record<string, TopicProgress>, comps: Record<string, Competency>): string | undefined {
  const inProg = Object.values(progress).filter((p) => p.status === 'in_progress' && topicById[p.topicId]).sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0))[0]
  if (inProg) return inProg.topicId
  const known = (id: string) => { const p = progress[id]; return p?.status === 'studied' || (p?.prior && p.prior !== 'none') || (comps[id]?.level ?? 0) >= 2 }
  for (const t of topicsInOrder) {
    if (known(t.id)) continue
    if (t.prereqs.every(known)) return t.id
  }
  return topicsInOrder.find((t) => !known(t.id))?.id
}

export function buildPlan(ctx: PlanCtx): { items: PlanItem[]; note: string } {
  const M = Math.max(10, ctx.minutes)
  const items: PlanItem[] = []
  let left = M
  const add = (i: Omit<PlanItem, 'id' | 'status'>) => {
    if (i.minutes >= 5 && left >= 5) {
      const m = Math.max(5, Math.round(Math.min(i.minutes, left) / 5) * 5)
      items.push({ ...i, minutes: m, id: uid(), status: 'todo' }); left -= m
    }
  }

  for (const c of ctx.carry.slice(0, 2)) add({ ...c, reason: 'Postponed earlier — carried over.' })

  // 1. Reviews: capped share, most-at-risk first
  const n = ctx.due.length
  let note = ''
  if (n) {
    const need = Math.ceil(n * 0.75)
    const cap = Math.max(5, Math.round(M * ctx.reviewShare))
    const mins = Math.min(need, cap)
    const atRisk = [...ctx.due].sort((a, b) => cardRetrievability(a) - cardRetrievability(b))
    const topics = [...new Set(atRisk.slice(0, 20).map((c) => c.topicId))].slice(0, 3).map((t) => topicById[t]?.title).filter(Boolean)
    add({ kind: 'review', ref: 'due', title: `Review ${Math.min(n, Math.round(mins / 0.75))} due card${n === 1 ? '' : 's'}`, minutes: mins, reason: `Spaced repetition — ${topics.join(', ') || 'mixed topics'} are close to being forgotten.` })
    if (need > cap) note = `${n - Math.round(cap / 0.75)} more reviews are waiting. They are spread over the next days (most at-risk first) — no need to clear them all today.`
  }

  // 2. Verify claimed prior knowledge (so existing knowledge is respected but checked)
  const claimed = topicsInOrder.filter((t) => ctx.comps[t.id]?.claimedOnly).slice(0, M >= 45 ? 2 : 1)
  // 3. Continue the roadmap
  const nt = nextTopic(ctx.progress, ctx.comps)
  const weak = topicsInOrder
    .map((t) => ctx.comps[t.id])
    .filter((c) => c && !c.claimedOnly && (c.forgotten || c.level === 2 || c.level === 3))
    .sort((a, b) => Number(b.forgotten) - Number(a.forgotten) || a.level - b.level)
  if (nt) {
    const t = topicById[nt]
    const st = ctx.progress[nt]?.status === 'in_progress'
    add({ kind: 'learn', ref: nt, title: `${st ? 'Continue' : 'Start'}: ${t.title}`, minutes: Math.max(15, Math.min(t.minutes, Math.round(M * (claimed.length ? 0.4 : 0.5)))), reason: st ? 'Pick up exactly where you paused.' : 'Next on your roadmap — its prerequisites are covered.' })
  }
  for (const t of claimed) add({ kind: 'verify', ref: t.id, title: `Verify: ${t.title}`, minutes: 8, reason: 'You marked this as already studied — a short check confirms it (or reveals gaps) without redoing the lesson.' })
  if (weak[0]) {
    const w = weak[0]
    add({ kind: 'practice', ref: w.topicId, title: `Strengthen: ${topicById[w.topicId].title}`, minutes: 15, reason: w.forgotten ? 'You knew this well before, but it is fading.' : `Level: ${w.label}. ${w.next}` })
  }
  if (ctx.failed[0] && left >= 10) add({ kind: 'retry', ref: ctx.failed[0].exerciseId, title: `Retry: ${ctx.failed[0].title}`, minutes: 10, reason: 'An exercise you have not solved yet — a fresh attempt often works.' })
  if (ctx.activeProject && left >= 20) add({ kind: 'project', ref: ctx.activeProject.id, title: `Project: ${ctx.activeProject.title}`, minutes: Math.min(45, left), reason: 'Projects turn separate skills into end-to-end ability.' })
  const ready = Object.values(ctx.comps).filter((c) => c.level >= 3).length
  if (ctx.interviewsLast7 === 0 && ready >= 3 && left >= 15) add({ kind: 'interview', ref: 'quick', title: 'Quick interview round (3 questions)', minutes: 15, reason: 'No interview practice this week — short rounds build fluency.' })
  if (left >= 10 && weak[1]) add({ kind: 'practice', ref: weak[1].topicId, title: `Strengthen: ${topicById[weak[1].topicId].title}`, minutes: Math.min(15, left), reason: `Level: ${weak[1].label}.` })
  if (left >= 10 && nt) { const learn = items.find((i) => i.kind === 'learn'); if (learn) { learn.minutes += left; left = 0 } }
  return { items, note }
}
