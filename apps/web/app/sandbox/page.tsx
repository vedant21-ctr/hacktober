'use client';

import React, { useState } from 'react';
import { api, ApiNotImplementedError } from '../../lib/api';
import type { PriorArtReport, PriorArtRequest } from '@decisionvault/shared/api';
import type { PriorArtInputType } from '@decisionvault/shared/enums';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { ErrorAlert } from '../../components/ui/ErrorAlert';
import { PriorArtWarningCard } from '../../components/sandbox/PriorArtWarningCard';

export default function SandboxPage() {
  const [inputType, setInputType] = useState<PriorArtInputType>('idea');
  const [inputValue, setInputValue] = useState(
    'Propose re-adding or maintaining the cgi standard library module for lightweight Python scripts.',
  );
  const [submitting, setSubmitting] = useState(false);
  const [report, setReport] = useState<PriorArtReport | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isNotImplemented, setIsNotImplemented] = useState(false);
  const [isFixturePreview, setIsFixturePreview] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    setSubmitting(true);
    setError(null);
    setIsNotImplemented(false);
    setReport(null);
    setIsFixturePreview(false);

    try {
      const req: PriorArtRequest = {
        repoId: 1,
        input: {
          type: inputType,
          value: inputValue.trim(),
        },
      };
      // In Phase 1/2A, backend will return 501
      const res = await api.checkPriorArt(req);
      // If 202 is returned, fetch the report
      const rep = await api.getPriorArtReport(res.jobId);
      setReport(rep);
    } catch (err) {
      if (err instanceof ApiNotImplementedError) {
        setIsNotImplemented(true);
      }
      setError(err instanceof Error ? err : new Error('Prior art check failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePreviewFixture = () => {
    setError(null);
    setIsNotImplemented(false);
    try {
      const fixture = api.fixtures.priorArtReport();
      setReport(fixture);
      setIsFixturePreview(true);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load fixture'));
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400 mb-3 font-mono">
          Radar &amp; Decision Support
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-100 sm:text-3xl">
          Prior-Decision Warning &amp; Sandbox
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed max-w-2xl">
          Test proposed engineering ideas, PRs, or git diffs against historical repository decisions
          before re-litigating settled debates or proposing previously rejected alternatives.
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400 mr-2">
              Input Mode:
            </span>
            {(['idea', 'pr', 'diff'] as PriorArtInputType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setInputType(type)}
                className={`px-3 py-1 rounded text-xs font-mono font-medium transition-colors ${
                  inputType === type
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                {type.toUpperCase()}
              </button>
            ))}
          </div>

          <div>
            <label
              htmlFor="proposal-input"
              className="block text-xs font-semibold text-slate-200 uppercase font-mono tracking-wider mb-2"
            >
              {inputType === 'idea'
                ? 'Proposal Description / Architectural Idea'
                : inputType === 'pr'
                  ? 'GitHub PR Number or URL'
                  : 'Git Diff / Patch'}
            </label>
            <textarea
              id="proposal-input"
              rows={4}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                inputType === 'idea'
                  ? 'Describe the technical proposal or change...'
                  : inputType === 'pr'
                    ? 'e.g. 10452 or https://github.com/python/cpython/pull/10452'
                    : 'diff --git a/Lib/cgi.py b/Lib/cgi.py...'
              }
              className="w-full rounded-md border border-slate-700 bg-slate-950 p-3 text-xs text-slate-100 font-mono placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none leading-relaxed"
            />
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="text-[11px] text-slate-500 font-mono">
              Evaluated strictly for decision support. Code is never executed.
            </span>
            <button
              type="submit"
              disabled={submitting || !inputValue.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            >
              {submitting && <Spinner size="sm" />}
              {submitting ? 'Analyzing History...' : 'Evaluate Against History'}
            </button>
          </div>
        </form>
      </Card>

      {/* Prominent Sample Fixture Disclaimer Banner */}
      {isFixturePreview && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-5 font-mono text-xs text-amber-200 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-amber-300">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400"></span>
              SAMPLE CONTRACT FIXTURE (PREVIEW ONLY — NOT LIVE WARNING)
            </div>
            <button
              onClick={() => {
                setReport(null);
                setIsFixturePreview(false);
              }}
              className="text-[11px] text-amber-300 hover:text-amber-100 underline"
            >
              Exit preview &amp; clear data
            </button>
          </div>
          <p className="text-[11px] text-amber-200/90 leading-relaxed font-sans">
            The backend endpoint{' '}
            <code className="text-amber-300 font-mono">POST /api/sandbox/prior-art</code> returned{' '}
            <strong>HTTP 501 (Not Implemented)</strong>. The Prior Art Report and warning items
            below are loaded from{' '}
            <code className="text-amber-300 font-mono">
              shared/fixtures/api/prior_art_report.json
            </code>{' '}
            to demonstrate how recovered historical decisions and reconsider-if conditions will
            surface when Phase 2 sandbox evaluation is live.
          </p>
        </div>
      )}

      {/* Error state */}
      {error && !isFixturePreview && (
        <ErrorAlert
          error={error}
          isNotImplemented={isNotImplemented}
          onRetry={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
          onPreviewFixture={handlePreviewFixture}
          title={
            isNotImplemented
              ? 'Prior Art Sandbox In Development (Phase 2)'
              : 'Prior Art Analysis Failed'
          }
        />
      )}

      {/* Report Display */}
      {report && (
        <div className="space-y-6 pt-2">
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  Prior Art Report #{report.id}
                </span>
                {isFixturePreview && (
                  <span className="rounded bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-xs font-mono text-amber-300">
                    Sample Contract Preview
                  </span>
                )}
              </div>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-mono text-slate-300">
                Input: {report.input.type}
              </span>
            </div>

            <p className="text-xs text-slate-300 font-mono italic bg-slate-950 p-2.5 rounded border border-slate-800/80">
              &ldquo;{report.input.summary}&rdquo;
            </p>

            {/* Extracted Concepts */}
            {report.concepts.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span className="text-[11px] font-mono text-slate-500 uppercase">
                  Extracted Concepts:
                </span>
                {report.concepts.map((concept, idx) => (
                  <span
                    key={idx}
                    className="rounded bg-slate-800/80 px-2 py-0.5 text-xs text-slate-300 font-mono border border-slate-700/60"
                  >
                    {concept}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Warning Cards List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 font-mono">
                Historical Precedents &amp; Warnings ({report.items.length})
              </h3>
              {isFixturePreview && (
                <span className="text-xs font-mono text-amber-400/80">(Sample Precedents)</span>
              )}
            </div>
            {report.items.map((item, idx) => (
              <PriorArtWarningCard
                key={idx}
                item={item}
                affectedFiles={report.changedPaths}
                isSampleData={isFixturePreview}
              />
            ))}
          </div>

          {report.note && (
            <div className="p-4 rounded border border-slate-800 bg-slate-900/20 text-xs text-slate-400 leading-relaxed font-mono">
              <span className="text-slate-300 font-semibold uppercase block mb-1">
                Advisory Note:
              </span>
              {report.note}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
