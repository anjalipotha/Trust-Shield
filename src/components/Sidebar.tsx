import React from 'react';
import {
  Shield,
  LayoutDashboard,
  MessageSquareWarning,
  Link2,
  ShoppingBag,
  FolderLock,
  FileCheck2,
  FileText,
  History,
  Settings,
  ExternalLink,
  ChevronRight,
  Database,
  Radio,
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isSupabaseConnected: boolean;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isSupabaseConnected,
  isOpenMobile,
  onCloseMobile,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'messages', label: 'Message Analyzer', icon: MessageSquareWarning },
    { id: 'urls', label: 'URL Threat Checker', icon: Link2 },
    { id: 'products', label: 'Product Scam Checker', icon: ShoppingBag },
    { id: 'cases', label: 'Investigation Cases', icon: FolderLock },
    { id: 'evidence', label: 'Evidence Manager', icon: FileCheck2 },
    { id: 'reports', label: 'Case Reports', icon: FileText },
    { id: 'history', label: 'Scan History', icon: History },
    { id: 'settings', label: 'API & Settings', icon: Settings },
  ];

  const handleNavClick = (id: string) => {
    onSelectTab(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0a0f1d] border-r border-slate-800/80 flex flex-col transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
                TrustShield
                <span className="text-[9px] uppercase tracking-wider text-sky-400 font-mono px-1 py-0.2 bg-sky-950/60 border border-sky-800/40 rounded">
                  v1.0
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium">Detect · Verify · Protect</div>
            </div>
          </div>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] uppercase tracking-wider font-mono text-slate-400 font-semibold">
            Security Intelligence
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium rounded-md transition-all ${
                  isActive
                    ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30 font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-sky-400" />}
              </button>
            );
          })}
        </div>

        {/* Database & System Status Card */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60">
          <div className="p-2.5 rounded border border-slate-800/80 bg-slate-900/60 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-300 font-medium text-[11px]">Database Link</span>
              </div>
              <span
                className={`w-2 h-2 rounded-full ${
                  isSupabaseConnected ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-amber-400 animate-pulse'
                }`}
              />
            </div>

            <div className="text-[10px] text-slate-400 leading-tight">
              {isSupabaseConnected ? (
                <span className="text-emerald-400 font-medium">Supabase Cloud Connected</span>
              ) : (
                <span>Local Mode (Connect Supabase in Settings)</span>
              )}
            </div>

            <button
              onClick={() => handleNavClick('settings')}
              className="w-full text-left text-[10px] text-sky-400 hover:text-sky-300 flex items-center justify-between pt-1 font-mono"
            >
              <span>API Diagnostics</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
