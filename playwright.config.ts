import { defineConfig } from "@playwright/test";

// Phase F7 checks. Builds the site and serves the production build on port 3100.
export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3100" },
  webServer: {
    command: "npm run build && npm run start -- -p 3100",
    url: "http://localhost:3100",
    timeout: 240_000,
    reuseExistingServer: true,
  },
});
