import React from 'react';
import Link from 'next/link';
import type { DecisionCard as DecisionCardType } from '@decisionvault/shared/api';
import { StatusBadge, Badge } from '../ui/Badge';
import { formatPercent } from '../../lib/formatters';

interface DecisionCardProps {
  decision: DecisionCardType;
  className?: string;
  isSampleData?: boolean;
}

export function DecisionCard({
  decision,
  className = '',
  isSampleData = false,
}: DecisionCardProps) {
  const confidenceColor =
    decision.confidence >= 0.9
      ? 'text-emerald-400'
      : decision.confidence >= 0.7
        ? 'text-amber-400'
        : 'text-slate-400';

  return (
    <div
      className={`group rounded-lg border border-slate-800 bg-slate-900/40 p-5 hover:border-slate-700 hover:bg-slate-900/60 transition-all ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={decision.status} />
          {decision.lifecycle === 'superseded' && <Badge variant="superseded">Superseded</Badge>}
          {isSampleData && (
            <span className="rounded bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-mono text-amber-300">
              Sample Fixture
            </span>
          )}
          <span className="text-xs font-mono text-slate-500">ID #{decision.id}</span>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span
            title={
              isSampleData
                ? 'Sample Evidence Lock confidence score'
                : 'Evidence Lock confidence score'
            }
            className="flex items-center gap-1 text-slate-400"
          >
            Conf:{' '}
            <span className={`font-semibold ${confidenceColor}`}>
              {formatPercent(decision.confidence)}
            </span>
          </span>
          <span className="text-slate-600">•</span>
          <span
            title={
              isSampleData
                ? 'Sample ratio of verified claims'
                : 'Ratio of claims verified against source discussion text'
            }
            className="text-slate-400"
          >
            Verified:{' '}
            <span className="text-slate-200">{formatPercent(decision.verifiedRatio)}</span>
          </span>
        </div>
      </div>

      <Link href={`/decisions/${decision.id}`} className="block">
        <h3 className="text-base font-semibold text-slate-100 group-hover:text-emerald-300 transition-colors">
          {decision.title}
        </h3>
        <p className="mt-1.5 text-xs text-slate-400 leading-relaxed line-clamp-2">
          {decision.summary}
        </p>
      </Link>

      <div className="mt-4 pt-3 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 font-mono">
        <div className="flex items-center gap-1.5 truncate max-w-md">
          <svg
            className="w-3.5 h-3.5 text-slate-600 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
            />
          </svg>
          <span className="text-slate-400 truncate">{decision.sourceTitle}</span>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {decision.sourceUrl && (
            <a
              href={decision.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-emerald-400 inline-flex items-center gap-1 text-xs transition-colors"
            >
              Source Discussion
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          )}
          <Link
            href={`/decisions/${decision.id}`}
            className="text-emerald-400 hover:text-emerald-300 font-medium inline-flex items-center gap-1"
          >
            Inspect Details →
          </Link>
        </div>
      </div>
    </div>
  );
}
