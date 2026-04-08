// components/DrugSelector.jsx — Multi-drug selector with availability status
import React, { useState } from 'react';

const ALL_DRUGS = ['WARFARIN', 'CLOPIDOGREL', 'CODEINE', 'FLUOROURACIL', 'TAMOXIFEN', 'IRINOTECAN', 'AZATHIOPRINE', 'ABACAVIR', 'ALLOPURINOL', 'SIMVASTATIN', 'AMITRIPTYLINE', 'ATOMOXETINE'];

export default function DrugSelector({ availableDrugs, unavailableDrugs, onDrugsSelected, disabled }) {
  const [selected, setSelected] = useState([]);

  const toggle = (drug) => {
    if (disabled) return;
    const next = selected.includes(drug) ? selected.filter(d => d !== drug) : [...selected, drug];
    setSelected(next);
    onDrugsSelected(next);
  };

  const selectAll = () => {
    const next = [...availableDrugs];
    setSelected(next);
    onDrugsSelected(next);
  };

  const clearAll = () => { setSelected([]); onDrugsSelected([]); };

  const displayDrugs = availableDrugs.length > 0 ? [...availableDrugs, ...unavailableDrugs] : ALL_DRUGS;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <label className="form-label" style={{ margin: 0 }}>
          Select Drugs to Analyze
          {availableDrugs.length > 0 && <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--accent-emerald)', fontWeight: 600 }}>({availableDrugs.length} detected in VCF)</span>}
        </label>
        <div style={{ display: 'flex', gap: 4 }}>
          {availableDrugs.length > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={selectAll} disabled={disabled} style={{ fontSize: 11 }}>Select All</button>}
          {selected.length > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll} style={{ fontSize: 11 }}>Clear</button>}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6 }}>
        {displayDrugs.map(drug => {
          const isAvailable = availableDrugs.includes(drug);
          const isUnavailable = unavailableDrugs.includes(drug);
          const isSelected = selected.includes(drug);
          return (
            <button
              key={drug}
              type="button"
              onClick={() => toggle(drug)}
              disabled={disabled || isUnavailable}
              style={{
                padding: '6px 10px', borderRadius: 'var(--radius-md)', fontSize: 11, fontWeight: 600,
                cursor: disabled || isUnavailable ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-sans)',
                border: '1px solid',
                transition: 'all 0.15s',
                background: isSelected ? 'rgba(6,182,212,0.15)' : isAvailable ? 'rgba(16,185,129,0.08)' : isUnavailable ? 'transparent' : 'var(--bg-elevated)',
                borderColor: isSelected ? 'var(--accent-cyan)' : isAvailable ? 'rgba(16,185,129,0.3)' : isUnavailable ? 'var(--border-subtle)' : 'var(--border-default)',
                color: isSelected ? 'var(--accent-cyan)' : isAvailable ? 'var(--accent-emerald)' : isUnavailable ? 'var(--text-muted)' : 'var(--text-secondary)',
                opacity: isUnavailable ? 0.5 : 1,
                textAlign: 'center',
                textDecoration: isUnavailable ? 'line-through' : 'none'
              }}
            >
              {isAvailable && '✓ '}{isSelected && !isAvailable && '● '}{drug}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--accent-cyan)' }}>
          {selected.length} drug{selected.length !== 1 ? 's' : ''} selected: {selected.join(', ')}
        </div>
      )}
    </div>
  );
}
