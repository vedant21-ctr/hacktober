import React from 'react';

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-3.5 w-3.5 border-2',
    md: 'h-5 w-5 border-2',
    lg: 'h-7 w-7 border-2',
  }[size];

  return (
    <div
      role="status"
      aria-label="Loading"
      className={`animate-spin rounded-full border-slate-700/80 border-t-emerald-400 ${sizeClasses}`}
    />
  );
}
