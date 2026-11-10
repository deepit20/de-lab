// Runs after `npm install`: copies the SQLite WASM engine into public/vendor and compiles the content,
// so a fresh clone works with `npm run dev` straight away.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildContent } from './build-content.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const vendor = path.join(ROOT, 'public', 'vendor')
fs.mkdirSync(vendor, { recursive: true })
for (const f of ['sql-wasm.js', 'sql-wasm.wasm']) fs.copyFileSync(path.join(ROOT, 'node_modules', 'sql.js', 'dist', f), path.join(vendor, f))
buildContent()
