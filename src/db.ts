import Dexie, { type Table } from 'dexie'
import type { Dim } from './types'

export interface Settings {
  theme: 'system' | 'light' | 'dark'
  dailyMinutes: number
  weekMinutes: number[] // Sun..Sat typical availability
  retention: number // FSRS desired retention
  reviewShare: number // max share of a session spent on reviews
  aiKey?: string
  aiModel?: string
  lastBackupAt?: number
  autoBackup?: boolean
}
export type Background = 'new' | 'student' | 'analyst' | 'developer' | 'engineer' | 'other'
export const BACKGROUNDS: { id: Background; label: string; describe: string }[] = [
  { id: 'new', label: 'New to data', describe: 'is new to data work and is learning data engineering from the beginning' },
  { id: 'student', label: 'Student / graduate', describe: 'is a student or recent graduate with some programming coursework, preparing for a first Data Engineering role' },
  { id: 'analyst', label: 'Data / BI analyst', describe: 'works in data and analytics (comfortable with SQL and BI tools) and is moving into Data Engineering' },
  { id: 'developer', label: 'Software developer', describe: 'is a software developer (comfortable with programming) moving into Data Engineering' },
  { id: 'engineer', label: 'Already a data engineer', describe: 'already works as a data engineer and wants to deepen skills and prepare for interviews' },
  { id: 'other', label: 'Something else', describe: 'is preparing for a Data Engineering role' },
]
export interface Profile { id: 'me'; name: string; onboarded: boolean; createdAt: number; goal: string; background?: Background; about?: string; settings: Settings }
export interface TopicProgress {
  topicId: string; status: 'not_started' | 'in_progress' | 'studied'; step: number
  prior?: 'none' | 'some' | 'confident'; firstAt?: number; lastAt?: number; completedAt?: number; seconds: number
  stepsDone?: number[]
}
export interface Evidence { id?: number; topicId: string; itemId: string; dim: Dim; score: number; hints: number; independent: boolean; source: string; at: number; note?: string }
export interface Attempt {
  id?: number; exerciseId: string; topicId: string; code: string; passed: boolean; score: number; hints: number
  ms: number; mode: 'learn' | 'practice' | 'timed' | 'interview' | 'revision'; at: number; feedback?: string[]; error?: string
}
export interface Card {
  id: string; topicId: string; kind: 'flash' | 'topic' | 'mistake' | 'custom' | 'quiz'
  front?: string; back?: string
  s: number; d: number; due: number; last?: number; reps: number; lapses: number; state: 0 | 1 | 2 | 3
  suspended?: boolean; createdAt: number
}
export interface ReviewLog { id?: number; cardId: string; topicId: string; rating: 1 | 2 | 3 | 4; at: number; elapsedDays: number; r: number; mode: string }
export interface PersonalNote {
  id?: number; topicId?: string; title: string; body: string; kind: 'note' | 'example' | 'doubt' | 'question' | 'copy' | 'explanation'
  pinned?: boolean; resolved?: boolean; createdAt: number; updatedAt: number; history: { at: number; body: string }[]
}
export interface Highlight { id?: number; topicId: string; view: string; text: string; color: string; comment?: string; at: number }
export interface Bookmark { id?: number; kind: 'topic' | 'section' | 'exercise' | 'question' | 'note' | 'project'; ref: string; label: string; topicId?: string; at: number }
export interface Mistake {
  id?: number; topicId?: string; exerciseId?: string; category: 'concept' | 'syntax' | 'logic' | 'assumption' | 'debugging' | 'performance' | 'interview'
  title: string; what: string; wrong: string; correct: string; lesson: string; at: number; resolved?: boolean; code?: string
}
export interface PlanItem { id: string; kind: 'review' | 'learn' | 'practice' | 'verify' | 'retry' | 'project' | 'interview' | 'explain' | 'custom'; ref: string; title: string; minutes: number; reason: string; status: 'todo' | 'done' | 'skipped' | 'postponed' }
export interface DayPlan { date: string; minutes: number; items: PlanItem[]; createdAt: number; note?: string }
export interface Activity { id?: number; at: number; day: string; seconds: number; kind: string; ref?: string; topicId?: string }
export interface ProjectWork {
  id: string; status: 'active' | 'paused' | 'done'; milestones: Record<string, boolean>; files: Record<string, string>
  design: string; reflection: string; rubric: Record<string, number>; log: { at: number; text: string }[]; startedAt: number; updatedAt: number
}
export interface InterviewItem { qid?: string; q: string; answer: string; sec: number; score?: number; scores?: Record<string, number>; feedback?: string; followups?: { q: string; answer: string }[]; keyHit?: string[]; selfScore?: number }
export interface InterviewSession {
  id?: number; kind: 'quick' | 'mock' | 'scenario' | 'defence' | 'timed' | 'jd'; mode: 'guided' | 'realistic'; title: string; tracks: string[]
  durationMin: number; items: InterviewItem[]; overall?: number; breakdown?: Record<string, number>; summary?: string; at: number; ai: boolean; status: 'active' | 'done'
}
export interface JDAnalysis { id?: number; title: string; text: string; result: any; at: number; ai: boolean }
export interface CommAttempt { id?: number; promptId: string; area: 'explain' | 'english' | 'answer'; text: string; metrics: any; feedback?: string; topicId?: string; at: number }
export interface KV { key: string; value: any }

