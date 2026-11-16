import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import ShatterTransition from '../common/ShatterTransition';
import RadiantWaveBackground from '../common/RadiantWaveBackground';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [shatter, setShatter] = useState({ active: false, targetUrl: '' });
  const location = useLocation();

  useEffect(() => {
    const handleShatter = (e) => {
      const targetUrl = e.detail?.targetUrl || '/explorer';
      setShatter({ active: true, targetUrl });
    };

    window.addEventListener('retailiq-shatter-navigate', handleShatter);
    return () => window.removeEventListener('retailiq-shatter-navigate', handleShatter);
  }, []);

  return (
    <div className="min-h-screen bg-[#10120F] text-[#EAE7DB] flex relative selection:bg-[#A18A52]/30 selection:text-[#FFF3D1]">
      {/* Global Radiant Green Wave Background */}
      <RadiantWaveBackground />

      {/* Shatter Transition Overlay (when moving between pages) */}
      <ShatterTransition
        isShattering={shatter.active}
        targetUrl={shatter.targetUrl}
        onComplete={() => setShatter({ active: false, targetUrl: '' })}
      />

      {/* Luxury Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentPath={location.pathname}
      />

      {/* Main Content Shell */}
      <div className="flex-1 lg:pl-68 flex flex-col min-w-0 relative z-10">
        <Navbar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>

        {/* Luxury Global Footer */}
        <footer className="py-4 px-6 border-t border-[#A18A52]/20 bg-[#171a14]/90 backdrop-blur-md text-xs text-[#EAE7DB]/60 flex flex-col sm:flex-row items-center justify-between gap-3 max-w-7xl w-full mx-auto relative">
          {/* Reflective top edge highlight line */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#D5B66E]/30 to-transparent pointer-events-none" />

          <div className="flex items-center gap-2">
            <span className="font-bold text-[#EAE7DB] tracking-wide flex items-center gap-1.5">
              <span>Retail</span>
              <span className="text-gradient-gold">IQ</span>
            </span>
            <span className="text-[#A18A52]/60">•</span>
            <span className="text-[#EAE7DB]/75 font-medium">Enterprise Customer Intelligence Platform</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px]">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#E8785A]/15 border border-[#E8785A]/30 text-[#E8785A] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E8785A] animate-pulse" />
              High Priority Alert Active
            </span>
            <span className="text-[#EAE7DB]/60">Model: <strong className="text-[#EAE7DB]">Candidate 1 (Classic RFM-P)</strong></span>
            <span className="text-[#A18A52]/60">•</span>
            <span className="text-[#EAE7DB]/60">Cohort: <strong className="text-[#D5B66E]">200 Accounts</strong></span>
          </div>
        </footer>
      </div>
    </div>
  );
}
