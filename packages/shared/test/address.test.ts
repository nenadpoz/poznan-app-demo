import { describe, expect, it } from 'vitest';
import { addressSuggestions, latinize, parseAddressQuery, type PhotonFeature } from '../src';

const f = (p: PhotonFeature['properties']): PhotonFeature => ({ properties: { countrycode: 'RS', ...p } });

describe('adrese', () => {
  it('ćirilica u latinicu', () => {
    expect(latinize('Раковац')).toBe('Rakovac');
    expect(latinize('Војводе Живојина Мишића')).toBe('Vojvode Živojina Mišića');
    expect(latinize('Љубе Ненадовића')).toBe('Ljube Nenadovića');
    expect(latinize('ЉИГ')).toBe('LJIG');
    expect(latinize('Џорџа Вашингтона')).toBe('Džordža Vašingtona');
    expect(latinize('Novi Sad')).toBe('Novi Sad');
  });
  it('broj kuće iz unosa', () => {
    expect(parseAddressQuery('Vojvode Misica 5 Rakovac')).toEqual({ query: 'Vojvode Misica Rakovac', number: '5' });
    expect(parseAddressQuery('Kralja Petra I 20a, Šabac')).toEqual({ query: 'Kralja Petra I, Šabac', number: '20a' });
    expect(parseAddressQuery('Bulevar oslobođenja')).toEqual({ query: 'Bulevar oslobođenja', number: null });
    expect(parseAddressQuery('Zmaj Jovina 12/3')).toEqual({ query: 'Zmaj Jovina', number: '12/3' });
  });
  it('predlozi: naselje umesto opštine, broj iz unosa, bez stajališta i druge države', () => {
    const list = addressSuggestions([
      f({ type: 'street', osm_key: 'highway', osm_value: 'residential', name: 'Војводе Живојина Мишића', city: 'Општина Беочин', district: 'Раковац' }),
      f({ type: 'street', osm_key: 'highway', osm_value: 'residential', name: 'Vojvode Mišića', city: 'Pale', countrycode: 'BA' }),
      f({ type: 'house', osm_key: 'highway', osm_value: 'bus_stop', name: 'Стајалиште', street: 'Војводе Мишића', city: 'Нови Сад' }),
      f({ type: 'street', osm_key: 'highway', osm_value: 'tertiary', name: 'Војводе Мишића', city: 'Нови Сад', district: 'МЗ Стари град' }),
      f({ type: 'street', osm_key: 'highway', osm_value: 'tertiary', name: 'Војводе Мишића', city: 'Нови Сад' }), // isti deo ulice
      f({ type: 'house', osm_key: 'building', osm_value: 'yes', street: 'Војводе Мишића', housenumber: '7', city: 'Нови Сад' }),
    ], '5');
    expect(list).toEqual([
      { address: 'Vojvode Živojina Mišića 5', city: 'Rakovac' },
      { address: 'Vojvode Mišića 5', city: 'Novi Sad' },
      { address: 'Vojvode Mišića 7', city: 'Novi Sad' },
    ]);
  });
});
