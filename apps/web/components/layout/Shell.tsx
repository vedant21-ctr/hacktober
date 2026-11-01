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
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      <AppSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        selectedRepoId={selectedRepoId}
        onSelectRepo={setSelectedRepoId}
      />
      <div className="flex flex-1 flex-col overflow-y-auto min-w-0">
        <AppHeader
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          selectedRepoId={selectedRepoId}
          onSelectRepo={setSelectedRepoId}
        />
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">{children}</main>
        <footer className="border-t border-slate-900 px-6 py-4 text-center text-xs text-slate-500 font-mono">
          DecisionVault • Team Glitch • Problem Statement 06 • Local Gemma 4 E4B inference runtime
        </footer>
      </div>
    </div>
  );
}
