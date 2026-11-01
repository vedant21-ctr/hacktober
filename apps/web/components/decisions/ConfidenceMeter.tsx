import React from 'react';
import type { ConfidenceParts } from '@decisionvault/shared/api';
import { formatPercent } from '../../lib/formatters';

interface ConfidenceMeterProps {
  confidence: number;
  parts?: ConfidenceParts;
  isSampleData?: boolean;
}

export function ConfidenceMeter({ confidence, parts, isSampleData = false }: ConfidenceMeterProps) {
  const percent = Math.round(confidence * 100);

  const getMeterColor = (val: number) => {
    if (val >= 0.85) return 'bg-emerald-500';
    if (val >= 0.7) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="rounded-lg border border-slate-800/80 bg-[#0e1424]/70 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-slate-400 font-mono font-medium">
            Evidence Lock Confidence Score
          </span>
          {isSampleData && (
            <span className="rounded bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-mono text-amber-300">
              Sample Score
            </span>
          )}
        </div>
        <span className="text-sm font-bold text-slate-100 font-mono">{percent}%</span>
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 w-full rounded-full bg-slate-800/80 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${getMeterColor(confidence)}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Breakdown parts */}
      {parts && (
        <div className="pt-2 border-t border-slate-800/70 grid grid-cols-3 gap-2 text-center text-[10px]">
          <div className="rounded bg-[#080c14]/80 p-2.5 border border-slate-800/70">
            <span className="text-slate-400 block uppercase font-mono tracking-wider">
              Quote Coverage (40%)
            </span>
            <span className="text-xs font-semibold text-slate-200 block mt-1 font-mono">
              {formatPercent(parts.coverage)}
            </span>
          </div>
          <div className="rounded bg-[#080c14]/80 p-2.5 border border-slate-800/70">
            <span className="text-slate-400 block uppercase font-mono tracking-wider">
              Statement Author (40%)
            </span>
            <span className="text-xs font-semibold text-slate-200 block mt-1 font-mono">
              {formatPercent(parts.statement)}
            </span>
          </div>
          <div className="rounded bg-[#080c14]/80 p-2.5 border border-slate-800/70">
            <span className="text-slate-400 block uppercase font-mono tracking-wider">
              Reason Coverage (20%)
            </span>
            <span className="text-xs font-semibold text-slate-200 block mt-1 font-mono">
              {formatPercent(parts.reasonCoverage)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
