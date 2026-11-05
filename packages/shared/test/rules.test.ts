import { describe, expect, it } from 'vitest';
import {
  addDays, badgeCount, canInvoice, canInvoiceJobLine, channelsNow, clientSchema, cssVars, DEFAULT_NOTIFICATION_PREFS, defaultJobStatus,
  diffDays, filterTasks, fmtDate, formatInvoiceNo, hasStarted, incomeForYear, incomeLast12Months, inWindow, invoicePrefix,
  jobPaymentSchema, lightColors, limitUsage, money, nextStartPrompt, parseAmount, paymentSummary, pdvPeriod, periodRange, plural,
  isTaskOverdue, rsd, settingsSchema, sortJobs, taskGroup, taskReminderError, taskRemindersError, taskReminderText, totals, validatePayment, vatForMonth, weekday,
} from '../src';

describe('format', () => {
  it('iznosi', () => {
    expect(money(1234567)).toBe('1.234.567');
    expect(money(-1500.6)).toBe('−1.501');
    expect(rsd(0)).toBe('0 RSD');
    expect(parseAmount('1.234.567')).toBe(1234567);
    expect(parseAmount('12 000,50')).toBe(12000.5);
    expect(parseAmount('abc')).toBe(0);
  });
  it('datumi', () => {
    expect(fmtDate('2026-10-21')).toBe('21. okt 2026.');
    expect(fmtDate(null)).toBe('—');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(diffDays('2026-02-27', '2026-03-01')).toBe(2);
    expect(weekday('2026-11-02')).toBe(0); // ponedeljak
  });
  it('množina', () => {
    expect(plural(1, 'posao', 'posla', 'poslova')).toBe('1 posao');
    expect(plural(3, 'posao', 'posla', 'poslova')).toBe('3 posla');
    expect(plural(11, 'posao', 'posla', 'poslova')).toBe('11 poslova');
    expect(plural(21, 'posao', 'posla', 'poslova')).toBe('21 posao');
  });
});

describe('limiti i PDV', () => {
  const tx = [
    { type: 'prihod' as const, amount: 5_000_000, date: '2026-03-01', companyId: 'dr', vat: 0 },
    { type: 'prihod' as const, amount: 1_000_000, date: '2025-12-01', companyId: 'dr', vat: 0 },
    { type: 'trosak' as const, amount: 300_000, date: '2026-03-02', companyId: 'dr', vat: 20 },
    { type: 'prihod' as const, amount: 100_000, date: '2026-03-05', companyId: 'dr', vat: 20 },
    { type: 'prihod' as const, amount: 900_000, date: '2026-03-05', companyId: null, vat: 0 },
  ];
  it('nivo upozorenja', () => {
    expect(limitUsage(4_000_000, 6_000_000).level).toBe('good');
    expect(limitUsage(4_900_000, 6_000_000).level).toBe('warn');
    const over = limitUsage(6_600_000, 6_000_000);
    expect(over.level).toBe('bad');
    expect(over.fill).toBe(100);
    expect(over.left).toBe(-600_000);
  });
  it('prihod za godinu i 12 meseci, keš se ne računa', () => {
    expect(incomeForYear(tx, 'dr', 2026)).toBe(5_100_000);
    expect(incomeLast12Months(tx, 'dr', '2026-11-02')).toBe(6_100_000);
    expect(incomeLast12Months(tx, 'dr', '2026-12-05')).toBe(5_100_000);
  });
  it('PDV period i rok', () => {
    expect(pdvPeriod('2026-11-02')).toMatchObject({ periodKey: '2026-10', deadline: '2026-11-15', daysLeft: 13 });
    expect(pdvPeriod('2026-11-20')).toMatchObject({ periodKey: '2026-11', deadline: '2026-12-15' });
    expect(pdvPeriod('2027-01-10')).toMatchObject({ periodKey: '2026-12', deadline: '2027-01-15' });
    expect(pdvPeriod('2026-12-20').deadline).toBe('2027-01-15');
  });
  it('PDV za mesec', () => {
    expect(vatForMonth(tx, 'dr', '2026-03')).toMatchObject({ out: 20_000, in: 60_000, diff: -40_000, invoices: 2 });
  });
  it('podešavanja limita', () => {
    expect(settingsSchema.safeParse({ pausalLimit: 6e6, pdvThreshold: 8e6, warnPct: 80, critPct: 95 }).success).toBe(true);
    expect(settingsSchema.safeParse({ pausalLimit: 6e6, pdvThreshold: 8e6, warnPct: 95, critPct: 80 }).success).toBe(false);
  });
});

