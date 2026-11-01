/**
 * Reusable UI components for DecisionVault
 */
'use client';

import React from 'react';

// ─── Loading States ──────────────────────────────────────────────────────────

export function LoadingSpinner({
  size = 'md',
  label,
}: {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}) {
  const sizeClasses = {
    sm: 'h-3.5 w-3.5 border-2',
    md: 'h-5 w-5 border-2',
    lg: 'h-7 w-7 border-2',
  };

  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`animate-spin rounded-full border-slate-700/80 border-t-emerald-400 ${sizeClasses[size]}`}
      />
      {label && <span className="text-xs text-slate-400 font-medium">{label}</span>}
    </div>
  );
}

export function PageLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <LoadingSpinner size="lg" />
      <p className="text-xs text-slate-400 font-medium">{message}</p>
    </div>
  );
}

export function SkeletonLine({ width = 'full' }: { width?: string }) {
  return (
    <div
      className="h-3 rounded bg-slate-800/60 animate-pulse"
      style={{ width: width === 'full' ? '100%' : width }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-slate-800/70 bg-[#0e1424]/60 p-5 space-y-3 animate-pulse">
      <SkeletonLine width="60%" />
      <SkeletonLine width="100%" />
      <SkeletonLine width="40%" />
    </div>
  );
}

// ─── Error States ────────────────────────────────────────────────────────────

export function ErrorDisplay({
  title = 'Error',
  message,
  onRetry,
  code,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  code?: string;
}) {
  return (
    <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 p-5 animate-fade-in">
      <div className="flex items-start gap-3">
        <span className="text-rose-400 text-base mt-0.5">⚠</span>
        <div className="flex-1">
          <h3 className="text-xs font-semibold text-rose-300">{title}</h3>
          <p className="mt-1 text-xs text-rose-200/80 leading-relaxed">{message}</p>
          {code && (
            <span className="mt-2 inline-block rounded bg-slate-900/80 px-2 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-800">
              {code}
            </span>
          )}
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 rounded bg-rose-600/30 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-600/40 border border-rose-500/35 transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Empty States ────────────────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description: string;
  action?: { label: string; href?: string; onClick?: () => void };
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-800/80 bg-[#0e1424]/40 p-10 text-center animate-fade-in">
      {icon && <div className="text-2xl mb-2 text-slate-500 font-mono">{icon}</div>}
      <h3 className="text-xs font-semibold text-slate-200">{title}</h3>
      <p className="mt-1 text-xs text-slate-400 leading-relaxed max-w-md mx-auto">{description}</p>
      {action &&
        (action.href ? (
          <a
            href={action.href}
            className="mt-4 inline-block rounded-md bg-emerald-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition-colors shadow-sm"
          >
            {action.label}
          </a>
        ) : (
          <button
            onClick={action.onClick}
            className="mt-4 rounded-md bg-emerald-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition-colors shadow-sm"
          >
            {action.label}
          </button>
        ))}
    </div>
  );
}

// ─── Status Badges ───────────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    accepted: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    rejected: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
    unresolved: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    deprecated: 'bg-slate-800/60 border-slate-700/60 text-slate-400',
    superseded: 'bg-slate-800/60 border-slate-700/60 text-slate-400 line-through',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium border ${styles[status] || styles.unresolved}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === 'accepted'
            ? 'bg-emerald-400'
            : status === 'rejected'
              ? 'bg-rose-400'
              : 'bg-amber-400'
        }`}
      />
      <span className="capitalize">{status}</span>
    </span>
  );
}

export function LifecycleBadge({ lifecycle }: { lifecycle: string }) {
  if (lifecycle === 'superseded') {
    return (
      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium bg-slate-800/60 border border-slate-700 text-slate-400 line-through">
        Superseded
      </span>
    );
  }
  return null;
}

export function EvidenceChip({
  verified,
  method,
  score,
}: {
  verified: boolean;
  method: string;
  score: number;
}) {
  if (verified && method === 'normalized_exact') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
        <span className="text-emerald-400">✓</span> Evidence Locked (Exact)
      </span>
    );
  }
  if (verified && method === 'fuzzy') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[11px] font-medium text-amber-300">
        ≈ Approximate ({(score * 100).toFixed(0)}%)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 text-[11px] font-medium text-rose-400">
      ○ Unverified Claim
    </span>
  );
}

export function ConfidenceMeter({ value, size = 'sm' }: { value: number; size?: 'sm' | 'md' }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-rose-500';
  const textColor = pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-amber-400' : 'text-rose-400';
  const height = size === 'md' ? 'h-2' : 'h-1.5';

  return (
    <div className="flex items-center gap-2 font-mono">
      <div className={`w-16 rounded-full bg-slate-800 ${height} overflow-hidden`}>
        <div
          className={`${color} ${height} transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-[11px] font-medium ${textColor}`}>{pct}%</span>
    </div>
  );
}

// ─── File Link Kind Badge ────────────────────────────────────────────────────

export function LinkKindBadge({ kind }: { kind: string }) {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    pr_diff: {
      bg: 'bg-slate-800/80 border-slate-700/80',
      text: 'text-slate-300',
      label: 'PR Diff',
    },
    mentioned: {
      bg: 'bg-slate-900 border-slate-800',
      text: 'text-slate-400',
      label: 'Mentioned',
    },
    rename_tracked: {
      bg: 'bg-emerald-500/10 border-emerald-500/30',
      text: 'text-emerald-400',
      label: 'Rename Tracked',
    },
    symbol: {
      bg: 'bg-slate-800/80 border-slate-700/80',
      text: 'text-slate-300',
      label: 'Symbol',
    },
  };

  const style = styles[kind] || styles.mentioned;

  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono border ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}

// ─── Section Header ──────────────────────────────────────────────────────────

export function SectionHeader({
  title,
  count,
  subtitle,
  action,
}: {
  title: string;
  count?: number;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
            {title}
          </h2>
          {count !== undefined && (
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-300">
              {count}
            </span>
          )}
        </div>
        {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ─── Card Component ──────────────────────────────────────────────────────────

export function Card({
  children,
  className = '',
  hover = false,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className={`rounded-lg border border-slate-800/70 bg-[#0e1424]/70 ${
        hover ? 'hover:border-slate-700/80 hover:bg-[#131b2e] cursor-pointer transition-colors' : ''
      } ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// ─── Not Implemented Banner ──────────────────────────────────────────────────

export function NotImplementedBanner({
  feature,
  description,
}: {
  feature: string;
  description?: string;
}) {
  return (
    <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-4 animate-fade-in">
      <div className="flex items-start gap-3">
        <span className="text-amber-400 text-xs mt-0.5 font-mono">◊</span>
        <div>
          <h3 className="text-xs font-semibold text-amber-300 font-mono">
            {feature} — Backend Under Development
          </h3>
          <p className="mt-1 text-xs text-amber-200/80 leading-relaxed">
            {description ||
              "This feature's API endpoint is not yet implemented. The interface will connect automatically when the backend is available."}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-mono text-amber-400/70">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400/60" />
            <span>HTTP 501 Not Implemented</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export const FeatureNotice = NotImplementedBanner;

// ─── Page Title ──────────────────────────────────────────────────────────────

export function PageTitle({
  title,
  subtitle,
  badge,
  actions,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
      <div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">{title}</h1>
          {badge && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {badge}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="mt-1.5 text-xs text-slate-400 leading-relaxed max-w-3xl">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2.5 flex-shrink-0">{actions}</div>}
    </div>
  );
}
