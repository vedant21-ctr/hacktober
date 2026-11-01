'use client';

import React, { useEffect, useState } from 'react';
import { ApiStatusBadge } from './ApiStatusBadge';
import { api } from '../../lib/api';
import type { Repository } from '@decisionvault/shared/api';

interface AppHeaderProps {
  onToggleSidebar: () => void;
  selectedRepoId?: number | null;
  onSelectRepo?: (repoId: number | null) => void;
}

export function AppHeader({ onToggleSidebar, selectedRepoId, onSelectRepo }: AppHeaderProps) {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoadingRepos(true);
    api
      .getRepositories()
      .then((res) => {
        if (mounted) setRepositories(res.items);
      })
      .catch(() => {
        // Fallback for Phase 1 / 501
        if (mounted) setRepositories([]);
      })
      .finally(() => {
        if (mounted) setLoadingRepos(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 md:px-6 backdrop-blur">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="md:hidden text-slate-400 hover:text-slate-200 p-1 rounded-md"
          aria-label="Open navigation menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        {/* Repository Selector */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="repo-select"
            className="text-xs text-slate-500 font-mono hidden sm:inline"
          >
            Repository:
          </label>
          <select
            id="repo-select"
            value={selectedRepoId === null || selectedRepoId === undefined ? '' : selectedRepoId}
            onChange={(e) => {
              const val = e.target.value;
              onSelectRepo?.(val === '' ? null : Number(val));
            }}
            className="rounded-md border border-slate-800 bg-slate-900/90 px-2.5 py-1 text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none"
          >
            <option value="">All Repositories</option>
            {repositories.map((repo) => (
              <option key={repo.id} value={repo.id}>
                {repo.fullName}
              </option>
            ))}
            {repositories.length === 0 && !loadingRepos && (
              <option disabled value="__empty">
                (No repos imported yet)
              </option>
            )}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <ApiStatusBadge />
      </div>
    </header>
  );
}
