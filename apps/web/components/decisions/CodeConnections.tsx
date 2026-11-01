import React from 'react';
import type { DecisionFile } from '@decisionvault/shared/api';
import { LinkKindBadge } from '../ui/Badge';

interface CodeConnectionsProps {
  files: DecisionFile[];
  isSampleData?: boolean;
}

export function CodeConnections({ files, isSampleData = false }: CodeConnectionsProps) {
  if (!files || files.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/20 p-6 text-center text-xs text-slate-500">
        No code files linked to this decision.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
            Linked Code Paths ({files.length})
          </h4>
          {isSampleData && (
            <span className="rounded bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-mono text-amber-300">
              Sample Fixture
            </span>
          )}
        </div>
        <span className="text-[11px] text-slate-500 font-mono">
          {isSampleData
            ? 'Sample linked paths for demonstration'
            : 'Deterministic path attribution with rename tracking'}
        </span>
      </div>

      <div className="divide-y divide-slate-800/80 rounded-lg border border-slate-800 bg-slate-950/60 overflow-hidden">
        {files.map((file, idx) => (
          <div key={idx} className="p-4 space-y-2 hover:bg-slate-900/30 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold text-slate-200 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  {file.path}
                </span>

                {file.currentPath && file.currentPath !== file.path && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-cyan-400">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14 5l7 7m0 0l-7 7m7-7H3"
                      />
                    </svg>
                    HEAD: {file.currentPath}
                  </span>
                )}

                {file.currentPath === null && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-rose-400/80 bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-900/40">
                    Removed at HEAD
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <LinkKindBadge kind={file.linkKind} />
                {file.commitSha && (
                  <span
                    title={`Linked commit: ${file.commitSha}`}
                    className="font-mono text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800"
                  >
                    sha: {file.commitSha.slice(0, 7)}
                  </span>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              <span className="text-[11px] font-mono uppercase text-slate-500 mr-1.5">Basis:</span>
              {file.basis}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
