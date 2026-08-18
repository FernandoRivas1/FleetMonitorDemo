import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { fmt } from '../data.js';

const CHART_VIEWBOX_WIDTH = 600;

const BASE_METRICS = [
  { key: 'mileage', label: 'Mileage', unit: ' km' },
  { key: 'speed_kmh', label: 'Speed', unit: ' km/h' },
];

const NOTIFICATION_LABELS = {
  hard_brake: 'Hard braking',
  overspeed: 'Overspeed',
  maintenance_due_soon: 'Maintenance due soon',
  maintenance_overdue: 'Maintenance overdue',
  gps_offline: 'GPS offline',
};

export default function VehicleDetail({ vehicle, theme, alerts, notifications, onBack, isMobile }) {
  const [chartMetric, setChartMetric] = useState('mileage');
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [readings, setReadings] = useState(null);
  const [telemetryError, setTelemetryError] = useState(null);
  const [chartWidth, setChartWidth] = useState(CHART_VIEWBOX_WIDTH);
  const chartWrapRef = useRef(null);
  const energyLabel = vehicle.is_ev ? 'Battery' : 'Fuel';
  const METRICS = useMemo(
    () => [...BASE_METRICS, { key: 'fuel_battery_level', label: energyLabel, unit: '%' }],
    [energyLabel]
  );

  useEffect(() => {
    let cancelled = false;
    setReadings(null);
    setTelemetryError(null);
    api
      .getVehicleTelemetry(vehicle.id)
      .then(data => {
        if (!cancelled) setReadings(data.readings);
      })
      .catch(e => {
        if (!cancelled) setTelemetryError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicle.id]);

  // The SVG's viewBox is a fixed 600-unit-wide virtual space, but its
  // rendered width is responsive (100%) — on a narrow phone that can be well
  // under 600px. The tooltip box needs to be sized/positioned in real pixels
  // (not a percentage of 600) or it clips off-screen; track the actual
  // rendered width to convert between the two.
  useEffect(() => {
    const el = chartWrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect?.width;
      if (width) setChartWidth(width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const statusColors = {
    available: { color: theme.success, bg: theme.successSoft, label: 'Available' },
    rented: { color: theme.accentStrong, bg: theme.accentSoft, label: 'Rented' },
    maintenance: { color: theme.danger, bg: theme.dangerSoft, label: 'Maintenance' },
  }[vehicle.status];

  const metricDef = METRICS.find(m => m.key === chartMetric);

  const chart = useMemo(() => {
    if (!readings || readings.length === 0) return null;
    const data = readings.map(r => r[chartMetric]);
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const w = 600, h = 200, pad = 30;
    const points = data.map((val, i) => ({
      x: pad + i * ((w - 2 * pad) / Math.max(data.length - 1, 1)),
      y: h - pad - ((val - min) / range) * (h - 2 * pad),
    }));
    const pathD = 'M' + points.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' L');
    return { data, min, max, points, pathD };
  }, [readings, chartMetric]);

  let tooltip = null;
  if (chart && hoveredIdx != null && chart.points[hoveredIdx]) {
    const p = chart.points[hoveredIdx];
    const label = metricDef.label + ': ' + fmt(chart.data[hoveredIdx]) + metricDef.unit;
    // Font-size is fixed regardless of screen width, so the box must be
    // sized/clamped in real rendered pixels — not as a percentage of the
    // SVG's 600-unit virtual space, which shrinks on narrow/mobile screens
    // and would clip the label.
    const scale = chartWidth / CHART_VIEWBOX_WIDTH;
    const realX = p.x * scale;
    const boxW = Math.min(chartWidth - 4, Math.max(46, label.length * 6.5 + 16));
    const boxX = Math.min(Math.max(realX - boxW / 2, 2), chartWidth - boxW - 2);
    const boxY = Math.max(2, p.y - 30);
    tooltip = { x: p.x, boxY, leftPx: boxX, widthPx: boxW, label };
  }

  const detailGridColumns = isMobile ? '1fr' : '1fr 1fr';
  const gpsNotified = notifications.some(n => n.type === 'gps_offline');
  const hasNoGps = vehicle.current ? !vehicle.current.gps_active : false;
  const unresolvedAlerts = alerts.filter(a => !a.resolved);
  const sortedNotifications = [...notifications].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return (
    <>
      <button
        onClick={onBack}
        style={{
          background: 'none', border: 'none', color: 'var(--muted)', fontFamily: 'Manrope,sans-serif',
          fontWeight: 600, fontSize: '13px', cursor: 'pointer', padding: 0, marginBottom: '16px',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}
      >
        ← Back to Overview
      </button>

      {hasNoGps && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '14px', background: 'var(--danger-soft)',
            border: '1px solid var(--danger-border)', borderRadius: '12px', padding: '14px 18px',
            marginBottom: '16px', flexWrap: 'wrap',
          }}
        >
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--danger)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--danger)' }}>GPS not transmitting</div>
            <div style={{ fontSize: '12.5px', color: 'var(--danger-muted)', marginTop: '2px' }}>
              This vehicle's device is not sending its real-time location.{' '}
              {gpsNotified ? 'The assigned driver has been notified automatically.' : 'The assigned driver will be notified on the next simulation cycle.'}
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: '14px', padding: '22px 24px', marginBottom: '18px',
          flexWrap: 'wrap', gap: '14px',
        }}
      >
        <div>
          <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.01em' }}>{vehicle.plate}</div>
          <div style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '4px' }}>
            {vehicle.model} · {vehicle.base_city}
          </div>
          {vehicle.driver && (
            <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: '2px' }}>
              Driver: {vehicle.driver.name} · {vehicle.driver.phone}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          {vehicle.current && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11.5px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {energyLabel}
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800 }}>{vehicle.current.fuel_battery_level.toFixed(0)}%</div>
            </div>
          )}
          <div style={{ background: statusColors.bg, color: statusColors.color, fontWeight: 700, fontSize: '13px', padding: '8px 16px', borderRadius: '8px' }}>
            {statusColors.label}
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '22px 24px', marginBottom: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ fontWeight: 700, fontSize: '15px' }}>Telemetry (last 14 days)</div>
          <div style={{ display: 'flex', gap: '4px', background: 'var(--fill)', borderRadius: '8px', padding: '3px' }}>
            {METRICS.map(m => {
              const active = m.key === chartMetric;
              return (
                <button
                  key={m.key}
                  onClick={() => setChartMetric(m.key)}
                  style={{
                    border: 'none', background: active ? 'var(--surface)' : 'transparent', color: active ? 'var(--text)' : 'var(--muted)',
                    fontFamily: 'Manrope,sans-serif', fontWeight: 600, fontSize: '12.5px', padding: '7px 14px', borderRadius: '6px', cursor: 'pointer',
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {telemetryError && <div style={{ fontSize: '13px', color: 'var(--danger)' }}>Could not load telemetry: {telemetryError}</div>}
        {!telemetryError && !chart && <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Loading telemetry…</div>}
        {chart && (
          <>
            <div ref={chartWrapRef} style={{ position: 'relative' }}>
              <svg viewBox="0 0 600 200" style={{ width: '100%', height: '200px', display: 'block' }}>
                <line x1="30" y1="10" x2="30" y2="170" stroke={theme.border} strokeWidth="1" />
                <line x1="30" y1="170" x2="580" y2="170" stroke={theme.border} strokeWidth="1" />
                <path d={chart.pathD} fill="none" stroke="#4c9dcf" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                {chart.points.map((pt, i) => (
                  <g key={i}>
                    <circle cx={pt.x} cy={pt.y} r={i === hoveredIdx ? 4.5 : 2.5} fill={i === hoveredIdx ? '#2f7ba8' : '#4c9dcf'} />
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={15}
                      fill="transparent"
                      onMouseEnter={() => setHoveredIdx(i)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      style={{ cursor: 'pointer' }}
                    />
                  </g>
                ))}
                <text x="30" y="188" fontSize="11" fill={theme.muted} fontFamily="Manrope">14 days ago</text>
                <text x="540" y="188" fontSize="11" fill={theme.muted} fontFamily="Manrope">Today</text>
                {tooltip && <line x1={tooltip.x} y1="10" x2={tooltip.x} y2="170" stroke={theme.border} strokeWidth="1" strokeDasharray="3,3" />}
              </svg>
              {tooltip && (
                <div
                  style={{
                    position: 'absolute', left: `${tooltip.leftPx}px`, top: `${tooltip.boxY}px`, width: `${tooltip.widthPx}px`,
                    background: '#1b2430', color: '#fff', fontSize: '12px', fontWeight: 700,
                    fontFamily: 'Manrope,sans-serif', padding: '4px 8px', borderRadius: '5px', textAlign: 'center',
                    pointerEvents: 'none', whiteSpace: 'nowrap', boxSizing: 'border-box', overflow: 'hidden',
                  }}
                >
                  {tooltip.label}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>
              <div>Min: {fmt(chart.min)}{metricDef.unit}</div>
              <div>Max: {fmt(chart.max)}{metricDef.unit}</div>
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: detailGridColumns, gap: '18px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px 22px' }}>
          <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '14px' }}>Maintenance alerts</div>
          {unresolvedAlerts.length === 0 && <div style={{ fontSize: '13px', color: 'var(--muted)' }}>No active alerts.</div>}
          {unresolvedAlerts.map(a => (
            <div
              key={a.id}
              style={{
                borderLeft: '3px solid var(--danger-strong)', background: 'var(--danger-soft)', borderRadius: '0 8px 8px 0',
                padding: '10px 12px', marginBottom: '10px',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--danger)', marginBottom: '2px' }}>{a.type}</div>
              <div style={{ fontSize: '12.5px', color: 'var(--danger-muted)' }}>Due {a.due_date} · {a.severity} severity</div>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px 22px' }}>
          <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '14px' }}>Notifications</div>
          {sortedNotifications.length === 0 && <div style={{ fontSize: '13px', color: 'var(--muted)' }}>No notifications recorded.</div>}
          {sortedNotifications.map(n => (
            <div
              key={n.id}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0',
                borderBottom: '1px solid var(--fill-soft)', gap: '10px', flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>{n.message}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{new Date(n.timestamp).toLocaleString()}</div>
              </div>
              <div
                style={{
                  fontSize: '11px', fontWeight: 700, padding: '5px 9px', borderRadius: '6px', whiteSpace: 'nowrap',
                  background: theme.fill, color: theme.text,
                }}
              >
                {NOTIFICATION_LABELS[n.type] || n.type}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
