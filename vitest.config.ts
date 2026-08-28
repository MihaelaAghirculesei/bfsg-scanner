import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Several suites launch Chromium and start HTTP servers in beforeAll /
    // afterAll. On a CPU-starved CI runner those can exceed the 10s default;
    // per-test timeouts are still set individually where they matter.
    hookTimeout: 30_000,
  },
});
