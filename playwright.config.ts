import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "/tmp/echo-rush-playwright",
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:5174",
    viewport: { width: 1280, height: 720 },
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      "npm run dev -- --host 127.0.0.1 --port 5174 --strictPort --mode e2e",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: false,
  },
});
