// OPTIONAL AI coach (Claude). Everything in DE Lab works without it — this only adds open-ended evaluation:
// mock-interview follow-ups, rubric feedback on free-text answers, JD analysis and communication feedback.
// The key is stored only in this browser's local database and requests go directly to Anthropic's API.
import { getProfile, BACKGROUNDS } from '../db'

export const DEFAULT_MODEL = 'claude-opus-5-5'

let clientP: Promise<any> | null = null
let clientKey = ''
async function client() {
  const p = await getProfile()
  const key = p.settings.aiKey
  if (!key) throw new Error('No API key — add one in Settings → AI coach (optional).')
  if (!clientP || clientKey !== key) {
    clientKey = key
    clientP = import('@anthropic-ai/sdk').then(({ default: Anthropic }) => new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true }))
  }
  return { c: await clientP, model: p.settings.aiModel || DEFAULT_MODEL }
}
export async function aiEnabled() { const p = await getProfile(); return !!p.settings.aiKey }

interface AskOpts { system: string; messages: { role: 'user' | 'assistant'; content: string }[]; schema?: object; effort?: 'low' | 'medium' | 'high'; maxTokens?: number }
export async function ask(o: AskOpts): Promise<string> {
  const { c, model } = await client()
  await refreshLearner()
  const params: any = {
    model, max_tokens: o.maxTokens || 8000, system: o.system.replace('{{LEARNER}}', LEARNER), messages: o.messages,
    output_config: { effort: o.effort || 'medium', ...(o.schema ? { format: { type: 'json_schema', schema: o.schema } } : {}) },
  }
  // Server-side fallback: if a safety classifier declines, the API re-runs on a recommended fallback model.
  if (/^claude-(opus-5|fable-5|sonnet-5-5)/.test(model)) { params.betas = ['server-side-fallback-2026-07-01']; params.fallbacks = 'default' }
  const res = params.betas ? await c.beta.messages.create(params) : await c.messages.create(params)
  if (res.stop_reason === 'refusal') throw new Error('The AI coach declined this request. Try rephrasing.')
  return res.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim()
}
export async function askJSON<T>(o: AskOpts & { schema: object }): Promise<T> {
  const t = await ask(o)
  try { return JSON.parse(t) as T } catch { const m = t.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]) as T; throw new Error('Could not parse AI response') }
}

// Built from the learner's own profile (onboarding / settings) — nothing personal is hard-coded.
let LEARNER = 'The learner is preparing for a Data Engineering role.'
async function refreshLearner() {
  const p = await getProfile()
  const bg = BACKGROUNDS.find((b) => b.id === p.background)
  LEARNER = `The learner${p.name ? ` (${p.name})` : ''} ${bg ? bg.describe : 'is preparing for a Data Engineering role'}.` +
    (p.about ? ` In their own words: "${p.about.slice(0, 400)}".` : '') + (p.goal ? ` Their goal: ${p.goal.slice(0, 200)}.` : '')
}

export interface AnswerEval { scores: { correctness: number; depth: number; reasoning: number; judgement: number; communication: number }; overall: number; strengths: string[]; gaps: string[]; better: string; followUp: string }
const evalSchema = {
  type: 'object', additionalProperties: false, required: ['scores', 'overall', 'strengths', 'gaps', 'better', 'followUp'],
  properties: {
    scores: { type: 'object', additionalProperties: false, required: ['correctness', 'depth', 'reasoning', 'judgement', 'communication'], properties: { correctness: { type: 'integer' }, depth: { type: 'integer' }, reasoning: { type: 'integer' }, judgement: { type: 'integer' }, communication: { type: 'integer' } } },
    overall: { type: 'integer' }, strengths: { type: 'array', items: { type: 'string' } }, gaps: { type: 'array', items: { type: 'string' } }, better: { type: 'string' }, followUp: { type: 'string' },
  },
}
export function evaluateAnswer(q: { q: string; keyPoints: string[]; answer?: string }, answer: string, followups: { q: string; answer: string }[] = []) {
  return askJSON<AnswerEval>({
    schema: evalSchema,
    system: `You are a senior data engineer running a technical interview. {{LEARNER}} Score each dimension 0-10 strictly but fairly, as a hiring panel would for a junior-to-mid Data Engineer. overall is 0-100. strengths/gaps: 1-4 short, specific items. better: a concise improved answer outline (bullets allowed, max 120 words). followUp: one probing follow-up question a real interviewer would ask next, based on the weakest part of the answer. Never invent facts about companies.`,
    messages: [{ role: 'user', content: `Question: ${q.q}\n\nKey points an excellent answer covers: ${q.keyPoints.join('; ') || '(not provided)'}\n\nCandidate answer:\n${answer || '(no answer)'}${followups.length ? '\n\nFollow-up exchange:\n' + followups.map((f) => `Q: ${f.q}\nA: ${f.answer}`).join('\n') : ''}` }],
  })
}

