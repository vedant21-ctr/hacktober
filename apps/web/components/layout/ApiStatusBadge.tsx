'use client';

import React, { useEffect, useState, useRef } from 'react';
import { api } from '../../lib/api';
import type { StatusResponse } from '@decisionvault/shared/api';

export function ApiStatusBadge() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getStatus();
      setStatus(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Offline');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (badgeRef.current && !badgeRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading && !status) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-slate-900/80 border border-slate-800 text-slate-400">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-pulse"></span>
        Checking API...
      </div>
    );
  }

  if (error || !status) {
    return (
      <button
        onClick={fetchStatus}
        title={`Backend unreachable: ${error || 'Connection refused'}. Click to retry.`}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-rose-950/40 border border-rose-800/40 text-rose-300 hover:bg-rose-900/50 transition-colors"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
        Backend Offline (Retry)
      </button>
    );
  }

  const isBackendOk = status.ok && status.db;
  const isOllamaReachable = status.ollama.reachable;
  const isReplayMode = status.ollama.mode === 'replay';

  return (
    <div className="relative text-xs" ref={badgeRef}>
      <button
        type="button"
        onClick={() => setPopoverOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors text-slate-300 font-medium"
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${isBackendOk ? 'bg-emerald-400' : 'bg-rose-500'}`}
          title={isBackendOk ? 'Backend & DB Online' : 'Backend Degraded'}
        />
        <span className="text-slate-200">API: {isBackendOk ? 'Online' : 'Degraded'}</span>

        <span className="text-slate-700">•</span>

        <span
          className={`text-[11px] ${
            isOllamaReachable
              ? 'text-emerald-400'
              : isReplayMode
                ? 'text-slate-400'
                : 'text-amber-400'
          }`}
        >
          {isOllamaReachable
            ? 'Ollama: Connected'
            : `Ollama: ${isReplayMode ? 'Replay' : 'Offline'}`}
        </span>

        <svg
          className={`w-3 h-3 text-slate-500 transition-transform ${popoverOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Detailed Status Popover */}
      {popoverOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-lg border border-slate-800 bg-[#0e1424] p-4 shadow-xl z-50 text-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
              System Health &amp; Readiness
            </span>
            <button
              onClick={fetchStatus}
              className="text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Refresh
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Backend Server:</span>
              <span className={`font-semibold ${status.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                {status.ok ? 'Online (HTTP 200)' : 'Error'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">SQLite &amp; FTS5:</span>
              <span className={`font-semibold ${status.db ? 'text-emerald-400' : 'text-rose-400'}`}>
                {status.db ? 'Ready' : 'Unavailable'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Ollama Daemon:</span>
              <span
                className={`font-semibold ${
                  isOllamaReachable ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {isOllamaReachable ? 'Reachable' : 'Not Reachable'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Target Model:</span>
              <span className="text-slate-200 font-mono text-[11px]">{status.ollama.model}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">LLM Mode:</span>
              <span className="text-slate-300 uppercase font-mono text-[11px]">
                {status.ollama.mode}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 leading-relaxed">
              <span className="font-medium text-slate-300 block mb-0.5">Inference Readiness:</span>
              {isReplayMode ? (
                <span>
                  Operating in <strong>replay mode</strong>. End-to-end extraction and inquiry rely
                  on pre-recorded fixtures.
                </span>
              ) : isOllamaReachable ? (
                <span>
                  Ollama daemon connected with{' '}
                  <code className="font-mono text-emerald-400">{status.ollama.model}</code>.
                </span>
              ) : (
                <span className="text-amber-300/90">
                  Ollama daemon is offline. Start Ollama locally with{' '}
                  <code className="font-mono text-slate-300">ollama run gemma4:e4b</code>.
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
