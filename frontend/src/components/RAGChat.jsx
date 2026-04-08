// components/RAGChat.jsx — AI-powered clinical query assistant
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function RAGChat({ patientId = null, contextLabel = '' }) {
  const { authFetch } = useAuth();
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      content: `Hello! I'm the PharmaGuard AI assistant. ${contextLabel ? `I have access to ${contextLabel}'s medical data.` : 'Ask me anything about patient records, genomic analyses, or drug risks.'}`
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const SUGGESTED_QUERIES = [
    'What is the patient\'s current risk profile?',
    'List all active prescriptions',
    'What genomic variants were detected?',
    'Summarize recent vitals',
  ];

  const sendMessage = async (text = input) => {
    if (!text.trim() || loading) return;
    const query = text.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: query }]);
    setLoading(true);

    try {
      const res = await authFetch('/doctor/rag-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query, patient_id: patientId })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, {
          role: 'bot',
          content: data.answer,
          sources: data.sources?.length,
          method: data.method
        }]);
      } else {
        setMessages(prev => [...prev, { role: 'bot', content: '⚠️ Unable to retrieve answer. Please try again.' }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', content: '⚠️ Connection error. Is the backend running?' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '420px' }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%'
          }}>
            <div className={`rag-message ${msg.role}`}>
              {msg.content}
            </div>
            {msg.sources !== undefined && (
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px', paddingLeft: '4px' }}>
                🔍 {msg.sources} source{msg.sources !== 1 ? 's' : ''} retrieved · {msg.method}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="rag-message bot" style={{ alignSelf: 'flex-start', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div className="spinner" /> Analyzing records...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested queries */}
      {messages.length <= 1 && (
        <div style={{ padding: '0 12px 8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {SUGGESTED_QUERIES.map(q => (
            <button
              key={q}
              type="button"
              onClick={() => sendMessage(q)}
              style={{
                padding: '4px 10px', borderRadius: 'var(--radius-full)',
                background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)', fontSize: '11px', cursor: 'pointer',
                fontFamily: 'var(--font-sans)', transition: 'all 0.15s'
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input row */}
      <div style={{ display: 'flex', gap: '8px', padding: '12px', borderTop: '1px solid var(--border-subtle)' }}>
        <input
          className="form-input"
          style={{ flex: 1 }}
          placeholder="Ask about patient data, genomics, prescriptions..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          disabled={loading}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
        >
          Send
        </button>
      </div>
    </div>
  );
}