export function nextFollowUp(q: string, transcript: { q: string; answer: string }[]) {
  return ask({
    effort: 'low', maxTokens: 1000,
    system: `You are a realistic Data Engineering interviewer. {{LEARNER}} Ask exactly ONE short follow-up question that probes depth, challenges an assumption, or tests a trade-off in the candidate's last answer. No hints, no praise, no preamble — output only the question.`,
    messages: [{ role: 'user', content: `Main question: ${q}\n\n` + transcript.map((t) => `Q: ${t.q}\nCandidate: ${t.answer}`).join('\n\n') }],
  })
}

export interface JDResult { role: string; seniority: string; mustHave: { skill: string; evidence: string }[]; niceToHave: { skill: string; evidence: string }[]; responsibilities: string[]; questions: string[]; priorities: string[]; notes: string }
export function analyzeJD(text: string, skillsSummary: string) {
  return askJSON<JDResult>({
    schema: {
      type: 'object', additionalProperties: false, required: ['role', 'seniority', 'mustHave', 'niceToHave', 'responsibilities', 'questions', 'priorities', 'notes'],
      properties: {
        role: { type: 'string' }, seniority: { type: 'string' },
        mustHave: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['skill', 'evidence'], properties: { skill: { type: 'string' }, evidence: { type: 'string' } } } },
        niceToHave: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['skill', 'evidence'], properties: { skill: { type: 'string' }, evidence: { type: 'string' } } } },
        responsibilities: { type: 'array', items: { type: 'string' } }, questions: { type: 'array', items: { type: 'string' } }, priorities: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' },
      },
    },
    system: `You analyse job descriptions for a Data Engineering candidate. {{LEARNER}} Extract only what the JD actually says (quote short evidence for each skill). questions: 8 likely technical interview questions INFERRED from the JD (they are not verified company questions). priorities: an ordered preparation plan using the candidate's measured competency. notes: anything ambiguous. Clearly separate facts from inference.`,
    messages: [{ role: 'user', content: `Candidate's measured competency (from their learning platform):\n${skillsSummary}\n\nJob description:\n${text}` }],
  })
}

export function communicationFeedback(task: string, text: string) {
  return ask({
    maxTokens: 3000,
    system: `You are a supportive technical communication coach for a non-native English speaker preparing for Data Engineering interviews. {{LEARNER}} Give feedback in this exact markdown structure: **What works** (2 bullets), **Clarity & structure** (2-3 bullets), **Language** (up to 4 specific corrections, quoting the original → improved), **Stronger version** (a rewritten answer of similar length). Be specific and kind; do not add new technical claims that are not in the original unless correcting an error (mark corrections).`,
    messages: [{ role: 'user', content: `Task: ${task}\n\nMy answer:\n${text}` }],
  })
}

export function socraticHint(prompt: string, code: string, error: string, hintsSoFar: string[]) {
  return ask({
    effort: 'low', maxTokens: 800,
    system: `You are a patient Data Engineering tutor. Never give the full solution or corrected code. Ask ONE guiding question or point to ONE concept that moves the learner one step forward. Max 60 words.`,
    messages: [{ role: 'user', content: `Exercise:\n${prompt}\n\nMy code:\n${code}\n\nResult/error:\n${error || '(wrong result)'}\n\nHints I already saw: ${hintsSoFar.join(' | ') || 'none'}` }],
  })
}
