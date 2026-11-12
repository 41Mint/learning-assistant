import { defineConfig } from '@playwright/test';

const testPort = 5187;
const baseURL = `http://localhost:${testPort}`;

export default defineConfig({
  testDir: './tests',
  workers: 1,
  timeout: 45_000,
  use: { baseURL, channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true, timezoneId: 'Asia/Shanghai' },
  webServer: {
    command: `npm run dev -- --port ${testPort} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
