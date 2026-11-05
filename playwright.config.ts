import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  workers: 1,
  timeout: 45_000,
  use: { baseURL: 'http://localhost:5185', channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true, timezoneId: 'Asia/Shanghai' },
  webServer: {
    command: 'npm run dev -- --port 5185 --strictPort',
    url: 'http://localhost:5185',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
