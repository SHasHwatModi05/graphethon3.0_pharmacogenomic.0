// pages/NurseDashboard.jsx - Real-time nurse panel with WebSocket vitals
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function RiskBadge({ risk }) {
  const map = { 'Safe': 'badge-safe', 'Adjust Dosage': 'badge-adjust', 'Toxic': 'badge-toxic', 'Ineffective': 'badge-ineffective' };
  return <span className={`badge ${map[risk] || 'badge-unknown'}`}>{risk || '-'}</span>;
}

// -- Nurse Overview ----------------------------------------------------
function NurseOverview() {
  const { authFetch, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [patients, setPatients] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    authFetch('/nurse/stats').then(r => r.json()).then(setStats).catch(() => { });
    authFetch('/nurse/patients').then(r => r.json()).then(d => setPatients(d.slice(0, 6))).catch(() => { });
  }, []);

  return (
    <div className="animate-up">
      <div className="page-header">
        <h2 className="page-title">Welcome, {user?.full_name} •</h2>
        <p className="page-subtitle">{user?.department || 'Nursing'} • Care Management Panel</p>
      </div>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card emerald"><div className="stat-icon emerald"></div><div><div className="stat-value">{stats.total_patients}</div><div className="stat-label">Active Patients</div></div></div>
          <div className="stat-card cyan"><div className="stat-icon cyan"></div><div><div className="stat-value">{stats.total_vitals_logged}</div><div className="stat-label">Vitals Logged</div></div></div>
          <div className="stat-card blue"><div className="stat-icon blue"></div><div><div className="stat-value">{stats.total_reports_submitted}</div><div className="stat-label">Reports Submitted</div></div></div>
          <div className="stat-card amber"><div className="stat-icon amber"></div><div><div className="stat-value">{stats.active_connections}</div><div className="stat-label">Live Connections</div></div></div>
        </div>
      )}

      <div className="section">
        <div className="section-header">
          <span className="section-title"> Patient Ward</span>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/nurse/patients')}>View All</button>
        </div>
        <div className="grid-auto">
          {patients.map(p => (
            <div key={p.id} className="patient-card" onClick={() => navigate('/nurse/vitals')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-emerald), var(--accent-cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: 'white', flexShrink: 0 }}>
                  {p.full_name?.charAt(0)}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{p.full_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.gender} • {p.blood_type}</div>
                </div>
              </div>
              {p.latest_vitals ? (
                <div className="vitals-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                  <div className="vital-card" style={{ padding: '8px 6px' }}>
                    <div className="vital-value" style={{ fontSize: 16, color: 'var(--accent-rose)' }}>{p.latest_vitals.heart_rate}</div>
                    <div className="vital-label" style={{ fontSize: 10 }}>HR bpm</div>
                  </div>
                  <div className="vital-card" style={{ padding: '8px 6px' }}>
                    <div className="vital-value" style={{ fontSize: 14, color: 'var(--accent-blue)' }}>{p.latest_vitals.systolic_bp}/{p.latest_vitals.diastolic_bp}</div>
                    <div className="vital-label" style={{ fontSize: 10 }}>BP mmHg</div>
                  </div>
                  <div className="vital-card" style={{ padding: '8px 6px' }}>
                    <div className="vital-value" style={{ fontSize: 16, color: p.latest_vitals.oxygen_saturation < 95 ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>{p.latest_vitals.oxygen_saturation}%</div>
                    <div className="vital-label" style={{ fontSize: 10 }}>SpO2</div>
                  </div>
                </div>
              ) : <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '8px' }}>No vitals yet</div>}
              {p.allergies && <div style={{ marginTop: 8, fontSize: 11, color: 'var(--accent-rose)', background: 'rgba(244,63,94,0.08)', borderRadius: 4, padding: '3px 8px' }}> {p.allergies}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// -- Vitals Logger -----------------------------------------------------
function VitalsLogger() {
  const { authFetch } = useAuth();
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [form, setForm] = useState({ heart_rate: '', systolic_bp: '', diastolic_bp: '', temperature: '', oxygen_saturation: '', respiratory_rate: '', weight: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [liveVitals, setLiveVitals] = useState([]);
  const wsRef = useRef(null);
  const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
  const { token } = useAuth();

  useEffect(() => {
    authFetch('/nurse/patients').then(r => r.json()).then(setPatients).catch(() => { });
  }, []);

  useEffect(() => {
    if (!selectedPatient) return;
    // Connect WebSocket for live updates
    const wsUrl = BASE_URL.replace('http', 'ws');
    const ws = new WebSocket(`${wsUrl}/nurse/realtime/${selectedPatient.id}?token=${token}`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.event === 'vitals_update') {
        setLiveVitals(prev => [data.vitals, ...prev.slice(0, 9)]);
      }
    };

    return () => ws.close();
  }, [selectedPatient]);

  const handleSave = async () => {
    if (!selectedPatient) { setError('Please select a patient'); return; }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? null : (k !== 'notes' ? parseFloat(v) : v)]));
      const r = await authFetch(`/nurse/patient/${selectedPatient.id}/vitals`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (r.ok) {
        setSuccess('[Success] Vitals logged successfully! Broadcast to all monitoring views.');
        setForm({ heart_rate: '', systolic_bp: '', diastolic_bp: '', temperature: '', oxygen_saturation: '', respiratory_rate: '', weight: '', notes: '' });
      } else {
        const err = await r.json();
        setError(err.detail || 'Failed to log vitals');
      }
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="animate-up">
      <div className="page-header">
        <h2 className="page-title"> Log Patient Vitals</h2>
        <p className="page-subtitle">Real-time vitals entry with WebSocket broadcast</p>
      </div>

      <div className="grid-2" style={{ gap: 20 }}>
        {/* Form */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><span className="card-title">Patient Selection</span></div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                {patients.map(p => (
                  <div key={p.id} className={`patient-card ${selectedPatient?.id === p.id ? 'selected' : ''}`} style={{ padding: '10px 12px' }} onClick={() => setSelectedPatient(p)}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{p.full_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.gender} • Blood: {p.blood_type}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {selectedPatient && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Vitals for {selectedPatient.full_name}</span>
                <div className="live-indicator"><div className="live-dot" /> LIVE</div>
              </div>
              <div className="card-body">
                {selectedPatient.allergies && <div style={{ padding: '8px 12px', background: 'rgba(244,63,94,0.08)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--accent-rose)', marginBottom: 16 }}> Allergies: {selectedPatient.allergies}</div>}
                <div className="grid-2" style={{ gap: 12 }}>
                  {[['heart_rate', ' Heart Rate', 'bpm'], ['systolic_bp', ' Systolic BP', 'mmHg'], ['diastolic_bp', ' Diastolic BP', 'mmHg'], ['temperature', ' Temperature', '°C'], ['oxygen_saturation', ' SpO2', '%'], ['respiratory_rate', ' Resp. Rate', '/min'], ['weight', ' Weight', 'kg']].map(([key, label, unit]) => (
                    <div key={key} className="form-group">
                      <label className="form-label">{label} <span style={{ color: 'var(--text-muted)' }}>({unit})</span></label>
                      <input className="form-input" type="number" step="0.1" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={unit} />
                    </div>
                  ))}
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Observations, interventions, patient response..." style={{ minHeight: 60 }} />
                </div>
                {success && <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--accent-emerald)', marginBottom: 12 }}>{success}</div>}
                {error && <div style={{ padding: '10px 14px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--accent-rose)', marginBottom: 12 }}> {error}</div>}
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleSave} disabled={saving}>
                  {saving ? <><div className="spinner" /> Saving & Broadcasting...</> : ' Log Vitals & Broadcast'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Live feed */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Live Vitals Feed</span>
            <div className="live-indicator"><div className="live-dot" /> LIVE</div>
          </div>
          <div style={{ padding: 16 }}>
            {liveVitals.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"></div>
                <div className="empty-title">Awaiting real-time data</div>
                <div className="empty-desc">Log vitals to see them appear here instantly via WebSocket</div>
              </div>
            ) : liveVitals.map((v, i) => (
              <div key={i} style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', marginBottom: 8, borderLeft: '3px solid var(--accent-emerald)' }} className="animate-up">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-emerald)' }}> Just recorded</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.recorded_at?.slice(11, 19)}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  {[['', v.heart_rate, 'bpm', 'var(--accent-rose)'], ['', v.systolic_bp && v.diastolic_bp ? `${v.systolic_bp}/${v.diastolic_bp}` : '-', 'mmHg', 'var(--accent-blue)'], ['', v.oxygen_saturation, '%', 'var(--accent-emerald)']].map(([icon, val, unit, color]) => (
                    <div key={label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color }}>{val || '-'}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{icon} {unit}</div>
                    </div>
                  ))}
                </div>
                {v.notes && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{v.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// -- Reports Submitter -----------------------------------------
function ReportsPage() {
  const { authFetch } = useAuth();
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [form, setForm] = useState({ shift: 'Morning', report_type: 'Routine', summary: '', observations: '', interventions: '', patient_response: '', pain_scale: '', mobility: '' });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [pastReports, setPastReports] = useState([]);

  useEffect(() => {
    authFetch('/nurse/patients').then(r => r.json()).then(setPatients).catch(() => { });
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      authFetch(`/nurse/patient/${selectedPatient.id}/reports`).then(r => r.json()).then(setPastReports).catch(() => { });
    }
  }, [selectedPatient]);

  const handleSave = async () => {
    if (!selectedPatient) return;
    setSaving(true);
    try {
      await authFetch(`/nurse/patient/${selectedPatient.id}/report`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, pain_scale: form.pain_scale ? parseInt(form.pain_scale) : null })
      });
      setSuccess('Report submitted successfully!');
      authFetch(`/nurse/patient/${selectedPatient.id}/reports`).then(r => r.json()).then(setPastReports);
      setForm({ shift: 'Morning', report_type: 'Routine', summary: '', observations: '', interventions: '', patient_response: '', pain_scale: '', mobility: '' });
    } catch (e) { } finally { setSaving(false); }
  };

  return (
    <div className="animate-up">
      <div className="page-header"><h2 className="page-title"> Nursing Reports</h2><p className="page-subtitle">Submit shift reports and patient observations</p></div>
      <div className="grid-2" style={{ gap: 20 }}>
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><span className="card-title">Select Patient</span></div>
            <div className="card-body">
              <select className="form-select" value={selectedPatient?.id || ''} onChange={e => setSelectedPatient(patients.find(p => p.id === parseInt(e.target.value)) || null)}>
                <option value="">- Select Patient -</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
          </div>
          {selectedPatient && (
            <div className="card">
              <div className="card-header"><span className="card-title">New Report for {selectedPatient.full_name}</span></div>
              <div className="card-body">
                <div className="grid-2" style={{ gap: 12 }}>
                  <div className="form-group"><label className="form-label">Shift</label>
                    <select className="form-select" value={form.shift} onChange={e => setForm(f => ({ ...f, shift: e.target.value }))}>
                      {['Morning', 'Afternoon', 'Night'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label className="form-label">Report Type</label>
                    <select className="form-select" value={form.report_type} onChange={e => setForm(f => ({ ...f, report_type: e.target.value }))}>
                      {['Routine', 'Urgent', 'Medication Administration', 'Fall Risk', 'Discharge Planning'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label className="form-label">Pain Scale (0-10)</label>
                    <input className="form-input" type="number" min={0} max={10} value={form.pain_scale} onChange={e => setForm(f => ({ ...f, pain_scale: e.target.value }))} placeholder="0-10" />
                  </div>
                  <div className="form-group"><label className="form-label">Mobility</label>
                    <select className="form-select" value={form.mobility} onChange={e => setForm(f => ({ ...f, mobility: e.target.value }))}>
                      <option value="">-</option>
                      {['Independent', 'Ambulatory with assistance', 'Wheelchair', 'Bed-bound', 'Restrained'].map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group"><label className="form-label">Summary *</label><textarea className="form-textarea" value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} placeholder="Shift summary..." /></div>
                <div className="form-group"><label className="form-label">Observations</label><textarea className="form-textarea" value={form.observations} onChange={e => setForm(f => ({ ...f, observations: e.target.value }))} placeholder="Clinical observations..." /></div>
                <div className="form-group"><label className="form-label">Interventions</label><textarea className="form-textarea" value={form.interventions} onChange={e => setForm(f => ({ ...f, interventions: e.target.value }))} placeholder="Actions taken..." /></div>
                <div className="form-group"><label className="form-label">Patient Response</label><input className="form-input" value={form.patient_response} onChange={e => setForm(f => ({ ...f, patient_response: e.target.value }))} placeholder="How patient responded..." /></div>
                {success && <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--accent-emerald)', marginBottom: 12 }}>[Success] {success}</div>}
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleSave} disabled={saving || !form.summary}>{saving ? 'Submitting...' : ' Submit Report'}</button>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Past Reports {selectedPatient ? `(${selectedPatient.full_name})` : ''}</span></div>
          <div style={{ padding: 16 }}>
            {pastReports.length === 0 ? <div className="empty-state"><div className="empty-icon"></div><div className="empty-title">No reports yet</div></div> :
              pastReports.map(r => (
                <div key={r.id} style={{ padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', marginBottom: 8, borderLeft: '3px solid var(--accent-emerald)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{r.shift} Shift - {r.report_type}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.created_at?.slice(0, 10)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{r.summary}</div>
                  {r.pain_scale != null && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pain: {r.pain_scale}/10 • {r.nurse_name}</div>}
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// -- Stable empty form (defined outside so reset is referentially stable) --
const NURSE_PATIENT_EMPTY_FORM = {
  full_name: '', age: '', gender: 'Male',
  blood_type: '', allergies: '',
  heart_rate: '', systolic_bp: '', diastolic_bp: '', oxygen_saturation: '',
  conditionInput: '',
};

// Full patient list for nurse
function NursePatientList() {
  const { authFetch } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(NURSE_PATIENT_EMPTY_FORM);
  const [conditions, setConditions] = useState([]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showModal) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [showModal]);

  const loadPatients = () => {
    setLoading(true);
    authFetch('/nurse/patients')
      .then(r => r.json())
      .then(data => { setPatients(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadPatients(); }, []);

  const addCondition = () => {
    const v = form.conditionInput.trim();
    if (v && !conditions.includes(v)) {
      setConditions(prev => [...prev, v]);
      setForm(f => ({ ...f, conditionInput: '' }));
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setForm(NURSE_PATIENT_EMPTY_FORM);
    setConditions([]);
    setSaveError('');
  };

  const handleSubmit = async () => {
    if (!form.full_name.trim()) { setSaveError('Patient name is required.'); return; }
    setSaving(true);
    setSaveError('');
    try {
      const payload = {
        full_name: form.full_name.trim(),
        age: form.age ? parseInt(form.age) : null,
        gender: form.gender,
        blood_type: form.blood_type || null,
        allergies: form.allergies || null,
        chronic_conditions: conditions.length > 0 ? conditions.join(', ') : null,
        heart_rate: form.heart_rate ? parseFloat(form.heart_rate) : null,
        systolic_bp: form.systolic_bp ? parseFloat(form.systolic_bp) : null,
        diastolic_bp: form.diastolic_bp ? parseFloat(form.diastolic_bp) : null,
        oxygen_saturation: form.oxygen_saturation ? parseFloat(form.oxygen_saturation) : null,
      };
      const res = await authFetch('/nurse/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const newPatient = await res.json();
        setPatients(prev => [newPatient, ...prev]);
        closeModal();
      } else {
        const err = await res.json();
        setSaveError(err.detail || 'Failed to add patient.');
      }
    } catch {
      setSaveError('Network error - check backend is running.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = patients.filter(p =>
    (p.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.patient_code || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-up">
      {/* -- Page header -- */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="page-title"> Ward Patients</h2>
          <p className="page-subtitle">{patients.length} patient{patients.length !== 1 ? 's' : ''} registered</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input className="form-input" style={{ width: 200 }} placeholder=" Search patients..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Patient</button>
        </div>
      </div>

      {/* -- Patient grid -- */}
      {loading ? (
        <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"></div>
          <div className="empty-title">{search ? 'No matching patients' : 'No patients yet'}</div>
          <div className="empty-desc">Click "+ Add Patient" to register the first patient.</div>
        </div>
      ) : (
        <div className="grid-auto">
          {filtered.map(p => (
            <div key={p.id} className="patient-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,var(--accent-emerald),var(--accent-cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color: 'white' }}>
                  {(p.full_name || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.full_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.gender || '-'} • {p.blood_type || 'Blood N/A'}</div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 10, background: 'var(--bg-secondary)', color: 'var(--accent-cyan)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '2px 6px', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{p.patient_code}</span>
              </div>
              {p.chronic_conditions && <div style={{ fontSize: 11, color: 'var(--accent-amber)', background: 'rgba(245,158,11,0.08)', borderRadius: 4, padding: '3px 8px', marginBottom: 6 }}> {p.chronic_conditions}</div>}
              {p.allergies && <div style={{ fontSize: 11, color: 'var(--accent-rose)', background: 'rgba(244,63,94,0.08)', borderRadius: 4, padding: '3px 8px', marginBottom: 8 }}> {p.allergies}</div>}
              {p.latest_vitals ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                  {[['', p.latest_vitals.heart_rate, 'bpm', 'var(--accent-rose)'],
                  ['', p.latest_vitals.systolic_bp && p.latest_vitals.diastolic_bp ? `${p.latest_vitals.systolic_bp}/${p.latest_vitals.diastolic_bp}` : p.latest_vitals.systolic_bp, 'mmHg', 'var(--accent-blue)'],
                  ['', p.latest_vitals.oxygen_saturation, '%', (p.latest_vitals.oxygen_saturation ?? 100) < 95 ? 'var(--accent-rose)' : 'var(--accent-emerald)'],
                  ].map(([icon, val, unit, color]) => (
                    <div key={unit} style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 4px', textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color }}>{val ?? '-'}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{icon} {unit}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '6px 0' }}>No vitals recorded</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* -- Add Patient Modal -- */}
      {showModal && createPortal(
        <div
          onClick={closeModal}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.72)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            padding: '32px 16px',  /* Provides space around the modal */
            boxSizing: 'border-box',
            overflowY: 'auto'
          }}
        >
          {/* Modal box - stops click propagation, flex-column so only body scrolls */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              margin: 'auto',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-lg)',
              width: '100%',
              maxWidth: 620,
              maxHeight: 'calc(100vh - 64px)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',  /* Keep this hidden to round corners and bound scroll */
            }}
          >
            {/* Sticky header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}> Add New Patient</span>
              <button className="btn btn-ghost btn-sm" onClick={closeModal}>x</button>
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: '20px 24px' }}>

              {/* -- Patient info -- */}
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Patient Information</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Full Name *</label>
                  <input className="form-input" autoFocus value={form.full_name}
                    onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                    placeholder="e.g. John Doe" />
                </div>
                <div className="form-group">
                  <label className="form-label">Age</label>
                  <input className="form-input" type="number" min={0} max={150} value={form.age}
                    onChange={e => setForm(f => ({ ...f, age: e.target.value }))} placeholder="e.g. 45" />
                </div>
                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select className="form-select" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                    {['Male', 'Female', 'Non-binary', 'Other', 'Prefer not to say'].map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Blood Type</label>
                  <select className="form-select" value={form.blood_type} onChange={e => setForm(f => ({ ...f, blood_type: e.target.value }))}>
                    <option value="">- Unknown -</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bt => <option key={bt}>{bt}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Allergies</label>
                  <input className="form-input" value={form.allergies}
                    onChange={e => setForm(f => ({ ...f, allergies: e.target.value }))}
                    placeholder="e.g. Penicillin, Aspirin" />
                </div>
              </div>

              {/* -- Conditions -- */}
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Chronic Conditions</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input className="form-input" style={{ flex: 1 }} value={form.conditionInput}
                  onChange={e => setForm(f => ({ ...f, conditionInput: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCondition())}
                  placeholder="Type and press Enter or click Add" />
                <button className="btn btn-ghost btn-sm" onClick={addCondition}>Add</button>
              </div>
              {conditions.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {conditions.map(c => (
                    <span key={c} style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--accent-amber)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-full)', padding: '3px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                      {c}
                      <button onClick={() => setConditions(prev => prev.filter(x => x !== c))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-rose)', fontSize: 14, lineHeight: 1, padding: 0 }}>X</button>
                    </span>
                  ))}
                </div>
              )}

              {/* -- Initial vitals -- */}
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Initial Vitals <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 11 }}>(optional)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
                {[
                  ['heart_rate', ' Heart Rate', 'bpm', '72'],
                  ['systolic_bp', ' Systolic BP', 'mmHg', '120'],
                  ['diastolic_bp', ' Diastolic BP', 'mmHg', '80'],
                  ['oxygen_saturation', ' SpO2', '%', '98'],
                ].map(([key, label, unit, ph]) => (
                  <div key={key} className="form-group">
                    <label className="form-label">{label} ({unit})</label>
                    <input className="form-input" type="number" value={form[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={`e.g. ${ph}`} />
                  </div>
                ))}
              </div>

              {saveError && (
                <div style={{ padding: '10px 14px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--accent-rose)', marginTop: 8 }}>
                  {saveError}
                </div>
              )}
            </div>

            {/* Sticky footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0, background: 'var(--bg-card)' }}>
              <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving || !form.full_name.trim()}>
                {saving ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Adding...</> : ' Add Patient'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}




export default function NurseDashboard() {
  return (
    <Routes>
      <Route path="/" element={<NurseOverview />} />
      <Route path="/patients" element={<NursePatientList />} />
      <Route path="/vitals" element={<VitalsLogger />} />
      <Route path="/reports" element={<ReportsPage />} />
    </Routes>
  );
}

