'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { DecisionDetail } from '@decisionvault/shared/api';
import { api } from '../../lib/api';
import {
  PageTitle,
  StatusBadge,
  LifecycleBadge,
  EvidenceChip,
  ConfidenceMeter,
  LinkKindBadge,
  Card,
  PageLoading,
  ErrorDisplay,
  SectionHeader,
} from '../../components/ui';

export default function DecisionDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const [detail, setDetail] = useState<DecisionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || isNaN(id)) return;
    setLoading(true);
    api
      .getDecisionDetail(id)
      .then(setDetail)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load decision'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <PageLoading message={`Loading decision #${id}...`} />;
  if (error) return <ErrorDisplay title="Decision Not Found" message={error} />;
  if (!detail) return <ErrorDisplay message="Decision data is empty" />;

  const chosen = detail.alternatives.filter((a) => a.outcome === 'chosen');
  const rejected = detail.alternatives.filter((a) => a.outcome === 'rejected');
  const open = detail.alternatives.filter((a) => a.outcome === 'open');

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl">
      {/* ── Breadcrumb ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-[10px] font-mono text-vault-text-dim">
        <a href="/decisions" className="hover:text-vault-text-muted transition-colors">Decisions</a>
        <span>/</span>
        <span className="text-vault-text-muted">#{detail.id}</span>
      </div>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <StatusBadge status={detail.status} />
          <LifecycleBadge lifecycle={detail.lifecycle} />
          <span className="text-[10px] font-mono text-vault-text-dim">Decision #{detail.id}</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-display font-bold text-vault-text leading-tight">
          {detail.title}
        </h1>
        <div className="mt-3 flex items-center gap-4 text-[10px] font-mono text-vault-text-dim flex-wrap">
          <a
            href={detail.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-vault-accent hover:underline"
          >
            {detail.sourceTitle} ↗
          </a>
          <span>|</span>
          <span>Confidence: <span className="text-vault-text-muted font-semibold">{Math.round(detail.confidence * 100)}%</span></span>
          <span>|</span>
          <span>
            Evidence Lock: <span className={detail.verifiedRatio >= 0.7 ? 'text-emerald-400' : 'text-amber-400'}>
              {Math.round(detail.verifiedRatio * 100)}% verified
            </span>
          </span>
        </div>
      </div>

      {/* ── Confidence Breakdown ──────────────────────────────────────────── */}
      <div className="rounded-lg border border-vault-border bg-vault-surface/30 p-4">
        <div className="text-[9px] font-mono uppercase tracking-widest text-vault-text-dim mb-3">
          Confidence Breakdown
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <div className="text-[10px] font-mono text-vault-text-dim mb-1">Overall</div>
            <ConfidenceMeter value={detail.confidence} size="md" />
          </div>
          <div>
            <div className="text-[10px] font-mono text-vault-text-dim mb-1">Coverage</div>
            <ConfidenceMeter value={detail.confidenceParts.coverage} size="md" />
          </div>
          <div>
            <div className="text-[10px] font-mono text-vault-text-dim mb-1">Statement</div>
            <ConfidenceMeter value={detail.confidenceParts.statement} size="md" />
          </div>
          <div>
            <div className="text-[10px] font-mono text-vault-text-dim mb-1">Reason Coverage</div>
            <ConfidenceMeter value={detail.confidenceParts.reasonCoverage} size="md" />
          </div>
        </div>
      </div>

      {/* ── Summary ───────────────────────────────────────────────────────── */}
      <div>
        <SectionHeader title="Decision Summary" />
        <div className="rounded-lg border border-vault-border bg-vault-surface/20 p-4">
          <p className="text-sm text-vault-text leading-relaxed">{detail.summary}</p>
        </div>
      </div>

      {/* ── Decision Evidence ─────────────────────────────────────────────── */}
      {detail.decisionEvidence.length > 0 && (
        <div>
          <SectionHeader
            title="Decision Evidence"
            count={detail.decisionEvidence.length}
            subtitle="Exact quotes from original discussions, verified against source comments"
          />
          <div className="space-y-2">
            {detail.decisionEvidence.map((ev) => (
              <div key={ev.id} className="rounded-lg border border-vault-border bg-vault-surface/20 p-4">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <EvidenceChip verified={ev.verified} method={ev.method} score={ev.score} />
                    <span className="text-[10px] font-mono text-vault-text-dim">
                      {ev.claimType} • by {ev.author} ({ev.role})
                    </span>
                  </div>
                  <a
                    href={ev.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] font-mono text-vault-text-dim hover:text-vault-accent transition-colors"
                  >
                    View on GitHub ↗
                  </a>
                </div>
                <blockquote className="evidence-quote text-xs text-vault-text leading-relaxed italic">
                  {ev.quote}
                </blockquote>
                <div className="mt-2 text-[9px] font-mono text-vault-text-dim">
                  {new Date(ev.at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Chosen Alternatives ───────────────────────────────────────────── */}
      {chosen.length > 0 && (
        <div>
          <SectionHeader
            title="Accepted Alternatives"
            count={chosen.length}
          />
          <div className="space-y-3">
            {chosen.map((alt) => (
              <AlternativeCard key={alt.id} alt={alt} />
            ))}
          </div>
        </div>
      )}

      {/* ── Rejected Alternatives ─────────────────────────────────────────── */}
      {rejected.length > 0 && (
        <div>
          <SectionHeader
            title="Rejected Alternatives"
            count={rejected.length}
            subtitle="Options that were considered and explicitly rejected with documented reasons"
          />
          <div className="space-y-3">
            {rejected.map((alt) => (
              <AlternativeCard key={alt.id} alt={alt} />
            ))}
          </div>
        </div>
      )}

      {/* ── Open Alternatives ─────────────────────────────────────────────── */}
      {open.length > 0 && (
        <div>
          <SectionHeader title="Open Alternatives" count={open.length} />
          <div className="space-y-3">
            {open.map((alt) => (
              <AlternativeCard key={alt.id} alt={alt} />
            ))}
          </div>
        </div>
      )}

      {/* ── Associated Files ──────────────────────────────────────────────── */}
      {detail.files.length > 0 && (
        <div>
          <SectionHeader
            title="Associated Code Files"
            count={detail.files.length}
            subtitle="Files governed by or related to this decision"
          />
          <div className="rounded-lg border border-vault-border bg-vault-surface/20 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-vault-border bg-vault-surface/40">
                  <th className="px-4 py-2 text-left font-mono text-[9px] uppercase tracking-wider text-vault-text-dim">File Path</th>
                  <th className="px-4 py-2 text-left font-mono text-[9px] uppercase tracking-wider text-vault-text-dim">Link Kind</th>
                  <th className="px-4 py-2 text-left font-mono text-[9px] uppercase tracking-wider text-vault-text-dim hidden md:table-cell">Basis</th>
                  <th className="px-4 py-2 text-left font-mono text-[9px] uppercase tracking-wider text-vault-text-dim hidden lg:table-cell">Commit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-vault-border/50">
                {detail.files.map((f, i) => (
                  <tr key={i} className="hover:bg-vault-surface/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-vault-text">{f.path}</span>
                      {f.currentPath && f.currentPath !== f.path && (
                        <span className="block text-[10px] font-mono text-vault-text-dim mt-0.5">
                          → renamed to: {f.currentPath}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <LinkKindBadge kind={f.linkKind} />
                    </td>
                    <td className="px-4 py-2.5 text-vault-text-dim font-mono hidden md:table-cell">
                      {f.basis}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-vault-text-dim hidden lg:table-cell">
                      {f.commitSha ? f.commitSha.substring(0, 8) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Discussion Timeline ───────────────────────────────────────────── */}
      {detail.events.length > 0 && (
        <div>
          <SectionHeader title="Discussion Timeline" count={detail.events.length} />
          <div className="relative timeline-line space-y-3 pl-8">
            {detail.events.map((ev, idx) => (
              <div key={idx} className="relative">
                <div className="absolute left-[-1.25rem] top-1 w-2.5 h-2.5 rounded-full border-2 border-vault-border bg-vault-surface" />
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="rounded bg-vault-accent/10 border border-vault-accent/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-vault-accent">
                    {ev.type}
                  </span>
                  <span className="text-vault-text-dim">
                    {new Date(ev.at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                  <a
                    href={ev.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-vault-text-dim hover:text-vault-accent transition-colors"
                  >
                    Source ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Relationships ─────────────────────────────────────────────────── */}
      {detail.relationships.length > 0 && (
        <div>
          <SectionHeader title="Decision Relationships" count={detail.relationships.length} />
          <div className="space-y-2">
            {detail.relationships.map((rel, idx) => (
              <a
                key={idx}
                href={`/decisions/${rel.otherId}`}
                className="flex items-center gap-3 rounded-lg border border-vault-border bg-vault-surface/20 p-3 hover:border-vault-border-bright transition-colors"
              >
                <span className="rounded bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase text-sky-400">
                  {rel.type}
                </span>
                <span className="text-xs font-mono text-vault-text-muted">
                  Decision #{rel.otherId}
                </span>
                <span className="ml-auto text-xs font-mono text-vault-text-dim">→</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Alternative Card Component ──────────────────────────────────────────────

function AlternativeCard({ alt }: { alt: DecisionDetail['alternatives'][number] }) {
  const outcomeColors: Record<string, string> = {
    chosen: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
    rejected: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
    open: 'bg-vault-surface border-vault-border text-vault-text-dim',
  };

  return (
    <div className="rounded-lg border border-vault-border bg-vault-surface/20 p-4">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${outcomeColors[alt.outcome] || outcomeColors.open}`}>
          {alt.outcome}
        </span>
        <h3 className="font-mono text-sm font-semibold text-vault-text">{alt.name}</h3>
        {alt.reasonCategory && (
          <span className="rounded bg-vault-surface px-1.5 py-0.5 text-[9px] font-mono text-vault-text-dim border border-vault-border">
            {alt.reasonCategory}
          </span>
        )}
      </div>

      <p className="text-xs text-vault-text-muted leading-relaxed mb-2">{alt.description}</p>

      {alt.reason && (
        <div className="text-xs text-vault-text leading-relaxed mb-3">
          <span className="font-mono font-semibold text-vault-text-dim">Reason:</span> {alt.reason}
        </div>
      )}

      {/* Evidence */}
      {alt.evidence.length > 0 && (
        <div className="mt-3 space-y-2 pl-3 border-l-2 border-vault-border">
          {alt.evidence.map((ev) => (
            <div key={ev.id} className="text-[11px]">
              <div className="flex items-center gap-2 mb-0.5">
                <EvidenceChip verified={ev.verified} method={ev.method} score={ev.score} />
                <span className="font-mono text-vault-text-dim">
                  {ev.claimType} by {ev.author}
                </span>
                <a
                  href={ev.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-vault-text-dim hover:text-vault-accent text-[9px] font-mono ml-auto"
                >
                  ↗
                </a>
              </div>
              <blockquote className="italic text-vault-text-muted leading-relaxed">
                &ldquo;{ev.quote}&rdquo;
              </blockquote>
            </div>
          ))}
        </div>
      )}

      {/* Conditions */}
      {alt.conditions.length > 0 && (
        <div className="mt-3 pt-2 border-t border-vault-border/50">
          <span className="text-[9px] font-mono font-semibold uppercase tracking-wider text-vault-text-dim">
            Conditions
          </span>
          <ul className="mt-1 space-y-1">
            {alt.conditions.map((c) => (
              <li key={c.id} className="flex items-start gap-2 text-[11px] text-vault-text-muted">
                <span className="text-vault-text-dim mt-0.5">•</span>
                <span>
                  {c.text}
                  <span className="font-mono text-vault-text-dim ml-1">
                    ({c.kind} — probe: {c.probe}{c.probeValue ? ` = ${c.probeValue}` : ''})
                  </span>
                  {c.health && (
                    <span className={`ml-1 font-mono text-[9px] ${
                      c.health.state === 'holds' ? 'text-emerald-400' :
                      c.health.state === 'may_not_hold' ? 'text-amber-400' : 'text-vault-text-dim'
                    }`}>
                      [{c.health.state.toUpperCase()}]
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
