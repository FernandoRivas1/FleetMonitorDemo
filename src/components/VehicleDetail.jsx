import { useMemo, useState } from 'react';
import { fmt } from '../data.js';

const METRIC_LABEL = { km: 'Mileage', speed: 'Speed', fuel: 'Fuel' };
const METRICS = ['km', 'speed', 'fuel'];

export default function VehicleDetail({ vehicle, theme, notified, onNotify, onBack, isMobile }) {
  const [chartMetric, setChartMetric] = useState('km');
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const statusColors = {
    available: { color: theme.success, bg: theme.successSoft, label: 'Available' },
    rented: { color: theme.accentStrong, bg: theme.accentSoft, label: 'Rented' },
    maintenance: { color: theme.danger, bg: theme.dangerSoft, label: 'Maintenance' },
  }[vehicle.status];

  const chart = useMemo(() => {
    const data = vehicle.telemetry.map(t => t[chartMetric]);
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const w = 600, h = 200, pad = 30;
    const points = data.map((val, i) => ({
      x: pad + i * ((w - 2 * pad) / (data.length - 1)),
      y: h - pad - ((val - min) / range) * (h - 2 * pad),
    }));
    const pathD = 'M' + points.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' L');
    const metricUnit = chartMetric === 'km' ? ' km' : chartMetric === 'speed' ? ' km/h' : '%';
    return { data, min, max, points, pathD, metricUnit };
  }, [vehicle, chartMetric]);

  let tooltip = null;
  if (hoveredIdx != null && chart.points[hoveredIdx]) {
    const p = chart.points[hoveredIdx];
    const label = METRIC_LABEL[chartMetric] + ': ' + fmt(chart.data[hoveredIdx]) + chart.metricUnit;
    const boxW = Math.max(46, label.length * 6.5 + 16);
    const boxX = Math.min(Math.max(p.x - boxW / 2, 2), 598 - boxW);
    const boxY = Math.max(2, p.y - 30);
    tooltip = { x: p.x, boxY, leftPct: (boxX / 600) * 100, widthPct: (boxW / 600) * 100, label };
  }

  const detailGridColumns = isMobile ? '1fr' : '1fr 1fr';

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

      {!vehicle.gpsActive && (
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
              This vehicle's device is not sending its real-time location.
            </div>
          </div>
          <button
            onClick={() => {
              if (!notified) onNotify(vehicle);
            }}
            style={{
              background: notified ? 'var(--disabled-bg)' : 'var(--danger)', color: notified ? 'var(--muted)' : '#fff',
              border: 'none', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: '13px',
              padding: '10px 18px', borderRadius: '8px', cursor: notified ? 'default' : 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {notified ? 'Notification sent' : 'Notify client'}
          </button>
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
            {vehicle.model} · {vehicle.city} · {vehicle.type}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11.5px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              {vehicle.energyLabel}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800 }}>{vehicle.fuelPct}%</div>
          </div>
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
              const active = m === chartMetric;
              return (
                <button
                  key={m}
                  onClick={() => setChartMetric(m)}
                  style={{
                    border: 'none', background: active ? 'var(--surface)' : 'transparent', color: active ? 'var(--text)' : 'var(--muted)',
                    fontFamily: 'Manrope,sans-serif', fontWeight: 600, fontSize: '12.5px', padding: '7px 14px', borderRadius: '6px', cursor: 'pointer',
                  }}
                >
                  {METRIC_LABEL[m]}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ position: 'relative' }}>
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
                position: 'absolute', left: `${tooltip.leftPct}%`, top: `${tooltip.boxY}px`, width: `${tooltip.widthPct}%`,
                minWidth: '46px', background: '#1b2430', color: '#fff', fontSize: '12px', fontWeight: 700,
                fontFamily: 'Manrope,sans-serif', padding: '4px 8px', borderRadius: '5px', textAlign: 'center',
                pointerEvents: 'none', whiteSpace: 'nowrap', boxSizing: 'border-box',
              }}
            >
              {tooltip.label}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>
          <div>Min: {fmt(chart.min)}{chart.metricUnit}</div>
          <div>Max: {fmt(chart.max)}{chart.metricUnit}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: detailGridColumns, gap: '18px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px 22px' }}>
          <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '14px' }}>Maintenance alerts</div>
          {vehicle.alerts.length === 0 && <div style={{ fontSize: '13px', color: 'var(--muted)' }}>No active alerts.</div>}
          {vehicle.alerts.map((a, i) => (
            <div
              key={i}
              style={{
                borderLeft: '3px solid var(--danger-strong)', background: 'var(--danger-soft)', borderRadius: '0 8px 8px 0',
                padding: '10px 12px', marginBottom: '10px',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--danger)', marginBottom: '2px' }}>{a.title}</div>
              <div style={{ fontSize: '12.5px', color: 'var(--danger-muted)' }}>{a.detail}</div>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px 22px' }}>
          <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '14px' }}>Driving events</div>
          {vehicle.events.length === 0 && <div style={{ fontSize: '13px', color: 'var(--muted)' }}>No events recorded.</div>}
          {vehicle.events.map((e, i) => (
            <div
              key={i}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0',
                borderBottom: '1px solid var(--fill-soft)', gap: '10px', flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>{e.type}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{e.location} · {e.time}</div>
              </div>
              <div
                style={{
                  fontSize: '11px', fontWeight: 700, padding: '5px 9px', borderRadius: '6px', whiteSpace: 'nowrap',
                  background: e.sentToClient ? theme.successSoft : theme.warningSoft,
                  color: e.sentToClient ? theme.successStrong : theme.warning,
                }}
              >
                {e.sentToClient ? 'Sent to client' : 'Pending'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
