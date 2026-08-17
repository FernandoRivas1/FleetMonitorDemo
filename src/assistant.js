import { CITIES } from './data.js';

// Very small canned-response "assistant" — keyword matches against the fleet
// data, ported as-is from the design spec.
export function buildAssistantReply(fleet, text) {
  const q = text.toLowerCase();

  if (q.includes('mainten')) {
    const list = fleet.filter(v => v.status === 'maintenance' || v.alerts.length > 0);
    const names = list.slice(0, 6).map(v => v.plate + ' (' + v.city + ')').join(', ');
    return 'There are ' + list.length + ' vehicles that need maintenance attention this week: ' + names + (list.length > 6 ? '…' : '') + '.';
  }
  if (q.includes('fuel') || q.includes('gas') || q.includes('battery') || q.includes('charge')) {
    const low = fleet.filter(v => v.fuelPct < 20);
    const names = low.slice(0, 6).map(v => v.plate + ' (' + v.fuelPct + '%)').join(', ');
    return 'There are ' + low.length + ' vehicles with a low level (<20%): ' + (names || 'none currently') + '.';
  }
  const cityHit = CITIES.find(c => q.includes(c.name.toLowerCase()));
  if (cityHit) {
    const inCity = fleet.filter(v => v.city === cityHit.name);
    const disp = inCity.filter(v => v.status === 'available').length;
    const arr = inCity.filter(v => v.status === 'rented').length;
    const mant = inCity.filter(v => v.status === 'maintenance').length;
    return 'In ' + cityHit.name + ' there are ' + inCity.length + ' vehicles: ' + disp + ' available, ' + arr + ' rented, and ' + mant + ' in maintenance.';
  }
  if (q.includes('alert')) {
    const withAlerts = fleet.filter(v => v.alerts.length > 0);
    return 'Currently ' + withAlerts.length + ' vehicles have active alerts out of a total of ' + fleet.length + '.';
  }
  if (q.includes('speed') || q.includes('brak') || q.includes('driv')) {
    const pending = fleet.reduce((acc, v) => acc + v.events.filter(e => !e.sentToClient).length, 0);
    return 'Risky driving events were recorded on several vehicles. ' + pending + ' client notifications are still pending.';
  }
  const disp = fleet.filter(v => v.status === 'available').length;
  const arr = fleet.filter(v => v.status === 'rented').length;
  const mant = fleet.filter(v => v.status === 'maintenance').length;
  return 'Fleet summary: ' + fleet.length + ' total vehicles — ' + disp + ' available, ' + arr + ' rented, ' + mant + ' in maintenance, across 8 cities.';
}
