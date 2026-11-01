import type { Metadata } from 'next';
import React from 'react';
import './globals.css';
import { Shell } from '../components/layout/Shell';

export const metadata: Metadata = {
  title: 'DecisionVault — Open Source Decision Intelligence',
  description:
    'Engineering knowledge recovery platform extracting technical decisions and verified evidence from open-source discussions.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const isMockMode = process.env.NEXT_PUBLIC_API_MODE === 'mock';

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased flex flex-col font-sans">
        {isMockMode && (
          <div
            data-testid="mock-data-banner"
            className="w-full bg-amber-500 text-slate-950 px-4 py-1.5 text-center text-xs font-bold uppercase tracking-wider shadow-sm z-50"
          >
            MOCK DATA — Offline Contract Fixture Mode Active
          </div>
        )}
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
