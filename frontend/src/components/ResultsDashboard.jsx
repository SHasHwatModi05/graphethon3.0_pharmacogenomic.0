// components/ResultsDashboard.jsx
import React from 'react';

const ResultsDashboard = ({ data: rawData }) => {
  const resultsList = Array.isArray(rawData) ? rawData : [rawData];
  const [activeTabIndex, setActiveTabIndex] = React.useState(0);
  
  const data = resultsList[activeTabIndex] || {};

  // console.log(data);
  const [expandedGenes, setExpandedGenes] = React.useState([]);
  const [expandedVariant, setExpandedVariant] = React.useState(null);
  const [variantDetails, setVariantDetails] = React.useState({});
  const [isVariantLoading, setIsVariantLoading] = React.useState(false);

  // PRINT JSON REPORT
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");

    printWindow.document.write(`
      <html>
        <head>
          <title>Pharmacogenomic Report</title>
          <style>
            body {
              font-family: monospace;
              padding: 20px;
              white-space: pre-wrap;
            }
          </style>
        </head>
        <body>
${JSON.stringify(data, null, 2)}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  };

  // COPY JSON TO CLIPBOARD
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(data, null, 2)
      );
      alert("Report copied to clipboard ✅");
    } catch (err) {
      console.log(err);
      alert("Copy failed ❌");
    }
  };


  const toggleGene = (geneId) => {
    setExpandedGenes(prev =>
      prev.includes(geneId)
        ? prev.filter(id => id !== geneId)
        : [...prev, geneId]
    );
  };

  const handleVariantClick = async (rsid) => {
    if (expandedVariant === rsid) {
      setExpandedVariant(null);
      return;
    }
    
    setExpandedVariant(rsid);
    
    if (variantDetails[rsid]) return;

    setIsVariantLoading(true);
    try {
      const response = await fetch(`https://rest.ensembl.org/variation/human/${rsid}?content-type=application/json`);
      if (response.ok) {
        const data = await response.json();
        setVariantDetails(prev => ({...prev, [rsid]: data}));
      } else {
        setVariantDetails(prev => ({...prev, [rsid]: { error: 'Failed to fetch details' }}));
      }
    } catch (err) {
      setVariantDetails(prev => ({...prev, [rsid]: { error: 'Failed to fetch details' }}));
    } finally {
      setIsVariantLoading(false);
    }
  };

  // Normalize backend structure
const riskAssessment = data?.risk_assessment || {};
const severity = riskAssessment?.severity || 'unknown';
const confidencePercent = riskAssessment?.confidence_score
  ? Math.round(riskAssessment.confidence_score * 100)
  : 0;

