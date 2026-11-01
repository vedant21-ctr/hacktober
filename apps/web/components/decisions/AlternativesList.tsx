import React from 'react';
import type { Alternative } from '@decisionvault/shared/api';
import { HealthBadge, Badge } from '../ui/Badge';
import { EvidenceLedger } from './EvidenceLedger';

interface AlternativesListProps {
  alternatives: Alternative[];
  isSampleData?: boolean;
}

export function AlternativesList({ alternatives, isSampleData = false }: AlternativesListProps) {
  if (!alternatives || alternatives.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-6 text-center text-xs text-slate-500">
        No alternatives recorded for this decision.
      </div>
    );
  }

  const chosen = alternatives.filter((a) => a.outcome === 'chosen');
  const rejected = alternatives.filter((a) => a.outcome === 'rejected');
  const open = alternatives.filter((a) => a.outcome === 'open');

  return (
    <div className="space-y-8">
      {/* Chosen / Accepted Option */}
      {chosen.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </span>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-emerald-300 font-mono">
              Accepted Alternative
            </h4>
            {isSampleData && (
              <span className="rounded bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-mono text-amber-300">
                Sample Fixture
              </span>
            )}
          </div>

          <div className="space-y-4">
            {chosen.map((alt) => (
              <div
                key={alt.id}
                className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-5 space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h5 className="text-base font-semibold text-emerald-100">{alt.name}</h5>
                    <span className="rounded bg-emerald-900/40 border border-emerald-700/50 px-2 py-0.5 text-xs text-emerald-300 font-mono">
                      Outcome: Chosen
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-300 leading-relaxed">{alt.description}</p>
                </div>

                {alt.reason && (
                  <div className="rounded bg-slate-900/70 border border-slate-800 p-3.5">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 block mb-1">
                      Selection Reasoning:
                    </span>
                    <p className="text-xs text-slate-200">{alt.reason}</p>
                  </div>
                )}

                {alt.evidence && alt.evidence.length > 0 && (
                  <div className="pt-2">
                    <EvidenceLedger
                      evidenceList={alt.evidence}
                      title="Evidence for Accepted Alternative"
                      isSampleData={isSampleData}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rejected Alternatives */}
      {rejected.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/20 text-rose-400">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </span>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-rose-300 font-mono">
              Rejected Alternatives ({rejected.length})
            </h4>
            {isSampleData && (
              <span className="rounded bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-mono text-amber-300">
                Sample Fixture
              </span>
            )}
          </div>

          <div className="space-y-4">
            {rejected.map((alt) => (
              <div
                key={alt.id}
                className="rounded-lg border border-rose-500/20 bg-slate-900/40 p-5 space-y-4 hover:border-rose-500/30 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h5 className="text-base font-semibold text-slate-100">{alt.name}</h5>
                  <div className="flex items-center gap-2 flex-wrap">
                    {alt.reasonCategory && (
                      <Badge variant="tech">Category: {alt.reasonCategory}</Badge>
                    )}
                    <span className="rounded bg-rose-950/60 border border-rose-800/60 px-2 py-0.5 text-xs text-rose-300 font-mono">
                      Outcome: Rejected
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">{alt.description}</p>

                {alt.reason && (
                  <div className="rounded bg-rose-950/20 border border-rose-900/40 p-3.5">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-rose-400 block mb-1">
                      Why it was rejected:
                    </span>
                    <p className="text-xs text-slate-200 leading-relaxed">{alt.reason}</p>
                  </div>
                )}

                {/* Conditions & Reopen Radar health */}
                {alt.conditions && alt.conditions.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block">
                      Conditions &amp; Constraint Probes:
                    </span>
                    <div className="space-y-2">
                      {alt.conditions.map((cond) => (
                        <div
                          key={cond.id}
                          className="rounded border border-slate-800 bg-slate-950/60 p-3 space-y-2"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="text-xs text-slate-300 font-mono">{cond.text}</span>
                            {cond.health && <HealthBadge state={cond.health.state} />}
                          </div>

                          {cond.health?.state === 'may_not_hold' && (
                            <div className="rounded bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs text-amber-200 space-y-1">
                              <p className="font-semibold text-amber-300">⚠ Reopen Radar Notice:</p>
                              <p className="text-[11px] leading-relaxed">
                                This historical rejection may deserve reconsideration because the
                                original constraint appears to have changed.
                              </p>
                              {cond.health.signalValue && (
                                <p className="font-mono text-[10px] text-amber-400/90">
                                  Signal: {cond.health.signalType || 'probe'} (
                                  {cond.health.signalValue}) in{' '}
                                  {cond.health.signalPath || 'manifest'}
                                </p>
                              )}
                              {cond.health.interpretation && (
                                <p className="text-[11px] text-amber-200/90 italic">
                                  &ldquo;{cond.health.interpretation}&rdquo;
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Evidence for this rejected alternative */}
                {alt.evidence && alt.evidence.length > 0 && (
                  <div className="pt-2">
                    <EvidenceLedger
                      evidenceList={alt.evidence}
                      title={`Evidence for rejection (${alt.name})`}
                      isSampleData={isSampleData}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Open Alternatives if any */}
      {open.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-400 font-mono">
            Open Alternatives ({open.length})
          </h4>
          <div className="space-y-3">
            {open.map((alt) => (
              <div
                key={alt.id}
                className="rounded-lg border border-slate-800 bg-slate-900/30 p-4 space-y-2"
              >
                <h5 className="text-sm font-semibold text-slate-200">{alt.name}</h5>
                <p className="text-xs text-slate-400">{alt.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
