import { defineConfig, devices } from '@playwright/test'

// Controlli visivi e offline sulla build di produzione (service worker
// compreso). WebKit, per Safari su iPad, si attiva con WEBKIT=1: su Ubuntu
// servono le sue librerie di sistema (npx playwright install-deps webkit).
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: true,
  workers: 3,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    colorScheme: 'dark',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ...(process.env.WEBKIT ? [{ name: 'webkit', use: { ...devices['Desktop Safari'] } }] : []),
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 180_000,
  },
})
