import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Three suites launch and close their own Chromium in beforeAll /
    // afterAll and can run in parallel, so on a heavily loaded machine a
    // launch or a shutdown can take far longer than the 10s default. This
    // ceiling is only hit when the machine is starved; per-test timeouts
    // (set individually where they matter) still bound the tests themselves.
    hookTimeout: 60_000,
  },
});
