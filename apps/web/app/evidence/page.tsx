'use client';

import React, { useState, useEffect } from 'react';
import type { Repository, Evidence } from '@decisionvault/shared/api';
import { api } from '../lib/api';
import { PageTitle, EvidenceChip, EmptyState, ErrorDisplay, SkeletonCard } from '../components/ui';

interface EvidenceWithContext extends Evidence {
  decisionId: number;
  decisionTitle: string;
  alternativeName?: string;
}

export default function EvidenceArchivePage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [evidenceList, setEvidenceList] = useState<EvidenceWithContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'unverified'>('all');
  const [claimFilter, setClaimFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadRepositories();
  }, []);

  useEffect(() => {
    loadAllEvidence();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRepoId]);

  async function loadRepositories() {
    try {
      const data = await api.getRepositories();
      setRepos(data.items);
    } catch {
      // Repositories will load on retry
    }
  }

  async function loadAllEvidence() {
    setLoading(true);
    setError(null);
    try {
      const decisionsData = await api.getDecisions({
        repoId: selectedRepoId ? Number(selectedRepoId) : undefined,
        pageSize: 50,
      });

      const accumulated: EvidenceWithContext[] = [];

      const detailPromises = decisionsData.items.map((dec) =>
        api
          .getDecisionDetail(dec.id)
          .then((detail) => {
            detail.decisionEvidence.forEach((ev) => {
              accumulated.push({
                ...ev,
                decisionId: dec.id,
                decisionTitle: dec.title,
              });
            });

            detail.alternatives.forEach((alt) => {
              alt.evidence.forEach((ev) => {
                accumulated.push({
                  ...ev,
                  decisionId: dec.id,
                  decisionTitle: dec.title,
                  alternativeName: alt.name,
                });
              });
            });
          })
          .catch(() => {}),
      );

      await Promise.all(detailPromises);
      setEvidenceList(accumulated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load evidence archive');
    } finally {
      setLoading(false);
    }
  }

  const filteredEvidence = evidenceList.filter((ev) => {
    if (statusFilter === 'verified' && !ev.verified) return false;
    if (statusFilter === 'unverified' && ev.verified) return false;
    if (claimFilter && ev.claimType !== claimFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const inQuote = ev.quote.toLowerCase().includes(q);
      const inAuthor = ev.author.toLowerCase().includes(q);
      const inDecision = ev.decisionTitle.toLowerCase().includes(q);
      if (!inQuote && !inAuthor && !inDecision) return false;
    }
    return true;
  });

  const verifiedCount = evidenceList.filter((e) => e.verified).length;
  const unverifiedCount = evidenceList.filter((e) => !e.verified).length;

  return (
    <div className="space-y-6 max-w-6xl">
      <PageTitle
        title="Evidence Archive"
        subtitle="Forensic evidence lock verification — trace every reconstructed decision claim back to verified GitHub discussion quotes."
        badge={`${evidenceList.length} EXTRACTED CITATIONS`}
        actions={
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 text-xs font-mono text-emerald-400 font-medium">
              ✓ {verifiedCount} Verified
            </span>
            <span className="rounded-md bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 text-xs font-mono text-amber-400 font-medium">
              ○ {unverifiedCount} Unverified
            </span>
          </div>
        }
      />

      {/* Filters Bar */}
      <div className="rounded-lg border border-slate-800/80 bg-[#0e1424]/75 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Repository</label>
            <select
              value={selectedRepoId}
              onChange={(e) => setSelectedRepoId(e.target.value)}
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/80"
            >
              <option value="">All Repositories</option>
              {repos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Evidence Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/80"
            >
              <option value="all">All Evidence ({evidenceList.length})</option>
              <option value="verified">Verified Exact &amp; Approx ({verifiedCount})</option>
              <option value="unverified">Unverified Claims ({unverifiedCount})</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Claim Type</label>
            <select
              value={claimFilter}
              onChange={(e) => setClaimFilter(e.target.value)}
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/80"
            >
              <option value="">All Claim Types</option>
              <option value="decision">Decision</option>
              <option value="alternative">Alternative</option>
              <option value="rejection_reason">Rejection Reason</option>
              <option value="trade_off">Trade-Off</option>
              <option value="condition">Condition</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Search Quotes / Author
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by quote keywords..."
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/80"
            />
          </div>
        </div>
      </div>

      {error && (
        <ErrorDisplay title="Evidence Loading Error" message={error} onRetry={loadAllEvidence} />
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Evidence Cards Grid */}
      {!loading && filteredEvidence.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredEvidence.map((ev) => (
            <div
              key={ev.id}
              className={`rounded-lg border p-5 transition-colors flex flex-col justify-between ${
                ev.verified
                  ? 'border-slate-800/80 bg-[#0e1424]/75 hover:border-slate-700'
                  : 'border-amber-500/20 bg-[#0e1424]/50'
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <EvidenceChip verified={ev.verified} method={ev.method} score={ev.score} />
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono uppercase text-slate-400">
                      {ev.claimType}
                    </span>
                  </div>
                  <a
                    href={ev.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1 font-medium"
                  >
                    GitHub ↗
                  </a>
                </div>

                {/* Quote */}
                <blockquote className="italic text-xs text-slate-200 leading-relaxed border-l-2 border-emerald-500/50 pl-3.5 my-2.5">
                  &ldquo;{ev.quote}&rdquo;
                </blockquote>
              </div>

              {/* Footer Meta */}
              <div className="mt-4 pt-3 border-t border-slate-800/60 text-xs text-slate-400 flex flex-col gap-1.5">
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span>
                    Author: <span className="text-slate-200 font-medium">@{ev.author}</span> (
                    {ev.role})
                  </span>
                  <span>{new Date(ev.at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="truncate max-w-[280px]">
                    Decision:{' '}
                    <a
                      href={`/decisions/${ev.decisionId}`}
                      className="text-slate-300 hover:text-emerald-300 transition-colors font-medium"
                    >
                      {ev.decisionTitle}
                    </a>
                  </span>
                  {ev.alternativeName && (
                    <span className="text-slate-400 truncate max-w-[150px] font-mono text-[11px]">
                      Alt: {ev.alternativeName}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredEvidence.length === 0 && (
        <EmptyState
          icon="✓"
          title="No Evidence Quotes Match"
          description={
            evidenceList.length === 0
              ? 'No decisions with verified evidence quotes have been extracted yet. Import a repository to start recovery.'
              : 'Try clearing your search query or adjusting the evidence status filters.'
          }
          action={
            evidenceList.length === 0 ? { label: 'Import Repository', href: '/import' } : undefined
          }
        />
      )}
    </div>
  );
}
