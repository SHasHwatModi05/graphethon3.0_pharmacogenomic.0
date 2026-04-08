// pages/PatientDashboard.jsx — Patient self-service portal
import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import BlockchainBadge from '../components/BlockchainBadge';

function RiskBadge({ risk }) {
  const map = { 'Safe': 'badge-safe', 'Adjust Dosage': 'badge-adjust', 'Toxic': 'badge-toxic', 'Ineffective': 'badge-ineffective' };
  return <span className={`badge ${map[risk] || 'badge-unknown'}`}>{risk || '—'}</span>;
}

// ── Patient Overview ──────────────────────────────────────────
function PatientOverview() {
  const { authFetch, user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [vitals, setVitals] = useState([]);

  useEffect(() => {
    authFetch('/patient/me/profile').then(r => r.json()).then(setProfile).catch(() => {});
    authFetch('/patient/me/vitals?limit=1').then(r => r.json()).then(d => setVitals(d.vitals || [])).catch(() => {});
  }, []);

  const latest = vitals[0];

  return (
    <div className="animate-up">
      <div className="page-header">
        <h2 className="page-title">My Health Overview 🧬</h2>
        <p className="page-subtitle">Welcome back, {user?.full_name}</p>
      </div>

      {profile && (
        <div className="grid-2" style={{ gap: 20, marginBottom: 20 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">My Profile</span></div>
            <div className="card-body">
              {[['Patient Code', profile.patient_code], ['Date of Birth', profile.date_of_birth], ['Gender', profile.gender], ['Blood Type', profile.blood_type], ['Insurance', profile.insurance_id], ['Assigned Doctor', profile.assigned_doctor]].filter(([,v]) => v).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                  <span style={{ fontWeight: 500 }}>{v}</span>
                </div>
              ))}
              {profile.allergies && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(244,63,94,0.08)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--accent-rose)' }}>
                  ⚠️ <strong>Allergies:</strong> {profile.allergies}
                </div>
              )}
              {profile.chronic_conditions && (
                <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(245,158,11,0.08)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--accent-amber)' }}>
                  🏥 <strong>Conditions:</strong> {profile.chronic_conditions}
                </div>
              )}
            </div>
          </div>

          {latest && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Latest Vitals</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{latest.recorded_at?.slice(0, 16).replace('T', ' ')}</span>
              </div>
              <div className="card-body">
                <div className="vitals-grid">
                  {[['♥', latest.heart_rate, 'bpm', 'HR', 'var(--accent-rose)'], ['🩸', `${latest.systolic_bp ?? '—'}/${latest.diastolic_bp ?? '—'}`, 'mmHg', 'BP', 'var(--accent-blue)'], ['🌡️', latest.temperature, '°C', 'Temp', 'var(--accent-amber)'], ['💨', latest.oxygen_saturation, '%', 'SpO₂', 'var(--accent-emerald)'], ['🌬️', latest.respiratory_rate, '/min', 'Resp.', 'var(--accent-cyan)']].map(([icon, val, unit, label, color]) => (
                    <div key={label} className="vital-card">
                      <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
                      <div className="vital-value" style={{ color, fontSize: 20 }}>{val ?? '—'}</div>
                      <div className="vital-unit">{unit}</div>
                      <div className="vital-label">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── My Records ────────────────────────────────────────────────
function MyRecords() {
  const { authFetch } = useAuth();
  const [data, setData] = useState({ records: [], total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    authFetch('/patient/me/records').then(r => r.json()).then(setData).catch(() => setData({ records: [], total: 0 })).finally(() => setLoading(false));
  }, []);

  const severityColor = { low: 'var(--accent-emerald)', moderate: 'var(--accent-amber)', high: '#f97316', critical: 'var(--accent-rose)' };

  return (
    <div className="animate-up">
      <div className="page-header"><h2 className="page-title">My Medical Records</h2><p className="page-subtitle">{data.total} records · Read-only — managed by your doctor</p></div>
      {loading ? <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div> :
        data.records.length === 0 ? <div className="empty-state"><div className="empty-icon">📋</div><div className="empty-title">No records yet</div><div className="empty-desc">Your doctor will add records as needed</div></div> :
        data.records.map(r => (
          <div key={r.id} style={{ marginBottom: 12, padding: '16px 18px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderLeft: `4px solid ${severityColor[r.severity] || 'var(--border-default)'}`, borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{r.title}</span>
                  <span className="badge badge-adjust" style={{ fontSize: 10 }}>{r.record_type}</span>
                </div>
                {r.diagnosis && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>Diagnosis: {r.diagnosis} {r.icd_code && <span style={{ color: 'var(--text-muted)' }}>({r.icd_code})</span>}</div>}
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.description}</div>
              </div>
              <div style={{ textAlign: 'right', marginLeft: 12, flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{r.created_at?.slice(0, 10)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Dr. {r.doctor_name}</div>
                <BlockchainBadge hash={r.blockchain_hash} />
              </div>
            </div>
          </div>
        ))}
    </div>
  );
}

// ── My Prescriptions ──────────────────────────────────────────
function MyPrescriptions() {
  const { authFetch } = useAuth();
  const [data, setData] = useState({ prescriptions: [], total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    authFetch('/patient/me/prescriptions').then(r => r.json()).then(setData).catch(() => setData({ prescriptions: [] })).finally(() => setLoading(false));
  }, []);

  const pgxColors = { 'Toxic': 'var(--risk-toxic)', 'Adjust Dosage': 'var(--risk-adjust)', 'Safe': 'var(--risk-safe)', 'Ineffective': 'var(--risk-ineffective)' };

  return (
    <div className="animate-up">
      <div className="page-header"><h2 className="page-title">My Prescriptions</h2><p className="page-subtitle">{data.total} prescriptions · Contact your doctor if you have questions</p></div>
      {loading ? <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div> :
        data.prescriptions.length === 0 ? <div className="empty-state"><div className="empty-icon">💊</div><div className="empty-title">No prescriptions</div></div> :
        <div className="grid-2">
          {data.prescriptions.map(rx => (
            <div key={rx.id} style={{ padding: '18px 20px', background: 'var(--bg-card)', border: `1px solid var(--border-subtle)`, borderTop: `3px solid ${pgxColors[rx.pgx_risk_label] || 'var(--border-default)'}`, borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 2 }}>{rx.drug_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Dr. {rx.doctor_name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <RiskBadge risk={rx.pgx_risk_label} />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{rx.status}</div>
                </div>
              </div>
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Dosage</span><span style={{ fontWeight: 600 }}>{rx.dosage}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Frequency</span><span>{rx.frequency}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Duration</span><span>{rx.duration}</span></div>
              </div>
              {rx.instructions && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)', padding: '8px 0' }}>{rx.instructions}</div>}
              {rx.pgx_risk_label && rx.pgx_risk_label !== 'Safe' && (
                <div style={{ marginTop: 8, padding: '8px 10px', background: `${pgxColors[rx.pgx_risk_label]}18`, borderRadius: 'var(--radius-sm)', fontSize: 11, color: pgxColors[rx.pgx_risk_label] || 'var(--text-muted)' }}>
                  ⚠️ Genomic risk flag: {rx.pgx_risk_label} ({rx.pgx_severity})
                </div>
              )}
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Prescribed {rx.created_at?.slice(0, 10)}</span>
                <BlockchainBadge hash={rx.blockchain_hash} />
              </div>
            </div>
          ))}
        </div>}
    </div>
  );
}

// ── Genomic Reports ───────────────────────────────────────────
function MyGenomics() {
  const { authFetch } = useAuth();
  const [data, setData] = useState({ analyses: [], total: 0 });

  useEffect(() => { authFetch('/patient/me/vcf-analyses').then(r => r.json()).then(setData).catch(() => {}); }, []);

  const severityColors = { none: 'var(--risk-safe)', low: '#84cc16', moderate: 'var(--risk-adjust)', high: '#f97316', critical: 'var(--risk-toxic)' };

  return (
    <div className="animate-up">
      <div className="page-header"><h2 className="page-title">My Genomic Reports 🧬</h2><p className="page-subtitle">{data.total} pharmacogenomic analyses</p></div>
      {data.analyses.length === 0 ? <div className="empty-state"><div className="empty-icon">🧬</div><div className="empty-title">No genomic analyses yet</div><div className="empty-desc">Your doctor will upload and analyze your VCF file</div></div> :
        <div className="grid-2">
          {data.analyses.map(a => (
            <div key={a.id} style={{ padding: '18px 20px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent-cyan)' }}>{a.drug}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.created_at?.slice(0, 10)}</div>
                </div>
                <RiskBadge risk={a.risk_label} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, marginBottom: 12 }}>
                {[['Gene', a.primary_gene], ['Diplotype', a.diplotype], ['Phenotype', a.phenotype], ['Severity', a.severity]].map(([k, v]) => (
                  <div key={k} style={{ background: 'var(--bg-elevated)', padding: '6px 10px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: 2, fontSize: 10 }}>{k}</div>
                    <div style={{ fontWeight: 600, color: k === 'Severity' ? severityColors[v] : 'var(--text-primary)' }}>{v}</div>
                  </div>
                ))}
              </div>
              {a.recommendation && <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', marginBottom: 8 }}>{a.recommendation}</div>}
              <BlockchainBadge hash={a.blockchain_hash} />
            </div>
          ))}
        </div>}
    </div>
  );
}

// ── Health Timeline ───────────────────────────────────────────
function MyTimeline() {
  const { authFetch } = useAuth();
  const [data, setData] = useState({ timeline: [], total: 0 });

  useEffect(() => { authFetch('/patient/me/timeline').then(r => r.json()).then(setData).catch(() => {}); }, []);

  const typeColors = { medical_record: 'var(--accent-blue)', prescription: 'var(--accent-emerald)', vcf_analysis: 'var(--accent-cyan)' };

  return (
    <div className="animate-up">
      <div className="page-header"><h2 className="page-title">Health Timeline ⏱️</h2><p className="page-subtitle">{data.total} events · Chronological health history</p></div>
      {data.timeline.length === 0 ? <div className="empty-state"><div className="empty-icon">⏱️</div><div className="empty-title">No timeline events yet</div></div> : (
        <div className="timeline">
          {data.timeline.map((event, i) => (
            <div key={i} className="timeline-item animate-up" style={{ animationDelay: `${i * 30}ms` }}>
              <div className="timeline-icon" style={{ borderColor: typeColors[event.type] }}>{event.icon}</div>
              <div className="timeline-content">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div className="timeline-title">{event.title}</div>
                    <div className="timeline-meta">{event.subtitle}</div>
                    {event.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{event.description}</div>}
                  </div>
                  <div style={{ textAlign: 'right', marginLeft: 12, flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{event.date?.slice(0, 10)}</div>
                    {event.blockchain_hash && <div style={{ marginTop: 4 }}><BlockchainBadge hash={event.blockchain_hash} /></div>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PatientDashboard() {
  return (
    <Routes>
      <Route path="/" element={<PatientOverview />} />
      <Route path="/records" element={<MyRecords />} />
      <Route path="/prescriptions" element={<MyPrescriptions />} />
      <Route path="/genomics" element={<MyGenomics />} />
      <Route path="/timeline" element={<MyTimeline />} />
    </Routes>
  );
}
