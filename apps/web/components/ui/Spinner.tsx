import React from 'react';

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-6 w-6 border-2',
    lg: 'h-8 w-8 border-3',
  }[size];

  return (
    <div
      role="status"
      aria-label="Loading"
      className={`animate-spin rounded-full border-slate-700 border-t-emerald-400 ${sizeClasses}`}
    />
  );
}
