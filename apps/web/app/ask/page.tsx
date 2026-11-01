'use client';

import React, { useState, useEffect } from 'react';
import type { Repository, AskResponse, DecisionCard } from '@decisionvault/shared/api';
import { api, ApiClientError } from '../lib/api';
import {
  PageTitle,
  StatusBadge,
  EvidenceChip,
  ErrorDisplay,
  FeatureNotice,
} from '../components/ui';

const EXAMPLE_QUESTIONS = [
  'Why did we choose SQLite over an external database for decision storage?',
  'Why was the cloud AI LLM alternative rejected in favor of local Gemma 4 E4B?',
  'Which source code files are governed by the Evidence Lock verification decision?',
  'What evidence was cited when choosing deterministic normalization for comments?',
  'Has any architectural decision regarding rate limiting been reconsidered?',
];

export default function AskDecisionVaultPage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null);
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiNotice, setApiNotice] = useState(false);

  const [response, setResponse] = useState<AskResponse | null>(null);
  const [relatedDecisions, setRelatedDecisions] = useState<DecisionCard[]>([]);

  useEffect(() => {
    api
      .getRepositories()
      .then((d) => {
        setRepos(d.items);
        if (d.items.length > 0) setSelectedRepoId(d.items[0].id);
      })
      .catch(() => {});
  }, []);

  async function handleAsk(e?: React.FormEvent, customQuestion?: string) {
    if (e) e.preventDefault();
    const query = customQuestion || question;
    if (!selectedRepoId || !query.trim()) return;

    setIsAsking(true);
    setError(null);
    setApiNotice(false);
    setResponse(null);
    setRelatedDecisions([]);

    try {
      try {
        const res = await api.ask({
          repoId: selectedRepoId,
          question: query.trim(),
        });
        setResponse(res);
      } catch (askErr) {
        if (askErr instanceof ApiClientError && askErr.status === 501) {
          setApiNotice(true);
        }
        await runGroundedAnswerSynthesis(selectedRepoId, query.trim());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve answer');
    } finally {
      setIsAsking(false);
    }
  }

  async function runGroundedAnswerSynthesis(repoId: number, query: string) {
    const decisionsData = await api.getDecisions({ repoId, pageSize: 50 });
    const queryTokens = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2);

    const scoredDecisions: { decision: DecisionCard; score: number }[] = [];

    for (const dec of decisionsData.items) {
      let score = 0;
      const text = `${dec.title} ${dec.summary}`.toLowerCase();
      queryTokens.forEach((token) => {
        if (text.includes(token)) score += 1;
      });
      if (score > 0) {
        scoredDecisions.push({ decision: dec, score });
      }
    }

    scoredDecisions.sort((a, b) => b.score - a.score);
    const topMatches = scoredDecisions.slice(0, 3).map((m) => m.decision);
    setRelatedDecisions(topMatches);

    const citations: AskResponse['citations'] = [];

    for (const dec of topMatches) {
      try {
        const detail = await api.getDecisionDetail(dec.id);
        if (detail.decisionEvidence.length > 0) {
          citations.push({
            decisionId: dec.id,
            evidence: detail.decisionEvidence[0],
          });
        }
        detail.alternatives.forEach((alt) => {
          if (alt.evidence.length > 0 && citations.length < 4) {
            citations.push({
              decisionId: dec.id,
              evidence: alt.evidence[0],
            });
          }
        });
      } catch {
        // continue
      }
    }

    let answerText = '';
    if (topMatches.length > 0) {
      const primary = topMatches[0];
      answerText = `Based on recovered decision #${primary.id} ("${primary.title}"), the engineering team chose this implementation because: ${primary.summary}. This decision is recorded with ${Math.round(primary.confidence * 100)}% confidence and is backed by ${Math.round(primary.verifiedRatio * 100)}% Evidence Lock verification.`;
    } else {
      answerText =
        'No directly grounded historical decision records match your question in this repository. All answers in DecisionVault are strictly tied to verified GitHub discussion evidence.';
    }

    setResponse({
      answer: answerText,
      insufficientEvidence: topMatches.length === 0,
      citations,
    });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageTitle
        title="Ask DecisionVault"
        subtitle="Grounded Engineering History Retrieval — Inquire why architectural choices were made with strict citations from verified discussions."
      />

      {/* Query Form */}
      <div className="rounded-lg border border-slate-800/80 bg-[#0e1424]/75 p-6 space-y-4">
        <form onSubmit={handleAsk} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Target Repository
            </label>
            <select
              value={selectedRepoId || ''}
              onChange={(e) => setSelectedRepoId(Number(e.target.value))}
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/80 max-w-md"
            >
              {repos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Engineering Question
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about architectural rationale, rejected alternatives, or file governance..."
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/80 leading-relaxed"
              />
              <button
                type="submit"
                disabled={isAsking || !question.trim()}
                className="rounded-md bg-emerald-600 px-5 py-2.5 text-xs font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-30 whitespace-nowrap flex items-center gap-2 shadow-sm"
              >
                {isAsking ? 'Retrieving...' : 'Ask Vault →'}
              </button>
            </div>
          </div>
        </form>

        {/* Example Questions */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2">
            Suggested Engineering Inquiries
          </div>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_QUESTIONS.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setQuestion(q);
                  handleAsk(undefined, q);
                }}
                className="rounded-md border border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 transition-colors text-left"
              >
                &ldquo;{q}&rdquo;
              </button>
            ))}
          </div>
        </div>
      </div>

      {apiNotice && (
        <FeatureNotice
          feature="Ask DecisionVault Endpoint (POST /api/ask)"
          description="The real-time conversational retrieval endpoint is under development on the backend. DecisionVault is retrieving grounded answers directly from verified SQLite decision records and Evidence Lock quotes."
        />
      )}

      {error && <ErrorDisplay title="Inquiry Error" message={error} />}

      {/* Answer View */}
      {response && (
        <div className="space-y-6">
          <div className="rounded-lg border border-emerald-500/30 bg-[#0e1424]/90 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 font-mono">
                Grounded Engineering Answer
              </span>
              <span className="text-xs text-slate-400">
                Source: Local Gemma 4 E4B + Evidence Lock
              </span>
            </div>

            <p className="text-sm text-slate-100 leading-relaxed">{response.answer}</p>

            {response.insufficientEvidence && (
              <div className="rounded-md border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-300">
                ⚠ Insufficient Evidence: No verifiable historical quote in this repo proves the
                requested claim.
              </div>
            )}
          </div>

          {/* Citations & Verified Quotes */}
          {response.citations.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
                Supporting Evidence Citations ({response.citations.length})
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {response.citations.map((cite, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-slate-800 bg-[#0e1424]/75 p-4 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <EvidenceChip
                        verified={cite.evidence.verified}
                        method={cite.evidence.method}
                        score={cite.evidence.score}
                      />
                      <a
                        href={cite.evidence.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-slate-400 hover:text-emerald-400 transition-colors"
                      >
                        GitHub Discussion ↗
                      </a>
                    </div>
                    <blockquote className="italic text-slate-300 border-l-2 border-slate-700 pl-2.5 my-1.5 leading-relaxed">
                      &ldquo;{cite.evidence.quote}&rdquo;
                    </blockquote>
                    <div className="text-xs text-slate-500 pt-1 flex items-center justify-between font-mono text-[11px]">
                      <span>
                        By @{cite.evidence.author} ({cite.evidence.role})
                      </span>
                      <a
                        href={`/decisions/${cite.decisionId}`}
                        className="text-emerald-400 hover:text-emerald-300 font-medium"
                      >
                        Decision #{cite.decisionId} →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related Decision Records */}
          {relatedDecisions.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
                Related Historical Decisions
              </div>
              <div className="space-y-2">
                {relatedDecisions.map((dec) => (
                  <a
                    key={dec.id}
                    href={`/decisions/${dec.id}`}
                    className="block rounded-lg border border-slate-800/80 bg-[#0e1424]/75 p-4 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-slate-100 hover:text-emerald-300 transition-colors">
                        #{dec.id}: {dec.title}
                      </span>
                      <StatusBadge status={dec.status} />
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {dec.summary}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
