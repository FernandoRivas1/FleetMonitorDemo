# Fleet Monitor Demo

A demo fleet-management dashboard for a rental fleet across Chile: a live map,
a filterable vehicle overview, a per-vehicle telemetry/alerts detail view, and
a small canned-response chat assistant. Implemented from the "Fleet Dashboard"
design spec as a standalone React + Vite app.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
```

## Structure

- `src/data.js` — mock fleet generator (cities, vehicles, telemetry, alerts, events)
- `src/theme.js` — light/dark theme tokens and map tile providers
- `src/assistant.js` — canned-response logic for the chat assistant
- `src/App.jsx` — top-level state (active tab, theme, selected vehicle, toasts)
- `src/components/` — `Header`, `MapView` (Leaflet), `Overview`, `VehicleDetail`, `Assistant`, `Toast`

All four screens (Map / Overview / Vehicle Detail / Assistant) stay mounted at
all times and are toggled with CSS `display`, so the Leaflet map instance and
each screen's local state (filters, chat history, chart selection) survive
switching tabs.

All data is randomly generated client-side on load — there's no backend.
