import React from 'react';
import type { PriorArtItem } from '@decisionvault/shared/api';
import { StatusBadge, Badge } from '../ui/Badge';
import { EvidenceLedger } from '../decisions/EvidenceLedger';
import Link from 'next/link';

interface PriorArtWarningCardProps {
  item: PriorArtItem;
  affectedFiles?: string[];
  className?: string;
  isSampleData?: boolean;
}

export function PriorArtWarningCard({
  item,
  affectedFiles,
  className = '',
  isSampleData = false,
}: PriorArtWarningCardProps) {
  const isConflict = item.relation === 'conflicts';
  const isRelated = item.relation === 'related';

  const containerBorder = isConflict
    ? 'border-rose-500/40 bg-rose-950/20'
    : isRelated
      ? 'border-blue-500/40 bg-blue-950/20'
      : 'border-slate-800 bg-slate-900/40';

  const badgeColor = isConflict
    ? 'bg-rose-950/80 text-rose-300 border-rose-700/70'
    : isRelated
      ? 'bg-blue-950/80 text-blue-300 border-blue-700/70'
      : 'bg-slate-800 text-slate-300 border-slate-700';

  return (
    <div className={`rounded-lg border ${containerBorder} p-5 space-y-4 ${className}`}>
      {/* Warning Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider border ${badgeColor}`}
          >
            {isConflict && (
              <svg className="w-3.5 h-3.5 text-rose-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            Relation: {item.relation}
          </span>
          <StatusBadge status={item.decision.status} />
          {isSampleData && (
            <span className="rounded bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-xs font-mono text-amber-300">
              Sample Precedent
            </span>
          )}
          <span className="text-xs font-mono text-slate-500">Decision #{item.decision.id}</span>
        </div>

        <Link
          href={`/decisions/${item.decision.id}`}
          className="text-xs font-mono text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
        >
          View Full Decision Dossier →
        </Link>
      </div>

      {/* Historical Decision Title */}
      <div>
        <h4 className="text-base font-semibold text-slate-100">{item.decision.title}</h4>
        <p className="mt-1 text-xs text-slate-400 leading-relaxed">{item.decision.summary}</p>
      </div>

      {/* Why it is relevant */}
      <div className="rounded bg-slate-900/80 border border-slate-800 p-3.5 space-y-1">
        <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 block font-semibold">
          Relevance Analysis:
        </span>
        <p className="text-xs text-slate-200 leading-relaxed">{item.reason}</p>
      </div>

      {/* Original Rejection Reasoning */}
      {item.rejectedBecause && (
        <div className="rounded bg-rose-950/20 border border-rose-900/40 p-3.5 space-y-1">
          <span className="text-[11px] font-mono uppercase tracking-wider text-rose-400 block font-semibold">
            Historically Rejected Because:
          </span>
          <p className="text-xs text-slate-200 leading-relaxed">{item.rejectedBecause}</p>
        </div>
      )}

      {/* Reconsider If / Conditions */}
      {item.reconsiderIf && (
        <div className="rounded bg-emerald-950/20 border border-emerald-800/40 p-3.5 space-y-1">
          <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 block font-semibold">
            Reconsideration Conditions (Reopen Radar):
          </span>
          <p className="text-xs text-emerald-200/90 leading-relaxed">{item.reconsiderIf}</p>
        </div>
      )}

      {/* Affected Files */}
      {affectedFiles && affectedFiles.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block">
            Affected Code Files:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {affectedFiles.map((file, idx) => (
              <span
                key={idx}
                className="font-mono text-xs bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-cyan-300"
              >
                {file}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Supporting Evidence Ledger */}
      {item.evidence && item.evidence.length > 0 && (
        <div className="pt-2">
          <EvidenceLedger
            evidenceList={item.evidence}
            title="Supporting Historical Evidence"
            isSampleData={isSampleData}
          />
        </div>
      )}

      {/* Original Source Discussion Link */}
      {item.decision.sourceUrl && (
        <div className="pt-2 flex justify-end">
          <a
            href={item.decision.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-slate-400 hover:text-emerald-400 inline-flex items-center gap-1.5 transition-colors"
          >
            <span>Read discussion thread ({item.decision.sourceTitle})</span>
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
      )}
    </div>
  );
}
