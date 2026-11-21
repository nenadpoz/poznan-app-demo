import { describe, expect, it } from 'vitest';
import { docContentType, docDefaultReminder, docExpiry, docTaskTitle, documentSchema, fmtBytes, monthBefore, taskSchema } from '../src';

describe('dokumentacija', () => {
  it('dozvoljeni fajlovi: PDF, PNG, JPG', () => {
    expect(docContentType('application/pdf')).toBe('application/pdf');
    expect(docContentType('image/jpg')).toBe('image/jpeg');
    expect(docContentType(null, 'Ugovor.PDF')).toBe('application/pdf');
    expect(docContentType('', 'slika.jpeg')).toBe('image/jpeg');
    expect(docContentType('image/heic', 'a.heic')).toBeNull();
    expect(docContentType('application/msword', 'a.doc')).toBeNull();
  });
  it('mesec dana pre isteka, kraj meseca se skraćuje', () => {
    expect(monthBefore('2027-03-15')).toBe('2027-02-15');
    expect(monthBefore('2027-03-31')).toBe('2027-02-28');
    expect(monthBefore('2028-03-31')).toBe('2028-02-29');
    expect(monthBefore('2027-01-10')).toBe('2026-12-10');
  });
  it('podrazumevani podsetnik mesec dana pre isteka, ne u prošlosti', () => {
    expect(docDefaultReminder('2027-01-10', '2026-11-21')).toBe('2026-12-10');
    expect(docDefaultReminder('2026-12-10', '2026-11-21')).toBeNull();
    expect(docDefaultReminder(null, '2026-11-21')).toBeNull();
  });
  it('istek za listu', () => {
    expect(docExpiry('2026-11-20', '2026-11-21')).toMatchObject({ level: 'expired', text: 'Istekao pre 1 dan' });
    expect(docExpiry('2026-11-21', '2026-11-21')).toMatchObject({ level: 'soon', text: 'Ističe danas' });
    expect(docExpiry('2026-12-11', '2026-11-21')).toMatchObject({ level: 'soon', days: 20 });
    expect(docExpiry('2027-06-01', '2026-11-21').level).toBe('ok');
    expect(docExpiry(null, '2026-11-21').level).toBe('none');
  });
  it('šema i zadatak', () => {
    expect(documentSchema.safeParse({ name: '' }).success).toBe(false);
    expect(documentSchema.parse({ name: 'Polisa osiguranja', expiresOn: '2027-01-10' })).toMatchObject({ name: 'Polisa osiguranja', description: null });
    expect(docTaskTitle(' Polisa ')).toBe('Ističe dokument: Polisa');
    expect(taskSchema.parse({ title: 'x', dueDate: null, documentId: '11111111-1111-4111-8111-111111111111' }).documentId).toBeTruthy();
    expect(fmtBytes(850 * 1024)).toBe('850 KB');
    expect(fmtBytes(2.4 * 1024 * 1024)).toBe('2,4 MB');
  });
});
