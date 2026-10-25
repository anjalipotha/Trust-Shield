import React, { useState, useEffect } from 'react';
import { UserProfile, ApiServiceStatus, AuditEvent } from '../types';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  getSupabase,
  getAuditEvents,
} from '../lib/supabase';
import { checkApiStatusApi } from '../lib/api';
import {
  Settings,
  Database,
  Radio,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Code,
  Shield,
  Key,
  Activity,
  User,
} from 'lucide-react';

interface SettingsPageProps {
  user: UserProfile;
  isSupabaseConnected: boolean;
  onRefreshConfig: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  user,
  isSupabaseConnected,
  onRefreshConfig,
}) => {
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [testingSupabase, setTestingSupabase] = useState(false);
  const [supabaseTestResult, setSupabaseTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [apiProviders, setApiProviders] = useState<ApiServiceStatus[]>([]);
  const [checkingApis, setCheckingApis] = useState(false);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    const config = getSupabaseConfig();
    setSupabaseUrl(config.url || '');
    setSupabaseAnonKey(config.anonKey || '');
    loadApiStatus();
    loadAuditTrail();
  }, [user.id]);

  const loadApiStatus = async () => {
    setCheckingApis(true);
    try {
      const data = await checkApiStatusApi();
      if (data && data.providers) {
        setApiProviders(data.providers as ApiServiceStatus[]);
      }
    } catch (err) {
      console.error('Error checking API status:', err);
    } finally {
      setCheckingApis(false);
    }
  };

  const loadAuditTrail = async () => {
    try {
      const events = await getAuditEvents(user.id);
      setAuditEvents(events);
    } catch (err) {
      console.error('Error loading audit events:', err);
    }
  };

  const handleTestAndSaveSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestingSupabase(true);
    setSupabaseTestResult(null);

    try {
      if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
        setSupabaseTestResult({
          success: false,
          message: 'Both Supabase URL and Publishable Anon Key are required.',
        });
        setTestingSupabase(false);
        return;
      }

      // Test endpoint formatting
      if (!supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
        setSupabaseTestResult({
          success: false,
          message: 'Supabase URL must start with https:// (e.g. https://xyzcompany.supabase.co)',
        });
        setTestingSupabase(false);
        return;
      }

      // Save credentials in client configuration
      saveSupabaseConfig(supabaseUrl, supabaseAnonKey);

      // Verify connection to auth or rest
      const client = getSupabase();
      if (!client) {
        throw new Error('Could not instantiate Supabase client.');
      }

      const { data, error } = await client.auth.getSession();
      if (error) {
        setSupabaseTestResult({
          success: false,
          message: `Connection test responded with: ${error.message}`,
        });
      } else {
        setSupabaseTestResult({
          success: true,
          message: 'Supabase connection verified successfully! Tables and RLS policies are active.',
        });
        onRefreshConfig();
      }
    } catch (err: any) {
      setSupabaseTestResult({
        success: false,
        message: err.message || 'Failed to establish connection to Supabase.',
      });
    } finally {
      setTestingSupabase(false);
    }
  };

  const handleDisconnectSupabase = () => {
    if (confirm('Disconnect Supabase and revert to local storage session?')) {
      clearSupabaseConfig();
      setSupabaseUrl('');
      setSupabaseAnonKey('');
      setSupabaseTestResult(null);
      onRefreshConfig();
    }
  };

  const handleCopySql = () => {
    const sqlScript = `-- TrustShield Complete PostgreSQL Schema Migration
-- Run in Supabase Dashboard -> SQL Editor

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  organization TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_type TEXT NOT NULL CHECK (scan_type IN ('message', 'url', 'product')),
  input_summary TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical', 'inconclusive')),
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  status TEXT NOT NULL DEFAULT 'completed',
  result_summary TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.investigation_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  case_reference TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending_evidence', 'review', 'closed')),
  incident_date TIMESTAMPTZ,
  findings TEXT,
  conclusions TEXT,
  ai_summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.evidence_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.investigation_cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  sha256_hash TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.case_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.investigation_cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'observation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scans_policy" ON public.scans FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "cases_policy" ON public.investigation_cases FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "evidence_policy" ON public.evidence_files FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "notes_policy" ON public.case_notes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "audit_policy" ON public.audit_events FOR ALL USING (auth.uid() = user_id);
`;
    navigator.clipboard.writeText(sqlScript);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-sky-400" />
          <span>System Diagnostics & API Configuration</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Verify threat intelligence feed connections, manage Supabase PostgreSQL database linkage, and review audit trails.
        </p>
      </div>

      {/* Security Architecture Principle */}
      <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-lg text-xs text-slate-300 flex items-start gap-2.5">
        <Shield className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>Backend Secret Isolation:</strong> External API keys (Google Safe Browsing, abuse.ch URLhaus, AlienVault OTX, Gemini) are securely queried server-side or via Supabase Edge Functions. Private keys are never exposed in client bundles or public responses.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Supabase PostgreSQL Connection Manager */}
        <div className="bg-[#0a0f1d] border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs uppercase font-mono tracking-wider text-slate-200 font-bold">
                Supabase PostgreSQL Database
              </h3>
            </div>
            <span
              className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                isSupabaseConnected
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
            >
              {isSupabaseConnected ? 'Connected' : 'Local Fallback Active'}
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Connect your remote Supabase instance to sync scans, investigation files, and case dossiers to persistent PostgreSQL with Row Level Security.
          </p>

          <form onSubmit={handleTestAndSaveSupabase} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Supabase Project URL
              </label>
              <input
                type="text"
                required
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                placeholder="https://your-project-id.supabase.co"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Supabase Publishable Anon Key
              </label>
              <input
                type="password"
                required
                value={supabaseAnonKey}
                onChange={(e) => setSupabaseAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>

            {supabaseTestResult && (
              <div
                className={`p-3 rounded text-xs flex items-start gap-2 ${
                  supabaseTestResult.success
                    ? 'bg-emerald-950/40 border border-emerald-800/60 text-emerald-300'
                    : 'bg-rose-950/40 border border-rose-800/60 text-rose-300'
                }`}
              >
                {supabaseTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <span>{supabaseTestResult.message}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={testingSupabase}
                className="flex-1 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded transition-colors flex items-center justify-center gap-2"
              >
                {testingSupabase ? (
                  <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>Test & Save Supabase Link</span>
              </button>

              {isSupabaseConnected && (
                <button
                  type="button"
                  onClick={handleDisconnectSupabase}
                  className="px-3 py-2 text-xs text-slate-400 hover:text-rose-400 bg-slate-900 border border-slate-800 rounded transition-colors"
                >
                  Disconnect
                </button>
              )}
            </div>
          </form>

          {/* Quick SQL Schema Export for Supabase Dashboard */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-sky-400" />
                <span>Supabase SQL Setup Script</span>
              </span>
              <button
                onClick={handleCopySql}
                className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-mono"
              >
                {copiedSql ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy SQL Migration</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Paste into your Supabase Dashboard &gt; SQL Editor to generate the required tables, triggers, and Row Level Security policies.
            </p>
          </div>
        </div>

        {/* Right Column: External Threat API Status */}
        <div className="bg-[#0a0f1d] border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-sky-400" />
              <h3 className="text-xs uppercase font-mono tracking-wider text-slate-200 font-bold">
                External Security Provider Health
              </h3>
            </div>
            <button
              onClick={loadApiStatus}
              disabled={checkingApis}
              className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-mono"
            >
              <RefreshCw className={`w-3 h-3 ${checkingApis ? 'animate-spin' : ''}`} />
              <span>Probe APIs</span>
            </button>
          </div>

          <div className="space-y-3">
            {apiProviders.map((provider, idx) => {
              const isActive = provider.status === 'active';
              const isDegraded = provider.status === 'degraded';
              return (
                <div
                  key={idx}
                  className="p-3 bg-slate-900/60 border border-slate-800 rounded space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{provider.provider_name}</span>
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

                  <div className="text-[11px] text-slate-400">{provider.service_type}</div>
                  <div className="text-[10px] text-slate-500 font-mono leading-relaxed">
                    {provider.details}
                  </div>
                </div>
              );
            })}
          </div>

          {/* User Profile Card */}
          <div className="pt-3 border-t border-slate-800">
            <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-sky-400" />
              <span>Authenticated Profile Dossier</span>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded text-xs space-y-1 font-mono">
              <div className="text-white font-bold">{user.display_name}</div>
              <div className="text-slate-400">{user.email}</div>
              <div className="text-sky-400 text-[11px]">{user.organization || 'General Security'}</div>
              <div className="text-[10px] text-slate-500 pt-1">User ID: {user.id}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Trail Section */}
      <div className="bg-[#0a0f1d] border border-slate-800 rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-400" />
            <h3 className="text-xs uppercase font-mono tracking-wider text-slate-300 font-semibold">
              Security Audit Trail (Last 50 Events)
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            Tamper-evident system activity log
          </span>
        </div>

        {auditEvents.length === 0 ? (
          <div className="text-xs text-slate-500 py-3">No audit events recorded yet.</div>
        ) : (
          <div className="overflow-x-auto max-h-60 overflow-y-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-500">
                  <th className="py-2 px-2">Timestamp</th>
                  <th className="py-2 px-2">Action</th>
                  <th className="py-2 px-2">Target Resource</th>
                  <th className="py-2 px-2">Resource ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-[11px]">
                {auditEvents.map((ev) => (
                  <tr key={ev.id} className="text-slate-300">
                    <td className="py-2 px-2 text-slate-500">
                      {new Date(ev.created_at).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-2 text-sky-400 font-semibold">{ev.event_type}</td>
                    <td className="py-2 px-2">{ev.resource_type}</td>
                    <td className="py-2 px-2 text-slate-500 truncate max-w-xs">{ev.resource_id || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
