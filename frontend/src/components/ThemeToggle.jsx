import React from 'react';
import useDarkMode from '../hooks/useDarkMode';

const ThemeToggle = () => {
  const { isDark, toggleTheme } = useDarkMode();

  return (
    <button
      onClick={toggleTheme}
      className={`relative w-10 h-10 rounded-full flex items-center justify-center
        transition-all duration-300 ease-in-out border
        ${isDark 
          ? 'bg-slate-800 text-amber-300 border-slate-700 hover:bg-slate-700 hover:border-slate-600 shadow-inner' 
          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-sm'}
      `}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label="Toggle Dark Mode"
    >
      <div className={`absolute transition-all duration-500 transform ${isDark ? 'opacity-0 -rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'}`}>
        <i className="fas fa-moon text-lg drop-shadow-sm"></i>
      </div>
      
      <div className={`absolute transition-all duration-500 transform ${isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50'}`}>
        <i className="fas fa-sun text-lg drop-shadow-[0_0_8px_rgba(253,230,138,0.5)]"></i>
      </div>
    </button>
  );
};

export default ThemeToggle;
