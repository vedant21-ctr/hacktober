'use client';

import React, { useState, useEffect } from 'react';
import type { Repository, DecisionCard, DecisionFile } from '@decisionvault/shared/api';
import { api, ApiClientError } from '../lib/api';
import { PageTitle, StatusBadge, ErrorDisplay, FeatureNotice } from '../components/ui';

interface FileWithDecisions {
  path: string;
  currentPath?: string | null;
  decisionCount: number;
  decisions: {
    decision: DecisionCard;
    linkKind: DecisionFile['linkKind'];
    basis: string;
    commitSha?: string | null;
  }[];
}

export default function CodeExplorerPage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null);
  const [files, setFiles] = useState<FileWithDecisions[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedFile, setSelectedFile] = useState<FileWithDecisions | null>(null);
  const [apiNotice, setApiNotice] = useState(false);

  useEffect(() => {
    loadRepositories();
  }, []);

  useEffect(() => {
    if (selectedRepoId) {
      loadCodeMappings(selectedRepoId);
    }
  }, [selectedRepoId]);

  async function loadRepositories() {
    try {
      const data = await api.getRepositories();
      setRepos(data.items);
      if (data.items.length > 0) {
        setSelectedRepoId(data.items[0].id);
      }
    } catch {
      // Repositories will load on retry
    }
  }

  async function loadCodeMappings(repoId: number) {
    setLoading(true);
    setError(null);
    setSelectedFile(null);
    setApiNotice(false);

    try {
      try {
        const treeRes = await api.getCodeTree(repoId);
        const mappedFiles: FileWithDecisions[] = treeRes.nodes.map((n) => ({
          path: n.path,
          currentPath: n.currentPath,
          decisionCount: n.decisionCount,
          decisions: [],
        }));
        setFiles(mappedFiles);
        if (mappedFiles.length > 0) setSelectedFile(mappedFiles[0]);
      } catch (treeErr) {
        if (treeErr instanceof ApiClientError && treeErr.status === 501) {
          setApiNotice(true);
        }
        await buildMappingFromDecisions(repoId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load code mappings');
    } finally {
      setLoading(false);
    }
  }

  async function buildMappingFromDecisions(repoId: number) {
    const decisionsData = await api.getDecisions({ repoId, pageSize: 50 });
    const fileMap = new Map<string, FileWithDecisions>();

    for (const dec of decisionsData.items) {
      try {
        const detail = await api.getDecisionDetail(dec.id);
        detail.files.forEach((file) => {
          const existing = fileMap.get(file.path) || {
            path: file.path,
            currentPath: file.currentPath,
            decisionCount: 0,
            decisions: [],
          };
          existing.decisionCount += 1;
          existing.decisions.push({
            decision: dec,
            linkKind: file.linkKind,
            basis: file.basis,
            commitSha: file.commitSha,
          });
          fileMap.set(file.path, existing);
        });
      } catch {
        // Continue with other decisions
      }
    }

    const fileList = Array.from(fileMap.values()).sort((a, b) => b.decisionCount - a.decisionCount);
    setFiles(fileList);
    if (fileList.length > 0) setSelectedFile(fileList[0]);
  }

  const filteredFiles = files.filter((f) => f.path.toLowerCase().includes(search.toLowerCase()));

  function getLinkKindBadge(kind: string) {
    switch (kind) {
      case 'symbol':
        return (
          <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-mono font-medium text-emerald-400">
            ✓ Symbol Evidence
          </span>
        );
      case 'pr_diff':
        return (
          <span className="rounded bg-sky-500/10 border border-sky-500/30 px-1.5 py-0.5 text-[10px] font-mono font-medium text-sky-400">
            PR Diff Modified
          </span>
        );
      case 'rename_tracked':
        return (
          <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-mono font-medium text-emerald-400">
            Rename Tracked
          </span>
        );
      case 'mentioned':
      default:
        return (
          <span className="rounded bg-slate-800 border border-slate-700 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
            Mentioned
          </span>
        );
    }
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <PageTitle
        title="Code Explorer"
        subtitle="Source Code to Architectural Decision Mapping — Discover which historical engineering decisions govern specific files and modules."
        actions={
          <div className="flex items-center gap-3">
            <select
              value={selectedRepoId || ''}
              onChange={(e) => setSelectedRepoId(Number(e.target.value))}
              className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/80"
            >
              {repos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName}
                </option>
              ))}
            </select>
            <a
              href={`/code/why?repoId=${selectedRepoId || ''}`}
              className="rounded-md bg-emerald-600/10 border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-600/20 transition-colors"
            >
              File-to-Decision Lookup →
            </a>
          </div>
        }
      />

      {apiNotice && (
        <FeatureNotice
          feature="Code Tree Endpoint (GET /api/code/tree)"
          description="The dedicated file-tree index endpoint is currently in active development on the backend. DecisionVault is rendering verified code mappings directly from extracted decisions and associated commit records."
        />
      )}

      {error && <ErrorDisplay title="Code Explorer Error" message={error} />}

      {/* Main Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: File List */}
        <div className="lg:col-span-5 rounded-lg border border-slate-800/80 bg-[#0e1424]/75 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Governed Files ({files.length})
            </span>
            <span className="text-[11px] text-slate-400">Sorted by Decision Count</span>
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files by path..."
            className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/80"
          />

          {loading && (
            <div className="space-y-2 py-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-8 bg-slate-800/40 rounded animate-pulse" />
              ))}
            </div>
          )}

          {!loading && filteredFiles.length > 0 && (
            <div className="space-y-1 max-h-[600px] overflow-y-auto pr-1">
              {filteredFiles.map((file) => {
                const isSelected = selectedFile?.path === file.path;
                return (
                  <button
                    key={file.path}
                    type="button"
                    onClick={() => setSelectedFile(file)}
                    className={`w-full text-left p-2.5 rounded-md transition-colors text-xs flex items-center justify-between border ${
                      isSelected
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                        : 'border-transparent bg-slate-900/40 hover:bg-slate-900/80 text-slate-300'
                    }`}
                  >
                    <span className="truncate max-w-[260px] font-mono text-[11px]">
                      {file.path}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${
                        isSelected
                          ? 'bg-emerald-500 text-slate-950 font-semibold'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {file.decisionCount}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {!loading && filteredFiles.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-500">
              No files matched your search or have associated decisions.
            </div>
          )}
        </div>

        {/* Right: Selected File Details */}
        <div className="lg:col-span-7 space-y-4">
          {selectedFile ? (
            <div className="rounded-lg border border-slate-800/80 bg-[#0e1424]/75 p-6 space-y-6">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                  Selected File
                </div>
                <h2 className="text-base font-semibold font-mono text-slate-100 break-all">
                  {selectedFile.path}
                </h2>
                {selectedFile.currentPath && selectedFile.currentPath !== selectedFile.path && (
                  <div className="text-xs text-emerald-400 font-mono mt-1">
                    ↳ Current Path (Rename Tracked): {selectedFile.currentPath}
                  </div>
                )}
              </div>

              {/* Associated Decisions */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 font-mono">
                  Historical Decisions Governing This File ({selectedFile.decisions.length})
                </div>

                <div className="space-y-3">
                  {selectedFile.decisions.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-slate-800 bg-[#080c14]/80 p-4 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {getLinkKindBadge(item.linkKind)}
                            {item.commitSha && (
                              <span className="text-[11px] font-mono text-slate-500">
                                Commit: <code>{item.commitSha.slice(0, 7)}</code>
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm font-semibold text-slate-100">
                            <a
                              href={`/decisions/${item.decision.id}`}
                              className="hover:text-emerald-300 transition-colors"
                            >
                              {item.decision.title}
                            </a>
                          </h3>
                        </div>
                        <StatusBadge status={item.decision.status} />
                      </div>

                      <p className="text-xs text-slate-400 leading-relaxed">
                        {item.decision.summary}
                      </p>

                      <div className="text-xs text-slate-300 bg-slate-950/70 rounded p-2.5 border border-slate-800/70 leading-relaxed">
                        <span className="text-slate-500 font-mono text-[11px]">
                          Association Basis:
                        </span>{' '}
                        &ldquo;
                        {item.basis}&rdquo;
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                        <a
                          href={item.decision.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-400 hover:text-emerald-400 transition-colors"
                        >
                          Original GitHub Source ↗
                        </a>
                        <a
                          href={`/decisions/${item.decision.id}`}
                          className="text-emerald-400 hover:text-emerald-300 font-medium"
                        >
                          View Full Decision Record →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-800 bg-[#0e1424]/40 p-12 text-center text-slate-500 text-xs">
              Select a file from the list to inspect governing decisions and evidence
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
