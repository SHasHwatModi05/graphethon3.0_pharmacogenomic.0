// pages/DoctorDashboard.jsx — Full-featured doctor panel
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import BlockchainBadge from '../components/BlockchainBadge';
import RAGChat from '../components/RAGChat';

// ── Common drugs for instant local suggestions (no wait) ──────────
const COMMON_DRUGS = [
  'PARACETAMOL','ACETAMINOPHEN','IBUPROFEN','ASPIRIN','AMOXICILLIN','AZITHROMYCIN',
  'METFORMIN','ATORVASTATIN','OMEPRAZOLE','LISINOPRIL','AMLODIPINE','METOPROLOL',
  'WARFARIN','CLOPIDOGREL','LOSARTAN','SIMVASTATIN','LEVOTHYROXINE','SERTRALINE',
  'ESCITALOPRAM','FLUOXETINE','TRAMADOL','CODEINE','MORPHINE','OXYCODONE',
  'DOXYCYCLINE','CIPROFLOXACIN','AMOXICILLIN-CLAVULANATE','CEFTRIAXONE',
  'PREDNISONE','PREDNISOLONE','DEXAMETHASONE','HYDROCORTISONE',
  'CETIRIZINE','LORATADINE','DIPHENHYDRAMINE','FEXOFENADINE',
  'PANTOPRAZOLE','ESOMEPRAZOLE','RANITIDINE','ONDANSETRON',
  'SALBUTAMOL','MONTELUKAST','BUDESONIDE','FLUTICASONE',
  'INSULIN GLARGINE','GLIPIZIDE','SITAGLIPTIN','EMPAGLIFLOZIN',
  'TAMSULOSIN','FINASTERIDE','SILDENAFIL','TADALAFIL',
  'FOLIC ACID','FERROUS SULFATE','CALCIUM CARBONATE','VITAMIN D3',
  'DIAZEPAM','ALPRAZOLAM','CLONAZEPAM','LORAZEPAM',
  'AMITRIPTYLINE','NORTRIPTYLINE','VENLAFAXINE','DULOXETINE',
  'CARVEDILOL','BISOPROLOL','FUROSEMIDE','SPIRONOLACTONE',
  'CLOPIDOGREL','APIXABAN','RIVAROXABAN','HEPARIN',
  'AZATHIOPRINE','METHOTREXATE','HYDROXYCHLOROQUINE','SULFASALAZINE',
  'FLUOROURACIL','CAPECITABINE','TAMOXIFEN','ANASTROZOLE',
  'PHENYTOIN','VALPROATE','CARBAMAZEPINE','LEVETIRACETAM',
  'DONEPEZIL','MEMANTINE','RISPERIDONE','HALOPERIDOL',
];

// ── Drug Search Box — RxNorm powered ─────────────────────────────
function DrugSearchBox({ selectedDrugs, onAddDrug }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getLocalSuggestions = (q) => {
    const up = q.toUpperCase().trim();
    if (up.length < 1) return [];
    // Prioritize starts-with matches, then contains
    const startsWith = COMMON_DRUGS.filter(d => d.startsWith(up));
    const contains = COMMON_DRUGS.filter(d => !d.startsWith(up) && d.includes(up));
    return [...startsWith, ...contains].slice(0, 8).map(name => ({ name, type: 'Common' }));
  };

  const searchRxNorm = async (q) => {
    if (q.trim().length < 2) return;
    setLoading(true);
    try {
      // RxNorm approximate term search — finds paracetamol, brand names, generics
      const url = `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(q)}&maxEntries=12&option=0`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      const candidates = data?.approximateGroup?.candidate || [];
      const seen = new Set(selectedDrugs);
      const results = [];
      for (const c of candidates) {
        const name = (c.name || '').toUpperCase().trim();
        // Filter out multi-word compound/combination entries that are too long
        if (!name || name.length > 60) continue;
        // Skip entries that are just numbers or single chars
        if (/^\d+$/.test(name) || name.length < 3) continue;
        if (!seen.has(name + '_meta')) { // use a meta-key to allow same drug from diff sources
          seen.add(name + '_meta');
          results.push({ name, type: c.term ? 'RxNorm' : 'Drug', rxcui: c.rxcui });
        }
      }
      // Merge: put local suggestions first, then API, deduplicate by name
      setSuggestions(prev => {
        const localNames = new Set(prev.filter(s => s.type === 'Common').map(s => s.name));
        const apiOnly = results.filter(r => !localNames.has(r.name));
        return [...prev.filter(s => s.type === 'Common'), ...apiOnly].slice(0, 12);
      });
    } catch {
      // silently fail — local suggestions still shown
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (val) => {
    setQuery(val);
    setHighlighted(-1);
    const local = getLocalSuggestions(val);
    if (val.trim().length < 1) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    setSuggestions(local);
    setOpen(local.length > 0 || val.trim().length >= 2);
    clearTimeout(debounceRef.current);
    if (val.trim().length >= 2) {
      debounceRef.current = setTimeout(() => searchRxNorm(val), 200);
    }
  };

  const addDrug = (name) => {
    const up = name.toUpperCase().trim();
    if (up.length < 2) return;
    if (!selectedDrugs.includes(up)) onAddDrug(up);
    setQuery('');
    setSuggestions([]);
    setOpen(false);
    setHighlighted(-1);
    inputRef.current?.focus();
  };

  const handleManualAdd = () => {
    if (highlighted >= 0 && suggestions[highlighted]) {
      addDrug(suggestions[highlighted].name);
    } else if (query.trim().length >= 2) {
      addDrug(query.trim());
    }
  };

  const handleKeyDown = (e) => {
    if (!open || suggestions.length === 0) {
      if (e.key === 'Enter') handleManualAdd();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlighted >= 0) addDrug(suggestions[highlighted].name);
      else handleManualAdd();
    } else if (e.key === 'Escape') {
      setOpen(false);
      setHighlighted(-1);
    }
  };

  const highlight = (text, q) => {
    if (!q || q.length < 1) return text;
    const idx = text.toUpperCase().indexOf(q.toUpperCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>{text.slice(idx, idx + q.length)}</span>
        {text.slice(idx + q.length)}
      </>
    );
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      {/* Search box header */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: 6, letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
        💊 SEARCH MEDICINE
        <span style={{ fontSize: 9, fontWeight: 400, color: 'var(--text-muted)', letterSpacing: 0 }}>
          RxNorm · 100k+ drugs · Paracetamol, Aspirin, Amoxicillin…
        </span>
      </div>
      {/* Input row */}
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, pointerEvents: 'none', opacity: 0.5 }}>🔍</span>
          <input
            ref={inputRef}
            autoComplete="off"
            style={{
              width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13,
              padding: '8px 32px 8px 30px', outline: 'none', boxSizing: 'border-box',
              transition: 'border-color 0.15s, box-shadow 0.15s'
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--accent-cyan)'; e.target.style.boxShadow = '0 0 0 2px rgba(6,182,212,0.12)'; if (query.length >= 1) setOpen(true); }}
            onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none'; }}
            placeholder="Type drug name (e.g. Paracetamol, Aspirin, Amoxicillin…)"
            value={query}
            onChange={e => handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {loading && (
            <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}>
              <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
            </div>
          )}
        </div>
        <button
          onClick={handleManualAdd}
          disabled={query.trim().length < 2}
          style={{
            background: query.trim().length >= 2 ? 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))' : 'var(--bg-elevated)',
            border: 'none', borderRadius: 'var(--radius-sm)', flexShrink: 0,
            color: query.trim().length >= 2 ? 'white' : 'var(--text-muted)',
            cursor: query.trim().length >= 2 ? 'pointer' : 'not-allowed',
            fontSize: 12, padding: '8px 14px', fontWeight: 700,
            transition: 'all 0.15s', whiteSpace: 'nowrap'
          }}
        >
          + Add
        </button>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
        ↑↓ arrow keys to navigate · Enter to select · Or type and click + Add
      </div>

      {/* Suggestions dropdown */}
      {open && suggestions.length > 0 && (
        <div
          ref={listRef}
          style={{
            position: 'absolute', top: 'calc(100% - 2px)', left: 0, right: 0, zIndex: 300,
            background: 'var(--bg-card)', border: '1px solid rgba(6,182,212,0.3)',
            borderRadius: '0 0 var(--radius-md) var(--radius-md)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            maxHeight: 260, overflowY: 'auto'
          }}
        >
          {suggestions.map((s, i) => {
            const alreadyAdded = selectedDrugs.includes(s.name);
            return (
              <div
                key={s.name + i}
                onClick={() => alreadyAdded ? null : addDrug(s.name)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 14px',
                  background: highlighted === i ? 'rgba(6,182,212,0.1)' : 'transparent',
                  borderBottom: '1px solid var(--border-subtle)',
                  cursor: alreadyAdded ? 'default' : 'pointer',
                  transition: 'background 0.08s'
                }}
                onMouseEnter={() => setHighlighted(i)}
                onMouseLeave={() => setHighlighted(-1)}
              >
                {/* Drug icon */}
                <span style={{ fontSize: 14, flexShrink: 0 }}>{alreadyAdded ? '✅' : '💊'}</span>
                {/* Drug name with highlight */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600,
                    color: alreadyAdded ? 'var(--accent-emerald)' : highlighted === i ? 'var(--accent-cyan)' : 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {alreadyAdded ? '✓ ' : ''}{highlight(s.name, query)}
                  </div>
                </div>
                {/* Type badge */}
                <span style={{
                  fontSize: 9, padding: '2px 6px', borderRadius: 4, flexShrink: 0,
                  background: s.type === 'Common' ? 'rgba(16,185,129,0.12)' : 'rgba(6,182,212,0.1)',
                  color: s.type === 'Common' ? 'var(--accent-emerald)' : 'var(--accent-cyan)',
                  fontWeight: 700, letterSpacing: '0.04em'
                }}>{s.type === 'Common' ? 'COMMON' : 'RXNORM'}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected drugs pills */}
      {selectedDrugs.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {selectedDrugs.map(drug => (
            <div key={drug} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px 4px 12px', borderRadius: 'var(--radius-full)',
              fontSize: 12, fontWeight: 600,
              background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.35)',
              color: 'var(--accent-cyan)', transition: 'all 0.15s'
            }}>
              <span>{drug}</span>
              <button
                onClick={() => onAddDrug(drug)}  // parent toggles/removes
                title="Remove"
                style={{
                  background: 'rgba(6,182,212,0.2)', border: 'none', borderRadius: '50%',
                  width: 16, height: 16, cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 10, color: 'var(--accent-cyan)',
                  flexShrink: 0, lineHeight: 1, padding: 0
                }}
              >×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Risk helpers ──────────────────────────────────────────────
function RiskBadge({ risk }) {
  const map = { 'Safe': 'badge-safe', 'Adjust Dosage': 'badge-adjust', 'Toxic': 'badge-toxic', 'Ineffective': 'badge-ineffective' };
  return <span className={`badge ${map[risk] || 'badge-unknown'}`}>{risk || 'Unknown'}</span>;
}
function SeverityBadge({ severity }) {
  const map = { none: 'severity-none', low: 'severity-low', moderate: 'severity-moderate', high: 'severity-high', critical: 'severity-critical' };
  return <span className={`severity-dot ${map[severity] || 'severity-none'}`} style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%' }} title={severity} />;
}

// ── Confidence Meter — CPIC / PharmGKB backed ─────────────────
function ConfidenceMeter({ confidence, compact = false }) {
  if (!confidence) return null;

  const { score, tier, tier_key, supporting_bodies, evidence_flags, rationale, cpic_level, publication_count } = confidence;
  const [expanded, setExpanded] = React.useState(false);

  const tierConfig = {
    high:      { color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.3)',  icon: '🛡️', label: 'High Confidence' },
    moderate:  { color: '#06b6d4', bg: 'rgba(6,182,212,0.08)',   border: 'rgba(6,182,212,0.3)',   icon: '✅', label: 'Moderate Confidence' },
    inference: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.3)',  icon: '⚠️', label: 'Inferred' },
    low:       { color: '#6b7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.3)', icon: '❓', label: 'Low Confidence' },
  };
  const cfg = tierConfig[tier_key] || tierConfig.low;

  const bodyColors = {
    'CPIC':     '#3b82f6',
    'PharmGKB': '#8b5cf6',
    'DPWG':     '#06b6d4',
    'FDA':      '#ef4444',
    'EMA':      '#f59e0b',
  };

  // Arc SVG for circular gauge
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = (score / 100) * circumference;

  if (compact) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 8, padding: '5px 10px' }}>
        {/* Mini arc gauge */}
        <svg width="28" height="28" style={{ flexShrink: 0 }}>
          <circle cx="14" cy="14" r={radius * 0.65} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
          <circle
            cx="14" cy="14" r={radius * 0.65}
            fill="none" stroke={cfg.color} strokeWidth="3"
            strokeDasharray={`${(score / 100) * 2 * Math.PI * (radius * 0.65)} 999`}
            strokeLinecap="round"
            transform="rotate(-90 14 14)"
          />
          <text x="14" y="18" textAnchor="middle" fontSize="7" fill={cfg.color} fontWeight="800">{score}</text>
        </svg>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: cfg.color, lineHeight: 1.2 }}>{cfg.icon} {tier_key === 'high' ? 'CPIC Level A' : tier_key === 'moderate' ? 'Guideline-Supported' : 'Inferred'}</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {(supporting_bodies || []).map(b => (
              <span key={b} style={{ color: bodyColors[b] || '#6b7280', fontWeight: 700 }}>{b}</span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ border: `1px solid ${cfg.border}`, borderRadius: 12, background: cfg.bg, overflow: 'hidden' }}>
      {/* Header row */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Circular score gauge */}
        <svg width="52" height="52" style={{ flexShrink: 0 }}>
          {/* Track */}
          <circle cx="26" cy="26" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
          {/* Progress */}
          <circle
            cx="26" cy="26" r={radius}
            fill="none" stroke={cfg.color} strokeWidth="5"
            strokeDasharray={`${strokeDash} ${circumference}`}
            strokeLinecap="round"
            transform="rotate(-90 26 26)"
            style={{ transition: 'stroke-dasharray 0.8s ease' }}
          />
          <text x="26" y="21" textAnchor="middle" fontSize="11" fill={cfg.color} fontWeight="900">{score}</text>
          <text x="26" y="31" textAnchor="middle" fontSize="7" fill="var(--text-muted)">/100</text>
        </svg>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: cfg.color }}>{cfg.icon} {tier}</span>
          </div>
          {/* Supporting bodies pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {(supporting_bodies || []).map(b => (
              <span key={b} style={{
                fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 4,
                background: (bodyColors[b] || '#6b7280') + '20',
                color: bodyColors[b] || '#6b7280',
                border: `1px solid ${(bodyColors[b] || '#6b7280')}40`,
                letterSpacing: '0.04em'
              }}>{b}</span>
            ))}
            {cpic_level && cpic_level !== 'N/A' && (
              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)', letterSpacing: '0.04em' }}>
                CPIC Level {cpic_level}
              </span>
            )}
            {publication_count > 0 && (
              <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                {publication_count}+ publications
              </span>
            )}
          </div>
        </div>

        <div style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
          {expanded ? '▲ Less' : '▼ Details'}
        </div>
      </div>

      {/* Score bar */}
      <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', margin: '0 16px' }}>
        <div style={{ height: '100%', width: `${score}%`, background: `linear-gradient(90deg, ${cfg.color}80, ${cfg.color})`, borderRadius: 2, transition: 'width 0.8s ease' }} />
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Rationale */}
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, background: 'rgba(255,255,255,0.03)', borderLeft: `3px solid ${cfg.color}`, padding: '8px 12px', borderRadius: '0 6px 6px 0' }}>
            {rationale}
          </div>

          {/* Evidence flags */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 6 }}>EVIDENCE CHECKPOINTS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(evidence_flags || []).map((flag, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
                  <span style={{ color: cfg.color, flexShrink: 0, marginTop: 1 }}>✓</span>
                  <span>{flag}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <div style={{ fontSize: 10, color: 'var(--text-muted)', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, padding: '6px 10px', lineHeight: 1.5 }}>
            ⚠️ <strong>Clinical Disclaimer:</strong> Confidence scores reflect guideline alignment and data quality. All prescribing decisions must be made by a qualified clinician in conjunction with this report. This analysis does not replace professional clinical judgment.
          </div>
        </div>
      )}
    </div>
  );
}

