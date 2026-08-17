export default function Toast({ visible, text }) {
  if (!visible) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
        background: '#1b2430', color: '#fff', padding: '12px 22px', borderRadius: '10px',
        fontSize: '13.5px', fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 2000,
        maxWidth: '90vw', textAlign: 'center',
      }}
    >
      {text}
    </div>
  );
}
