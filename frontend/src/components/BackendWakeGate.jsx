import { useEffect, useState } from 'react';
import { API_URL } from '../api.js';
import { LIGHT_THEME as t } from '../theme.js';

// The backend runs on Render's free tier, which sleeps when idle, so the
// first request after a quiet spell can take 30-60s. This gate pings
// /health before rendering the dashboard and, only if that's slow,
// explains what is happening. A warm backend answers well inside
// QUIET_PERIOD_MS, so visitors normally never see this screen.
const QUIET_PERIOD_MS = 1500;
const PING_TIMEOUT_MS = 10000;
const RETRY_DELAY_MS = 2500;
const GIVE_UP_AFTER_MS = 120000;
const EXPECTED_WAKE_SECONDS = 50;

async function pingHealth(signal) {
  try {
    const res = await fetch(`${API_URL}/health`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(PING_TIMEOUT_MS)]),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default function BackendWakeGate({ children }) {
  const [state, setState] = useState('checking'); // checking | waking | ready | failed
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const startedAt = Date.now();
    const quietTimer = setTimeout(() => setState(s => (s === 'checking' ? 'waking' : s)), QUIET_PERIOD_MS);
    const ticker = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);

    (async () => {
      while (!controller.signal.aborted) {
        if (await pingHealth(controller.signal)) {
          setState('ready');
          return;
        }
        if (Date.now() - startedAt > GIVE_UP_AFTER_MS) {
          setState('failed');
          return;
        }
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }
    })().finally(() => {
      clearTimeout(quietTimer);
      clearInterval(ticker);
    });

    return () => controller.abort();
  }, [attempt]);

  if (state === 'ready') return children;
  // Stay blank during the quiet period so a fast backend doesn't flash this screen.
  if (state === 'checking') return null;

  const progress = Math.min(elapsedSeconds / EXPECTED_WAKE_SECONDS, 0.95);

  return (
    <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px 16px', boxSizing: 'border-box', background: t.bgPage, fontFamily: 'Manrope,sans-serif' }}>
      <style>{'@keyframes wake-spin { to { transform: rotate(360deg) } }'}</style>
      <div style={{ width: '100%', maxWidth: '460px', padding: '36px 32px', boxSizing: 'border-box', borderRadius: '14px', background: t.surface, border: `1px solid ${t.border}`, boxShadow: `0 12px 32px ${t.shadow}`, textAlign: 'center' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.muted, marginBottom: '24px' }}>
          Fleet Monitor Demo
        </div>
        {state === 'waking' ? (
          <>
            <div aria-hidden="true" style={{ width: '36px', height: '36px', margin: '0 auto 20px', borderRadius: '50%', border: `3px solid ${t.fill}`, borderTopColor: t.accent, animation: 'wake-spin 0.9s linear infinite' }} />
            <h1 style={{ margin: '0 0 10px', fontSize: '22px', color: t.text }}>Waking up the server…</h1>
            <p style={{ margin: '0 0 22px', fontSize: '14px', lineHeight: 1.55, color: t.muted }}>
              This demo&apos;s backend runs on a free hosting tier that goes to sleep when nobody is using it. The first visit
              after a quiet period takes about a minute; after that, everything is instant.
            </p>
            <div aria-hidden="true" style={{ height: '6px', borderRadius: '999px', background: t.fill, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress * 100}%`, borderRadius: 'inherit', background: t.accent, transition: 'width 1s linear' }} />
            </div>
            <p style={{ margin: '10px 0 0', fontSize: '12px', color: t.muted }}>{elapsedSeconds}s elapsed</p>
          </>
        ) : (
          <>
            <h1 style={{ margin: '0 0 10px', fontSize: '22px', color: t.text }}>The server didn&apos;t wake up</h1>
            <p style={{ margin: '0 0 22px', fontSize: '14px', lineHeight: 1.55, color: t.muted }}>
              It&apos;s taking longer than usual to start. This is usually temporary; please try again in a moment.
            </p>
            <button
              type="button"
              onClick={() => {
                setElapsedSeconds(0);
                setState('waking');
                setAttempt(n => n + 1);
              }}
              style={{ padding: '10px 22px', border: 0, borderRadius: '8px', background: t.accentStrong, color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
