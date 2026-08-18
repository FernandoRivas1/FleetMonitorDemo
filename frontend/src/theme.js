export const LIGHT_THEME = {
  bgPage: '#f6f7f9', surface: '#ffffff', text: '#1b2430', muted: '#64707d',
  border: '#e4e7eb', borderStrong: '#dde1e6', fill: '#f1f3f5', fillSoft: '#eef0f2',
  accent: '#4c9dcf', accentStrong: '#2f7ea8', accentSoft: '#e7f2f8',
  danger: '#c53030', dangerSoft: '#fdecec', dangerBorder: '#f5c6c6', dangerMuted: '#8a4a4a', dangerStrong: '#d9534f',
  success: '#3fa66a', successStrong: '#2f7a4a', successSoft: '#e5f4ea',
  warning: '#a6720f', warningSoft: '#fdf3e3', disabledBg: '#e5e7eb', shadow: 'rgba(20,30,40,0.12)',
};

export const DARK_THEME = {
  bgPage: '#10141a', surface: '#1a2028', text: '#e8ecf1', muted: '#8b96a3',
  border: '#2a3240', borderStrong: '#384252', fill: '#232b36', fillSoft: '#1e2530',
  accent: '#4c9dcf', accentStrong: '#7cc0e8', accentSoft: '#1f3a4a',
  danger: '#f0706b', dangerSoft: '#3a2020', dangerBorder: '#5a2e2e', dangerMuted: '#d99a97', dangerStrong: '#e2645f',
  success: '#5cc98a', successStrong: '#7ad9a3', successSoft: '#1e3327',
  warning: '#e0a940', warningSoft: '#3a2f18', disabledBg: '#2f3742', shadow: 'rgba(0,0,0,0.5)',
};

export const LIGHT_TILES = { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap contributors', className: '' };
// CARTO's dark_all tiles are legible at low zoom but street/city detail gets
// too dark once you zoom into a city — className hooks the .dark-tiles CSS
// filter (see index.css) that brightens just the tile images.
export const DARK_TILES = { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: '&copy; OpenStreetMap contributors &copy; CARTO', className: 'dark-tiles' };

// Exposes all theme tokens as CSS custom properties on the app root.
export function themeVars(theme) {
  return {
    '--bg-page': theme.bgPage,
    '--surface': theme.surface,
    '--text': theme.text,
    '--muted': theme.muted,
    '--border': theme.border,
    '--border-strong': theme.borderStrong,
    '--fill': theme.fill,
    '--fill-soft': theme.fillSoft,
    '--accent': theme.accent,
    '--accent-strong': theme.accentStrong,
    '--accent-soft': theme.accentSoft,
    '--danger': theme.danger,
    '--danger-soft': theme.dangerSoft,
    '--danger-border': theme.dangerBorder,
    '--danger-muted': theme.dangerMuted,
    '--danger-strong': theme.dangerStrong,
    '--success': theme.success,
    '--success-strong': theme.successStrong,
    '--success-soft': theme.successSoft,
    '--warning': theme.warning,
    '--warning-soft': theme.warningSoft,
    '--disabled-bg': theme.disabledBg,
    '--shadow': theme.shadow,
  };
}
