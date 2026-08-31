import { describe, expect, it } from 'vitest';
import { toolInfo } from './package-info.js';

describe('toolInfo', () => {
  it('reads this package’s name and version', () => {
    const info = toolInfo();

    expect(info.name).toBe('bfsg-scanner');
    expect(info.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
