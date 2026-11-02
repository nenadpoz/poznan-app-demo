import { describe, expect, it } from 'vitest';
import { shouldAutoLogout } from '../src';

const at = (d: string) => new Date(d);
describe('automatska odjava', () => {
  it('ne odjavljuje bez podatka i dok se koristi', () => {
    expect(shouldAutoLogout(null, at('2026-11-03T09:00:00'))).toBe(false);
    expect(shouldAutoLogout(at('2026-11-02T23:50:00'), at('2026-11-03T00:10:00'))).toBe(false);
    expect(shouldAutoLogout(at('2026-11-03T08:00:00'), at('2026-11-03T20:00:00'))).toBe(false);
  });
  it('odjavljuje kad je počeo novi dan ili posle 24 sata', () => {
    expect(shouldAutoLogout(at('2026-11-02T22:00:00'), at('2026-11-03T07:00:00'))).toBe(true);
    expect(shouldAutoLogout(at('2026-11-02T23:30:00'), at('2026-11-03T00:05:00'))).toBe(true);
    expect(shouldAutoLogout(at('2026-11-02T08:00:00'), at('2026-11-03T08:00:00'))).toBe(true);
  });
});
