// components/RawDataInspector.jsx
import React, { useState } from 'react';

const RawDataInspector = ({ data }) => {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data-inspection-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const highlightSearch = (text) => {
    if (!searchTerm.trim()) return text;
    
    const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === searchTerm.toLowerCase() ? 
        `<span class="bg-amber-200 text-amber-900 px-0.5 rounded">${part}</span>` : 
        part
    ).join('');
  };

  const renderJsonWithHighlight = () => {
    const jsonString = JSON.stringify(data, null, 2);
    
    if (!searchTerm.trim()) {
      return jsonString;
    }

    // Split into lines and highlight matching lines
    const lines = jsonString.split('\n');
    const highlightedLines = lines.map(line => {
      if (line.toLowerCase().includes(searchTerm.toLowerCase())) {
        return `<div class="bg-amber-50 border-l-4 border-amber-400 pl-2">${highlightSearch(line)}</div>`;
      }
      return highlightSearch(line);
    });

    return highlightedLines.join('\n');
  };

  const getDataType = () => {
    if (Array.isArray(data)) return 'Array';
    if (data === null) return 'Null';
    return typeof data;
  };

  const getDataStats = () => {
    if (Array.isArray(data)) {
      return `${data.length} items`;
    }
    if (data && typeof data === 'object') {
      return `${Object.keys(data).length} keys`;
    }
    return 'Single value';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-3">
            <div className="w-1 h-8 bg-gradient-to-b from-cyan-500 to-blue-500 rounded-full"></div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800 flex items-center">
                <i className="fas fa-code mr-2 text-cyan-600"></i>
                Data Inspector
              </h3>
              <div className="flex items-center space-x-2 mt-0.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                  <i className="fas fa-tag mr-1 text-[10px]"></i>
                  {getDataType()}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-600">
                  <i className="fas fa-cubes mr-1 text-[10px]"></i>
                  {getDataStats()}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
         

            {/* Action buttons */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 
                       rounded-lg transition-all"
              title={expanded ? 'Collapse' : 'Expand'}
            >
              <i className={`fas fa-${expanded ? 'chevron-down' : 'chevron-up'} text-sm`}></i>
            </button>
            
            <button
              onClick={handleDownload}
              className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 
                       rounded-lg transition-all"
              title="Download JSON"
            >
              <i className="fas fa-download text-sm"></i>
            </button>
            
            <button
              onClick={handleCopy}
              className="flex items-center space-x-1 px-3 py-1.5 text-xs 
                       bg-gradient-to-r from-cyan-500 to-blue-500 
                       text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 
                       transition-all shadow-sm hover:shadow"
            >
              {copied ? (
                <>
                  <i className="fas fa-check text-xs"></i>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <i className="far fa-copy text-xs"></i>
                  <span>Copy JSON</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Metadata bar */}
        <div className="flex items-center space-x-4 px-4 py-2 bg-slate-50/50 text-xs text-slate-500 border-t border-slate-100">
          <div className="flex items-center">
            <i className="fas fa-database mr-1 text-cyan-500"></i>
            <span>Size: {new Blob([JSON.stringify(data)]).size} bytes</span>
          </div>
          <div className="flex items-center">
            <i className="fas fa-layer-group mr-1 text-purple-500"></i>
            <span>Depth: {getJsonDepth(data)}</span>
          </div>
          <div className="flex items-center">
            <i className="fas fa-clock mr-1 text-amber-500"></i>
            <span>Updated: {new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* JSON viewer */}
      {expanded && (
        <div className="relative">
  {/* Scroll container */}
  <div className="flex max-h-96 overflow-auto bg-gradient-to-br from-slate-50 to-white">
    
    {/* Line numbers column */}
    <div className="w-12 bg-slate-50 border-r border-slate-200 
                    flex flex-col items-end py-4 pr-2 
                    text-xs text-slate-400 font-mono shrink-0">
      {JSON.stringify(data, null, 2).split('\n').map((_, i) => (
        <div key={i} className="leading-5">{i + 1}</div>
      ))}
    </div>

    {/* JSON content */}
    <pre
      className="p-4 text-xs font-mono leading-5 whitespace-pre"
      style={{ minHeight: '200px' }}
    >
      {renderJsonWithHighlight()}
    </pre>
  </div>

  {/* Quick stats footer */}
  <div className="border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-500 flex justify-between">
    <div className="flex items-center space-x-4">
      <span>
        <i className="fas fa-code text-cyan-500 mr-1"></i>
        Lines: {JSON.stringify(data, null, 2).split('\n').length}
      </span>
      <span>
        <i className="fas fa-tint text-blue-500 mr-1"></i>
        {searchTerm
          ? `${countOccurrences(JSON.stringify(data), searchTerm)} matches`
          : 'No search active'}
      </span>
    </div>
    <div className="flex items-center space-x-2">
      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
      <span>Live data</span>
    </div>
  </div>
</div>
      )}
    </div>
  );
};

// Helper function to calculate JSON depth
const getJsonDepth = (obj, depth = 0) => {
  if (obj && typeof obj === 'object') {
    if (Array.isArray(obj)) {
      return Math.max(...obj.map(item => getJsonDepth(item, depth + 1)), depth);
    }
    return Math.max(...Object.values(obj).map(value => getJsonDepth(value, depth + 1)), depth);
  }
  return depth;
};

// Helper function to count occurrences
const countOccurrences = (str, searchTerm) => {
  if (!searchTerm.trim()) return 0;
  const regex = new RegExp(searchTerm, 'gi');
  return (str.match(regex) || []).length;
};

export default RawDataInspector;