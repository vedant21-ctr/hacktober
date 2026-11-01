'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  implemented?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navigation: NavSection[] = [
  {
    title: 'WORKSPACE',
    items: [
      { label: 'Overview', href: '/', icon: '◈', implemented: true },
      { label: 'Repositories', href: '/repositories', icon: '⊞', implemented: true },
      { label: 'Import Repository', href: '/import', icon: '↓', implemented: true },
    ],
  },
  {
    title: 'DECISION INTELLIGENCE',
    items: [
      { label: 'Decisions', href: '/decisions', icon: '◇', implemented: true },
      { label: 'Decision Timeline', href: '/timeline', icon: '│', implemented: true },
      { label: 'Alternatives', href: '/decisions?view=alternatives', icon: '⊕', implemented: true },
      { label: 'Evidence Archive', href: '/evidence', icon: '✓', implemented: true },
      { label: 'Relationships', href: '/relationships', icon: '⊷', implemented: true },
    ],
  },
  {
    title: 'CODE INTELLIGENCE',
    items: [
      { label: 'Code Explorer', href: '/code', icon: '⌂', implemented: true },
      { label: 'File → Decision', href: '/code/why', icon: '?', implemented: true },
      { label: 'Prior-Art Detection', href: '/prior-art', icon: '⚡', implemented: true },
      { label: 'Reopen Radar', href: '/radar', icon: '◎', implemented: true },
    ],
  },
  {
    title: 'EVALUATION',
    items: [
      { label: 'Ask DecisionVault', href: '/ask', icon: '▸', implemented: true },
      { label: 'Benchmark', href: '/benchmark', icon: '◆', implemented: true },
    ],
  },
  {
    title: 'SYSTEM',
    items: [{ label: 'System Status', href: '/status', icon: '●', implemented: true }],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-vault-border">
        <a href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-vault-accent/10 border border-vault-accent/30 flex items-center justify-center">
            <span className="text-vault-accent font-mono font-bold text-xs">DV</span>
          </div>
          {!collapsed && (
            <div>
              <div className="font-mono text-sm font-bold tracking-tight text-vault-text">
                DecisionVault
              </div>
              <div className="text-[9px] font-mono text-vault-text-dim tracking-wider uppercase">
                Engineering Memory
              </div>
            </div>
          )}
        </a>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {navigation.map((section) => (
          <div key={section.title} className="mb-4">
            {!collapsed && (
              <div className="px-2 mb-1.5 text-[9px] font-mono font-semibold uppercase tracking-[0.15em] text-vault-text-dim/60">
                {section.title}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <a
                    key={item.href + item.label}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-150 relative ${
                      active
                        ? 'bg-vault-accent/8 text-vault-accent border border-vault-accent/15'
                        : 'text-vault-text-muted hover:text-vault-text hover:bg-vault-surface border border-transparent'
                    }`}
                  >
                    <span
                      className={`font-mono text-[11px] w-4 text-center flex-shrink-0 ${
                        active
                          ? 'text-vault-accent'
                          : 'text-vault-text-dim group-hover:text-vault-text-muted'
                      }`}
                    >
                      {item.icon}
                    </span>
                    {!collapsed && (
                      <>
                        <span className="truncate">{item.label}</span>
                        {!item.implemented && (
                          <span className="ml-auto rounded px-1 py-0.5 text-[8px] font-mono bg-amber-500/10 text-amber-500/70 border border-amber-500/20 flex-shrink-0">
                            DEV
                          </span>
                        )}
                      </>
                    )}
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-vault-border px-3 py-3">
        {!collapsed && (
          <div className="flex items-center gap-2 text-[9px] font-mono text-vault-text-dim">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/60" />
            <span>Team Glitch • PS-06</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="mt-2 w-full rounded px-2 py-1 text-[10px] font-mono text-vault-text-dim hover:text-vault-text-muted hover:bg-vault-surface transition-colors hidden lg:block"
        >
          {collapsed ? '→' : '← Collapse'}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 rounded-md bg-vault-surface border border-vault-border p-2 text-vault-text-muted hover:text-vault-text"
        aria-label="Open navigation"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-vault-bg border-r border-vault-border transform transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-3 right-3 rounded p-1 text-vault-text-dim hover:text-vault-text"
        >
          ✕
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col flex-shrink-0 border-r border-vault-border bg-vault-bg/80 backdrop-blur-sm transition-all duration-200 ${
          collapsed ? 'w-14' : 'w-56'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