// ── PDF Generator — pure browser print API ─────────────────────
function generatePGxPDF(results, patientId) {
  if (!results || results.length === 0) return;

  const riskColor = (label) => {
    if (label === 'Safe') return '#10b981';
    if (label === 'Adjust Dosage') return '#f59e0b';
    if (label === 'Toxic') return '#f43f5e';
    return '#6b7280';
  };

  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  const drugsHTML = results.map(r => {
    const drug = r.drug || r._drug || 'Unknown';
    const risk = r.risk_assessment?.risk_label || 'Unknown';
    const severity = r.risk_assessment?.severity || '';
    const profile = r.pharmacogenomic_profile?.[0] || {};
    const gene = profile.primary_gene || '';
    const diplotype = profile.diplotype || '';
    const phenotype = profile.phenotype || '';
    const recommendation = r.clinical_recommendation?.recommendation || '';
    const explanation = r.llm_generated_explanation || {};
    const substitutes = r.drug_substitutes || [];
    const geneInfo = r.gene_info || {};
    const variants = profile.detected_variants || [];

    const showSubstitutes = ['Toxic', 'Adjust Dosage', 'Ineffective'].includes(risk) && substitutes.length > 0;
    const severityBadgeColor = { none: '#10b981', low: '#06b6d4', moderate: '#f59e0b', high: '#f97316', critical: '#f43f5e' }[severity] || '#6b7280';

    // Pre-compute confidence HTML (avoids nested template-literal issues)
    let confidenceHTML = '';
    const conf = r.confidence;
    if (conf) {
      const tierColorMap = { high: '#10b981', moderate: '#06b6d4', inference: '#f59e0b', low: '#6b7280' };
      const confColor = tierColorMap[conf.tier_key] || '#6b7280';
      const bodyColorMap = { CPIC: '#3b82f6', PharmGKB: '#8b5cf6', DPWG: '#06b6d4', FDA: '#ef4444', EMA: '#f59e0b' };
      const bodiesHTML = (conf.supporting_bodies || []).map(b =>
        '<span style="display:inline-block;padding:2px 8px;font-size:10px;font-weight:800;border-radius:4px;' +
        'background:' + (bodyColorMap[b]||'#6b7280') + '20;color:' + (bodyColorMap[b]||'#6b7280') + ';' +
        'border:1px solid ' + (bodyColorMap[b]||'#6b7280') + '40;margin-right:4px;letter-spacing:0.04em;">' + b + '</span>'
      ).join('');
      const flagsHTML = (conf.evidence_flags || []).map(f =>
        '<div style="display:flex;align-items:flex-start;gap:8px;font-size:11px;color:#374151;margin-bottom:3px;">' +
        '<span style="color:' + confColor + ';flex-shrink:0;">✓</span>' +
        '<span>' + f + '</span></div>'
      ).join('');
      const r20 = 20, circ = +(2 * Math.PI * r20).toFixed(1);
      const dash = +((conf.score / 100) * circ).toFixed(1);
      const cpicBadge = (conf.cpic_level && conf.cpic_level !== 'N/A')
        ? '<span style="display:inline-block;padding:2px 8px;font-size:10px;font-weight:800;border-radius:4px;' +
          'background:#3b82f620;color:#3b82f6;border:1px solid #3b82f640;margin-top:4px;">CPIC Level ' + conf.cpic_level + '</span>'
        : '';
      const pubBadge = conf.publication_count > 0
        ? '<span style="display:inline-block;padding:2px 8px;font-size:10px;font-weight:600;border-radius:4px;' +
          'background:#f3f4f6;color:#6b7280;border:1px solid #e5e7eb;margin-top:4px;margin-left:4px;">' + conf.publication_count + '+ publications</span>'
        : '';
      confidenceHTML =
        '<div style="margin-bottom:16px;border:1px solid ' + confColor + '40;border-radius:10px;background:' + confColor + '08;overflow:hidden;">' +
          '<div style="display:flex;align-items:center;gap:16px;padding:14px 16px;border-bottom:3px solid ' + confColor + '30;">' +
            '<svg width="56" height="56" style="flex-shrink:0;">' +
              '<circle cx="28" cy="28" r="' + r20 + '" fill="none" stroke="#e5e7eb" stroke-width="5"/>' +
              '<circle cx="28" cy="28" r="' + r20 + '" fill="none" stroke="' + confColor + '" stroke-width="5" stroke-dasharray="' + dash + ' ' + circ + '" stroke-linecap="round" transform="rotate(-90 28 28)"/>' +
              '<text x="28" y="23" text-anchor="middle" font-size="12" fill="' + confColor + '" font-weight="900">' + conf.score + '</text>' +
              '<text x="28" y="33" text-anchor="middle" font-size="8" fill="#9ca3af">/100</text>' +
            '</svg>' +
            '<div style="flex:1;">' +
              '<div style="font-size:13px;font-weight:800;color:' + confColor + ';margin-bottom:6px;">&#128737; ' + conf.tier + '</div>' +
              '<div>' + bodiesHTML + '</div>' +
              cpicBadge + pubBadge +
            '</div>' +
          '</div>' +
          '<div style="padding:10px 16px;">' +
            '<div style="font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:0.06em;margin-bottom:6px;">EVIDENCE CHECKPOINTS</div>' +
            flagsHTML +
            '<div style="margin-top:8px;font-size:10px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:6px 10px;line-height:1.5;">' +
              '<strong>&#9888; Clinical Disclaimer:</strong> ' + conf.rationale +
            '</div>' +
          '</div>' +
        '</div>';
    }

    return `
      <div style="page-break-inside: avoid; margin-bottom: 32px; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; break-inside: avoid;">
        <!-- Drug Header -->
        <div style="background: ${riskColor(risk)}18; border-bottom: 2px solid ${riskColor(risk)}40; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 10px; color: #6b7280; font-weight: 600; letter-spacing: 0.08em; margin-bottom: 3px;">DRUG ANALYSIS</div>
            <div style="font-size: 22px; font-weight: 900; color: #111827; font-family: 'Courier New', monospace;">${drug}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; color: #6b7280; margin-bottom: 4px;">RISK ASSESSMENT</div>
            <div style="font-size: 20px; font-weight: 800; color: ${riskColor(risk)};">${risk}</div>
            <div style="display: inline-block; padding: 2px 10px; background: ${severityBadgeColor}20; color: ${severityBadgeColor}; border-radius: 99px; font-size: 11px; font-weight: 700; margin-top: 4px; text-transform: uppercase;">${severity} severity</div>
          </div>
        </div>

        <div style="padding: 16px 20px;">
          <!-- Confidence Score Section -->
          ${confidenceHTML}

          <!-- Genomic Profile -->
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px;">
            <div style="background: #f9fafb; border-radius: 8px; padding: 12px;">
              <div style="font-size: 10px; color: #9ca3af; font-weight: 600; letter-spacing: 0.06em;">PRIMARY GENE</div>
              <div style="font-size: 18px; font-weight: 800; color: #111827; font-family: 'Courier New', monospace; margin-top: 2px;">${gene}</div>
              ${geneInfo.full_name ? `<div style="font-size: 10px; color: #6b7280; margin-top: 2px;">${geneInfo.full_name}</div>` : ''}
            </div>
            <div style="background: #f9fafb; border-radius: 8px; padding: 12px;">
              <div style="font-size: 10px; color: #9ca3af; font-weight: 600; letter-spacing: 0.06em;">DIPLOTYPE</div>
              <div style="font-size: 18px; font-weight: 800; color: #111827; font-family: 'Courier New', monospace; margin-top: 2px;">${diplotype}</div>
              ${geneInfo.location ? `<div style="font-size: 10px; color: #6b7280; margin-top: 2px;">${geneInfo.location}</div>` : ''}
            </div>
            <div style="background: #f9fafb; border-radius: 8px; padding: 12px;">
              <div style="font-size: 10px; color: #9ca3af; font-weight: 600; letter-spacing: 0.06em;">PHENOTYPE</div>
              <div style="font-size: 18px; font-weight: 800; color: ${riskColor(risk)}; margin-top: 2px;">${phenotype}</div>
              <div style="font-size: 10px; color: #6b7280; margin-top: 2px;">${{ PM: 'Poor Metabolizer', IM: 'Intermediate Metabolizer', NM: 'Normal Metabolizer', RM: 'Rapid Metabolizer', UM: 'Ultra-Rapid Metabolizer' }[phenotype] || phenotype}</div>
            </div>
          </div>

          <!-- Gene Mechanism -->
          ${geneInfo.function ? `
          <div style="margin-bottom: 16px;">
            <div style="font-size: 11px; font-weight: 700; color: #374151; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
              🧬 HOW ${gene} AFFECTS ${drug}
            </div>
            <div style="background: #f0f9ff; border-left: 3px solid #0ea5e9; border-radius: 0 8px 8px 0; padding: 12px 14px; font-size: 12px; color: #374151; line-height: 1.7;">
              ${geneInfo.function}
            </div>
          </div>` : ''}

          <!-- Phenotype Impact / Why Unsafe -->
          ${geneInfo.phenotype_impact ? `
          <div style="margin-bottom: 16px;">
            <div style="font-size: 11px; font-weight: 700; color: ${riskColor(risk)}; margin-bottom: 6px;">
              ⚠️ WHY ${drug} IS ${risk.toUpperCase()} FOR THIS PATIENT (${phenotype} Phenotype)
            </div>
            <div style="background: ${riskColor(risk)}08; border: 1px solid ${riskColor(risk)}30; border-radius: 8px; padding: 12px 14px; font-size: 12px; color: #374151; line-height: 1.7;">
              ${geneInfo.phenotype_impact}
            </div>
          </div>` : ''}

          <!-- Clinical Recommendation -->
          <div style="margin-bottom: 16px;">
            <div style="font-size: 11px; font-weight: 700; color: #374151; margin-bottom: 6px;">💊 CLINICAL RECOMMENDATION</div>
            <div style="background: #f9fafb; border-radius: 8px; padding: 12px 14px; font-size: 12px; color: #374151; line-height: 1.7; border: 1px solid #e5e7eb;">
              ${recommendation}
            </div>
          </div>

          <!-- LLM Explanation -->
          ${explanation.mechanism ? `
          <div style="margin-bottom: 16px;">
            <div style="font-size: 11px; font-weight: 700; color: #374151; margin-bottom: 6px;">🔬 MOLECULAR MECHANISM</div>
            <div style="background: #fafaf9; border-radius: 8px; padding: 12px 14px; font-size: 12px; color: #374151; line-height: 1.7; border: 1px solid #e5e7eb;">
              ${explanation.mechanism}
            </div>
          </div>` : ''}

          <!-- Safer Alternatives -->
          ${showSubstitutes ? `
          <div style="margin-bottom: 16px;">
            <div style="font-size: 11px; font-weight: 700; color: #059669; margin-bottom: 8px;">✅ SAFER ALTERNATIVE DRUGS</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              ${substitutes.map((s, i) => `
                <div style="display: flex; align-items: flex-start; gap: 8px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 12px;">
                  <span style="color: #059669; font-weight: 700; font-size: 14px; line-height: 1;">${i + 1}.</span>
                  <span style="font-size: 12px; color: #065f46; font-weight: 600; line-height: 1.4;">${s}</span>
                </div>
              `).join('')}
            </div>
          </div>` : (risk === 'Safe' ? `
          <div style="margin-bottom: 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 14px;">
            <div style="font-size: 12px; color: #065f46; font-weight: 600;">✅ No alternatives required — standard dosing is appropriate for this patient's genotype.</div>
          </div>` : '')}

          <!-- Clinical Guideline -->
          ${geneInfo.guideline ? `
          <div style="margin-bottom: 16px;">
            <div style="font-size: 11px; font-weight: 700; color: #374151; margin-bottom: 6px;">📋 CLINICAL GUIDELINE BASIS</div>
            <div style="background: #faf5ff; border-left: 3px solid #a855f7; border-radius: 0 8px 8px 0; padding: 10px 14px; font-size: 12px; color: #374151; line-height: 1.6; font-style: italic;">
              ${geneInfo.guideline}
            </div>
          </div>` : ''}

          <!-- Detected Variants -->
          ${variants.length > 0 ? `
          <div>
            <div style="font-size: 11px; font-weight: 700; color: #374151; margin-bottom: 6px;">🔬 DETECTED GENETIC VARIANTS (${variants.length})</div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
              ${variants.slice(0, 20).map(v => `
                <span style="background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 4px; padding: 3px 8px; font-size: 11px; font-family: 'Courier New', monospace; color: #374151;">${v.rsid} <span style="color: #6b7280">${v.gene}</span></span>
              `).join('')}
              ${variants.length > 20 ? `<span style="font-size: 11px; color: #9ca3af;">+${variants.length - 20} more</span>` : ''}
            </div>
          </div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>PharmaGuard PGx Report — ${patientId || 'Patient'}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', 'Segoe UI', sans-serif; background: white; color: #111827; padding: 40px; max-width: 900px; margin: 0 auto; }
  @media print {
    @page { margin: 20mm; size: A4 portrait; }
    body { padding: 0; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <!-- Header -->
  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid #0ea5e9;">
    <div>
      <div style="font-size: 28px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">🧬 PharmaGuard PGx</div>
      <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">Pharmacogenomic Analysis Report</div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 11px; color: #9ca3af;">PATIENT ID</div>
      <div style="font-size: 16px; font-weight: 800; color: #0f172a; font-family: 'Courier New', monospace;">${patientId || 'UNKNOWN'}</div>
      <div style="font-size: 11px; color: #9ca3af; margin-top: 4px;">DATE: ${date}</div>
      <div style="font-size: 10px; color: #9ca3af;">DRUGS ANALYZED: ${results.length}</div>
    </div>
  </div>

  <!-- Disclaimer -->
  <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; font-size: 11px; color: #92400e; line-height: 1.5;">
    <strong>⚠️ Clinical Disclaimer:</strong> This pharmacogenomic report is generated for informational purposes to assist clinical decision-making. All treatment decisions should be made by a qualified healthcare professional in conjunction with this report and other clinical data. This report does not replace clinical judgment.
  </div>

  <!-- Drug Results -->
  ${drugsHTML}

  <!-- Footer -->
  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 10px; color: #9ca3af;">
    <span>PharmaGuard PGx Platform v2 · Powered by CPIC / PharmGKB Guidelines</span>
    <span>Generated: ${new Date().toLocaleString()}</span>
  </div>

  <!-- Print Button (hidden on print) -->
  <div class="no-print" style="text-align: center; margin-top: 24px;">
    <button onclick="window.print()" style="background: #0ea5e9; color: white; border: none; border-radius: 8px; padding: 12px 32px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit;">
      🖨️ Download / Print PDF
    </button>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=1000,height=800');
  win.document.write(html);
  win.document.close();
  // Auto-trigger print after fonts load
  win.onload = () => setTimeout(() => win.print(), 600);
}

// ── PGx Result Detail Panel — shown below analysis results ─────
function PGxResultDetail({ result }) {
  const drug = result.drug || result._drug || 'Unknown';
  const risk = result.risk_assessment?.risk_label || 'Unknown';
  const profile = result.pharmacogenomic_profile?.[0] || {};
  const gene = profile.primary_gene || '';
  const phenotype = profile.phenotype || '';
  const explanation = result.llm_generated_explanation || {};
  const substitutes = result.drug_substitutes || [];
  const geneInfo = result.gene_info || {};

  const showSubstitutes = ['Toxic', 'Adjust Dosage', 'Ineffective'].includes(risk) && substitutes.length > 0;

  const riskBg = {
    'Toxic': 'rgba(244,63,94,0.06)',
    'Adjust Dosage': 'rgba(245,158,11,0.06)',
    'Safe': 'rgba(16,185,129,0.06)',
    'Unknown': 'var(--bg-elevated)',
  }[risk] || 'var(--bg-elevated)';

  const riskBorder = {
    'Toxic': 'rgba(244,63,94,0.25)',
    'Adjust Dosage': 'rgba(245,158,11,0.25)',
    'Safe': 'rgba(16,185,129,0.25)',
    'Unknown': 'var(--border-subtle)',
  }[risk] || 'var(--border-subtle)';

  return (
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10, background: riskBg, border: `1px solid ${riskBorder}`, borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
      {/* Confidence Meter — always at top so doctors see trustworthiness first */}
      <ConfidenceMeter confidence={result.confidence} />

      {/* Gene Mechanism */}
      {geneInfo.function && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: 5, letterSpacing: '0.05em' }}>
            🧬 HOW {gene} AFFECTS {drug}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, background: 'rgba(6,182,212,0.05)', borderLeft: '3px solid var(--accent-cyan)', padding: '8px 12px', borderRadius: '0 6px 6px 0' }}>
            {geneInfo.function}
          </div>
        </div>
      )}

      {/* Why unsafe/ineffective */}
      {geneInfo.phenotype_impact && phenotype !== 'NM' && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: risk === 'Safe' ? 'var(--accent-emerald)' : risk === 'Toxic' ? 'var(--accent-rose)' : 'var(--accent-amber)', marginBottom: 5, letterSpacing: '0.05em' }}>
            ⚠️ WHY {drug} IS {risk.toUpperCase()} FOR THIS PATIENT ({phenotype})
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, background: risk === 'Toxic' ? 'rgba(244,63,94,0.05)' : 'rgba(245,158,11,0.05)', borderLeft: `3px solid ${risk === 'Toxic' ? 'var(--accent-rose)' : 'var(--accent-amber)'}`, padding: '8px 12px', borderRadius: '0 6px 6px 0' }}>
            {geneInfo.phenotype_impact}
          </div>
        </div>
      )}

      {/* Guideline */}
      {geneInfo.guideline && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', background: 'rgba(168,85,247,0.06)', borderLeft: '3px solid rgba(168,85,247,0.4)', borderRadius: '0 6px 6px 0', padding: '7px 10px', lineHeight: 1.6, fontStyle: 'italic' }}>
          📋 {geneInfo.guideline}
        </div>
      )}

      {/* Safer alternatives */}
      {showSubstitutes && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-emerald)', marginBottom: 6, letterSpacing: '0.05em' }}>
            ✅ SAFER ALTERNATIVES TO {drug}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {substitutes.map((s, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: 'var(--radius-full)', fontSize: 11, color: 'var(--accent-emerald)', fontWeight: 600
              }}>
                <span style={{ opacity: 0.7 }}>{i + 1}.</span> {s}
              </div>
            ))}
          </div>
        </div>
      )}

      {risk === 'Safe' && (
        <div style={{ fontSize: 12, color: 'var(--accent-emerald)', fontWeight: 600 }}>
          ✅ No alternatives required — standard dosing appropriate for this genotype.
        </div>
      )}
    </div>
  );
}

