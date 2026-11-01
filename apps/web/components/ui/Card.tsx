import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export function Card({ children, className = '', onClick, hoverable = false }: CardProps) {
  const hoverStyles = hoverable
    ? 'hover:border-slate-700 hover:bg-slate-900/60 transition-colors cursor-pointer'
    : '';

  return (
    <div
      onClick={onClick}
      className={`rounded-lg border border-slate-800 bg-slate-900/40 p-5 ${hoverStyles} ${className}`}
    >
      {children}
    </div>
  );
}
