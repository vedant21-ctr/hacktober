import React from 'react';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 animate-fade-in">
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-mono text-emerald-400 mb-6">
        <span>404</span>
        <span className="text-slate-600">•</span>
        <span>Route Not Found</span>
      </div>

      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-vault-text mb-3">
        404 — Page Not Found
      </h1>

      <p className="max-w-md text-sm text-vault-text-muted leading-relaxed mb-8">
        The requested URL was not found in the DecisionVault index. It may have been moved, renamed,
        or does not exist in the active workspace.
      </p>

      <div className="flex items-center gap-3">
        <a
          href="/"
          className="rounded-lg bg-emerald-500 text-slate-950 font-medium text-xs px-4 py-2 hover:bg-emerald-400 transition-colors shadow-sm"
        >
          Return to Overview
        </a>
        <a
          href="/decisions"
          className="rounded-lg border border-vault-border bg-vault-surface px-4 py-2 text-xs font-medium text-vault-text-muted hover:text-vault-text hover:border-vault-border-bright transition-colors"
        >
          Explore Decisions
        </a>
      </div>
    </div>
  );
}
