'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiNotImplementedError } from '../../lib/api';
import type { OverviewResponse } from '@decisionvault/shared/api';
import { Spinner } from '../ui/Spinner';
import { ErrorAlert } from '../ui/ErrorAlert';
import { DecisionCard } from '../decisions/DecisionCard';
import Link from 'next/link';

export function OverviewClient() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isNotImplemented, setIsNotImplemented] = useState(false);
  const [isFixturePreview, setIsFixturePreview] = useState(false);

  const loadData = async (previewFixture = false) => {
    setLoading(true);
    setError(null);
    setIsNotImplemented(false);

    if (previewFixture) {
      try {
        const fixture = api.fixtures.overview();
        setData(fixture);
        setIsFixturePreview(true);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load fixture'));
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const res = await api.getOverview();
      setData(res);
      setIsFixturePreview(false);
    } catch (err) {
      if (err instanceof ApiNotImplementedError) {
        setIsNotImplemented(true);
      }
      setError(err instanceof Error ? err : new Error('Failed to load overview data'));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-8">
      {/* Prominent Fixture preview notification if active */}
      {isFixturePreview && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 font-semibold uppercase tracking-wider text-amber-300 text-[11px]">
              <span className="h-2 w-2 rounded-full bg-amber-400"></span>
              Sample Contract Fixture (Preview Mode — Not Live Metrics)
            </div>
            <button
              onClick={() => {
                setData(null);
                setIsFixturePreview(false);
                loadData(false);
              }}
              className="text-[11px] text-amber-300 hover:text-amber-100 underline transition-colors"
            >
              Exit preview &amp; check live backend
            </button>
          </div>
          <p className="text-[11px] text-amber-200/80 leading-relaxed font-sans">
            The backend endpoint <code className="text-amber-300 font-mono">GET /api/overview</code>{' '}
            returned <strong>HTTP 501 (Not Implemented)</strong>. The counts and lists displayed
            below are static sample data from{' '}
            <code className="text-amber-300 font-mono">shared/fixtures/api/overview.json</code> for
            layout preview. Zero actual decisions have been extracted from live repositories yet.
          </p>
        </div>
      )}

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}

      {error && !isFixturePreview && (
        <ErrorAlert
          error={error}
          isNotImplemented={isNotImplemented}
          onRetry={() => loadData(false)}
          onPreviewFixture={() => loadData(true)}
          title={
            isNotImplemented ? 'Overview API In Development (Phase 2)' : 'Failed to load Overview'
          }
        />
      )}

      {data && (
        <div className="space-y-8">
          {/* Executive Metrics Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Decisions */}
            <div className="rounded-lg border border-slate-800/80 bg-[#0e1424]/75 p-5 space-y-1">
              <div className="text-xs font-medium text-slate-400 flex items-center justify-between">
                <span>Total Decisions</span>
                {isFixturePreview && (
                  <span className="text-[10px] text-amber-400 font-mono font-medium">Sample</span>
                )}
              </div>
              <div className="text-3xl font-bold tracking-tight text-slate-100 font-mono pt-1">
                {data.counts.decisions}
              </div>
              <div className="pt-2 flex items-center gap-2 text-xs font-mono">
                <span className="text-emerald-400 font-medium">
                  {data.counts.byStatus.accepted} Acc
                </span>
                <span className="text-slate-700">•</span>
                <span className="text-rose-400 font-medium">
                  {data.counts.byStatus.rejected} Rej
                </span>
                <span className="text-slate-700">•</span>
                <span className="text-amber-400 font-medium">
                  {data.counts.byStatus.unresolved} Unres
                </span>
              </div>
            </div>

            {/* Sources Processed */}
            <div className="rounded-lg border border-slate-800/80 bg-[#0e1424]/75 p-5 space-y-1">
              <div className="text-xs font-medium text-slate-400 flex items-center justify-between">
                <span>Sources Processed</span>
                {isFixturePreview && (
                  <span className="text-[10px] text-amber-400 font-mono font-medium">Sample</span>
                )}
              </div>
              <div className="text-3xl font-bold tracking-tight text-slate-100 font-mono pt-1">
                {data.counts.sources}
              </div>
              <p className="pt-2 text-xs text-slate-400">Issues, PRs &amp; discussions ingested</p>
            </div>

            {/* Decisions for Review */}
            <div className="rounded-lg border border-slate-800/80 bg-[#0e1424]/75 p-5 space-y-1">
              <div className="text-xs font-medium text-slate-400 flex items-center justify-between">
                <span>Decisions for Review</span>
                {isFixturePreview && (
                  <span className="text-[10px] text-amber-400 font-mono font-medium">Sample</span>
                )}
              </div>
              <div className="text-3xl font-bold tracking-tight text-amber-300 font-mono pt-1">
                {data.attention.length}
              </div>
              <p className="pt-2 text-xs text-slate-400">Low confidence or contested evidence</p>
            </div>

            {/* Unverified Claims */}
            <div className="rounded-lg border border-slate-800/80 bg-[#0e1424]/75 p-5 space-y-1">
              <div className="text-xs font-medium text-slate-400 flex items-center justify-between">
                <span>Unverified Claims</span>
                {isFixturePreview && (
                  <span className="text-[10px] text-amber-400 font-mono font-medium">Sample</span>
                )}
              </div>
              <div className="text-3xl font-bold tracking-tight text-slate-300 font-mono pt-1">
                {data.counts.unverifiedClaims}
              </div>
              <p className="pt-2 text-xs text-slate-400">Claims failing quote verification</p>
            </div>
          </div>

          {/* Attention Queue */}
          {data.attention.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                    <span>Decisions Requiring Review</span>
                    {isFixturePreview && (
                      <span className="rounded bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-mono text-amber-300">
                        Sample Preview
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Decisions surfaced for review due to contested evidence claims or active
                    constraint health signals.
                  </p>
                </div>
                <Link
                  href="/decisions"
                  className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  View All Decisions →
                </Link>
              </div>

              <div className="grid grid-cols-1 gap-3.5">
                {data.attention.map((decision) => (
                  <DecisionCard
                    key={decision.id}
                    decision={decision}
                    isSampleData={isFixturePreview}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Most Discussed Code Files */}
          {data.topFiles.length > 0 && (
            <div className="rounded-lg border border-slate-800/80 bg-[#0e1424]/75 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">
                    Most Discussed Code Files
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Repository source files linked to the highest number of architectural decisions.
                  </p>
                </div>
                {isFixturePreview && (
                  <span className="text-[10px] font-mono text-amber-400/80">
                    (Sample Path Counts)
                  </span>
                )}
              </div>
              <div className="divide-y divide-slate-800/60">
                {data.topFiles.map((item, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-200 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {item.path}
                    </span>
                    <span className="text-slate-400 font-mono text-xs">
                      <span className="text-slate-200 font-semibold">{item.decisionCount}</span>{' '}
                      decisions linked
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pipeline Guidance when Attention Queue is clear or 0 decisions */}
          {data.counts.decisions === 0 && data.attention.length === 0 && (
            <div className="rounded-lg border border-slate-800/80 bg-[#0e1424]/75 p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                    Decision Recovery Engine Ready
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    No engineering discussions have been ingested yet. Ingest a GitHub repository or
                    preview frozen contract sample data.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => loadData(true)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20 transition-colors"
                  >
                    <span>Preview Contract Fixtures</span>
                    <span className="text-amber-400">↗</span>
                  </button>
                  <Link
                    href="/import"
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition-colors shadow-sm"
                  >
                    <span>Import Repository</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>

              {/* 3-Step Pipeline Flow */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-lg border border-slate-800/70 bg-[#080c14]/80 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 font-mono font-bold text-[10px]">
                      1
                    </span>
                    <span className="font-semibold uppercase tracking-wider text-[11px]">
                      GitHub Ingestion
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Ingest issue threads, PRs, and review comments from public repositories into
                    SQLite with FTS5 search.
                  </p>
                  <Link
                    href="/import"
                    className="inline-block text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors pt-1"
                  >
                    Open Ingestion Pipeline →
                  </Link>
                </div>

                <div className="rounded-lg border border-slate-800/70 bg-[#080c14]/80 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-slate-300 font-mono font-bold text-[10px]">
                      2
                    </span>
                    <span className="font-semibold uppercase tracking-wider text-[11px]">
                      Local AI Extraction
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Local Gemma 4 E4B reconstructs undocumented decisions, extracts accepted vs.
                    rejected alternatives, and locks verbatim evidence.
                  </p>
                  <Link
                    href="/decisions"
                    className="inline-block text-xs font-medium text-slate-300 hover:text-white transition-colors pt-1"
                  >
                    Explore Recovered Decisions →
                  </Link>
                </div>

                <div className="rounded-lg border border-slate-800/70 bg-[#080c14]/80 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-amber-400 font-medium">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/15 text-amber-300 font-mono font-bold text-[10px]">
                      3
                    </span>
                    <span className="font-semibold uppercase tracking-wider text-[11px]">
                      Prior-Decision Warning
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Run the warning sandbox to test proposed changes against historical decisions
                    before relitigating settled debates.
                  </p>
                  <Link
                    href="/sandbox"
                    className="inline-block text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors pt-1"
                  >
                    Launch Warning Sandbox →
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Attention Queue Clear card */}
          {data.counts.decisions > 0 && data.attention.length === 0 && (
            <div className="rounded-lg border border-slate-800/80 bg-[#0e1424]/75 p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs">
                  ✓
                </span>
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">Attention Queue Clear</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    All recovered decisions have verified evidence locks. Zero contested claims.
                  </p>
                </div>
              </div>
              <Link
                href="/decisions"
                className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                View All Decisions →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
