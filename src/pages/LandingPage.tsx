import React from 'react';
import {
  Shield,
  ShieldCheck,
  Search,
  MessageSquareWarning,
  Link2,
  ShoppingBag,
  FolderLock,
  FileCheck2,
  FileText,
  ArrowRight,
  Lock,
  Terminal,
  Activity,
  CheckCircle2,
} from 'lucide-react';

interface LandingPageProps {
  onEnterApp: () => void;
  onOpenScan: (type: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnterApp, onOpenScan }) => {
  return (
    <div className="min-h-screen bg-[#080c16] text-slate-100 flex flex-col selection:bg-sky-500/30 selection:text-sky-200">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-base font-extrabold tracking-tight text-white">TrustShield</span>
            <span className="text-xs text-sky-400 font-mono ml-2">Detect · Verify · Protect</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={onEnterApp}
            className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-md transition-colors shadow-sm shadow-sky-600/30 flex items-center gap-1.5"
          >
            <span>Open Intelligence Console</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-6 max-w-7xl mx-auto w-full text-center relative overflow-hidden">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded border border-sky-500/30 bg-sky-950/40 text-sky-300 text-xs font-mono mb-6">
          <Terminal className="w-3.5 h-3.5" />
          <span>Multi-Provider Threat Verification & Cybercrime Forensics</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight max-w-4xl mx-auto leading-tight md:leading-none">
          Verify Threats with <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300">Absolute Certainty</span>.
        </h1>

        <p className="mt-6 text-base md:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          TrustShield arms consumers, fraud analysts, and security researchers with real-time multi-feed URL validation, AI-powered phishing and urgency detection, digital evidence management, and audit-ready forensic investigation reports.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => onOpenScan('messages')}
            className="px-5 py-2.5 text-xs font-semibold rounded-md bg-sky-600 hover:bg-sky-500 text-white transition-all shadow-lg shadow-sky-600/25 flex items-center gap-2"
          >
            <MessageSquareWarning className="w-4 h-4" />
            <span>Analyze Suspicious Message</span>
          </button>

          <button
            onClick={() => onOpenScan('urls')}
            className="px-5 py-2.5 text-xs font-semibold rounded-md bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-all flex items-center gap-2"
          >
            <Link2 className="w-4 h-4 text-sky-400" />
            <span>Scan URL Threat Feeds</span>
          </button>

          <button
            onClick={() => onOpenScan('products')}
            className="px-5 py-2.5 text-xs font-semibold rounded-md bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-all flex items-center gap-2"
          >
            <ShoppingBag className="w-4 h-4 text-amber-400" />
            <span>Inspect Product Scam</span>
          </button>
        </div>

        {/* Security Feeds Banner */}
        <div className="mt-16 pt-8 border-t border-slate-800/80 max-w-4xl mx-auto">
          <div className="text-xs uppercase font-mono text-slate-400 tracking-wider mb-4">
            Integrated Threat Intelligence Providers
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-md flex flex-col items-center">
              <span className="font-semibold text-slate-200">Google Safe Browsing</span>
              <span className="text-[10px] text-slate-400 mt-1">Official v4 API</span>
            </div>
            <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-md flex flex-col items-center">
              <span className="font-semibold text-slate-200">abuse.ch URLhaus</span>
              <span className="text-[10px] text-slate-400 mt-1">Malware Distribution Feed</span>
            </div>
            <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-md flex flex-col items-center">
              <span className="font-semibold text-slate-200">AlienVault OTX</span>
              <span className="text-[10px] text-slate-400 mt-1">Adversary Threat Pulses</span>
            </div>
            <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-md flex flex-col items-center">
              <span className="font-semibold text-slate-200">Gemini 3.8 AI</span>
              <span className="text-[10px] text-slate-400 mt-1">Language & Urgency Heuristics</span>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture Highlights */}
      <section className="py-16 px-6 bg-[#0a0f1d] border-y border-slate-800/80">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Enterprise Forensic Discipline
            </h2>
            <p className="mt-3 text-xs md:text-sm text-slate-400">
              Unlike generic demos that fabricate scan results, TrustShield enforces strict evidentiary standards, multi-provider verification, and transparent uncertainty reporting.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-lg">
              <div className="w-10 h-10 rounded bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-4">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Zero-Trust URL Sandboxing</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                URLs are inspected without visiting or executing untrusted payloads. Server-side request forgery (SSRF) checks protect internal networks, while sensitive tokens and credentials in query parameters are strictly redacted.
              </p>
            </div>

            <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-lg">
              <div className="w-10 h-10 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Cryptographic Evidence Locker</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Every screenshot, message export, or document is hashed via client-side SHA-256 before storage in private buckets, providing tamper detection and an auditable chain of custody.
              </p>
            </div>

            <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-lg">
              <div className="w-10 h-10 rounded bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Audit-Grade Case Reporting</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Generate printable, PDF-ready investigation reports that clearly distinguish user-provided facts, technical threat signatures, unverified allegations, and AI contextual interpretations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-8 px-6 border-t border-slate-800/80 max-w-7xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-sky-400" />
          <span>TrustShield Cybersecurity Platform · Detect. Verify. Protect.</span>
        </div>
        <div className="text-[11px] font-mono text-slate-400">
          Not affiliated with law enforcement · No legal guilt implied
        </div>
      </footer>
    </div>
  );
};
