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
    sm: 'h-3 w-3 border',
    md: 'h-5 w-5 border-2',
    lg: 'h-8 w-8 border-2',
  };

  return (
    <div className="flex items-center gap-3">
      <div
        className={`animate-spin rounded-full border-vault-accent/60 border-t-transparent ${sizeClasses[size]}`}
      />
      {label && <span className="text-xs font-mono text-vault-text-muted">{label}</span>}
    </div>
  );
}

export function PageLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <LoadingSpinner size="lg" />
      <p className="text-sm font-mono text-vault-text-muted">{message}</p>
    </div>
  );
}

export function SkeletonLine({ width = 'full' }: { width?: string }) {
  return (
    <div
      className={`h-3 rounded bg-vault-border animate-pulse`}
      style={{ width: width === 'full' ? '100%' : width }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-vault-border bg-vault-surface/40 p-5 space-y-3 animate-pulse">
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
    <div className="rounded-lg border border-vault-rose/30 bg-vault-rose/5 p-6 animate-fade-in">
      <div className="flex items-start gap-3">
        <span className="text-vault-rose text-lg mt-0.5">⚠</span>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-vault-rose">{title}</h3>
          <p className="mt-1 text-xs text-vault-text-muted leading-relaxed">{message}</p>
          {code && (
            <span className="mt-2 inline-block rounded bg-vault-surface px-2 py-0.5 text-[10px] font-mono text-vault-text-dim">
              {code}
            </span>
          )}
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 rounded bg-vault-surface px-3 py-1.5 text-xs font-medium text-vault-text hover:bg-vault-border transition-colors"
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
    <div className="rounded-lg border border-dashed border-vault-border bg-vault-surface/20 p-10 text-center animate-fade-in">
      {icon && <div className="text-3xl mb-3">{icon}</div>}
      <h3 className="text-sm font-semibold text-vault-text">{title}</h3>
      <p className="mt-1 text-xs text-vault-text-dim leading-relaxed max-w-md mx-auto">
        {description}
      </p>
      {action &&
        (action.href ? (
          <a
            href={action.href}
            className="mt-4 inline-block rounded bg-vault-accent/10 border border-vault-accent/30 px-4 py-2 text-xs font-semibold text-vault-accent hover:bg-vault-accent/20 transition-colors"
          >
            {action.label}
          </a>
        ) : (
          <button
            onClick={action.onClick}
            className="mt-4 rounded bg-vault-accent/10 border border-vault-accent/30 px-4 py-2 text-xs font-semibold text-vault-accent hover:bg-vault-accent/20 transition-colors"
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
    deprecated: 'bg-slate-500/10 border-slate-500/30 text-slate-400',
    superseded: 'bg-sky-500/10 border-sky-500/30 text-sky-400',
  };

  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${styles[status] || styles.unresolved}`}
    >
      {status}
    </span>
  );
}

export function LifecycleBadge({ lifecycle }: { lifecycle: string }) {
  if (lifecycle === 'superseded') {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-sky-500/10 border border-sky-500/20 text-sky-400">
        SUPERSEDED
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
      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
        <span className="text-emerald-400">✓</span> VERIFIED EXACT
      </span>
    );
  }
  if (verified && method === 'fuzzy') {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-sky-500/15 border border-sky-500/40 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
        ≈ FUZZY ({(score * 100).toFixed(0)}%)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-vault-surface border border-vault-border px-2 py-0.5 text-[10px] font-medium text-vault-text-dim">
      ○ UNVERIFIED
    </span>
  );
}

export function ConfidenceMeter({ value, size = 'sm' }: { value: number; size?: 'sm' | 'md' }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500';
  const textColor = pct >= 70 ? 'text-emerald-400' : pct >= 40 ? 'text-amber-400' : 'text-rose-400';
  const height = size === 'md' ? 'h-2' : 'h-1.5';

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 rounded-full bg-vault-border ${height} overflow-hidden`}>
        <div
          className={`${color} ${height} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-[10px] font-mono font-semibold ${textColor}`}>{pct}%</span>
    </div>
  );
}

// ─── File Link Kind Badge ────────────────────────────────────────────────────

export function LinkKindBadge({ kind }: { kind: string }) {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    pr_diff: {
      bg: 'bg-emerald-500/10 border-emerald-500/30',
      text: 'text-emerald-400',
      label: 'PR DIFF',
    },
    mentioned: {
      bg: 'bg-vault-surface border-vault-border',
      text: 'text-vault-text-dim',
      label: 'MENTIONED',
    },
    rename_tracked: {
      bg: 'bg-sky-500/10 border-sky-500/30',
      text: 'text-sky-400',
      label: 'RENAME TRACKED',
    },
    symbol: {
      bg: 'bg-violet-500/10 border-violet-500/30',
      text: 'text-violet-400',
      label: 'SYMBOL',
    },
  };

  const style = styles[kind] || styles.mentioned;

  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${style.bg} ${style.text}`}
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
          <h2 className="text-xs font-mono uppercase tracking-widest text-vault-text-dim font-semibold">
            {title}
          </h2>
          {count !== undefined && (
            <span className="rounded bg-vault-surface px-1.5 py-0.5 text-[10px] font-mono text-vault-text-muted">
              {count}
            </span>
          )}
        </div>
        {subtitle && <p className="mt-0.5 text-[11px] text-vault-text-dim">{subtitle}</p>}
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
      className={`rounded-lg border border-vault-border bg-vault-surface/40 ${
        hover
          ? 'hover:border-vault-border-bright hover:bg-vault-surface/70 cursor-pointer transition-all duration-200'
          : ''
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
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-5 animate-fade-in">
      <div className="flex items-start gap-3">
        <span className="text-amber-400 text-sm mt-0.5 font-mono">◊</span>
        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold">
            {feature} — Backend Under Development
          </h3>
          <p className="mt-1 text-xs text-vault-text-dim leading-relaxed">
            {description ||
              "This feature's API endpoint is not yet implemented. The interface is ready and will connect automatically when the backend is available."}
          </p>
          <div className="mt-2 flex items-center gap-2 text-[10px] font-mono text-vault-text-dim">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500/50" />
            <span>Returns HTTP 501 NOT_IMPLEMENTED</span>
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
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-vault-text">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-vault-text-muted leading-relaxed">{subtitle}</p>
        )}
        {badge && (
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-vault-accent/20 bg-vault-accent/5 px-3 py-1 text-[10px] font-mono font-medium text-vault-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-vault-accent" />
            {badge}
          </div>
        )}
      </div>
      {actions && <div className="flex items-center gap-3 flex-shrink-0">{actions}</div>}
    </div>
  );
}
