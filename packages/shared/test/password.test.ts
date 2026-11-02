import { describe, expect, it } from 'vitest';
import { newPasswordSchema, resetCodeSchema } from '../src';

describe('lozinka', () => {
  it('najmanje 8 karaktera i isti unos', () => {
    expect(newPasswordSchema.safeParse({ password: 'abc12345', repeat: 'abc12345' }).success).toBe(true);
    expect(newPasswordSchema.safeParse({ password: 'abc1234', repeat: 'abc1234' }).error?.issues[0]?.message).toBe('Lozinka mora imati najmanje 8 karaktera.');
    expect(newPasswordSchema.safeParse({ password: 'abc12345', repeat: 'abc12346' }).error?.issues[0]?.message).toBe('Lozinke se ne poklapaju.');
  });
  it('kod iz emaila', () => {
    expect(resetCodeSchema.safeParse(' 123456 ').success).toBe(true);
    expect(resetCodeSchema.safeParse('12345678').success).toBe(true);
    expect(resetCodeSchema.safeParse('12a456').success).toBe(false);
  });
});
