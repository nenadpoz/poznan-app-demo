/**
 * Računi: račun svake firme i jedna zajednička zaliha keša.
 * Stanje = početno stanje + prihodi − troškovi + prenosi na račun − prenosi sa računa.
 * Prenos (podizanje keša sa računa, polaganje keša na račun) nije prihod ni trošak:
 * ne ulazi u paušal limit, PDV ni profit.
 */

export type AccountKind = 'company' | 'cash';

export interface AccountLike {
  id: string;
  kind: AccountKind;
  companyId: string | null;
  openingBalance: number; // RSD
}

export interface MoneyMove {
  type: 'prihod' | 'trosak';
  amount: number; // RSD
  accountId: string;
}

export interface TransferLike {
  fromAccountId: string;
  toAccountId: string;
  amount: number; // RSD
}

export function balances(accounts: AccountLike[], txs: MoneyMove[], transfers: TransferLike[]): Map<string, number> {
  const out = new Map(accounts.map(a => [a.id, a.openingBalance]));
  const add = (id: string, n: number) => out.has(id) && out.set(id, (out.get(id) ?? 0) + n);
  for (const t of txs) add(t.accountId, t.type === 'prihod' ? t.amount : -t.amount);
  for (const t of transfers) {
    add(t.fromAccountId, -t.amount);
    add(t.toAccountId, t.amount);
  }
  return out;
}

export const totalBalance = (b: Map<string, number>) => [...b.values()].reduce((s, n) => s + n, 0);

/** Redosled na ekranu: firme po nazivu, keš na kraju. */
export function sortAccounts<A extends { kind: AccountKind; name: string }>(list: A[]): A[] {
  return [...list].sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, 'sr') : a.kind === 'cash' ? 1 : -1));
}

/** Natpis izbora računa u formi: kod prihoda novac ulazi, kod troška izlazi. */
export const accountFieldLabel = (type: 'prihod' | 'trosak') => (type === 'prihod' ? 'Uplata na' : 'Plaćeno sa');

export type TransferError = 'same' | 'amount' | 'insufficient';

/** Prenos: različiti računi, iznos > 0; upozorenje ako na izvoru nema dovoljno (ne blokira, keš se možda nije upisao). */
export function checkTransfer(t: TransferLike, b: Map<string, number>): TransferError | null {
  if (t.fromAccountId === t.toAccountId) return 'same';
  if (!(t.amount > 0)) return 'amount';
  if ((b.get(t.fromAccountId) ?? 0) < t.amount) return 'insufficient';
  return null;
}
