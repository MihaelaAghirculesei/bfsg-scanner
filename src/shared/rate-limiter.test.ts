import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HostRateLimiter } from './rate-limiter.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('HostRateLimiter', () => {
  it('serializes calls for the same host to the configured interval', async () => {
    const limiter = new HostRateLimiter(1000);
    const order: number[] = [];

    const calls = Promise.all(
      [0, 1, 2].map(async (i) => {
        await limiter.wait('example.de');
        order.push(i);
      }),
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual([0]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(order).toEqual([0, 1]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(order).toEqual([0, 1, 2]);

    await calls;
  });

  it('does not delay calls for different hosts', async () => {
    const limiter = new HostRateLimiter(1000);
    const order: string[] = [];

    const calls = Promise.all([
      limiter.wait('a.example').then(() => order.push('a')),
      limiter.wait('b.example').then(() => order.push('b')),
    ]);

    await vi.advanceTimersByTimeAsync(0);
    await calls;

    expect(order.sort()).toEqual(['a', 'b']);
  });
});
