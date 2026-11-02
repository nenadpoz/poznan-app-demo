/** Tokeni boja iz demoa. Komponente koriste samo ove tokene, nikad literalne boje. */

export const lightColors = {
  bg: '#F2F5F4', surface: '#FFFFFF', surface2: '#E8EEEC', line: '#D7E0DD',
  fg: '#13201C', muted: '#5B6D68', accent: '#0A6B63', accentFg: '#FFFFFF', accentSoft: '#D9EEEA',
  good: '#1D7A4C', goodSoft: '#DDF2E6', warn: '#A86200', warnSoft: '#FBEBD2', bad: '#BF342D', badSoft: '#F9DFDC',
  info: '#2D5DA8', infoSoft: '#DFE8F7', barOut: '#B9C6C2', scrim: 'rgba(10,22,19,.45)',
  avA: '#0A6B63', avB: '#8A4A16',
  lc0: '#B4531A', lc1: '#2D5DA8', lc2: '#7A4FB0', lc3: '#1D7A4C', lc4: '#A8326A', lc5: '#7C6A12',
} as const;

export type ColorToken = keyof typeof lightColors;

export const darkColors: Record<ColorToken, string> = {
  bg: '#0D1412', surface: '#151F1C', surface2: '#1C2926', line: '#283633',
  fg: '#E4EDEA', muted: '#93A6A0', accent: '#43C0B2', accentFg: '#05211E', accentSoft: '#143530',
  good: '#53C48D', goodSoft: '#153325', warn: '#EFA63A', warnSoft: '#3A2A10', bad: '#F2766C', badSoft: '#3D1D1A',
  info: '#7FA7EA', infoSoft: '#1A2740', barOut: '#3E504B', scrim: 'rgba(0,0,0,.6)',
  avA: '#2E9C90', avB: '#C27A3A',
  lc0: '#F09A5E', lc1: '#7FA7EA', lc2: '#B99AE8', lc3: '#53C48D', lc4: '#E784B4', lc5: '#D3BE5A',
};

export type ThemePref = 'light' | 'dark' | 'system';
export const colorsFor = (pref: ThemePref, systemDark: boolean) => (pref === 'dark' || (pref === 'system' && systemDark) ? darkColors : lightColors);

/** Boje oznaka (kategorije poslova) i traka korisnika biraju se iz ove palete. */
export const LABEL_TOKENS = ['lc0', 'lc1', 'lc2', 'lc3', 'lc4', 'lc5'] as const satisfies readonly ColorToken[];

export const fonts = { display: 'Bricolage Grotesque', body: 'Onest' } as const;
export const radius = { md: 16, sm: 10 } as const;

/** CSS promenljive za web (`--surface-2` itd.), izvedene iz istih tokena. */
export function cssVars(c: Record<ColorToken, string>): string {
  return Object.entries(c)
    .map(([k, v]) => `--${k === 'surface2' ? 'surface-2' : k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}:${v};`)
    .join('');
}
