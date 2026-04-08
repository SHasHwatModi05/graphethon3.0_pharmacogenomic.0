// contexts/ToastContext.jsx — Global toast notification system
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id]);
    setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 320);
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type, leaving: false }]);
    timers.current[id] = setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const toast = {
    success: (msg, d) => addToast(msg, 'success', d),
    error: (msg, d) => addToast(msg, 'error', d || 6000),
    warning: (msg, d) => addToast(msg, 'warning', d),
    info: (msg, d) => addToast(msg, 'info', d),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }) {
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  const colors = {
    success: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', color: '#10b981', bar: '#10b981' },
    error:   { bg: 'rgba(244,63,94,0.12)',  border: 'rgba(244,63,94,0.35)',  color: '#f43f5e', bar: '#f43f5e' },
    warning: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', color: '#f59e0b', bar: '#f59e0b' },
    info:    { bg: 'rgba(6,182,212,0.12)',   border: 'rgba(6,182,212,0.35)',   color: '#06b6d4', bar: '#06b6d4' },
  };
  const c = colors[toast.type] || colors.info;

  return (
    <div
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 10,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minWidth: 280,
        maxWidth: 380,
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        backdropFilter: 'blur(12px)',
        animation: toast.leaving
          ? 'toastOut 0.3s ease forwards'
          : 'toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Icon circle */}
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: c.color + '22', color: c.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 900, fontSize: 13, flexShrink: 0,
        border: `1px solid ${c.color}44`,
      }}>
        {icons[toast.type]}
      </div>
      <div style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4, fontWeight: 500 }}>
        {toast.message}
      </div>
      <button
        onClick={onDismiss}
        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: '0 2px', lineHeight: 1 }}
      >×</button>
      {/* Progress bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, height: 2,
        background: c.bar, borderRadius: 2,
        animation: 'toastProgress 4s linear forwards',
      }} />
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
