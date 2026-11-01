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
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 space-y-3 font-mono">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-slate-400">
            Evidence Lock Confidence Score
          </span>
          {isSampleData && (
            <span className="rounded bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-mono text-amber-300">
              Sample Score
            </span>
          )}
        </div>
        <span className="text-sm font-bold text-slate-100">{percent}%</span>
      </div>

      {/* Progress Bar */}
      <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${getMeterColor(confidence)}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Breakdown parts */}
      {parts && (
        <div className="pt-2 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-center text-[10px]">
          <div className="rounded bg-slate-950/60 p-2 border border-slate-800/60">
            <span className="text-slate-500 block uppercase">Quote Coverage (40%)</span>
            <span className="text-xs font-semibold text-slate-200 block mt-0.5">
              {formatPercent(parts.coverage)}
            </span>
          </div>
          <div className="rounded bg-slate-950/60 p-2 border border-slate-800/60">
            <span className="text-slate-500 block uppercase">Statement Author (40%)</span>
            <span className="text-xs font-semibold text-slate-200 block mt-0.5">
              {formatPercent(parts.statement)}
            </span>
          </div>
          <div className="rounded bg-slate-950/60 p-2 border border-slate-800/60">
            <span className="text-slate-500 block uppercase">Reason Coverage (20%)</span>
            <span className="text-xs font-semibold text-slate-200 block mt-0.5">
              {formatPercent(parts.reasonCoverage)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
