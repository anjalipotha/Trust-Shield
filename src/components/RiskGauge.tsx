import React from 'react';
import { RiskLevel } from '../types';

interface RiskGaugeProps {
  score: number; // 0 - 100
  level: RiskLevel;
  size?: 'sm' | 'md' | 'lg';
}

export const RiskGauge: React.FC<RiskGaugeProps> = ({ score, level, size = 'md' }) => {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));

  let colorClass = 'bg-emerald-500';
  let textClass = 'text-emerald-400';
  if (clampedScore >= 75) {
    colorClass = 'bg-rose-500';
    textClass = 'text-rose-400';
  } else if (clampedScore >= 50) {
    colorClass = 'bg-orange-500';
    textClass = 'text-orange-400';
  } else if (clampedScore >= 25) {
    colorClass = 'bg-amber-500';
    textClass = 'text-amber-400';
  }

  if (level === 'inconclusive') {
    colorClass = 'bg-slate-500';
    textClass = 'text-slate-400';
  }

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400 uppercase tracking-wider font-semibold">Threat Risk Index</span>
        <span className={`font-mono font-bold ${textClass} ${size === 'lg' ? 'text-lg' : 'text-sm'}`}>
          {clampedScore}
          <span className="text-slate-500 text-xs font-normal"> / 100</span>
        </span>
      </div>
      <div className="w-full bg-slate-900 border border-slate-800 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full transition-all duration-700 ease-out ${colorClass}`}
          style={{ width: `${clampedScore}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
        <span>0 (Low)</span>
        <span>50 (Elevated)</span>
        <span>100 (Critical)</span>
      </div>
    </div>
  );
};
