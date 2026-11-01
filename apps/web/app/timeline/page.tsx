'use client';

import React, { useState, useEffect } from 'react';
import type { Repository, DecisionCard, DecisionDetail } from '@decisionvault/shared/api';
import { api, ApiClientError } from '../lib/api';
import {
  PageTitle,
  StatusBadge,
  ConfidenceMeter,
  EmptyState,
  ErrorDisplay,
  FeatureNotice,
  SkeletonCard,
} from '../components/ui';

interface ChronoEvent {
  type: string;
  at: string;
  author?: string;
  role?: string;
  quote?: string | null;
  sourceUrl: string;
  verified: boolean;
  decisionTitle?: string;
}

export default function DecisionTimelinePage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null);
  const [decisions, setDecisions] = useState<DecisionCard[]>([]);
  const [selectedDecisionId, setSelectedDecisionId] = useState<number | null>(null);
  const [selectedDecision, setSelectedDecision] = useState<DecisionDetail | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<ChronoEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiNotice, setApiNotice] = useState(false);

  useEffect(() => {
    api
      .getRepositories()
      .then((d) => {
        setRepos(d.items);
        if (d.items.length > 0) {
          setSelectedRepoId(d.items[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedRepoId) {
      loadDecisionsForRepo(selectedRepoId);
    }
  }, [selectedRepoId]);

  useEffect(() => {
    if (selectedDecisionId) {
      loadTimeline(selectedDecisionId);
    }
  }, [selectedDecisionId]);

  async function loadDecisionsForRepo(repoId: number) {
    try {
      const data = await api.getDecisions({ repoId, pageSize: 50 });
      setDecisions(data.items);
      if (data.items.length > 0) {
        setSelectedDecisionId(data.items[0].id);
      } else {
        setSelectedDecisionId(null);
        setSelectedDecision(null);
        setTimelineEvents([]);
      }
    } catch {
      // Continue
    }
  }

  async function loadTimeline(decisionId: number) {
    setLoading(true);
    setError(null);
    setApiNotice(false);

    try {
      const detail = await api.getDecisionDetail(decisionId);
      setSelectedDecision(detail);

      try {
        const timelineRes = await api.getTimeline(decisionId);
        setTimelineEvents(timelineRes.events);
      } catch (timelineErr) {
        if (timelineErr instanceof ApiClientError && timelineErr.status === 501) {
          setApiNotice(true);
        }
        const reconstructed: ChronoEvent[] = [];

        detail.events.forEach((ev) => {
          reconstructed.push({
            type: ev.type,
            at: ev.at,
            sourceUrl: ev.url,
            verified: true,
          });
        });

        detail.decisionEvidence.forEach((ev) => {
          reconstructed.push({
            type: 'decision',
            at: ev.at,
            author: ev.author,
            role: ev.role,
            quote: ev.quote,
            sourceUrl: ev.url,
            verified: ev.verified,
          });
        });

        detail.alternatives.forEach((alt) => {
          alt.evidence.forEach((ev) => {
            reconstructed.push({
              type: alt.outcome === 'rejected' ? 'rejection' : 'support',
              at: ev.at,
              author: ev.author,
              role: ev.role,
              quote: `[${alt.name}]: ${ev.quote}`,
              sourceUrl: ev.url,
              verified: ev.verified,
            });
          });
        });

        reconstructed.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
        setTimelineEvents(reconstructed);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  }

  function getEventTypeStyle(type: string) {
    switch (type.toLowerCase()) {
      case 'proposal':
        return {
          color: 'text-sky-400',
          border: 'border-sky-500/40',
          bg: 'bg-sky-500/10',
          icon: '▸',
        };
      case 'objection':
        return {
          color: 'text-amber-400',
          border: 'border-amber-500/40',
          bg: 'bg-amber-500/10',
          icon: '⚠',
        };
      case 'support':
        return {
          color: 'text-emerald-400',
          border: 'border-emerald-500/40',
          bg: 'bg-emerald-500/10',
          icon: '✓',
        };
      case 'rejection':
        return {
          color: 'text-rose-400',
          border: 'border-rose-500/40',
          bg: 'bg-rose-500/10',
          icon: '✕',
        };
      case 'clarification':
        return {
          color: 'text-slate-300',
          border: 'border-slate-700',
          bg: 'bg-slate-800/80',
          icon: 'ℹ',
        };
      case 'decision':
      default:
        return {
          color: 'text-emerald-400',
          border: 'border-emerald-500/40',
          bg: 'bg-emerald-500/10',
          icon: '◈',
        };
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <PageTitle
        title="Decision Timeline"
        subtitle="Chronological Discussion Flow — Trace how architectural decisions emerged, faced objections, and reached resolution."
        actions={
          <div className="flex items-center gap-3">
            <select
              value={selectedRepoId || ''}
              onChange={(e) => setSelectedRepoId(Number(e.target.value))}
              className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/80"
            >
              {repos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName}
                </option>
              ))}
            </select>
            <select
              value={selectedDecisionId || ''}
              onChange={(e) => setSelectedDecisionId(Number(e.target.value))}
              disabled={decisions.length === 0}
              className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/80 max-w-[280px] truncate"
            >
              {decisions.map((d) => (
                <option key={d.id} value={d.id}>
                  #{d.id}: {d.title}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {apiNotice && (
        <FeatureNotice
          feature="Decision Timeline API (GET /api/timeline/:decisionId)"
          description="The backend timeline endpoint is under active development. DecisionVault is reconstructing the chronological discussion trajectory from verified events, alternatives, and discussion quotes."
        />
      )}

      {error && <ErrorDisplay title="Timeline Error" message={error} />}

      {/* Selected Decision Summary Card */}
      {selectedDecision && (
        <div className="rounded-lg border border-slate-800/80 bg-[#0e1424]/75 p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              Timeline Subject
            </span>
            <div className="flex items-center gap-2">
              <StatusBadge status={selectedDecision.status} />
              <ConfidenceMeter value={selectedDecision.confidence} />
            </div>
          </div>
          <h2 className="text-base font-semibold text-slate-100">{selectedDecision.title}</h2>
          <p className="text-xs text-slate-400 leading-relaxed">{selectedDecision.summary}</p>
        </div>
      )}

      {/* Vertical Timeline */}
      {loading ? (
        <div className="space-y-4 py-8">
          {[...Array(3)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : timelineEvents.length > 0 ? (
        <div className="relative pl-6 sm:pl-8 border-l border-slate-800 ml-4 sm:ml-6 space-y-6 my-6">
          {timelineEvents.map((ev, idx) => {
            const style = getEventTypeStyle(ev.type);
            return (
              <div key={idx} className="relative group">
                {/* Node Marker */}
                <div
                  className={`absolute -left-[31px] sm:-left-[39px] top-1.5 w-5 h-5 rounded-full border ${style.border} ${style.bg} flex items-center justify-center text-[10px] font-mono font-bold ${style.color}`}
                >
                  {style.icon}
                </div>

                {/* Event Card */}
                <div className="rounded-lg border border-slate-800/80 bg-[#0e1424]/75 p-4 space-y-2 hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${style.bg} ${style.color}`}
                      >
                        {ev.type}
                      </span>
                      {ev.author && (
                        <span className="text-slate-200 font-medium">
                          @{ev.author}{' '}
                          {ev.role && (
                            <span className="text-slate-500 font-mono text-[11px]">
                              ({ev.role})
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {new Date(ev.at).toLocaleString()}
                    </span>
                  </div>

                  {ev.quote && (
                    <blockquote className="italic text-xs text-slate-300 border-l-2 border-slate-700 pl-3 my-2 leading-relaxed">
                      &ldquo;{ev.quote}&rdquo;
                    </blockquote>
                  )}

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-800/50">
                    <span
                      className={
                        ev.verified ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'
                      }
                    >
                      {ev.verified ? '✓ Verified in Git History' : '○ Unverified'}
                    </span>
                    <a
                      href={ev.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-400 hover:text-emerald-400 transition-colors font-medium"
                    >
                      View on GitHub ↗
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon="│"
          title="No Timeline Events"
          description="Select a decision above to view its chronological event trajectory."
        />
      )}
    </div>
  );
}
