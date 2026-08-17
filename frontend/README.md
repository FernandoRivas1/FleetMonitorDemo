# Fleet Monitor Demo — Frontend

The React + Vite frontend for FleetMonitor Demo. See the [root README](../README.md)
for the full project overview, architecture, and deployment instructions.

A fleet-management dashboard: a live map, a filterable vehicle overview, a
per-vehicle telemetry/alerts/notifications detail view, and a chat assistant.
All data comes from the [backend](../backend) over HTTP — this app has no
fleet data of its own, so the backend must be running for it to show anything.

## Run it

```bash
npm install
cp .env.example .env   # set VITE_API_URL if the backend isn't on localhost:8000
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
```

## Structure

- `src/api.js` — fetch client for the backend (`/vehicles`, `/simulate`, `/assistant/ask`, ...)
- `src/data.js` — shared display constants (city coordinates for the map, status colors, a number formatter)
- `src/theme.js` — light/dark theme tokens and map tile providers
- `src/App.jsx` — top-level state: fetches fleet/alerts/notifications, polls `POST /simulate` on an interval, active tab, theme, selected vehicle, toasts
- `src/components/` — `Header`, `MapView` (Leaflet), `Overview`, `VehicleDetail`, `Assistant`, `Toast`

All four screens (Map / Overview / Vehicle Detail / Assistant) stay mounted at
all times and are toggled with CSS `display`, so the Leaflet map instance and
each screen's local state (filters, chat history, chart selection) survive
switching tabs.

The app auto-advances the backend's simulated clock every 20 seconds (and on
demand via the **Simulate** button in the header) so notifications and alerts
keep appearing without requiring interaction.
