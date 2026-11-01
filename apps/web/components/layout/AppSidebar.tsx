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
    description: 'System status & metrics',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
        />
      </svg>
    ),
  },
  {
    name: 'Decision Explorer',
    href: '/decisions',
    description: 'Recovered decisions & evidence',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    description: 'Ingest issues & discussions',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    description: 'Code change radar & sandbox',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

export function AppSidebar({ isOpen, onClose }: AppSidebarProps) {
  const pathname = usePathname();

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between p-4 bg-slate-950 border-r border-slate-800/80 overflow-y-auto">
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <Link href="/" className="flex items-center space-x-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono font-bold text-sm">
              DV
            </span>
            <span className="font-mono text-base font-bold tracking-tight text-slate-100">
              DecisionVault
            </span>
          </Link>
          <button
            onClick={onClose}
            className="md:hidden text-slate-400 hover:text-slate-200 p-1"
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

        <div className="px-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 font-mono">
            Navigation
          </p>
          <nav className="mt-2 space-y-1">
            {navItems.map((item) => {
              const isActive =
                item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`group flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-800 text-emerald-300 font-semibold border-l-2 border-emerald-400'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  <span
                    className={
                      isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'
                    }
                  >
                    {item.icon}
                  </span>
                  <div>
                    <div>{item.name}</div>
                    <div className="text-[10px] text-slate-500 font-normal leading-tight">
                      {item.description}
                    </div>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="px-2 pt-2 border-t border-slate-800/60">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 font-mono">
            Intelligence Tools
          </p>
          <nav className="mt-2 space-y-0.5">
            {[
              { name: 'PR Simulation', href: '/prior-art', desc: 'Simulated PR conflict check' },
              { name: 'Code Map', href: '/code', desc: 'File-to-decision attribution' },
              { name: 'Timeline Trail', href: '/timeline', desc: 'Chronological event trace' },
              { name: 'Evidence Ledger', href: '/evidence', desc: 'Verbatim quotes & locks' },
              { name: 'Relationships', href: '/relationships', desc: 'Supersedes & dependency' },
              { name: 'Reopen Radar', href: '/radar', desc: 'Assumption & health drift' },
              { name: 'Ask Assistant', href: '/ask', desc: 'Natural language search' },
              { name: 'Benchmarks', href: '/benchmark', desc: 'F1 & precision metrics' },
              { name: 'System Status', href: '/status', desc: 'Local AI & SQLite engine' },
            ].map((tool) => {
              const isToolActive = pathname === tool.href || pathname.startsWith(tool.href + '/');
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  onClick={onClose}
                  className={`flex items-center justify-between rounded px-2.5 py-1.5 text-xs transition-colors ${
                    isToolActive
                      ? 'bg-slate-800/80 text-cyan-300 font-medium'
                      : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
                  }`}
                >
                  <span className="font-mono text-[11px]">{tool.name}</span>
                  <span className="text-[9px] text-slate-600 font-mono hidden xl:inline">
                    {tool.desc}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-slate-800/80 bg-slate-900/40 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
            Inference Target
          </span>
          <span className="rounded bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 text-[9px] font-mono text-emerald-400">
            LOCAL
          </span>
        </div>
        <p className="text-[11px] text-slate-300 font-mono">gemma4:e4b</p>
        <p className="text-[10px] text-slate-500 leading-tight">
          Strictly local Ollama runtime. Zero cloud AI APIs.
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
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={onClose}
          />
          <div className="relative z-50 flex w-72 max-w-xs flex-1 flex-col">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
