'use client';

import React, { useState, useEffect } from 'react';
import type { Repository, RadarItem, Condition } from '@decisionvault/shared/api';
import { api, ApiClientError } from '../lib/api';
import {
  PageTitle,
  StatusBadge,
  EmptyState,
  ErrorDisplay,
  FeatureNotice,
  SkeletonCard,
} from '../components/ui';

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
    api.getRepositories().then((d) => {
      setRepos(d.items);
      if (d.items.length > 0) setSelectedRepoId(d.items[0].id);
    }).catch(() => {});
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
      // Attempt GET /api/radar?repoId=&state=
      try {
        const res = await api.getRadar(
          repoId,
          stateFilter !== 'all' ? stateFilter : undefined,
        );
        setRadarItems(res.items);
      } catch (radarErr) {
        if (radarErr instanceof ApiClientError && radarErr.status === 501) {
          setApiNotice(true);
        }
        // Fallback: Read conditions and health directly from decisions
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
        setRecheckSuccess('Recheck signal simulated (Backend /api/radar/recheck in Phase 4 roadmap).');
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
        <span className="rounded bg-vault-border/60 border border-vault-border px-2 py-0.5 text-[9px] font-mono font-bold text-vault-text-dim uppercase">
          ○ Unknown / Pending Probe
        </span>
      );
    }

    switch (health.state) {
      case 'holds':
        return (
          <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[9px] font-mono font-bold text-emerald-400 uppercase">
            ✓ Condition Holds
          </span>
        );
      case 'may_not_hold':
        return (
          <span className="rounded bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 text-[9px] font-mono font-bold text-rose-400 uppercase">
            ✕ Condition May Not Hold — Review Needed
          </span>
        );
      case 'unknown':
      default:
        return (
          <span className="rounded bg-vault-border/60 border border-vault-border px-2 py-0.5 text-[9px] font-mono font-bold text-vault-text-dim uppercase">
            ○ Unknown State
          </span>
        );
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <PageTitle
        title="Reopen Radar"
        subtitle="Engineering Condition Monitoring — Detect historical decisions whose operational assumptions or technical conditions may require reconsideration."
        actions={
          <div className="flex items-center gap-3">
            <select
              value={selectedRepoId || ''}
              onChange={(e) => setSelectedRepoId(Number(e.target.value))}
              className="rounded-md border border-vault-border bg-vault-surface px-3 py-1.5 text-xs text-vault-text font-mono focus-vault"
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
              className="rounded-md border border-vault-border bg-vault-surface px-3 py-1.5 text-xs text-vault-text font-mono focus-vault"
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
              className="rounded-md bg-vault-accent/10 border border-vault-accent/30 px-3 py-1.5 text-xs font-mono text-vault-accent hover:bg-vault-accent/20 transition-colors disabled:opacity-30 whitespace-nowrap"
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
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-400 font-mono">
          ✓ {recheckSuccess}
        </div>
      )}

      {error && <ErrorDisplay title="Radar Error" message={error} />}

      {/* ── Radar Items ────────────────────────────────────────────────────── */}
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
              className="rounded-lg border border-vault-border bg-vault-surface/30 p-5 space-y-4 hover:border-vault-border-bright transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getHealthStateBadge(item.health)}
                    <span className="text-[10px] font-mono text-vault-text-dim">
                      Alternative: <strong className="text-vault-text">{item.alternativeName}</strong>
                    </span>
                  </div>
                  <h3 className="text-sm font-bold font-mono text-vault-text">
                    <a
                      href={`/decisions/${item.decisionId}`}
                      className="hover:text-vault-accent underline decoration-vault-border"
                    >
                      {item.title}
                    </a>
                  </h3>
                </div>
                <a
                  href={`/decisions/${item.decisionId}`}
                  className="rounded border border-vault-border bg-vault-surface px-2.5 py-1 text-[10px] font-mono text-vault-text-muted hover:text-vault-accent transition-colors"
                >
                  Decision #{item.decisionId} →
                </a>
              </div>

              {/* Condition Details */}
              <div className="rounded border border-vault-border/60 bg-vault-bg/60 p-3.5 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-vault-text-dim text-[10px]">
                  <span>Condition Assumption:</span>
                  <span>
                    Kind: <code className="text-vault-accent">{item.condition.kind}</code> | Probe:{' '}
                    <code className="text-vault-steel">{item.condition.probe}</code>
                  </span>
                </div>
                <div className="text-vault-text font-sans font-medium text-xs leading-relaxed">
                  &ldquo;{item.condition.text}&rdquo;
                </div>
                {item.condition.probeValue && (
                  <div className="text-[10px] text-vault-text-dim">
                    Assumed Value: <code className="text-vault-text">{item.condition.probeValue}</code>
                  </div>
                )}
              </div>

              {/* Health Interpretation */}
              {item.health && (
                <div className="flex items-center justify-between text-[10px] font-mono text-vault-text-dim pt-1 border-t border-vault-border/40">
                  <div>
                    {item.health.interpretation ? (
                      <span>Interpretation: {item.health.interpretation}</span>
                    ) : (
                      <span>Signal Value: {item.health.signalValue || 'Normal'}</span>
                    )}
                  </div>
                  <span>Checked: {new Date(item.health.checkedAt).toLocaleDateString()}</span>
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
