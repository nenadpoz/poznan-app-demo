import { describe, expect, it } from 'vitest';
import { companySchema } from '../src';

describe('firma', () => {
  it('poslovna imena i datum osnivanja nisu obavezni', () => {
    const r = companySchema.parse({ name: 'Poznan Drill', form: 'pausal', legalName: '', shortName: '', founded: '' });
    expect(r.legalName).toBeNull();
    expect(r.shortName).toBeNull();
    expect(r.founded).toBeNull();
  });
  it('čuva puno ime, skraćeno ime i datum', () => {
    const r = companySchema.parse({ name: 'Poznan Drill', form: 'pausal', legalName: 'JOVAN POZNANOVIĆ PR KOPANJE BUNARA POZNAN DRILL SREMSKA MITROVICA', shortName: 'JOVAN POZNANOVIĆ PR POZNAN DRILL', founded: '2024-03-15' });
    expect(r.shortName).toBe('JOVAN POZNANOVIĆ PR POZNAN DRILL');
    expect(r.founded).toBe('2024-03-15');
    expect(companySchema.safeParse({ name: 'X', form: 'pausal', founded: '15.03.2024' }).success).toBe(false);
  });
});
