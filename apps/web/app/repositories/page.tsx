'use client';

import React, { useEffect, useState } from 'react';
import type { Repository } from '@decisionvault/shared/api';
import { api } from '../lib/api';
import { PageTitle, EmptyState, PageLoading, ErrorDisplay } from '../components/ui';

export default function RepositoriesPage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getRepositories()
      .then((d) => setRepos(d.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoading message="Loading repositories..." />;
  if (error) return <ErrorDisplay message={error} />;

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <PageTitle
        title="Repositories"
        subtitle="Connected GitHub repositories indexed for architectural decisions, evidence quotes, and code connections."
        actions={
          <a
            href="/import"
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 text-slate-950 px-3.5 py-1.5 text-xs font-semibold hover:bg-emerald-400 transition-colors shadow-sm"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z" />
            </svg>
            Import Repository
          </a>
        }
      />

      {repos.length === 0 ? (
        <EmptyState
          icon="⊞"
          title="No Repositories"
          description="Import a public GitHub repository to start analyzing engineering decisions."
          action={{ label: 'Import Repository', href: '/import' }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {repos.map((repo) => (
            <div
              key={repo.id}
              className="group relative rounded-xl border border-vault-border bg-vault-surface/40 p-5 transition-all duration-200 hover:border-vault-border-bright hover:bg-vault-surface/70"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="mt-0.5 w-9 h-9 rounded-lg border border-vault-border bg-vault-bg/80 flex items-center justify-center text-vault-text-dim group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-colors flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                      />
                    </svg>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <h2 className="text-sm font-semibold tracking-tight text-vault-text group-hover:text-emerald-300 transition-colors">
                        {repo.fullName}
                      </h2>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        Indexed
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-vault-text-dim">
                      <span className="inline-flex items-center gap-1">
                        <svg
                          className="w-3 h-3 text-slate-500"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1 1 0 00-1 1v1.128a2.251 2.251 0 11-1.5 0V5.372a2.25 2.25 0 111.5 0v1.836A2.492 2.492 0 016 7h4a1 1 0 001-1v-.628A2.25 2.25 0 019.5 3.25zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zM3.5 3.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0z"
                          />
                        </svg>
                        <code className="font-mono text-vault-text-muted">
                          {repo.defaultBranch || 'main'}
                        </code>
                      </span>

                      {repo.headCommitSha && (
                        <span className="inline-flex items-center gap-1">
                          <span className="text-slate-600">•</span>
                          <span>HEAD:</span>
                          <code className="font-mono text-vault-text-muted text-[11px]">
                            {repo.headCommitSha.substring(0, 8)}
                          </code>
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1">
                        <span className="text-slate-600">•</span>
                        <span>Imported {new Date(repo.importedAt).toLocaleDateString()}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                  <a
                    href={`/decisions?repoId=${repo.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-vault-border bg-vault-surface px-3 py-1.5 text-xs font-medium text-vault-text-muted hover:text-vault-text hover:border-vault-border-bright transition-colors"
                  >
                    Decisions
                    <svg className="w-3 h-3 text-slate-500" viewBox="0 0 16 16" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z"
                      />
                    </svg>
                  </a>
                  <a
                    href={`/code?repoId=${repo.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-vault-border bg-vault-surface px-3 py-1.5 text-xs font-medium text-vault-text-muted hover:text-vault-text hover:border-vault-border-bright transition-colors"
                  >
                    Code Map
                    <svg className="w-3 h-3 text-slate-500" viewBox="0 0 16 16" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z"
                      />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
