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
          <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-xs font-medium text-emerald-400">
            ACCEPTED
          </span>
        );
      case 'rejected':
        return (
          <span className="rounded bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 text-xs font-medium text-rose-400">
            REJECTED
          </span>
        );
      default:
        return (
          <span className="rounded bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-xs font-medium text-amber-400">
            UNRESOLVED
          </span>
        );
    }
  }

  function getEvidenceChip(verified: boolean, method: string, score: number) {
    if (verified && method === 'normalized_exact') {
      return (
        <span className="rounded bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-xs font-semibold text-emerald-300">
          ✓ VERIFIED EXACT (1.0)
        </span>
      );
    }
    if (verified && method === 'fuzzy') {
      return (
        <span className="rounded bg-sky-500/20 border border-sky-500/40 px-2 py-0.5 text-xs font-semibold text-sky-300">
          ≈ APPROXIMATE ({score})
        </span>
      );
    }
    return (
      <span className="rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-xs font-medium text-slate-400">
        ○ UNVERIFIED CLAIM
      </span>
    );
  }

  return (
    <div className="py-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 font-mono">
            Recovered Decisions
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Engineering decisions extracted by local Gemma 4 E4B with deterministic Evidence Lock.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/import"
            className="rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
          >
            Manage Extractions
          </a>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 mb-6">
        <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Repository</label>
            <select
              value={selectedRepoId}
              onChange={(e) => setSelectedRepoId(e.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
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
            <label className="block text-xs font-mono text-slate-400 mb-1">Decision Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Statuses</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="unresolved">Unresolved</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">File Path</label>
            <input
              type="text"
              placeholder="e.g. src/auth.ts..."
              value={filePathFilter}
              onChange={(e) => setFilePathFilter(e.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-mono text-slate-400 mb-1">Search FTS5 Index</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search title, summary, or alternatives..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
              />
              <button
                type="submit"
                className="rounded bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition"
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
        <div className="rounded-lg border border-slate-800 bg-slate-900/20 p-8 text-center">
          <p className="text-sm font-medium text-slate-300">No decisions found.</p>
          <p className="mt-1 text-xs text-slate-500">
            Run Gemma decision extraction on an imported repository to recover engineering
            decisions.
          </p>
          <a
            href="/import"
            className="mt-4 inline-block rounded bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition"
          >
            Go to Import &amp; Extraction
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-slate-400 font-mono mb-2">
            Showing {decisions.length} of {total} recovered decisions
          </div>
          {decisions.map((dec) => (
            <div
              key={dec.id}
              onClick={() => openDecisionDetail(dec.id)}
              className="cursor-pointer rounded-lg border border-slate-800 bg-slate-900/40 p-4 hover:border-slate-700 hover:bg-slate-900/70 transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    {getStatusBadge(dec.status)}
                    <h2 className="text-sm font-semibold text-slate-100 hover:text-emerald-400 transition">
                      {dec.title}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {dec.summary}
                  </p>
                  <div className="mt-3 flex items-center gap-4 text-xs font-mono text-slate-500">
                    <span>
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
                    <span>
                      Confidence:{' '}
                      <span className="text-slate-300 font-semibold">
                        {Math.round(dec.confidence * 100)}%
                      </span>
                    </span>
                    <span>
                      Evidence Verified:{' '}
                      <span className="text-emerald-400 font-semibold">
                        {Math.round(dec.verifiedRatio * 100)}%
                      </span>
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono text-slate-500 hover:text-slate-300">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="rounded-lg border border-slate-700 bg-slate-900 px-6 py-4 shadow-2xl flex items-center gap-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
            <span className="text-sm font-mono text-slate-300">Loading decision detail...</span>
          </div>
        </div>
      )}

      {/* Detail Error Toast */}
      {detailError && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md rounded-lg border border-rose-500/30 bg-rose-950/90 p-4 text-xs font-mono text-rose-200 shadow-xl backdrop-blur-sm flex items-start justify-between gap-3">
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
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <button
              onClick={() => setSelectedDecision(null)}
              className="absolute top-4 right-4 rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            >
              ✕
            </button>

            <div className="flex items-center gap-2 mb-2">
              {getStatusBadge(selectedDecision.status)}
              <span className="text-xs font-mono text-slate-500">
                Decision #{selectedDecision.id}
              </span>
            </div>

            <h2 className="text-xl font-bold text-slate-100 font-mono mb-2">
              {selectedDecision.title}
            </h2>

            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400 mb-6 pb-4 border-b border-slate-800">
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
              <div>
                Confidence:{' '}
                <span className="text-slate-200 font-semibold">
                  {Math.round(selectedDecision.confidence * 100)}%
                </span>{' '}
                <span className="text-slate-500 text-[10px]">
                  (cov: {selectedDecision.confidenceParts.coverage}, stmt:{' '}
                  {selectedDecision.confidenceParts.statement}, reason:{' '}
                  {selectedDecision.confidenceParts.reasonCoverage})
                </span>
              </div>
              <div>
                Evidence Lock Verified:{' '}
                <span className="text-emerald-400 font-semibold">
                  {Math.round(selectedDecision.verifiedRatio * 100)}%
                </span>
              </div>
            </div>

            {/* Summary */}
            <div className="mb-6">
              <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                Decision Summary
              </h3>
              <p className="text-xs text-slate-200 leading-relaxed bg-slate-950/60 rounded p-3 border border-slate-800">
                {selectedDecision.summary}
              </p>
            </div>

            {/* Decision Evidence Quotes */}
            {selectedDecision.decisionEvidence.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
                  Decision Evidence (Exact Quotes)
                </h3>
                <div className="space-y-2">
                  {selectedDecision.decisionEvidence.map((ev) => (
                    <div
                      key={ev.id}
                      className="rounded border border-slate-800 bg-slate-950 p-3 text-xs"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          {getEvidenceChip(ev.verified, ev.method, ev.score)}
                          <span className="font-mono text-slate-400">
                            by {ev.author} ({ev.role})
                          </span>
                        </div>
                        <a
                          href={ev.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-mono text-slate-500 hover:text-emerald-400"
                        >
                          View on GitHub ↗
                        </a>
                      </div>
                      <blockquote className="italic text-slate-300 border-l-2 border-slate-700 pl-2 my-1">
                        &ldquo;{ev.quote}&rdquo;
                      </blockquote>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alternatives */}
            {selectedDecision.alternatives.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
                  Considered &amp; Rejected Alternatives
                </h3>
                <div className="space-y-3">
                  {selectedDecision.alternatives.map((alt) => (
                    <div
                      key={alt.id}
                      className="rounded border border-slate-800 bg-slate-950 p-3.5 text-xs"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            alt.outcome === 'chosen'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : alt.outcome === 'rejected'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {alt.outcome}
                        </span>
                        <h4 className="font-semibold text-slate-100 font-mono">{alt.name}</h4>
                        {alt.reasonCategory && (
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400 font-mono">
                            {alt.reasonCategory}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 mb-2">{alt.description}</p>
                      {alt.reason && (
                        <p className="text-slate-300 mb-2">
                          <span className="font-semibold text-slate-400">Reason:</span> {alt.reason}
                        </p>
                      )}

                      {/* Evidence for this alternative */}
                      {alt.evidence.length > 0 && (
                        <div className="mt-2 space-y-1.5 pl-2 border-l border-slate-800">
                          {alt.evidence.map((aev) => (
                            <div key={aev.id} className="text-[11px]">
                              <div className="flex items-center gap-2 mb-0.5">
                                {getEvidenceChip(aev.verified, aev.method, aev.score)}
                                <span className="font-mono text-slate-500">
                                  {aev.claimType} by {aev.author}
                                </span>
                              </div>
                              <blockquote className="italic text-slate-400">
                                &ldquo;{aev.quote}&rdquo;
                              </blockquote>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Conditions */}
                      {alt.conditions.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                          <span className="font-mono font-semibold text-slate-500">
                            Conditions:
                          </span>
                          <ul className="list-disc list-inside mt-0.5">
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
              <div className="mb-6">
                <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
                  Associated Repository Files ({selectedDecision.files.length})
                </h3>
                <div className="space-y-2">
                  {selectedDecision.files.map((file, idx) => (
                    <div
                      key={idx}
                      className="rounded border border-slate-800 bg-slate-950 p-3 text-xs font-mono"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                              file.evidenceId !== null
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : file.linkKind === 'pr_diff'
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                  : file.linkKind === 'rename_tracked'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-slate-700/50 text-slate-300 border border-slate-600/50'
                            }`}
                          >
                            {file.evidenceId !== null
                              ? 'verified evidence'
                              : file.linkKind === 'mentioned'
                                ? 'mentioned (inferred)'
                                : file.linkKind}
                          </span>
                          <span className="font-semibold text-slate-100">{file.path}</span>
                          {file.currentPath && file.currentPath !== file.path && (
                            <span className="text-slate-500 text-[11px]">
                              → current: <span className="text-slate-300">{file.currentPath}</span>
                            </span>
                          )}
                          {file.currentPath === null && (
                            <span className="rounded bg-rose-500/10 px-1 py-0.5 text-[10px] text-rose-400">
                              deleted / obsolete
                            </span>
                          )}
                        </div>
                        {file.commitSha && (
                          <span className="text-slate-500 text-[10px]">
                            commit:{' '}
                            <span className="text-slate-300 font-mono">
                              {file.commitSha.slice(0, 7)}
                            </span>
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-[11px] leading-relaxed">{file.basis}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Events Timeline */}
            {selectedDecision.events.length > 0 && (
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
                  Discussion Timeline Events
                </h3>
                <div className="space-y-1 text-xs font-mono text-slate-400">
                  {selectedDecision.events.map((ev, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase text-emerald-400">
                        {ev.type}
                      </span>
                      <span>{new Date(ev.at).toLocaleDateString()}</span>
                      <a
                        href={ev.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-500 hover:text-slate-300"
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