// ── Doctor Overview ────────────────────────────────────────────
function DoctorOverview() {
  const { authFetch, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [patients, setPatients] = useState([]);
  const [now, setNow] = useState(new Date());
  const navigate = useNavigate();

  useEffect(() => {
    authFetch('/doctor/stats').then(r => r.json()).then(setStats).catch(() => {});
    authFetch('/doctor/patients').then(r => r.json()).then(d => setPatients(d.slice(0, 6))).catch(() => {});
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const riskColors = {
    'Safe': '#10b981', 'Adjust Dosage': '#f59e0b',
    'Toxic': '#f43f5e', 'Ineffective': '#8b5cf6', 'Unknown': '#64748b'
  };

  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const QUICK_ACTIONS = [
    { icon: '🧬', label: 'Run VCF Analysis', path: '/doctor/vcf',       color: 'var(--accent-cyan)'   },
    { icon: '👥', label: 'View All Patients', path: '/doctor/patients', color: 'var(--accent-blue)'   },
    { icon: '📊', label: 'Analytics',         path: '/doctor/analytics',color: 'var(--accent-purple)' },
    { icon: '🤖', label: 'AI Assistant',       path: '/doctor/rag',      color: 'var(--accent-emerald)'},
  ];

  return (
    <div className="animate-up">
      {/* ── Hero Banner ── */}
      <div className="hero-banner">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-cyan)', letterSpacing: '0.08em', marginBottom: 4, textTransform: 'uppercase' }}>
              🛡️ PharmaGuard PGx · Clinical Dashboard
            </div>
            <div className="hero-greeting">{greeting}, Dr. {user?.full_name?.split(' ')[0]} 👋</div>
            <div className="hero-subtitle">{user?.specialization || 'Pharmacogenomics'} · All systems operational</div>
            <div className="hero-datetime">{dateStr} · {timeStr}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'var(--accent-emerald)', fontWeight: 700 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-emerald)', display: 'inline-block', animation: 'sev-pulse 1.5s ease-in-out infinite' }} />
              API Online — v3.0
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>CPIC · PharmGKB · DPWG · FDA · EMA</div>
          </div>
        </div>

        {stats && (
          <div className="hero-stat-row">
            {[
              { label: 'Patients', value: stats.total_patients,      icon: '👥', color: '#06b6d4' },
              { label: 'Records',  value: stats.records_created,     icon: '📋', color: '#3b82f6' },
              { label: 'Rx',       value: stats.prescriptions_written,icon: '💊', color: '#10b981' },
              { label: 'Analyses', value: stats.vcf_analyses,        icon: '🧬', color: '#8b5cf6' },
            ].map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <div className="hero-divider" />}
                <div className="hero-stat">
                  <div className="hero-stat-value" style={{ color: s.color }}>{s.value ?? '—'}</div>
                  <div className="hero-stat-label">{s.icon} {s.label}</div>
                </div>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* ── Quick Actions ── */}
      <div className="quick-actions">
        {QUICK_ACTIONS.map(qa => (
          <button key={qa.label} className="quick-action-btn" onClick={() => navigate(qa.path)}>
            <span className="qa-icon">{qa.icon}</span>
            <span>{qa.label}</span>
            <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.5 }}>→</span>
          </button>
        ))}
      </div>

      <div className="grid-2" style={{ gap: 20 }}>
        {/* Recent patients */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">👥 Recent Patients</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/doctor/patients')}>View All →</button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {patients.map(p => (
              <div
                key={p.id}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'background 0.15s' }}
                onClick={() => navigate(`/doctor/patient/${p.id}`)}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}
              >
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: 'white', flexShrink: 0, boxShadow: '0 0 10px rgba(6,182,212,0.3)' }}>
                  {p.full_name?.charAt(0) || '?'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.full_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.patient_code} · {p.record_count || 0} records</div>
                </div>
                {p.latest_vitals && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
                    <div>♥ {p.latest_vitals.heart_rate} bpm</div>
                    <div>{p.latest_vitals.systolic_bp}/{p.latest_vitals.diastolic_bp} mmHg</div>
                  </div>
                )}
                <span style={{ fontSize: 16, color: 'var(--text-muted)', marginLeft: 4 }}>→</span>
              </div>
            ))}
            {patients.length === 0 && <div className="empty-state"><div className="empty-icon float-anim">👥</div><div className="empty-title">No patients yet</div></div>}
          </div>
        </div>

        {/* Risk + activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Risk breakdown */}
          {stats?.risk_breakdown && Object.keys(stats.risk_breakdown).length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">⚡ Risk Distribution</span>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/doctor/analytics')}>Analytics →</button>
              </div>
              <div className="card-body">
                {Object.entries(stats.risk_breakdown).map(([risk, count]) => (
                  <div key={risk} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                      <span style={{ color: riskColors[risk] || 'var(--text-secondary)', fontWeight: 600 }}>{risk}</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{count}</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 4,
                        width: stats.vcf_analyses > 0 ? `${(count / stats.vcf_analyses) * 100}%` : '0%',
                        background: `linear-gradient(90deg, ${riskColors[risk] || 'var(--text-muted)'}88, ${riskColors[risk] || 'var(--text-muted)'})`,
                        transition: 'width 0.8s ease'
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Platform capabilities card */}
          <div className="card" style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.04), rgba(59,130,246,0.04))' }}>
            <div className="card-header"><span className="card-title">🛡️ Platform Capabilities</span></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { icon: '✓', color: '#10b981', text: 'CPIC Level A-D guideline coverage for 12+ genes' },
                { icon: '✓', color: '#10b981', text: 'Real-time drug-drug interaction detection' },
                { icon: '✓', color: '#10b981', text: 'Blockchain-secured audit trail (SHA-256)' },
                { icon: '✓', color: '#10b981', text: 'Confidence scoring — CPIC · PharmGKB · FDA · EMA' },
                { icon: '✓', color: '#10b981', text: 'AI-powered RAG clinical assistance' },
                { icon: '✓', color: '#10b981', text: 'Exportable PDF clinical reports with evidence' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span style={{ color: item.color, fontWeight: 900, fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
                  {item.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Patient List ───────────────────────────────────────────────
function PatientList() {
  const { authFetch } = useAuth();
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadPatients = useCallback(async () => {
    setLoading(true);
    try {
      const url = search ? `/doctor/patients?search=${encodeURIComponent(search)}` : '/doctor/patients';
      const r = await authFetch(url);
      setPatients(await r.json());
    } catch (e) {} finally { setLoading(false); }
  }, [search]);

  useEffect(() => { loadPatients(); }, [search]);

  return (
    <div className="animate-up">
      <div className="page-header flex justify-between items-center">
        <div><h2 className="page-title">Patient Management</h2><p className="page-subtitle">All registered patients · Click to view history</p></div>
      </div>
      <div className="card">
        <div className="card-header">
          <div className="search-bar" style={{ flex: 1, maxWidth: 320 }}>
            <span className="search-icon">🔍</span>
            <input className="form-input search-bar-input" placeholder="Search by name or code..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{patients.length} patients</span>
        </div>
        <div className="table-container">
          <table>
            <thead><tr><th>Patient</th><th>Code</th><th>Blood Type</th><th>Latest Vitals</th><th>Records</th><th>Rx</th><th>Analyses</th><th></th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr>
              ) : patients.map(p => (
                <tr key={p.id} onClick={() => navigate(`/doctor/patient/${p.id}`)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: 'white', flexShrink: 0 }}>{p.full_name?.charAt(0)}</div>
                      <div><div style={{ fontWeight: 600, fontSize: 13 }}>{p.full_name}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.gender} · {p.date_of_birth}</div></div>
                    </div>
                  </td>
                  <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-cyan)' }}>{p.patient_code}</span></td>
                  <td><span className="badge badge-safe">{p.blood_type || '—'}</span></td>
                  <td>
                    {p.latest_vitals ? (
                      <div style={{ fontSize: 11 }}>
                        <div>♥ {p.latest_vitals.heart_rate} bpm</div>
                        <div>{p.latest_vitals.systolic_bp}/{p.latest_vitals.diastolic_bp} mmHg</div>
                        <div>SpO₂ {p.latest_vitals.oxygen_saturation}%</div>
                      </div>
                    ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>No data</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>{p.record_count}</td>
                  <td style={{ textAlign: 'center' }}>{p.prescription_count}</td>
                  <td style={{ textAlign: 'center' }}>{p.vcf_analysis_count}</td>
                  <td><button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); navigate(`/doctor/patient/${p.id}`); }}>View →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && patients.length === 0 && <div className="empty-state"><div className="empty-icon">👥</div><div className="empty-title">No patients found</div></div>}
        </div>
      </div>
    </div>
  );
}

// ── Patient Detail ─────────────────────────────────────────────
function PatientDetail() {
  const { id } = useParams();
  const { authFetch } = useAuth();
  const [history, setHistory] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showRxModal, setShowRxModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [dashboardCharts, setDashboardCharts] = useState(null);
  const [loadingCharts, setLoadingCharts] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    authFetch(`/doctor/patient/${id}/history`).then(r => r.json()).then(setHistory).catch(() => {});
  }, [id]);

  const loadDashboard = async () => {
    setLoadingCharts(true);
    try {
      const r = await authFetch(`/doctor/patient/${id}/dashboard`);
      const data = await r.json();
      setDashboardCharts(data.charts);
    } catch (e) {} finally { setLoadingCharts(false); }
  };

  useEffect(() => { if (activeTab === 'dashboard') loadDashboard(); }, [activeTab]);

  if (!history) return <div className="loading-screen"><div className="loading-spinner" /></div>;

  const p = history.patient;

  return (
    <div className="animate-up">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/doctor/patients')}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, color: 'white' }}>{p.full_name?.charAt(0)}</div>
            <div>
              <h2 className="page-title">{p.full_name}</h2>
              <p className="page-subtitle">{p.patient_code} · {p.gender} · DOB: {p.date_of_birth} · Blood: {p.blood_type}</p>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowRxModal(true)}>💊 Add Rx</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowRecordModal(true)}>📋 Add Record</button>
        </div>
      </div>

      {/* Allergies / conditions banner */}
      {(p.allergies || p.chronic_conditions) && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {p.allergies && <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: 'var(--radius-md)', padding: '8px 14px', fontSize: 12, color: 'var(--accent-rose)' }}>⚠️ Allergies: {p.allergies}</div>}
          {p.chronic_conditions && <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 'var(--radius-md)', padding: '8px 14px', fontSize: 12, color: 'var(--accent-amber)' }}>🏥 Conditions: {p.chronic_conditions}</div>}
        </div>
      )}

      {/* Tabs */}
      <div className="tab-nav">
        {[['overview', '📊 Overview'], ['records', '📋 Records'], ['prescriptions', '💊 Prescriptions'], ['vcf', '🧬 Genomic Analysis'], ['vitals', '💓 Vitals'], ['dashboard', '📈 R Dashboard'], ['rag', '🤖 AI Query']].map(([t, label]) => (
          <button key={t} className={`tab-btn ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>{label}</button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="animate-up">
          <div className="grid-2">
            <div className="card"><div className="card-header"><span className="card-title">Patient Info</span></div><div className="card-body">
              {[['Code', p.patient_code], ['DOB', p.date_of_birth], ['Gender', p.gender], ['Blood Type', p.blood_type], ['Insurance', p.insurance_id], ['Emergency', p.emergency_contact]].map(([k, v]) => v && (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                  <span style={{ fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div></div>
            <div className="card"><div className="card-header"><span className="card-title">Summary</span></div><div className="card-body">
              {[['Medical Records', history.medical_records.length], ['Prescriptions', history.prescriptions.length], ['VCF Analyses', history.vcf_analyses.length], ['Vitals Entries', history.vitals.length], ['Nurse Reports', history.nurse_reports.length]].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>{v}</span>
                </div>
              ))}
            </div></div>
          </div>
          {/* Latest vitals */}
          {history.vitals.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-header"><span className="card-title">Latest Vitals</span><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{history.vitals[0].recorded_at?.slice(0, 16).replace('T', ' ')} · {history.vitals[0].nurse_name}</span></div>
              <div className="card-body">
                <div className="vitals-grid">
                  {[['♥', history.vitals[0].heart_rate, 'bpm', 'HR', 'var(--accent-rose)'], ['🩸', `${history.vitals[0].systolic_bp}/${history.vitals[0].diastolic_bp}`, 'mmHg', 'Blood Pressure', 'var(--accent-blue)'], ['🌡️', history.vitals[0].temperature, '°C', 'Temperature', 'var(--accent-amber)'], ['💨', history.vitals[0].oxygen_saturation, '%', 'SpO₂', 'var(--accent-emerald)'], ['💨', history.vitals[0].respiratory_rate, '/min', 'Resp. Rate', 'var(--accent-cyan)']].map(([icon, val, unit, label, color]) => (
                    <div key={label} className="vital-card">
                      <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
                      <div className="vital-value" style={{ color }}>{val || '—'}</div>
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

      {/* Records tab */}
      {activeTab === 'records' && (
        <div className="animate-up">
          {history.medical_records.map(r => (
            <div key={r.id} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '14px 16px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</span>
                    <span className="badge badge-adjust">{r.record_type}</span>
                    {r.severity === 'critical' && <span className="badge badge-critical">Critical</span>}
                  </div>
                  {r.diagnosis && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Dx: {r.diagnosis} {r.icd_code && <span style={{ color: 'var(--text-muted)' }}>({r.icd_code})</span>}</div>}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.description}</div>
                </div>
                <div style={{ textAlign: 'right', marginLeft: 12, flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.created_at?.slice(0, 10)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.doctor_name}</div>
                  <BlockchainBadge hash={r.blockchain_hash} />
                </div>
              </div>
            </div>
          ))}
          {history.medical_records.length === 0 && <div className="empty-state"><div className="empty-icon">📋</div><div className="empty-title">No records yet</div></div>}
        </div>
      )}

      {/* Prescriptions tab */}
      {activeTab === 'prescriptions' && (
        <div className="animate-up">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowRxModal(true)}>+ Add Prescription</button>
          </div>
          {history.prescriptions.map(rx => (
            <div key={rx.id} className={`prescription-card ${(rx.pgx_risk_label || '').toLowerCase().replace(' ', '_')}`} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{rx.drug_name}</span>
                    <RiskBadge risk={rx.pgx_risk_label} />
                    {rx.pgx_severity && <SeverityBadge severity={rx.pgx_severity} />}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>{rx.dosage} · {rx.frequency} · {rx.duration}</div>
                  {rx.instructions && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{rx.instructions}</div>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                  <span className="badge badge-active" style={{ marginBottom: 6, display: 'block' }}>{rx.status}</span>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rx.created_at?.slice(0, 10)}</div>
                  <BlockchainBadge hash={rx.blockchain_hash} />
                </div>
              </div>
            </div>
          ))}
          {history.prescriptions.length === 0 && <div className="empty-state"><div className="empty-icon">💊</div><div className="empty-title">No prescriptions yet</div></div>}
        </div>
      )}

      {/* VCF analyses tab */}
      {activeTab === 'vcf' && (
        <div className="animate-up">
          <VCFAnalysisTab patientId={parseInt(id)} existingAnalyses={history.vcf_analyses} />
        </div>
      )}

      {/* Vitals tab */}
      {activeTab === 'vitals' && (
        <div className="animate-up">
          <div className="card">
            <div className="card-header"><span className="card-title">Vitals History</span></div>
            <div className="table-container">
              <table>
                <thead><tr><th>Date/Time</th><th>HR (bpm)</th><th>BP (mmHg)</th><th>Temp (°C)</th><th>SpO₂ (%)</th><th>Resp.</th><th>Nurse</th></tr></thead>
                <tbody>
                  {history.vitals.map(v => (
                    <tr key={v.id}>
                      <td style={{ fontSize: 12 }}>{v.recorded_at?.slice(0, 16).replace('T', ' ')}</td>
                      <td style={{ color: 'var(--accent-rose)', fontWeight: 600 }}>{v.heart_rate}</td>
                      <td>{v.systolic_bp}/{v.diastolic_bp}</td>
                      <td>{v.temperature}</td>
                      <td style={{ color: v.oxygen_saturation < 95 ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>{v.oxygen_saturation}</td>
                      <td>{v.respiratory_rate}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v.nurse_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {history.vitals.length === 0 && <div className="empty-state"><div className="empty-icon">💓</div><div className="empty-title">No vitals recorded</div></div>}
            </div>
          </div>
        </div>
      )}

      {/* R Dashboard tab */}
      {activeTab === 'dashboard' && (
        <div className="animate-up">
          {loadingCharts ? (
            <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto 12px' }} /><p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Generating dashboard charts...</p></div>
          ) : dashboardCharts ? (
            <div>
              <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>Rendered via: {dashboardCharts.method}</div>
              {dashboardCharts.vitals && (
                <div className="card" style={{ marginBottom: 16 }}>
                  <div className="card-header"><span className="card-title">📈 Vitals Trend Analysis</span></div>
                  <div className="card-body" style={{ padding: 0 }}>
                    <img src={`data:image/png;base64,${dashboardCharts.vitals}`} alt="Vitals Chart" style={{ width: '100%', display: 'block' }} />
                  </div>
                </div>
              )}
              {dashboardCharts.risk && (
                <div className="card">
                  <div className="card-header"><span className="card-title">🧬 Risk Distribution Dashboard</span></div>
                  <div className="card-body" style={{ padding: 0 }}>
                    <img src={`data:image/png;base64,${dashboardCharts.risk}`} alt="Risk Chart" style={{ width: '100%', display: 'block' }} />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state"><div className="empty-icon">📊</div><div className="empty-title">No dashboard data</div><div className="empty-desc">Charts will appear once the patient has vitals and analyses</div></div>
          )}
        </div>
      )}

      {/* RAG AI Query tab */}
      {activeTab === 'rag' && (
        <div className="animate-up">
          <div className="card">
            <div className="card-header">
              <span className="card-title">🤖 AI Clinical Assistant</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>RAG-powered queries on {p.full_name}'s data</span>
            </div>
            <RAGChat patientId={parseInt(id)} contextLabel={p.full_name} />
          </div>
        </div>
      )}

      {/* Add Prescription Modal */}
      {showRxModal && <AddPrescriptionModal patientId={id} onClose={() => setShowRxModal(false)} onSave={() => { setShowRxModal(false); authFetch(`/doctor/patient/${id}/history`).then(r => r.json()).then(setHistory); }} authFetch={authFetch} />}
      {/* Add Record Modal */}
      {showRecordModal && <AddRecordModal patientId={id} onClose={() => setShowRecordModal(false)} onSave={() => { setShowRecordModal(false); authFetch(`/doctor/patient/${id}/history`).then(r => r.json()).then(setHistory); }} authFetch={authFetch} />}
    </div>
  );
}

// ── VCF Analysis Tab ───────────────────────────────────────────
function VCFAnalysisTab({ patientId, existingAnalyses }) {
  const { authFetch, BASE_URL, token } = useAuth();
  const fileInputRef = React.useRef(null);
  const [vcfFile, setVcfFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [scanStatus, setScanStatus] = useState(null);
  const [scanError, setScanError] = useState('');
  const [availableDrugs, setAvailableDrugs] = useState([]);
  const [unavailableDrugs, setUnavailableDrugs] = useState([]);
  const [selectedDrugs, setSelectedDrugs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  const handleFile = async (file) => {
    if (!file) return;
    setVcfFile(file);
    setScanStatus('scanning');
    setScanError('');
    setAvailableDrugs([]);
    setUnavailableDrugs([]);
    setSelectedDrugs([]);
    setResults([]);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${BASE_URL}/detect_drugs/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (res.ok) {
        const data = await res.json();
        // Backend returns [{drug,gene,variants_found}] — extract name strings
        setAvailableDrugs((data.available_drugs || []).map(d => typeof d === 'string' ? d : d.drug));
        setUnavailableDrugs((data.unavailable_drugs || []).map(d => typeof d === 'string' ? d : d.drug));
        setScanStatus('done');
      } else {
        setScanStatus('error');
        setScanError('Server could not process this VCF file.');
      }
    } catch (e) {
      setScanStatus('error');
      setScanError('Network error — check backend is running.');
    }
  };

  const removeFile = () => {
    setVcfFile(null);
    setScanStatus(null);
    setScanError('');
    setAvailableDrugs([]);
    setUnavailableDrugs([]);
    setSelectedDrugs([]);
    setResults([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleDrug = (drug) => {
    setSelectedDrugs(prev => prev.includes(drug) ? prev.filter(d => d !== drug) : [...prev, drug]);
  };

  const runAnalysis = async () => {
    if (!vcfFile || selectedDrugs.length === 0) return;
    setIsLoading(true);
    setError('');
    const newResults = [];
    for (const drug of selectedDrugs) {
      const fd = new FormData();
      fd.append('file', vcfFile);
      try {
        const r = await authFetch(`/doctor/patient/${patientId}/vcf-analysis?drug=${drug}`, { method: 'POST', body: fd });
        if (r.ok) newResults.push(await r.json());
        else newResults.push({ _drug: drug, error: 'Analysis failed' });
      } catch (e) { newResults.push({ _drug: drug, error: e.message }); }
    }
    setResults(newResults);
    setIsLoading(false);
  };

  const fmt = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div>
      <div className="grid-2" style={{ gap: 20 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">🧬 Upload & Analyze VCF</span></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Drop zone */}
            {!vcfFile && (
              <div
                style={{ border: `2px dashed ${isDragging ? 'var(--accent-cyan)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-md)', padding: '32px 16px', textAlign: 'center', cursor: 'pointer', background: isDragging ? 'rgba(6,182,212,0.05)' : 'var(--bg-secondary)', transition: 'all 0.2s', userSelect: 'none' }}
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              >
                <div style={{ fontSize: 32, marginBottom: 10, filter: 'drop-shadow(0 0 8px rgba(6,182,212,0.4))' }}>🧬</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Drop VCF file here or click to browse</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>.vcf or .vcf.gz supported</div>
              </div>
            )}
            {/* File card */}
            {vcfFile && (
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 22 }}>📄</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vcfFile.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmt(vcfFile.size)}</div>
                  </div>
                  <button onClick={removeFile} style={{ background: 'transparent', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, padding: '3px 8px' }}>✕</button>
                </div>
                {scanStatus === 'scanning' && (
                  <div style={{ padding: '10px 14px', background: 'rgba(6,182,212,0.05)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--accent-cyan)' }}>
                    <div className="spinner" /><span>Scanning VCF for pharmacogenes…</span>
                  </div>
                )}
                {scanStatus === 'done' && (
                  <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.06)', fontSize: 12, color: 'var(--accent-emerald)', fontWeight: 600 }}>
                    {availableDrugs.length} drugs available for analysis
                  </div>
                )}
                {scanStatus === 'error' && (
                  <div style={{ padding: '10px 14px', background: 'rgba(244,63,94,0.06)', fontSize: 12, color: 'var(--accent-rose)', fontWeight: 600 }}>⚠️ {scanError}</div>
                )}
              </div>
            )}
            {/* Hidden file input — ref-based, no global id */}
            <input ref={fileInputRef} type="file" accept=".vcf,.gz" style={{ display: 'none' }}
              onChange={(e) => { if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]); }} />
            {/* Medicine Search Box — RxNorm powered */}
            <DrugSearchBox
              selectedDrugs={selectedDrugs}
              onAddDrug={(drug) => setSelectedDrugs(prev => prev.includes(drug) ? prev.filter(d => d !== drug) : [...prev, drug])}
            />
            {error && <div style={{ color: 'var(--accent-rose)', fontSize: 12 }}>⚠️ {error}</div>}
            <button className="btn btn-primary" onClick={runAnalysis} disabled={!vcfFile || selectedDrugs.length === 0 || isLoading || scanStatus === 'scanning'}>
              {isLoading ? <><div className="spinner" /> Analyzing...</> : `🧬 Analyze ${selectedDrugs.length} Drug${selectedDrugs.length !== 1 ? 's' : ''} & Save`}
            </button>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Analysis Results</span>
            {results.length > 0 && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => generatePGxPDF(results, results[0]?.patient_id || 'PATIENT')}
                style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}
              >
                📄 Download PDF Report
              </button>
            )}
          </div>
          <div className="card-body">
            {results.length > 0 ? results.map((r, i) => (
              <div key={i} style={{ marginBottom: 16, padding: 12, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700 }}>{r.drug || r._drug}</span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {r.confidence && <ConfidenceMeter confidence={r.confidence} compact />}
                    {r.risk_assessment && <RiskBadge risk={r.risk_assessment.risk_label} />}
                  </div>
                </div>
                {r.pharmacogenomic_profile?.[0] && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Gene: {r.pharmacogenomic_profile[0].primary_gene} · {r.pharmacogenomic_profile[0].diplotype} · Phenotype: {r.pharmacogenomic_profile[0].phenotype}</div>}
                {r.clinical_recommendation && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{r.clinical_recommendation.recommendation}</div>}
                {r.blockchain_hash && <div style={{ marginTop: 6 }}><BlockchainBadge hash={r.blockchain_hash} /></div>}
                {r.error && <div style={{ color: 'var(--accent-rose)', fontSize: 12 }}>Error: {r.error}</div>}
                {/* Expanded detail — gene mechanism, why unsafe, substitutes */}
                {!r.error && <PGxResultDetail result={r} />}
              </div>
            )) : <div className="empty-state"><div className="empty-icon">🧬</div><div className="empty-title">Run an analysis to see results</div></div>}
          </div>
        </div>
      </div>
      {existingAnalyses?.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header"><span className="card-title">Past Analyses ({existingAnalyses.length})</span></div>
          <div className="table-container">
            <table>
              <thead><tr><th>Drug</th><th>Risk</th><th>Severity</th><th>Gene</th><th>Diplotype</th><th>Phenotype</th><th>Recommendation</th><th>Date</th><th>Blockchain</th></tr></thead>
              <tbody>
                {existingAnalyses.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.drug}</td>
                    <td><RiskBadge risk={a.risk_label} /></td>
                    <td><SeverityBadge severity={a.severity} /> {a.severity}</td>
                    <td><span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{a.primary_gene}</span></td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{a.diplotype}</td>
                    <td>{a.phenotype}</td>
                    <td style={{ maxWidth: 200, fontSize: 12 }}>{a.recommendation}</td>
                    <td style={{ fontSize: 11 }}>{a.created_at?.slice(0, 10)}</td>
                    <td><BlockchainBadge hash={a.blockchain_hash} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add Prescription Modal ─────────────────────────────────────
function AddPrescriptionModal({ patientId, onClose, onSave, authFetch }) {
  const [form, setForm] = useState({ drug_name: '', dosage: '', frequency: '', duration: '', instructions: '', pgx_risk_label: '', pgx_severity: '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await authFetch(`/doctor/patient/${patientId}/prescription`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      onSave();
    } catch (e) { alert('Error saving prescription'); } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><span className="modal-title">💊 Add Prescription</span><button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Drug Name *</label><input className="form-input" value={form.drug_name} onChange={e => setForm(f => ({ ...f, drug_name: e.target.value }))} placeholder="e.g. Warfarin" /></div>
            <div className="form-group"><label className="form-label">Dosage *</label><input className="form-input" value={form.dosage} onChange={e => setForm(f => ({ ...f, dosage: e.target.value }))} placeholder="e.g. 5mg" /></div>
            <div className="form-group"><label className="form-label">Frequency *</label><input className="form-input" value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))} placeholder="e.g. Once daily" /></div>
            <div className="form-group"><label className="form-label">Duration</label><input className="form-input" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="e.g. 30 days" /></div>
            <div className="form-group"><label className="form-label">PGx Risk</label>
              <select className="form-select" value={form.pgx_risk_label} onChange={e => setForm(f => ({ ...f, pgx_risk_label: e.target.value }))}>
                <option value="">None</option><option>Safe</option><option>Adjust Dosage</option><option>Toxic</option><option>Ineffective</option><option>Unknown</option>
              </select>
            </div>
            <div className="form-group"><label className="form-label">PGx Severity</label>
              <select className="form-select" value={form.pgx_severity} onChange={e => setForm(f => ({ ...f, pgx_severity: e.target.value }))}>
                <option value="">None</option><option value="none">None</option><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option><option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div className="form-group"><label className="form-label">Instructions</label><textarea className="form-textarea" value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} placeholder="Patient instructions..." /></div>
        </div>
        <div className="modal-footer"><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.drug_name}>{saving ? 'Saving...' : 'Save Prescription'}</button></div>
      </div>
    </div>
  );
}

