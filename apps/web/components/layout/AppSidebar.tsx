'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface AppSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRepoId?: number | null;
  onSelectRepo?: (repoId: number | null) => void;
}

const navItems = [
  {
    name: 'Overview',
    href: '/',
    description: 'Executive metrics & attention queue',
    icon: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    name: 'Decision Explorer',
    href: '/decisions',
    description: 'Recovered decisions & evidence dossiers',
    icon: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    name: 'Import Repository',
    href: '/import',
    description: 'Ingest GitHub threads & discussions',
    icon: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
        />
      </svg>
    ),
  },
  {
    name: 'Prior-Decision Warning',
    href: '/sandbox',
    description: 'Proposed changes vs settled history',
    icon: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    ),
  },
];

const intelligenceTools = [
  {
    name: 'PR Simulation',
    href: '/prior-art',
    description: 'Simulated PR conflict & prior-art check',
    icon: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M8 7v8a2 2 0 002 2h6M8 7a2 2 0 100-4 2 2 0 000 4zm0 0v2a2 2 0 002 2h4m0 0a2 2 0 100-4 2 2 0 000 4zm0 6a2 2 0 100-4 2 2 0 000 4z"
        />
      </svg>
    ),
  },
  {
    name: 'Code Map',
    href: '/code',
    description: 'File-to-decision path attribution',
    icon: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
        />
      </svg>
    ),
  },
  {
    name: 'Timeline Trail',
    href: '/timeline',
    description: 'Chronological event trace',
    icon: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    name: 'Evidence Ledger',
    href: '/evidence',
    description: 'Verbatim quotes & Evidence Lock records',
    icon: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
  },
  {
    name: 'Relationships',
    href: '/relationships',
    description: 'Supersedes & cross-decision graph',
    icon: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
        />
      </svg>
    ),
  },
  {
    name: 'Reopen Radar',
    href: '/radar',
    description: 'Assumption & constraint health drift',
    icon: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    name: 'Ask Assistant',
    href: '/ask',
    description: 'Natural language query over memory',
    icon: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
        />
      </svg>
    ),
  },
  {
    name: 'Benchmarks',
    href: '/benchmark',
    description: 'F1, precision & recall metrics',
    icon: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
  },
  {
    name: 'System Status',
    href: '/status',
    description: 'Local Ollama & SQLite runtime',
    icon: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
        />
      </svg>
    ),
  },
];

export function AppSidebar({ isOpen, onClose }: AppSidebarProps) {
  const pathname = usePathname();

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between p-3.5 bg-[#0b101c] border-r border-slate-800/70 overflow-y-auto">
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-2 pt-1.5 pb-1">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 group-hover:border-emerald-500/40 transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-slate-100 group-hover:text-white transition-colors">
                DecisionVault
              </span>
              <span className="text-[10px] text-slate-400 font-medium tracking-normal -mt-0.5">
                Decision Intelligence
              </span>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="md:hidden text-slate-400 hover:text-slate-200 p-1 rounded-md"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Primary Navigation Section */}
        <div>
          <div className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Navigation
          </div>
          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const isActive =
                item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-300 font-semibold border-l-2 border-emerald-400 pl-2'
                      : 'text-slate-300 hover:bg-slate-800/40 hover:text-slate-100'
                  }`}
                >
                  <span
                    className={
                      isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'
                    }
                  >
                    {item.icon}
                  </span>
                  <div className="min-w-0 flex-1 truncate">
                    <div className="truncate text-xs">{item.name}</div>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Intelligence Tools Section */}
        <div className="pt-3 border-t border-slate-800/60">
          <div className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Intelligence Tools
          </div>
          <nav className="space-y-0.5">
            {intelligenceTools.map((tool) => {
              const isToolActive = pathname === tool.href || pathname.startsWith(tool.href + '/');
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  onClick={onClose}
                  className={`group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                    isToolActive
                      ? 'bg-emerald-500/10 text-emerald-300 font-semibold border-l-2 border-emerald-400 pl-2'
                      : 'text-slate-300 hover:bg-slate-800/40 hover:text-slate-100'
                  }`}
                >
                  <span
                    className={
                      isToolActive
                        ? 'text-emerald-400'
                        : 'text-slate-400 group-hover:text-slate-200'
                    }
                  >
                    {tool.icon}
                  </span>
                  <div className="min-w-0 flex-1 truncate">
                    <div className="truncate text-xs">{tool.name}</div>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Inference runtime badge */}
      <div className="mt-6 rounded-lg border border-slate-800/80 bg-slate-900/50 p-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
            Inference Target
          </span>
          <span className="rounded bg-emerald-950/60 border border-emerald-800/50 px-1.5 py-0.5 text-[9px] font-mono text-emerald-400 font-semibold">
            LOCAL
          </span>
        </div>
        <p className="text-xs text-slate-200 font-mono font-medium">gemma4:e4b</p>
        <p className="text-[10px] text-slate-400 leading-tight">
          Strictly local Ollama runtime. Zero cloud AI dependencies.
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 flex-shrink-0">{sidebarContent}</aside>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div
            className="fixed inset-0 bg-[#080c14]/80 backdrop-blur-sm transition-opacity"
            onClick={onClose}
          />
          <div className="relative z-50 flex w-64 max-w-xs flex-1 flex-col">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
