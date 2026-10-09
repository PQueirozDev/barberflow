import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3100', trace: 'retain-on-failure', channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : [{
    command: 'node --import tsx tests/helpers/supabase-test-server.ts',
    url: 'http://127.0.0.1:3101/health',
    reuseExistingServer: false,
    timeout: 60_000,
  },{
    command: 'npm run start -- --port 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      NEXT_PUBLIC_APP_URL: 'http://localhost:3100',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:3101',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'barberflow-local-test-anon',
      SUPABASE_SERVICE_ROLE_KEY: 'barberflow-local-test-service',
      VERCEL: '',
    },
  }],
});
