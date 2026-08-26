import { describe, expect, it } from 'vitest';
import { runWithConcurrency } from './pool.js';

describe('runWithConcurrency', () => {
  it('never runs more workers than the configured concurrency', async () => {
    let active = 0;
    let maxActive = 0;

    await runWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (item) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      return item * 2;
    });

    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it('returns results in input order regardless of completion order', async () => {
    const delays = [30, 10, 20];

    const results = await runWithConcurrency(delays, 3, async (delay, index) => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return index;
    });

    expect(results).toEqual([0, 1, 2]);
  });

  it('handles an empty input', async () => {
    const results = await runWithConcurrency([], 3, async () => 'unreachable');

    expect(results).toEqual([]);
  });

  it('runs everything at once when concurrency exceeds the item count', async () => {
    let concurrentPeak = 0;
    let current = 0;

    await runWithConcurrency([1, 2, 3], 10, async () => {
      current += 1;
      concurrentPeak = Math.max(concurrentPeak, current);
      await new Promise((resolve) => setTimeout(resolve, 5));
      current -= 1;
    });

    expect(concurrentPeak).toBe(3);
  });
});
