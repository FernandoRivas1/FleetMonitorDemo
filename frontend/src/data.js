// Shared constants for rendering fleet data fetched from the backend
// (see ../backend). Fleet data itself is no longer generated client-side —
// it comes from the API.

export const CITIES = [
  { name: 'Punta Arenas', lat: -53.1638, lng: -70.9171 },
  { name: 'Puerto Natales', lat: -51.7236, lng: -72.4875 },
  { name: 'Puerto Montt', lat: -41.4693, lng: -72.9424 },
  { name: 'Temuco', lat: -38.7359, lng: -72.5904 },
  { name: 'Concepción', lat: -36.8201, lng: -73.0444 },
  { name: 'Santiago', lat: -33.4489, lng: -70.6693 },
  { name: 'Antofagasta', lat: -23.6509, lng: -70.3975 },
  { name: 'Calama', lat: -22.4667, lng: -68.9333 },
];

export const STATUS_COLORS = {
  available: { color: '#3fa66a', darkColor: '#5cc98a', bg: '#e5f4ea', darkBg: '#1e3327', label: 'Available' },
  rented: { color: '#2f7ea8', darkColor: '#7cc0e8', bg: '#e7f2f8', darkBg: '#1f3a4a', label: 'Rented' },
  maintenance: { color: '#c53030', darkColor: '#f0706b', bg: '#fdecec', darkBg: '#3a2020', label: 'Maintenance' },
};

export function fmt(n) {
  return Math.round(n).toLocaleString('en-US');
}
