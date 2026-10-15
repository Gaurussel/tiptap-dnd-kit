import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
    testDir: './e2e',
    fullyParallel: false,
    use: { baseURL: 'http://localhost:5175', viewport: { width: 1200, height: 1400 } },
    webServer: { command: 'npm run dev', url: 'http://localhost:5175', reuseExistingServer: true },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1200, height: 1400 } } }],
})
