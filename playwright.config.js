// Playwright configuration for local static server + Chromium project
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests',
  timeout: 30_000,
  fullyParallel: true,
  use: {
    baseURL: 'http://localhost:3000',
    headless: false,
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: 'node scripts/serve.js',
    port: 3000,
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