// ── Add Record Modal ───────────────────────────────────────────
function AddRecordModal({ patientId, onClose, onSave, authFetch }) {
  const [form, setForm] = useState({ record_type: 'diagnosis', title: '', description: '', diagnosis: '', icd_code: '', severity: 'moderate', notes: '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await authFetch(`/doctor/patient/${patientId}/record`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      onSave();
    } catch (e) { alert('Error saving record'); } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><span className="modal-title">📋 Add Medical Record</span><button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Type</label>
              <select className="form-select" value={form.record_type} onChange={e => setForm(f => ({ ...f, record_type: e.target.value }))}>
                <option value="diagnosis">Diagnosis</option><option value="lab">Lab Results</option><option value="imaging">Imaging</option><option value="surgery">Surgery</option><option value="urgent">Urgent Care</option><option value="follow_up">Follow-up</option>
              </select>
            </div>
            <div className="form-group"><label className="form-label">Severity</label>
              <select className="form-select" value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
                <option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option><option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div className="form-group"><label className="form-label">Title *</label><input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Record title" /></div>
          <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detailed description..." /></div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Diagnosis</label><input className="form-input" value={form.diagnosis} onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))} placeholder="Clinical diagnosis" /></div>
            <div className="form-group"><label className="form-label">ICD Code</label><input className="form-input" value={form.icd_code} onChange={e => setForm(f => ({ ...f, icd_code: e.target.value }))} placeholder="e.g. I10" /></div>
          </div>
        </div>
        <div className="modal-footer"><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.title}>{saving ? 'Saving...' : 'Save Record'}</button></div>
      </div>
    </div>
  );
}

