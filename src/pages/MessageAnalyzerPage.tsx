import React, { useState } from 'react';
import { UserProfile, InvestigationCase } from '../types';
import { analyzeMessageApi, MessageAnalysisResponse } from '../lib/api';
import { saveScan, getCases, updateCase } from '../lib/supabase';
import { RiskBadge } from '../components/RiskBadge';
import { RiskGauge } from '../components/RiskGauge';
import {
  MessageSquareWarning,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Link as LinkIcon,
  Copy,
  Check,
  CheckCircle2,
  FolderPlus,
  ArrowRight,
  ExternalLink,
  Info,
  RotateCcw,
} from 'lucide-react';

interface MessageAnalyzerPageProps {
  user: UserProfile;
  onNavigateToUrlScan?: (url: string) => void;
  onNavigateToCases?: () => void;
}

export const MessageAnalyzerPage: React.FC<MessageAnalyzerPageProps> = ({
  user,
  onNavigateToUrlScan,
  onNavigateToCases,
}) => {
  const [message, setMessage] = useState('');
  const [source, setSource] = useState('SMS / Text Message');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MessageAnalysisResponse | null>(null);
  const [savedScanId, setSavedScanId] = useState<string | null>(null);
  const [copiedPhrase, setCopiedPhrase] = useState<string | null>(null);

  // Case attachment modal state
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [userCases, setUserCases] = useState<InvestigationCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [attaching, setAttaching] = useState(false);
  const [attachedSuccess, setAttachedSuccess] = useState(false);

  const sources = [
    'SMS / Text Message',
    'WhatsApp / Telegram',
    'Email Phishing',
    'Social Media DM (Instagram/LinkedIn/X)',
    'Banking / Courier Notification',
    'Other / Unknown',
  ];

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('Please paste or type the suspicious message text to analyze.');
      return;
    }

    setAnalyzing(true);
    setError(null);
    setResult(null);
    setSavedScanId(null);
    setAttachedSuccess(false);

    try {
      const data = await analyzeMessageApi(message, source);
      setResult(data);

      // Automatically persist scan to database under user's authorized account
      const saved = await saveScan({
        user_id: user.id,
        scan_type: 'message',
        input_summary: message.slice(0, 100) + (message.length > 100 ? '...' : ''),
        risk_level: data.analysis.risk_level,
        risk_score: data.analysis.risk_score,
        status: 'completed',
        result_summary: data.analysis.summary,
        details: {
          source,
          raw_input: message,
          suspicious_indicators: data.analysis.suspicious_indicators,
          suspicious_phrases: data.analysis.suspicious_phrases,
          extracted_links: data.analysis.extracted_links,
          recommended_actions: data.analysis.recommended_actions,
          limitations: data.analysis.limitations,
        },
      });
      setSavedScanId(saved.id);
    } catch (err: any) {
      setError(err.message || 'Failed to complete message analysis. Check API configuration.');
    } finally {
      setAnalyzing(false);
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
      console.error('Error fetching cases for attachment:', err);
    }
  };

  const handleAttachToCase = async () => {
    if (!selectedCaseId || !result) return;
    setAttaching(true);
    try {
      const targetCase = userCases.find((c) => c.id === selectedCaseId);
      if (targetCase) {
        const updatedMessages = [...(targetCase.related_messages || []), message];
        await updateCase(targetCase.id, user.id, {
          related_messages: updatedMessages,
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPhrase(text);
    setTimeout(() => setCopiedPhrase(null), 2000);
  };

  const handleReset = () => {
    setMessage('');
    setResult(null);
    setError(null);
    setSavedScanId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <MessageSquareWarning className="w-5 h-5 text-sky-400" />
          <span>Suspicious Message & Phishing Analyzer</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Detect psychological pressure, urgent payment demands, fake prize lures, and credential harvesting patterns using multi-layered heuristic intelligence.
        </p>
      </div>

      {/* Security Warning Notice */}
      <div className="p-3.5 bg-amber-950/30 border border-amber-800/40 rounded-lg text-xs text-amber-200/90 flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="font-semibold text-amber-300">Identity Protection Advisory:</strong> TrustShield analyzes language patterns and structural threat markers. Never paste active one-time passwords (OTPs), bank PINs, or private credentials into any online scanner.
        </div>
      </div>

      {/* Main Analysis Form */}
      <div className="bg-[#0a0f1d] border border-slate-800 rounded-lg p-5">
        <form onSubmit={handleAnalyze} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Message Delivery Channel
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              >
                {sources.map((s, idx) => (
                  <option key={idx} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end justify-end">
              <span className="text-[11px] font-mono text-slate-500">
                {message.length} / 8000 characters
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Paste Suspicious Message Text
            </label>
            <textarea
              required
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. URGENT: Your bank account has been locked due to suspicious activity. Verify immediately at http://secure-banking-alert.com or funds will be frozen within 2 hours..."
              className="w-full p-3 bg-slate-900 border border-slate-800 rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 font-mono leading-relaxed"
            />
          </div>

          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded text-xs text-rose-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear Input</span>
            </button>

            <button
              type="submit"
              disabled={analyzing || !message.trim()}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-md transition-colors shadow-sm shadow-sky-600/30 flex items-center gap-2"
            >
              {analyzing ? (
                <>
                  <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                  <span>Evaluating Heuristics...</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4" />
                  <span>Execute Threat Analysis</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Analysis Results View */}
      {result && (
        <div className="bg-[#0a0f1d] border border-slate-800 rounded-lg p-5 md:p-6 space-y-6">
          {/* Top Score Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <RiskBadge level={result.analysis.risk_level} score={result.analysis.risk_score} />
                <span className="text-xs text-slate-500 font-mono">
                  Channel: {result.source}
                </span>
              </div>
              <h3 className="text-sm md:text-base font-bold text-white">
                {result.analysis.summary}
              </h3>
            </div>

            <div className="w-full md:w-64 shrink-0">
              <RiskGauge score={result.analysis.risk_score} level={result.analysis.risk_level} />
            </div>
          </div>

          {/* Suspicious Indicators Checklist */}
          {result.analysis.suspicious_indicators && result.analysis.suspicious_indicators.length > 0 && (
            <div>
              <h4 className="text-xs uppercase font-mono tracking-wider text-slate-400 font-semibold mb-2.5">
                Detected Threat Indicators
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {result.analysis.suspicious_indicators.map((indicator, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-slate-900/60 border border-slate-800 rounded flex items-start gap-2 text-xs text-slate-200"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>{indicator}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extracted Suspicious Phrases */}
          {result.analysis.suspicious_phrases && result.analysis.suspicious_phrases.length > 0 && (
            <div>
              <h4 className="text-xs uppercase font-mono tracking-wider text-slate-400 font-semibold mb-2.5">
                Coercive & High-Risk Phrases Extracted
              </h4>
              <div className="flex flex-wrap gap-2">
                {result.analysis.suspicious_phrases.map((phrase, idx) => (
                  <div
                    key={idx}
                    className="group px-3 py-1.5 bg-rose-950/30 border border-rose-900/50 rounded text-xs text-rose-300 font-mono flex items-center gap-2"
                  >
                    <span>"{phrase}"</span>
                    <button
                      onClick={() => copyToClipboard(phrase)}
                      className="opacity-60 hover:opacity-100 text-rose-400 transition-opacity"
                      title="Copy phrase"
                    >
                      {copiedPhrase === phrase ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extracted Links Section with One-Click Deep Scan */}
          {result.analysis.extracted_links && result.analysis.extracted_links.length > 0 && (
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-lg">
              <h4 className="text-xs uppercase font-mono tracking-wider text-slate-400 font-semibold mb-2 flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-sky-400" />
                <span>Extracted Hyperlinks ({result.analysis.extracted_links.length})</span>
              </h4>
              <div className="space-y-2">
                {result.analysis.extracted_links.map((link, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-slate-900 border border-slate-800 rounded text-xs font-mono"
                  >
                    <span className="text-slate-300 truncate max-w-lg">{link}</span>
                    {onNavigateToUrlScan && (
                      <button
                        onClick={() => onNavigateToUrlScan(link)}
                        className="px-2.5 py-1 text-[11px] font-sans font-semibold text-sky-300 hover:text-white bg-sky-950/80 hover:bg-sky-900 border border-sky-800/60 rounded transition-colors flex items-center gap-1 self-start sm:self-auto"
                      >
                        <span>Inspect in URL Threat Scanner</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Defensive Actions */}
          {result.analysis.recommended_actions && result.analysis.recommended_actions.length > 0 && (
            <div>
              <h4 className="text-xs uppercase font-mono tracking-wider text-slate-400 font-semibold mb-2.5">
                Recommended Defensive Steps
              </h4>
              <div className="space-y-2">
                {result.analysis.recommended_actions.map((action, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-900/60 border border-slate-800 rounded flex items-start gap-2.5 text-xs text-slate-300"
                  >
                    <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <span>{action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Limitations & Uncertainty Disclaimer */}
          <div className="p-3.5 bg-slate-900/40 border border-slate-800/80 rounded text-xs text-slate-400 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <strong className="text-slate-300">Methodology & Limitations:</strong>{' '}
              {result.analysis.limitations ||
                'This evaluation is an AI-assisted linguistic and psychological assessment. A low risk score does not guarantee legitimacy, and a high risk score warrants independent confirmation through verified official communication lines.'}
            </div>
          </div>

          {/* Case Attachment & Export Actions */}
          <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500 font-mono">
              {savedScanId ? `Saved to Database: ${savedScanId}` : 'Scan Record Registered'}
            </div>

            <div className="flex items-center gap-2">
              {attachedSuccess ? (
                <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Attached to Case Successfully
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

      {/* Modal: Attach Scan to Case */}
      {showAttachModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0a0f1d] border border-slate-800 rounded-lg p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-sky-400" />
                <span>Attach Scan to Investigation</span>
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
                No existing cases found. You can create a new investigation in the Investigation Cases module.
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-xs font-medium text-slate-300">
                  Select Target Investigation Case
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
                  {attaching ? 'Attaching...' : 'Confirm Attachment'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
