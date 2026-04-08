// components/DrugInput.jsx
import React, { useState, useRef, useEffect } from 'react';

const SUGGESTED_DRUGS = [
  'CODEINE',
  'WARFARIN',
  'CLOPIDOGREL',
  'SIMVASTATIN',
  'AZATHIOPRINE',
  'FLUOROURACIL'
];

const DRUG_COLORS = {
  'CODEINE': 'from-blue-50 to-blue-100 border-blue-200 text-blue-700',
  'WARFARIN': 'from-purple-50 to-purple-100 border-purple-200 text-purple-700',
  'CLOPIDOGREL': 'from-green-50 to-green-100 border-green-200 text-green-700',
  'SIMVASTATIN': 'from-amber-50 to-amber-100 border-amber-200 text-amber-700',
  'AZATHIOPRINE': 'from-rose-50 to-rose-100 border-rose-200 text-rose-700',
  'FLUOROURACIL': 'from-indigo-50 to-indigo-100 border-indigo-200 text-indigo-700'
};

const DrugInput = ({ selectedDrugs = [], onDrugsChange }) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    setInputValue(e.target.value.toUpperCase());
    setShowSuggestions(true);
  };

  const handleSelect = (drug) => {
    let newSelection;
    if (selectedDrugs.includes(drug)) {
      newSelection = selectedDrugs.filter(d => d !== drug);
    } else {
      newSelection = [...selectedDrugs, drug];
    }
    onDrugsChange(newSelection);
    setInputValue('');
  };

  const handleRemove = (drugToRemove) => {
    onDrugsChange(selectedDrugs.filter(d => d !== drugToRemove));
  };

  const handleManualInput = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const drugs = inputValue.split(',').map(d => d.trim().toUpperCase()).filter(Boolean);
      const validNewDrugs = drugs.filter(d => !selectedDrugs.includes(d));
      if (validNewDrugs.length > 0) {
        onDrugsChange([...selectedDrugs, ...validNewDrugs]);
      }
      setInputValue('');
    }
  };

  const filteredSuggestions = SUGGESTED_DRUGS.filter(
    drug => drug.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <div className="space-y-3" ref={dropdownRef}>
      <div className="flex items-center space-x-2">
        <div className="w-1 h-6 bg-gradient-to-b from-cyan-500 to-blue-500 rounded-full"></div>
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 tracking-wide transition-colors duration-300">
          Medications
        </label>
      </div>

      <div className="relative">
        <div className="relative group p-2 bg-white dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl focus-within:border-blue-400 dark:focus-within:border-blue-500 transition-all duration-300 min-h-[46px] flex flex-wrap items-center gap-2">
          <div className="text-slate-400 dark:text-slate-300 group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400 transition-colors duration-300 pl-2">
            <i className="fas fa-search text-sm"></i>
          </div>

          {selectedDrugs.map(drug => (
            <span key={drug} className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gradient-to-r ${DRUG_COLORS[drug] || 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}>
              {drug}
              <button 
                type="button" 
                onClick={() => handleRemove(drug)}
                className="ml-1 text-current opacity-70 hover:opacity-100 focus:outline-none"
              >
                <i className="fas fa-times"></i>
              </button>
            </span>
          ))}

          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleManualInput}
            onFocus={() => setShowSuggestions(true)}
            placeholder={selectedDrugs.length === 0 ? "Search or enter comma-separated drugs" : ""}
            className="flex-1 min-w-[150px] bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-400 text-slate-700 dark:text-slate-100 font-medium text-sm py-1 transition-colors duration-300"
          />
        </div>

        {showSuggestions && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 absolute w-full z-10 mt-1 max-h-[80vh] overflow-y-auto transition-colors duration-300">
            <div className="py-1">
              {filteredSuggestions.map((drug, index) => {
                const isSelected = selectedDrugs.includes(drug);
                return (
                  <button
                    key={drug}
                    onClick={() => handleSelect(drug)}
                    className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-150 flex items-center justify-between
                             ${index !== filteredSuggestions.length - 1 ? 'border-b border-slate-50 dark:border-slate-700/50' : ''}`}
                  >
                    <span className={`bg-gradient-to-r bg-clip-text ${isSelected ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-slate-700 dark:text-slate-300'} transition-colors duration-300`}>
                      {drug}
                    </span>
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                      {isSelected && <i className="fas fa-check text-xs"></i>}
                    </div>
                  </button>
                );
              })}
              {filteredSuggestions.length === 0 && (
                <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center transition-colors">No drugs found</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DrugInput;