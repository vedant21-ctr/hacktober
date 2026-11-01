'use client';

import React from 'react';
import { OverviewClient } from '../components/overview/OverviewClient';

export default function HomePage() {
  return (
    <div className="space-y-8">
      {/* Header Info Banner */}
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 mb-3">
          <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
          Phase 1: Contract Freeze &amp; Runnable Scaffold
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 sm:text-4xl">
          DecisionVault
        </h1>
        <p className="mt-2 text-sm text-slate-400 max-w-2xl leading-relaxed">
          Open Source Decision Intelligence and Knowledge Recovery. Recovers engineering decisions,
          grounds accepted and rejected alternatives in verbatim source evidence, and tracks
          historical constraints.
        </p>

        {/* Navigation Quick Links */}
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href="/decisions"
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors"
          >
            <span>Explore Recovered Decisions</span>
            <span>→</span>
          </a>
          <a
            href="/import"
            className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <span>Repository Ingestion</span>
          </a>
          <a
            href="/sandbox"
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <span>Prior-Decision Warning Sandbox</span>
          </a>
        </div>
      </div>

      {/* Architecture & Freeze Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
            Contract Freeze Active
          </h2>
          <p className="mt-1.5 text-xs text-slate-400 leading-normal">
            API schemas, SQLite schema with FTS5 synchronization, and Pass A/B Gemma schemas are
            frozen under CONTRACT_VERSION 1.
          </p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
            Local AI Architecture
          </h2>
          <p className="mt-1.5 text-xs text-slate-400 leading-normal">
            Local Ollama runtime with Gemma 4 E4B (<code>gemma4:e4b</code>). Zero cloud AI
            dependencies, fully private and reproducible.
          </p>
        </div>
      </div>

      {/* System Status Tracker */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/20 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
          Implementation Scope Status
        </h3>
        <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
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

      {/* Main Overview Dashboard Client */}
      <OverviewClient />
    </div>
  );
}
