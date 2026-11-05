/**
 * Predlozi adrese iz Photon-a (OpenStreetMap, photon.komoot.io): besplatno, bez ključa, radi i na webu i na telefonu.
 * Ne ide kroz Supabase jer ne čita ni ne menja podatke aplikacije. Prednost imaju rezultati oko Novog Sada.
 */
import { addressSuggestions, parseAddressQuery, type AddressSuggestion, type PhotonFeature } from '@poznan/shared';

const PHOTON = 'https://photon.komoot.io/api/';
const NEAR = { lat: 45.25, lon: 19.84 }; // Novi Sad

/** Predlozi za upisan tekst (najmanje 3 slova). Uz ulicu dodaje broj kuće koji je upisan. */
export async function searchAddress(input: string, opts: { signal?: AbortSignal; max?: number } = {}): Promise<AddressSuggestion[]> {
  const { query, number } = parseAddressQuery(input);
  if (query.replace(/[^\p{L}]/gu, '').length < 3) return [];
  const url = `${PHOTON}?q=${encodeURIComponent(query)}&limit=15&lat=${NEAR.lat}&lon=${NEAR.lon}`;
  const res = await fetch(url, { signal: opts.signal, headers: { Accept: 'application/json' } });
  if (!res.ok) return [];
  const json = (await res.json()) as { features?: PhotonFeature[] };
  return addressSuggestions(json.features ?? [], number, opts.max);
}
