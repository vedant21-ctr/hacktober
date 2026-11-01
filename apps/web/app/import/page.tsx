'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import type {
  Repository,
  Job,
  StatusResponse,
  DemoStatusResponse,
} from '@decisionvault/shared/api';

export default function ImportPage() {
  const [target, setTarget] = useState('');
  const [limit, setLimit] = useState<number>(20);
  const [statusInfo, setStatusInfo] = useState<StatusResponse | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(true);

  // Demo Repository State
  const [demoStatus, setDemoStatus] = useState<DemoStatusResponse | null>(null);
  const [isDemoOperating, setIsDemoOperating] = useState(false);

  // Import Job State
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch status, repositories, and demo status on mount
  useEffect(() => {
    fetchStatus();
    fetchRepositories();
    fetchDemoStatus();
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
            if (updatedJob.type === 'extract_decisions') {
              setSuccessMessage(
                `Decision extraction completed successfully! You can now view recovered decisions.`,
              );
            } else {
              setSuccessMessage(
                `Successfully imported ${updatedJob.progress.total} sources from GitHub repository.`,
              );
              fetchRepositories();
            }
          } else if (updatedJob.status === 'failed') {
            setFormError(updatedJob.error || 'Job failed');
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

  async function fetchDemoStatus() {
    try {
      const res = await fetch('/api/demo/status');
      if (res.ok) {
        const data = await res.json();
        setDemoStatus(data);
      }
    } catch {
      // Backend offline or in mock
    }
  }

  async function handleSeedDemo() {
    setIsDemoOperating(true);
    setFormError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/demo/seed', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to seed demo repository');
      setSuccessMessage(
        'Fictional demo repository acme-inc/payment-service successfully loaded into SQLite!',
      );
      await fetchDemoStatus();
      await fetchRepositories();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDemoOperating(false);
    }
  }

  async function handleResetDemo() {
    setIsDemoOperating(true);
    setFormError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to reset demo repository');
      setSuccessMessage('Fictional demo repository acme-inc/payment-service reset.');
      await fetchDemoStatus();
      await fetchRepositories();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDemoOperating(false);
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

  async function handleExtract(repoId: number) {
    setFormError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to start extraction');
      }
      const jobRes = await fetch(`/api/jobs/${data.jobId}`);
      if (jobRes.ok) {
        const jobData = await jobRes.json();
        setCurrentJob(jobData);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="py-4 max-w-4xl mx-auto space-y-6">
      {/* Header and Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 mb-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            Phase 3A: Live GitHub Ingestion
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Repository Ingestion</h1>
          <p className="mt-1 text-xs text-slate-400">
            Import issues, pull requests, and discussion threads from any public GitHub repository.
          </p>
        </div>

        {/* System Badges */}
        <div className="flex items-center gap-2.5 text-xs">
          <div className="rounded-md border border-slate-800 bg-[#0e1424]/80 px-2.5 py-1 text-slate-400">
            <span>DB: </span>
            <span
              className={
                statusInfo?.db ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'
              }
            >
              {statusInfo?.db ? 'Connected' : 'Standalone'}
            </span>
          </div>
          <div className="rounded-md border border-slate-800 bg-[#0e1424]/80 px-2.5 py-1 text-slate-400 font-mono text-[11px]">
            <span>LLM: </span>
            <span className="text-slate-200">
              {statusInfo?.ollama?.model || 'gemma4:e4b'} ({statusInfo?.ollama?.mode || 'replay'})
            </span>
          </div>
        </div>
      </div>

      {/* Fictional Demo Repository Panel */}
      <div className="rounded-lg border border-indigo-500/40 bg-gradient-to-r from-indigo-950/40 via-slate-900/60 to-purple-950/30 p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-300 mb-2">
              <span>PRESENTATION DEMO</span>
              <span className="text-slate-500">•</span>
              <span>100% OFFLINE</span>
            </div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>acme-inc/payment-service</span>
              <span className="text-xs font-mono font-normal text-slate-400 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                Fictional Payments Engine
              </span>
            </h2>
            <p className="mt-1 text-xs text-slate-300 max-w-2xl leading-relaxed">
              Curated architectural debates covering PostgreSQL vs MongoDB, Asynchronous payment
              queues, Mandatory Idempotency Keys, PCI-DSS raw card data prohibition, and Jittered
              Retries. Pre-wired for instant offline evaluation without GitHub API rate limits or
              tokens.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            {demoStatus?.seeded ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                Seeded ({demoStatus.decisionsCount} Decisions)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-500"></span>
                Not Loaded
              </span>
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-3">
          {!demoStatus?.seeded ? (
            <button
              onClick={handleSeedDemo}
              disabled={isDemoOperating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition shadow-sm disabled:opacity-50"
            >
              {isDemoOperating ? 'Seeding Demo Data...' : '⚡ Load Demo Repository'}
            </button>
          ) : (
            <>
              <Link
                href="/decisions"
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition shadow-sm"
              >
                <span>Explore Recovered Decisions</span>
                <span>→</span>
              </Link>
              <Link
                href="/prior-art"
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition"
              >
                <span>Test Prior Art Conflict Scenario</span>
                <span>⚠️</span>
              </Link>
              <button
                onClick={handleResetDemo}
                disabled={isDemoOperating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 hover:bg-red-950/40 text-red-400 border border-red-500/20 text-xs font-medium transition disabled:opacity-50 ml-auto"
              >
                <span>Reset Demo Data</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Import Form */}
      <div className="rounded-lg border border-slate-800/80 bg-[#0e1424]/75 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-200 mb-1">Import a Public Repository</h2>
        <p className="text-xs text-slate-400 mb-5 leading-relaxed">
          Provide a GitHub repository identifier (e.g.,{' '}
          <code className="font-mono text-slate-300">python/cpython</code> or{' '}
          <code className="font-mono text-slate-300">https://github.com/facebook/react</code>).
          Outbound requests are strictly limited to official GitHub APIs.
        </p>

        <form onSubmit={handleImport} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-3">
              <label htmlFor="target" className="block text-xs font-medium text-slate-300 mb-1.5">
                Repository (owner/repo or URL)
              </label>
              <input
                id="target"
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="e.g. facebook/react or https://github.com/facebook/react"
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-500/80 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 font-mono"
                disabled={isSubmitting || currentJob?.status === 'running'}
              />
            </div>

            <div>
              <label htmlFor="limit" className="block text-xs font-medium text-slate-300 mb-1.5">
                Max Issues/PRs
              </label>
              <input
                id="limit"
                type="number"
                min="1"
                max="100"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value, 10) || 20)}
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-500/80 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 font-mono"
                disabled={isSubmitting || currentJob?.status === 'running'}
              />
            </div>
          </div>

          {formError && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
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
              className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
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
          <div className="mt-5 rounded-md border border-emerald-500/30 bg-[#080c14]/90 p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-emerald-400 font-medium flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Job #{currentJob.id} — Stage: {currentJob.stage.toUpperCase()}
              </span>
              <span className="text-slate-400 font-mono text-[11px]">
                Progress: {currentJob.progress.done} / {currentJob.progress.total}
              </span>
            </div>

            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-1.5 transition-all duration-300"
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
      <div className="rounded-lg border border-slate-800/80 bg-[#0e1424]/75 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-200">Imported Repositories</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live SQLite database entries stored via verified GitHub ingestion.
            </p>
          </div>
          <button
            onClick={fetchRepositories}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
          >
            Refresh
          </button>
        </div>

        {loadingRepos ? (
          <div className="text-center py-8 text-xs text-slate-500">
            Loading imported repositories...
          </div>
        ) : repositories.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-800/80 p-8 text-center bg-[#080c14]/40">
            <p className="text-xs font-medium text-slate-300">
              No repositories have been imported yet.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Submit a public GitHub repository above to populate real discussion data.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/70">
            {repositories.map((repo) => (
              <div
                key={repo.id}
                className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-100">{repo.fullName}</span>
                    <span className="rounded bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 text-[10px] font-mono text-emerald-400">
                      LIVE DATA
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Branch:{' '}
                    <code className="font-mono text-slate-300">{repo.defaultBranch || 'main'}</code>{' '}
                    • Imported:{' '}
                    <span className="font-mono text-[11px]">
                      {new Date(repo.importedAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono text-slate-500">Repo #{repo.id}</span>
                  <button
                    onClick={() => handleExtract(repo.id)}
                    disabled={Boolean(currentJob && currentJob.status === 'running')}
                    className="rounded-md bg-emerald-600/90 hover:bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-50"
                  >
                    Extract Decisions
                  </button>
                  <a
                    href={`/decisions?repoId=${repo.id}`}
                    className="rounded-md bg-slate-900 border border-slate-800 hover:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-slate-100 transition-colors"
                  >
                    View Decisions →
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
