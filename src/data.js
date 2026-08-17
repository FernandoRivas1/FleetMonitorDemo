// Mock fleet data generator, ported from the "Fleet Dashboard" design spec.

export const CITIES = [
  { name: 'Punta Arenas', lat: -53.1638, lng: -70.9171, count: 4 },
  { name: 'Puerto Natales', lat: -51.7236, lng: -72.4875, count: 2 },
  { name: 'Puerto Montt', lat: -41.4693, lng: -72.9424, count: 8 },
  { name: 'Temuco', lat: -38.7359, lng: -72.5904, count: 8 },
  { name: 'Concepción', lat: -36.8201, lng: -73.0444, count: 12 },
  { name: 'Santiago', lat: -33.4489, lng: -70.6693, count: 30 },
  { name: 'Antofagasta', lat: -23.6509, lng: -70.3975, count: 10 },
  { name: 'Calama', lat: -22.4667, lng: -68.9333, count: 6 },
];

export const STATUS_COLORS = {
  available: { color: '#3fa66a', darkColor: '#5cc98a', bg: '#e5f4ea', darkBg: '#1e3327', label: 'Available' },
  rented: { color: '#2f7ea8', darkColor: '#7cc0e8', bg: '#e7f2f8', darkBg: '#1f3a4a', label: 'Rented' },
  maintenance: { color: '#c53030', darkColor: '#f0706b', bg: '#fdecec', darkBg: '#3a2020', label: 'Maintenance' },
};

const AUTO_MODELS = ['Toyota Yaris', 'Hyundai Accent', 'Chevrolet Sail', 'Kia Rio', 'Nissan Versa', 'Suzuki Baleno'];
const CAMIONETA_MODELS = ['Toyota Hilux', 'Ford Ranger', 'Chevrolet D-Max', 'Nissan Navara', 'Mitsubishi L200', 'Mazda BT-50'];
const ALERT_POOL = [
  { title: 'Scheduled maintenance overdue', detail: 'Was due more than 5 days ago.' },
  { title: 'Oil change pending', detail: 'Oil change recommended based on mileage.' },
  { title: 'Worn tires', detail: 'Tread depth below the minimum allowed.' },
  { title: 'Vehicle inspection expiring soon', detail: 'Expires within the next 15 days.' },
  { title: 'Critical fuel level', detail: 'Fuel below 15%.' },
  { title: 'Low battery charge', detail: 'Charge below 15%.' },
];
const EVENT_LOCATIONS = ['Ruta 5 Norte, km 12', "Av. Libertador Bernardo O'Higgins", 'Camino a Farellones', 'Ruta 68, sector Casablanca', 'Av. Alemana', 'Camino Internacional', 'Circunvalación Américo Vespucio'];
const PLATE_LETTERS = 'BCDFGHJKLPRSTVWXYZ';

function rand(min, max) {
  return Math.random() * (max - min) + min;
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
export function fmt(n) {
  return Math.round(n).toLocaleString('en-US');
}

function makePlate() {
  let letters = '';
  for (let i = 0; i < 4; i++) letters += PLATE_LETTERS[Math.floor(Math.random() * PLATE_LETTERS.length)];
  const digits = String(Math.floor(rand(10, 99)));
  return letters + '-' + digits;
}

export function generateFleet() {
  const fleet = [];
  let id = 1;
  CITIES.forEach(city => {
    for (let i = 0; i < city.count; i++) {
      const isCamioneta = Math.random() < 0.45;
      const type = isCamioneta ? 'Truck' : 'Car';
      const model = isCamioneta ? pick(CAMIONETA_MODELS) : pick(AUTO_MODELS);
      const isEV = Math.random() < 0.12;
      const energyLabel = isEV ? 'Battery' : 'Fuel';
      const statusRoll = Math.random();
      const status = statusRoll < 0.45 ? 'available' : statusRoll < 0.85 ? 'rented' : 'maintenance';
      let fuelPct;
      if (status === 'maintenance') fuelPct = Math.round(rand(5, 40));
      else if (status === 'rented') fuelPct = Math.round(rand(20, 90));
      else fuelPct = Math.round(rand(40, 100));

      const alerts = [];
      if (status === 'maintenance') {
        const n = Math.random() < 0.5 ? 2 : 1;
        const shuffled = [...ALERT_POOL].sort(() => Math.random() - 0.5);
        for (let a = 0; a < n; a++) alerts.push(shuffled[a]);
      } else if (Math.random() < 0.15) {
        alerts.push(pick(ALERT_POOL));
      }
      if (fuelPct < 15 && !alerts.find(a => a.title.includes('Critical') || a.title.includes('Low battery'))) {
        alerts.push(isEV ? ALERT_POOL[5] : ALERT_POOL[4]);
      }

      const baseKm = rand(5000, 90000);
      const telemetry = [];
      let km = baseKm;
      let fuel = fuelPct;
      for (let d = 13; d >= 0; d--) {
        km += rand(20, 380);
        fuel = Math.max(5, Math.min(100, fuel + (Math.random() < 0.25 ? rand(15, 40) : -rand(2, 9))));
        const speed = status === 'maintenance' && Math.random() < 0.5 ? 0 : rand(0, 105);
        telemetry.push({ day: d, km: Math.round(km), speed: Math.round(speed), fuel: Math.round(fuel) });
      }

      const events = [];
      if (Math.random() < 0.35) {
        const n = Math.floor(rand(1, 4));
        for (let e = 0; e < n; e++) {
          events.push({
            type: pick(['Harsh braking', 'Speeding']),
            location: pick(EVENT_LOCATIONS),
            time: Math.floor(rand(1, 7)) + ' day' + (Math.random() < 0.5 ? '' : 's') + ' ago',
            sentToClient: Math.random() < 0.6,
          });
        }
      }

      const gpsActive = status === 'maintenance' ? Math.random() > 0.22 : Math.random() > 0.06;

      fleet.push({
        id: id++, plate: makePlate(), model, type, city: city.name, cityLat: city.lat, cityLng: city.lng,
        status, energyLabel, fuelPct, isEV, alerts, telemetry, events, gpsActive,
      });
    }
  });
  return fleet;
}
