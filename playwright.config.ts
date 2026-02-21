import { defineConfig } from '@playwright/test'

const BASE_URL = 'http://localhost:5173'

export default defineConfig({
  testDir: './tests',
  timeout: 120000,
  retries: 0,
  expect: {
    timeout: 15000,
  },
  use: {
    baseURL: BASE_URL,
    trace: 'off',
  },
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    timeout: 120000,
    reuseExistingServer: true,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})

