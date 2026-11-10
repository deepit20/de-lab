// Offline heuristics for technical communication: structure, clarity, filler words, specificity.
export interface TextMetrics { words: number; sentences: number; avgSentence: number; fillers: string[]; hedges: string[]; structure: string[]; numbers: number; examples: boolean; tradeoffs: boolean; score: number; tips: string[] }
const FILLERS = ['basically', 'actually', 'like', 'you know', 'kind of', 'sort of', 'i mean', 'literally', 'so yeah', 'stuff', 'things like that', 'etc etc']
const HEDGES = ['i think', 'maybe', 'probably', 'i guess', 'not sure', 'i feel']
const STRUCTURE = ['first', 'second', 'third', 'finally', 'for example', 'for instance', 'because', 'therefore', 'however', 'on the other hand', 'in summary', 'to summarise', 'to summarize', 'the trade-off', 'trade-off', 'in short', 'which means', 'as a result']

export function analyzeText(text: string): TextMetrics {
  const t = ' ' + text.toLowerCase().replace(/\s+/g, ' ') + ' '
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const sentences = Math.max(1, (text.match(/[.!?](\s|$)/g) || []).length)
  const find = (list: string[]) => list.filter((f) => t.includes(' ' + f + ' ') || t.includes(' ' + f + ',') || t.includes(' ' + f + '.'))
  const fillers = find(FILLERS), hedges = find(HEDGES), structure = find(STRUCTURE)
  const numbers = (text.match(/\b\d+(\.\d+)?\s?(%|gb|tb|mb|rows|million|k|ms|s|min|hours|x)?\b/gi) || []).length
  const examples = /for example|for instance|e\.g\.|such as|in my (project|work)|at my/i.test(text)
  const tradeoffs = /trade-?off|downside|cost|however|but |instead|alternative|vs\.?|versus/i.test(text)
  const avg = words / sentences
  const tips: string[] = []
  if (words < 40) tips.push('Too short for an interview answer — aim for 80–200 words: definition → why → how → example.')
  if (words > 320) tips.push('Long answer — lead with a one-sentence summary, then details. Interviewers interrupt long monologues.')
  if (avg > 28) tips.push('Sentences are long (avg ' + Math.round(avg) + ' words). Split them — shorter sentences sound more confident.')
  if (fillers.length) tips.push('Filler words: ' + fillers.join(', ') + '. Remove them in writing; pause instead when speaking.')
  if (hedges.length > 1) tips.push('Several hedges (' + hedges.join(', ') + '). State what you know directly; say "it depends on X" instead of "maybe".')
  if (!structure.length) tips.push('Add signposts ("First…", "The trade-off is…", "For example…") so the listener can follow your structure.')
  if (!examples) tips.push('Add a concrete example — ideally from your own work or project.')
  if (!tradeoffs) tips.push('Mention a trade-off or limitation — it signals engineering judgement.')
  let score = 100
  score -= Math.min(30, tips.length * 9)
  score -= Math.min(10, fillers.length * 3)
  return { words, sentences, avgSentence: Math.round(avg), fillers, hedges, structure, numbers, examples, tradeoffs, score: Math.max(10, score), tips }
}
