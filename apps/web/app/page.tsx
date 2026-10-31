'use client';

import React, { useEffect, useState } from 'react';
import type { OverviewResponse } from '@decisionvault/shared/api';

export default function HomePage() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);

  useEffect(() => {
    fetch('/api/overview')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setOverview(data))
      .catch(() => {});
  }, []);

  return (
    <div className="py-12 max-w-4xl">
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 mb-6">
        <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
        Phase 1: Contract Freeze &amp; Runnable Scaffold
      </div>

      <h1 className="text-4xl font-extrabold tracking-tight text-slate-100 sm:text-5xl">
        DecisionVault
      </h1>
      <p className="mt-4 text-lg text-slate-400 leading-relaxed">
        Open Source Decision Intelligence and Knowledge Recovery. Remembers why engineering
        decisions were made, proves them with verified evidence, and preserves rejected alternatives
        from open-source repository discussions.
      </p>

      {/* Navigation Buttons */}
      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href="/decisions"
          className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors"
        >
          <span>View Recovered Decisions</span>
          <span>→</span>
        </a>
        <a
          href="/import"
          className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
        >
          <span>Repository Ingestion</span>
        </a>
      </div>

      {/* Overview Metrics Cards */}
      <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs font-mono text-slate-500 uppercase">Total Sources</div>
          <div className="text-2xl font-bold text-slate-100 mt-1">
            {overview?.counts.sources ?? 0}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs font-mono text-slate-500 uppercase">Decisions</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {overview?.counts.decisions ?? 0}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs font-mono text-slate-500 uppercase">Accepted</div>
          <div className="text-2xl font-bold text-emerald-300 mt-1">
            {overview?.counts.byStatus.accepted ?? 0}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs font-mono text-slate-500 uppercase">Rejected</div>
          <div className="text-2xl font-bold text-rose-400 mt-1">
            {overview?.counts.byStatus.rejected ?? 0}
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5">
          <h2 className="text-sm font-semibold text-slate-200">Contract Freeze Active</h2>
          <p className="mt-1 text-xs text-slate-400 leading-normal">
            API schemas, SQLite schema with FTS5, Gemma Pass A/B output schemas, and API fixtures
            frozen under CONTRACT_VERSION 1.
          </p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5">
          <h2 className="text-sm font-semibold text-slate-200">Local AI Architecture</h2>
          <p className="mt-1 text-xs text-slate-400 leading-normal">
            Gemma 4 E4B (<code>gemma4:e4b</code>) running locally via Ollama. Zero cloud AI
            dependencies, no vector databases, fully private and deterministic.
          </p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5">
          <h2 className="text-sm font-semibold text-slate-200">Deterministic Evidence Lock</h2>
          <p className="mt-1 text-xs text-slate-400 leading-normal">
            Every candidate evidence quote is normalized and checked against original GitHub
            discussion comments. Fabricated or paraphrased claims are rejected.
          </p>
        </div>
      </div>

      {/* Scope Status */}
      <div className="mt-8 rounded-lg border border-slate-800 bg-slate-900/20 p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Implementation Scope Status
        </h3>
        <ul className="mt-3 space-y-2 text-xs text-slate-400">
          <li className="flex items-center gap-2 text-slate-300">
            <span className="text-emerald-400">✓</span> Phase 1: Shared types, Zod schemas, SQLite
            FTS5
          </li>
          <li className="flex items-center gap-2 text-slate-300">
            <span className="text-emerald-400">✓</span> Phase 2A: CI repair, branch coverage &ge;
            70%, CodeQL clean
          </li>
          <li className="flex items-center gap-2 text-slate-300">
            <span className="text-emerald-400">✓</span> Phase 3A: Live GitHub repository ingestion
            pipeline
          </li>
          <li className="flex items-center gap-2 text-slate-300">
            <span className="text-emerald-400">✓</span> Phase 3B: Gemma 4 E4B Decision Extraction
            &amp; Evidence Lock
          </li>
        </ul>
      </div>
    </div>
  );
}
