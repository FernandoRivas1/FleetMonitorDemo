import { useEffect, useRef, useState } from 'react';
import { buildAssistantReply } from '../assistant.js';

const SUGGESTIONS = [
  'Which vehicles need maintenance this week?',
  'Which ones have low battery or fuel?',
  'How many vehicles are in Concepción?',
  'General fleet summary',
];

export default function Assistant({ fleet, theme, isMobile, showSuggestions }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hi, I'm the fleet assistant. Ask me about maintenance, fuel, alerts, or status by city." },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, isTyping]);

  function sendMessage(overrideText) {
    const text = (overrideText ?? input).trim();
    if (!text) return;
    setMessages(prev => [...prev, { role: 'user', text }]);
    setInput('');
    setIsTyping(true);
    setTimeout(() => {
      const reply = buildAssistantReply(fleet, text);
      setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
      setIsTyping(false);
    }, 700);
  }

  return (
    <div
      style={{
        width: '100%', maxWidth: isMobile ? '100%' : '640px', display: 'flex', flexDirection: 'column',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px',
        overflow: 'hidden', minHeight: 0,
      }}
    >
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '28px', height: '28px', borderRadius: '8px', background: 'var(--accent)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '13px',
          }}
        >
          A
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '14px' }}>Fleet assistant</div>
          <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>Ask questions about your fleet in plain language</div>
        </div>
      </div>

      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div
              style={{
                maxWidth: '78%', background: m.role === 'user' ? theme.accent : theme.fill,
                color: m.role === 'user' ? '#fff' : theme.text, padding: '10px 14px', borderRadius: '12px',
                fontSize: '13.5px', lineHeight: 1.5, whiteSpace: 'pre-line',
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ background: 'var(--fill)', color: 'var(--muted)', padding: '10px 14px', borderRadius: '12px', fontSize: '13px' }}>
              Typing...
            </div>
          </div>
        )}
      </div>

      {showSuggestions && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '0 20px 14px' }}>
          {SUGGESTIONS.map(label => (
            <button
              key={label}
              onClick={() => sendMessage(label)}
              style={{
                background: 'var(--fill)', border: 'none', borderRadius: '16px', padding: '7px 13px',
                fontFamily: 'Manrope,sans-serif', fontSize: '12.5px', color: 'var(--text)', cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') sendMessage();
          }}
          placeholder="Type your question..."
          aria-label="Type your question"
          style={{
            flex: 1, padding: '10px 14px', borderRadius: '9px', border: '1px solid var(--border-strong)',
            fontFamily: 'Manrope,sans-serif', fontSize: '13.5px', color: 'var(--text)', background: 'var(--surface)',
          }}
        />
        <button
          onClick={() => sendMessage()}
          style={{
            background: 'var(--accent)', border: 'none', color: '#fff', fontWeight: 700, fontSize: '13.5px',
            padding: '10px 20px', borderRadius: '9px', cursor: 'pointer', fontFamily: 'Manrope,sans-serif',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
