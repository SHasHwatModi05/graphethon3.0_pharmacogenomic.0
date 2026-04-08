// pages/Login.jsx — Industry-level split-screen login
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ROLES = [
  { id: 'doctor',  label: 'Doctor',    icon: '👨‍⚕️', color: 'var(--doctor-color)',  bg: 'rgba(6,182,212,0.12)',   border: 'rgba(6,182,212,0.35)'   },
  { id: 'nurse',   label: 'Nurse',     icon: '👩‍⚕️', color: 'var(--nurse-color)',   bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.35)'  },
  { id: 'patient', label: 'Patient',   icon: '🧬',   color: 'var(--patient-color)', bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.35)'  },
  { id: 'admin',   label: 'Admin',     icon: '🔧',   color: 'var(--admin-color)',   bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)'  },
];

const DEMO_CREDS = {
  doctor:  { username: 'dr_smith',      password: 'doctor123' },
  nurse:   { username: 'nurse_jones',   password: 'nurse123' },
  patient: { username: 'patient_alice', password: 'patient123' },
  admin:   { username: 'admin',         password: 'admin123' },
};

const FEATURES = [
  { icon: '🛡️', bg: 'rgba(6,182,212,0.15)',  title: 'CPIC-Backed Confidence Scoring', desc: 'Every result scored against CPIC, PharmGKB, DPWG, FDA & EMA guidelines' },
  { icon: '🧬', bg: 'rgba(139,92,246,0.15)', title: 'Real-Time VCF Genomic Analysis', desc: 'Upload VCF files and get pharmacogenomic risk analysis in seconds' },
  { icon: '🔗', bg: 'rgba(16,185,129,0.15)', title: 'Blockchain Audit Trail',          desc: 'Every clinical action is hashed and tamper-proof for compliance' },
  { icon: '💊', bg: 'rgba(245,158,11,0.15)', title: 'Drug Interaction Warnings',       desc: 'Cross-gene DDI detection before prescribing any medication' },
  { icon: '👥', bg: 'rgba(59,130,246,0.15)', title: 'Multi-Role Clinical Platform',    desc: 'Doctor · Nurse · Patient · Admin — each with tailored workflows' },
];

const TRUST_BADGES = ['CPIC', 'PharmGKB', 'DPWG', 'FDA', 'EMA', 'HL7 FHIR', 'HIPAA'];

// Floating particles
function Particles() {
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    size: Math.random() * 6 + 3,
    left: Math.random() * 100,
    top: Math.random() * 100,
    duration: Math.random() * 6 + 5,
    delay: Math.random() * 4,
    opacity: Math.random() * 0.4 + 0.1,
  }));
  return (
    <>
      {particles.map(p => (
        <div
          key={p.id}
          className="login-particle"
          style={{
            width: p.size, height: p.size,
            left: `${p.left}%`, top: `${p.top}%`,
            opacity: p.opacity,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            background: p.id % 3 === 0 ? 'rgba(6,182,212,0.6)' : p.id % 3 === 1 ? 'rgba(139,92,246,0.5)' : 'rgba(59,130,246,0.4)',
          }}
        />
      ))}
    </>
  );
}

