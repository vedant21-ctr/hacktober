'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Repository, DecisionCard, DecisionFile, CodeWhyResponse } from '@decisionvault/shared/api';
import { api, ApiClientError } from '../../lib/api';
import {
  PageTitle,
  StatusBadge,
  ConfidenceMeter,
  EmptyState,
  ErrorDisplay,
  FeatureNotice,
  SkeletonCard,
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
    api.getRepositories().then((d) => {
      setRepos(d.items);
      if (!repoId && d.items.length > 0) {
        setRepoId(String(d.items[0].id));
      }
    }).catch(() => {});
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
      // Attempt official GET /api/code/why?repoId=&path=
      try {
        const data: CodeWhyResponse = await api.getCodeWhy(Number(repoId), filePath.trim());
        setResult(data);
      } catch (whyErr) {
        if (whyErr instanceof ApiClientError && whyErr.status === 501) {
          setApiNotice(true);
        }
        // Fallback: Client lookup using active decisions & files
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
          (f) =>
            f.path.toLowerCase().includes(normPath) ||
            normPath.includes(f.path.toLowerCase()),
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
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <PageTitle
        title="File-to-Decision Lookup"
        subtitle="Recover the engineering reasoning behind any specific file or directory in the repository."
        actions={
          <a
            href="/code"
            className="rounded-md bg-vault-surface border border-vault-border px-3 py-1.5 text-xs font-mono text-vault-text hover:bg-vault-border transition-colors"
          >
            ← Back to Code Explorer
          </a>
        }
      />

      {/* Lookup Form */}
      <div className="rounded-lg border border-vault-border bg-vault-surface/30 p-5">
        <form onSubmit={handleLookup} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[9px] font-mono uppercase tracking-wider text-vault-text-dim mb-1">
                Repository
              </label>
              <select
                value={repoId}
                onChange={(e) => setRepoId(e.target.value)}
                className="w-full rounded-md border border-vault-border bg-vault-bg px-3 py-2 text-xs text-vault-text font-mono focus-vault"
              >
                {repos.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[9px] font-mono uppercase tracking-wider text-vault-text-dim mb-1">
                Target File Path
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  placeholder="e.g. server/db/schema.sql"
                  className="w-full rounded-md border border-vault-border bg-vault-bg px-3 py-2 text-xs text-vault-text font-mono focus-vault placeholder-vault-text-dim"
                />
                <button
                  type="submit"
                  disabled={loading || !filePath.trim()}
                  className="rounded-md bg-vault-accent/10 border border-vault-accent/30 px-4 py-2 text-xs font-semibold text-vault-accent hover:bg-vault-accent/20 transition-colors font-mono disabled:opacity-30 whitespace-nowrap"
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

      {error && <ErrorDisplay title="Lookup Failed" message={error} onRetry={() => handleLookup()} />}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-vault-border pb-2">
            <div className="text-xs font-mono text-vault-text-dim">
              Governing Decisions for: <code className="text-vault-accent">{result.path}</code>
            </div>
            <span className="text-[10px] font-mono text-vault-text-muted">
              {result.decisions.length} Matches
            </span>
          </div>

          {result.decisions.length > 0 ? (
            <div className="space-y-4">
              {result.decisions.map((dec, idx) => {
                const link = result.links[idx];
                return (
                  <div
                    key={dec.id}
                    className="rounded-lg border border-vault-border bg-vault-surface/30 p-5 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-mono font-bold text-emerald-400 uppercase">
                            {link ? link.linkKind : 'mapped'}
                          </span>
                          {link?.commitSha && (
                            <span className="text-[10px] font-mono text-vault-text-dim">
                              Commit: {link.commitSha.slice(0, 7)}
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-bold font-mono text-vault-text">
                          <a
                            href={`/decisions/${dec.id}`}
                            className="hover:text-vault-accent underline decoration-vault-border"
                          >
                            {dec.title}
                          </a>
                        </h3>
                      </div>
                      <StatusBadge status={dec.status} />
                    </div>

                    <p className="text-xs text-vault-text-dim leading-relaxed">
                      {dec.summary}
                    </p>

                    {link && (
                      <div className="text-[11px] font-mono text-vault-text-muted bg-vault-bg/60 rounded p-2.5 border border-vault-border/50">
                        <span className="text-vault-text-dim">Association Basis:</span> &ldquo;
                        {link.basis}&rdquo;
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] font-mono text-vault-text-dim pt-1">
                      <a
                        href={dec.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-vault-accent hover:underline"
                      >
                        Source Discussion ↗
                      </a>
                      <a
                        href={`/decisions/${dec.id}`}
                        className="text-vault-text hover:text-vault-accent"
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
        <div className="rounded-lg border border-vault-border bg-vault-surface/20 p-12 text-center text-vault-text-dim font-mono text-xs">
          Loading file-to-decision lookup...
        </div>
      }
    >
      <CodeWhyContent />
    </Suspense>
  );
}
