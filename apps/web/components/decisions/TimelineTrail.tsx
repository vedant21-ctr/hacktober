import React from 'react';
import type { DecisionEvent } from '@decisionvault/shared/api';
import { formatDate } from '../../lib/formatters';

interface TimelineTrailProps {
  events: DecisionEvent[];
}

const eventTypeStyles: Record<string, { label: string; color: string; dot: string }> = {
  proposed: { label: 'Proposed', color: 'text-blue-400', dot: 'bg-blue-400' },
  objected: { label: 'Objected', color: 'text-rose-400', dot: 'bg-rose-400' },
  agreed: { label: 'Agreed', color: 'text-cyan-400', dot: 'bg-cyan-400' },
  decided: { label: 'Decided', color: 'text-emerald-400', dot: 'bg-emerald-400' },
  revised: { label: 'Revised', color: 'text-amber-400', dot: 'bg-amber-400' },
};

export function TimelineTrail({ events }: TimelineTrailProps) {
  if (!events || events.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/20 p-6 text-center text-xs text-slate-500">
        No chronological events recorded for this decision.
      </div>
    );
  }

  const sorted = [...events].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
        Discussion Evolution &amp; Event Trail
      </h4>

      <div className="relative border-l border-slate-800 ml-3 pl-6 space-y-6">
        {sorted.map((ev, idx) => {
          const config = eventTypeStyles[ev.type] || {
            label: ev.type,
            color: 'text-slate-400',
            dot: 'bg-slate-400',
          };

          return (
            <div key={idx} className="relative group">
              <span
                className={`absolute -left-[31px] top-1 h-2.5 w-2.5 rounded-full ${config.dot} ring-4 ring-slate-950`}
              />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span
                  className={`text-xs font-mono font-bold uppercase tracking-wider ${config.color}`}
                >
                  {config.label}
                </span>
                <time dateTime={ev.at} className="text-[11px] text-slate-500 font-mono">
                  {formatDate(ev.at)}
                </time>
              </div>

              {ev.url && (
                <div className="mt-1">
                  <a
                    href={ev.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-slate-400 hover:text-emerald-400 inline-flex items-center gap-1 font-mono transition-colors"
                  >
                    View discussion thread comment →
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
