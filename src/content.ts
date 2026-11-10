import curriculumJson from './generated/curriculum.json'
import type { BankQ, Curriculum, Exercise, ProjectDef, TopicContent, TopicMeta, Track, Flashcard, QuizQ, RecallQ } from './types'

export const curriculum = curriculumJson as unknown as Curriculum
export const tracks: Track[] = curriculum.tracks
export const topicsInOrder: TopicMeta[] = tracks.flatMap((t) => t.modules.flatMap((m) => m.topics))
export const topicById: Record<string, TopicMeta> = Object.fromEntries(topicsInOrder.map((t) => [t.id, t]))
export const trackById: Record<string, Track> = Object.fromEntries(tracks.map((t) => [t.id, t]))
export const topicIndex: Record<string, number> = Object.fromEntries(topicsInOrder.map((t, i) => [t.id, i]))
export const dependents: Record<string, string[]> = {}
for (const t of topicsInOrder) for (const p of t.prereqs) (dependents[p] ||= []).push(t.id)

const topicLoaders = import.meta.glob('./generated/topics/*.json', { import: 'default' })
const cache = new Map<string, Promise<TopicContent>>()
export function loadTopic(id: string): Promise<TopicContent> {
  if (!cache.has(id)) {
    const loader = topicLoaders[`./generated/topics/${id}.json`]
    cache.set(id, loader ? (loader() as Promise<TopicContent>) : Promise.reject(new Error('Unknown topic ' + id)))
  }
  return cache.get(id)!
}

let exP: Promise<Record<string, Exercise>> | null = null
export const loadExercises = () => (exP ||= import('./generated/exercises.json').then((m) => m.default as unknown as Record<string, Exercise>))
let bankP: Promise<BankQ[]> | null = null
export const loadBank = () => (bankP ||= import('./generated/bank.json').then((m) => m.default as unknown as BankQ[]))
let cardsP: Promise<Record<string, { flashcards: Flashcard[]; quiz: QuizQ[]; recall: RecallQ[] }>> | null = null
export const loadCards = () => (cardsP ||= import('./generated/cards.json').then((m) => m.default as any))
let projP: Promise<ProjectDef[]> | null = null
export const loadProjects = () => (projP ||= import('./generated/projects.json').then((m) => m.default as unknown as ProjectDef[]))
export const loadEnglish = () => import('./generated/english.json').then((m) => m.default as any)
export const loadCommunication = () => import('./generated/communication.json').then((m) => m.default as any)
export const loadSkills = () => import('./generated/skills.json').then((m) => m.default as any)
export const loadSearchDocs = () => import('./generated/search.json').then((m) => m.default as { id: string; type: string; title: string; track: string; text: string }[])

export const trackColor = (id: string) => trackById[id]?.color || '#64748b'