describe('poslovi', () => {
  const j = (id: string, status: any, startDate: string | null, startTime: string | null = null) => ({ id, status, startDate, startTime });
  it('podrazumevani status', () => {
    expect(defaultJobStatus('2026-11-10', '2026-11-02')).toBe('cekanje');
    expect(defaultJobStatus('2026-11-02', '2026-11-02')).toBe('proces');
    expect(defaultJobStatus(null, '2026-11-02')).toBe('proces');
  });
  it('početak sa vremenom', () => {
    expect(hasStarted(j('a', 'cekanje', '2026-11-02', '14:00'), '2026-11-02', '13:59')).toBe(false);
    expect(hasStarted(j('a', 'cekanje', '2026-11-02', '14:00'), '2026-11-02', '14:00')).toBe(true);
    expect(hasStarted(j('a', 'cekanje', '2026-11-01', '23:00'), '2026-11-02', '08:00')).toBe(true);
    expect(hasStarted(j('a', 'cekanje', null), '2026-11-02', '08:00')).toBe(false);
  });
  it('pita jednom po datumu početka, ponovo ako se datum promeni', () => {
    const jobs = [j('a', 'cekanje', '2026-11-01'), j('b', 'cekanje', '2026-10-30'), j('c', 'proces', '2026-10-01')];
    expect(nextStartPrompt(jobs, {}, '2026-11-02', '09:00')?.id).toBe('b');
    expect(nextStartPrompt(jobs, { b: '2026-10-30' }, '2026-11-02', '09:00')?.id).toBe('a');
    expect(nextStartPrompt(jobs, { a: '2026-11-01', b: '2026-10-30' }, '2026-11-02', '09:00')).toBeUndefined();
    expect(nextStartPrompt(jobs, { a: '2026-10-25', b: '2026-10-30' }, '2026-11-02', '09:00')?.id).toBe('a');
  });
  it('redosled', () => {
    const s = sortJobs([j('z', 'zavrseno', '2026-01-01'), j('u', 'uplata', null), j('c', 'cekanje', '2026-12-01'), j('p', 'proces', '2026-10-01')]);
    expect(s.map(x => x.id)).toEqual(['p', 'c', 'u', 'z']);
  });
  it('naplata', () => {
    expect(validatePayment([])).toEqual({ kind: 'empty' });
    expect(validatePayment([{ companyId: null, amount: 0, description: '' }])).toEqual({ kind: 'amount', companyId: null });
    expect(validatePayment([{ companyId: 'dr', amount: 1, description: '' }, { companyId: 'dr', amount: 2, description: '' }])?.kind).toBe('duplicate');
    const lines = [{ companyId: 'dr', amount: 100_000, description: 'Bunar' }, { companyId: 'tr', amount: 10_000, description: 'Prevoz' }, { companyId: null, amount: 200_000, description: 'Bunar' }];
    expect(validatePayment(lines)).toBeNull();
    expect(paymentSummary(lines, id => (id === 'dr' ? 'Drill' : 'Trans'), money)).toBe('Drill 100.000 · Trans 10.000 · keš 200.000');
    expect(jobPaymentSchema.safeParse({ jobId: 'p1', lines }).success).toBe(true);
    expect(jobPaymentSchema.safeParse({ jobId: 'p1', lines: [lines[0], lines[0]] }).success).toBe(false);
  });
});

