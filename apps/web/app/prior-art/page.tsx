'use client';

import React, { useState, useEffect } from 'react';
import type {
  PriorArtReport,
  PriorArtItem,
  Repository,
  CodeTreeNode,
  DecisionDetail,
} from '@decisionvault/shared/api';
import type { PriorArtInputType } from '@decisionvault/shared/enums';

export default function PriorArtPage() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [mappedFiles, setMappedFiles] = useState<CodeTreeNode[]>([]);
  const [inputType, setInputType] = useState<PriorArtInputType>('pr');
  const [inputValue, setInputValue] = useState<string>('');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<PriorArtReport | null>(null);

  // Decision detail modal state
  const [selectedDecision, setSelectedDecision] = useState<DecisionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    fetchRepositories();
  }, []);

  useEffect(() => {
    if (selectedRepoId) {
      fetchMappedFiles(parseInt(selectedRepoId, 10));
    } else {
      setMappedFiles([]);
    }
  }, [selectedRepoId]);

  async function fetchRepositories() {
    try {
      const res = await fetch('/api/repositories');
      if (res.ok) {
        const data = await res.json();
        const repos: Repository[] = data.items || [];
        setRepositories(repos);
        if (repos.length > 0 && !selectedRepoId) {
          setSelectedRepoId(String(repos[0].id));
        }
      }
    } catch (err) {
      console.error('Failed to load repositories:', err);
    }
  }

  async function fetchMappedFiles(repoId: number) {
    try {
      const res = await fetch(`/api/code/tree?repoId=${repoId}`);
      if (res.ok) {
        const data = await res.json();
        setMappedFiles(data.nodes || []);
      }
    } catch (err) {
      console.error('Failed to load mapped files:', err);
    }
  }

  function handleSelectMappedFile(filePath: string) {
    if (inputType === 'pr' || inputType === 'idea') {
      if (!inputValue.includes(filePath)) {
        setInputValue((prev) => (prev ? `${prev}\n${filePath}` : filePath));
      }
    } else {
      // diff mode
      const snippet = `diff --git a/${filePath} b/${filePath}\n--- a/${filePath}\n+++ b/${filePath}\n@@ -1,3 +1,4 @@\n+// simulated change`;
      setInputValue((prev) => (prev ? `${prev}\n\n${snippet}` : snippet));
    }
  }

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRepoId) {
      setError('Please select an imported repository.');
      return;
    }
    if (!inputValue.trim()) {
      setError('Please provide changed file paths, diff, or proposed change description.');
      return;
    }

    setAnalyzing(true);
    setError(null);
    setReport(null);

    try {
      const payload = {
        repoId: parseInt(selectedRepoId, 10),
        input: {
          type: inputType,
          value: inputValue.trim(),
        },
      };

      const res = await fetch('/api/sandbox/prior-art', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `Failed to analyze (HTTP ${res.status})`);
      }

      const { jobId } = await res.json();

      // Poll report endpoint until report is ready
      let attempts = 0;
      const maxAttempts = 15;
      while (attempts < maxAttempts) {
        attempts++;
        await new Promise((r) => setTimeout(r, 600));

        const reportRes = await fetch(`/api/sandbox/reports/${jobId}`);
        if (reportRes.status === 200) {
          const reportData: PriorArtReport = await reportRes.json();
          setReport(reportData);
          break;
        } else if (reportRes.status === 202) {
          // Still running, continue polling
          continue;
        } else {
          const errData = await reportRes.json().catch(() => ({}));
          throw new Error(
            errData.error?.message || `Report fetch failed with HTTP ${reportRes.status}`,
          );
        }
      }

      if (attempts >= maxAttempts) {
        throw new Error('Prior art analysis timed out while generating report.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }

  async function openDecisionDetail(id: number) {
    setLoadingDetail(true);
    setDetailError(null);
    try {
      const res = await fetch(`/api/decisions/${id}`);
      if (res.ok) {
        const detail: DecisionDetail = await res.json();
        setSelectedDecision(detail);
      } else {
        setDetailError(`Failed to load decision detail (HTTP ${res.status})`);
      }
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Error fetching decision');
    } finally {
      setLoadingDetail(false);
    }
  }

  function getRelationBadge(relation: string) {
    if (relation === 'conflicts') {
      return (
        <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-400"></span>
          CONFLICTS
        </span>
      );
    }
    if (relation === 'related') {
      return (
        <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400"></span>
          RELATED
        </span>
      );
    }
    return (
      <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400">
        {relation}
      </span>
    );
  }

  const conflictsCount = report?.items.filter((i) => i.relation === 'conflicts').length || 0;
  const relatedCount = report?.items.filter((i) => i.relation === 'related').length || 0;

  return (
    <div className="space-y-8">
      {/* Simulation Banner & Header */}
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-mono text-amber-300 mb-3">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          SIMULATED PR ANALYSIS — Grounded in recovered decisions &amp; verified evidence
        </div>
        <h1 className="text-xl font-bold text-slate-100 font-mono tracking-tight">
          Prior-Art Detection
        </h1>
        <p className="mt-1 text-xs text-slate-400 max-w-3xl">
          Evaluate proposed code changes against historical consensus, deprecation decisions, and
          previously rejected alternatives before writing or merging code.
        </p>
      </div>

      {/* Input / Simulation Form */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5">
        <form onSubmit={handleAnalyze} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">
                Select Imported Repository
              </label>
              <select
                value={selectedRepoId}
                onChange={(e) => setSelectedRepoId(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
              >
                {repositories.length === 0 ? (
                  <option value="">No repositories imported yet</option>
                ) : (
                  repositories.map((repo) => (
                    <option key={repo.id} value={repo.id}>
                      {repo.fullName} ({repo.defaultBranch})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">
                Simulation Input Mode
              </label>
              <div className="flex gap-2">
                {(['pr', 'diff', 'idea'] as PriorArtInputType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setInputType(t)}
                    className={`flex-1 py-1.5 px-3 rounded text-xs font-mono font-semibold transition ${
                      inputType === t
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {t === 'pr' ? 'PR / Files' : t === 'diff' ? 'Git Diff' : 'Idea / Concept'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Select Mapped Files */}
          {mappedFiles.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-mono text-slate-400">
                  Quick Select Mapped Files in this Repository:
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  {mappedFiles.length} mapped files available
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 rounded border border-slate-800 bg-slate-950/60">
                {mappedFiles.slice(0, 16).map((node) => (
                  <button
                    key={node.path}
                    type="button"
                    onClick={() => handleSelectMappedFile(node.path)}
                    className="rounded bg-slate-800/80 hover:bg-slate-700 px-2 py-0.5 text-[10px] font-mono text-slate-300 hover:text-emerald-300 transition"
                  >
                    {node.path} ({node.decisionCount})
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">
              {inputType === 'diff'
                ? 'Paste Git Unified Diff'
                : inputType === 'idea'
                  ? 'Describe Proposed Feature or Architectural Idea'
                  : 'Enter Simulated PR Details (File paths or PR summary)'}
            </label>
            <textarea
              rows={4}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                inputType === 'diff'
                  ? 'diff --git a/server/index.ts b/server/index.ts\n--- a/server/index.ts\n+++ b/server/index.ts\n@@ -10,3 +10,4 @@'
                  : inputType === 'idea'
                    ? 'Re-add cgi module to standard library for lightweight scripts'
                    : 'Refactor auth module:\nsrc/legacy_auth.py\nsrc/oauth.ts'
              }
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono leading-relaxed"
            />
          </div>

          {error && (
            <div className="rounded border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300 font-mono">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={analyzing || !selectedRepoId}
              className="rounded bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition disabled:opacity-50 font-mono flex items-center gap-2"
            >
              {analyzing ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Analyzing Prior Art...
                </>
              ) : (
                'Run Simulated PR Analysis'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Analysis Results */}
      {report && (
        <div className="space-y-6">
          {/* Summary Banner */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-500">
                  Simulation Summary
                </span>
                <h2 className="text-sm font-semibold text-slate-100 font-mono">
                  {report.input.summary}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {conflictsCount > 0 ? (
                  <span className="rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-1 text-xs font-mono font-bold">
                    {conflictsCount} Potential Conflict{conflictsCount > 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className="rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 text-xs font-mono font-bold">
                    0 Conflicts
                  </span>
                )}
                <span className="rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-1 text-xs font-mono font-bold">
                  {relatedCount} Related Decision{relatedCount > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono border-t border-slate-800/80 pt-3">
              <div>
                <span className="text-slate-500">
                  Detected Changed Paths ({report.changedPaths.length}):
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {report.changedPaths.length === 0 ? (
                    <span className="text-slate-500 italic">No specific file paths detected</span>
                  ) : (
                    report.changedPaths.map((p) => {
                      const isMapped = mappedFiles.some((mf) => mf.path === p);
                      return (
                        <span
                          key={p}
                          className={`rounded px-1.5 py-0.5 text-[11px] ${
                            isMapped
                              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {p} {isMapped ? '✓' : '(unmapped)'}
                        </span>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <span className="text-slate-500">
                  Detected Concepts ({report.concepts.length}):
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {report.concepts.length === 0 ? (
                    <span className="text-slate-500 italic">No specific concepts</span>
                  ) : (
                    report.concepts.map((c) => (
                      <span
                        key={c}
                        className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300"
                      >
                        #{c}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-400 italic border-t border-slate-800/60 pt-2">
              {report.note}
            </p>
          </div>

          {/* Conflict Warning Notice */}
          {conflictsCount > 0 && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-xs font-mono">
              <div className="flex items-center gap-2 text-rose-300 font-bold mb-1">
                <span className="text-base">⚠</span>
                Attention: Potential Historical Conflicts Detected ({conflictsCount})
              </div>
              <p className="text-rose-200/80 leading-relaxed">
                The proposed change touches files or concepts that contradict prior accepted
                decisions or previously rejected alternatives. Review the grounding evidence below
                to understand the historical rationale and conditions before proceeding.
              </p>
            </div>
          )}

          {/* Matched Prior-Art Items */}
          {report.items.length === 0 ? (
            <div className="rounded-lg border border-slate-800 bg-slate-900/20 p-8 text-center text-xs text-slate-400 font-mono">
              No historical decisions or rejected alternatives match the specified files.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                Historical Decisions &amp; Prior-Art Evidence ({report.items.length})
              </div>

              {report.items.map((item, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg border p-4.5 transition ${
                    item.relation === 'conflicts'
                      ? 'border-rose-500/40 bg-slate-900/60'
                      : 'border-slate-800 bg-slate-900/40'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-2.5">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        {getRelationBadge(item.relation)}
                        <button
                          type="button"
                          onClick={() => openDecisionDetail(item.decision.id)}
                          className="text-sm font-bold text-slate-100 hover:text-emerald-400 font-mono text-left transition"
                        >
                          {item.decision.title}
                        </button>
                      </div>
                      <p className="text-xs text-slate-400 font-mono mb-2">
                        {item.decision.summary}
                      </p>
                    </div>

                    <div className="text-right font-mono text-xs text-slate-500">
                      <div>Confidence: {Math.round(item.decision.confidence * 100)}%</div>
                      <div>Evidence Ratio: {Math.round(item.decision.verifiedRatio * 100)}%</div>
                    </div>
                  </div>

                  {/* Grounded Reason */}
                  <div className="rounded border border-slate-800 bg-slate-950 p-2.5 text-xs font-mono mb-3">
                    <span className="font-semibold text-slate-300">Surfaced Reason:</span>{' '}
                    <span className="text-slate-400">{item.reason}</span>
                  </div>

                  {/* Prior Rejection Rationale */}
                  {item.rejectedBecause && (
                    <div className="rounded border border-rose-500/30 bg-rose-500/5 p-2.5 text-xs font-mono mb-3">
                      <span className="font-semibold text-rose-300">
                        Previously Rejected Because:
                      </span>{' '}
                      <span className="text-slate-300">{item.rejectedBecause}</span>
                    </div>
                  )}

                  {/* Reconsideration Guidance */}
                  {item.reconsiderIf && (
                    <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs font-mono mb-3">
                      <span className="font-semibold text-amber-300">Reconsider If:</span>{' '}
                      <span className="text-slate-300">{item.reconsiderIf}</span>
                    </div>
                  )}

                  {/* Grounded Verified Evidence Quotes */}
                  {item.evidence.length > 0 && (
                    <div className="space-y-2 mt-3 pt-3 border-t border-slate-800">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                        Supporting Verified Evidence ({item.evidence.length})
                      </span>
                      {item.evidence.map((ev) => (
                        <div
                          key={ev.id}
                          className="rounded border border-slate-800 bg-slate-950 p-2.5 text-xs font-mono"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-slate-400 text-[11px]">
                              by {ev.author} ({ev.role}) • {ev.claimType}
                            </span>
                            <a
                              href={ev.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-slate-500 hover:text-emerald-400"
                            >
                              GitHub Source ↗
                            </a>
                          </div>
                          <blockquote className="italic text-slate-300 border-l-2 border-slate-700 pl-2 my-1 text-[11px]">
                            &ldquo;{ev.quote}&rdquo;
                          </blockquote>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Source Discussion Reference */}
                  <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-slate-500 border-t border-slate-800/60 pt-2">
                    <span>Source: {item.decision.sourceTitle}</span>
                    <a
                      href={item.decision.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-400 hover:text-emerald-300"
                    >
                      Open Discussion ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Decision Detail Modal */}
      {selectedDecision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-500">
                  Decision #{selectedDecision.id}
                </span>
                <h2 className="text-lg font-bold text-slate-100 font-mono">
                  {selectedDecision.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDecision(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 font-mono mb-4 leading-relaxed">
              {selectedDecision.summary}
            </p>

            {/* Alternatives */}
            {selectedDecision.alternatives.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-mono uppercase text-slate-400 mb-2">
                  Considered Alternatives
                </h3>
                <div className="space-y-2">
                  {selectedDecision.alternatives.map((alt) => (
                    <div
                      key={alt.id}
                      className="rounded border border-slate-800 bg-slate-950 p-3 text-xs font-mono"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            alt.outcome === 'chosen'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {alt.outcome}
                        </span>
                        <span className="font-semibold text-slate-200">{alt.name}</span>
                      </div>
                      <p className="text-slate-400 mb-1">{alt.description}</p>
                      {alt.reason && (
                        <p className="text-slate-300">
                          <span className="text-slate-500 font-semibold">Reason:</span> {alt.reason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Verified Quotes */}
            {selectedDecision.decisionEvidence.length > 0 && (
              <div>
                <h3 className="text-xs font-mono uppercase text-slate-400 mb-2">
                  Decision Evidence (Exact Quotes)
                </h3>
                <div className="space-y-2">
                  {selectedDecision.decisionEvidence.map((ev) => (
                    <div
                      key={ev.id}
                      className="rounded border border-slate-800 bg-slate-950 p-2.5 text-xs font-mono"
                    >
                      <blockquote className="italic text-slate-300 border-l-2 border-slate-700 pl-2">
                        &ldquo;{ev.quote}&rdquo;
                      </blockquote>
                      <div className="mt-1 text-[10px] text-slate-500">
                        by {ev.author} ({ev.role})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
