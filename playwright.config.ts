import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests', testMatch: '**/*.spec.ts', workers: 1,
  use: { browserName: 'chromium', launchOptions: { executablePath: process.env.POCKET_TEST_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe' } },
  webServer: [
    { command: 'npm run dev -- --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
    { command: 'npx tsx tests/fixture.ts', url: 'http://127.0.0.1:4319/ready', reuseExistingServer: false },
  ],
  reporter: 'list', outputDir: '.local/playwright-results',
});
