'use client';

import React, { useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';

interface ShellProps {
  children: React.ReactNode;
}

export function Shell({ children }: ShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null);

  return (
    <div className="flex h-screen overflow-hidden bg-[#080c14] text-slate-100">
      <AppSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        selectedRepoId={selectedRepoId}
        onSelectRepo={setSelectedRepoId}
      />
      <div className="flex flex-1 flex-col overflow-y-auto min-w-0 bg-[#080c14]">
        <AppHeader
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          selectedRepoId={selectedRepoId}
          onSelectRepo={setSelectedRepoId}
        />
        <main className="flex-1 p-5 md:p-8 max-w-7xl w-full mx-auto">{children}</main>
        <footer className="border-t border-slate-800/60 px-6 py-4 text-center text-xs text-slate-500">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto">
            <span className="text-slate-400 font-medium">DecisionVault</span>
            <span className="text-[11px] text-slate-500">
              Engineering Decision Intelligence &amp; Knowledge Recovery • Local Gemma 4 E4B runtime
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
