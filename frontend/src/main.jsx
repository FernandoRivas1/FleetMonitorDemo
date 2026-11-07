import React from 'react';
import ReactDOM from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './index.css';
import App from './App.jsx';
import BackendWakeGate from './components/BackendWakeGate.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BackendWakeGate>
      <App />
    </BackendWakeGate>
  </React.StrictMode>
);
