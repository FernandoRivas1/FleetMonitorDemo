const TAB_DEFS = [
  { key: 'mapa', label: 'Map', desktopLabel: 'Fleet Map' },
  { key: 'overview', label: 'Overview', desktopLabel: 'Overview' },
  { key: 'detalle', label: 'Detail', desktopLabel: 'Vehicle Detail' },
  { key: 'asistente', label: 'Chat', desktopLabel: 'Assistant' },
];

export default function Header({ theme, isMobile, activeTab, onTabChange, fleetCount, themeMode, onToggleTheme }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '28px',
        padding: isMobile ? '0 14px' : '0 28px', height: '64px', background: 'var(--surface)',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <div
          style={{
            width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
            fontWeight: 800, fontSize: '16px',
          }}
        >
          F
        </div>
        {!isMobile && (
          <div style={{ fontWeight: 800, fontSize: '17px', letterSpacing: '-0.01em' }}>Fleet Monitor Demo</div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '4px', flex: 1, overflowX: 'auto' }}>
        {TAB_DEFS.map(tab => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              style={{
                border: 'none', background: active ? 'var(--accent-soft)' : 'transparent',
                color: active ? 'var(--accent-strong)' : 'var(--muted)', fontFamily: 'Manrope,sans-serif',
                fontWeight: 600, fontSize: '14px', padding: '10px 16px', borderRadius: '8px',
                cursor: 'pointer', transition: 'background 0.15s', whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {isMobile ? tab.label : tab.desktopLabel}
            </button>
          );
        })}
      </div>

      {!isMobile && (
        <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
          {fleetCount} vehicles · 8 cities
        </div>
      )}

      <button
        onClick={onToggleTheme}
        style={{
          background: 'var(--fill)', border: '1px solid var(--border)', color: 'var(--text)',
          fontFamily: 'Manrope,sans-serif', fontWeight: 600, fontSize: '12.5px', padding: '8px 14px',
          borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
        }}
      >
        {themeMode === 'dark' ? 'Light mode' : 'Dark mode'}
      </button>
    </div>
  );
}
