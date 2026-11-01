import type { Metadata } from 'next';
import React from 'react';
import './globals.css';
import Sidebar from './components/Sidebar';

export const metadata: Metadata = {
  title: 'DecisionVault — Recover the decisions nobody wrote down',
  description:
    'Engineering memory and decision-recovery platform. Reconstructs undocumented technical decisions from GitHub issues, pull requests, review comments and historical code changes.',
};

export default function RootLayout({ children }: { children: any }) {
  const isMockMode = process.env.NEXT_PUBLIC_API_MODE === 'mock';

  return (
    <html lang="en" className="dark">
      <head>
        <meta name="color-scheme" content="dark" />
      </head>
      <body className="min-h-screen bg-vault-bg text-vault-text antialiased">
        {isMockMode && (
          <div
            data-testid="mock-data-banner"
            className="w-full bg-amber-500 text-vault-bg px-4 py-1.5 text-center text-[10px] font-mono font-bold uppercase tracking-wider z-[60] relative"
          >
            ⚠ MOCK DATA — Offline Contract Fixture Mode Active
          </div>
        )}

        <div className="flex h-screen overflow-hidden">
          {/* Sidebar Navigation */}
          <Sidebar />

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top Bar */}
            <header className="flex-shrink-0 border-b border-vault-border bg-vault-bg/80 backdrop-blur-sm px-6 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-vault-text-dim uppercase tracking-wider hidden sm:block">
                    Engineering Decision Memory
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded border border-vault-border bg-vault-surface px-2 py-0.5 text-[9px] font-mono text-vault-text-dim">
                    v0.1.0
                  </span>
                  <span className="text-[10px] font-mono text-vault-text-dim hidden sm:block">
                    PS-06 • Hacktoberfest 2026
                  </span>
                </div>
              </div>
            </header>

            {/* Page Content */}
            <main className="flex-1 overflow-y-auto bg-technical-grid">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {children}
              </div>
            </main>

            {/* Footer */}
            <footer className="flex-shrink-0 border-t border-vault-border bg-vault-bg/80 px-6 py-2.5">
              <div className="flex items-center justify-between text-[9px] font-mono text-vault-text-dim">
                <span>DecisionVault • Team Glitch</span>
                <span>Local Gemma 4 E4B (gemma4:e4b) • Ollama Runtime</span>
              </div>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