describe('fakture', () => {
  it('samo prihod preko firme sa klijentom; za posao samo dok čeka uplatu', () => {
    expect(canInvoice({ type: 'prihod', companyId: 'dr', clientId: 'k1' })).toBe(true);
    expect(canInvoice({ type: 'prihod', companyId: null, clientId: 'k1' })).toBe(false);
    expect(canInvoice({ type: 'trosak', companyId: 'dr', clientId: 'k1' })).toBe(false);
    expect(canInvoiceJobLine('uplata', { companyId: 'dr' })).toBe(true);
    expect(canInvoiceJobLine('zavrseno', { companyId: 'dr' })).toBe(false);
    expect(canInvoiceJobLine('uplata', { companyId: null })).toBe(false);
  });
  it('broj fakture', () => {
    expect(invoicePrefix('Poznan Drill')).toBe('DR');
    expect(invoicePrefix('Poznan Trans')).toBe('TR');
    expect(formatInvoiceNo('DR', 2026, 7)).toBe('DR-2026-007');
  });
});

describe('periodi', () => {
  it('opsezi', () => {
    expect(periodRange({ kind: 'godina', year: 2026 })).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    expect(periodRange({ kind: 'mesec', year: 2028, month: 2 })).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(periodRange({ kind: 'period', year: 2026, from: '2026-05-10', to: '2026-03-01' })).toEqual({ from: '2026-03-01', to: '2026-05-10' });
  });
  it('zbirovi', () => {
    const t = totals(
      [
        { type: 'prihod', amount: 100, date: '2026-11-01', companyId: 'dr' },
        { type: 'prihod', amount: 50, date: '2026-11-02', companyId: null },
        { type: 'trosak', amount: 30, date: '2026-11-02', companyId: 'dr' },
        { type: 'prihod', amount: 999, date: '2026-10-31', companyId: 'dr' },
      ],
      { kind: 'mesec', year: 2026, month: 11 },
    );
    expect(t).toMatchObject({ income: 150, expense: 30, profit: 120 });
    expect(t.byCompany.get('dr')).toBe(100);
    expect(t.byCompany.get(null)).toBe(50);
  });
});

describe('obaveštenja', () => {
  it('vremenski prozori', () => {
    expect(inWindow('07:00', { from: '07:00', to: '21:00' })).toBe(true);
    expect(inWindow('21:00', { from: '07:00', to: '21:00' })).toBe(false);
    expect(inWindow('23:30', { from: '22:00', to: '06:00' })).toBe(true);
    expect(inWindow('12:00', { from: '22:00', to: '06:00' })).toBe(false);
    expect(channelsNow({ ...DEFAULT_NOTIFICATION_PREFS, email: true }, '07:30')).toEqual(['push']);
    expect(channelsNow({ ...DEFAULT_NOTIFICATION_PREFS, email: true }, '09:00')).toEqual(['push', 'email']);
  });
  it('zvonce ne prikazuje 0', () => {
    expect(badgeCount([{ read: true }])).toBeNull();
    expect(badgeCount([{ read: false }, { read: false }])).toBe('2');
  });
});

describe('zadaci', () => {
  it('grupe i filteri', () => {
    expect(taskGroup({ status: 'cekanje', dueDate: '2026-11-01' }, '2026-11-02', '2026-11-09')).toBe('kasni');
    expect(taskGroup({ status: 'proces', dueDate: '2026-11-05' }, '2026-11-02', '2026-11-09')).toBe('uskoro');
    expect(taskGroup({ status: 'zavrseno', dueDate: '2026-11-01' }, '2026-11-02', '2026-11-09')).toBe('zavrseno');
    const list = [
      { id: '1', title: 'a', status: 'cekanje' as const, dueDate: null, assignee: 'nenad' as const },
      { id: '2', title: 'b', status: 'proces' as const, dueDate: null, assignee: 'oba' as const },
      { id: '3', title: 'c', status: 'cekanje' as const, dueDate: null, assignee: 'jovan' as const },
    ];
    expect(filterTasks(list, { person: 'nenad', statuses: [] }).map(t => t.id)).toEqual(['1', '2']);
    expect(filterTasks(list, { person: 'svi', statuses: ['cekanje'] }).map(t => t.id)).toEqual(['1', '3']);
  });
});

