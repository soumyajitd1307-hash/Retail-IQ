import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  PieChart,
  Users,
  BarChart3,
  TrendingUp,
  Layers,
  AlertOctagon,
  Sparkles,
} from 'lucide-react';

export default function Sidebar({ isOpen, onClose, currentPath }) {
  const navItems = [
    {
      to: '/',
      label: 'Executive Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      to: '/segmentation',
      label: 'Customer Segmentation',
      icon: PieChart,
      badge: '4 Personas',
    },
    {
      to: '/explorer',
      label: 'Customer Explorer',
      icon: Users,
      badge: '200 Cohort',
    },
    {
      to: '/rfm',
      label: 'RFM Analytics & Matrix',
      icon: BarChart3,
      badge: null,
    },
    {
      to: '/revenue',
      label: 'Revenue & Behaviour',
      icon: TrendingUp,
      badge: null,
    },
  ];

  const segmentCounts = [
    { 
      name: 'High-Value Loyal', 
      count: 50, 
      color: '#A5B86A', 
      bg: 'bg-[#A5B86A]/15 text-[#A5B86A] border border-[#A5B86A]/30' 
    },
    { 
      name: 'Offer-Sensitive', 
      count: 49, 
      color: '#D5B66E', 
      bg: 'bg-[#D5B66E]/15 text-[#D5B66E] border border-[#D5B66E]/30' 
    },
    { 
      name: 'At-Risk Dormant', 
      count: 40, 
      color: '#E8785A', 
      bg: 'bg-[#E8785A]/20 text-[#FFA085] border border-[#E8785A]/40 font-bold' 
    },
    { 
      name: 'Occasional Buyer', 
      count: 61, 
      color: '#81966B', 
      bg: 'bg-[#81966B]/15 text-[#A2B989] border border-[#81966B]/30' 
    },
  ];

  const handleNavClick = (e, targetTo) => {
    // If navigating from Segmentation to Explorer, trigger the animated shatter transition
    if (currentPath === '/segmentation' && targetTo === '/explorer') {
      e.preventDefault();
      if (onClose) onClose();
      window.dispatchEvent(
        new CustomEvent('retailiq-shatter-navigate', { detail: { targetUrl: '/explorer' } })
      );
      return;
    }
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-68 bg-gradient-to-b from-[#131511] via-[#1a1d16] to-[#121410] border-r border-[#A18A52]/20 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 shadow-[4px_0_30px_rgba(0,0,0,0.7)] ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Specular light highlight on sidebar right edge */}
        <div className="absolute top-0 right-0 bottom-0 w-[1px] bg-gradient-to-b from-[#D5B66E]/35 via-[#A5B86A]/20 to-transparent pointer-events-none" />

        {/* Brand Header */}
        <div className="h-20 px-5 border-b border-[#A18A52]/25 flex items-center justify-between bg-gradient-to-r from-[#1b1f17]/80 via-[#161912]/70 to-transparent relative">
          <div className="flex items-center gap-3">
            {/* Luxury Brand Emblem with Metallic Emerald-Olive & Gold Sheen */}
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#176B45] via-[#263326] to-[#10120F] text-[#FFF3D1] flex items-center justify-center shadow-[0_0_22px_rgba(40,166,106,0.28),0_6px_16px_rgba(0,0,0,0.65)] ring-1 ring-[#C6AD70]/40 border border-[#D5B66E]/30 relative overflow-hidden brand-sheen-shine group cursor-default shrink-0">
              {/* Internal subtle gleam */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/25 to-transparent pointer-events-none" />
              <Layers className="w-5.5 h-5.5 stroke-[2.3] text-[#FFF3D1] drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)] group-hover:scale-105 transition-transform" />
            </div>

            <div>
              <div className="text-lg font-black tracking-tight text-[#EAE7DB] flex items-center gap-1.5 leading-tight">
                <span>Retail</span>
                <span className="text-gradient-gold font-black">IQ</span>
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-gradient-to-r from-[#D5B66E] to-[#B99A55] text-[#10120F] border border-[#FFF1C5]/50 uppercase tracking-widest shadow-[0_0_10px_rgba(213,182,110,0.3)]">
                  PRO
                </span>
              </div>
              <span className="text-[11px] font-extrabold text-[#C6AD70]/90 block uppercase tracking-wider mt-0.5">
                Customer Intelligence
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-6">
          <div>
            <div className="px-3 mb-2.5 text-[10px] font-extrabold text-[#A18A52] uppercase tracking-widest flex items-center justify-between">
              <span>Main Workspace</span>
              <Sparkles className="w-3 h-3 text-[#D5B66E]" />
            </div>
            <nav className="space-y-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={(e) => handleNavClick(e, item.to)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group relative ${
                        isActive
                          ? 'bg-gradient-to-r from-[#303629] via-[#282d21] to-[#1f2219] text-[#FFF3D1] font-bold border border-[#A5B86A]/40 shadow-[0_4px_16px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]'
                          : 'text-[#EAE7DB]/70 hover:text-[#FFF3D1] hover:bg-[#303629]/30 hover:border-[#A18A52]/20 border border-transparent'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {/* Illuminated Left Indicator Strip for Active Route */}
                        {isActive && (
                          <div className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-gradient-to-b from-[#D5B66E] via-[#A5B86A] to-[#D5B66E] shadow-[0_0_8px_#D5B66E]" />
                        )}

                        <Icon
                          className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                            isActive 
                              ? 'text-[#D5B66E] stroke-[2.4] drop-shadow-[0_0_6px_rgba(213,182,110,0.4)]' 
                              : 'text-[#A18A52] group-hover:text-[#D5B66E]'
                          }`}
                        />
                        <span className="flex-1 truncate tracking-wide">{item.label}</span>
                        {item.badge && !isActive && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#22251F] text-[#D5B66E] border border-[#A18A52]/20 font-mono">
                            {item.badge}
                          </span>
                        )}
                        {isActive && (
                          <div className="w-2 h-2 rounded-full bg-[#A5B86A] shadow-[0_0_8px_#A5B86A] shrink-0 animate-pulse" />
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Customer Clusters Quick Jump */}
          <div>
            <div className="px-3 mb-2.5 flex items-center justify-between text-[10px] font-extrabold text-[#A18A52] uppercase tracking-widest">
              <span>Customer Clusters</span>
              <span className="text-[#EAE7DB]/50 font-mono text-[10px]">200 Accounts</span>
            </div>
            <div className="space-y-1">
              {segmentCounts.map((seg) => (
                <NavLink
                  key={seg.name}
                  to={`/segmentation?segment=${encodeURIComponent(seg.name)}`}
                  onClick={() => onClose && onClose()}
                  className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-[#EAE7DB]/75 hover:bg-[#303629]/35 hover:text-[#FFF3D1] border border-transparent hover:border-[#A18A52]/20 transition-all group"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 transition-transform group-hover:scale-125"
                      style={{ 
                        backgroundColor: seg.color, 
                        boxShadow: `0 0 10px ${seg.color}` 
                      }}
                    />
                    <span className="truncate group-hover:translate-x-0.5 transition-transform">{seg.name}</span>
                  </div>
                  <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md ${seg.bg}`}>
                    {seg.count}
                  </span>
                </NavLink>
              ))}
            </div>
          </div>

          {/* CRITICAL ALERT BOX (Glossy Dark Burgundy / Rose-Gold Accent) */}
          <div className="p-3.5 rounded-xl surface-alert relative overflow-hidden group">
            {/* Top reflective edge */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#E8785A]/50 to-transparent pointer-events-none" />

            <div className="flex items-center gap-2 mb-1.5">
              <AlertOctagon className="w-4 h-4 text-[#FFA085] shrink-0 animate-bounce" />
              <span className="text-xs font-extrabold text-[#FFA085] uppercase tracking-wider">
                Critical Priority
              </span>
            </div>
            <p className="text-[11px] text-[#EAE7DB]/90 leading-relaxed font-semibold">
              <strong className="text-[#FFA085]">40 accounts ($852k revenue)</strong> currently in At-Risk dormancy. Immediate win-back mandated.
            </p>
          </div>
        </div>

        {/* Footer Pipeline Info */}
        <div className="p-3.5 border-t border-[#A18A52]/20 bg-[#10120E]">
          <div className="p-2.5 rounded-xl bg-gradient-to-r from-[#22251F] to-[#1a1d16] border border-[#A18A52]/25 flex items-center justify-between text-xs shadow-inner">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#A5B86A] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#A5B86A]"></span>
              </span>
              <span className="text-[11px] font-bold text-[#EAE7DB]">
                Model: Candidate 1
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#A5B86A]/15 text-[#A5B86A] border border-[#A5B86A]/30 font-bold shadow-xs">
              ARI: 1.00
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
