/**
 * Predlozi adrese dok se kuca (kao u Google mapama). Izvor je Photon (OpenStreetMap), besplatan i bez ključa.
 * Ovde je samo obrada: ćirilica u latinicu, broj kuće iz unosa, izbor ulica u Srbiji i naselja (ne opštine).
 * Izbor predloga popuni Adresu („Vojvode Živojina Mišića 5“) i Mesto („Rakovac“), pa navigacija vodi na pravo mesto.
 */

const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ђ: 'đ', е: 'e', ж: 'ž', з: 'z', и: 'i', ј: 'j', к: 'k', л: 'l', љ: 'lj', м: 'm',
  н: 'n', њ: 'nj', о: 'o', п: 'p', р: 'r', с: 's', т: 't', ћ: 'ć', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'č', џ: 'dž', ш: 'š',
};

/** Srpska ćirilica u latinicu („Раковац“ → „Rakovac“, „ЉИГ“ → „LJIG“). Latinica ostaje ista. */
export function latinize(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    const lower = ch.toLowerCase();
    const lat = CYR[lower];
    if (lat === undefined) { out += ch; continue; }
    if (ch === lower) { out += lat; continue; }
    // Veliko slovo: Lj/Nj/Dž, a ceo red velikim slovima ostaje veliki (LJ)
    const next = s[i + 1];
    const nextUpper = next !== undefined && next !== next.toLowerCase();
    out += nextUpper || lat.length === 1 ? lat.toUpperCase() : lat[0]!.toUpperCase() + lat.slice(1);
  }
  return out;
}

/** Iz unosa izdvaja broj kuće („Vojvode Mišića 5a Rakovac“ → upit bez broja, broj „5a“). */
export function parseAddressQuery(input: string): { query: string; number: string | null } {
  const m = input.match(/(?:^|\s)(\d+[a-zA-Z]?(?:\/\d+)?)(?=\s|,|$)/);
  if (!m) return { query: input.trim(), number: null };
  const query = (input.slice(0, m.index) + ' ' + input.slice((m.index ?? 0) + m[0].length)).replace(/\s+/g, ' ').replace(/\s,/g, ',').trim();
  return { query, number: m[1]! };
}

/** Deo odgovora Photon-a koji se koristi. */
export interface PhotonFeature {
  properties: {
    type?: string; osm_key?: string; osm_value?: string; countrycode?: string;
    name?: string; street?: string; housenumber?: string; city?: string; district?: string; locality?: string;
  };
}

export interface AddressSuggestion {
  /** Ulica i broj, za polje Adresa. */
  address: string;
  /** Naselje, za polje Mesto. */
  city: string;
}

/** Opština ili grad kao upravna jedinica nije naselje („Општина Беочин“), pa se tada uzima naselje iz `district`. */
const ADMIN = /^(општина|opština|opstina|град|grad|градска општина|gradska opština)\s/i;
/** Zvanični nazivi grada na engleskom („City of Novi Sad“) svode se na ime grada. */
const CITY_OF = /^(city of|municipality of)\s+/i;

/** Predlozi iz Photon odgovora: samo Srbija, samo ulice i zgrade (bez stajališta), bez duplikata, najviše `max`. */
export function addressSuggestions(features: PhotonFeature[], number: string | null, max = 6): AddressSuggestion[] {
  const out: AddressSuggestion[] = [];
  const seen = new Set<string>();
  for (const { properties: p } of features) {
    if (p.countrycode !== 'RS') continue;
    const isStreet = p.type === 'street' && p.osm_key === 'highway' && p.osm_value !== 'bus_stop';
    const isHouse = p.type === 'house' && !!p.street && !!p.housenumber && p.osm_key !== 'highway' && p.osm_key !== 'amenity';
    if (!isStreet && !isHouse) continue;
    const street = latinize((isStreet ? p.name : p.street) ?? '').trim();
    const placeRaw = p.city && !ADMIN.test(p.city) ? p.city : p.district ?? p.city ?? '';
    const city = latinize(placeRaw.replace(ADMIN, '').replace(CITY_OF, '')).trim();
    if (!street || !city) continue;
    const no = isHouse ? p.housenumber! : number;
    const address = no ? `${street} ${no}` : street;
    const key = `${address}|${city}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ address, city });
    if (out.length >= max) break;
  }
  return out;
}
