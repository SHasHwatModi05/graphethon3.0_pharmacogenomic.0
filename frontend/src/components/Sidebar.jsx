// components/Sidebar.jsx — Premium industry-level navigation sidebar
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from './ThemeToggle';

const NAV_ITEMS = {
  doctor: [
    { section: 'Clinical', items: [
      { path: '/doctor',          icon: '🏠', label: 'Overview',      badge: null },
      { path: '/doctor/patients', icon: '👥', label: 'My Patients',   badge: null },
      { path: '/doctor/vcf',      icon: '🧬', label: 'VCF Analysis',  badge: null },
      { path: '/doctor/rag',      icon: '🤖', label: 'AI Assistant',  badge: null },
    ]},
    { section: 'Analytics', items: [
      { path: '/doctor/analytics', icon: '📊', label: 'Analytics',    badge: null },
      { path: '/doctor/dashboard', icon: '📉', label: 'R Dashboard',  badge: null },
    ]},
  ],
  nurse: [
    { section: 'Care', items: [
      { path: '/nurse',           icon: '🏠', label: 'Overview',       badge: null },
      { path: '/nurse/patients',  icon: '👥', label: 'Patients',       badge: null },
      { path: '/nurse/vitals',    icon: '💓', label: 'Log Vitals',     badge: null },
      { path: '/nurse/reports',   icon: '📋', label: 'Submit Report',  badge: null },
    ]},
  ],
  patient: [
    { section: 'My Health', items: [
      { path: '/patient',               icon: '🏠', label: 'My Overview',     badge: null },
      { path: '/patient/records',       icon: '📋', label: 'My Records',      badge: null },
      { path: '/patient/prescriptions', icon: '💊', label: 'Prescriptions',   badge: null },
      { path: '/patient/genomics',      icon: '🧬', label: 'Genomic Reports', badge: null },
      { path: '/patient/timeline',      icon: '⏱️', label: 'History',         badge: null },
    ]},
  ],
  admin: [
    { section: 'Administration', items: [
      { path: '/admin',            icon: '🏠', label: 'Dashboard',        badge: null },
      { path: '/admin/users',      icon: '👤', label: 'User Management',  badge: null },
      { path: '/admin/patients',   icon: '🏥', label: 'Patient Records',  badge: null },
      { path: '/admin/blockchain', icon: '🔗', label: 'Blockchain Audit', badge: null },
    ]},
  ],
};

const ROLE_ICONS = { doctor: '👨‍⚕️', nurse: '👩‍⚕️', patient: '🧬', admin: '🔧' };
const ROLE_COLORS = {
  doctor:  { color: 'var(--doctor-color)',  bg: 'rgba(6,182,212,0.15)',   border: 'rgba(6,182,212,0.3)'   },
  nurse:   { color: 'var(--nurse-color)',   bg: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.3)'  },
  patient: { color: 'var(--patient-color)', bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.3)'  },
  admin:   { color: 'var(--admin-color)',   bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.3)'  },
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [apiOnline, setApiOnline] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    // Check API health
    fetch('http://localhost:8000/health')
      .then(r => r.ok ? setApiOnline(true) : setApiOnline(false))
      .catch(() => setApiOnline(false));

    // Clock tick
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  if (!user) return null;

  const navItems = NAV_ITEMS[user.role] || [];
  const initials = user.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';
  const rc = ROLE_COLORS[user.role] || ROLE_COLORS.doctor;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Logo */}
      <div className="sidebar-logo" style={{ gap: 10 }}>
        <div className="sidebar-logo-icon" style={{ boxShadow: '0 0 16px rgba(6,182,212,0.35)' }}>🧬</div>
        <div className="sidebar-logo-text">
          <h1 style={{ fontSize: 14, fontWeight: 800 }}>PharmaGuard</h1>
          <p style={{ fontSize: 10 }}>PGx Platform v3.0</p>
        </div>
      </div>

      {/* Role badge */}
      <div
        className={`sidebar-role-badge ${user.role}`}
        style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', background: rc.bg, borderColor: rc.border, color: rc.color }}
      >
        {ROLE_ICONS[user.role]} {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
      </div>

      {/* Live clock */}
      <div style={{ padding: '4px 20px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'flex', justifyContent: 'space-between' }}>
          <span>{dateStr}</span>
          <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>{timeStr}</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav" style={{ flex: 1 }}>
        {navItems.map(section => (
          <div key={section.section}>
            <div className="sidebar-section-title">{section.section}</div>
            {section.items.map(item => {
              const isActive = location.pathname === item.path ||
                (item.path.length > 8 && location.pathname.startsWith(item.path));
              return (
                <div
                  key={item.path}
                  className={`sidebar-item ${isActive ? 'active' : ''}`}
                  onClick={() => navigate(item.path)}
                  style={isActive ? {
                    background: `${rc.bg}`,
                    borderColor: rc.border,
                    color: rc.color,
                  } : {}}
                >
                  <span className="sidebar-item-icon">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="sidebar-nav-badge">{item.badge}</span>
                  )}
                  {isActive && (
                    <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: rc.color, flexShrink: 0 }} />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer" style={{ gap: 10 }}>
        {/* API Status */}
        <div className="sidebar-status">
          <div className="sidebar-status-dot" style={{ background: apiOnline ? 'var(--accent-emerald)' : 'var(--accent-rose)' }} />
          <span>{apiOnline ? 'API Online' : 'API Offline'}</span>
          <span style={{ marginLeft: 'auto', fontSize: 9, opacity: 0.6 }}>FastAPI + SQLite</span>
        </div>

        {/* Theme toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <ThemeToggle />
        </div>

        {/* User card */}
        <div className="sidebar-user" style={{ gap: 8 }}>
          <div
            className={`sidebar-avatar ${user.role}`}
            style={{
              background: rc.bg, color: rc.color,
              border: `1px solid ${rc.border}`,
              fontWeight: 800,
            }}
          >
            {initials}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name" style={{ fontSize: 12 }}>{user.full_name}</div>
            <div className="sidebar-user-role" style={{ fontSize: 10 }}>
              {user.specialization || user.department || (user.role.charAt(0).toUpperCase() + user.role.slice(1))}
            </div>
          </div>
          <button
            className="logout-btn"
            onClick={handleLogout}
            title="Logout"
            style={{ fontSize: 16, padding: '2px 6px' }}
          >🚪</button>
        </div>

        {/* Version */}
        <div className="sidebar-version">v3.0.0 · © 2026 Team Garudaa</div>
      </div>
    </aside>
  );
}
