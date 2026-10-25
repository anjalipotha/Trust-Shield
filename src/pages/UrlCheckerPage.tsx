import React, { useState, useEffect } from 'react';
import { UserProfile, InvestigationCase } from '../types';
import { checkUrlApi, UrlCheckResponse } from '../lib/api';
import { saveScan, getCases, updateCase } from '../lib/supabase';
import { RiskBadge } from '../components/RiskBadge';
import { RiskGauge } from '../components/RiskGauge';
import { ProviderStatusList } from '../components/ProviderStatusList';
import {
  Link2,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ExternalLink,
  Lock,
  Globe,
  CheckCircle2,
  FolderPlus,
  RotateCcw,
  Info,
  Radio,
} from 'lucide-react';

interface UrlCheckerPageProps {
  user: UserProfile;
  initialUrl?: string;
  onNavigateToCases?: () => void;
}

export const UrlCheckerPage: React.FC<UrlCheckerPageProps> = ({
  user,
  initialUrl = '',
  onNavigateToCases,
}) => {
  const [url, setUrl] = useState(initialUrl);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UrlCheckResponse | null>(null);
  const [savedScanId, setSavedScanId] = useState<string | null>(null);

  // Case attach state
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [userCases, setUserCases] = useState<InvestigationCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [attaching, setAttaching] = useState(false);
  const [attachedSuccess, setAttachedSuccess] = useState(false);

  useEffect(() => {
    if (initialUrl) {
      setUrl(initialUrl);
    }
  }, [initialUrl]);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setError('Please provide a valid web URL to evaluate.');
      return;
    }

    setScanning(true);
    setError(null);
    setResult(null);
    setSavedScanId(null);
    setAttachedSuccess(false);

    try {
      const data = await checkUrlApi(url.trim());
      setResult(data);

      // Persist to user scans table
      const saved = await saveScan({
        user_id: user.id,
        scan_type: 'url',
        input_summary: data.url,
        risk_level: data.overall_risk,
        risk_score: data.risk_score,
        status: 'completed',
        result_summary: data.reasons.join(' '),
        details: {
          url: data.url,
          hostname: data.hostname,
          providers: data.providers,
          raw_input: url,
        },
      });
      setSavedScanId(saved.id);
    } catch (err: any) {
      setError(err.message || 'Error occurred during multi-feed threat check.');
    } finally {
      setScanning(false);
    }
  };

  const handleOpenAttachModal = async () => {
    try {
      const cases = await getCases(user.id);
      setUserCases(cases);
      if (cases.length > 0) {
        setSelectedCaseId(cases[0].id);
      }
      setShowAttachModal(true);
    } catch (err) {
      console.error('Error fetching cases:', err);
    }
  };

  const handleAttachToCase = async () => {
    if (!selectedCaseId || !result) return;
    setAttaching(true);
    try {
      const targetCase = userCases.find((c) => c.id === selectedCaseId);
      if (targetCase) {
        const updatedUrls = [...(targetCase.related_urls || []), result.url];
        await updateCase(targetCase.id, user.id, {
          related_urls: updatedUrls,
        });
        setAttachedSuccess(true);
        setShowAttachModal(false);
      }
    } catch (err) {
      console.error('Error attaching to case:', err);
    } finally {
      setAttaching(false);
    }
  };

  const handleReset = () => {
    setUrl('');
    setResult(null);
    setError(null);
    setSavedScanId(null);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <Link2 className="w-5 h-5 text-sky-400" />
          <span>Multi-Provider URL & Threat Feed Scanner</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Simultaneously interrogate Google Safe Browsing, abuse.ch URLhaus malware database, and AlienVault OTX threat pulses without visiting or executing untrusted code.
        </p>
      </div>

      {/* Safety Notice */}
      <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-xs text-slate-300 flex items-start gap-2.5">
        <Lock className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>Zero-Execution Isolation:</strong> TrustShield performs purely remote threat intelligence lookups on domain hostnames and URIs. Links are never rendered in client browsers, automated redirects are isolated, and sensitive query tokens are strictly redacted.
        </div>
      </div>

      {/* URL Input Form */}
      <div className="bg-[#0a0f1d] border border-slate-800 rounded-lg p-5">
        <form onSubmit={handleScan} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Target Web Address (HTTP / HTTPS)
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example-suspicious-domain.com/login?token=abc123xyz"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-800 rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 font-mono"
              />
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Private/loopback IP addresses (127.0.0.1, 192.168.x, 10.x, localhost) are blocked to prevent SSRF vulnerabilities.
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded text-xs text-rose-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            <button
              type="submit"
              disabled={scanning || !url.trim()}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-md transition-colors shadow-sm shadow-sky-600/30 flex items-center gap-2"
            >
              {scanning ? (
                <>
                  <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                  <span>Querying Threat Providers...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Run Multi-Feed Security Check</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Result Section */}
      {result && (
        <div className="bg-[#0a0f1d] border border-slate-800 rounded-lg p-5 md:p-6 space-y-6">
          {/* Header Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <RiskBadge level={result.overall_risk} score={result.risk_score} />
                <span className="text-xs text-slate-500 font-mono">
                  Hostname: {result.hostname}
                </span>
              </div>
              <h3 className="text-sm md:text-base font-bold text-white font-mono break-all">
                {result.url}
              </h3>
              <div className="mt-1 text-xs text-slate-400">
                {result.reasons.join(' · ')}
              </div>
            </div>

            <div className="w-full md:w-64 shrink-0">
              <RiskGauge score={result.risk_score} level={result.overall_risk} />
            </div>
          </div>

          {/* Provider Breakdown List */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs uppercase font-mono tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-sky-400" />
                <span>Provider Responses & Threat Indicators</span>
              </h4>
              <span className="text-[11px] text-slate-500 font-mono">
                {result.providers.length} intelligence providers checked
              </span>
            </div>
            <ProviderStatusList providers={result.providers} />
          </div>

          {/* Forensic Disclaimers & Disagreement Handling */}
          <div className="p-3.5 bg-slate-900/40 border border-slate-800/80 rounded text-xs text-slate-400 space-y-1.5">
            <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
              <Info className="w-3.5 h-3.5 text-sky-400" />
              <span>Evidentiary Standards & Caveats</span>
            </div>
            {result.disclaimers.map((d, dIdx) => (
              <p key={dIdx} className="text-[11px] leading-relaxed">
                • {d}
              </p>
            ))}
          </div>

          {/* Save / Case Attachment footer */}
          <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500 font-mono">
              {savedScanId ? `Scan Recorded: ${savedScanId}` : 'Database Logged'}
            </div>

            <div className="flex items-center gap-2">
              {attachedSuccess ? (
                <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> URL Linked to Investigation
                </span>
              ) : (
                <button
                  onClick={handleOpenAttachModal}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded transition-colors flex items-center gap-1.5"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-sky-400" />
                  <span>Attach to Investigation Case</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Attach Modal */}
      {showAttachModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0a0f1d] border border-slate-800 rounded-lg p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-sky-400" />
                <span>Link URL to Case</span>
              </h4>
              <button
                onClick={() => setShowAttachModal(false)}
                className="text-slate-500 hover:text-slate-300 text-xs"
              >
                Cancel
              </button>
            </div>

            {userCases.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-4">
                No active investigation cases found.
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-xs font-medium text-slate-300">
                  Select Target Case
                </label>
                <select
                  value={selectedCaseId}
                  onChange={(e) => setSelectedCaseId(e.target.value)}
                  className="w-full p-2 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200"
                >
                  {userCases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.case_reference} - {c.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowAttachModal(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Close
              </button>
              {userCases.length > 0 && (
                <button
                  onClick={handleAttachToCase}
                  disabled={attaching || !selectedCaseId}
                  className="px-4 py-1.5 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded transition-colors"
                >
                  {attaching ? 'Linking...' : 'Link URL'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
