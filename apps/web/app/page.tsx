'use client';

import React, { useEffect, useState } from 'react';
import type { OverviewResponse, Repository, StatusResponse } from '@decisionvault/shared/api';
import { api } from './lib/api';
import {
  PageTitle,
  Card,
  StatusBadge,
  ConfidenceMeter,
  PageLoading,
  ErrorDisplay,
  EmptyState,
  SkeletonCard,
} from './components/ui';

export default function DashboardPage() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const [overviewData, reposData, statusData] = await Promise.allSettled([
        api.getOverview(),
        api.getRepositories(),
        api.getStatus(),
      ]);

      if (overviewData.status === 'fulfilled') setOverview(overviewData.value);
      if (reposData.status === 'fulfilled') setRepos(reposData.value.items);
      if (statusData.status === 'fulfilled') setStatus(statusData.value);
    } catch {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }

  const counts = overview?.counts;
  const totalDecisions = counts?.decisions ?? 0;
  const hasData = totalDecisions > 0 || repos.length > 0;

  return (
    <div className="space-y-8 animate-fade-in">
      <PageTitle
        title="DecisionVault — Engineering Memory"
        subtitle="Recover the decisions nobody wrote down. GitHub history → Decision recovery → Evidence verification → Code mapping."
        actions={
          <div className="flex items-center gap-2">
            <a
              href="/import"
              className="rounded-md bg-vault-accent/10 border border-vault-accent/30 px-4 py-2 text-xs font-semibold text-vault-accent hover:bg-vault-accent/20 transition-colors font-mono"
            >
              ↓ Import Repository
            </a>
            <a
              href="/decisions"
              className="rounded-md bg-vault-surface border border-vault-border px-4 py-2 text-xs font-medium text-vault-text hover:bg-vault-border transition-colors font-mono"
            >
              View Decisions →
            </a>
          </div>
        }
      />

      {/* ── Pipeline Flow ─────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-vault-border bg-vault-surface/30 p-5">
        <div className="text-[9px] font-mono uppercase tracking-widest text-vault-text-dim mb-4">
          Decision Recovery Pipeline
        </div>
        <div className="flex items-center justify-between gap-1 overflow-x-auto pb-2">
          {['IMPORT', 'RECOVER', 'VERIFY', 'MAP', 'DETECT'].map((stage, i) => (
            <React.Fragment key={stage}>
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-mono font-bold border ${
                    i < 3
                      ? 'bg-vault-accent/10 border-vault-accent/30 text-vault-accent'
                      : i === 3
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-vault-surface border-vault-border text-vault-text-dim'
                  }`}
                >
                  {i + 1}
                </div>
                <span className={`text-[9px] font-mono font-semibold tracking-wider ${
                  i < 3 ? 'text-vault-accent' : i === 3 ? 'text-emerald-400' : 'text-vault-text-dim'
                }`}>
                  {stage}
                </span>
              </div>
              {i < 4 && (
                <div className={`flex-1 h-px min-w-[20px] ${
                  i < 2 ? 'bg-vault-accent/30' : i === 2 ? 'bg-emerald-500/20' : 'bg-vault-border'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Architecture & Implementation Scope ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg border border-vault-border bg-vault-surface/30 p-4">
          <div className="text-[10px] font-mono text-vault-accent uppercase tracking-wider mb-1 font-semibold">
            Local AI Architecture
          </div>
          <p className="text-xs text-vault-text-dim leading-relaxed">
            Local Gemma 4 E4B (<code>gemma4:e4b</code>) running locally via Ollama. Zero cloud AI dependencies, no vector databases, fully private and deterministic.
          </p>
        </div>
        <div className="rounded-lg border border-vault-border bg-vault-surface/30 p-4">
          <div className="text-[10px] font-mono text-vault-accent uppercase tracking-wider mb-1 font-semibold">
            Deterministic Evidence Lock
          </div>
          <p className="text-xs text-vault-text-dim leading-relaxed">
            Every candidate evidence quote is normalized and checked against original GitHub discussion comments. Fabricated or paraphrased claims are rejected.
          </p>
        </div>
        <div className="rounded-lg border border-vault-border bg-vault-surface/30 p-4">
          <div className="text-[10px] font-mono text-vault-accent uppercase tracking-wider mb-1 font-semibold">
            Implementation Scope Status
          </div>
          <div className="text-xs text-vault-text-dim space-y-1">
            <div className="flex items-center gap-1.5 text-vault-text">
              <span className="text-emerald-400">✓</span> Phase 1: Shared types &amp; SQLite FTS5
            </div>
            <div className="flex items-center gap-1.5 text-vault-text">
              <span className="text-emerald-400">✓</span> Phase 3A: Live GitHub Ingestion
            </div>
            <div className="flex items-center gap-1.5 text-vault-accent font-medium">
              <span className="text-vault-accent">✓</span> Phase 3B: Gemma 4 E4B Decision Extraction
            </div>
          </div>
        </div>
      </div>

      {/* ── Metrics Grid ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard
          label="Repositories"
          value={repos.length}
          icon="⊞"
          color="text-vault-steel"
        />
        <MetricCard
          label="Sources Ingested"
          value={counts?.sources ?? 0}
          icon="↓"
          color="text-vault-text-muted"
        />
        <MetricCard
          label="Decisions Recovered"
          value={totalDecisions}
          icon="◇"
          color="text-vault-accent"
          highlight
        />
        <MetricCard
          label="Accepted"
          value={counts?.byStatus.accepted ?? 0}
          subValue={totalDecisions > 0 ? `${Math.round(((counts?.byStatus.accepted ?? 0) / totalDecisions) * 100)}%` : undefined}
          icon="✓"
          color="text-emerald-400"
        />
        <MetricCard
          label="Unverified Claims"
          value={counts?.unverifiedClaims ?? 0}
          icon="○"
          color="text-amber-400"
        />
      </div>

      {/* ── Status Row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="rounded-lg border border-vault-border bg-vault-surface/30 p-4">
          <div className="text-[9px] font-mono uppercase tracking-widest text-vault-text-dim mb-2">
            Decision Distribution
          </div>
          <div className="space-y-2">
            <StatusRow
              label="Accepted"
              count={counts?.byStatus.accepted ?? 0}
              total={totalDecisions}
              color="bg-emerald-500"
            />
            <StatusRow
              label="Rejected"
              count={counts?.byStatus.rejected ?? 0}
              total={totalDecisions}
              color="bg-rose-500"
            />
            <StatusRow
              label="Unresolved"
              count={counts?.byStatus.unresolved ?? 0}
              total={totalDecisions}
              color="bg-amber-500"
            />
          </div>
        </div>

        <div className="rounded-lg border border-vault-border bg-vault-surface/30 p-4">
          <div className="text-[9px] font-mono uppercase tracking-widest text-vault-text-dim mb-2">
            System Runtime
          </div>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-vault-text-dim">Backend</span>
              <span className={status?.ok ? 'text-emerald-400' : 'text-rose-400'}>
                {status?.ok ? '● ONLINE' : '○ OFFLINE'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-vault-text-dim">Database</span>
              <span className={status?.db ? 'text-emerald-400' : 'text-rose-400'}>
                {status?.db ? '● CONNECTED' : '○ DISCONNECTED'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-vault-text-dim">Ollama</span>
              <span className={status?.ollama.reachable ? 'text-emerald-400' : 'text-amber-400'}>
                {status?.ollama.reachable ? '● LIVE' : '○ REPLAY'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-vault-text-dim">Model</span>
              <span className="text-vault-text-muted">{status?.ollama.model || 'gemma4:e4b'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-vault-text-dim">Mode</span>
              <span className="text-vault-text-muted uppercase">{status?.ollama.mode || '—'}</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-vault-border bg-vault-surface/30 p-4">
          <div className="text-[9px] font-mono uppercase tracking-widest text-vault-text-dim mb-2">
            Quick Actions
          </div>
          <div className="space-y-2">
            <a
              href="/import"
              className="flex items-center gap-2 rounded-md border border-vault-border bg-vault-surface/50 px-3 py-2 text-xs font-mono text-vault-text-muted hover:text-vault-accent hover:border-vault-accent/30 transition-colors"
            >
              <span className="text-vault-accent">↓</span> Import GitHub Repository
            </a>
            <a
              href="/decisions"
              className="flex items-center gap-2 rounded-md border border-vault-border bg-vault-surface/50 px-3 py-2 text-xs font-mono text-vault-text-muted hover:text-vault-accent hover:border-vault-accent/30 transition-colors"
            >
              <span className="text-vault-accent">◇</span> Browse Recovered Decisions
            </a>
            <a
              href="/prior-art"
              className="flex items-center gap-2 rounded-md border border-vault-border bg-vault-surface/50 px-3 py-2 text-xs font-mono text-vault-text-muted hover:text-vault-accent hover:border-vault-accent/30 transition-colors"
            >
              <span className="text-vault-accent">⚡</span> Prior-Art Detection
            </a>
            <a
              href="/status"
              className="flex items-center gap-2 rounded-md border border-vault-border bg-vault-surface/50 px-3 py-2 text-xs font-mono text-vault-text-muted hover:text-vault-accent hover:border-vault-accent/30 transition-colors"
            >
              <span className="text-vault-accent">●</span> System Status
            </a>
          </div>
        </div>
      </div>

      {/* ── Attention Required ────────────────────────────────────────────── */}
      {overview && overview.attention.length > 0 && (
        <div>
          <div className="text-[9px] font-mono uppercase tracking-widest text-vault-text-dim mb-3">
            Attention Required — Low Confidence / Unresolved
          </div>
          <div className="space-y-2">
            {overview.attention.map((dec) => (
              <a
                key={dec.id}
                href={`/decisions/${dec.id}`}
                className="flex items-center justify-between rounded-lg border border-vault-border bg-vault-surface/30 p-4 hover:border-vault-border-bright hover:bg-vault-surface/50 transition-all group"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <StatusBadge status={dec.status} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-vault-text group-hover:text-vault-accent transition-colors truncate">
                      {dec.title}
                    </div>
                    <div className="text-[10px] font-mono text-vault-text-dim truncate mt-0.5">
                      {dec.sourceTitle}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                  <div className="w-24 hidden sm:block">
                    <ConfidenceMeter value={dec.confidence} />
                  </div>
                  <span className="text-xs font-mono text-vault-text-dim group-hover:text-vault-text-muted">
                    →
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── Imported Repositories ─────────────────────────────────────────── */}
      {repos.length > 0 && (
        <div>
          <div className="text-[9px] font-mono uppercase tracking-widest text-vault-text-dim mb-3">
            Imported Repositories
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {repos.map((repo) => (
              <a
                key={repo.id}
                href={`/repositories/${repo.id}`}
                className="rounded-lg border border-vault-border bg-vault-surface/30 p-4 hover:border-vault-border-bright hover:bg-vault-surface/50 transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm font-semibold text-vault-text group-hover:text-vault-accent transition-colors">
                    {repo.fullName}
                  </span>
                  <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[8px] font-mono font-bold text-emerald-400 uppercase">
                    Live
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono text-vault-text-dim">
                  <span>Branch: {repo.defaultBranch || 'main'}</span>
                  <span>•</span>
                  <span>Imported: {new Date(repo.importedAt).toLocaleDateString()}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty State ───────────────────────────────────────────────────── */}
      {!hasData && (
        <EmptyState
          icon="◈"
          title="No Engineering History Yet"
          description="Import a GitHub repository to begin recovering undocumented technical decisions from issues, pull requests, and review comments."
          action={{ label: 'Import Your First Repository', href: '/import' }}
        />
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  subValue,
  icon,
  color,
  highlight,
}: {
  label: string;
  value: number;
  subValue?: string;
  icon: string;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 transition-colors ${
        highlight
          ? 'border-vault-accent/20 bg-vault-accent/5'
          : 'border-vault-border bg-vault-surface/30'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-sm ${color}`}>{icon}</span>
        <span className="text-[9px] font-mono uppercase tracking-wider text-vault-text-dim">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold font-mono ${highlight ? 'text-vault-accent' : 'text-vault-text'}`}>
          {value}
        </span>
        {subValue && (
          <span className="text-[10px] font-mono text-vault-text-dim">{subValue}</span>
        )}
      </div>
    </div>
  );
}

function StatusRow({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between text-xs font-mono mb-1">
        <span className="text-vault-text-dim">{label}</span>
        <span className="text-vault-text-muted">{count} ({pct}%)</span>
      </div>
      <div className="h-1.5 rounded-full bg-vault-border overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
