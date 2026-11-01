'use client';

import React, { useState, useEffect } from 'react';
import type { Repository } from '@decisionvault/shared/api';
import { api, ApiClientError } from '../lib/api';
import {
  PageTitle,
  StatusBadge,
  ConfidenceMeter,
  EmptyState,
  ErrorDisplay,
  FeatureNotice,
  SkeletonCard,
} from '../components/ui';

interface DecisionGraphNode {
  id: number;
  title: string;
  status: string;
  confidence: number;
  relations: {
    type: 'supersedes' | 'contradicts' | 'revisits' | 'supports';
    targetId: number;
    targetTitle?: string;
  }[];
}

export default function DecisionRelationshipsPage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null);
  const [nodes, setNodes] = useState<DecisionGraphNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<DecisionGraphNode | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiNotice, setApiNotice] = useState(false);

  useEffect(() => {
    api
      .getRepositories()
      .then((d) => {
        setRepos(d.items);
        if (d.items.length > 0) setSelectedRepoId(d.items[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedRepoId) {
      loadRelationships(selectedRepoId);
    }
  }, [selectedRepoId]);

  async function loadRelationships(repoId: number) {
    setLoading(true);
    setError(null);
    setApiNotice(false);
    setSelectedNode(null);

    try {
      const decisionsData = await api.getDecisions({ repoId, pageSize: 50 });
      const graphNodes: DecisionGraphNode[] = [];

      for (const dec of decisionsData.items) {
        let relationsList: DecisionGraphNode['relations'] = [];

        try {
          const relRes = await api.getRelationships(dec.id);
          relationsList = relRes.items.map((item) => ({
            type: item.type,
            targetId: item.otherDecision.id,
            targetTitle: item.otherDecision.title,
          }));
        } catch (relErr) {
          if (relErr instanceof ApiClientError && relErr.status === 501) {
            setApiNotice(true);
          }
          try {
            const detail = await api.getDecisionDetail(dec.id);
            relationsList = detail.relationships.map((r) => ({
              type: r.type,
              targetId: r.otherId,
            }));
          } catch {
            // continue
          }
        }

        graphNodes.push({
          id: dec.id,
          title: dec.title,
          status: dec.status,
          confidence: dec.confidence,
          relations: relationsList,
        });
      }

      setNodes(graphNodes);
      if (graphNodes.length > 0) setSelectedNode(graphNodes[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load decision relationships');
    } finally {
      setLoading(false);
    }
  }

  function getRelationBadge(type: string) {
    switch (type) {
      case 'supersedes':
        return (
          <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-mono font-medium text-emerald-400 uppercase">
            Supersedes
          </span>
        );
      case 'contradicts':
        return (
          <span className="rounded bg-rose-500/10 border border-rose-500/30 px-1.5 py-0.5 text-[10px] font-mono font-medium text-rose-400 uppercase">
            Contradicts
          </span>
        );
      case 'revisits':
        return (
          <span className="rounded bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-mono font-medium text-amber-400 uppercase">
            Revisits
          </span>
        );
      case 'supports':
      default:
        return (
          <span className="rounded bg-sky-500/10 border border-sky-500/30 px-1.5 py-0.5 text-[10px] font-mono font-medium text-sky-400 uppercase">
            Supports
          </span>
        );
    }
  }

  const filteredNodes = nodes.filter((n) => {
    if (filterType === 'all') return true;
    return n.relations.some((r) => r.type === filterType);
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <PageTitle
        title="Decision Relationships"
        subtitle="Graph &amp; Dependency Intelligence — Trace connections, superseding decisions, and potential architectural conflicts."
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
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/80"
            >
              <option value="all">All Relations ({nodes.length})</option>
              <option value="supersedes">Supersedes</option>
              <option value="contradicts">Contradicts</option>
              <option value="revisits">Revisits</option>
              <option value="supports">Supports</option>
            </select>
          </div>
        }
      />

      {apiNotice && (
        <FeatureNotice
          feature="Relationships Query Endpoint (GET /api/relationships)"
          description="The dedicated relationship graph endpoint is in active development on the backend. The graph is currently reading direct relationship references embedded in recovered decision records."
        />
      )}

      {error && <ErrorDisplay title="Relationship Graph Error" message={error} />}

      {/* Main Graph / Matrix Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Nodes Grid */}
        <div className="lg:col-span-7 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
            Decision Nodes ({filteredNodes.length})
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : filteredNodes.length > 0 ? (
            <div className="space-y-3">
              {filteredNodes.map((node) => {
                const isSelected = selectedNode?.id === node.id;
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => setSelectedNode(node)}
                    className={`w-full text-left p-4 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-emerald-500/40 bg-emerald-500/10 shadow-sm'
                        : 'border-slate-800/80 bg-[#0e1424]/75 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-emerald-400">
                          #{node.id}
                        </span>
                        <StatusBadge status={node.status} />
                      </div>
                      <span className="text-xs font-mono text-slate-400">
                        {node.relations.length} connection{node.relations.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-slate-100 mb-2 line-clamp-1">
                      {node.title}
                    </h3>

                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {node.relations.map((rel, rIdx) => (
                        <span key={rIdx} className="flex items-center gap-1">
                          {getRelationBadge(rel.type)}
                          <span className="text-[10px] font-mono text-slate-400">
                            → #{rel.targetId}
                          </span>
                        </span>
                      ))}
                      {node.relations.length === 0 && (
                        <span className="text-xs text-slate-500 italic">
                          Isolated architectural record
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon="⊷"
              title="No Related Decisions Found"
              description="No decisions in this repository match the selected relationship type."
            />
          )}
        </div>

        {/* Selected Node Details & Connected Edges */}
        <div className="lg:col-span-5">
          {selectedNode ? (
            <div className="rounded-lg border border-slate-800/80 bg-[#0e1424]/75 p-5 space-y-5 sticky top-6">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                  Selected Node
                </div>
                <h2 className="text-base font-semibold text-slate-100">
                  #{selectedNode.id}: {selectedNode.title}
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  <StatusBadge status={selectedNode.status} />
                  <ConfidenceMeter value={selectedNode.confidence} />
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 font-mono">
                  Connected Decisions ({selectedNode.relations.length})
                </div>

                {selectedNode.relations.length > 0 ? (
                  <div className="space-y-2">
                    {selectedNode.relations.map((rel, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-md border border-slate-800 bg-[#080c14]/80 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          {getRelationBadge(rel.type)}
                          <a
                            href={`/decisions/${rel.targetId}`}
                            className="text-emerald-400 hover:text-emerald-300 transition-colors font-medium text-[11px]"
                          >
                            Inspect #{rel.targetId} →
                          </a>
                        </div>
                        <div className="text-slate-200 font-medium pt-0.5">
                          {rel.targetTitle || `Decision Record #${rel.targetId}`}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-md border border-slate-800 bg-[#080c14]/50 text-center text-xs text-slate-500">
                    No explicit relationships declared for this decision.
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800/70">
                <a
                  href={`/decisions/${selectedNode.id}`}
                  className="w-full block text-center rounded-md bg-slate-900 border border-slate-800 hover:border-slate-700 py-2 text-xs font-medium text-slate-200 hover:text-white transition-colors"
                >
                  View Full Decision Details →
                </a>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-800 bg-[#0e1424]/40 p-8 text-center text-slate-500 text-xs">
              Select a decision node to view its connection graph
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
