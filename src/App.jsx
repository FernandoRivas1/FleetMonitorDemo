import { useMemo, useState } from 'react';
import Header from './components/Header.jsx';
import MapView from './components/MapView.jsx';
import Overview from './components/Overview.jsx';
import VehicleDetail from './components/VehicleDetail.jsx';
import Assistant from './components/Assistant.jsx';
import Toast from './components/Toast.jsx';
import { generateFleet } from './data.js';
import { LIGHT_THEME, DARK_THEME, themeVars } from './theme.js';
import { useIsMobile } from './hooks/useIsMobile.js';

// The original design exposed these as editable component props; hardcoded
// here as the app's defaults since this is now the top-level page.
const HIGHLIGHT_ALERTS_ONLY = false;
const CARD_DENSITY = 'comfortable';
const SHOW_ASSISTANT_SUGGESTIONS = true;

export default function App() {
  const [fleet] = useState(() => generateFleet());
  const [activeTab, setActiveTab] = useState('mapa');
  const [themeMode, setThemeMode] = useState('light');
  const [selectedVehicleId, setSelectedVehicleId] = useState(() => fleet[0]?.id ?? null);
  const [notifiedVehicles, setNotifiedVehicles] = useState({});
  const [toast, setToast] = useState({ visible: false, text: '' });
  const isMobile = useIsMobile();

  const theme = themeMode === 'dark' ? DARK_THEME : LIGHT_THEME;

  function showToast(text) {
    setToast({ visible: true, text });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 2500);
  }

  function notifyClient(vehicle) {
    setNotifiedVehicles(prev => (prev[vehicle.id] ? prev : { ...prev, [vehicle.id]: true }));
    showToast('Notification sent to the client of ' + vehicle.plate + ' (GPS failure)');
  }

  function goToDetail(vehicleId) {
    setSelectedVehicleId(vehicleId);
    setActiveTab('detalle');
  }

  function exportReport() {
    showToast('Report exported (simulated)');
  }

  const selectedVehicle = useMemo(
    () => fleet.find(v => v.id === selectedVehicleId) || fleet[0],
    [fleet, selectedVehicleId]
  );

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
      />

      <div data-screen="map" style={{ display: activeTab === 'mapa' ? 'block' : 'none', flex: 1, position: 'relative', overflow: 'hidden' }}>
        <MapView
          fleet={fleet}
          theme={theme}
          themeMode={themeMode}
          notifiedVehicles={notifiedVehicles}
          onNotify={notifyClient}
          onViewDetail={goToDetail}
          isMobile={isMobile}
        />
      </div>

      <div data-screen="overview" style={{ display: activeTab === 'overview' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
        <Overview
          fleet={fleet}
          theme={theme}
          notifiedVehicles={notifiedVehicles}
          onNotify={notifyClient}
          onSelectVehicle={goToDetail}
          onExport={exportReport}
          isMobile={isMobile}
          highlightAlertsOnly={HIGHLIGHT_ALERTS_ONLY}
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
            notified={!!notifiedVehicles[selectedVehicle.id]}
            onNotify={notifyClient}
            onBack={() => setActiveTab('overview')}
            isMobile={isMobile}
          />
        )}
      </div>

      <div
        data-screen="assistant"
        style={{ display: activeTab === 'asistente' ? 'flex' : 'none', flex: 1, justifyContent: 'center', padding: isMobile ? '14px' : '24px 28px', overflow: 'hidden', minHeight: 0 }}
      >
        <Assistant fleet={fleet} theme={theme} isMobile={isMobile} showSuggestions={SHOW_ASSISTANT_SUGGESTIONS} />
      </div>

      <Toast visible={toast.visible} text={toast.text} />
    </div>
  );
}
