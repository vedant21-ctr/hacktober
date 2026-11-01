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
    <div className="space-y-6 animate-fade-in">
      <PageTitle
        title="Repositories"
        subtitle="GitHub repositories imported for decision recovery analysis."
        actions={
          <a
            href="/import"
            className="rounded-md bg-vault-accent/10 border border-vault-accent/30 px-4 py-2 text-xs font-semibold text-vault-accent hover:bg-vault-accent/20 transition-colors font-mono"
          >
            ↓ Import New
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
        <div className="space-y-3">
          {repos.map((repo) => (
            <div
              key={repo.id}
              className="rounded-lg border border-vault-border bg-vault-surface/30 p-5 hover:border-vault-border-bright transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="font-mono text-base font-semibold text-vault-text">
                      {repo.fullName}
                    </h2>
                    <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[8px] font-mono font-bold text-emerald-400 uppercase">
                      Imported
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-vault-text-dim">
                    <span>Branch: {repo.defaultBranch || 'main'}</span>
                    {repo.headCommitSha && <span>HEAD: {repo.headCommitSha.substring(0, 8)}</span>}
                    <span>Imported: {new Date(repo.importedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a
                    href={`/decisions?repoId=${repo.id}`}
                    className="rounded bg-vault-surface border border-vault-border px-3 py-1.5 text-[10px] font-mono text-vault-text-muted hover:text-vault-text hover:border-vault-border-bright transition-colors"
                  >
                    Decisions →
                  </a>
                  <a
                    href={`/code?repoId=${repo.id}`}
                    className="rounded bg-vault-surface border border-vault-border px-3 py-1.5 text-[10px] font-mono text-vault-text-muted hover:text-vault-text hover:border-vault-border-bright transition-colors"
                  >
                    Code →
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
