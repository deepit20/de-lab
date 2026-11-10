/* Python sandbox (Pyodide / CPython compiled to WebAssembly).
   Code runs in this worker only — it cannot touch the app's database or the user's files.
   The main thread terminates the worker on timeouts (infinite loops) and starts a new one. */
const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/'
importScripts(PYODIDE_URL + 'pyodide.js', './seed.js')

let py = null
let out = []
const status = (text) => self.postMessage({ type: 'status', text })

const HARNESS = String.raw`
import sys, json, traceback, ast, math, builtins

def _no_input(prompt=''):
    raise RuntimeError("input() is not available in the practice sandbox - assign test values to variables instead.")
builtins.input = _no_input

def __de_eq(a, b):
    if isinstance(a, float) or isinstance(b, float):
        try: return math.isclose(float(a), float(b), rel_tol=1e-6, abs_tol=1e-6)
        except Exception: return False
    if isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)):
        return type(a) == type(b) and len(a) == len(b) and all(__de_eq(x, y) for x, y in zip(a, b))
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(__de_eq(a[k], b[k]) for k in a)
    try:
        r = a == b
        return bool(r) if isinstance(r, bool) else bool(getattr(r, 'all', lambda: r)())
    except Exception:
        return False

def __de_tb(e):
    lines = traceback.format_exception(type(e), e, e.__traceback__)
    keep = [l for l in lines if 'File "/lib/' not in l and '_pyodide' not in l and '__de_' not in l]
    text = ''.join(keep)
    line = None
    if isinstance(e, SyntaxError) and e.filename == '<your code>':
        line = e.lineno
    else:
        tb = e.__traceback__
        while tb:
            if tb.tb_frame.f_code.co_filename == '<your code>': line = tb.tb_lineno
            tb = tb.tb_next
    return text, line

def __de_review(code):
    notes = []
    try: tree = ast.parse(code)
    except SyntaxError: return notes
    short_ok = set('ijkxynfe_')
    comp_targets = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.comprehension):
            for t in ast.walk(node.target):
                if isinstance(t, ast.Name): comp_targets.add(id(t))
    for node in ast.walk(tree):
        if isinstance(node, ast.ExceptHandler) and node.type is None:
            notes.append({'line': node.lineno, 'sev': 'warn', 'msg': 'Bare "except:" also catches KeyboardInterrupt/SystemExit and hides bugs - catch specific exceptions (e.g. except ValueError:).'})
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for d in node.args.defaults + node.args.kw_defaults:
                if isinstance(d, (ast.List, ast.Dict, ast.Set)):
                    notes.append({'line': node.lineno, 'sev': 'warn', 'msg': f'Mutable default argument in {node.name}() - it is shared across calls. Use None and create it inside.'})
            length = (getattr(node, 'end_lineno', node.lineno) or node.lineno) - node.lineno
            if length > 40: notes.append({'line': node.lineno, 'sev': 'info', 'msg': f'{node.name}() is {length} lines long - consider splitting it into smaller, testable functions.'})
            if len(node.name) == 1: notes.append({'line': node.lineno, 'sev': 'info', 'msg': f'Function name "{node.name}" is not descriptive.'})
        if isinstance(node, ast.Compare):
            for op, comp in zip(node.ops, node.comparators):
                if isinstance(op, (ast.Eq, ast.NotEq)) and isinstance(comp, ast.Constant) and comp.value is None:
                    notes.append({'line': node.lineno, 'sev': 'info', 'msg': 'Use "is None" / "is not None" instead of == None.'})
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == 'range' and node.args and isinstance(node.args[0], ast.Call) and getattr(node.args[0].func, 'id', '') == 'len':
            notes.append({'line': node.lineno, 'sev': 'info', 'msg': 'range(len(x)) - enumerate(x) is usually clearer when you need index and value.'})
        if isinstance(node, ast.Global):
            notes.append({'line': node.lineno, 'sev': 'info', 'msg': 'global state makes functions hard to test - pass values in and return results.'})
        if isinstance(node, (ast.For, ast.While)):
            depth = 0
            for child in ast.walk(node):
                if child is not node and isinstance(child, (ast.For, ast.While)): depth += 1
            if depth >= 2: notes.append({'line': node.lineno, 'sev': 'info', 'msg': 'Deeply nested loops (O(n^3)?) - a dict/set lookup can often replace an inner loop.'})
        if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store) and len(node.id) == 1 and node.id not in short_ok and id(node) not in comp_targets:
            notes.append({'line': node.lineno, 'sev': 'info', 'msg': f'Variable "{node.id}" - descriptive names make pipelines easier to debug.'})
    seen = set(); uniq = []
    for n in notes:
        k = (n['line'], n['msg'])
        if k not in seen: seen.add(k); uniq.append(n)
    return uniq[:8]

def __de_run(code, tests_json, check):
    tests = json.loads(tests_json)
    ns = {'__name__': '__main__'}
    res = {'ok': True, 'error': None, 'etype': None, 'line': None, 'tests': [], 'check': None, 'review': [], 'dags': None}
    try:
        exec(compile(code, '<your code>', 'exec'), ns)
    except SystemExit:
        pass
    except BaseException as e:
        res['ok'] = False
        res['etype'] = type(e).__name__
        res['error'], res['line'] = __de_tb(e)
    if res['ok']:
        for t in tests:
            item = {'label': t.get('label') or t.get('call'), 'hidden': bool(t.get('hidden')), 'call': t.get('call')}
            try:
                got = eval(t['call'], ns)
                exp = eval(t['expect'], ns)
                item['ok'] = __de_eq(got, exp)
                item['got'] = repr(got)[:400]
                item['expected'] = repr(exp)[:400]
            except BaseException as e:
                item['ok'] = False
                item['error'] = f'{type(e).__name__}: {e}'
            res['tests'].append(item)
        if check:
            try:
                exec(check, ns)
                res['check'] = {'ok': True}
            except AssertionError as e:
                res['check'] = {'ok': False, 'msg': str(e) or 'A check failed.'}
            except BaseException as e:
                res['check'] = {'ok': False, 'msg': f'{type(e).__name__}: {e}'}
    res['review'] = __de_review(code)
    if 'airflow' in sys.modules:
        try:
            import airflow
            res['dags'] = airflow._export()
            airflow._reset()
        except Exception as e:
            res['dags'] = {'error': str(e)}
    return json.dumps(res, default=str)
`