// Flatten variants from genes
const allVariants =
  data?.pharmacogenomic_profile?.flatMap(gene =>
    gene.detected_variants?.map(variant => ({
      ...variant,
      gene: variant.gene || gene.primary_gene
    })) || []
  ) || [];

  const getSeverityStyles = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'bg-gradient-to-r from-rose-50 to-red-50 border-l-4 border-rose-600 text-rose-900 shadow-rose-100';
      case 'high':
        return 'bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-600 text-amber-900 shadow-amber-100';
      case 'moderate':
        return 'bg-gradient-to-r from-yellow-50 to-amber-50 border-l-4 border-yellow-600 text-yellow-900 shadow-yellow-100';
      default:
        return 'bg-gradient-to-r from-emerald-50 to-green-50 border-l-4 border-emerald-600 text-emerald-900 shadow-emerald-100';
    }
  };

  const getStatusColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'text-rose-700 bg-rose-100';
      case 'high':
        return 'text-amber-700 bg-amber-100';
      case 'moderate':
        return 'text-yellow-700 bg-yellow-100';
      default:
        return 'text-emerald-700 bg-emerald-100';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'fa-circle-exclamation';
      case 'high':
        return 'fa-triangle-exclamation';
      case 'moderate':
        return 'fa-exclamation';
      default:
        return 'fa-circle-check';
    }
  };

  const getGeneActivityColor = (activity) => {
    if (!activity) return 'bg-slate-200';
    if (activity.includes('Poor') || activity.includes('Reduced')) return 'bg-rose-500';
    if (activity.includes('Rapid') || activity.includes('Ultrarapid')) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const calculateRiskScore = () => {
    const criticalCount = data.pharmacogenomic_profile?.filter(g => 
      g.phenotype?.severity?.toLowerCase() === 'critical'
    ).length || 0;
    const highCount = data.pharmacogenomic_profile?.filter(g => 
      g.phenotype?.severity?.toLowerCase() === 'high'
    ).length || 0;
    const moderateCount = data.pharmacogenomic_profile?.filter(g => 
      g.phenotype?.severity?.toLowerCase() === 'moderate'
    ).length || 0;
    
    return { critical: criticalCount, high: highCount, moderate: moderateCount };
  };

  const riskCounts = calculateRiskScore();

  return (
    <div className="space-y-6 bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl transition-colors duration-300">
      {/* Tabs for multi-drug */}
      {resultsList.length > 1 && (
        <div className="flex space-x-2 border-b border-slate-200 overflow-x-auto mb-2">
          {resultsList.map((result, idx) => (
            <button
              key={idx}
              onClick={() => setActiveTabIndex(idx)}
              className={`px-4 py-3 font-medium text-sm transition-all border-b-2 whitespace-nowrap outline-none ${
                activeTabIndex === idx 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <i className="fas fa-pills mr-2"></i>
              {result._drug || `Report ${idx + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* Header with Patient Banner */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors duration-300">
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                <i className="fas fa-hospital-user text-2xl text-white"></i>
              </div>
              <div>
                <p className="text-slate-300 text-sm">Patient Record</p>
                <h1 className="text-2xl font-semibold text-white flex items-center">
                  <i className="fas fa-id-card mr-3 text-slate-400"></i>
                  {data.patient_id}
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <span className="px-3 py-1 bg-white/10 rounded-full text-white text-sm">
                <i className="far fa-clock mr-2"></i>
                {new Date(data.timestamp).toLocaleDateString()}
              </span>
              <span className="px-3 py-1 bg-emerald-500/20 rounded-full text-emerald-300 text-sm">
                <i className="fas fa-check-circle mr-2"></i>
                Verified
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-700">
          <div className="px-6 py-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 transition-colors">Total Variants</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100 transition-colors">{allVariants.length}</p>
          </div>
          <div className="px-6 py-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 transition-colors">Genes Analyzed</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100 transition-colors">{data.pharmacogenomic_profile?.length || 0}</p>
          </div>
          {/* <div className="px-6 py-4">
            <p className="text-xs text-slate-500 mb-1">Findings</p>
            <div className="flex items-center space-x-2">
              {riskCounts.critical > 0 && (
                <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-lg text-xs">
                  {riskCounts.critical} Critical
                </span>
              )}
              {riskCounts.high > 0 && (
                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs">
                  {riskCounts.high} High
                </span>
              )}
            </div>
          </div> */}
        </div>
      </div>

      {/* Main Risk Assessment Card */}
      <div className="grid grid-cols-3 gap-6">
        {/* Risk Level Card */}
        <div className="col-span-1">
          <div className={`${getSeverityStyles(severity)} p-6 rounded-2xl shadow-sm h-full`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium uppercase tracking-wider opacity-70">
                Risk Assessment
              </span>
              <i className={`fas ${getSeverityIcon(severity)} text-2xl`}></i>
            </div>
            <p className="text-3xl font-bold mb-2">{riskAssessment?.risk_label || 'Unknown'}</p>
            <p className="text-sm opacity-80">Overall Risk Level</p>
            
            {/* Confidence Gauge */}
            {/* <div className="mt-6">
              <div className="flex justify-between text-sm mb-1">
                <span>Confidence</span>
                <span className="font-semibold">{confidencePercent}%</span>
              </div>
              <div className="w-full h-2 bg-white/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white rounded-full"
                  style={{ width: `${confidencePercent}%` }}
                ></div>
              </div>
            </div> */}
          </div>
        </div>

        {/* Clinical Recommendation Card */}
        <div className="col-span-2">
          <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-800/90 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 h-full transition-colors duration-300">
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-200 dark:shadow-none">
                <i className="fas fa-stethoscope text-white"></i>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center transition-colors">
                  Clinical Recommendation
                  <span className="ml-2 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-full text-xs">
                    Priority
                  </span>
                </h3>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed transition-colors">{data.clinical_recommendation?.recommendation}</p>
                
                {/* Action Buttons */}
                <div className="mt-4 flex items-center space-x-3">
                  <button
        onClick={handlePrint}
        className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-800 transition-colors"
      >
        <i className="fas fa-print mr-2"></i>
        Print Report
      </button>

      {/* COPY BUTTON */}
      <button
        onClick={handleCopy}
        className="px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition-colors"
      >
        <i className="fas fa-copy mr-2"></i>
        Copy JSON
      </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pharmacogenomic Profile Section */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors duration-300">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-700/50 transition-colors duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 transition-colors">
              <i className="fas fa-dna mr-2 text-cyan-600 dark:text-cyan-400"></i>
              Pharmacogenomic Profile
            </h3>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.pharmacogenomic_profile?.map((gene) => {
              const phenotypeLabel = gene?.phenotype || 'Unknown';
              return (
              <div
                key={gene.primary_gene}
                className="group border border-slate-200 rounded-xl p-4 hover:shadow-lg transition-all duration-200 hover:border-slate-300"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="font-mono font-semibold text-slate-900 text-lg">
                      {gene.primary_gene}
                    </span>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(severity)}`}>
                        <i className={`fas ${getSeverityIcon(severity)} mr-1 text-[10px]`}></i>
                        {phenotypeLabel}
                      </span>
                    </div>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${
                    severity?.toLowerCase() === 'critical' ? 'bg-rose-500 animate-pulse' :
                    severity?.toLowerCase() === 'high' ? 'bg-amber-500' :
                    'bg-emerald-500'
                  }`}></div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm py-1 border-b border-slate-50">
                    <span className="text-slate-500">
                      <i className="fas fa-dice-d6 mr-2 text-slate-400"></i>
                      Diplotype:
                    </span>
                    <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-xs">
                      {gene.diplotype}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">
                      <i className="fas fa-chart-line mr-2 text-slate-400"></i>
                      Phenotype:
                    </span>
                    <span className={`font-medium text-right ${
                      severity?.toLowerCase() === 'critical' ? 'text-rose-600' :
                      severity?.toLowerCase() === 'high' ? 'text-amber-600' :
                      'text-emerald-600'
                    }`}>
                      {phenotypeLabel}
                    </span>
                  </div>
                </div>
              </div>
             );
})}
          </div>
        </div>
      </div>

      {/* Variants Table with Enhanced Styling */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors duration-300">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-700/50 transition-colors duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 transition-colors">
              <i className="fas fa-table mr-2 text-cyan-600 dark:text-cyan-400"></i>
              Detected Variants
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800/80 transition-colors duration-300">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <i className="fas fa-gene mr-2"></i>
                  Gene
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <i className="fas fa-barcode mr-2"></i>
                  RSID
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700 transition-colors duration-300">
              {allVariants.map((variant, index) => (
                <React.Fragment key={index}>
                  <tr 
                    onClick={() => handleVariantClick(variant.rsid)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-6 h-6 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center mr-3 group-hover:bg-cyan-100 dark:group-hover:bg-cyan-900/40 transition-colors">
                          <i className="fas fa-dna text-xs text-slate-500 dark:text-slate-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-400"></i>
                        </div>
                        <span className="text-sm font-mono font-medium text-slate-900 dark:text-slate-200 transition-colors">
                          {variant.gene}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400 font-mono flex items-center justify-between pointer-events-none transition-colors">
                      {variant.rsid}
                      <i className={`fas fa-chevron-down text-slate-400 transition-transform ${expandedVariant === variant.rsid ? 'rotate-180' : ''}`}></i>
                    </td>
                  </tr>
                  {expandedVariant === variant.rsid && (
                    <tr className="bg-slate-50 dark:bg-slate-800/50 transition-colors duration-300">
                      <td colSpan="2" className="px-6 py-4 border-t border-slate-100 dark:border-slate-700">
                        {isVariantLoading && !variantDetails[variant.rsid] ? (
                          <div className="flex items-center justify-center py-4 space-x-2 text-slate-500">
                            <i className="fas fa-spinner fa-spin"></i>
                            <span className="text-sm">Fetching biological details...</span>
                          </div>
                        ) : variantDetails[variant.rsid]?.error ? (
                          <div className="text-sm text-rose-500 py-2 flex items-center">
                            <i className="fas fa-exclamation-circle mr-2"></i>
                            {variantDetails[variant.rsid].error}
                          </div>
                        ) : variantDetails[variant.rsid] ? (
                          <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div>
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Most Severe Consequence</p>
                              <p className="text-sm text-slate-800 bg-white inline-block px-2 py-1 rounded border border-slate-200 capitalize">
                                {variantDetails[variant.rsid].most_severe_consequence ? variantDetails[variant.rsid].most_severe_consequence.replace(/_/g, ' ') : 'Unknown'}
                              </p>
                            </div>
                            {variantDetails[variant.rsid].clinical_significance && variantDetails[variant.rsid].clinical_significance.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Clinical Significance</p>
                                <div className="flex flex-wrap gap-2">
                                  {variantDetails[variant.rsid].clinical_significance.map((sig, i) => (
                                    <span key={i} className="text-xs px-2 py-1 bg-white border border-slate-200 rounded text-slate-700 capitalize">
                                      {sig.replace(/_/g, ' ')}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {variantDetails[variant.rsid].synonyms && variantDetails[variant.rsid].synonyms.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Synonyms / DB Links</p>
                                <p className="text-xs text-slate-600 font-mono leading-relaxed truncate">
                                  {variantDetails[variant.rsid].synonyms.slice(0, 8).join(', ')}
                                  {variantDetails[variant.rsid].synonyms.length > 8 ? '...' : ''}
                                </p>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 transition-colors duration-300">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 transition-colors">
            <span>Showing {allVariants.length} variants</span>
          </div>
        </div>
      </div>

      {/* AI Explanation Panel */}
      {data.llm_generated_explanation && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 overflow-hidden transition-colors duration-300">
          <div
            className="w-full px-6 py-4 flex items-center justify-between text-left transition-colors duration-300"
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                <i className="fas fa-robot text-white text-sm"></i>
              </div>
              <div>
                <span className="font-semibold text-indigo-900">AI Clinical Analysis</span>
                <p className="text-xs text-indigo-600 mt-0.5">Generated by PharmaGuard AI</p>
              </div>
            </div>
          </div>
          
            <div className="px-6 pb-6">
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-4 transition-colors duration-300">
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed transition-colors">
                  {data.llm_generated_explanation.summary}
                </p>
                {data.llm_generated_explanation.details && (
                  <div className="mt-4 pt-4 border-t border-indigo-100 dark:border-indigo-900/50">
                    <p className="text-xs font-medium text-indigo-800 dark:text-indigo-300 mb-2 flex items-center transition-colors">
                      <i className="fas fa-stethoscope mr-2"></i>
                      Detailed Analysis:
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 transition-colors">{data.llm_generated_explanation.details}</p>
                  </div>
                )}
                
                {/* Confidence indicators */}
                <div className="mt-4 flex items-center space-x-4">
                  <div className="flex items-center space-x-1">
                    <i className="fas fa-flask text-purple-500 text-xs"></i>
                    <span className="text-xs text-slate-500">Evidence-based</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <i className="fas fa-clock text-amber-500 text-xs"></i>
                    <span className="text-xs text-slate-500">Updated daily</span>
                  </div>
                </div>
              </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ResultsDashboard;