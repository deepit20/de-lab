export type Dim = 'understand' | 'explain' | 'implement' | 'debug' | 'apply' | 'interview'
export const DIMS: Dim[] = ['understand', 'explain', 'implement', 'debug', 'apply', 'interview']
export const DIM_LABEL: Record<Dim, string> = {
  understand: 'Understanding', explain: 'Explaining', implement: 'Independent coding', debug: 'Debugging', apply: 'Applying', interview: 'Interview',
}

export interface TopicMeta {
  id: string; title: string; track: string; module: string
  kind: 'code' | 'concept' | 'design'; complexity: 1 | 2 | 3; minutes: number
  prereqs: string[]; outline: string[]; tags: string[]
  authored: 'full' | 'essential' | 'outline'
  n: { ex: number; fc: number; quiz: number; steps: number }
}
export interface ModuleMeta { id: string; title: string; summary: string; topics: TopicMeta[]; projects: string[] }
export interface Track { id: string; title: string; short: string; color: string; icon: string; description: string; why: string; order: number; modules: ModuleMeta[] }
export interface Curriculum { tracks: Track[]; version: number }

export type LessonBlock = { t: 'html'; html: string } | { t: 'exercise' | 'quiz' | 'recall'; id: string }
export interface LessonStep { kind: string; title: string; blocks: LessonBlock[] }
export interface Flashcard { id: string; q: string; a: string }
export interface QuizQ { id: string; q: string; options: string[]; answer: number; explain: string }
export interface RecallQ { id: string; q: string; answer: string; keyPoints: string[] }
export interface TopicContent {
  id: string; lesson: LessonStep[]; detailed: string; crisp: string; memory: string
  toc: { id: string; text: string; depth: number }[]
  flashcards: Flashcard[]; quiz: QuizQ[]; recall: RecallQ[]; exercises: string[]; interview: string[]
  outlineHtml?: string
}
export interface PyTest { call: string; expect: string; hidden?: boolean; label?: string }
export interface Exercise {
  id: string; topic: string; track: string; lang: 'sql' | 'python' | 'mcq' | 'text'
  kind: 'concept' | 'coding' | 'debug' | 'scenario' | 'predict' | 'assignment'
  difficulty: 1 | 2 | 3; title: string; prompt: string; starter: string; solution: string
  setup: string; check: string; ordered: boolean; repeat?: number; tests: PyTest[]; stdout: string | null
  hints: string[]; explain: string; review: string[]; minutes: number; interview: boolean
  choices: string[] | null; answer: number | string | null
}
export interface BankQ { id: string; track: string; topic: string | null; level: number; type: string; q: string; keyPoints: string[]; answer: string; followUps: string[]; context?: string }
export interface ProjectDef {
  id: string; title: string; level: 'guided' | 'independent' | 'production'; tracks: string[]; hours: number
  summary: string; brief: string; skills: string[]; topics: string[]
  milestones: { id: string; title: string; detail: string; hints: string[] }[]
  deliverables: string[]; rubric: { id: string; label: string; desc: string }[]; defence: string[]
  starter?: Record<string, string>
}
