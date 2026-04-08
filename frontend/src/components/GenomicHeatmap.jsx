import React, { useRef } from 'react';
import html2canvas from 'html2canvas';

const GENES = ['CYP2D6', 'CYP2C19', 'CYP2C9', 'SLCO1B1', 'TPMT', 'DPYD'];

// Color extraction dictionary for legend usage later
const COLOR_DICT = {
  'bg-[#22c55e]': { label: 'Safe', icon: '✅' },
  'bg-[#eab308]': { label: 'Adjust Dosage', icon: '⚠️' },
  'bg-[#f97316]': { label: 'Ineffective', icon: '❌' },
  'bg-[#ef4444]': { label: 'Toxic', icon: '❌' }
};

const getCellInfo = (gene, drug, result) => {
  if (!result) {
    return {
      status: 'untested',
      color: 'bg-slate-300',
      icon: '⏳',
      label: 'Pending',
      gene,
      drug
    };
  }

  if (result.error) {
    return { status: 'error', error: result.error };
  }
  
  const profile = result.pharmacogenomic_profile?.find(g => g.primary_gene === gene);
  if (!profile) {
    return {
      status: 'no_data',
      color: 'bg-[#6b7280]',
      icon: '➖',
      label: 'No PGx data',
      gene,
      drug
    };
  }

  const riskLabelRaw = result.risk_assessment?.risk_label || result.risk_assessment?.severity || 'Unknown';
  const rl = riskLabelRaw.toLowerCase();
  
  let color = 'bg-[#6b7280]';
  let icon = '➖';
  let genericLabel = 'Unknown';

  if (rl.includes('safe') || rl.includes('standard') || rl.includes('normal')) {
      color = 'bg-[#22c55e]';
      icon = '✅';
      genericLabel = 'Safe';
  } else if (rl.includes('adjust') || rl.includes('moderate') || rl.includes('caution')) {
      color = 'bg-[#eab308]';
      icon = '⚠️';
      genericLabel = 'Adjust Dosage';
  } else if (rl.includes('ineffective') || rl.includes('poor')) {
      color = 'bg-[#f97316]';
      icon = '❌'; 
      genericLabel = 'Ineffective';
  } else if (rl.includes('toxic') || rl.includes('high') || rl.includes('critical') || rl.includes('severe')) {
      color = 'bg-[#ef4444]';
      icon = '❌';
      genericLabel = 'Toxic';
  }
  
  const confidence = result.risk_assessment?.confidence_score || 0;

  return {
    status: 'tested',
    color,
    icon,
    label: riskLabelRaw || genericLabel,
    diplotype: profile.diplotype || 'N/A',
    phenotype: profile.phenotype || 'N/A',
    gene,
    drug,
    confidence
  };
};

