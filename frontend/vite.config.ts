import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        // Entry point 1: Your React Popup UI (tied to index.html)
        popup: resolve(__dirname, 'index.html'),
        // Entry point 2: Your LeetCode scraping DOM script
        contentScript: resolve(__dirname, 'src/contentScript.ts'),
      },
      output: {
        // Enforces predictable naming patterns so manifest.json can find files
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name === 'contentScript' 
            ? '[name].js' // Outputs output directory root: dist/contentScript.js
            : 'assets/[name]-[hash].js' // Standard React assets chunking
        }
      }
    }
  }
})