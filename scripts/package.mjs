// Builds a self-contained folder "release/DE Lab" to copy onto any Windows laptop:
//   DE Lab/Start DE Lab.bat, Stop DE Lab.bat, serve.ps1, README.txt, app/ (the built site)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(ROOT, 'release', 'DE Lab')
fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(out, { recursive: true })
fs.cpSync(path.join(ROOT, 'dist'), path.join(out, 'app'), { recursive: true })
for (const f of ['Start DE Lab.bat', 'Stop DE Lab.bat', 'serve.ps1']) fs.copyFileSync(path.join(ROOT, 'launcher', f), path.join(out, f))
fs.writeFileSync(path.join(out, 'README.txt'), [
  'DE Lab — personal Data Engineering learning workspace',
  '',
  'START:  double-click "Start DE Lab.bat"  (opens the app in its own window at http://localhost:5178)',
  'STOP:   double-click "Stop DE Lab.bat"   (optional — the server uses almost no resources)',
  '',
  'Tip: right-click "Start DE Lab.bat" > Send to > Desktop (create shortcut) for one-click access.',
  'Tip: in Edge/Chrome you can also install it as an app (address bar > Install) — it then opens offline too.',
  '',
  'Your learning data is stored inside the browser for http://localhost:5178.',
  'Use Settings > Backup & restore to keep backups (choose a OneDrive/Google Drive folder for automatic daily backups).',
  'Keep using the same browser and the same port to keep your data.',
  '',
  'The first time you run Python, the Python engine (~10 MB) downloads once from the internet and is then cached.',
].join('\r\n'))
console.log('Packaged to', out)
