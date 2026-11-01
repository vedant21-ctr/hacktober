'use client';

import React, { useState, useEffect } from 'react';
import type { StatusResponse, Repository } from '@decisionvault/shared/api';
import { api } from '../lib/api';
import { PageTitle, ErrorDisplay } from '../components/ui';

export default function SystemStatusPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState<Date>(new Date());

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadStatus() {
    try {
      const [statusData, reposData] = await Promise.allSettled([
        api.getStatus(),
        api.getRepositories(),
      ]);

      if (statusData.status === 'fulfilled') setStatus(statusData.value);
      if (reposData.status === 'fulfilled') setRepos(reposData.value.items);
      setLastCheckTime(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to query system status');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleManualRefresh() {
    setRefreshing(true);
    loadStatus();
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <PageTitle
        title="System Status & AI Transparency"
        subtitle="Live Health Monitoring — Verifying runtime services, local Gemma 4 E4B inference, and deterministic SQLite storage."
        actions={
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-vault-text-dim">
              Checked: {lastCheckTime.toLocaleTimeString()}
            </span>
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-vault-border bg-vault-surface px-3 py-1.5 text-xs font-medium text-vault-text hover:text-white hover:border-vault-border-bright transition-colors disabled:opacity-50"
            >
              <svg
                className={`w-3.5 h-3.5 text-slate-400 ${refreshing ? 'animate-spin text-emerald-400' : ''}`}
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M2.5 8a5.5 5.5 0 019.06-4.17l.94.92m-10 3.25V4.5m10 3.5a5.5 5.5 0 01-9.06 4.17l-.94-.92m10-3.25v3.5"
                />
              </svg>
              {refreshing ? 'Probing...' : 'Refresh'}
            </button>
          </div>
        }
      />

      {error && <ErrorDisplay title="Status Probe Failure" message={error} onRetry={loadStatus} />}

      {/* ── Core Subsystems Health ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Express Backend */}
        <div className="rounded-xl border border-vault-border bg-vault-surface/40 p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-vault-text-dim">
              Express Server
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-mono font-medium border ${
                status?.ok
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  status?.ok ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                }`}
              />
              {status?.ok ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-vault-text">API Gateway</h2>
            <p className="text-xs text-vault-text-dim leading-relaxed mt-1">
              Standard &amp; Polling Rate Limiters active. Contract version 1 enforced via Zod
              schema validation.
            </p>
          </div>
        </div>

        {/* SQLite Database */}
        <div className="rounded-xl border border-vault-border bg-vault-surface/40 p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-vault-text-dim">
              Database
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-mono font-medium border ${
                status?.db
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  status?.db ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              {status?.db ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-vault-text">
              SQLite + FTS5
            </h2>
            <p className="text-xs text-vault-text-dim leading-relaxed mt-1">
              Deterministic relational archive with full-text search index (FTS5) for rapid decision
              query retrieval.
            </p>
          </div>
        </div>

        {/* Local AI Engine */}
        <div className="rounded-xl border border-vault-border bg-vault-surface/40 p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-vault-text-dim">
              Local Inference
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-mono font-medium border ${
                status?.ollama.reachable
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  status?.ollama.reachable ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`}
              />
              {status?.ollama.reachable ? 'LIVE OLLAMA' : 'REPLAY MODE'}
            </span>
          </div>
          <div>
            <div className="text-base font-semibold tracking-tight text-vault-text flex items-center gap-2">
              <span>Local Model</span>
              <code className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {status?.ollama.model || 'gemma4:e4b'}
              </code>
            </div>
            <p className="text-xs text-vault-text-dim leading-relaxed mt-1">
              Local Gemma 4 E4B via Ollama. Current operating mode:{' '}
              <strong className="text-vault-text uppercase font-mono text-[11px]">
                {status?.ollama.mode || 'replay'}
              </strong>
              .
            </p>
          </div>
        </div>
      </div>

      {/* ── AI Transparency & Deterministic Architecture ───────────────────── */}
      <div className="rounded-xl border border-vault-border bg-vault-surface/40 p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-vault-border/60 pb-3">
          <div className="text-xs font-mono uppercase tracking-wider text-vault-text-dim flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            AI Architecture &amp; Privacy Transparency Guarantee
          </div>
          <span className="text-xs text-vault-text-dim font-mono">Zero Data Exfiltration</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-vault-border/60 bg-vault-bg/60 p-4 space-y-2">
            <div className="text-emerald-400 font-semibold text-sm flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[10px]">
                ✓
              </span>
              Zero Cloud AI Dependencies
            </div>
            <p className="text-vault-text-dim leading-relaxed text-xs">
              DecisionVault never transmits proprietary code, GitHub issues, or review comments to
              OpenAI, Anthropic, or external cloud LLM providers. All extraction runs locally on
              your machine.
            </p>
          </div>

          <div className="rounded-lg border border-vault-border/60 bg-vault-bg/60 p-4 space-y-2">
            <div className="text-emerald-400 font-semibold text-sm flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[10px]">
                ✓
              </span>
              No Vector Database Hallucinations
            </div>
            <p className="text-vault-text-dim leading-relaxed text-xs">
              Unlike semantic search architectures that synthesize unverified claims, DecisionVault
              enforces a deterministic Evidence Lock: quotes must exist character-for-character in
              original Git history.
            </p>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-mono text-vault-text-dim border-t border-vault-border/40">
          <span>
            Supported Model: <code className="text-vault-text">gemma4:e4b</code>
          </span>
          <span className="text-slate-700">•</span>
          <span>
            Inference Rate:{' '}
            <span className="text-vault-text">
              {status?.ollama.tokensPerSecLast
                ? `${status.ollama.tokensPerSecLast} tokens/sec`
                : 'Replay Speed'}
            </span>
          </span>
          <span className="text-slate-700">•</span>
          <span>
            Live Repositories: <span className="text-vault-text">{repos.length} Ingested</span>
          </span>
        </div>
      </div>
    </div>
  );
}
