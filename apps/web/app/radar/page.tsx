'use client';

import React, { useState, useEffect } from 'react';
import type { Repository, RadarItem } from '@decisionvault/shared/api';
import { api, ApiClientError } from '../lib/api';
import { PageTitle, EmptyState, ErrorDisplay, FeatureNotice, SkeletonCard } from '../components/ui';

export default function ReopenRadarPage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null);
  const [radarItems, setRadarItems] = useState<RadarItem[]>([]);
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [isRechecking, setIsRechecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiNotice, setApiNotice] = useState(false);
  const [recheckSuccess, setRecheckSuccess] = useState<string | null>(null);

  useEffect(() => {
    api
      .getRepositories()
      .then((d) => {
        setRepos(d.items);
        if (d.items.length > 0) setSelectedRepoId(d.items[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedRepoId) {
      loadRadar(selectedRepoId);
    }
  }, [selectedRepoId, stateFilter]);

  async function loadRadar(repoId: number) {
    setLoading(true);
    setError(null);
    setApiNotice(false);

    try {
      try {
        const res = await api.getRadar(repoId, stateFilter !== 'all' ? stateFilter : undefined);
        setRadarItems(res.items);
      } catch (radarErr) {
        if (radarErr instanceof ApiClientError && radarErr.status === 501) {
          setApiNotice(true);
        }
        await buildRadarFromDecisions(repoId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Reopen Radar signals');
    } finally {
      setLoading(false);
    }
  }

  async function buildRadarFromDecisions(repoId: number) {
    const decisionsData = await api.getDecisions({ repoId, pageSize: 50 });
    const items: RadarItem[] = [];

    for (const dec of decisionsData.items) {
      try {
        const detail = await api.getDecisionDetail(dec.id);
        detail.alternatives.forEach((alt) => {
          alt.conditions.forEach((c) => {
            const matchesState =
              stateFilter === 'all' ||
              (c.health && c.health.state === stateFilter) ||
              (!c.health && stateFilter === 'unknown');

            if (matchesState) {
              items.push({
                decisionId: dec.id,
                title: dec.title,
                alternativeName: alt.name,
                condition: c,
                health: c.health,
              });
            }
          });
        });
      } catch {
        // continue
      }
    }

    setRadarItems(items);
  }

  async function handleRecheck() {
    if (!selectedRepoId) return;
    setIsRechecking(true);
    setRecheckSuccess(null);
    try {
      await api.recheckRadar({ repoId: selectedRepoId });
      setRecheckSuccess('Condition probe recheck dispatched successfully.');
      loadRadar(selectedRepoId);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 501) {
        setRecheckSuccess(
          'Recheck signal simulated (Backend /api/radar/recheck in Phase 4 roadmap).',
        );
      } else {
        setError(err instanceof Error ? err.message : 'Recheck failed');
      }
    } finally {
      setIsRechecking(false);
    }
  }

  function getHealthStateBadge(health: RadarItem['health']) {
    if (!health) {
      return (
        <span className="rounded-md bg-slate-800 border border-slate-700 px-2 py-0.5 text-[11px] font-medium text-slate-400">
          ○ Unknown / Pending Probe
        </span>
      );
    }

    switch (health.state) {
      case 'holds':
        return (
          <span className="rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
            ✓ Condition Holds
          </span>
        );
      case 'may_not_hold':
        return (
          <span className="rounded-md bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 text-[11px] font-medium text-rose-400">
            ✕ Condition May Not Hold — Review Needed
          </span>
        );
      case 'unknown':
      default:
        return (
          <span className="rounded-md bg-slate-800 border border-slate-700 px-2 py-0.5 text-[11px] font-medium text-slate-400">
            ○ Unknown State
          </span>
        );
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <PageTitle
        title="Reopen Radar"
        subtitle="Engineering Condition Monitoring — Detect historical decisions whose operational assumptions or technical conditions may require reconsideration."
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
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/80"
            >
              <option value="all">All Condition States</option>
              <option value="may_not_hold">May Not Hold Only</option>
              <option value="holds">Holds Only</option>
              <option value="unknown">Unknown Only</option>
            </select>
            <button
              type="button"
              onClick={handleRecheck}
              disabled={isRechecking || !selectedRepoId}
              className="rounded-md bg-emerald-600/10 border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-600/20 transition-colors disabled:opacity-30 whitespace-nowrap"
            >
              {isRechecking ? 'Probing...' : '↺ Probe Conditions'}
            </button>
          </div>
        }
      />

      {apiNotice && (
        <FeatureNotice
          feature="Reopen Radar API (GET /api/radar &amp; POST /api/radar/recheck)"
          description="The active background probe runner is currently in development on the backend. Radar signals shown here represent live condition contracts extracted from recovered decision alternatives."
        />
      )}

      {recheckSuccess && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400">
          ✓ {recheckSuccess}
        </div>
      )}

      {error && <ErrorDisplay title="Radar Error" message={error} />}

      {/* Radar Items */}
      {loading ? (
        <div className="space-y-4 py-6">
          {[...Array(3)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : radarItems.length > 0 ? (
        <div className="space-y-4">
          {radarItems.map((item, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-slate-800/80 bg-[#0e1424]/75 p-5 space-y-4 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getHealthStateBadge(item.health)}
                    <span className="text-xs text-slate-400">
                      Alternative:{' '}
                      <strong className="text-slate-200">{item.alternativeName}</strong>
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-100">
                    <a
                      href={`/decisions/${item.decisionId}`}
                      className="hover:text-emerald-300 transition-colors"
                    >
                      {item.title}
                    </a>
                  </h3>
                </div>
                <a
                  href={`/decisions/${item.decisionId}`}
                  className="rounded border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-slate-300 hover:text-emerald-300 transition-colors font-mono"
                >
                  Decision #{item.decisionId} →
                </a>
              </div>

              {/* Condition Details */}
              <div className="rounded-md border border-slate-800 bg-[#080c14]/80 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span className="font-medium">Condition Assumption:</span>
                  <span className="font-mono text-[11px]">
                    Kind: <code className="text-emerald-400">{item.condition.kind}</code> | Probe:{' '}
                    <code className="text-slate-300">{item.condition.probe}</code>
                  </span>
                </div>
                <div className="text-slate-200 font-medium text-xs leading-relaxed">
                  &ldquo;{item.condition.text}&rdquo;
                </div>
                {item.condition.probeValue && (
                  <div className="text-xs text-slate-400 font-mono">
                    Assumed Value:{' '}
                    <code className="text-slate-200">{item.condition.probeValue}</code>
                  </div>
                )}
              </div>

              {/* Health Interpretation */}
              {item.health && (
                <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/60">
                  <div>
                    {item.health.interpretation ? (
                      <span>Interpretation: {item.health.interpretation}</span>
                    ) : (
                      <span>Signal Value: {item.health.signalValue || 'Normal'}</span>
                    )}
                  </div>
                  <span className="font-mono text-[11px]">
                    Checked: {new Date(item.health.checkedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="◎"
          title="No Failing Conditions Detected"
          description="All extracted decision assumptions and environment probes are currently healthy or awaiting next extraction cycle."
        />
      )}
    </div>
  );
}
