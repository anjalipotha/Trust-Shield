import React from 'react';
import { RiskLevel } from '../types';
import { ShieldCheck, AlertTriangle, ShieldAlert, AlertCircle, HelpCircle } from 'lucide-react';

interface RiskBadgeProps {
  level: RiskLevel;
  score?: number;
  showIcon?: boolean;
  className?: string;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  level,
  score,
  showIcon = true,
  className = '',
}) => {
  const config = {
    low: {
      label: 'Low Risk',
      textColor: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10 border-emerald-500/20',
      icon: ShieldCheck,
    },
    medium: {
      label: 'Medium Risk / Suspicious',
      textColor: 'text-amber-400',
      bgColor: 'bg-amber-500/10 border-amber-500/20',
      icon: AlertTriangle,
    },
    high: {
      label: 'High Risk',
      textColor: 'text-orange-400',
      bgColor: 'bg-orange-500/10 border-orange-500/20',
      icon: AlertCircle,
    },
    critical: {
      label: 'Critical Threat / Malicious',
      textColor: 'text-rose-400',
      bgColor: 'bg-rose-500/10 border-rose-500/20',
      icon: ShieldAlert,
    },
    inconclusive: {
      label: 'Inconclusive / Unverified',
      textColor: 'text-slate-400',
      bgColor: 'bg-slate-500/10 border-slate-500/20',
      icon: HelpCircle,
    },
  }[level] || {
    label: 'Unknown',
    textColor: 'text-slate-400',
    bgColor: 'bg-slate-500/10 border-slate-500/20',
    icon: HelpCircle,
  };

  const IconComponent = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border rounded ${config.bgColor} ${config.textColor} ${className}`}
    >
      {showIcon && <IconComponent className="w-3.5 h-3.5 shrink-0" />}
      <span>{config.label}</span>
      {typeof score === 'number' && (
        <span className="opacity-75 font-mono text-[11px]">({score}/100)</span>
      )}
    </span>
  );
};
