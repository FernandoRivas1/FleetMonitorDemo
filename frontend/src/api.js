// Thin fetch client for the FleetMonitor Demo backend. All fleet data is
// synthetic — see the root README.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function request(path, options) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // response wasn't JSON — keep statusText
    }
    throw new Error(`${res.status} ${detail}`);
  }
  return res.json();
}

export const api = {
  getVehicles: () => request('/vehicles'),
  getVehicleTelemetry: (vehicleId, limit = 14) => request(`/vehicles/${vehicleId}/telemetry?limit=${limit}`),
  getAlerts: () => request('/alerts'),
  getNotifications: (limit = 200) => request(`/notifications?limit=${limit}`),
  simulate: () => request('/simulate', { method: 'POST' }),
  askAssistant: (question) =>
    request('/assistant/ask', { method: 'POST', body: JSON.stringify({ question }) }),
};

export { API_URL };
