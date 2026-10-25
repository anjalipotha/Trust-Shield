import React from 'react';
import { ScanProviderResult } from '../types';
import { CheckCircle2, AlertOctagon, HelpCircle, XCircle, Shield, Radio } from 'lucide-react';

interface ProviderStatusListProps {
  providers: ScanProviderResult[];
  compact?: boolean;
}

export const ProviderStatusList: React.FC<ProviderStatusListProps> = ({ providers, compact = false }) => {
  if (!providers || providers.length === 0) {
    return (
      <div className="text-xs text-slate-500 py-2">
        No external threat feeds reported for this scan.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {providers.map((p, idx) => {
        const isMalicious = p.status === 'malicious';
        const isSuspicious = p.status === 'suspicious';
        const isClean = p.status === 'clean';
        const isError = p.status === 'error';
        const isUnavailable = p.status === 'unavailable';

        return (
          <div
            key={idx}
            className={`border rounded-md p-3 transition-colors ${
              isMalicious
                ? 'bg-rose-950/20 border-rose-800/40 text-rose-200'
                : isSuspicious
                ? 'bg-amber-950/20 border-amber-800/40 text-amber-200'
                : isClean
                ? 'bg-slate-900/60 border-slate-800 text-slate-300'
                : 'bg-slate-900/40 border-slate-800/60 text-slate-400'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                {isMalicious && <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />}
                {isSuspicious && <Radio className="w-4 h-4 text-amber-400 shrink-0" />}
                {isClean && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                {isError && <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                {isUnavailable && <HelpCircle className="w-4 h-4 text-slate-500 shrink-0" />}

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs tracking-wide text-slate-100">
                      {p.provider_name}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded ${
                        isMalicious
                          ? 'bg-rose-500/20 text-rose-300'
                          : isSuspicious
                          ? 'bg-amber-500/20 text-amber-300'
                          : isClean
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                </div>
              </div>

              <span className="text-[11px] text-slate-500 font-mono">
                {p.checked_at ? new Date(p.checked_at).toLocaleTimeString() : 'Just now'}
              </span>
            </div>

            <p className="mt-2 text-xs text-slate-300 leading-relaxed">
              {p.result_summary}
            </p>

            {p.threat_categories && p.threat_categories.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 pt-1.5 border-t border-slate-800/60">
                {p.threat_categories.map((cat, cIdx) => (
                  <span
                    key={cIdx}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800/80 text-rose-300 border border-slate-700/60"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
