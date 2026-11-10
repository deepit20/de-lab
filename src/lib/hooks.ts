import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, normalizeProfile, type Profile } from '../db'
import { loadExercises, topicsInOrder } from '../content'
import { computeAll, type Availability } from './competency'
import type { Dim, Exercise } from '../types'
import { logActivity } from './record'

// ---------- hash router ----------
export function useRoute() {
  const [hash, setHash] = useState(() => location.hash.slice(1) || '/')
  useEffect(() => {
    const on = () => { setHash(location.hash.slice(1) || '/'); }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const [path, query] = hash.split('?')
  const parts = path.split('/').filter(Boolean)
  return { path, parts, query: new URLSearchParams(query || '') }
}
export const go = (to: string) => { location.hash = to }

// ---------- profile ----------
export function useProfile(): Profile | undefined {
  return useLiveQuery(() => db.profile.get('me').then(normalizeProfile), [])
}

// ---------- availability of practice per topic/dimension ----------
let availCache: Availability | null = null
export function useExercises() {
  const [ex, setEx] = useState<Record<string, Exercise> | null>(null)
  useEffect(() => { loadExercises().then(setEx) }, [])
  return ex
}
export function useAvailability(): Availability {
  const ex = useExercises()
  return useMemo(() => {
    if (availCache && ex) return availCache
    const a: Availability = {}
    for (const t of topicsInOrder) a[t.id] = { understand: t.n.quiz + t.n.fc, explain: 1, interview: 1 }
    if (ex) {
      for (const e of Object.values(ex)) {
        const d: Dim = e.kind === 'debug' ? 'debug' : e.kind === 'scenario' ? 'apply' : e.kind === 'predict' || e.kind === 'concept' ? 'understand' : 'implement'
        const m = (a[e.topic] ||= {})
        m[d] = (m[d] || 0) + 1
      }
      availCache = a
    }
    return a
  }, [ex])
}

// ---------- learner state: competencies for every topic ----------
export function useLearner() {
  const evidence = useLiveQuery(() => db.evidence.toArray(), [])
  const progress = useLiveQuery(() => db.progress.toArray(), [])
  const avail = useAvailability()
  const comps = useMemo(() => (evidence && progress ? computeAll(topicsInOrder, evidence, progress, avail) : null), [evidence, progress, avail])
  const progressMap = useMemo(() => Object.fromEntries((progress || []).map((p) => [p.topicId, p])), [progress])
  return { comps, progress: progressMap, evidence, ready: !!comps }
}

// ---------- study clock: counts only active, visible time ----------
export function useStudyClock(kind: string, topicId?: string, ref?: string) {
  const last = useRef(Date.now())
  const acc = useRef(0)
  const active = useRef(Date.now())
  useEffect(() => {
    const bump = () => { active.current = Date.now() }
    const tick = () => {
      const now = Date.now()
      if (document.visibilityState === 'visible' && now - active.current < 120000) acc.current += (now - last.current) / 1000
      last.current = now
      if (acc.current >= 30) { logActivity(kind, acc.current, topicId, ref); acc.current = 0 }
    }
    const iv = window.setInterval(tick, 5000)
    window.addEventListener('keydown', bump); window.addEventListener('pointerdown', bump); window.addEventListener('wheel', bump)
    return () => {
      tick(); if (acc.current >= 5) logActivity(kind, acc.current, topicId, ref)
      window.clearInterval(iv)
      window.removeEventListener('keydown', bump); window.removeEventListener('pointerdown', bump); window.removeEventListener('wheel', bump)
    }
  }, [kind, topicId, ref])
}

export function useLocalState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : initial } catch { return initial } })
  return [v, (nv: T) => { setV(nv); try { localStorage.setItem(key, JSON.stringify(nv)) } catch { /* ignore */ } }]
}
