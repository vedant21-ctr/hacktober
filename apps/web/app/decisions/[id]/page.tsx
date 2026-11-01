'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, ApiNotImplementedError } from '../../../lib/api';
import type { DecisionDetail as DecisionDetailType } from '@decisionvault/shared/api';
import { StatusBadge, Badge } from '../../../components/ui/Badge';
import { ConfidenceMeter } from '../../../components/decisions/ConfidenceMeter';
import { AlternativesList } from '../../../components/decisions/AlternativesList';
import { EvidenceLedger } from '../../../components/decisions/EvidenceLedger';
import { CodeConnections } from '../../../components/decisions/CodeConnections';
import { TimelineTrail } from '../../../components/decisions/TimelineTrail';
import { Spinner } from '../../../components/ui/Spinner';
import { ErrorAlert } from '../../../components/ui/ErrorAlert';

export default function DecisionDetailPage() {
  const params = useParams();
  const idStr = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const decisionId = Number(idStr) || 12;

  const [decision, setDecision] = useState<DecisionDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isNotImplemented, setIsNotImplemented] = useState(false);
  const [isFixturePreview, setIsFixturePreview] = useState(false);

  const loadDecision = async (previewFixture = false) => {
    setLoading(true);
    setError(null);
    setIsNotImplemented(false);

    if (previewFixture) {
      try {
        const fixture = api.fixtures.decisionDetail();
        setDecision(fixture);
        setIsFixturePreview(true);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load fixture'));
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const res = await api.getDecision(decisionId);
      setDecision(res);
      setIsFixturePreview(false);
    } catch (err) {
      if (err instanceof ApiNotImplementedError) {
        setIsNotImplemented(true);
      }
      setError(err instanceof Error ? err : new Error('Failed to load decision detail'));
      setDecision(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDecision();
  }, [decisionId]);

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Back link */}
      <div>
        <Link
          href="/decisions"
          className="text-xs font-mono text-slate-400 hover:text-emerald-400 inline-flex items-center gap-1.5 transition-colors"
        >
          ← Back to Decision Explorer
        </Link>
      </div>

      {/* Prominent Sample Fixture Disclaimer Banner */}
      {isFixturePreview && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-5 font-mono text-xs text-amber-200 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-amber-300">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400"></span>
              SAMPLE CONTRACT FIXTURE (PREVIEW ONLY — NOT LIVE DATA)
            </div>
            <button
              onClick={() => {
                setDecision(null);
                setIsFixturePreview(false);
                loadDecision(false);
              }}
              className="text-[11px] text-amber-300 hover:text-amber-100 underline"
            >
              Exit preview &amp; check live backend
            </button>
          </div>
          <p className="text-[11px] text-amber-200/90 leading-relaxed font-sans">
            The backend endpoint{' '}
            <code className="text-amber-300 font-mono">GET /api/decisions/:id</code> returned{' '}
            <strong>HTTP 501 (Not Implemented)</strong>. The decision, alternatives, quotes, and
            code connections displayed below are static sample data from{' '}
            <code className="text-amber-300 font-mono">
              shared/fixtures/api/decision_detail.json
            </code>{' '}
            to demonstrate layout and Evidence Lock formatting. They do <strong>not</strong>{' '}
            represent verified results from a live repository.
          </p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}

      {/* Error state */}
      {error && !isFixturePreview && (
        <ErrorAlert
          error={error}
          isNotImplemented={isNotImplemented}
          onRetry={() => loadDecision(false)}
          onPreviewFixture={() => loadDecision(true)}
          title={
            isNotImplemented
              ? 'Decision Detail API In Development (Phase 2)'
              : 'Failed to Load Decision Detail'
          }
        />
      )}

      {/* Hero Content */}
      {decision && (
        <div className="space-y-8">
          {/* Header Card */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={decision.status} />
                <Badge variant={decision.lifecycle === 'active' ? 'active' : 'superseded'}>
                  Lifecycle: {decision.lifecycle}
                </Badge>
                {isFixturePreview && (
                  <span className="rounded bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-xs font-mono text-amber-300">
                    Sample Contract Fixture
                  </span>
                )}
                <span className="text-xs font-mono text-slate-500">Record ID #{decision.id}</span>
              </div>

              {decision.sourceUrl && (
                <a
                  href={decision.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-mono transition-colors"
                >
                  <span>Discussion Source</span>
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-100">
                  {decision.title}
                </h1>
                {isFixturePreview && (
                  <span className="text-xs font-mono text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded">
                    [Preview Data]
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm text-slate-300 leading-relaxed max-w-3xl">
                {decision.summary}
              </p>
            </div>

            <div className="text-xs font-mono text-slate-500 flex items-center gap-2">
              <span>Source Thread:</span>
              <span className="text-slate-300">{decision.sourceTitle}</span>
            </div>
          </div>

          {/* Confidence Meter Card */}
          <ConfidenceMeter
            confidence={decision.confidence}
            parts={decision.confidenceParts}
            isSampleData={isFixturePreview}
          />

          {/* Section 1: Decision Evidence */}
          {decision.decisionEvidence && decision.decisionEvidence.length > 0 && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 space-y-4">
              <EvidenceLedger
                evidenceList={decision.decisionEvidence}
                title="Accepted Decision Evidence"
                isSampleData={isFixturePreview}
              />
            </div>
          )}

          {/* Section 2: Accepted vs Rejected Alternatives */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">
                Alternatives &amp; Rejection Analysis
              </h3>
              {isFixturePreview && (
                <span className="text-xs font-mono text-amber-400/80">
                  (Sample Alternative Records)
                </span>
              )}
            </div>
            <AlternativesList
              alternatives={decision.alternatives}
              isSampleData={isFixturePreview}
            />
          </div>

          {/* Section 3: Code Connections */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 space-y-4">
            <CodeConnections files={decision.files} isSampleData={isFixturePreview} />
          </div>

          {/* Section 4: Timeline & Events */}
          {decision.events && decision.events.length > 0 && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 space-y-4">
              <TimelineTrail events={decision.events} />
            </div>
          )}

          {/* Section 5: Relationships */}
          {decision.relationships && decision.relationships.length > 0 && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
                Related Historical Decisions ({decision.relationships.length})
              </h4>
              <div className="space-y-2">
                {decision.relationships.map((rel, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded border border-slate-800 bg-slate-950 font-mono text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="tech">{rel.type}</Badge>
                      <span className="text-slate-300">Target Decision #{rel.otherId}</span>
                    </div>
                    <Link
                      href={`/decisions/${rel.otherId}`}
                      className="text-emerald-400 hover:text-emerald-300"
                    >
                      Inspect →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
