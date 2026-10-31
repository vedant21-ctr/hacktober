import type { Metadata } from 'next';
import React from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'DecisionVault — Open Source Decision Intelligence',
  description:
    'Engineering knowledge recovery platform extracting technical decisions and verified evidence from open-source discussions.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const isMockMode = process.env.NEXT_PUBLIC_API_MODE === 'mock';

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased flex flex-col">
        {isMockMode && (
          <div
            data-testid="mock-data-banner"
            className="w-full bg-amber-500 text-slate-950 px-4 py-1.5 text-center text-xs font-bold uppercase tracking-wider shadow-sm z-50"
          >
            MOCK DATA — Offline Contract Fixture Mode Active
          </div>
        )}
        <header className="border-b border-slate-800 bg-slate-900/60 px-6 py-4 backdrop-blur">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="font-mono text-xl font-bold tracking-tight text-emerald-400">
                DecisionVault
              </span>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400 font-mono">
                v0.1.0-contracts
              </span>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              Problem Statement 06 • Hacktoberfest 2026
            </div>
          </div>
        </header>
        <main className="flex-1 max-w-7xl w-full mx-auto p-6">{children}</main>
        <footer className="border-t border-slate-800/80 px-6 py-4 text-center text-xs text-slate-500">
          DecisionVault • Team Glitch • Local Gemma 4 E4B inference runtime
        </footer>
      </body>
    </html>
  );
}
