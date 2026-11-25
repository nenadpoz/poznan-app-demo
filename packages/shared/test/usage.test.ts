import { describe, expect, it } from 'vitest';
import { fmtMb, usageLevel } from '../src';

const MB = 1024 * 1024;
describe('zauzeće prostora', () => {
  it('procenat i nivo', () => {
    expect(usageLevel(35 * MB, 500)).toEqual({ pct: 7, level: 'good', usedMb: 35, leftMb: 465 });
    expect(usageLevel(360 * MB, 500).level).toBe('warn');
    expect(usageLevel(430 * MB, 500).level).toBe('bad');
    expect(usageLevel(8.3 * MB, 1024).pct).toBe(0.8);
  });
  it('prikaz', () => {
    expect(fmtMb(35)).toBe('35 MB');
    expect(fmtMb(8.3)).toBe('8,3 MB');
    expect(fmtMb(1024)).toBe('1,0 GB');
    expect(fmtMb(8192)).toBe('8,0 GB');
  });
});
