'use client';

import React, { useState, useEffect } from 'react';
import type { StatusResponse, Repository, Job } from '@decisionvault/shared/api';
import { api } from '../lib/api';
import {
  PageTitle,
  Card,
  StatusBadge,
  EmptyState,
  ErrorDisplay,
  SkeletonCard,
} from '../components/ui';

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
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <PageTitle
        title="System Status &amp; AI Transparency"
        subtitle="Live Health Monitoring — Verifying runtime services, local Gemma 4 E4B inference, and deterministic SQLite storage."
        actions={
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-vault-text-dim">
              Checked: {lastCheckTime.toLocaleTimeString()}
            </span>
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="rounded-md bg-vault-surface border border-vault-border px-3 py-1.5 text-xs font-mono text-vault-text hover:bg-vault-border transition-colors disabled:opacity-50"
            >
              {refreshing ? 'Probing...' : '↺ Refresh Now'}
            </button>
          </div>
        }
      />

      {error && <ErrorDisplay title="Status Probe Failure" message={error} onRetry={loadStatus} />}

      {/* ── Core Subsystems Health ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Express Backend */}
        <div className="rounded-lg border border-vault-border bg-vault-surface/30 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-vault-text-dim">
              Express Server
            </span>
            <span
              className={`rounded px-2 py-0.5 text-[9px] font-mono font-bold uppercase border ${
                status?.ok
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              {status?.ok ? '● ONLINE' : '○ OFFLINE'}
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-vault-text">API Gateway</div>
          <p className="text-xs text-vault-text-dim leading-relaxed">
            Standard &amp; Polling Rate Limiters active. Contract version 1 enforced via Zod schema
            validation.
          </p>
        </div>

        {/* SQLite Database */}
        <div className="rounded-lg border border-vault-border bg-vault-surface/30 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-vault-text-dim">
              Database
            </span>
            <span
              className={`rounded px-2 py-0.5 text-[9px] font-mono font-bold uppercase border ${
                status?.db
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}
            >
              {status?.db ? '● CONNECTED' : '○ DISCONNECTED'}
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-vault-text">SQLite + FTS5</div>
          <p className="text-xs text-vault-text-dim leading-relaxed">
            Deterministic relational archive with full-text search index (FTS5) for rapid decision
            query retrieval.
          </p>
        </div>

        {/* Local AI Engine */}
        <div className="rounded-lg border border-vault-border bg-vault-surface/30 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-vault-text-dim">
              Local Inference
            </span>
            <span
              className={`rounded px-2 py-0.5 text-[9px] font-mono font-bold uppercase border ${
                status?.ollama.reachable
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-vault-border text-vault-text-dim border-vault-border'
              }`}
            >
              {status?.ollama.reachable ? '● LIVE OLLAMA' : '○ REPLAY MODE'}
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-vault-accent">
            {status?.ollama.model || 'gemma4:e4b'}
          </div>
          <p className="text-xs text-vault-text-dim leading-relaxed">
            Local Gemma 4 E4B via Ollama. Current operating mode:{' '}
            <strong className="text-vault-text uppercase font-mono">
              {status?.ollama.mode || 'replay'}
            </strong>
            .
          </p>
        </div>
      </div>

      {/* ── AI Transparency & Deterministic Architecture ───────────────────── */}
      <div className="rounded-lg border border-vault-border bg-vault-surface/30 p-6 space-y-4">
        <div className="text-[9px] font-mono uppercase tracking-widest text-vault-text-dim">
          AI Architecture &amp; Privacy Transparency Guarantee
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="rounded border border-vault-border/60 bg-vault-bg/60 p-4 space-y-2">
            <div className="text-vault-accent font-semibold flex items-center gap-1.5">
              <span>✓</span> Zero Cloud AI Dependencies
            </div>
            <p className="text-vault-text-dim font-sans leading-relaxed text-xs">
              DecisionVault never transmits proprietary code, GitHub issues, or review comments to
              OpenAI, Anthropic, or external cloud LLM providers. All extraction runs locally on
              your machine.
            </p>
          </div>

          <div className="rounded border border-vault-border/60 bg-vault-bg/60 p-4 space-y-2">
            <div className="text-vault-accent font-semibold flex items-center gap-1.5">
              <span>✓</span> No Vector Database Hallucinations
            </div>
            <p className="text-vault-text-dim font-sans leading-relaxed text-xs">
              Unlike semantic search architectures that synthesize unverified claims, DecisionVault
              enforces a deterministic Evidence Lock: quotes must exist character-for-character in
              original Git history.
            </p>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center gap-4 text-[10px] font-mono text-vault-text-dim">
          <span>
            Supported Model: <code className="text-vault-text">gemma4:e4b</code>
          </span>
          <span>•</span>
          <span>
            Inference Rate:{' '}
            {status?.ollama.tokensPerSecLast
              ? `${status.ollama.tokensPerSecLast} tokens/sec`
              : 'Replay Speed'}
          </span>
          <span>•</span>
          <span>Live Repositories: {repos.length} Ingested</span>
        </div>
      </div>
    </div>
  );
}