const GenomicHeatmap = ({ results = [], inputDrugs = [], isLoading = false, onAnalyze }) => {
  const heatmapRef = useRef(null);
  
  const hasDrugs = inputDrugs && inputDrugs.length > 0;

  const handleExport = async () => {
    if (!heatmapRef.current) return;
    try {
      // Small timeout to ensure any tooltips disappear if triggered by click
      await new Promise(r => setTimeout(r, 100));
      const canvas = await html2canvas(heatmapRef.current, { backgroundColor: '#ffffff', scale: 2 });
      const link = document.createElement('a');
      const patientId = results.find(r => r.patient_id)?.patient_id || 'patient';
      link.download = `pharmaguard_heatmap_${patientId}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Failed to export heatmap', err);
    }
  };

  const legendSet = new Set();

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden w-full relative">
      <style>{`
        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .shimmer-bg {
          animation: shimmer 1.5s infinite linear;
          background: linear-gradient(to right, #f1f5f9 8%, #e2e8f0 18%, #f1f5f9 33%);
          background-size: 800px 100%;
        }
        @keyframes cellFadeScale {
          0% { opacity: 0; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }
        .cell-animate {
          animation: cellFadeScale 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
        }
        /* Mobile horizontal scroll styling */
        .heatmap-scroll::-webkit-scrollbar {
          height: 8px;
        }
        .heatmap-scroll::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 4px;
        }
      `}</style>
      
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-700/50 transition-colors duration-300">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center transition-colors">
            <i className="fas fa-th mr-2 text-indigo-600 dark:text-indigo-400"></i>
            Gene × Drug Risk Matrix
          </h3>
          {hasDrugs && (
            <button 
               onClick={handleExport}
               className="text-xs bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-500 px-3 py-1.5 rounded-lg shadow-sm transition-colors flex items-center"
            >
              <i className="fas fa-download mr-1.5"></i> Export PNG
            </button>
          )}
        </div>
      </div>

      <div className="p-6">
        {!hasDrugs ? (
           <div className="relative p-6 h-64 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/80 flex items-center justify-center overflow-hidden transition-colors duration-300">
             {/* Faded background heatmap mockup */}
             <div className="absolute inset-0 opacity-10 blur-[3px] pointer-events-none grid grid-cols-4 gap-2 p-8">
                {Array.from({length: 24}).map((_, i) => (
                   <div key={i} className={`rounded-xl ${i % 3 === 0 ? 'bg-[#ef4444]' : i % 5 === 0 ? 'bg-[#eab308]' : 'bg-[#22c55e]'}`}></div>
                ))}
             </div>
             <div className="relative z-10 text-center max-w-sm">
                <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 text-indigo-300 dark:text-indigo-400 transition-colors">
                   <i className="fas fa-table-cells-large text-3xl"></i>
                </div>
                <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-100 leading-snug transition-colors">Enter drug names above to generate your personalized risk heatmap</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 transition-colors">The matrix will build dynamically using your validated VCF context.</p>
             </div>
          </div>
        ) : (
          <div ref={heatmapRef} className="bg-white dark:bg-slate-800 p-2 sm:p-4 rounded-xl transition-colors duration-300">
             <div className="heatmap-scroll overflow-x-auto pb-4">
                {/* Dynamically adjust min-width so large columns don't crush */}
                <div className="min-w-fit pr-4">
                  
                  {/* Header Row */}
                  <div className="flex mb-2 sticky top-0 bg-white dark:bg-slate-800 z-20 transition-colors duration-300">
                    <div className="w-24 shrink-0 bg-white dark:bg-slate-800 sticky left-0 z-30 transition-colors duration-300"></div>
                    {inputDrugs.map(drug => (
                      <div key={drug} className="w-24 shrink-0 text-center font-bold text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1 truncate transition-colors" title={drug}>
                        {drug}
                      </div>
                    ))}
                  </div>

                  {/* Grid Rows */}
                  {GENES.map((gene, rowIdx) => {
                    return (
                      <div key={gene} className="flex items-center mb-1.5 relative">
                        <div className="w-24 shrink-0 font-mono text-sm font-semibold text-slate-700 dark:text-slate-200 text-right pr-4 sticky left-0 bg-white dark:bg-slate-800 z-20 shadow-[10px_0_10px_-10px_rgba(0,0,0,0.05)] py-2 transition-colors duration-300">
                          {gene}
                        </div>
                        
                        {inputDrugs.map((drug, colIdx) => {
                          const result = results.find(r => r._drug === drug);
                          const isLoad = (isLoading && !result) || result?.isLoading;
                          
                          let info;
                          if (isLoad) {
                            info = { status: 'loading' };
                          } else {
                            info = getCellInfo(gene, drug, result);
                          }
                          
                          if (info.status === 'tested') legendSet.add(info.color);

                          const delay = (rowIdx * inputDrugs.length + colIdx) * 30;

                          return (
                            <div 
                              key={`${gene}-${drug}`}
                              className="w-24 shrink-0 px-0.5 relative group/cell"
                            >
                              {info.status === 'loading' && (
                                <div className="h-14 w-full shimmer-bg rounded-lg"></div>
                              )}
                              
                              {info.status === 'error' && (
                                <div className="h-14 w-full border-2 border-red-300 bg-red-50 rounded-lg flex flex-col items-center justify-center relative group/err overflow-hidden cell-animate" style={{animationDelay: `${delay}ms`}}>
                                   <div className="flex flex-col items-center justify-center group-hover/err:opacity-0 transition-opacity">
                                      <i className="fas fa-exclamation-circle text-red-400 text-xs mb-0.5"></i>
                                      <span className="text-[9px] font-bold text-red-500 uppercase">Failed</span>
                                   </div>
                                   <button 
                                     onClick={() => onAnalyze && onAnalyze(drug)}
                                     className="absolute inset-0 bg-red-100 flex flex-col items-center justify-center opacity-0 group-hover/err:opacity-100 transition-opacity z-10"
                                   >
                                      <i className="fas fa-redo text-red-600 mb-0.5 text-xs"></i> 
                                      <span className="text-[10px] text-red-700 font-bold uppercase">Retry</span>
                                   </button>
                                </div>
                              )}
                              
                              {(info.status === 'tested' || info.status === 'no_data' || info.status === 'untested') && (
                                <div 
                                  className={`h-14 w-full flex flex-col items-center justify-center rounded-lg relative transition-all duration-200 cell-animate
                                    ${info.color} text-white shadow-sm
                                    ${info.status === 'tested' ? 'cursor-help hover:scale-[1.05] hover:brightness-110 z-10 hover:shadow-md' : 'opacity-80'}
                                  `}
                                  style={{animationDelay: `${delay}ms`}}
                                >
                                  <span className="text-lg drop-shadow-sm leading-none mb-1">{info.icon}</span>
                                  {info.status === 'tested' && (
                                     <span className="text-[9px] font-bold uppercase tracking-wider text-center px-1 leading-tight truncate w-full">
                                       {info.label}
                                     </span>
                                  )}
                                  {info.status === 'untested' && (
                                     <span className="text-[9px] text-slate-100 font-medium">Pending</span>
                                  )}
                                  {info.status === 'no_data' && (
                                     <span className="text-[9px] text-slate-200 font-medium">No PGx Data</span>
                                  )}
                                </div>
                              )}

                              {/* Tooltip */}
                              {info.status === 'tested' && (
                                <div className="absolute z-[100] bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-slate-900/95 backdrop-blur-sm text-white text-xs rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] p-4 opacity-0 pointer-events-none group-hover/cell:opacity-100 transition-opacity duration-200 transform group-hover/cell:-translate-y-1 border border-slate-700">
                                  <div className="font-bold text-[13px] mb-2 text-white flex justify-between items-start border-b border-slate-700 pb-2">
                                     <span>{gene} <span className="text-slate-500 font-normal px-1">×</span> <span className="text-indigo-300">{drug}</span></span>
                                     <span className="text-base leading-none">{info.icon}</span>
                                  </div>
                                  
                                  <div className="space-y-1.5 mb-3">
                                     <div className="flex justify-between items-center"><span className="text-slate-400">Diplotype</span> <span className="font-mono font-medium">{info.diplotype}</span></div>
                                     <div className="flex justify-between items-center"><span className="text-slate-400">Phenotype</span> <span className="text-right max-w-[100px] truncate" title={info.phenotype}>{info.phenotype}</span></div>
                                     <div className="flex justify-between items-center mt-1 pt-1 border-t border-slate-700/50">
                                        <span className="text-slate-400">Risk Level</span> 
                                        <span className="uppercase font-bold tracking-wider text-slate-100">{info.label}</span>
                                     </div>
                                  </div>
                                  
                                  <div className="mt-2 bg-slate-800 rounded-lg p-2 border border-slate-700">
                                     <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-medium tracking-wide uppercase">
                                        <span>Confidence</span>
                                        <span>{Math.round(info.confidence * 100)}%</span>
                                     </div>
                                     <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                                       <div className="bg-indigo-400 h-1.5 rounded-full" style={{ width: `${Math.round(info.confidence * 100)}%` }}></div>
                                     </div>
                                  </div>
                                  
                                  {/* Triangle pointer */}
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900/95 pointer-events-none"></div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
             </div>
          </div>
        )}
      </div>

      {/* Dynamic Legend */}
      {hasDrugs && legendSet.size > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-sm px-6 py-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-600 dark:text-slate-300 transition-colors duration-300">
           <span className="font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest text-[9px] opacity-70">Legend</span>
           {Array.from(legendSet).map(color => {
              const details = COLOR_DICT[color];
              if (!details) return null;
              return (
                <div key={color} className="flex items-center font-medium">
                  <div className={`w-3 h-3 rounded box-border border border-black/10 ${color} mr-2 shadow-sm flex items-center justify-center text-[7px] text-white`}>
                     {details.icon === '✅' ? <i className="fas fa-check"></i> : details.icon === '❌' ? <i className="fas fa-times"></i> : details.icon === '⚠️' ? <i className="fas fa-exclamation"></i> : ''}
                  </div> 
                  {details.label}
                </div>
              );
           })}
           <div className="flex items-center font-medium">
              <div className="w-3 h-3 rounded box-border border border-black/10 bg-[#6b7280] mr-2 shadow-sm flex items-center justify-center text-[7px] text-white">
                <i className="fas fa-minus"></i>
              </div> 
              No PGx Data
           </div>
        </div>
      )}
    </div>
  );
};

export default GenomicHeatmap;
