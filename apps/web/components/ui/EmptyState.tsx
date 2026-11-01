import React from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-slate-800/80 bg-[#0e1424]/40 p-10 text-center">
      {icon ? (
        <div className="mx-auto flex h-10 w-10 items-center justify-center text-slate-500 mb-3">
          {icon}
        </div>
      ) : (
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-800/50 text-slate-400 mb-3">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        </div>
      )}
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">{description}</p>
      {action && (
        <div className="mt-4">
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition-colors shadow-sm"
          >
            {action.label}
          </button>
        </div>
      )}
    </div>
  );
}