describe('šeme i tema', () => {
  it('fizičko lice nema PIB', () => {
    expect(clientSchema.safeParse({ kind: 'fizicko', name: 'Marko' }).success).toBe(true);
    expect(clientSchema.safeParse({ kind: 'fizicko', name: 'Marko', pib: '123456789' }).success).toBe(false);
    expect(clientSchema.safeParse({ kind: 'pravno', name: 'Agro Drina DOO', pib: '123456789' }).success).toBe(true);
  });
  it('CSS promenljive kao u demou', () => {
    const css = cssVars(lightColors);
    expect(css).toContain('--surface-2:#E8EEEC;');
    expect(css).toContain('--accent-soft:#D9EEEA;');
    expect(css).toContain('--lc0:#B4531A;');
    expect(css).toContain('--av-a:#0A6B63;');
    expect(css).toContain('--bar-out:#B9C6C2;');
  });
});

describe('podsetnici zadatka', () => {
  const now = new Date(2026, 10, 5, 10, 0); // 5. nov 2026. 10:00
  it('ne u prošlost, ne posle roka', () => {
    expect(taskReminderError(new Date(2026, 10, 6, 9, 0), '2026-11-07', now)).toBeNull();
    expect(taskReminderError(new Date(2026, 10, 7, 23, 59), '2026-11-07', now)).toBeNull();
    expect(taskReminderError(new Date(2026, 10, 8, 0, 0), '2026-11-07', now)).toBe('Podsetnik ne može biti posle roka.');
    expect(taskReminderError(new Date(2026, 10, 5, 9, 0), '2026-11-07', now)).toBe('Podsetnik ne može biti u prošlosti.');
    expect(taskReminderError(new Date(2026, 10, 6, 9, 0), null, now)).toBe('Za podsetnik prvo izaberi rok.');
  });
  it('već poslat podsetnik ostaje', () => {
    const sent = new Date(2026, 10, 4, 9, 0).toISOString();
    const next = new Date(2026, 10, 6, 9, 0).toISOString();
    expect(taskRemindersError([sent, next], [sent], '2026-11-07', now)).toBeNull();
    expect(taskRemindersError([sent], [], '2026-11-07', now)).toBe('Podsetnik ne može biti u prošlosti.');
    expect(taskRemindersError([next], [], '2026-11-05', now)).toBe('Podsetnik ne može biti posle roka.');
  });
  it('tekst', () => {
    expect(taskReminderText('Organizovati bager', 2)).toBe('Ostalo je još 2 dana do završetka zadatka „Organizovati bager“');
    expect(taskReminderText('X', 1)).toBe('Ostao je još 1 dan do završetka zadatka „X“');
    expect(taskReminderText('X', 21)).toBe('Ostao je još 21 dan do završetka zadatka „X“');
    expect(taskReminderText('X', 11)).toBe('Ostalo je još 11 dana do završetka zadatka „X“');
    expect(taskReminderText('X', 0)).toBe('Danas je rok za zadatak „X“');
  });
  it('kasni', () => {
    expect(isTaskOverdue({ status: 'cekanje', dueDate: '2026-11-04' }, '2026-11-05')).toBe(true);
    expect(isTaskOverdue({ status: 'zavrseno', dueDate: '2026-11-04' }, '2026-11-05')).toBe(false);
    expect(isTaskOverdue({ status: 'proces', dueDate: '2026-11-05' }, '2026-11-05')).toBe(false);
  });
});
