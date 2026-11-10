// Runs every SQL exercise solution (and starter) against the seeded practice DB, and every Python
// solution against its tests with the local Python, so content errors are caught before the learner sees them.
// Usage: node scripts/validate-content.mjs [--python]
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import initSqlJs from 'sql.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ex = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/generated/exercises.json'), 'utf8'))
const ctx = { self: {} }
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'public/workers/seed.js'), 'utf8'), ctx)
const seed = ctx.self.DESeed

const SQL = await initSqlJs()
const base = new SQL.Database(); base.exec(seed.seedSQL()); const bytes = base.export()
let bad = 0, ok = 0
for (const e of Object.values(ex).filter((e) => e.lang === 'sql')) {
  const run = (code) => { const db = new SQL.Database(bytes); try { if (e.setup) db.exec(e.setup); let r; for (let i = 0; i < (e.repeat || 1); i++) r = db.exec(code); const out = e.check ? db.exec(e.check) : r; return out.length ? out[out.length - 1] : { columns: [], values: [] } } finally { db.close() } }
  try {
    const r = run(e.solution)
    ok++
    const note = r.values.length === 0 ? '  (EMPTY result)' : ''
    console.log(`ok   ${e.id.padEnd(34)} ${String(r.values.length).padStart(4)} rows  [${r.columns.join(', ')}]${note}`)
  } catch (err) { bad++; console.log(`FAIL ${e.id}: ${err.message}`) }
}
if (process.argv.includes('--python')) {
  const shimDir = path.join((await import('node:os')).tmpdir(), 'delab-pyshims')
  fs.rmSync(shimDir, { recursive: true, force: true })
  for (const f of ['pyspark_shim.py', 'airflow_shim.py']) {
    const parts = fs.readFileSync(path.join(ROOT, 'public/workers/shims', f), 'utf8').split(/^# @@file (.+)$/m)
    for (let i = 1; i < parts.length; i += 2) { const p = path.join(shimDir, parts[i].trim()); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, parts[i + 1]) }
  }
  const dataDir = path.join(shimDir, 'data'); fs.mkdirSync(dataDir, { recursive: true })
  const outDir = path.join(shimDir, 'out'); fs.mkdirSync(outDir, { recursive: true })
  for (const [p, c] of Object.entries(seed.dataFiles())) fs.writeFileSync(path.join(dataDir, path.basename(p)), c)
  for (const e of Object.values(ex).filter((e) => e.lang === 'python')) {
    const prog = `import sys, json, math, os\nsys.path.insert(0, ${JSON.stringify(shimDir)})\nos.chdir(${JSON.stringify(shimDir)})\n` +
      `code = ${JSON.stringify(e.solution.replace(/\/data\//g, dataDir.replace(/\\/g, '/') + '/').replace(/"\/out\//g, '"' + outDir.replace(/\\/g, '/') + '/'))}\nns = {'__name__': '__main__'}\nexec(compile(code, '<sol>', 'exec'), ns)\n` +
      `def eq(a, b):\n    if isinstance(a, float) or isinstance(b, float):\n        return math.isclose(float(a), float(b), rel_tol=1e-6, abs_tol=1e-6)\n    if isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)): return len(a) == len(b) and all(eq(x, y) for x, y in zip(a, b))\n    if isinstance(a, dict) and isinstance(b, dict): return a.keys() == b.keys() and all(eq(a[k], b[k]) for k in a)\n    return a == b\n` +
      `fails = []\nfor t in json.loads(${JSON.stringify(JSON.stringify(e.tests).replace(/\/data\//g, dataDir.replace(/\\/g, '/') + '/').replace(/'\/out\//g, "'" + outDir.replace(/\\/g, '/') + '/'))}):\n    try:\n        got = eval(t['call'], ns); exp = eval(t['expect'], ns)\n        if not eq(got, exp): fails.append(f"{t['call']}: got {got!r} expected {exp!r}")\n    except Exception as ex: fails.append(f"{t['call']}: {type(ex).__name__} {ex}")\n` +
      (e.check ? `exec(${JSON.stringify(e.check.replace(/\/data\//g, dataDir.replace(/\\/g, '/') + '/'))}, ns)\n` : '') + `print('FAILS:' + json.dumps(fails))\n`
    try {
      const out = execFileSync('python', ['-c', prog], { encoding: 'utf8', timeout: 30000 })
      const fails = JSON.parse(out.split('FAILS:').pop())
      if (fails.length) { bad++; console.log(`FAIL ${e.id}: ${fails.join(' | ')}`) } else { ok++; console.log(`ok   ${e.id}`) }
    } catch (err) { bad++; console.log(`FAIL ${e.id}: ${String(err.stderr || err.message).split('\n').slice(-3).join(' ')}`) }
  }
}
console.log(`\n${ok} ok, ${bad} failing`)
process.exit(bad ? 1 : 0)
