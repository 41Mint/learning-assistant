import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { logReviewPlugin } from './server/logReview.ts'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'DEEPSEEK_')
  return {
    plugins: [react(), logReviewPlugin({
      apiKey: env.DEEPSEEK_API_KEY?.trim() ?? '',
      model: env.DEEPSEEK_MODEL?.trim() || undefined,
    })],
  }
})
