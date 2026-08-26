/**
 * Spaces out requests to the same host by at least `intervalMs`, so a
 * concurrency pool of several workers never bursts a target server with
 * simultaneous requests. Different hosts are independent of one another.
 */
export class HostRateLimiter {
  private readonly intervalMs: number;
  private readonly nextAvailableAt = new Map<string, number>();

  constructor(intervalMs = 1000) {
    this.intervalMs = intervalMs;
  }

  async wait(host: string): Promise<void> {
    const now = Date.now();
    const earliest = this.nextAvailableAt.get(host) ?? now;
    const scheduledAt = Math.max(now, earliest);
    this.nextAvailableAt.set(host, scheduledAt + this.intervalMs);

    const delay = scheduledAt - now;
    if (delay > 0) {
      await sleep(delay);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
