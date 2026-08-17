import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { CITIES, STATUS_COLORS } from '../data.js';
import { LIGHT_TILES, DARK_TILES } from '../theme.js';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'rented', label: 'Rented' },
  { value: 'maintenance', label: 'Maintenance' },
];

function buildVehicleIcon(gpsActive, dotColor, surfaceColor) {
  if (gpsActive) {
    return L.divIcon({
      className: '',
      html: `<div style="width:16px;height:16px;border-radius:50%;background:${dotColor};border:2px solid ${surfaceColor};box-shadow:0 1px 4px rgba(20,30,40,0.4)"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
  }
  return L.divIcon({
    className: '',
    html:
      '<div style="display:flex;flex-direction:column;align-items:center;gap:2px">' +
      `<div style="width:14px;height:14px;border-radius:50%;background:#d9534f;border:2px solid ${surfaceColor};box-shadow:0 0 0 3px rgba(217,83,79,0.35)"></div>` +
      '<div style="background:#d9534f;color:#fff;font-family:Manrope,sans-serif;font-weight:700;font-size:10px;padding:2px 6px;border-radius:4px;white-space:nowrap">Not transmitting</div></div>',
    iconSize: [110, 40],
    iconAnchor: [55, 8],
  });
}

function buildPopupHtml(v, sc, dotColor, theme, gpsActive, notified) {
  const gpsHtml = gpsActive
    ? ''
    : `<div style="margin-top:8px;padding-top:8px;border-top:1px solid ${theme.dangerBorder}">` +
      `<div style="color:${theme.danger};font-weight:700;font-size:12px;margin-bottom:4px">GPS not transmitting</div>` +
      `<div style="color:${theme.muted};font-size:11.5px">${notified ? 'Driver notified automatically.' : 'Driver will be notified on the next simulation cycle.'}</div></div>`;

  return (
    `<div style="font-family:Manrope,sans-serif;min-width:190px;color:${theme.text}">` +
    `<div style="font-weight:800;font-size:14px;margin-bottom:2px">${v.plate}</div>` +
    `<div style="font-size:12px;color:${theme.muted};margin-bottom:8px">${v.model}</div>` +
    `<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span>Status</span><strong style="color:${dotColor}">${sc.label}</strong></div>` +
    `<div style="display:flex;justify-content:space-between;font-size:12px"><span>Energy</span><strong>${v.current.fuel_battery_level.toFixed(0)}%</strong></div>` +
    gpsHtml +
    `<button class="detail-btn" data-vid="${v.id}" style="width:100%;margin-top:8px;background:${theme.fill};color:${theme.text};border:none;border-radius:6px;padding:7px;font-family:Manrope,sans-serif;font-weight:700;font-size:12px;cursor:pointer">View detail</button>` +
    '</div>'
  );
}

export default function MapView({ fleet, theme, themeMode, notifications, onViewDetail, isMobile }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersLayerRef = useRef(null);
  const markersByVehicleRef = useRef(new Map()); // vehicleId -> L.Marker, reused across redraws so open popups survive data refreshes
  const tileLayerRef = useRef(null);
  const chileBoundsRef = useRef(null);
  const themeMounted = useRef(false);

  const [mapStatusFilter, setMapStatusFilter] = useState('all');
  const [expandedCity, setExpandedCity] = useState(null);
  const [pinPositions, setPinPositions] = useState({});

  // Popup buttons are wired once via Leaflet's `popupopen` event, so they read
  // through this ref to always see the latest props/state instead of a stale closure.
  const latest = useRef({});
  latest.current = { fleet, theme, themeMode, notifications, onViewDetail, mapStatusFilter, expandedCity };

  function recomputePins() {
    const map = mapRef.current;
    if (!map) return;
    const size = map.getSize();
    const margin = 36;
    const buffer = 60; // cities just off-screen still count as visible
    // Cities scrolled well outside the viewport aren't rendered at all (like a real map),
    // instead of being clamped onto the edge — clamping caused cascading order bugs.
    const pts = CITIES.map(c => {
      const p = map.latLngToContainerPoint([c.lat, c.lng]);
      return { name: c.name, lat: c.lat, x: p.x, y: p.y };
    })
      .filter(p => p.x >= -buffer && p.x <= size.x + buffer && p.y >= -buffer && p.y <= size.y + buffer)
      .sort((a, b) => b.lat - a.lat); // north to south, monotonic with screen position
    const MIN_GAP = 50;
    pts.forEach(p => {
      p.y = Math.max(margin, Math.min(size.y - margin, p.y));
      p.x = Math.max(margin, Math.min(size.x - margin, p.x));
    });
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].y - pts[i - 1].y < MIN_GAP) pts[i].y = pts[i - 1].y + MIN_GAP;
    }
    const positions = {};
    pts.forEach(p => {
      positions[p.name] = { leftPct: (p.x / size.x) * 100, topPct: (p.y / size.y) * 100 };
    });
    setPinPositions(prev => {
      const changed =
        Object.keys(positions).length !== Object.keys(prev).length ||
        Object.keys(positions).some(
          k => !prev[k] || Math.abs(prev[k].leftPct - positions[k].leftPct) > 0.05 || Math.abs(prev[k].topPct - positions[k].topPct) > 0.05
        );
      return changed ? positions : prev;
    });
  }

  function wireDetailButton(node) {
    if (!node) return;
    const detailBtn = node.querySelector('.detail-btn');
    if (detailBtn) {
      const vid = Number(detailBtn.getAttribute('data-vid'));
      detailBtn.onclick = () => latest.current.onViewDetail(vid);
    }
  }

  // Updates markers in place (setLatLng/setIcon/setPopupContent) instead of
  // clearing and rebuilding the layer on every data refresh — clearLayers()
  // destroys the DOM node for any currently-open popup, so a background
  // simulate/poll tick would silently close whatever the user had open.
  function updateMarkers() {
    const markersLayer = markersLayerRef.current;
    if (!markersLayer) return;
    const registry = markersByVehicleRef.current;
    const { fleet, theme, themeMode, mapStatusFilter, expandedCity, notifications } = latest.current;

    if (!expandedCity) {
      // collapsed cluster view is a CSS overlay (clusterPins), not Leaflet markers
      registry.forEach(marker => markersLayer.removeLayer(marker));
      registry.clear();
      return;
    }

    const matches = v => mapStatusFilter === 'all' || v.status === mapStatusFilter;
    const visible = fleet.filter(v => v.base_city === expandedCity && matches(v) && v.current);
    const visibleIds = new Set(visible.map(v => v.id));

    for (const [id, marker] of registry) {
      if (!visibleIds.has(id)) {
        markersLayer.removeLayer(marker);
        registry.delete(id);
      }
    }

    visible.forEach(v => {
      const sc = STATUS_COLORS[v.status];
      const dotColor = themeMode === 'dark' ? sc.darkColor : sc.color;
      const gpsActive = v.current.gps_active;
      const icon = buildVehicleIcon(gpsActive, dotColor, theme.surface);
      const notified = notifications.some(n => n.vehicle_id === v.id && n.type === 'gps_offline');
      const popupHtml = buildPopupHtml(v, sc, dotColor, theme, gpsActive, notified);

      const existing = registry.get(v.id);
      if (existing) {
        existing.setLatLng([v.current.lat, v.current.lng]);
        existing.setIcon(icon);
        existing.setPopupContent(popupHtml);
        // setPopupContent() doesn't re-fire 'popupopen', so an already-open
        // popup needs its button re-wired against the fresh DOM it just got.
        if (existing.isPopupOpen()) wireDetailButton(existing.getPopup()._contentNode);
      } else {
        const marker = L.marker([v.current.lat, v.current.lng], { icon }).addTo(markersLayer);
        marker.bindPopup(popupHtml);
        registry.set(v.id, marker);
      }
    });
  }

  // Mount the Leaflet map once. It stays alive for the lifetime of the app —
  // this screen is only ever hidden via CSS, never unmounted, so the map/marker
  // state (and any open popup) survives switching tabs.
  useEffect(() => {
    const map = L.map(containerRef.current, { zoomControl: false, zoomSnap: 0.5, preferCanvas: true });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    const tiles = latest.current.themeMode === 'dark' ? DARK_TILES : LIGHT_TILES;
    tileLayerRef.current = L.tileLayer(tiles.url, { attribution: tiles.attribution, maxZoom: 18 }).addTo(map);
    map.on('tileerror', () => {});
    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    chileBoundsRef.current = L.latLngBounds(CITIES.map(c => [c.lat, c.lng]));

    map.on('moveend zoomend', recomputePins);
    map.on('popupopen', e => wireDetailButton(e.popup._contentNode));

    const rafId = requestAnimationFrame(() => {
      map.invalidateSize();
      map.fitBounds(chileBoundsRef.current, { padding: [40, 40] });
      updateMarkers();
      recomputePins();
    });

    return () => {
      // Guards against React StrictMode's dev-only double-invoke: without this,
      // the first pass's rAF can still fire after `map.remove()` below has torn
      // the map down, crashing Leaflet on a since-removed pane.
      cancelAnimationFrame(rafId);
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
      markersByVehicleRef.current.clear();
      tileLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fit and re-pin whenever the container's size changes — covers window
  // resizes and the tab becoming visible again (display:none -> block).
  useEffect(() => {
    if (!containerRef.current) return undefined;
    const ro = new ResizeObserver(() => {
      if (!mapRef.current) return;
      mapRef.current.invalidateSize();
      recomputePins();
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap the tile layer and redraw markers when the theme flips (skip on mount,
  // since the mount effect already picked the right tiles).
  useEffect(() => {
    if (!themeMounted.current) {
      themeMounted.current = true;
      return;
    }
    const map = mapRef.current;
    if (!map) return;
    updateMarkers();
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    const tiles = themeMode === 'dark' ? DARK_TILES : LIGHT_TILES;
    tileLayerRef.current = L.tileLayer(tiles.url, { attribution: tiles.attribution, maxZoom: 18 }).addTo(map);
    tileLayerRef.current.bringToBack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeMode]);

  // Redraw markers when the status filter, expanded city, or fleet/notifications data changes.
  useEffect(() => {
    updateMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapStatusFilter, expandedCity, fleet, notifications]);

  function expandCity(city) {
    setExpandedCity(city.name);
    mapRef.current?.flyTo([city.lat, city.lng], 11);
  }

  function collapseCity() {
    setExpandedCity(null);
    if (chileBoundsRef.current) mapRef.current?.flyToBounds(chileBoundsRef.current, { padding: [40, 40] });
  }

  const legendItems = useMemo(
    () => [
      { color: themeMode === 'dark' ? STATUS_COLORS.available.darkColor : STATUS_COLORS.available.color, label: 'Available' },
      { color: themeMode === 'dark' ? STATUS_COLORS.rented.darkColor : STATUS_COLORS.rented.color, label: 'Rented' },
      { color: themeMode === 'dark' ? STATUS_COLORS.maintenance.darkColor : STATUS_COLORS.maintenance.color, label: 'In maintenance' },
    ],
    [themeMode]
  );

  const clusterPins = useMemo(() => {
    if (expandedCity) return [];
    return CITIES.filter(city => pinPositions[city.name])
      .map(city => {
        const vehicles = fleet.filter(v => v.base_city === city.name && (mapStatusFilter === 'all' || v.status === mapStatusFilter));
        const pos = pinPositions[city.name];
        return { city: city.name, count: vehicles.length, top: pos.topPct + '%', left: pos.leftPct + '%' };
      })
      .filter(p => p.count > 0);
  }, [fleet, mapStatusFilter, pinPositions, expandedCity]);

  const totalFiltered = expandedCity ? fleet.filter(v => v.base_city === expandedCity).length : fleet.length;
  const locationLabel = expandedCity ? `${expandedCity} · ${totalFiltered} vehicles` : `Chile · ${fleet.length} vehicles across 8 cities`;

  return (
    <>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      <div
        style={{
          position: 'absolute', top: '16px', left: '16px', background: 'var(--surface)',
          borderRadius: '12px', boxShadow: '0 4px 20px var(--shadow)',
          padding: isMobile ? '10px 12px' : '14px 16px', zIndex: 1000,
          minWidth: isMobile ? '160px' : '200px',
        }}
      >
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>
          Vehicle status
        </div>
        {legendItems.map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontSize: '13px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.color }} />
            <div>{item.label}</div>
          </div>
        ))}
        <div style={{ height: '1px', background: 'var(--border)', margin: '10px 0' }} />
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginBottom: '6px' }}>Filter by status</div>
        <select
          value={mapStatusFilter}
          onChange={e => setMapStatusFilter(e.target.value)}
          style={{
            width: '100%', padding: '7px 8px', borderRadius: '7px', border: '1px solid var(--border-strong)',
            fontFamily: 'Manrope,sans-serif', fontSize: '13px', background: 'var(--surface)', color: 'var(--text)',
          }}
        >
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {!expandedCity &&
        clusterPins.map(pin => (
          <button
            key={pin.city}
            onClick={() => expandCity(CITIES.find(c => c.name === pin.city))}
            style={{
              position: 'absolute', top: pin.top, left: pin.left, transform: 'translate(-50%,-50%)',
              zIndex: 900, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}
          >
            <div
              style={{
                background: 'var(--accent)', color: '#fff', border: '2px solid var(--surface)',
                boxShadow: '0 2px 8px var(--shadow)', borderRadius: '50%', width: '26px', height: '26px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Manrope,sans-serif',
                fontWeight: 800, fontSize: '11px',
              }}
            >
              {pin.count}
            </div>
            <div
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px',
                padding: '1px 6px', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: '10px',
                color: 'var(--text)', whiteSpace: 'nowrap', boxShadow: '0 1px 4px var(--shadow)',
              }}
            >
              {pin.city}
            </div>
          </button>
        ))}

      {expandedCity && (
        <div style={{ position: 'absolute', top: isMobile ? '150px' : '16px', left: isMobile ? '16px' : '236px', zIndex: 1000 }}>
          <button
            onClick={collapseCity}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border-strong)', boxShadow: '0 4px 14px var(--shadow)',
              borderRadius: '10px', padding: '10px 16px', fontFamily: 'Manrope,sans-serif', fontWeight: 600,
              fontSize: '13px', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            ← Back to Chile
          </button>
        </div>
      )}

      <div
        style={{
          position: 'absolute', bottom: '16px', left: '16px', background: 'var(--surface)',
          borderRadius: '10px', boxShadow: '0 4px 20px var(--shadow)', padding: '10px 14px',
          zIndex: 1000, fontSize: '13px', fontWeight: 600, color: 'var(--text)',
        }}
      >
        {locationLabel}
      </div>
    </>
  );
}
