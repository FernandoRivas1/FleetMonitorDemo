import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from './components/Header.jsx';
import MapView from './components/MapView.jsx';
import Overview from './components/Overview.jsx';
import VehicleDetail from './components/VehicleDetail.jsx';
import Assistant from './components/Assistant.jsx';
import Toast from './components/Toast.jsx';
import { api, API_URL } from './api.js';
import { LIGHT_THEME, DARK_THEME, themeVars } from './theme.js';
import { useIsMobile } from './hooks/useIsMobile.js';

const CARD_DENSITY = 'comfortable';
const SHOW_ASSISTANT_SUGGESTIONS = true;

// Keeps the demo "alive" without requiring the visitor to click anything —
// a fresh simulate cycle every 20s, plus one shortly after load so the
// notification feed isn't empty on first paint.
const AUTO_SIMULATE_INTERVAL_MS = 20000;
const INITIAL_SIMULATE_DELAY_MS = 2500;

export default function App() {
  const [fleet, setFleet] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [simulating, setSimulating] = useState(false);

  const [activeTab, setActiveTab] = useState('mapa');
  const [themeMode, setThemeMode] = useState('light');
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [toast, setToast] = useState({ visible: false, text: '' });
  const isMobile = useIsMobile();

  const theme = themeMode === 'dark' ? DARK_THEME : LIGHT_THEME;

  const refreshAll = useCallback(async () => {
    const [vehicles, alertsData, notificationsData] = await Promise.all([
      api.getVehicles(),
      api.getAlerts(),
      api.getNotifications(200),
    ]);
    setFleet(vehicles);
    setAlerts(alertsData);
    setNotifications(notificationsData);
    setSelectedVehicleId(prev => prev ?? vehicles[0]?.id ?? null);
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshAll();
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshAll]);

  function showToast(text) {
    setToast({ visible: true, text });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 2500);
  }

  const runningRef = useRef(false);
  const handleSimulate = useCallback(
    async ({ silent } = {}) => {
      if (runningRef.current) return;
      runningRef.current = true;
      if (!silent) setSimulating(true);
      try {
        const result = await api.simulate();
        await refreshAll();
        if (!silent && result.notifications_created.length > 0) {
          showToast(`Simulation advanced to ${result.simulated_date} — ${result.notifications_created.length} new notification(s).`);
        }
      } catch (e) {
        setError(e.message);
      } finally {
        runningRef.current = false;
        if (!silent) setSimulating(false);
      }
    },
    [refreshAll]
  );

  useEffect(() => {
    if (loading) return undefined;
    const initial = setTimeout(() => handleSimulate({ silent: true }), INITIAL_SIMULATE_DELAY_MS);
    const interval = setInterval(() => handleSimulate({ silent: true }), AUTO_SIMULATE_INTERVAL_MS);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [loading, handleSimulate]);

  function goToDetail(vehicleId) {
    setSelectedVehicleId(vehicleId);
    setActiveTab('detalle');
  }

  function exportReport() {
    showToast('Report exported (simulated)');
  }

  const selectedVehicle = useMemo(
    () => fleet.find(v => v.id === selectedVehicleId) || fleet[0] || null,
    [fleet, selectedVehicleId]
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100%', background: '#f6f7f9', color: '#64707d', fontFamily: 'Manrope,sans-serif', fontSize: '14px' }}>
        Loading fleet data…
      </div>
    );
  }

  if (error && fleet.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100%', background: '#f6f7f9', color: '#1b2430', fontFamily: 'Manrope,sans-serif', padding: '24px', textAlign: 'center' }}>
        <div style={{ fontWeight: 800, fontSize: '17px' }}>Can't reach the backend</div>
        <div style={{ fontSize: '13.5px', color: '#64707d', maxWidth: '440px' }}>
          Tried <code>{API_URL}</code> and got: {error}. Make sure the FleetMonitor Demo backend is running (see backend/README or the root README).
        </div>
        <button
          onClick={() => {
            setLoading(true);
            refreshAll()
              .catch(e => setError(e.message))
              .finally(() => setLoading(false));
          }}
          style={{ background: '#4c9dcf', border: 'none', color: '#fff', fontWeight: 700, fontSize: '13.5px', padding: '10px 20px', borderRadius: '9px', cursor: 'pointer', fontFamily: 'Manrope,sans-serif' }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', height: '100vh', width: '100%',
        background: 'var(--bg-page)', color: 'var(--text)', fontFamily: 'Manrope,sans-serif',
        overflow: 'hidden', ...themeVars(theme),
      }}
    >
      <Header
        theme={theme}
        isMobile={isMobile}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        fleetCount={fleet.length}
        themeMode={themeMode}
        onToggleTheme={() => setThemeMode(m => (m === 'dark' ? 'light' : 'dark'))}
        onSimulate={() => handleSimulate()}
        simulating={simulating}
      />

      <div data-screen="map" style={{ display: activeTab === 'mapa' ? 'block' : 'none', flex: 1, position: 'relative', overflow: 'hidden' }}>
        <MapView
          fleet={fleet}
          theme={theme}
          themeMode={themeMode}
          notifications={notifications}
          onViewDetail={goToDetail}
          isMobile={isMobile}
        />
      </div>

      <div data-screen="overview" style={{ display: activeTab === 'overview' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
        <Overview
          fleet={fleet}
          theme={theme}
          alerts={alerts}
          notifications={notifications}
          onSelectVehicle={goToDetail}
          onExport={exportReport}
          isMobile={isMobile}
          cardDensity={CARD_DENSITY}
        />
      </div>

      <div
        data-screen="detail"
        style={{ display: activeTab === 'detalle' ? 'block' : 'none', flex: 1, overflowY: 'auto', padding: `24px ${isMobile ? '16px' : '28px'}` }}
      >
        {selectedVehicle && (
          <VehicleDetail
            vehicle={selectedVehicle}
            theme={theme}
            alerts={alerts.filter(a => a.vehicle_id === selectedVehicle.id)}
            notifications={notifications.filter(n => n.vehicle_id === selectedVehicle.id)}
            onBack={() => setActiveTab('overview')}
            isMobile={isMobile}
          />
        )}
      </div>

      <div
        data-screen="assistant"
        style={{ display: activeTab === 'asistente' ? 'flex' : 'none', flex: 1, justifyContent: 'center', padding: isMobile ? '14px' : '24px 28px', overflow: 'hidden', minHeight: 0 }}
      >
        <Assistant theme={theme} isMobile={isMobile} showSuggestions={SHOW_ASSISTANT_SUGGESTIONS} />
      </div>

      <Toast visible={toast.visible} text={toast.text} />
    </div>
  );
}
