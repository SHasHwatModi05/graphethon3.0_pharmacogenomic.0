// pages/AdminDashboard.jsx — Database Administration Panel
import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// ── Admin Overview ────────────────────────────────────────────
function AdminOverview() {
  const { authFetch } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => { authFetch('/admin/stats').then(r => r.json()).then(setStats).catch(() => {}); }, []);

  const riskColors = { 'Safe': 'var(--risk-safe)', 'Adjust Dosage': 'var(--risk-adjust)', 'Toxic': 'var(--risk-toxic)', 'Ineffective': 'var(--risk-ineffective)', 'Unknown': 'var(--text-muted)' };

  return (
    <div className="animate-up">
      <div className="page-header">
        <h2 className="page-title">DBA Administration Dashboard 🔧</h2>
        <p className="page-subtitle">System overview · Database administration · Blockchain audit</p>
      </div>

      {stats && (
        <>
          <div className="stats-grid">
            <div className="stat-card cyan"><div className="stat-icon cyan">👥</div><div><div className="stat-value">{stats.total_users}</div><div className="stat-label">Total Users</div></div></div>
            <div className="stat-card blue"><div className="stat-icon blue">🏥</div><div><div className="stat-value">{stats.total_patients}</div><div className="stat-label">Patients</div></div></div>
            <div className="stat-card emerald"><div className="stat-icon emerald">📋</div><div><div className="stat-value">{stats.total_medical_records}</div><div className="stat-label">Medical Records</div></div></div>
            <div className="stat-card purple"><div className="stat-icon purple">🧬</div><div><div className="stat-value">{stats.total_vcf_analyses}</div><div className="stat-label">VCF Analyses</div></div></div>
            <div className="stat-card amber"><div className="stat-icon amber">💊</div><div><div className="stat-value">{stats.total_prescriptions}</div><div className="stat-label">Prescriptions</div></div></div>
            <div className="stat-card rose"><div className="stat-icon rose">🔗</div><div><div className="stat-value">{stats.blockchain_blocks}</div><div className="stat-label">Blockchain Blocks</div></div></div>
          </div>

          <div className="grid-2">
            {/* Users by role */}
            <div className="card">
              <div className="card-header"><span className="card-title">Users by Role</span></div>
              <div className="card-body">
                {Object.entries(stats.users_by_role).map(([role, count]) => {
                  const colors = { doctor: 'var(--doctor-color)', nurse: 'var(--nurse-color)', patient: 'var(--patient-color)', admin: 'var(--admin-color)' };
                  const icons = { doctor: '👨‍⚕️', nurse: '👩‍⚕️', patient: '🧬', admin: '🔧' };
                  return (
                    <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: 18 }}>{icons[role]}</span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, textTransform: 'capitalize' }}>{role}</span>
                      <div style={{ flex: 2, height: 8, background: 'var(--bg-elevated)', borderRadius: 4 }}>
                        <div style={{ height: '100%', borderRadius: 4, width: `${(count / stats.total_users) * 100}%`, background: colors[role], transition: 'width 0.5s' }} />
                      </div>
                      <span style={{ fontWeight: 700, color: colors[role], minWidth: 24, textAlign: 'right' }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Risk distribution */}
            {stats.risk_distribution && Object.keys(stats.risk_distribution).length > 0 && (
              <div className="card">
                <div className="card-header"><span className="card-title">Risk Distribution (All Analyses)</span></div>
                <div className="card-body">
                  {Object.entries(stats.risk_distribution).map(([risk, count]) => (
                    <div key={risk} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                      <span style={{ flex: 1, fontSize: 13, color: riskColors[risk] || 'var(--text-muted)' }}>{risk}</span>
                      <div style={{ flex: 2, height: 8, background: 'var(--bg-elevated)', borderRadius: 4 }}>
                        <div style={{ height: '100%', borderRadius: 4, width: `${(count / stats.total_vcf_analyses) * 100}%`, background: riskColors[risk] || 'var(--text-muted)' }} />
                      </div>
                      <span style={{ fontWeight: 700, minWidth: 24, textAlign: 'right' }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── User Management ───────────────────────────────────────────
function UserManagement() {
  const { authFetch } = useAuth();
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    setLoading(true);
    const url = filter ? `/admin/users?role=${filter}` : '/admin/users';
    authFetch(url).then(r => r.json()).then(setUsers).finally(() => setLoading(false));
  };

  useEffect(() => { loadUsers(); }, [filter]);

  const toggleActive = async (user) => {
    await authFetch(`/admin/users/${user.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !user.is_active }) });
    loadUsers();
  };

  const roleColors = { doctor: 'var(--doctor-color)', nurse: 'var(--nurse-color)', patient: 'var(--patient-color)', admin: 'var(--admin-color)' };
  const roleIcons = { doctor: '👨‍⚕️', nurse: '👩‍⚕️', patient: '🧬', admin: '🔧' };

  return (
    <div className="animate-up">
      <div className="page-header flex justify-between items-center">
        <div><h2 className="page-title">User Management</h2><p className="page-subtitle">Create, update, and deactivate system users</p></div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>+ New User</button>
      </div>
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', gap: 8 }}>
            {['', 'doctor', 'nurse', 'patient', 'admin'].map(r => (
              <button key={r} className={`btn btn-sm ${filter === r ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(r)}>{r ? `${roleIcons[r]} ${r}` : 'All'}</button>
            ))}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{users.length} users</span>
        </div>
        <div className="table-container">
          <table>
            <thead><tr><th>User</th><th>Role</th><th>Specialization</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr> :
                users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${roleColors[u.role]}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{roleIcons[u.role]}</div>
                        <div><div style={{ fontWeight: 600, fontSize: 13 }}>{u.full_name}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</div></div>
                      </div>
                    </td>
                    <td><span style={{ color: roleColors[u.role], fontWeight: 600, fontSize: 12, textTransform: 'capitalize' }}>{u.role}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.specialization || u.department || '—'}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: u.is_active ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: u.is_active ? 'var(--accent-emerald)' : 'var(--text-muted)', display: 'inline-block' }} />
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.created_at?.slice(0, 10)}</td>
                    <td>
                      <button className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-secondary'}`} onClick={() => toggleActive(u)}>
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {showCreateModal && <CreateUserModal onClose={() => setShowCreateModal(false)} onSave={() => { setShowCreateModal(false); loadUsers(); }} authFetch={authFetch} />}
    </div>
  );
}

// ── Patient Records (Admin view) ──────────────────────────────
function AdminPatientRecords() {
  const { authFetch } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch('/admin/all-records').then(r => r.json()).then(d => setRecords(d.records || [])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="animate-up">
      <div className="page-header"><h2 className="page-title">All Patient Records</h2><p className="page-subtitle">Complete database view of all patient histories</p></div>
      <div className="card">
        <div className="table-container">
          <table>
            <thead><tr><th>Patient</th><th>Code</th><th>Conditions</th><th>Latest Drug</th><th>Genomic Risk</th><th>Latest Rx</th><th>Vitals</th><th>Records</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr> :
                records.map(r => (
                  <tr key={r.patient_id}>
                    <td><div style={{ fontWeight: 600, fontSize: 13 }}>{r.full_name}</div></td>
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-cyan)' }}>{r.patient_code}</span></td>
                    <td style={{ fontSize: 12, maxWidth: 150, color: 'var(--text-muted)' }}>{r.chronic_conditions || '—'}</td>
                    <td style={{ fontWeight: 600, fontSize: 12 }}>{r.latest_drug || '—'}</td>
                    <td>
                      {r.latest_diagnosis ? (
                        <span className={`badge ${r.latest_diagnosis === 'Safe' ? 'badge-safe' : r.latest_diagnosis === 'Toxic' ? 'badge-toxic' : 'badge-adjust'}`}>{r.latest_diagnosis}</span>
                      ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ fontSize: 12 }}>{r.latest_prescription || '—'}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.latest_hr ? `♥${r.latest_hr} · ${r.latest_bp}` : '—'}</td>
                    <td>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        📋{r.total_records} 💊{r.total_prescriptions} 🧬{r.total_analyses}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!loading && records.length === 0 && <div className="empty-state"><div className="empty-icon">🏥</div><div className="empty-title">No patients found</div></div>}
        </div>
      </div>
    </div>
  );
}

// ── Blockchain Audit ──────────────────────────────────────────
function BlockchainAudit() {
  const { authFetch } = useAuth();
  const [auditData, setAuditData] = useState(null);
  const [verifyResult, setVerifyResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    authFetch('/admin/blockchain/audit').then(r => r.json()).then(setAuditData).finally(() => setLoading(false));
  }, []);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const r = await authFetch('/admin/blockchain/verify');
      setVerifyResult(await r.json());
    } finally { setVerifying(false); }
  };

  const actionColors = { CREATE: 'var(--accent-emerald)', UPDATE: 'var(--accent-amber)', DELETE: 'var(--accent-rose)', VIEW: 'var(--accent-cyan)' };

  return (
    <div className="animate-up">
      <div className="page-header flex justify-between items-center">
        <div><h2 className="page-title">🔗 Blockchain Audit Log</h2><p className="page-subtitle">SHA-256 tamper-evident hash chain · {auditData?.total_blocks || 0} blocks</p></div>
        <button className="btn btn-primary" onClick={handleVerify} disabled={verifying}>
          {verifying ? <><div className="spinner" /> Verifying...</> : '🔍 Verify Chain'}
        </button>
      </div>

      {verifyResult && (
        <div style={{
          padding: '14px 20px', borderRadius: 'var(--radius-md)', marginBottom: 16,
          background: verifyResult.verification_result.valid ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
          border: `1px solid ${verifyResult.verification_result.valid ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}`,
          color: verifyResult.verification_result.valid ? 'var(--accent-emerald)' : 'var(--accent-rose)',
          fontSize: 13
        }}>
          {verifyResult.verification_result.valid ? '✅ Blockchain integrity verified — no tampering detected' : `⚠️ Tampering detected in ${verifyResult.verification_result.tampered_blocks.length} block(s)`}
          · {verifyResult.verification_result.total_blocks} blocks checked · Verified at {verifyResult.verified_at?.slice(0, 19).replace('T', ' ')}
        </div>
      )}

      <div className="card">
        <div className="table-container">
          <table>
            <thead><tr><th>#</th><th>Timestamp</th><th>Action</th><th>Document</th><th>Actor</th><th>Role</th><th>Data Hash</th><th>Block Hash</th><th>Valid</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr> :
                (auditData?.audit_trail || []).map(b => (
                  <tr key={b.block_index}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>#{b.block_index}</td>
                    <td style={{ fontSize: 11 }}>{b.timestamp?.slice(0, 16).replace('T', ' ')}</td>
                    <td><span style={{ fontWeight: 600, fontSize: 12, color: actionColors[b.action] || 'var(--text-muted)' }}>{b.action}</span></td>
                    <td style={{ fontSize: 12 }}>{b.document_type} #{b.document_id}</td>
                    <td style={{ fontSize: 12 }}>User #{b.actor_id}</td>
                    <td style={{ fontSize: 12, textTransform: 'capitalize' }}>{b.actor_role}</td>
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{b.data_hash?.slice(0, 8)}...</span></td>
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-blue)' }}>{b.block_hash?.slice(0, 8)}...</span></td>
                    <td>
                      <span style={{ color: b.is_valid ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontSize: 12, fontWeight: 600 }}>
                        {b.is_valid ? '✓' : '✗'}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!loading && (!auditData?.audit_trail?.length) && <div className="empty-state"><div className="empty-icon">🔗</div><div className="empty-title">No blockchain entries yet</div></div>}
        </div>
      </div>
    </div>
  );
}

