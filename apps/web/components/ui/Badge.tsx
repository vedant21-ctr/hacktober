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
  default: 'bg-slate-800/60 text-slate-300 border-slate-700/60',
  accepted: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 font-medium',
  rejected: 'bg-rose-500/10 text-rose-300 border-rose-500/30 font-medium',
  unresolved: 'bg-amber-500/10 text-amber-300 border-amber-500/30 font-medium',
  active: 'bg-slate-800/80 text-slate-200 border-slate-700/80',
  superseded: 'bg-slate-900/60 text-slate-500 border-slate-800 line-through',
  holds: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  may_not_hold: 'bg-amber-500/15 text-amber-300 border-amber-500/35 font-medium',
  unknown: 'bg-slate-800/60 text-slate-400 border-slate-700/60',
  verified: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  approximate: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  unverified: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  tech: 'bg-slate-900/90 text-slate-300 border-slate-800 font-mono text-[11px]',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  const style = variantStyles[variant] || variantStyles.default;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs border ${style} ${className}`}
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
