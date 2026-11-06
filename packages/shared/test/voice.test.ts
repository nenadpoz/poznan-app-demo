import { describe, expect, it } from 'vitest';
import { foldName, matchClient, normalizePhone, voiceResultSchema } from '../src';

const clients = [
  { id: '1', name: 'Marko Ilić' },
  { id: '2', name: 'Milena Đorđević' },
  { id: '3', name: 'Agro Drina DOO' },
  { id: '4', name: 'Petar Petrović' },
  { id: '5', name: 'Jelena Petrović' },
];

describe('glasovna komanda', () => {
  it('ime bez kvačica', () => {
    expect(foldName('  Milena  Đorđević ')).toBe('milena djordjevic');
    expect(foldName('Šećer Čačak Žika')).toBe('secer cacak zika');
  });
  it('klijent po imenu, i u padežu', () => {
    expect(matchClient('Marko Ilić', clients)?.id).toBe('1');
    expect(matchClient('Marka Ilića', clients)?.id).toBe('1');
    expect(matchClient('milena djordjevic', clients)?.id).toBe('2');
    expect(matchClient('Agro Drina', clients)?.id).toBe('3');
    expect(matchClient('Ilića', clients)?.id).toBe('1');
  });
  it('bez klijenta kad nije jasno ili ne postoji', () => {
    expect(matchClient('Petrović', clients)).toBeNull();
    expect(matchClient('Igor Petrović', clients)).toBeNull();
    expect(matchClient('', clients)).toBeNull();
    expect(matchClient(null, clients)).toBeNull();
  });
  it('telefon', () => {
    expect(normalizePhone('064 543-43-34')).toBe('0645434334');
    expect(normalizePhone('+381 64 5434334')).toBe('+381645434334');
    expect(normalizePhone('12')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
  it('odgovor AI-ja: nepoznata polja i pogrešne vrednosti postaju prazna', () => {
    const r = voiceResultSchema.parse({
      intent: 'klijent',
      client: { kind: 'fizicko', name: 'Igor Petrović', phone: '0645434334', city: 'Sremska Mitrovica', address: 'Petra Preradovića 13', email: '' },
    });
    expect(r.client).toMatchObject({ kind: 'fizicko', name: 'Igor Petrović', email: null, pib: null });
    expect(r.job).toBeNull();
    const bad = voiceResultSchema.parse({ intent: 'nesto', tx: { type: 'x', amount: -5, currency: 'GBP', date: 'sutra' } });
    expect(bad.intent).toBe('nepoznato');
    expect(bad.tx).toMatchObject({ type: null, amount: null, currency: null, date: null });
  });
});