class DELabDB extends Dexie {
  profile!: Table<Profile, string>
  progress!: Table<TopicProgress, string>
  evidence!: Table<Evidence, number>
  attempts!: Table<Attempt, number>
  cards!: Table<Card, string>
  reviews!: Table<ReviewLog, number>
  notes!: Table<PersonalNote, number>
  highlights!: Table<Highlight, number>
  bookmarks!: Table<Bookmark, number>
  mistakes!: Table<Mistake, number>
  plans!: Table<DayPlan, string>
  activity!: Table<Activity, number>
  projects!: Table<ProjectWork, string>
  interviews!: Table<InterviewSession, number>
  jds!: Table<JDAnalysis, number>
  comm!: Table<CommAttempt, number>
  kv!: Table<KV, string>
  constructor() {
    super('de-lab')
    this.version(1).stores({
      profile: 'id',
      progress: 'topicId, status, lastAt',
      evidence: '++id, topicId, itemId, dim, at, source',
      attempts: '++id, exerciseId, topicId, at, passed, mode',
      cards: 'id, topicId, kind, due, state',
      reviews: '++id, cardId, topicId, at',
      notes: '++id, topicId, kind, updatedAt, pinned',
      highlights: '++id, topicId, at',
      bookmarks: '++id, kind, ref, topicId, at',
      mistakes: '++id, topicId, exerciseId, category, at, resolved',
      plans: 'date',
      activity: '++id, at, day, kind, topicId',
      projects: 'id, status, updatedAt',
      interviews: '++id, kind, at, status',
      jds: '++id, at',
      comm: '++id, promptId, area, at, topicId',
      kv: 'key',
    })
  }
}
export const db = new DELabDB()

export const DEFAULT_SETTINGS: Settings = { theme: 'system', dailyMinutes: 60, weekMinutes: [120, 60, 60, 60, 60, 45, 120], retention: 0.9, reviewShare: 0.35 }

export const normalizeProfile = (p: Profile | undefined): Profile | undefined => (p ? { ...p, settings: { ...DEFAULT_SETTINGS, ...p.settings } } : undefined)
/** Creates the profile on first use. Not for use inside liveQuery (it may write). */
export async function getProfile(): Promise<Profile> {
  let p = await db.profile.get('me')
  if (!p) {
    p = { id: 'me', name: '', onboarded: false, createdAt: Date.now(), goal: 'Become a confident Data Engineer', settings: DEFAULT_SETTINGS }
    await db.profile.put(p)
  }
  return { ...p, settings: { ...DEFAULT_SETTINGS, ...p.settings } }
}
export async function updateSettings(patch: Partial<Settings>) {
  const p = await getProfile()
  await db.profile.put({ ...p, settings: { ...p.settings, ...patch } })
}
export async function kvGet<T>(key: string, fallback: T): Promise<T> { const r = await db.kv.get(key); return r ? (r.value as T) : fallback }
export const kvSet = (key: string, value: any) => db.kv.put({ key, value })
