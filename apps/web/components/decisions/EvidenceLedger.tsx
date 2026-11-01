import React from 'react';
import type { Evidence } from '@decisionvault/shared/api';
import { VerificationBadge, Badge } from '../ui/Badge';
import { formatDate } from '../../lib/formatters';

interface EvidenceLedgerProps {
  evidenceList: Evidence[];
  title?: string;
  emptyMessage?: string;
  isSampleData?: boolean;
}

export function EvidenceLedger({
  evidenceList,
  title = 'Verified Evidence Ledger',
  emptyMessage = 'No supporting quotes recorded for this decision.',
  isSampleData = false,
}: EvidenceLedgerProps) {
  if (!evidenceList || evidenceList.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800/80 bg-[#0e1424]/40 p-6 text-center text-xs text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
            {title} ({evidenceList.length})
          </h4>
          {isSampleData && (
            <span className="rounded bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-mono text-amber-300">
              Sample Data
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400">
          {isSampleData
            ? 'Sample contract quotes for demonstration'
            : 'Anchored in source discussion comments via Evidence Lock'}
        </span>
      </div>

      <div className="space-y-3">
        {evidenceList.map((item) => (
          <div
            key={item.id}
            className="rounded-lg border border-slate-800/80 bg-[#080c14]/90 p-4 transition-colors hover:border-slate-700/80 space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <VerificationBadge
                  verified={item.verified}
                  method={item.method}
                  score={item.score}
                />
                <Badge variant="tech">{item.claimType.replace('_', ' ')}</Badge>
                {isSampleData && (
                  <span className="text-[10px] text-amber-400/80 font-mono">
                    (Sample Demonstration)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <span className="text-slate-300 font-medium">@{item.author}</span>
                <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-slate-400 uppercase">
                  {item.role}
                </span>
                <span className="text-slate-700">•</span>
                <time dateTime={item.at} className="text-slate-400">
                  {formatDate(item.at)}
                </time>
              </div>
            </div>

            <blockquote className="border-l-2 border-emerald-500/60 pl-3.5 py-1.5 text-xs text-slate-200 bg-[#0e1424]/60 rounded-r leading-relaxed italic">
              &ldquo;{item.quote}&rdquo;
            </blockquote>

            <div className="flex justify-end pt-1">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Inspect Original Comment
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
