import { defineConfig, devices } from '@playwright/test'

const ci = !!process.env.CI

export default defineConfig({
    testDir: './e2e',
    fullyParallel: false,
    forbidOnly: ci,
    retries: ci ? 2 : 0,
    reporter: ci ? [['github'], ['html', { open: 'never' }]] : 'list',
    use: { baseURL: 'http://localhost:5175', viewport: { width: 1200, height: 1400 }, trace: 'on-first-retry' },
    webServer: { command: 'npm run dev', url: 'http://localhost:5175', reuseExistingServer: !ci },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1200, height: 1400 } } }],
})
