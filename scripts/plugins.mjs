import path from 'node:path'
import { buildContent } from './build-content.mjs'

/** Recompiles /content on start and whenever a content file changes in dev. */
export function contentPlugin() {
  return {
    name: 'de-lab-content',
    buildStart() { buildContent() },
    configureServer(server) {
      const dir = path.resolve('content')
      server.watcher.add(dir)
      server.watcher.on('change', (file) => {
        if (path.resolve(file).startsWith(dir)) {
          try { buildContent(); server.ws.send({ type: 'full-reload' }) } catch (e) { console.error(e) }
        }
      })
    },
  }
}

/** Emits precache-manifest.json listing every built asset so the service worker can make the app work offline. */
export function swManifestPlugin() {
  return {
    name: 'de-lab-sw-manifest',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'))
      const extra = ['./', 'index.html', 'vendor/sql-wasm.js', 'vendor/sql-wasm.wasm', 'workers/sql-worker.js', 'workers/py-worker.js', 'workers/seed.js', 'workers/shims/pyspark_shim.py', 'workers/shims/airflow_shim.py', 'manifest.webmanifest', 'icon.svg']
      this.emitFile({ type: 'asset', fileName: 'precache-manifest.json', source: JSON.stringify({ version: Date.now(), files: [...extra, ...files] }) })
    },
  }
}
