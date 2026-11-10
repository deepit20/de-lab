// Captures README screenshots of the demo workspace using an installed Chrome/Edge (puppeteer-core).
// 1) serve the app:  npm run build && npm run preview      2) node scripts/screenshots.mjs [baseUrl] [light|dark]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.argv[2] || 'http://localhost:5178/'
const THEME = process.argv[3] || 'dark'
const OUT = path.join(ROOT, 'docs', 'screenshots')
fs.mkdirSync(OUT, { recursive: true })
const exe = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => p && fs.existsSync(p))
if (!exe) throw new Error('No Chrome/Edge found — set CHROME_PATH')

const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--hide-scrollbars'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: THEME }])
await page.goto(BASE + '?demo=1#/', { waitUntil: 'networkidle0' })
await page.waitForSelector('.hero', { timeout: 30000 })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function shot(name, hash, { wait, action, scrollTo } = {}) {
  await page.evaluate((h) => { location.hash = h }, hash)
  if (wait) await page.waitForSelector(wait, { timeout: 60000 })
  await sleep(900)
  await page.addStyleTag({ content: '.main > .banner { display: none !important; }' })
  if (action) await action()
  if (scrollTo) await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'start' }), scrollTo)
  await sleep(500)
  await page.screenshot({ path: path.join(OUT, `${name}.png`) })
  console.log('saved', name)
}

await shot('today', '#/', { wait: '.plan-item' })
await shot('roadmap', '#/learn/sql', { wait: '.topic-row' })
await shot('sql-practice', '#/practice/sql-joins-2', {
  wait: '.schema-panel .schema-item',
  action: async () => {
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Run')?.click())
    await page.waitForSelector('.result-table', { timeout: 20000 })
    await page.evaluate(() => document.querySelector('[aria-label="Show columns of customers"]')?.click())
    await sleep(800)
  },
})
await shot('notes', '#/topic/dw-scd/notes', { wait: '.prose h2' })
await shot('analytics', '#/analytics', { wait: '.kpi' })
await shot('revision', '#/revise/session?mode=quiz', { wait: '.quiz-opt' })
await shot('lesson', '#/topic/sql-joins/lesson', { wait: '.stepper' })
await shot('airflow', '#/playground/python', {
  wait: '.editor-shell',
  action: async () => {
    await page.select('select', 'Airflow DAG (emulated)')
    await sleep(500)
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Run')?.click())
    await page.waitForSelector('.dag-node', { timeout: 120000 })
  },
})
// ---- README banner + GitHub social preview (rendered from HTML, using the fresh screenshots) ----
const img = (n) => 'data:image/png;base64,' + fs.readFileSync(path.join(OUT, `${n}.png`)).toString('base64')
const card = (w, h, compact) => `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0} body{width:${w}px;height:${h}px;font-family:"Segoe UI Variable Display","Segoe UI",system-ui,sans-serif;color:#e8eaf2;
  background:radial-gradient(1200px 600px at 85% -10%,#4f46e555,transparent 60%),radial-gradient(900px 500px at -10% 110%,#14b8a640,transparent 60%),#0f1117;overflow:hidden;position:relative}
  .wrap{position:absolute;left:${compact ? 56 : 64}px;top:${compact ? 54 : 70}px;width:${compact ? 560 : 520}px}
  .logo{display:flex;align-items:center;gap:14px;font-weight:700;font-size:26px}
  .mark{width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#4f46e5,#14b8a6);display:grid;place-items:center;font-weight:800;font-size:20px;color:#fff}
  h1{font-size:${compact ? 44 : 50}px;line-height:1.08;margin-top:${compact ? 22 : 30}px;letter-spacing:-.02em}
  h1 span{background:linear-gradient(90deg,#a5a0ff,#5eead4);-webkit-background-clip:text;color:transparent}
  p{font-size:${compact ? 18 : 20}px;color:#b3b9cb;margin-top:16px;line-height:1.45}
  .chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:${compact ? 18 : 26}px}
  .chips b{font-weight:600;font-size:14px;padding:6px 12px;border-radius:999px;background:#ffffff12;border:1px solid #ffffff1f;color:#d7dbe8}
  .shot{position:absolute;right:-70px;top:${compact ? 40 : 56}px;width:${compact ? 700 : 760}px;border-radius:14px;border:1px solid #333a4f;box-shadow:0 30px 80px #000a;transform:perspective(1600px) rotateY(-14deg) rotateX(4deg)}
  .shot2{position:absolute;right:${compact ? 250 : 300}px;top:${compact ? 300 : 360}px;width:${compact ? 380 : 420}px;border-radius:12px;border:1px solid #333a4f;box-shadow:0 20px 60px #000c;transform:perspective(1600px) rotateY(-14deg)}
</style></head><body>
  <div class="wrap"><div class="logo"><div class="mark">DE</div>DE Lab</div>
  <h1>Learn Data Engineering by <span>doing</span>.</h1>
  <p>An open-source, local-first workspace: lessons, real SQL &amp; Python in the browser, PySpark &amp; Airflow emulators, spaced revision, projects and interview prep.</p>
  <div class="chips"><b>82 topics</b><b>159 exercises</b><b>115 interview Qs</b><b>Runs offline</b><b>No account</b></div></div>
  <img class="shot" src="${img('today')}"><img class="shot2" src="${img('airflow')}">
</body></html>`
const docs = path.join(ROOT, 'docs')
for (const [name, w, h, compact] of [['banner', 1280, 560, false], ['social-preview', 1280, 640, true]]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 })
  await page.setContent(card(w, h, compact), { waitUntil: 'load' })
  await sleep(300)
  await page.screenshot({ path: path.join(docs, `${name}.png`) })
  console.log('saved', name)
}
await browser.close()
