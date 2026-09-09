import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

let commitHash = ''
try {
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    commitHash = process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)
  } else {
    commitHash = execSync('git rev-parse --short HEAD').toString().trim()
  }
} catch (e) {
  commitHash = ''
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})

