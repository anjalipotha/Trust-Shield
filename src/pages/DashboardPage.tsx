import React, { useEffect, useState } from 'react';
import { UserProfile, ScanRecord, InvestigationCase, ApiServiceStatus } from '../types';
import { getScans, getCases } from '../lib/supabase';
import { checkApiStatusApi } from '../lib/api';
import { RiskBadge } from '../components/RiskBadge';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Radio,
  FileText,
  MessageSquareWarning,
  Link2,
  ShoppingBag,
  FolderLock,
  ArrowRight,
  RefreshCw,
  Activity,
  Calendar,
  Clock,
} from 'lucide-react';

interface DashboardPageProps {
  user: UserProfile;
  onNavigate: (tab: string, context?: any) => void;
  isSupabaseConnected: boolean;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  user,
  onNavigate,
  isSupabaseConnected,
}) => {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [cases, setCases] = useState<InvestigationCase[]>([]);
  const [apiProviders, setApiProviders] = useState<ApiServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = async () => {
    try {
      const [fetchedScans, fetchedCases] = await Promise.all([
        getScans(user.id),
        getCases(user.id),
      ]);
      setScans(fetchedScans);
      setCases(fetchedCases);

      // Check external API status
      const statusRes = await checkApiStatusApi().catch(() => null);
      if (statusRes && statusRes.providers) {
        setApiProviders(statusRes.providers as ApiServiceStatus[]);
      }
    } catch (err) {
      console.error('Error loading dashboard metrics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user.id]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  // Compute authentic stats strictly from actual user database records
  const totalScans = scans.length;
  const safeScans = scans.filter((s) => s.risk_level === 'low').length;
  const suspiciousScans = scans.filter((s) => s.risk_level === 'medium').length;
  const maliciousScans = scans.filter((s) => s.risk_level === 'high' || s.risk_level === 'critical').length;
  const activeCasesCount = cases.filter((c) => c.status !== 'closed').length;

  return (
    <div className="space-y-6">
      {/* Top Welcome / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <span>Welcome, {user.display_name}</span>
            <span className="text-xs px-2 py-0.5 rounded font-mono bg-sky-950/60 text-sky-400 border border-sky-800/40">
              {user.organization || 'Security Operations'}
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time threat monitoring and forensic case correlation center.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-md transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-sky-400' : ''}`} />
            <span>Refresh Telemetry</span>
          </button>
        </div>
      </div>

      {/* Metric Cards - strictly calculated from authentic database rows */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Total Scans</span>
            <Activity className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black font-mono text-white">{totalScans}</div>
          <div className="text-[11px] text-slate-500 mt-1">Authorized database logs</div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Safe / Clean</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400">{safeScans}</div>
          <div className="text-[11px] text-slate-500 mt-1">No indicators detected</div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Suspicious</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-400">{suspiciousScans}</div>
          <div className="text-[11px] text-slate-500 mt-1">Elevated risk / heuristics</div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Confirmed Threats</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black font-mono text-rose-400">{maliciousScans}</div>
          <div className="text-[11px] text-slate-500 mt-1">Flagged malicious / blacklist</div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Active Cases</span>
            <FolderLock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black font-mono text-cyan-400">{activeCasesCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Open investigations</div>
        </div>
      </div>

      {/* Quick Launchpad Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <button
          onClick={() => onNavigate('messages')}
          className="p-4 bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800 hover:border-sky-500/50 rounded-lg text-left transition-all group flex items-start gap-3.5"
        >
          <div className="p-2.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-400 group-hover:scale-105 transition-transform">
            <MessageSquareWarning className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-white group-hover:text-sky-300 flex items-center justify-between">
              <span>Scan Suspicious Message</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-sky-400 transition-colors" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              Evaluate phishing attempts, OTP theft, urgent wire demands, and SMS lures.
            </p>
          </div>
        </button>

        <button
          onClick={() => onNavigate('urls')}
          className="p-4 bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800 hover:border-sky-500/50 rounded-lg text-left transition-all group flex items-start gap-3.5"
        >
          <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 group-hover:scale-105 transition-transform">
            <Link2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-white group-hover:text-emerald-300 flex items-center justify-between">
              <span>Verify URL Threat Feeds</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-emerald-400 transition-colors" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              Simultaneous checks across Safe Browsing, URLhaus malware, and OTX pulses.
            </p>
          </div>
        </button>

        <button
          onClick={() => onNavigate('products')}
          className="p-4 bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800 hover:border-sky-500/50 rounded-lg text-left transition-all group flex items-start gap-3.5"
        >
          <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 group-hover:scale-105 transition-transform">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-white group-hover:text-amber-300 flex items-center justify-between">
              <span>Check Product Scam</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-amber-400 transition-colors" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              Inspect impossible discounts, fake storefront indicators, and escrow bypass risks.
            </p>
          </div>
        </button>
      </div>

      {/* Main Grid: Recent Scans + Active API Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Recent Scans & Findings */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase font-mono tracking-wider text-slate-300 font-semibold">
              Recent Threat Findings & Scans
            </h3>
            {scans.length > 0 && (
              <button
                onClick={() => onNavigate('history')}
                className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1"
              >
                <span>View All History</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/40 border border-slate-800 rounded-lg animate-pulse">
              Loading security scans...
            </div>
          ) : scans.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/30 border border-slate-800 rounded-lg">
              <ShieldCheck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <div className="text-sm font-semibold text-slate-300">No scans executed yet</div>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Paste a suspicious text message, verify a link, or check an e-commerce claim to begin populating threat records.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  onClick={() => onNavigate('messages')}
                  className="px-3 py-1.5 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded transition-colors"
                >
                  Analyze Message
                </button>
                <button
                  onClick={() => onNavigate('urls')}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors"
                >
                  Check URL
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {scans.slice(0, 5).map((scan) => (
                <div
                  key={scan.id}
                  className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono uppercase text-[10px] text-sky-400 px-1.5 py-0.5 rounded bg-sky-950/60 border border-sky-800/40">
                        {scan.scan_type}
                      </span>
                      <span className="font-semibold text-white truncate max-w-xs md:max-w-md">
                        {scan.input_summary}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                      {scan.result_summary}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <RiskBadge level={scan.risk_level} score={scan.risk_score} />
                    <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                      {new Date(scan.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Active Cases Section */}
          <div className="pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs uppercase font-mono tracking-wider text-slate-300 font-semibold">
                Active Forensic Investigations
              </h3>
              <button
                onClick={() => onNavigate('cases')}
                className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1"
              >
                <span>Manage Cases</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {cases.length === 0 ? (
              <div className="p-4 bg-slate-900/30 border border-slate-800 rounded-lg text-xs text-slate-500 text-center">
                No active investigation cases. Create a case to track evidence and synthesize findings.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cases.slice(0, 4).map((c) => (
                  <div
                    key={c.id}
                    onClick={() => onNavigate('cases', { caseId: c.id })}
                    className="p-3 bg-slate-900/50 border border-slate-800 rounded-md hover:border-slate-700 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-mono text-[11px] text-sky-400 font-bold">{c.case_reference}</span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        {c.status}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-white truncate">{c.title}</div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{c.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 col): Threat Feed Provider Status */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase font-mono tracking-wider text-slate-300 font-semibold">
              External Threat Feeds Status
            </h3>
            <button
              onClick={() => onNavigate('settings')}
              className="text-xs text-sky-400 hover:text-sky-300 font-medium"
            >
              Config
            </button>
          </div>

          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg space-y-3.5">
            {apiProviders.length === 0 ? (
              <div className="text-xs text-slate-500 py-4 text-center animate-pulse">
                Probing threat intelligence endpoints...
              </div>
            ) : (
              apiProviders.map((provider, pIdx) => {
                const isActive = provider.status === 'active';
                const isDegraded = provider.status === 'degraded';
                return (
                  <div key={pIdx} className="border-b border-slate-800/80 last:border-0 pb-3 last:pb-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">{provider.provider_name}</span>
                      <span
                        className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded flex items-center gap-1 ${
                          isActive
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : isDegraded
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isActive ? 'bg-emerald-400' : isDegraded ? 'bg-amber-400' : 'bg-slate-500'
                          }`}
                        />
                        {provider.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{provider.service_type}</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-1 leading-snug">
                      {provider.details}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Forensic Standards Notice */}
          <div className="p-3.5 bg-slate-950/80 border border-slate-800/80 rounded-lg text-xs space-y-2">
            <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
              <Radio className="w-3.5 h-3.5 text-sky-400" />
              <span>Evidentiary Standard</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Threat assessments combine AI semantic detection with blacklists. Unlisted URLs or messages are not guaranteed safe. Always verify through secondary channels before transacting or disclosing credentials.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
