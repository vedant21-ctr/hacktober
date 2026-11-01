'use client';

import React, { useState, useEffect } from 'react';
import type { Repository, Job, StatusResponse } from '@decisionvault/shared/api';
import { api } from '../lib/api';
import {
  PageTitle,
  Card,
  EmptyState,
  ErrorDisplay,
} from '../components/ui';

const STAGES = ['ingest', 'chunk', 'label', 'extract', 'verify', 'link', 'health', 'done'] as const;

const stageLabels: Record<string, string> = {
  ingest: 'GitHub Ingestion',
  chunk: 'Comment Chunking',
  label: 'Comment Classification',
  extract: 'Decision Reconstruction',
  verify: 'Evidence Verification',
  link: 'Code Mapping',
  health: 'Condition Health',
  done: 'Complete',
};

export default function ImportPage() {
  const [target, setTarget] = useState('');
  const [limit, setLimit] = useState(20);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    api.getStatus().then(setStatus).catch(() => {});
    loadRepos();
  }, []);

  useEffect(() => {
    if (!currentJob || currentJob.status === 'succeeded' || currentJob.status === 'failed') return;

    const timer = setInterval(async () => {
      try {
        const updated = await api.getJob(currentJob.id);
        setCurrentJob(updated);
        if (updated.status === 'succeeded') {
          setSuccessMsg(
            updated.type === 'extract_decisions'
              ? 'Decision extraction completed. View recovered decisions.'
              : `Successfully imported ${updated.progress.total} sources.`,
          );
          loadRepos();
        } else if (updated.status === 'failed') {
          setFormError(updated.error || 'Job failed');
        }
      } catch {
        // polling error
      }
    }, 1200);

    return () => clearInterval(timer);
  }, [currentJob]);

  async function loadRepos() {
    setLoadingRepos(true);
    try {
      const data = await api.getRepositories();
      setRepos(data.items);
    } catch {
      // silent
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
          return 'Only GitHub repositories (github.com) are supported.';
        }
      } catch {
        return 'Invalid URL.';
      }
    }
    return null;
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSuccessMsg(null);

    const err = validateTarget(target);
    if (err) { setFormError(err); return; }

    setIsSubmitting(true);
    try {
      const { jobId } = await api.importRepository({
        kind: 'github_repo',
        target: target.trim(),
        limit: Number(limit) || 20,
      });
      const job = await api.getJob(jobId);
      setCurrentJob(job);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleExtract(repoId: number) {
    setFormError(null);
    setSuccessMsg(null);
    try {
      const { jobId } = await api.extractDecisions({ repoId });
      const job = await api.getJob(jobId);
      setCurrentJob(job);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    }
  }

  const isRunning = currentJob?.status === 'running' || currentJob?.status === 'queued';
  const currentStageIdx = currentJob ? STAGES.indexOf(currentJob.stage as typeof STAGES[number]) : -1;

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl">
      <PageTitle
        title="Repository Ingestion"
        subtitle="Import a Public Repository — extract issues, pull requests, and discussion threads from any public GitHub repository for decision recovery."
        badge={isRunning ? 'IMPORT IN PROGRESS' : undefined}
        actions={
          <div className="flex items-center gap-3">
            <div className="rounded border border-vault-border bg-vault-surface px-2.5 py-1 text-[9px] font-mono">
              <span className="text-vault-text-dim">DB </span>
              <span className={status?.db ? 'text-emerald-400' : 'text-amber-400'}>
                {status?.db ? '● ONLINE' : '○ OFFLINE'}
              </span>
            </div>
            <div className="rounded border border-vault-border bg-vault-surface px-2.5 py-1 text-[9px] font-mono">
              <span className="text-vault-text-dim">LLM </span>
              <span className="text-vault-text-muted">
                {status?.ollama.model || 'gemma4:e4b'} ({status?.ollama.mode || 'replay'})
              </span>
            </div>
          </div>
        }
      />

      {/* ── Import Form ───────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-vault-border bg-vault-surface/30 p-6">
        <div className="text-[9px] font-mono uppercase tracking-widest text-vault-text-dim mb-4">
          Import a Public Repository
        </div>

        <form onSubmit={handleImport} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-3">
              <label className="block text-[10px] font-mono text-vault-text-dim mb-1.5">
                Repository (owner/repo or full URL)
              </label>
              <input
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="e.g. facebook/react or https://github.com/facebook/react"
                disabled={isSubmitting || isRunning}
                className="w-full rounded-md border border-vault-border bg-vault-bg px-3 py-2.5 text-sm text-vault-text font-mono placeholder-vault-text-dim focus-vault disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-vault-text-dim mb-1.5">
                Max Issues/PRs
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value, 10) || 20)}
                disabled={isSubmitting || isRunning}
                className="w-full rounded-md border border-vault-border bg-vault-bg px-3 py-2.5 text-sm text-vault-text font-mono focus-vault disabled:opacity-50"
              />
            </div>
          </div>

          {formError && (
            <div className="rounded-md border border-vault-rose/30 bg-vault-rose/5 p-3 text-xs text-vault-rose font-mono">
              <span className="font-semibold">Error: </span>{formError}
            </div>
          )}

          {successMsg && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-400 font-mono">
              <span className="font-semibold">✓ </span>{successMsg}
              <a href="/decisions" className="ml-2 underline hover:text-emerald-300">View Decisions →</a>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || isRunning || !target.trim()}
              className="rounded-md bg-vault-accent/10 border border-vault-accent/30 px-5 py-2.5 text-xs font-semibold text-vault-accent hover:bg-vault-accent/20 transition-colors font-mono disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Initiating...' : isRunning ? 'Job Running...' : '↓ Start GitHub Import'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Pipeline Progress ─────────────────────────────────────────────── */}
      {currentJob && isRunning && (
        <div className="rounded-lg border border-vault-accent/20 bg-vault-accent/5 p-5 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-vault-accent animate-ping" />
              <span className="text-xs font-mono font-semibold text-vault-accent">
                Job #{currentJob.id} — {currentJob.type}
              </span>
            </div>
            <span className="text-[10px] font-mono text-vault-text-dim">
              {currentJob.progress.done} / {currentJob.progress.total}
              {currentJob.tokensPerSec ? ` • ${currentJob.tokensPerSec.toFixed(1)} tok/s` : ''}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-vault-border rounded-full h-2 mb-4 overflow-hidden">
            <div
              className="bg-vault-accent h-2 rounded-full transition-all duration-500"
              style={{
                width: `${currentJob.progress.total > 0
                  ? Math.min(100, Math.round((currentJob.progress.done / currentJob.progress.total) * 100))
                  : 10}%`,
              }}
            />
          </div>

          {/* Pipeline stages */}
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-1">
            {STAGES.map((stage, i) => {
              const isCurrent = i === currentStageIdx;
              const isDone = i < currentStageIdx;
              return (
                <div key={stage} className="flex flex-col items-center gap-1">
                  <div
                    className={`w-full h-1 rounded-full transition-colors ${
                      isDone ? 'bg-vault-accent' : isCurrent ? 'bg-vault-accent/50 animate-pulse' : 'bg-vault-border'
                    }`}
                  />
                  <span
                    className={`text-[8px] font-mono uppercase tracking-wider text-center ${
                      isDone ? 'text-vault-accent' : isCurrent ? 'text-vault-accent' : 'text-vault-text-dim'
                    }`}
                  >
                    {stageLabels[stage]?.split(' ')[0] || stage}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Job completed */}
      {currentJob && currentJob.status === 'succeeded' && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400">✓</span>
            <span className="text-xs font-mono text-emerald-400">
              Job #{currentJob.id} completed successfully
            </span>
          </div>
          <button
            onClick={() => setCurrentJob(null)}
            className="text-[10px] font-mono text-vault-text-dim hover:text-vault-text-muted"
          >
            Dismiss
          </button>
        </div>
      )}

      {currentJob && currentJob.status === 'failed' && (
        <div className="rounded-lg border border-vault-rose/20 bg-vault-rose/5 p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-vault-rose">✕</span>
            <span className="text-xs font-mono font-semibold text-vault-rose">
              Job #{currentJob.id} failed at stage: {currentJob.stage}
            </span>
          </div>
          {currentJob.error && (
            <p className="text-[11px] font-mono text-vault-text-muted">{currentJob.error}</p>
          )}
        </div>
      )}

      {/* ── Imported Repositories ─────────────────────────────────────────── */}
      <div className="rounded-lg border border-vault-border bg-vault-surface/30 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-vault-text-dim mb-1">
              Imported Repositories
            </div>
            <p className="text-[10px] text-vault-text-dim">
              Live SQLite entries from verified GitHub ingestion
            </p>
          </div>
          <button
            onClick={loadRepos}
            className="text-[10px] font-mono text-vault-accent hover:text-vault-accent-muted transition-colors"
          >
            [Refresh]
          </button>
        </div>

        {loadingRepos ? (
          <div className="py-8 text-center text-[10px] font-mono text-vault-text-dim animate-pulse">
            Loading repositories...
          </div>
        ) : repos.length === 0 ? (
          <EmptyState
            icon="⊞"
            title="No Repositories Imported"
            description="Submit a public GitHub repository URL above to start ingesting engineering discussion data."
          />
        ) : (
          <div className="divide-y divide-vault-border/50">
            {repos.map((repo) => (
              <div key={repo.id} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-vault-text">
                      {repo.fullName}
                    </span>
                    <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[8px] font-mono font-bold text-emerald-400 uppercase">
                      Live
                    </span>
                  </div>
                  <div className="text-[10px] text-vault-text-dim font-mono mt-1">
                    Branch: {repo.defaultBranch || 'main'} • Imported: {new Date(repo.importedAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExtract(repo.id)}
                    disabled={isRunning}
                    className="rounded bg-vault-accent/10 border border-vault-accent/30 px-3 py-1.5 text-[10px] font-semibold text-vault-accent hover:bg-vault-accent/20 transition-colors font-mono disabled:opacity-30"
                  >
                    Extract Decisions
                  </button>
                  <a
                    href={`/decisions?repoId=${repo.id}`}
                    className="rounded bg-vault-surface border border-vault-border px-3 py-1.5 text-[10px] font-medium text-vault-text-muted hover:text-vault-text transition-colors font-mono"
                  >
                    Decisions →
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
