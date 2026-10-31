import React from 'react';

export default function HomePage() {
  return (
    <div className="py-12 max-w-3xl">
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

      <div className="mt-6">
        <a
          href="/import"
          className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors"
        >
          <span>Go to Repository Ingestion</span>
          <span>→</span>
        </a>
      </div>

      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            Gemma 4 E4B (<code>gemma4:e4b</code>) via local Ollama. Zero cloud AI dependencies,
            fully private and reproducible.
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-slate-800 bg-slate-900/20 p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Implementation Scope Status
        </h3>
        <ul className="mt-3 space-y-2 text-xs text-slate-400">
          <li className="flex items-center gap-2 text-slate-300">
            <span className="text-emerald-400">✓</span> Shared types, Zod schemas, and enums
          </li>
          <li className="flex items-center gap-2 text-slate-300">
            <span className="text-emerald-400">✓</span> SQLite database schema with FTS5
            synchronization
          </li>
          <li className="flex items-center gap-2 text-slate-300">
            <span className="text-emerald-400">✓</span> REST API contract fixtures
          </li>
          <li className="flex items-center gap-2 text-slate-300">
            <span className="text-emerald-400">✓</span> Express server scaffold &amp; Next.js
            rewrite proxy
          </li>
          <li className="flex items-center gap-2 text-slate-400">
            <span className="text-slate-600">○</span> Pipeline ingestion &amp; extraction (Phase 2)
          </li>
        </ul>
      </div>
    </div>
  );
}
