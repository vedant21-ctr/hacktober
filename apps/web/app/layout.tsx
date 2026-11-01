import type { Metadata } from 'next';
import React from 'react';
import './globals.css';
import { Shell } from '../components/layout/Shell';

export const metadata: Metadata = {
  title: 'DecisionVault — Engineering Decision Intelligence',
  description:
    'Engineering decision intelligence and knowledge recovery platform extracting technical decisions and verified evidence from discussions.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const isMockMode = process.env.NEXT_PUBLIC_API_MODE === 'mock';

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#080c14] text-slate-100 antialiased flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-200">
        {isMockMode && (
          <div
            data-testid="mock-data-banner"
            className="w-full bg-amber-500 text-slate-950 px-4 py-1.5 text-center text-xs font-bold uppercase tracking-wider shadow-sm z-50 font-mono"
          >
            MOCK DATA — Offline Contract Fixture Mode Active
          </div>
        )}
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
