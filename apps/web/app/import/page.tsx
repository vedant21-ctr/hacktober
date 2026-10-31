'use client';

import React, { useState, useEffect } from 'react';
import type { Repository, Job, StatusResponse } from '@decisionvault/shared/api';

export default function ImportPage() {
  const [target, setTarget] = useState('');
  const [limit, setLimit] = useState<number>(20);
  const [statusInfo, setStatusInfo] = useState<StatusResponse | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(true);

  // Import Job State
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch status and repositories on mount
  useEffect(() => {
    fetchStatus();
    fetchRepositories();
  }, []);

  // Poll active job if one is running
  useEffect(() => {
    if (!currentJob || currentJob.status === 'succeeded' || currentJob.status === 'failed') {
      return;
    }

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${currentJob.id}`);
        if (res.ok) {
          const updatedJob: Job = await res.json();
          setCurrentJob(updatedJob);
          if (updatedJob.status === 'succeeded') {
            setSuccessMessage(
              `Successfully imported ${updatedJob.progress.total} sources from GitHub repository.`,
            );
            fetchRepositories();
          } else if (updatedJob.status === 'failed') {
            setFormError(updatedJob.error || 'Import job failed');
          }
        } else if (res.status === 404) {
          setCurrentJob(null);
          setFormError('Import job not found or expired.');
        }
      } catch (err) {
        console.error('Failed to poll job status:', err);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [currentJob]);

  async function fetchStatus() {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setStatusInfo(data);
      }
    } catch {
      // Backend offline or in mock
    }
  }

  async function fetchRepositories() {
    setLoadingRepos(true);
    try {
      const res = await fetch('/api/repositories');
      if (res.ok) {
        const data = await res.json();
        setRepositories(data.items || []);
      }
    } catch (err) {
      console.error('Failed to load repositories:', err);
    } finally {
      setLoadingRepos(false);
    }
  }

  function validateTarget(val: string): string | null {
    const trimmed = val.trim();
    if (!trimmed) return 'Repository target is required';
    if (/^https?:\/\//i.test(trimmed)) {
      try {
        const url = new URL(trimmed);
        if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') {
          return 'Only official GitHub repositories (github.com) are supported.';
        }
      } catch {
        return 'Invalid repository URL.';
      }
    }
    return null;
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const validationErr = validateTarget(target);
    if (validationErr) {
      setFormError(validationErr);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'github_repo',
          target: target.trim(),
          limit: Number(limit) || 20,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to start import job');
      }

      // Fetch newly created job details
      const jobRes = await fetch(`/api/jobs/${data.jobId}`);
      if (jobRes.ok) {
        const jobData = await jobRes.json();
        setCurrentJob(jobData);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="py-8 max-w-4xl mx-auto space-y-8">
      {/* Header and Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 mb-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Phase 3A: Live GitHub Ingestion
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100">Repository Ingestion</h1>
          <p className="mt-1 text-sm text-slate-400">
            Import issues, pull requests, and discussion threads from any public GitHub repository.
          </p>
        </div>

        {/* System Badges */}
        <div className="flex items-center gap-3">
          <div className="rounded border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs font-mono">
            <span className="text-slate-500">DB: </span>
            <span className={statusInfo?.db ? 'text-emerald-400' : 'text-amber-400'}>
              {statusInfo?.db ? 'CONNECTED' : 'STANDALONE'}
            </span>
          </div>
          <div className="rounded border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs font-mono">
            <span className="text-slate-500">LLM: </span>
            <span className="text-slate-300">
              {statusInfo?.ollama?.model || 'gemma4:e4b'} ({statusInfo?.ollama?.mode || 'replay'})
            </span>
          </div>
        </div>
      </div>

      {/* Import Form */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-200 mb-1">Import a Public Repository</h2>
        <p className="text-xs text-slate-400 mb-6">
          Provide a GitHub repository identifier (e.g., <code>python/cpython</code> or{' '}
          <code>https://github.com/facebook/react</code>). Outbound requests are strictly limited to
          official GitHub APIs.
        </p>

        <form onSubmit={handleImport} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-3">
              <label htmlFor="target" className="block text-xs font-medium text-slate-300 mb-1">
                Repository (owner/repo or URL)
              </label>
              <input
                id="target"
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="e.g. facebook/react or https://github.com/facebook/react"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                disabled={isSubmitting || currentJob?.status === 'running'}
              />
            </div>

            <div>
              <label htmlFor="limit" className="block text-xs font-medium text-slate-300 mb-1">
                Max Issues/PRs
              </label>
              <input
                id="limit"
                type="number"
                min="1"
                max="100"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value, 10) || 20)}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                disabled={isSubmitting || currentJob?.status === 'running'}
              />
            </div>
          </div>

          {formError && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
              <span className="font-semibold">Import Error: </span>
              {formError}
            </div>
          )}

          {successMessage && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400">
              <span className="font-semibold">Success: </span>
              {successMessage}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmitting || currentJob?.status === 'running' || !target.trim()}
              className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting
                ? 'Initiating Import...'
                : currentJob?.status === 'running'
                  ? 'Ingesting in Background...'
                  : 'Start GitHub Import'}
            </button>
          </div>
        </form>

        {/* Live Progress Card */}
        {currentJob && currentJob.status === 'running' && (
          <div className="mt-6 rounded-md border border-emerald-500/30 bg-slate-950/80 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-emerald-400 font-semibold flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                Job #{currentJob.id} — Stage: {currentJob.stage.toUpperCase()}
              </span>
              <span className="text-slate-400">
                Progress: {currentJob.progress.done} / {currentJob.progress.total}
              </span>
            </div>

            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 transition-all duration-300"
                style={{
                  width: `${
                    currentJob.progress.total > 0
                      ? Math.min(
                          100,
                          Math.round((currentJob.progress.done / currentJob.progress.total) * 100),
                        )
                      : 10
                  }%`,
                }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* Imported Repositories List */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-200">Imported Repositories</h2>
            <p className="text-xs text-slate-400">
              Live SQLite database entries stored via verified GitHub ingestion.
            </p>
          </div>
          <button
            onClick={fetchRepositories}
            className="text-xs font-mono text-emerald-400 hover:text-emerald-300"
          >
            [Refresh]
          </button>
        </div>

        {loadingRepos ? (
          <div className="text-center py-8 text-xs text-slate-500 font-mono">
            Loading imported repositories...
          </div>
        ) : repositories.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-800 p-8 text-center">
            <p className="text-sm text-slate-400">No repositories have been imported yet.</p>
            <p className="text-xs text-slate-600 mt-1">
              Submit a public GitHub repository above to populate real discussion data.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {repositories.map((repo) => (
              <div
                key={repo.id}
                className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-slate-200">
                      {repo.fullName}
                    </span>
                    <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-mono text-emerald-400">
                      LIVE DATA
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 font-mono">
                    Branch: {repo.defaultBranch || 'main'} • Imported:{' '}
                    {new Date(repo.importedAt).toLocaleString()}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-400 font-mono">Repo ID: #{repo.id}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
