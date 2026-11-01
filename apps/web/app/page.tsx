'use client';

import React from 'react';
import Link from 'next/link';
import { OverviewClient } from '../components/overview/OverviewClient';

export default function HomePage() {
  return (
    <div className="space-y-8">
      {/* Product Hero & Header */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-medium mb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
              Phase 3B: Gemma 4 E4B Decision Extraction
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100">
              DecisionVault
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Engineering decision intelligence and knowledge recovery platform. Recovers historical
              technical consensus, grounds accepted and rejected alternatives in verbatim source
              evidence, and monitors constraint health.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5 sm:self-end">
            <Link
              href="/decisions"
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-emerald-500 transition-colors shadow-sm"
            >
              <span>Explore Recovered Decisions</span>
              <span>→</span>
            </Link>
            <Link
              href="/import"
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 border border-slate-800 hover:border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:text-slate-100 transition-colors"
            >
              <span>Repository Ingestion</span>
            </Link>
            <Link
              href="/sandbox"
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 border border-slate-800 hover:border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:text-slate-100 transition-colors"
            >
              <span>Prior-Decision Warning</span>
            </Link>
          </div>
        </div>

        {/* Architecture & Engineering Foundation Strip */}
        <div className="rounded-lg border border-slate-800/80 bg-[#0e1424]/50 p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            <span className="text-slate-200 font-medium">Local AI Architecture:</span>
            <span>
              Private offline Ollama runtime with{' '}
              <code className="font-mono text-emerald-400 font-medium text-[11px]">gemma4:e4b</code>
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>Deterministic Evidence Lock</span>
            <span className="text-slate-700">•</span>
            <span>SQLite FTS5 Full-Text Sync</span>
            <span className="text-slate-700">•</span>
            <span>Zero Cloud AI Dependencies</span>
          </div>
        </div>
      </div>

      {/* Main Overview Dashboard Client */}
      <OverviewClient />
    </div>
  );
}
