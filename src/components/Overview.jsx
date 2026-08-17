import { useMemo, useState } from 'react';
import { CITIES } from '../data.js';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'rented', label: 'Rented' },
  { value: 'maintenance', label: 'Maintenance' },
];
const CITY_OPTIONS = ['All', ...CITIES.map(c => c.name)];

export default function Overview({
  fleet, theme, notifiedVehicles, onNotify, onSelectVehicle, onExport, isMobile, highlightAlertsOnly, cardDensity,
}) {
  const [searchPlate, setSearchPlate] = useState('');
  const [filterCity, setFilterCity] = useState('All');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterNoGpsOnly, setFilterNoGpsOnly] = useState(false);

  const noGpsFleet = useMemo(() => fleet.filter(v => !v.gpsActive), [fleet]);

  const filteredVehicles = useMemo(() => {
    let filtered = fleet.filter(
      v =>
        (filterCity === 'All' || v.city === filterCity) &&
        (filterStatus === 'all' || v.status === filterStatus) &&
        (searchPlate === '' || v.plate.toLowerCase().includes(searchPlate.toLowerCase()))
    );
    if (highlightAlertsOnly) filtered = filtered.filter(v => v.alerts.length > 0);
    if (filterNoGpsOnly) filtered = filtered.filter(v => !v.gpsActive);
    return filtered;
  }, [fleet, filterCity, filterStatus, searchPlate, highlightAlertsOnly, filterNoGpsOnly]);

  const cardGridColumns = isMobile
    ? '1fr'
    : cardDensity === 'compact'
      ? 'repeat(auto-fill, minmax(220px, 1fr))'
      : 'repeat(auto-fill, minmax(270px, 1fr))';
  const pagePadX = isMobile ? '16px' : '28px';

  return (
    <>
      {noGpsFleet.length > 0 && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: `12px ${pagePadX}`,
            background: 'var(--danger-soft)', borderBottom: '1px solid var(--danger-border)', flexShrink: 0,
          }}
        >
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger)', flexShrink: 0 }} />
          <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--danger)', flex: 1 }}>
            {noGpsFleet.length}{' '}
            {noGpsFleet.length === 1 ? 'vehicle is not transmitting its GPS location' : 'vehicles are not transmitting their GPS location'}
          </div>
          <button
            onClick={() => setFilterNoGpsOnly(v => !v)}
            style={{
              background: 'var(--danger)', border: 'none', color: '#fff', fontFamily: 'Manrope,sans-serif',
              fontWeight: 700, fontSize: '12.5px', padding: '8px 14px', borderRadius: '7px', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {filterNoGpsOnly ? 'Showing GPS issues only' : 'Show GPS issues only'}
          </button>
        </div>
      )}

      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '12px', padding: `18px ${pagePadX}`,
          borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0,
          flexWrap: isMobile ? 'wrap' : 'nowrap',
        }}
      >
        <input
          value={searchPlate}
          onChange={e => setSearchPlate(e.target.value)}
          placeholder="Search by plate..."
          aria-label="Search by plate"
          style={{
            padding: '9px 14px', borderRadius: '8px', border: '1px solid var(--border-strong)',
            fontFamily: 'Manrope,sans-serif', fontSize: '13px', width: isMobile ? '100%' : '220px',
            color: 'var(--text)', background: 'var(--surface)',
          }}
        />
        <select
          value={filterCity}
          onChange={e => setFilterCity(e.target.value)}
          style={{
            padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-strong)',
            fontFamily: 'Manrope,sans-serif', fontSize: '13px', background: 'var(--surface)', color: 'var(--text)',
          }}
        >
          {CITY_OPTIONS.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{
            padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-strong)',
            fontFamily: 'Manrope,sans-serif', fontSize: '13px', background: 'var(--surface)', color: 'var(--text)',
          }}
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>
          {filteredVehicles.length} of {fleet.length} vehicles
        </div>
        <button
          onClick={onExport}
          style={{
            background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: '8px',
            padding: '9px 16px', fontFamily: 'Manrope,sans-serif', fontWeight: 600, fontSize: '13px',
            color: 'var(--text)', cursor: 'pointer',
          }}
        >
          Export report
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: `22px ${pagePadX}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: cardGridColumns, gap: '14px' }}>
          {filteredVehicles.map(v => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              theme={theme}
              notified={!!notifiedVehicles[v.id]}
              onNotify={onNotify}
              onSelect={onSelectVehicle}
            />
          ))}
          {filteredVehicles.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '48px 0', color: 'var(--muted)', fontSize: '13.5px' }}>
              No vehicles match the selected filters.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function VehicleCard({ vehicle: v, theme, notified, onNotify, onSelect }) {
  const statusColors = {
    available: { color: theme.success, bg: theme.successSoft, label: 'Available' },
    rented: { color: theme.accentStrong, bg: theme.accentSoft, label: 'Rented' },
    maintenance: { color: theme.danger, bg: theme.dangerSoft, label: 'Maintenance' },
  }[v.status];
  const fuelBarColor = v.fuelPct < 20 ? theme.dangerStrong : theme.accent;

  return (
    <div
      className="vehicle-card"
      onClick={() => onSelect(v.id)}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '15px', letterSpacing: '0.01em' }}>{v.plate}</div>
          <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: '2px' }}>{v.model}</div>
        </div>
        <div style={{ background: statusColors.bg, color: statusColors.color, fontSize: '11px', fontWeight: 700, padding: '4px 9px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
          {statusColors.label}
        </div>
      </div>
      <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: '10px' }}>{v.city} · {v.type}</div>
      <div style={{ marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--muted)', marginBottom: '4px' }}>
          <span>{v.energyLabel}</span>
          <span>{v.fuelPct}%</span>
        </div>
        <div style={{ height: '6px', borderRadius: '3px', background: 'var(--fill-soft)', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: '3px', background: fuelBarColor, width: `${v.fuelPct}%` }} />
        </div>
      </div>
      {v.alerts.length > 0 && (
        <div
          style={{
            background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: '11.5px', fontWeight: 700,
            padding: '6px 9px', borderRadius: '7px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px',
          }}
        >
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--danger)', flexShrink: 0 }} />
          {v.alerts.length} {v.alerts.length === 1 ? 'active alert' : 'active alerts'}
        </div>
      )}
      {!v.gpsActive && (
        <div style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger-border)', borderRadius: '7px', padding: '8px 9px' }}>
          <div style={{ color: 'var(--danger)', fontSize: '11.5px', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--danger)', flexShrink: 0 }} />
            GPS not transmitting
          </div>
          <button
            onClick={e => {
              e.stopPropagation();
              if (!notified) onNotify(v);
            }}
            style={{
              width: '100%', background: notified ? 'var(--disabled-bg)' : 'var(--accent)', border: 'none',
              color: notified ? 'var(--muted)' : '#fff', fontFamily: 'Manrope,sans-serif', fontWeight: 700,
              fontSize: '11.5px', padding: '6px', borderRadius: '6px', cursor: notified ? 'default' : 'pointer',
            }}
          >
            {notified ? 'Notification sent' : 'Notify client'}
          </button>
        </div>
      )}
    </div>
  );
}
