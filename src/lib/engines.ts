// Main-thread wrappers for the sandboxed workers, with timeouts that kill runaway code (infinite loops).
type Pending = { resolve: (v: any) => void; reject: (e: any) => void; timer: number }
const base = new URL('./', document.baseURI).href

class WorkerClient {
  private w: Worker | null = null
  private seq = 0
  private pending = new Map<number, Pending>()
  status = ''
  listeners = new Set<(s: string) => void>()
  constructor(private path: string, private name: string) {}
  private spawn() {
    this.w = new Worker(base + this.path, { name: this.name })
    this.w.onmessage = (e) => {
      const d = e.data
      if (d.type === 'status') { this.status = d.text; this.listeners.forEach((l) => l(d.text)); return }
      const p = this.pending.get(d.id)
      if (!p) return
      clearTimeout(p.timer); this.pending.delete(d.id)
      d.ok ? p.resolve(d) : p.reject(new Error(d.error))
    }
    this.w.onerror = (e) => { for (const [, p] of this.pending) p.reject(new Error(e.message || 'Worker failed to start — are you offline? Python needs one online start to download (then it is cached).')); this.pending.clear(); this.w = null }
  }
  call(msg: any, timeoutMs: number): Promise<any> {
    if (!this.w) this.spawn()
    const id = ++this.seq
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id)
        this.kill()
        reject(new Error(`TIMEOUT: stopped after ${Math.round(timeoutMs / 1000)}s — this usually means an infinite loop (a while condition that never becomes False, or recursion without a base case).`))
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      this.w!.postMessage({ ...msg, id })
    })
  }
  kill() { this.w?.terminate(); this.w = null; for (const [, p] of this.pending) { clearTimeout(p.timer); p.reject(new Error('Stopped')) } this.pending.clear() }
  get alive() { return !!this.w }
  onStatus(fn: (s: string) => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
}

export const sqlWorker = new WorkerClient('workers/sql-worker.js', 'sql')
export const pyWorker = new WorkerClient('workers/py-worker.js', 'python')
let pyReady = false
export const isPyReady = () => pyReady && pyWorker.alive

export interface SqlResult { columns: string[]; rows: any[][]; total: number; ms: number; sets: number; changes: number; plan?: { id: number; parent: number; detail: string }[] }
export interface SqlGrade { ok: boolean; error?: string; feedback: string[]; mine?: SqlResult; expected?: { columns: string[]; rows: any[][]; total: number }; plan?: SqlResult['plan'] }

export async function runSql(sql: string, opts: { playground?: boolean; setup?: string; explain?: boolean } = {}): Promise<SqlResult> {
  const r = await sqlWorker.call({ type: 'run', sql, ...opts }, 8000)
  return r.result
}
export async function gradeSql(sql: string, ex: { solution: string; setup?: string; check?: string; ordered?: boolean; repeat?: number }): Promise<SqlGrade> {
  const r = await sqlWorker.call({ type: 'grade', sql, solution: ex.solution, setup: ex.setup, check: ex.check, ordered: ex.ordered, repeat: ex.repeat || 1 }, 10000)
  return r.grade
}
export async function sqlSchema(playground = false, setup = '') { const r = await sqlWorker.call({ type: 'schema', playground, setup }, 8000); return r.tables as { name: string; cols: { name: string; type: string; pk: boolean }[]; count: number; description: string }[] }
export const resetPlayground = () => sqlWorker.call({ type: 'reset' }, 8000)

export interface PyResult {
  ok: boolean; error: string | null; etype: string | null; line: number | null; stdout: string; ms: number
  tests: { label: string; hidden: boolean; ok: boolean; got?: string; expected?: string; error?: string; call?: string }[]
  check: { ok: boolean; msg?: string } | null
  review: { line: number; sev: 'warn' | 'info'; msg: string }[]
  dags: any
}
export async function warmPython() { if (pyReady && pyWorker.alive) return; await pyWorker.call({ type: 'init' }, 120000); pyReady = true }
export async function runPython(code: string, tests: any[] = [], check = '', timeoutMs = 12000): Promise<PyResult> {
  if (!pyReady || !pyWorker.alive) await warmPython()
  const heavy = /\b(pandas|numpy)\b/.test(code)
  const r = await pyWorker.call({ type: 'run', code, tests, check }, heavy ? Math.max(timeoutMs, 90000) : timeoutMs)
  return r.result
}
export async function pyFiles() { if (!pyReady) await warmPython(); return (await pyWorker.call({ type: 'files' }, 5000)).files as { path: string; size: number }[] }
export async function pyRead(path: string) { return (await pyWorker.call({ type: 'read', path }, 5000)).text as string }