// ── Create User Modal ─────────────────────────────────────────
function CreateUserModal({ onClose, onSave, authFetch }) {
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'patient', full_name: '', phone: '', specialization: '', department: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const r = await authFetch('/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (r.ok) { onSave(); }
      else { const e = await r.json(); setError(e.detail || 'Failed'); }
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><span className="modal-title">👤 Create New User</span><button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Full Name *</label><input className="form-input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Full name" /></div>
            <div className="form-group"><label className="form-label">Role *</label>
              <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="patient">Patient</option><option value="doctor">Doctor</option><option value="nurse">Nurse</option><option value="admin">Admin</option>
              </select>
            </div>
            <div className="form-group"><label className="form-label">Username *</label><input className="form-input" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="username" /></div>
            <div className="form-group"><label className="form-label">Email *</label><input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" /></div>
            <div className="form-group"><label className="form-label">Password *</label><input className="form-input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="password" /></div>
            <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1-555-0000" /></div>
            {form.role === 'doctor' && <div className="form-group"><label className="form-label">Specialization</label><input className="form-input" value={form.specialization} onChange={e => setForm(f => ({ ...f, specialization: e.target.value }))} placeholder="e.g. Pharmacogenomics" /></div>}
            {form.role === 'nurse' && <div className="form-group"><label className="form-label">Department</label><input className="form-input" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="e.g. ICU" /></div>}
          </div>
          {error && <div style={{ color: 'var(--accent-rose)', fontSize: 12, marginTop: 8 }}>⚠️ {error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.username || !form.password || !form.full_name}>{saving ? 'Creating...' : 'Create User'}</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <Routes>
      <Route path="/" element={<AdminOverview />} />
      <Route path="/users" element={<UserManagement />} />
      <Route path="/patients" element={<AdminPatientRecords />} />
      <Route path="/blockchain" element={<BlockchainAudit />} />
    </Routes>
  );
}