// ── VCF Standalone Page ────────────────────────────────────────
function VCFPage() {
  const { BASE_URL, token } = useAuth();
  const fileInputRef = React.useRef(null);
  const [vcfFile, setVcfFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [scanStatus, setScanStatus] = useState(null); // null|'scanning'|'done'|'error'
  const [scanError, setScanError] = useState('');
  const [selectedDrugs, setSelectedDrugs] = useState([]);
  const [availableDrugs, setAvailableDrugs] = useState([]);
  const [unavailableDrugs, setUnavailableDrugs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [activeResultDrug, setActiveResultDrug] = useState(null);
  const [viewMode, setViewMode] = useState('patient');
  const [ddiWarnings, setDdiWarnings] = useState([]);
  const [ddiChecking, setDdiChecking] = useState(false);
  const [recentAnalyses] = useState([
    { name: 'PATIENT_001', sub: '3 drugs • risk', date: new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) },
    { name: 'PATIENT_001', sub: '2 drugs • risk', date: new Date(Date.now() - 86400000).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) },
  ]);
  const toast = useToast();

  // DDI check whenever selectedDrugs changes
  useEffect(() => {
    if (selectedDrugs.length < 2) { setDdiWarnings([]); return; }
    setDdiChecking(true);
    fetch(`${BASE_URL}/drug-interactions/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ drugs: selectedDrugs }),
    }).then(r => r.json()).then(data => {
      setDdiWarnings(data.interactions || []);
      if ((data.interactions || []).some(i => i.severity === 'major')) {
        toast.error(`⚠️ ${data.interaction_count} major drug interaction(s) detected!`, 6000);
      } else if ((data.interactions || []).length > 0) {
        toast.warning(`⚠️ ${data.interaction_count} drug interaction(s) detected — review before analysis`);
      }
    }).catch(() => setDdiWarnings([])).finally(() => setDdiChecking(false));
  }, [selectedDrugs.join(',')]);

  const handleFile = async (file) => {
    if (!file) return;
    setVcfFile(file);
    setScanStatus('scanning');
    setScanError('');
    setAvailableDrugs([]);
    setUnavailableDrugs([]);
    setSelectedDrugs([]);
    setResults([]);
    setActiveResultDrug(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${BASE_URL}/detect_drugs/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (res.ok) {
        const data = await res.json();
        // Backend returns [{drug,gene,variants_found}] — extract name strings
        setAvailableDrugs((data.available_drugs || []).map(d => typeof d === 'string' ? d : d.drug));
        setUnavailableDrugs((data.unavailable_drugs || []).map(d => typeof d === 'string' ? d : d.drug));
        setScanStatus('done');
      } else {
        setScanStatus('error');
        setScanError('Could not process this VCF file.');
      }
    } catch (e) {
      setScanStatus('error');
      setScanError('Network error — check backend is running.');
    }
  };

  const removeFile = () => {
    setVcfFile(null);
    setScanStatus(null);
    setScanError('');
    setAvailableDrugs([]);
    setUnavailableDrugs([]);
    setSelectedDrugs([]);
    setResults([]);
    setActiveResultDrug(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleDrug = (drug) => {
    setSelectedDrugs(prev => prev.includes(drug) ? prev.filter(d => d !== drug) : [...prev, drug]);
  };

  const fmt = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes/1024).toFixed(1)} KB`;
    return `${(bytes/1048576).toFixed(1)} MB`;
  };

  // Derive current step
  const currentStep = !vcfFile ? 1 : scanStatus === 'scanning' ? 1 : availableDrugs.length === 0 ? 2 : selectedDrugs.length === 0 ? 3 : results.length > 0 ? 4 : 3;

  const runAnalysis = async () => {
    if (!vcfFile || selectedDrugs.length === 0) return;
    setIsLoading(true);
    setError('');
    toast.info(`🧬 Analyzing ${selectedDrugs.length} drug(s)...`, 3000);
    const newResults = [];
    for (const drug of selectedDrugs) {
      const fd = new FormData();
      fd.append('file', vcfFile);
      try {
        const r = await fetch(`${BASE_URL}/process_vcf/?drug=${drug}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (r.ok) newResults.push({ ...(await r.json()), _drug: drug });
        else newResults.push({ _drug: drug, error: 'Failed' });
      } catch (e) {
        newResults.push({ _drug: drug, error: e.message });
      }
    }
    setResults(newResults);
    setIsLoading(false);
    if (newResults.length > 0) {
      setActiveResultDrug(newResults[0]._drug || newResults[0].drug);
      const toxicCount = newResults.filter(r => r.risk_assessment?.risk_label === 'Toxic').length;
      if (toxicCount > 0) toast.error(`⚠️ ${toxicCount} TOXIC risk result(s) detected — immediate review required!`);
      else toast.success(`✓ Analysis complete — ${newResults.length} drug(s) processed successfully`);
    }
  };

  const activeResult = results.find(r => (r._drug || r.drug) === activeResultDrug);
  const allGenes = ['CYP2D6', 'CYP2C19', 'CYP2C9', 'SLC01B1', 'TPMT', 'DPYD'];

  // Build risk matrix from results
  const riskMatrix = {};
  allGenes.forEach(gene => { riskMatrix[gene] = {}; });
  results.forEach(r => {
    const drug = r._drug || r.drug;
    const profiles = r.pharmacogenomic_profile || [];
    profiles.forEach(p => {
      if (riskMatrix[p.primary_gene]) {
        riskMatrix[p.primary_gene][drug] = r.risk_assessment?.risk_label || 'No PGx Data';
      }
    });
  });

  const getRiskClass = (label) => {
    if (!label || label === 'No PGx Data') return 'nopgx';
    if (label === 'Safe') return 'safe';
    if (label === 'Adjust Dosage') return 'adjust';
    if (label === 'Toxic') return 'toxic';
    return 'nopgx';
  };

  const getRiskIcon = (label) => {
    if (!label || label === 'No PGx Data') return '—';
    if (label === 'Safe') return '✓';
    if (label === 'Adjust Dosage') return '⚠';
    if (label === 'Toxic') return '✕';
    return '—';
  };

  // Detected variants — from all results combined
  const rawVariants = results.flatMap(r =>
    (r.pharmacogenomic_profile || []).flatMap(p =>
      (p.detected_variants || p.variants || []).map(v => ({ 
        gene: (v.gene && v.gene !== 'Unknown') ? v.gene : p.primary_gene, 
        rsid: v.rsid || v 
      }))
    )
  );

  // Deduplicate variants
  const uniqueRSIDs = new Set();
  const allVariants = [];
  rawVariants.forEach(v => {
    if (!uniqueRSIDs.has(v.rsid)) {
      uniqueRSIDs.add(v.rsid);
      allVariants.push(v);
    }
  });

  return (
    <div className="animate-up" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      {/* ── Left Panel: Analysis Console ── */}
      <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Step indicator */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">🔬 Analysis Console</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Configure your pharmacogenomic analysis</span>
          </div>
          <div className="card-body" style={{ paddingBottom: 8 }}>
            <div className="analysis-steps">
              {[
                [1, 'Upload VCF'],
                [2, 'Detect Genes'],
                [3, 'Select Drugs'],
                [4, 'View Results'],
              ].map(([n, label]) => (
                <div key={n} className={`analysis-step${currentStep === n ? ' active' : currentStep > n ? ' done' : ''}`}>
                  <div className="analysis-step-num">{currentStep > n ? '✓' : n}</div>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* VCF Upload + Drug Selection — inline, self-contained */}
        <div className="card">
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Drop zone */}
            {!vcfFile && (
              <div
                style={{ border: `2px dashed ${isDragging ? 'var(--accent-cyan)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-md)', padding: '28px 16px', textAlign: 'center', cursor: 'pointer', background: isDragging ? 'rgba(6,182,212,0.05)' : 'var(--bg-secondary)', transition: 'all 0.2s', userSelect: 'none' }}
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              >
                <div style={{ fontSize: 28, marginBottom: 8, filter: 'drop-shadow(0 0 8px rgba(6,182,212,0.4))' }}>🧬</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Drop VCF file here or click to browse</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>.vcf or .vcf.gz supported</div>
              </div>
            )}
            {/* File card */}
            {vcfFile && (
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 20 }}>📄</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vcfFile.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmt(vcfFile.size)}</div>
                  </div>
                  <button onClick={removeFile} style={{ background: 'transparent', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: '2px 7px' }}>✕</button>
                </div>
                {scanStatus === 'scanning' && (
                  <div style={{ padding: '8px 12px', background: 'rgba(6,182,212,0.05)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--accent-cyan)' }}>
                    <div className="spinner" /><span>Scanning pharmacogenes…</span>
                  </div>
                )}
                {scanStatus === 'done' && (
                  <div style={{ padding: '8px 12px', background: 'rgba(16,185,129,0.06)', fontSize: 12, color: 'var(--accent-emerald)', fontWeight: 600 }}>✅ {availableDrugs.length} drugs detected</div>
                )}
                {scanStatus === 'error' && (
                  <div style={{ padding: '8px 12px', background: 'rgba(244,63,94,0.06)', fontSize: 12, color: 'var(--accent-rose)', fontWeight: 600 }}>⚠️ {scanError}</div>
                )}
              </div>
            )}
            {/* Hidden file input */}
            <input ref={fileInputRef} type="file" accept=".vcf,.gz" style={{ display: 'none' }}
              onChange={(e) => { if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]); }} />
            {/* Medicine Search Box — RxNorm powered */}
            <DrugSearchBox
              selectedDrugs={selectedDrugs}
              onAddDrug={(drug) => setSelectedDrugs(prev => prev.includes(drug) ? prev.filter(d => d !== drug) : [...prev, drug])}
            />
            {error && <div style={{ color: 'var(--accent-rose)', fontSize: 12 }}>⚠️ {error}</div>}
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={runAnalysis}
              disabled={!vcfFile || selectedDrugs.length === 0 || isLoading || scanStatus === 'scanning'}>
              {isLoading ? <><div className="spinner" /> Analyzing...</> : `▶ Analyze ${selectedDrugs.length || 0} Drug${selectedDrugs.length !== 1 ? 's' : ''} →`}
            </button>
          </div>
        </div>

        {/* Recent Analyses */}
        <div className="card">
          <div className="card-header"><span className="card-title">Recent Analyses</span></div>
          <div className="card-body" style={{ padding: '8px 0' }}>
            <div className="recent-analyses-list">
              {recentAnalyses.map((a, i) => (
                <div key={i} className="recent-analysis-item">
                  <div className="recent-analysis-dot" />
                  <div style={{ flex: 1 }}>
                    <div className="recent-analysis-name">{a.name}</div>
                    <div className="recent-analysis-sub">{a.sub}</div>
                  </div>
                  <div className="recent-analysis-date">{a.date}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Panel: Results ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {results.length === 0 ? (
          <div className="card" style={{ flex: 1 }}>
            <div className="card-body">
              <div className="empty-state" style={{ padding: 80 }}>
                <div className="empty-icon" style={{ fontSize: 56, opacity: 0.4 }}>🧬</div>
                <div className="empty-title">Upload a VCF file to begin analysis</div>
                <div className="empty-desc">Select drugs and click Analyze to see your pharmacogenomic report</div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Drug tabs */}
            <div className="card">
              <div className="result-drug-tabs">
                {results.map(r => {
                  const drug = r._drug || r.drug;
                  return (
                    <button
                      key={drug}
                      className={`result-drug-tab${activeResultDrug === drug ? ' active' : ''}`}
                      onClick={() => { setActiveResultDrug(drug); setViewMode('patient'); }}
                    >
                      🧬 {drug}
                    </button>
                  );
                })}
                <button
                  className={`result-drug-tab${viewMode === 'matrix' ? ' active' : ''}`}
                  onClick={() => setViewMode('matrix')}
                >
                  ⊞ Risk Matrix
                </button>
              </div>

              {viewMode === 'matrix' ? (
                /* ── Gene × Drug Risk Matrix ── */
                <div className="card-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <span className="card-title">⊞ Gene × Drug Risk Matrix</span>
                    <button className="btn btn-ghost btn-sm">⬇ Export PNG</button>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="risk-matrix-table">
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left' }}>GENE</th>
                          {results.map(r => <th key={r._drug || r.drug}>{r._drug || r.drug}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {allGenes.map(gene => (
                          <tr key={gene}>
                            <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', paddingLeft: 8 }}>
                              ⊠ {gene}
                            </td>
                            {results.map(r => {
                              const drug = r._drug || r.drug;
                              const label = riskMatrix[gene]?.[drug];
                              const cls = getRiskClass(label);
                              return (
                                <td key={drug}>
                                  <div className={`risk-matrix-cell ${cls}`}>
                                    <span className="cell-icon">{getRiskIcon(label)}</span>
                                    <span>{label || 'No PGx Data'}</span>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: 16, display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                    <span style={{ color: 'var(--accent-emerald)' }}>✓ Safe</span>
                    <span style={{ color: 'var(--accent-amber)' }}>⚠ Adjust Dosage</span>
                    <span style={{ color: 'var(--text-muted)' }}>— No PGx Data</span>
                  </div>
                </div>
              ) : activeResult ? (
                /* ── Patient Result View ── */
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Patient Record */}
                  <div className="card" style={{ background: 'var(--bg-elevated)' }}>
                    <div className="card-body">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📋</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Patient Record</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                            {activeResult.patient_id || activeResult.filename?.replace('.vcf', '') || 'PATIENT_001'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>🕐 {new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}</span>
                          <span className="badge badge-safe">✓ Verified</span>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Variants</div>
                          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)' }}>
                            {activeResult.pharmacogenomic_profile?.reduce((s, p) => s + ((p.detected_variants || p.variants)?.length || 0), 0) || allVariants.length || '—'}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Genes Analyzed</div>
                          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)' }}>
                            {activeResult.pharmacogenomic_profile?.length || 1}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Risk + Recommendation */}
                  <div className="grid-2" style={{ gap: 12 }}>
                    <div className="card" style={{
                      background: activeResult.risk_assessment?.risk_label === 'Safe'
                        ? 'rgba(16,185,129,0.08)' : activeResult.risk_assessment?.risk_label === 'Adjust Dosage'
                        ? 'rgba(245,158,11,0.08)' : 'var(--bg-elevated)',
                      border: '1px solid ' + (activeResult.risk_assessment?.risk_label === 'Safe'
                        ? 'rgba(16,185,129,0.3)' : activeResult.risk_assessment?.risk_label === 'Adjust Dosage'
                        ? 'rgba(245,158,11,0.3)' : 'var(--border-subtle)'),
                      padding: 16,
                    }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>RISK ASSESSMENT</div>
                      <div style={{ fontSize: 26, fontWeight: 900, color: activeResult.risk_assessment?.risk_label === 'Safe' ? 'var(--accent-emerald)' : activeResult.risk_assessment?.risk_label === 'Adjust Dosage' ? 'var(--accent-amber)' : 'var(--text-primary)' }}>
                        {activeResult.risk_assessment?.risk_label || 'Unknown'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Overall Risk Level</div>
                    </div>
                    <div className="card" style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.2)', padding: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>💊</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Clinical Recommendation</div>
                          <span style={{ fontSize: 10, color: 'var(--accent-amber)', fontWeight: 600 }}>Priority</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{activeResult.clinical_recommendation?.recommendation || 'Standard dosing.'}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 11 }}
                          onClick={() => generatePGxPDF(results, activeResult?.patient_id || 'PATIENT')}
                        >📄 Download PDF Report</button>
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>📋 Copy JSON</button>
                      </div>
                    </div>
                  </div>

                  {/* Confidence Meter — full view in VCF page */}
                  {activeResult.confidence && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 8 }}>🛡️ ANALYSIS CONFIDENCE &amp; EVIDENCE BASIS</div>
                      <ConfidenceMeter confidence={activeResult.confidence} />
                    </div>
                  )}

                  {/* Pharmacogenomic Profile */}
                  {activeResult.pharmacogenomic_profile?.map((p, pi) => (
                    <div key={pi} className="card" style={{ background: 'var(--bg-elevated)' }}>
                      <div className="card-header">
                        <span className="card-title">⊠ Pharmacogenomic Profile</span>
                      </div>
                      <div className="card-body">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>{p.primary_gene}</div>
                          <span className="badge badge-safe" style={{ fontSize: 12 }}>🟢 {p.phenotype}</span>
                          <div style={{ display: 'flex', gap: 16, marginLeft: 'auto', fontSize: 13 }}>
                            <div><span style={{ color: 'var(--text-muted)' }}>Diplotype: </span><span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{p.diplotype}</span></div>
                            <div><span style={{ color: 'var(--text-muted)' }}>Phenotype: </span><span style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>{p.phenotype}</span></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Detected Variants */}
                  {allVariants.length > 0 && (
                    <div className="card">
                      <div className="card-header">
                        <span className="card-title">⊞ Detected Variants</span>
                      </div>
                      <div style={{ padding: '0 4px', maxHeight: '400px', overflowY: 'auto' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)', position: 'sticky', top: 0, background: 'var(--bg-elevated)', zIndex: 10 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>GENE</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>⊞ RSID</span>
                        </div>
                        <div className="variants-list">
                          {allVariants.map((v, i) => (
                            <div key={i} className="variant-row">
                              <div className="variant-gene">
                                <span className="variant-gene-icon">⊠</span>
                                {v.gene}
                              </div>
                              <div className="variant-rsid">{v.rsid}</div>
                              <button className="variant-expand">∨</button>
                            </div>
                          ))}
                        </div>
                        <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                          Showing all {allVariants.length} variants found in VCF ({results.length} drug analyses combined)
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AI Clinical Analysis */}
                  <div className="ai-analysis-card">
                    <div className="ai-analysis-header">
                      <div className="ai-avatar">🤖</div>
                      <div>
                        <div className="ai-analysis-title">AI Clinical Analysis</div>
                        <div className="ai-analysis-subtitle">Generated by PharmaGuard AI</div>
                      </div>
                    </div>
                    <div className="ai-analysis-text">
                      {activeResult.pharmacogenomic_profile?.[0]
                        ? `${activeResult.pharmacogenomic_profile[0].primary_gene} ${activeResult.pharmacogenomic_profile[0].diplotype || ''} results in ${activeResult.pharmacogenomic_profile[0].phenotype || 'NM'} phenotype affecting ${activeResultDrug}.`
                        : `Analysis complete for ${activeResultDrug}. ${activeResult.clinical_recommendation?.recommendation || 'Review clinical recommendations above.'}`
                      }
                    </div>
                    <div className="ai-analysis-badges">
                      <span className="ai-badge evidence">👤 Evidence-based</span>
                      <span className="ai-badge updated">🟡 Updated daily</span>
                    </div>
                  </div>

                  {/* Detailed PGx Explanation — gene mechanism, why unsafe, substitutes */}
                  <div className="card" style={{ background: 'var(--bg-elevated)' }}>
                    <div className="card-header">
                      <span className="card-title">🔬 Pharmacogenomic Explanation & Alternatives</span>
                    </div>
                    <div className="card-body">
                      <PGxResultDetail result={activeResult} />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── RAG Page ───────────────────────────────────────────────────
function RAGPage() {
  return (
    <div className="animate-up">
      <div className="page-header"><h2 className="page-title">🤖 AI Clinical Assistant</h2><p className="page-subtitle">RAG-powered queries across all patient data</p></div>
      <div className="card">
        <div className="card-header"><span className="card-title">Ask a Clinical Question</span></div>
        <RAGChat contextLabel="all patients" />
      </div>
    </div>
  );
}

// ── Doctor Dashboard (R charts for all patients) ───────────────
function DoctorDashboardR() {
  return (
    <div className="animate-up">
      <div className="page-header"><h2 className="page-title">📊 R Analytics Dashboard</h2><p className="page-subtitle">Open an individual patient to view their R-generated charts</p></div>
      <div className="empty-state" style={{ padding: 60 }}>
        <div className="empty-icon">📊</div>
        <div className="empty-title">Select a patient</div>
        <div className="empty-desc">Navigate to a patient's detail page and open the R Dashboard tab to view generated analytics.</div>
      </div>
    </div>
  );
}

// ── Main Router ────────────────────────────────────────────────
export default function DoctorDashboard() {
  return (
    <Routes>
      <Route path="/" element={<DoctorOverview />} />
      <Route path="/patients" element={<PatientList />} />
      <Route path="/patient/:id" element={<PatientDetail />} />
      <Route path="/vcf" element={<VCFPage />} />
      <Route path="/rag" element={<RAGPage />} />
      <Route path="/dashboard" element={<DoctorDashboardR />} />
    </Routes>
  );
}
