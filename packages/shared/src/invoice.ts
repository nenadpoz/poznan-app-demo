/** Fakture: samo prihod preko firme, sa klijentom. Keš nikad. */

export interface InvoiceableTx {
  type: 'prihod' | 'trosak';
  companyId: string | null;
  clientId: string | null;
}

export const canInvoice = (t: InvoiceableTx) => t.type === 'prihod' && !!t.companyId && !!t.clientId;

/**
 * Faktura posla se nudi samo dok je posao „Čeka uplatu“, i to samo za stavke preko firme.
 * Direktno „Završeno“ ne nudi fakturu.
 */
export const canInvoiceJobLine = (jobStatus: string, line: { companyId: string | null }) => jobStatus === 'uplata' && !!line.companyId;

/** Prefiks broja fakture iz naziva firme, bez reči „Poznan“: „Poznan Drill“ → „DR“. */
export function invoicePrefix(companyName: string): string {
  const word = companyName.split(/\s+/).filter(w => w && !/^poznan$/i.test(w))[0] ?? companyName;
  return word.slice(0, 2).toUpperCase();
}

/** Broj fakture: `DR-2026-007`. `seq` dolazi iz baze (RPC `next_invoice_no`), ovde je samo format. */
export const formatInvoiceNo = (prefix: string, year: number, seq: number) => `${prefix}-${year}-${String(seq).padStart(3, '0')}`;

/** Napomena na fakturi paušalca. */
export const PAUSAL_NOTE = 'Obveznik nije u sistemu PDV-a (čl. 33 Zakona o PDV-u).';
