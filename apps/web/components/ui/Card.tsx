import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export function Card({ children, className = '', onClick, hoverable = false }: CardProps) {
  const hoverStyles = hoverable
    ? 'hover:border-slate-700/80 hover:bg-[#131b2e] transition-colors cursor-pointer'
    : '';

  return (
    <div
      onClick={onClick}
      className={`rounded-lg border border-slate-800/70 bg-[#0e1424]/70 p-5 ${hoverStyles} ${className}`}
    >
      {children}
    </div>
  );
}
