import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { contentPlugin, swManifestPlugin } from './scripts/plugins.mjs'

export default defineConfig({
  base: './',
  plugins: [react(), contentPlugin(), swManifestPlugin()],
  server: { port: 5178 },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('@codemirror') || id.includes('codemirror') || id.includes('@lezer')) return 'editor'
          if (id.includes('node_modules/react')) return 'react'
          if (id.includes('dexie')) return 'db'
        },
      },
    },
  },
})
