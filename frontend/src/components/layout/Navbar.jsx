import React from 'react';
import { useLocation } from 'react-router-dom';
import {
  Menu,
  Download,
  Bell,
  Database,
  Sparkles,
} from 'lucide-react';
import dataService from '../../services/dataService';

export default function Navbar({ onMenuToggle }) {
  const location = useLocation();

  const getPageInfo = () => {
    switch (location.pathname) {
      case '/':
        return {
          titlePrefix: 'Executive',
          titleHighlight: 'Intelligence Dashboard',
          subtitle: 'High-level customer revenue, segment contribution and portfolio performance metrics',
        };
      case '/segmentation':
        return {
          titlePrefix: 'Customer',
          titleHighlight: 'Behavioral Segmentation',
          subtitle: 'Deep-dive persona profiling, K-Means cluster validation and strategic playbooks',
        };
      case '/explorer':
        return {
          titlePrefix: 'Cohort',
          titleHighlight: 'Customer Explorer',
          subtitle: 'Granular 200-customer directory with multi-factor filtering and ML prescriptions',
        };
      case '/rfm':
        return {
          titlePrefix: 'RFM Analytics &',
          titleHighlight: 'Strategic Matrix',
          subtitle: 'Recency, Frequency, and Monetary multidimensional behavioral distributions',
        };
      case '/revenue':
        return {
          titlePrefix: 'Revenue &',
          titleHighlight: 'Customer Behaviour',
          subtitle: 'Cohort revenue trends, spending patterns and customer lifetime value analysis',
        };
      default:
        return {
          titlePrefix: 'Retail IQ',
          titleHighlight: 'Intelligence Platform',
          subtitle: 'Advanced Customer Behavioral Analytics',
        };
    }
  };

  const pageInfo = getPageInfo();

  const handleExportAll = async () => {
    const all = await dataService.getAllCustomers();
    dataService.exportToCsv(all, 'retail_iq_all_customers.csv');
  };

  return (
    <header className="h-18 bg-gradient-to-r from-[#171a14] via-[#1c2018] to-[#151713] border-b border-[#A18A52]/20 sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between backdrop-blur-md relative shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
      {/* Specular Bottom Light Highlight Line */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#D5B66E]/30 to-transparent pointer-events-none" />

      {/* Left side: hamburger and breadcrumb / page title */}
      <div className="flex items-center gap-3.5">
        <button
          onClick={onMenuToggle}
          className="p-2 -ml-1 rounded-xl text-[#EAE7DB]/70 hover:text-[#FFF3D1] hover:bg-[#303629]/50 border border-transparent hover:border-[#A18A52]/25 lg:hidden transition-all"
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-base sm:text-lg font-black text-[#EAE7DB] leading-tight tracking-tight flex items-center gap-1.5">
            <span>{pageInfo.titlePrefix}</span>
            <span className="text-gradient-gold">{pageInfo.titleHighlight}</span>
          </h1>
          <p className="text-xs text-[#EAE7DB]/50 hidden md:block tracking-wide">
            {pageInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Right side: dataset badges, actions, profile */}
      <div className="flex items-center gap-2.5 sm:gap-3.5">
        {/* Synthetic dataset tag */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#22251F]/80 border border-[#A18A52]/30 text-xs font-semibold text-[#EAE7DB] shadow-inner">
          <Database className="w-3.5 h-3.5 text-[#D5B66E]" />
          <span>200 Customers</span>
          <span className="text-[#A18A52]/50">•</span>
          <span className="text-[#A5B86A] font-medium">Synthetic Cohort</span>
        </div>

        {/* Replay Intro Animation button (Glossy Champagne-Gold) */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('retailiq-replay-intro'))}
          title="Replay intro shopping cart & coupon animation"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold btn-gold cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#10120F] animate-spin" style={{ animationDuration: '4s' }} />
          <span className="hidden sm:inline">Play Intro</span>
        </button>

        {/* Export Data button (Glossy Olive Glass) */}
        <button
          onClick={handleExportAll}
          title="Export complete segmented cohort to CSV"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold btn-olive cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-[#D5B66E]" />
          <span className="hidden md:inline">Export CSV</span>
        </button>

        {/* Notification indicator */}
        <div className="relative">
          <button
            title="4 Active Strategic Playbooks Available"
            className="p-2 rounded-xl text-[#EAE7DB]/70 hover:text-[#FFF3D1] hover:bg-[#303629]/40 border border-transparent hover:border-[#A18A52]/25 transition-all"
          >
            <Bell className="w-4 h-4 text-[#D5B66E]" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#E8785A] shadow-[0_0_8px_#E8785A]" />
          </button>
        </div>

        {/* User / Team Avatar */}
        <div className="flex items-center gap-2.5 pl-2.5 border-l border-[#A18A52]/25">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#303629] via-[#3d4533] to-[#A5B86A] text-[#10120F] font-black text-xs flex items-center justify-center shadow-md ring-1 ring-[#D5B66E]/40">
            RQ
          </div>
          <div className="hidden xl:block text-left">
            <div className="text-xs font-bold text-[#EAE7DB] leading-none">
              RetailIQ Analyst
            </div>
            <div className="text-[10px] text-[#A18A52] font-semibold mt-0.5">
              Role C Deliverable
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
