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
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-slate-900 border border-slate-800 text-slate-400 font-mono">
        <span className="h-2 w-2 rounded-full bg-slate-600 animate-pulse"></span>
        Checking API...
      </div>
    );
  }

  if (error || !status) {
    return (
      <button
        onClick={fetchStatus}
        title={`Backend unreachable: ${error || 'Connection refused'}. Click to retry.`}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-rose-950/60 border border-rose-800/60 text-rose-300 font-mono hover:bg-rose-900/60 transition-colors"
      >
        <span className="h-2 w-2 rounded-full bg-rose-500"></span>
        Backend Offline (Retry)
      </button>
    );
  }

  const isBackendOk = status.ok && status.db;
  const isOllamaReachable = status.ollama.reachable;
  const isReplayMode = status.ollama.mode === 'replay';

  return (
    <div className="relative font-mono" ref={badgeRef}>
      <button
        type="button"
        onClick={() => setPopoverOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors text-slate-300"
      >
        {/* Backend health dot */}
        <span
          className={`h-2 w-2 rounded-full ${isBackendOk ? 'bg-emerald-400' : 'bg-rose-500'}`}
          title={isBackendOk ? 'Backend & DB Online' : 'Backend Degraded'}
        />
        <span className="text-slate-200">API: {isBackendOk ? 'Online' : 'Degraded'}</span>

        <span className="text-slate-600">•</span>

        {/* Ollama availability */}
        <span
          className={`text-[11px] ${
            isOllamaReachable
              ? 'text-emerald-400'
              : isReplayMode
                ? 'text-cyan-400'
                : 'text-amber-400'
          }`}
        >
          {isOllamaReachable
            ? 'Ollama: Connected'
            : `Ollama: ${isReplayMode ? 'Replay' : 'Unreachable'}`}
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
        <div className="absolute right-0 mt-2 w-80 rounded-lg border border-slate-800 bg-slate-950 p-4 shadow-xl z-50 text-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
              System Health &amp; Readiness
            </span>
            <button
              onClick={fetchStatus}
              className="text-[10px] text-emerald-400 hover:text-emerald-300 underline"
            >
              Refresh
            </button>
          </div>

          <div className="space-y-2">
            {/* Backend */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Backend Server (Port 4000):</span>
              <span className={`font-semibold ${status.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                {status.ok ? 'Online (HTTP 200)' : 'Error'}
              </span>
            </div>

            {/* SQLite DB */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400">SQLite &amp; FTS5:</span>
              <span className={`font-semibold ${status.db ? 'text-emerald-400' : 'text-rose-400'}`}>
                {status.db ? 'Ready' : 'Unavailable'}
              </span>
            </div>

            {/* Ollama Reachability */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Ollama Daemon:</span>
              <span
                className={`font-semibold ${
                  isOllamaReachable ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {isOllamaReachable ? 'Reachable (11434)' : 'Not Reachable'}
              </span>
            </div>

            {/* Model Name */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Target Model:</span>
              <span className="text-slate-200 font-mono">{status.ollama.model}</span>
            </div>

            {/* LLM Mode */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400">LLM Mode:</span>
              <span className="text-cyan-400 uppercase font-semibold">{status.ollama.mode}</span>
            </div>

            {/* Inference Pipeline Readiness */}
            <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 leading-relaxed">
              <span className="font-semibold text-slate-300 block mb-0.5">
                Inference Readiness:
              </span>
              {isReplayMode ? (
                <span>
                  Operating in <strong>replay mode</strong>. End-to-end extraction and question
                  answering rely on pre-recorded fixtures. Live inference with local Gemma 4 E4B is
                  Phase 2 scope.
                </span>
              ) : isOllamaReachable ? (
                <span>
                  Ollama daemon connected with <code>{status.ollama.model}</code>. Backend pipeline
                  integration is in progress.
                </span>
              ) : (
                <span className="text-amber-300/90">
                  Ollama daemon is offline. Start Ollama locally with{' '}
                  <code>ollama run gemma4:e4b</code> for live local inference.
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