async function writeShim(path) {
  const text = await (await fetch(path)).text()
  // a shim file contains several modules separated by "# @@file <relative/path.py>"
  const parts = text.split(/^# @@file (.+)$/m)
  for (let i = 1; i < parts.length; i += 2) {
    const file = '/home/pyodide/' + parts[i].trim()
    py.FS.mkdirTree(file.substring(0, file.lastIndexOf('/')))
    py.FS.writeFile(file, parts[i + 1])
  }
}

async function init() {
  if (py) return
  status('Starting Python (first time can take ~10s; cached afterwards)…')
  py = await loadPyodide({ indexURL: PYODIDE_URL })
  py.setStdout({ batched: (s) => out.push(s) })
  py.setStderr({ batched: (s) => out.push(s) })
  py.FS.mkdirTree('/data'); py.FS.mkdirTree('/out')
  for (const [p, content] of Object.entries(DESeed.dataFiles())) py.FS.writeFile(p, content)
  await writeShim('./shims/pyspark_shim.py')
  await writeShim('./shims/airflow_shim.py')
  py.runPython("import sys, os; sys.path.insert(0, '/home/pyodide'); os.chdir('/home/pyodide')")
  py.runPython(HARNESS)
  status('')
}

self.onmessage = async (e) => {
  const { id, type } = e.data
  try {
    await init()
    if (type === 'init') return self.postMessage({ id, ok: true })
    if (type === 'run') {
      const { code, tests = [], check = '' } = e.data
      out = []
      const imports = code + '\n' + (check || '')
      if (/\b(pandas|numpy|sqlite3)\b/.test(imports)) {
        status('Loading packages (pandas/numpy) — first time only…')
        await py.loadPackagesFromImports(imports.replace(/\bpyspark\b|\bairflow\b/g, 'os'))
        if (/\bspark\.sql\(/.test(imports)) await py.loadPackage('sqlite3')
        status('')
      } else if (/spark\.sql\(/.test(code)) { await py.loadPackage('sqlite3') }
      const t0 = performance.now()
      const fn = py.globals.get('__de_run')
      const json = fn(code, JSON.stringify(tests), check)
      fn.destroy()
      const res = JSON.parse(json)
      res.stdout = out.join('\n')
      res.ms = performance.now() - t0
      return self.postMessage({ id, ok: true, result: res })
    }
    if (type === 'files') {
      const list = []
      for (const dir of ['/data', '/out']) for (const f of py.FS.readdir(dir)) if (f !== '.' && f !== '..') { const st = py.FS.stat(dir + '/' + f); list.push({ path: dir + '/' + f, size: st.size }) }
      return self.postMessage({ id, ok: true, files: list })
    }
    if (type === 'read') return self.postMessage({ id, ok: true, text: py.FS.readFile(e.data.path, { encoding: 'utf8' }).slice(0, 20000) })
    throw new Error('Unknown request ' + type)
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message ? err.message : err) })
  }
}
