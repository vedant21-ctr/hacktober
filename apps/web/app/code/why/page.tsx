'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type {
  Repository,
  DecisionCard,
  DecisionFile,
  CodeWhyResponse,
} from '@decisionvault/shared/api';
import { api, ApiClientError } from '../../lib/api';
import {
  PageTitle,
  StatusBadge,
  EmptyState,
  ErrorDisplay,
  FeatureNotice,
} from '../../components/ui';

function CodeWhyContent() {
  const searchParams = useSearchParams();
  const initialPath = searchParams.get('path') || '';
  const initialRepoId = searchParams.get('repoId') || '';

  const [repos, setRepos] = useState<Repository[]>([]);
  const [repoId, setRepoId] = useState<string>(initialRepoId);
  const [filePath, setFilePath] = useState<string>(initialPath);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiNotice, setApiNotice] = useState(false);

  const [result, setResult] = useState<{
    path: string;
    decisions: DecisionCard[];
    links: DecisionFile[];
  } | null>(null);

  useEffect(() => {
    api
      .getRepositories()
      .then((d) => {
        setRepos(d.items);
        if (!repoId && d.items.length > 0) {
          setRepoId(String(d.items[0].id));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (initialPath && repoId) {
      handleLookup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoId]);

  async function handleLookup(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!repoId || !filePath.trim()) return;

    setLoading(true);
    setError(null);
    setApiNotice(false);
    setResult(null);

    try {
      try {
        const data: CodeWhyResponse = await api.getCodeWhy(Number(repoId), filePath.trim());
        setResult(data);
      } catch (whyErr) {
        if (whyErr instanceof ApiClientError && whyErr.status === 501) {
          setApiNotice(true);
        }
        await runClientLookup(Number(repoId), filePath.trim());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed');
    } finally {
      setLoading(false);
    }
  }

  async function runClientLookup(rId: number, path: string) {
    const decisionsData = await api.getDecisions({ repoId: rId, pageSize: 50 });
    const matchedDecisions: DecisionCard[] = [];
    const matchedLinks: DecisionFile[] = [];

    const normPath = path.toLowerCase();

    for (const dec of decisionsData.items) {
      try {
        const detail = await api.getDecisionDetail(dec.id);
        const match = detail.files.find(
          (f) => f.path.toLowerCase().includes(normPath) || normPath.includes(f.path.toLowerCase()),
        );
        if (match) {
          matchedDecisions.push(dec);
          matchedLinks.push(match);
        }
      } catch {
        // continue
      }
    }

    setResult({
      path,
      decisions: matchedDecisions,
      links: matchedLinks,
    });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageTitle
        title="File-to-Decision Lookup"
        subtitle="Recover the engineering reasoning behind any specific file or directory in the repository."
        actions={
          <a
            href="/code"
            className="rounded-md bg-slate-900 border border-slate-800 hover:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors"
          >
            ← Back to Code Explorer
          </a>
        }
      />

      {/* Lookup Form */}
      <div className="rounded-lg border border-slate-800/80 bg-[#0e1424]/75 p-5">
        <form onSubmit={handleLookup} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Repository</label>
              <select
                value={repoId}
                onChange={(e) => setRepoId(e.target.value)}
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/80"
              >
                {repos.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Target File Path
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  placeholder="e.g. server/db/schema.sql"
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500/80 placeholder:text-slate-600"
                />
                <button
                  type="submit"
                  disabled={loading || !filePath.trim()}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-30 whitespace-nowrap shadow-sm"
                >
                  {loading ? 'Searching...' : 'Lookup Why →'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {apiNotice && (
        <FeatureNotice
          feature="File-to-Decision Lookup API (GET /api/code/why)"
          description="The dedicated file lookup query endpoint is in development. DecisionVault is performing deterministic matching across extracted decision file mappings."
        />
      )}

      {error && (
        <ErrorDisplay title="Lookup Failed" message={error} onRetry={() => handleLookup()} />
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="text-xs text-slate-400">
              Governing Decisions for:{' '}
              <code className="text-emerald-400 font-mono text-xs">{result.path}</code>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {result.decisions.length} Matches
            </span>
          </div>

          {result.decisions.length > 0 ? (
            <div className="space-y-3">
              {result.decisions.map((dec, idx) => {
                const link = result.links[idx];
                return (
                  <div
                    key={dec.id}
                    className="rounded-lg border border-slate-800/80 bg-[#0e1424]/75 p-5 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="rounded bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 text-[10px] font-mono text-emerald-400">
                            {link ? link.linkKind : 'mapped'}
                          </span>
                          {link?.commitSha && (
                            <span className="text-[11px] font-mono text-slate-500">
                              Commit: {link.commitSha.slice(0, 7)}
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-semibold text-slate-100">
                          <a
                            href={`/decisions/${dec.id}`}
                            className="hover:text-emerald-300 transition-colors"
                          >
                            {dec.title}
                          </a>
                        </h3>
                      </div>
                      <StatusBadge status={dec.status} />
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">{dec.summary}</p>

                    {link && (
                      <div className="text-xs text-slate-300 bg-slate-950/70 rounded p-2.5 border border-slate-800/70 leading-relaxed">
                        <span className="text-slate-500 font-mono text-[11px]">
                          Association Basis:
                        </span>{' '}
                        &ldquo;
                        {link.basis}&rdquo;
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                      <a
                        href={dec.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-400 hover:text-emerald-400 transition-colors"
                      >
                        Source Discussion ↗
                      </a>
                      <a
                        href={`/decisions/${dec.id}`}
                        className="text-emerald-400 hover:text-emerald-300 font-medium"
                      >
                        Inspect Decision Details →
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon="?"
              title="No Historical Decisions Found for This File"
              description={`The file "${result.path}" is not currently governed by any recovered architectural decisions.`}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default function CodeWhyPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-lg border border-slate-800 bg-[#0e1424]/40 p-12 text-center text-slate-500 text-xs">
          Loading file-to-decision lookup...
        </div>
      }
    >
      <CodeWhyContent />
    </Suspense>
  );
}
