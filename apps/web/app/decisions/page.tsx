'use client';

import React, { useState, useEffect } from 'react';
import type { DecisionCard, DecisionDetail, Repository } from '@decisionvault/shared/api';

export default function DecisionsPage() {
  const [decisions, setDecisions] = useState<DecisionCard[]>([]);
  const [total, setTotal] = useState(0);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filePathFilter, setFilePathFilter] = useState<string>('');
  const [selectedDecision, setSelectedDecision] = useState<DecisionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    fetchRepositories();
  }, []);

  useEffect(() => {
    fetchDecisions();
  }, [selectedRepoId, statusFilter]);

  async function fetchRepositories() {
    try {
      const res = await fetch('/api/repositories');
      if (res.ok) {
        const data = await res.json();
        setRepositories(data.items || []);
      }
    } catch (err) {
      console.error('Failed to load repositories:', err);
    }
  }

  async function fetchDecisions() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedRepoId) params.append('repoId', selectedRepoId);
      if (statusFilter) params.append('status', statusFilter);
      if (searchQuery.trim()) params.append('q', searchQuery.trim());
      if (filePathFilter.trim()) params.append('filePath', filePathFilter.trim());

      const res = await fetch(`/api/decisions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDecisions(data.items || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to load decisions:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchDecisions();
  }

  async function openDecisionDetail(id: number) {
    setLoadingDetail(true);
    setDetailError(null);
    try {
      const res = await fetch(`/api/decisions/${id}`);
      if (res.ok) {
        const detail: DecisionDetail = await res.json();
        setSelectedDecision(detail);
      } else {
        setDetailError(`Failed to load decision detail (HTTP ${res.status})`);
      }
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Error fetching decision');
    } finally {
      setLoadingDetail(false);
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-xs font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            Accepted
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 text-xs font-medium text-rose-400">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400"></span>
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-xs font-medium text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
            Unresolved
          </span>
        );
    }
  }

  function getEvidenceChip(verified: boolean, method: string, score: number) {
    if (verified && method === 'normalized_exact') {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-xs font-medium text-emerald-300">
          <span className="text-emerald-400">✓</span> Evidence Locked (Exact)
        </span>
      );
    }
    if (verified && method === 'fuzzy') {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-xs font-medium text-amber-300">
          ≈ Approximate ({score})
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 text-xs font-medium text-rose-400">
        ○ Unverified Claim
      </span>
    );
  }

  return (
    <div className="py-2 max-w-6xl space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">
            Recovered Decisions
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Engineering decisions extracted by local Gemma 4 E4B with deterministic Evidence Lock.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/import"
            className="rounded-md bg-slate-900 border border-slate-800 hover:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors"
          >
            Manage Extractions
          </a>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="rounded-lg border border-slate-800/80 bg-[#0e1424]/75 p-4 shadow-sm">
        <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Repository</label>
            <select
              value={selectedRepoId}
              onChange={(e) => setSelectedRepoId(e.target.value)}
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/80"
            >
              <option value="">All Repositories</option>
              {repositories.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Decision Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/80"
            >
              <option value="">All Statuses</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="unresolved">Unresolved</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">File Path</label>
            <input
              type="text"
              placeholder="e.g. src/auth.ts..."
              value={filePathFilter}
              onChange={(e) => setFilePathFilter(e.target.value)}
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/80 font-mono"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Search FTS5 Index
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search title, summary, or alternatives..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 rounded-md border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/80"
              />
              <button
                type="submit"
                className="rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition-colors shadow-sm"
              >
                Search
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Decisions List */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500">
          Loading recovered decisions...
        </div>
      ) : decisions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-800/80 bg-[#0e1424]/40 p-8 text-center">
          <p className="text-sm font-medium text-slate-300">No decisions found.</p>
          <p className="mt-1 text-xs text-slate-500">
            Run Gemma decision extraction on an imported repository to recover engineering
            decisions.
          </p>
          <a
            href="/import"
            className="mt-4 inline-block rounded-md bg-emerald-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition-colors shadow-sm"
          >
            Go to Import &amp; Extraction
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-slate-400 flex items-center justify-between px-1">
            <span>
              Showing <strong className="text-slate-200 font-mono">{decisions.length}</strong> of{' '}
              <strong className="text-slate-200 font-mono">{total}</strong> recovered decisions
            </span>
            <span className="text-[11px] text-slate-500 font-mono">FTS5 Sync Active</span>
          </div>

          {decisions.map((dec) => (
            <div
              key={dec.id}
              onClick={() => openDecisionDetail(dec.id)}
              className="group cursor-pointer rounded-lg border border-slate-800/80 bg-[#0e1424]/75 p-5 hover:border-slate-700 hover:bg-[#131b2e] transition-all duration-150"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusBadge(dec.status)}
                    <h2 className="text-sm sm:text-base font-semibold text-slate-100 group-hover:text-emerald-300 transition-colors">
                      {dec.title}
                    </h2>
                    <span className="text-xs font-mono text-slate-500">#{dec.id}</span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {dec.summary}
                  </p>
                  <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
                    <span className="truncate max-w-sm">
                      Source:{' '}
                      <a
                        href={dec.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-slate-400 hover:text-emerald-400 underline decoration-slate-700"
                      >
                        {dec.sourceTitle}
                      </a>
                    </span>
                    <span className="text-slate-700">•</span>
                    <span>
                      Confidence:{' '}
                      <span className="text-slate-200 font-semibold">
                        {Math.round(dec.confidence * 100)}%
                      </span>
                    </span>
                    <span className="text-slate-700">•</span>
                    <span>
                      Evidence Verified:{' '}
                      <span className="text-emerald-400 font-semibold">
                        {Math.round(dec.verifiedRatio * 100)}%
                      </span>
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 pt-0.5">
                  <span className="text-xs font-medium text-slate-400 group-hover:text-emerald-300 transition-colors inline-flex items-center gap-1">
                    View Details →
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Loading Detail Modal */}
      {loadingDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="rounded-lg border border-slate-700 bg-slate-900 px-6 py-4 shadow-2xl flex items-center gap-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
            <span className="text-xs text-slate-300">Loading decision detail...</span>
          </div>
        </div>
      )}

      {/* Detail Error Toast */}
      {detailError && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md rounded-lg border border-rose-500/30 bg-rose-950/90 p-4 text-xs text-rose-200 shadow-xl backdrop-blur-sm flex items-start justify-between gap-3">
          <span>{detailError}</span>
          <button
            onClick={() => setDetailError(null)}
            className="text-rose-400 hover:text-rose-100 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Decision Detail Modal */}
      {selectedDecision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg border border-slate-700 bg-[#0e1424] p-6 shadow-2xl space-y-6">
            <button
              onClick={() => setSelectedDecision(null)}
              className="absolute top-4 right-4 rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
              aria-label="Close modal"
            >
              ✕
            </button>

            <div>
              <div className="flex items-center gap-2 mb-2">
                {getStatusBadge(selectedDecision.status)}
                <span className="text-xs font-mono text-slate-500">
                  Decision #{selectedDecision.id}
                </span>
              </div>

              <h2 className="text-xl font-bold text-slate-100">{selectedDecision.title}</h2>

              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400 pb-4 border-b border-slate-800/80">
                <div>
                  Source:{' '}
                  <a
                    href={selectedDecision.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 hover:underline"
                  >
                    {selectedDecision.sourceTitle} ↗
                  </a>
                </div>
                <span className="text-slate-700">•</span>
                <div>
                  Confidence:{' '}
                  <span className="text-slate-200 font-semibold">
                    {Math.round(selectedDecision.confidence * 100)}%
                  </span>
                </div>
                <span className="text-slate-700">•</span>
                <div>
                  Evidence Lock Verified:{' '}
                  <span className="text-emerald-400 font-semibold">
                    {Math.round(selectedDecision.verifiedRatio * 100)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 font-mono">
                Decision Summary
              </h3>
              <p className="text-xs text-slate-200 leading-relaxed bg-[#080c14]/80 rounded-md p-3.5 border border-slate-800">
                {selectedDecision.summary}
              </p>
            </div>

            {/* Decision Evidence Quotes */}
            {selectedDecision.decisionEvidence.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 font-mono">
                  Decision Evidence (Exact Quotes)
                </h3>
                <div className="space-y-2">
                  {selectedDecision.decisionEvidence.map((ev) => (
                    <div
                      key={ev.id}
                      className="rounded-md border border-slate-800 bg-[#080c14]/80 p-3 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          {getEvidenceChip(ev.verified, ev.method, ev.score)}
                          <span className="font-mono text-slate-400 text-[11px]">
                            by @{ev.author} ({ev.role})
                          </span>
                        </div>
                        <a
                          href={ev.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-slate-400 hover:text-emerald-400 transition-colors"
                        >
                          View on GitHub ↗
                        </a>
                      </div>
                      <blockquote className="italic text-slate-300 border-l-2 border-emerald-500/50 pl-3 py-0.5 my-1 leading-relaxed">
                        &ldquo;{ev.quote}&rdquo;
                      </blockquote>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alternatives */}
            {selectedDecision.alternatives.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 font-mono">
                  Considered &amp; Rejected Alternatives
                </h3>
                <div className="space-y-3">
                  {selectedDecision.alternatives.map((alt) => (
                    <div
                      key={alt.id}
                      className="rounded-md border border-slate-800 bg-[#080c14]/80 p-4 text-xs space-y-2"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            alt.outcome === 'chosen'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : alt.outcome === 'rejected'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {alt.outcome}
                        </span>
                        <h4 className="font-semibold text-slate-100">{alt.name}</h4>
                        {alt.reasonCategory && (
                          <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-slate-400 font-mono">
                            {alt.reasonCategory}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 leading-relaxed">{alt.description}</p>
                      {alt.reason && (
                        <p className="text-slate-300">
                          <span className="font-semibold text-slate-400">Reason:</span> {alt.reason}
                        </p>
                      )}

                      {/* Evidence for this alternative */}
                      {alt.evidence.length > 0 && (
                        <div className="mt-2 space-y-1.5 pl-2.5 border-l border-slate-800">
                          {alt.evidence.map((aev) => (
                            <div key={aev.id} className="text-[11px]">
                              <div className="flex items-center gap-2 mb-0.5">
                                {getEvidenceChip(aev.verified, aev.method, aev.score)}
                                <span className="font-mono text-slate-400">
                                  {aev.claimType} by @{aev.author}
                                </span>
                              </div>
                              <blockquote className="italic text-slate-300 pl-2">
                                &ldquo;{aev.quote}&rdquo;
                              </blockquote>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Conditions */}
                      {alt.conditions.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                          <span className="font-semibold text-slate-400">Conditions:</span>
                          <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                            {alt.conditions.map((c) => (
                              <li key={c.id}>
                                {c.text} (probe: {c.probe}
                                {c.probeValue ? ` = ${c.probeValue}` : ''})
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Associated Repository Files */}
            {selectedDecision.files && selectedDecision.files.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 font-mono">
                  Associated Repository Files ({selectedDecision.files.length})
                </h3>
                <div className="space-y-2">
                  {selectedDecision.files.map((file, idx) => (
                    <div
                      key={idx}
                      className="rounded-md border border-slate-800 bg-[#080c14]/80 p-3 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-slate-200">
                            {file.path}
                          </span>
                          {file.currentPath && file.currentPath !== file.path && (
                            <span className="text-slate-400 text-[11px] font-mono">
                              → current: {file.currentPath}
                            </span>
                          )}
                          {file.currentPath === null && (
                            <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-400 font-mono">
                              deleted at HEAD
                            </span>
                          )}
                        </div>
                        {file.commitSha && (
                          <span className="text-slate-500 text-[11px] font-mono">
                            commit: {file.commitSha.slice(0, 7)}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-xs leading-relaxed">{file.basis}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Events Timeline */}
            {selectedDecision.events.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 font-mono">
                  Discussion Timeline Events
                </h3>
                <div className="space-y-1.5 text-xs text-slate-400">
                  {selectedDecision.events.map((ev, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] uppercase text-emerald-400 font-medium">
                        {ev.type}
                      </span>
                      <span className="font-mono text-[11px]">
                        {new Date(ev.at).toLocaleDateString()}
                      </span>
                      <a
                        href={ev.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-400 hover:text-emerald-400 transition-colors"
                      >
                        Source Link ↗
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
