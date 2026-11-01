'use client';

import React, { useState, useEffect } from 'react';
import type { DecisionCard, Repository } from '@decisionvault/shared/api';
import { api } from '../lib/api';
import {
  PageTitle,
  StatusBadge,
  LifecycleBadge,
  ConfidenceMeter,
  EmptyState,
  ErrorDisplay,
  SkeletonCard,
} from '../components/ui';

export default function DecisionsPage() {
  const [decisions, setDecisions] = useState<DecisionCard[]>([]);
  const [total, setTotal] = useState(0);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [repoId, setRepoId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    api.getRepositories().then((d) => setRepos(d.items)).catch(() => {});
  }, []);

  useEffect(() => {
    fetchDecisions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoId, statusFilter, page]);

  async function fetchDecisions() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDecisions({
        repoId: repoId ? Number(repoId) : undefined,
        status: statusFilter || undefined,
        q: search.trim() || undefined,
        page,
        pageSize,
      });
      setDecisions(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load decisions');
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    fetchDecisions();
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageTitle
        title="Recovered Decisions"
        subtitle="Engineering decisions extracted by local Gemma 4 E4B with deterministic Evidence Lock verification."
        actions={
          <a
            href="/import"
            className="rounded-md bg-vault-surface border border-vault-border px-3 py-2 text-xs font-mono text-vault-text-muted hover:text-vault-text hover:border-vault-border-bright transition-colors"
          >
            Manage Extractions
          </a>
        }
      />

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-vault-border bg-vault-surface/30 p-4">
        <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[9px] font-mono uppercase tracking-wider text-vault-text-dim mb-1.5">
              Repository
            </label>
            <select
              value={repoId}
              onChange={(e) => { setRepoId(e.target.value); setPage(1); }}
              className="w-full rounded-md border border-vault-border bg-vault-bg px-3 py-2 text-xs text-vault-text font-mono focus-vault"
            >
              <option value="">All Repositories</option>
              {repos.map((r) => (
                <option key={r.id} value={r.id}>{r.fullName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[9px] font-mono uppercase tracking-wider text-vault-text-dim mb-1.5">
              Decision Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-full rounded-md border border-vault-border bg-vault-bg px-3 py-2 text-xs text-vault-text font-mono focus-vault"
            >
              <option value="">All Statuses</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="unresolved">Unresolved</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[9px] font-mono uppercase tracking-wider text-vault-text-dim mb-1.5">
              Search FTS5 Index
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, summary, alternatives..."
                className="flex-1 rounded-md border border-vault-border bg-vault-bg px-3 py-2 text-xs text-vault-text font-mono placeholder-vault-text-dim focus-vault"
              />
              <button
                type="submit"
                className="rounded-md bg-vault-accent/10 border border-vault-accent/30 px-4 py-2 text-xs font-semibold text-vault-accent hover:bg-vault-accent/20 transition-colors font-mono"
              >
                Search
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ── Results ───────────────────────────────────────────────────────── */}
      {error ? (
        <ErrorDisplay message={error} onRetry={fetchDecisions} />
      ) : loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : decisions.length === 0 ? (
        <EmptyState
          icon="◇"
          title="No Decisions Found"
          description="Run Gemma decision extraction on an imported repository to recover engineering decisions."
          action={{ label: 'Go to Import & Extraction', href: '/import' }}
        />
      ) : (
        <>
          <div className="text-[10px] font-mono text-vault-text-dim">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} recovered decisions
          </div>

          <div className="space-y-2">
            {decisions.map((dec) => (
              <a
                key={dec.id}
                href={`/decisions/${dec.id}`}
                className="group block rounded-lg border border-vault-border bg-vault-surface/30 p-4 hover:border-vault-border-bright hover:bg-vault-surface/50 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <StatusBadge status={dec.status} />
                      <LifecycleBadge lifecycle={dec.lifecycle} />
                      <h2 className="text-sm font-semibold text-vault-text group-hover:text-vault-accent transition-colors">
                        {dec.title}
                      </h2>
                    </div>
                    <p className="text-xs text-vault-text-muted line-clamp-2 leading-relaxed">
                      {dec.summary}
                    </p>
                    <div className="mt-3 flex items-center gap-4 text-[10px] font-mono text-vault-text-dim flex-wrap">
                      <span>
                        Source:{' '}
                        <span className="text-vault-text-muted hover:text-vault-accent">
                          {dec.sourceTitle}
                        </span>
                      </span>
                      <span className="hidden sm:inline">
                        Evidence Verified:{' '}
                        <span className={dec.verifiedRatio >= 0.7 ? 'text-emerald-400' : 'text-amber-400'}>
                          {Math.round(dec.verifiedRatio * 100)}%
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <div className="w-20">
                      <ConfidenceMeter value={dec.confidence} />
                    </div>
                    <span className="text-[10px] font-mono text-vault-text-dim group-hover:text-vault-text-muted">
                      #{dec.id} →
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="rounded border border-vault-border bg-vault-surface px-3 py-1.5 text-xs font-mono text-vault-text-muted hover:text-vault-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ← Prev
              </button>
              <span className="text-xs font-mono text-vault-text-dim">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="rounded border border-vault-border bg-vault-surface px-3 py-1.5 text-xs font-mono text-vault-text-muted hover:text-vault-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