// Animated DNA strand visual
function DNAVisual() {
  return (
    <svg width="80" height="200" viewBox="0 0 80 200" style={{ margin: '20px auto', display: 'block', opacity: 0.7 }}>
      {/* Left strand */}
      <path d="M 20 10 Q 60 30 20 50 Q 60 70 20 90 Q 60 110 20 130 Q 60 150 20 170 Q 60 190 20 210"
        fill="none" stroke="rgba(6,182,212,0.8)" strokeWidth="2.5" strokeLinecap="round"
        style={{ animation: 'none' }}
      />
      {/* Right strand */}
      <path d="M 60 10 Q 20 30 60 50 Q 20 70 60 90 Q 20 110 60 130 Q 20 150 60 170 Q 20 190 60 210"
        fill="none" stroke="rgba(139,92,246,0.8)" strokeWidth="2.5" strokeLinecap="round"
      />
      {/* Rungs */}
      {[25, 55, 85, 115, 145, 175].map((y, i) => (
        <line key={i} x1="20" y1={y} x2="60" y2={y}
          stroke={i % 2 === 0 ? 'rgba(6,182,212,0.5)' : 'rgba(139,92,246,0.5)'}
          strokeWidth="1.5" strokeLinecap="round"
        />
      ))}
      {/* Glow dots */}
      {[10, 50, 90, 130, 170].map((y, i) => (
        <circle key={i} cx={i % 2 === 0 ? 20 : 60} cy={y} r="4"
          fill={i % 2 === 0 ? 'rgba(6,182,212,0.9)' : 'rgba(139,92,246,0.9)'}
          style={{ filter: 'drop-shadow(0 0 4px currentColor)' }}
        />
      ))}
    </svg>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState('doctor');
  const [form, setForm] = useState({ username: 'dr_smith', password: 'doctor123' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [demoFlash, setDemoFlash] = useState(false);

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setError('');
    const demo = DEMO_CREDS[role];
    setForm({ username: demo.username, password: demo.password });
    setDemoFlash(true);
    setTimeout(() => setDemoFlash(false), 1200);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await login(form.username, form.password);
      navigate(`/${user.role}`);
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectedRoleObj = ROLES.find(r => r.id === selectedRole);

  return (
    <div className="login-page-split">
      {/* ── Left panel — branding & features ── */}
      <div className="login-left-panel">
        <Particles />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8, zIndex: 1, position: 'relative' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, boxShadow: '0 0 30px rgba(6,182,212,0.4)',
          }}>🧬</div>
          <div>
            <div className="login-brand-title" style={{ marginBottom: 0, fontSize: 28 }}>PharmaGuard</div>
            <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.6)', fontWeight: 500, letterSpacing: '0.04em' }}>PGx Clinical Platform v3.0</div>
          </div>
        </div>

        <DNAVisual />

        {/* Feature list */}
        <div className="login-feature-list">
          {FEATURES.map((f, i) => (
            <div key={i} className="login-feature-item" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="login-feature-icon" style={{ background: f.bg }}>{f.icon}</div>
              <div>
                <div style={{ color: 'rgba(241,245,249,0.95)', fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{f.title}</div>
                <div style={{ color: 'rgba(148,163,184,0.7)', fontSize: 12 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Trust strip */}
        <div className="login-trust-strip">
          {TRUST_BADGES.map((b, i) => (
            <React.Fragment key={b}>
              <span className="login-trust-item">{b}</span>
              {i < TRUST_BADGES.length - 1 && <span className="login-trust-sep" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Right panel — login form ── */}
      <div className="login-right-panel">
        <div style={{ width: '100%', maxWidth: 380, animation: 'fadeInScale 0.5s ease both' }}>
          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 4 }}>
              Welcome back 👋
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Sign in to access the clinical platform
            </div>
          </div>

          {/* Role selector */}
          <div style={{ marginBottom: 20 }}>
            <div className="form-label" style={{ marginBottom: 10 }}>Choose your role</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {ROLES.map(role => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => handleRoleSelect(role.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: `1.5px solid ${selectedRole === role.id ? role.border : 'var(--border-default)'}`,
                    background: selectedRole === role.id ? role.bg : 'transparent',
                    color: selectedRole === role.id ? role.color : 'var(--text-secondary)',
                    fontSize: 13, fontWeight: selectedRole === role.id ? 700 : 500,
                    fontFamily: 'var(--font-sans)', cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: selectedRole === role.id ? `0 0 12px ${role.border}` : 'none',
                  }}
                >
                  <span style={{ fontSize: 16 }}>{role.icon}</span>
                  {role.label}
                  {selectedRole === role.id && (
                    <span style={{ marginLeft: 'auto', fontSize: 14 }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Demo credential flash */}
          {demoFlash && (
            <div style={{
              background: `${selectedRoleObj?.bg}`,
              border: `1px solid ${selectedRoleObj?.border}`,
              borderRadius: 'var(--radius-md)', padding: '9px 14px',
              fontSize: 12, color: selectedRoleObj?.color, marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 8,
              animation: 'fadeInScale 0.25s ease both',
            }}>
              <span>⚡</span>
              <span>Demo credentials loaded for <strong>{selectedRole}</strong></span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <div className="input-with-icon">
                <span className="input-icon">👤</span>
                <input
                  className="form-input"
                  type="text"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="Enter username"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <div className="input-with-icon">
                  <span className="input-icon">🔒</span>
                  <input
                    className="form-input"
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    required
                    style={{ paddingRight: 40 }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)',
                  }}
                >{showPass ? '🙈' : '👁️'}</button>
              </div>
            </div>

            {error && (
              <div style={{
                background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)',
                borderRadius: 'var(--radius-md)', padding: '10px 14px',
                fontSize: 13, color: 'var(--accent-rose)', marginBottom: 16,
                display: 'flex', alignItems: 'center', gap: 8, animation: 'fadeInScale 0.2s ease both',
              }}>
                <span>⚠️</span> {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{
                width: '100%', justifyContent: 'center', padding: '13px',
                fontSize: 14, letterSpacing: '0.02em',
                background: loading ? 'var(--bg-elevated)' : `linear-gradient(135deg, ${selectedRoleObj?.color || 'var(--accent-cyan)'}, var(--accent-blue))`,
                boxShadow: loading ? 'none' : `0 0 20px ${selectedRoleObj?.color || 'var(--accent-cyan)'}44`,
                transition: 'all 0.3s ease',
              }}
              disabled={loading}
            >
              {loading
                ? <><div className="spinner" /> Authenticating...</>
                : <>Sign in as {selectedRoleObj?.label} {selectedRoleObj?.icon}</>
              }
            </button>
          </form>

          {/* Quick access grid */}
          <div style={{ marginTop: 28, paddingTop: 22, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Quick Demo Access
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {ROLES.map(role => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => handleRoleSelect(role.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
                    borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)',
                    background: 'transparent', color: 'var(--text-muted)',
                    fontSize: 12, fontFamily: 'var(--font-sans)', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = role.bg; e.currentTarget.style.borderColor = role.border; e.currentTarget.style.color = role.color; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  {role.icon} <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{DEMO_CREDS[role.id].username}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 20, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
            🔒 HIPAA Compliant · 🔗 Blockchain Audited · 🛡️ End-to-End Encrypted
          </div>

          <p style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', marginTop: 12, opacity: 0.6 }}>
            © 2026 Team Garudaa · PharmaGuard PGx v3.0 · All rights reserved
          </p>
        </div>
      </div>
    </div>
  );
}
