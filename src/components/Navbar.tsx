import React from 'react';
import { UserProfile } from '../types';
import { Menu, ShieldAlert, LogOut, User, Globe, Activity, Database } from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  user: UserProfile | null;
  onLogout: () => void;
  onToggleMobileMenu: () => void;
  onOpenLanding: () => void;
  onSelectTab: (tab: string) => void;
  isSupabaseConnected: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  user,
  onLogout,
  onToggleMobileMenu,
  onOpenLanding,
  onSelectTab,
  isSupabaseConnected,
}) => {
  const getPageTitle = (tab: string) => {
    switch (tab) {
      case 'dashboard':
        return 'Threat Intelligence Dashboard';
      case 'messages':
        return 'Suspicious Message & Phishing Analyzer';
      case 'urls':
        return 'URL & Link Threat Scanner';
      case 'products':
        return 'E-Commerce & Online Scam Checker';
      case 'cases':
        return 'Digital Investigation Cases';
      case 'evidence':
        return 'Digital Evidence Locker (SHA-256)';
      case 'reports':
        return 'Forensic Investigation Reports';
      case 'history':
        return 'Security Scan History';
      case 'settings':
        return 'System Diagnostics & API Configuration';
      default:
        return 'TrustShield Intelligence Console';
    }
  };

  return (
    <header className="h-16 px-4 md:px-6 bg-[#0a0f1d]/90 backdrop-blur-md border-b border-slate-800/80 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-sm md:text-base font-bold text-white tracking-tight">
            {getPageTitle(currentTab)}
          </h1>
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400 font-mono">
            <span>DEFCON 4</span>
            <span aria-hidden="true">·</span>
            <span>Zero-Trust Architecture</span>
            <span aria-hidden="true">·</span>
            <span className={isSupabaseConnected ? 'text-emerald-400' : 'text-amber-400'}>
              {isSupabaseConnected ? 'PostgreSQL Active' : 'Local Storage Mode'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {/* Quick actions */}
        <button
          onClick={onOpenLanding}
          className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-md transition-colors"
        >
          <Globe className="w-3.5 h-3.5 text-sky-400" />
          <span>Public Portal</span>
        </button>

        {/* User Profile / Logout */}
        {user ? (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <div className="hidden sm:block text-right">
              <div className="text-xs font-semibold text-slate-200 leading-tight">
                {user.display_name}
              </div>
              <div className="text-[10px] text-slate-400 font-mono truncate max-w-[130px]">
                {user.email}
              </div>
            </div>

            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400 font-bold text-xs">
              {user.display_name.charAt(0).toUpperCase()}
            </div>

            <button
              onClick={onLogout}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => onSelectTab('auth')}
            className="px-3 py-1.5 text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 rounded-md transition-colors shadow-sm shadow-sky-600/30"
          >
            Sign In / Register
          </button>
        )}
      </div>
    </header>
  );
};
