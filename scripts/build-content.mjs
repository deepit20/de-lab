// Compiles /content (Markdown + YAML) into lazy-loadable JSON under src/generated.
// Curated content is compiled at build time so the app ships pre-rendered HTML (fast, protected, versioned).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import { Marked } from 'marked'
import hljs from 'highlight.js/lib/core'
import python from 'highlight.js/lib/languages/python'
import sql from 'highlight.js/lib/languages/sql'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import yamlLang from 'highlight.js/lib/languages/yaml'
import plaintext from 'highlight.js/lib/languages/plaintext'

hljs.registerLanguage('python', python)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('json', json)
hljs.registerLanguage('yaml', yamlLang)
hljs.registerLanguage('text', plaintext)

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONTENT = path.join(ROOT, 'content')
const OUT = path.join(ROOT, 'src', 'generated')

const slug = (s) => String(s).toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const CALLOUTS = { TIP: 'Tip', WHY: 'Why it matters', WARN: 'Watch out', MISTAKE: 'Common mistake', INTERVIEW: 'Interview angle', REAL: 'Real-world', NOTE: 'Note', THINK: 'Think first', PERF: 'Performance' }

function makeMarked(toc) {
  const m = new Marked({ gfm: true })
  m.use({
    renderer: {
      code({ text, lang }) {
        const l = (lang || 'text').split(/\s/)[0]
        const language = hljs.getLanguage(l) ? l : 'text'
        const html = hljs.highlight(text, { language }).value
        return `<pre class="code" data-lang="${language}"><code class="hljs">${html}</code></pre>`
      },
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens)
        const id = slug(text)
        if (toc && depth <= 3) toc.push({ id, text: text.replace(/<[^>]+>/g, ''), depth })
        return `<h${depth} id="${id}">${text}</h${depth}>`
      },
      blockquote({ tokens }) {
        const body = this.parser.parse(tokens)
        const mm = body.match(/^<p>\[!(\w+)\]\s*/)
        if (mm && CALLOUTS[mm[1]]) {
          const kind = mm[1].toLowerCase()
          return `<div class="callout callout-${kind}"><div class="callout-title">${CALLOUTS[mm[1]]}</div>${body.replace(mm[0], '<p>')}</div>`
        }
        return `<blockquote>${body}</blockquote>`
      },
      table({ header, rows }) {
        const h = header.map((c) => `<th>${this.parser.parseInline(c.tokens)}</th>`).join('')
        const b = rows.map((r) => `<tr>${r.map((c) => `<td>${this.parser.parseInline(c.tokens)}</td>`).join('')}</tr>`).join('')
        return `<div class="table-wrap"><table><thead><tr>${h}</tr></thead><tbody>${b}</tbody></table></div>`
      },
    },
  })
  return m
}
const md = (src, toc) => (src ? makeMarked(toc).parse(String(src)) : '')
const mdInline = (src) => (src == null ? '' : makeMarked().parseInline(String(src)))
const plain = (s) => String(s || '').replace(/```[\s\S]*?```/g, ' ').replace(/[#>*_`|\-\[\]]/g, ' ').replace(/\s+/g, ' ').trim()

function readYaml(file) {
  const p = path.join(CONTENT, file)
  if (!fs.existsSync(p)) return null
  try { return yaml.load(fs.readFileSync(p, 'utf8')) } catch (e) { console.warn(`[content] YAML error in ${file}: ${e.reason} (line ${e.mark?.line + 1})`); return null }
}

// Topic file format: sections introduced by lines "=== name" (lesson | detailed | crisp | memory | data)
function parseTopicFile(src) {
  const sections = {}
  let cur = null
  for (const line of src.replace(/\r\n/g, '\n').split('\n')) {
    const m = line.match(/^===\s*(\w+)\s*$/)
    if (m) { cur = m[1]; sections[cur] = []; continue }
    if (cur) sections[cur].push(line)
  }
  for (const k of Object.keys(sections)) sections[k] = sections[k].join('\n').trim()
  return sections
}

// Lesson: steps introduced by "--- step <kind>: Title"; directives [[exercise:id]] [[quiz:id]] [[recall:id]] on their own line
function parseLesson(src) {
  if (!src) return []
  const steps = []
  let cur = null
  for (const line of src.split('\n')) {
    const m = line.match(/^---\s*step\s+(\w+)\s*:\s*(.+)$/)
    if (m) { cur = { kind: m[1], title: m[2].trim(), lines: [] }; steps.push(cur); continue }
    if (!cur) { cur = { kind: 'concept', title: 'Introduction', lines: [] }; steps.push(cur) }
    cur.lines.push(line)
  }
  return steps.map((s) => {
    const blocks = []
    let buf = []
    const flush = () => { const t = buf.join('\n').trim(); if (t) blocks.push({ t: 'html', html: md(t) }); buf = [] }
    for (const line of s.lines) {
      const d = line.trim().match(/^\[\[(exercise|quiz|recall):([\w.:-]+)\]\]$/)
      if (d) { flush(); blocks.push({ t: d[1], id: d[2] }) } else buf.push(line)
    }
    flush()
    return { kind: s.kind, title: s.title, blocks }
  })
}

export function buildContent() {
  const started = Date.now()
  fs.mkdirSync(path.join(OUT, 'topics'), { recursive: true })
  for (const f of fs.readdirSync(path.join(OUT, 'topics'))) fs.unlinkSync(path.join(OUT, 'topics', f))

  const cur = readYaml('curriculum.yaml')
  const exercises = {}
  const bank = []
  const cards = {}
  const search = []
  const warnings = []
  const allTopicIds = new Set()
  cur.tracks.forEach((t) => t.modules.forEach((m) => (m.topics || []).forEach((tp) => allTopicIds.add(tp.id))))

  const tracks = cur.tracks.map((track, ti) => ({
    id: track.id, title: track.title, short: track.short || track.title, color: track.color, icon: track.icon,
    description: track.description, order: ti + 1, why: track.why || '',
    modules: track.modules.map((mod) => ({
      id: mod.id, title: mod.title, summary: mod.summary || '', projects: mod.projects || [],
      topics: (mod.topics || []).map((tp) => {
        const file = path.join(CONTENT, 'topics', track.id, `${tp.id}.md`)
        const meta = {
          id: tp.id, title: tp.title, track: track.id, module: mod.id,
          kind: tp.kind || 'concept', complexity: tp.complexity || 1, minutes: tp.minutes || 30,
          prereqs: tp.prereqs || [], outline: tp.outline || [], tags: tp.tags || [],
          authored: 'outline', n: { ex: 0, fc: 0, quiz: 0, steps: 0 },
        }
        for (const p of meta.prereqs) if (!allTopicIds.has(p)) warnings.push(`${tp.id}: unknown prereq ${p}`)
        let detail = { id: tp.id, lesson: [], detailed: '', crisp: '', memory: '', toc: [], flashcards: [], quiz: [], recall: [], exercises: [], interview: [] }
        if (fs.existsSync(file)) {
          const s = parseTopicFile(fs.readFileSync(file, 'utf8'))
          let data = {}
          try { data = s.data ? yaml.load(s.data) || {} : {} } catch (e) { warnings.push(`${tp.id}: YAML error ${e.message}`) }
          const toc = []
          detail.lesson = parseLesson(s.lesson)
          detail.detailed = md(s.detailed, toc)
          detail.toc = toc
          detail.crisp = md(s.crisp)
          detail.memory = md(s.memory)
          detail.flashcards = (data.flashcards || []).map((c, i) => ({ id: `${tp.id}:fc${i}`, q: mdInline(c.q), a: mdInline(c.a) }))
          detail.quiz = (data.quiz || []).map((q, i) => ({ id: q.id || `${tp.id}:q${i}`, q: mdInline(q.q), options: (q.options || []).map(mdInline), answer: q.answer, explain: mdInline(q.explain || '') }))
          detail.recall = (data.recall || []).map((r, i) => ({ id: r.id || `${tp.id}:r${i}`, q: mdInline(r.q), answer: md(r.answer || ''), keyPoints: r.keyPoints || [] }))
          for (const ex of data.exercises || []) {
            if (!ex.id) { warnings.push(`${tp.id}: exercise without id`); continue }
            exercises[ex.id] = {
              id: ex.id, topic: tp.id, track: track.id, lang: ex.lang || 'sql', kind: ex.kind || 'coding',
              difficulty: ex.difficulty || 1, title: ex.title || ex.id, prompt: md(ex.prompt || ''),
              starter: ex.starter || '', solution: ex.solution || '', setup: ex.setup || '', check: ex.check || '', repeat: ex.repeat || 1,
              ordered: !!ex.ordered, tests: ex.tests || [], stdout: ex.stdout ?? null, hints: (ex.hints || []).map(mdInline),
              explain: md(ex.explain || ''), review: ex.review || [], minutes: ex.minutes || 10,
              interview: !!ex.interview, choices: ex.choices || null, answer: ex.answer ?? null,
            }
            detail.exercises.push(ex.id)
          }
          for (const [i, q] of (data.interview || []).entries()) {
            const id = q.id || `${tp.id}:iq${i}`
            bank.push({ id, track: track.id, topic: tp.id, level: q.level || 2, type: q.type || 'concept', q: q.q, keyPoints: q.keyPoints || [], answer: md(q.answer || ''), followUps: q.followUps || [] })
            detail.interview.push(id)
          }
          const hasDetailed = !!s.detailed && s.detailed.length > 400
          meta.authored = hasDetailed && detail.lesson.length ? 'full' : (s.crisp ? 'essential' : 'outline')
          meta.n = { ex: detail.exercises.length, fc: detail.flashcards.length, quiz: detail.quiz.length, steps: detail.lesson.length }
          search.push({ id: tp.id, type: 'topic', title: tp.title, track: track.id, text: plain([s.crisp, s.detailed, s.memory, (tp.outline || []).join(' ')].join(' ')).slice(0, 6000) })
        } else {
          search.push({ id: tp.id, type: 'topic', title: tp.title, track: track.id, text: (tp.outline || []).join(' ') })
        }
        if (!detail.crisp && meta.outline.length) detail.outlineHtml = md(meta.outline.map((o) => `- ${o}`).join('\n'))
        cards[tp.id] = { flashcards: detail.flashcards, quiz: detail.quiz, recall: detail.recall }
        fs.writeFileSync(path.join(OUT, 'topics', `${tp.id}.json`), JSON.stringify(detail))
        return meta
      }),
    })),
  }))

  // Extra interview bank (general / scenario / behavioural / system design)
  const ivDir = path.join(CONTENT, 'interview')
  if (fs.existsSync(ivDir)) {
    for (const f of fs.readdirSync(ivDir).filter((f) => f.endsWith('.yaml'))) {
      const d = yaml.load(fs.readFileSync(path.join(ivDir, f), 'utf8')) || {}
      for (const [i, q] of (d.questions || []).entries()) {
        bank.push({ id: q.id || `${f.replace('.yaml', '')}:${i}`, track: q.track || d.track || 'int', topic: q.topic || null, level: q.level || 2, type: q.type || d.type || 'concept', q: q.q, keyPoints: q.keyPoints || [], answer: md(q.answer || ''), followUps: q.followUps || [], context: q.context ? md(q.context) : '' })
      }
    }
  }
  for (const q of bank) search.push({ id: q.id, type: 'question', title: q.q.slice(0, 120), track: q.track, text: q.keyPoints.join(' ') })
  for (const e of Object.values(exercises)) search.push({ id: e.id, type: 'exercise', title: e.title, track: e.track, text: plain(e.prompt.replace(/<[^>]+>/g, ' ')) })

  const projects = (readYaml('projects.yaml')?.projects || []).map((p) => ({
    ...p, brief: md(p.brief || ''), milestones: (p.milestones || []).map((m, i) => ({ id: m.id || `m${i}`, title: m.title, detail: md(m.detail || ''), hints: (m.hints || []).map(mdInline) })),
    deliverables: p.deliverables || [], rubric: p.rubric || [], defence: p.defence || [],
  }))
  for (const p of projects) search.push({ id: p.id, type: 'project', title: p.title, track: 'proj', text: plain(p.brief.replace(/<[^>]+>/g, ' ')) })

  const english = readYaml('english.yaml') || {}
  const comm = readYaml('communication.yaml') || {}
  const skills = readYaml('skills.yaml') || {}

  const write = (name, obj) => fs.writeFileSync(path.join(OUT, name), JSON.stringify(obj))
  write('curriculum.json', { tracks, version: started })
  write('exercises.json', exercises)
  write('bank.json', bank)
  write('cards.json', cards)
  write('search.json', search)
  write('projects.json', projects)
  write('english.json', english)
  write('communication.json', comm)
  write('skills.json', skills)

  const count = tracks.reduce((a, t) => a + t.modules.reduce((b, m) => b + m.topics.length, 0), 0)
  const full = tracks.reduce((a, t) => a + t.modules.reduce((b, m) => b + m.topics.filter((x) => x.authored === 'full').length, 0), 0)
  const ess = tracks.reduce((a, t) => a + t.modules.reduce((b, m) => b + m.topics.filter((x) => x.authored === 'essential').length, 0), 0)
  console.log(`[content] ${count} topics (${full} full, ${ess} essential), ${Object.keys(exercises).length} exercises, ${bank.length} interview Qs, ${projects.length} projects in ${Date.now() - started}ms`)
  for (const w of warnings) console.warn('[content] ' + w)
  return { warnings }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) buildContent()
