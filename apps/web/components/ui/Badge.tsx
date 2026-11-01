import React from 'react';
import type {
  DecisionStatus,
  Lifecycle,
  HealthState,
  VerificationMethod,
  DecisionFileLinkKind,
} from '@decisionvault/shared/enums';

interface BadgeProps {
  children?: React.ReactNode;
  variant?:
    | 'default'
    | 'accepted'
    | 'rejected'
    | 'unresolved'
    | 'active'
    | 'superseded'
    | 'holds'
    | 'may_not_hold'
    | 'unknown'
    | 'verified'
    | 'approximate'
    | 'unverified'
    | 'tech';
  className?: string;
}

const variantStyles: Record<string, string> = {
  default: 'bg-slate-800 text-slate-300 border-slate-700',
  accepted: 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60 font-semibold',
  rejected: 'bg-rose-950/70 text-rose-300 border-rose-700/60 font-semibold',
  unresolved: 'bg-amber-950/70 text-amber-300 border-amber-700/60 font-semibold',
  active: 'bg-blue-950/50 text-blue-300 border-blue-700/50',
  superseded: 'bg-slate-900 text-slate-400 border-slate-800 line-through',
  holds: 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60',
  may_not_hold: 'bg-amber-950/70 text-amber-300 border-amber-600/70 font-semibold animate-pulse',
  unknown: 'bg-slate-800 text-slate-400 border-slate-700',
  verified: 'bg-emerald-900/50 text-emerald-300 border-emerald-600/60',
  approximate: 'bg-amber-900/50 text-amber-300 border-amber-600/60',
  unverified: 'bg-rose-950/50 text-rose-400 border-rose-800/60',
  tech: 'bg-slate-900 text-cyan-300 border-cyan-800/40 font-mono',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  const style = variantStyles[variant] || variantStyles.default;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs border ${style} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: DecisionStatus }) {
  if (status === 'accepted') {
    return (
      <Badge variant="accepted">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
        Accepted
      </Badge>
    );
  }
  if (status === 'rejected') {
    return (
      <Badge variant="rejected">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-400"></span>
        Rejected
      </Badge>
    );
  }
  return (
    <Badge variant="unresolved">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
      Unresolved
    </Badge>
  );
}

export function VerificationBadge({
  verified,
  method,
  score,
}: {
  verified: boolean;
  method: VerificationMethod;
  score?: number;
}) {
  if (verified && method === 'normalized_exact') {
    return (
      <Badge variant="verified">
        <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
        Evidence Locked (Exact)
      </Badge>
    );
  }
  if (verified && method === 'fuzzy') {
    return (
      <Badge variant="approximate">
        <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        Approximate ({score ? Math.round(score * 100) : 90}%)
      </Badge>
    );
  }
  return (
    <Badge variant="unverified">
      <svg className="w-3.5 h-3.5 text-rose-400" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clipRule="evenodd"
        />
      </svg>
      Unverified Claim
    </Badge>
  );
}

export function HealthBadge({ state }: { state: HealthState }) {
  if (state === 'holds') {
    return (
      <Badge variant="holds">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
        Constraint Holds
      </Badge>
    );
  }
  if (state === 'may_not_hold') {
    return (
      <Badge variant="may_not_hold">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
        May Not Hold (Reopen Radar)
      </Badge>
    );
  }
  return (
    <Badge variant="unknown">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-500"></span>
      State Unknown
    </Badge>
  );
}

export function LinkKindBadge({ kind }: { kind: DecisionFileLinkKind }) {
  return <Badge variant="tech">{kind.replace('_', ' ')}</Badge>;
}
