import React from 'react';

interface ErrorAlertProps {
  error: Error | string;
  isNotImplemented?: boolean;
  onRetry?: () => void;
  onPreviewFixture?: () => void;
  title?: string;
}

export function ErrorAlert({
  error,
  isNotImplemented = false,
  onRetry,
  onPreviewFixture,
  title,
}: ErrorAlertProps) {
  const errorMessage = typeof error === 'string' ? error : error.message;

  if (isNotImplemented) {
    return (
      <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-5 text-amber-200">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-amber-500/20 text-amber-400 font-mono text-[11px] font-bold">
              501
            </span>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-amber-300">
              {title || 'Backend Endpoint In Development (Phase 2)'}
            </h4>
            <p className="mt-1 text-xs text-amber-300/80 leading-relaxed">
              {errorMessage ||
                'This backend route is part of Phase 2 implementation. The server returned HTTP 501 Not Implemented.'}
            </p>
            {onPreviewFixture && (
              <div className="mt-3.5 flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={onPreviewFixture}
                  className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/30 border border-amber-500/35 transition-colors"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                  Preview Frozen Contract Fixture
                </button>
                <span className="text-[11px] text-amber-400/60 font-mono">
                  (Demonstrates layout using shared/fixtures/api/ without faking backend status)
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 p-5 text-rose-200">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <svg
            className="w-4 h-4 text-rose-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-rose-300">{title || 'Request Failed'}</h4>
          <p className="mt-1 text-xs text-rose-300/80 leading-relaxed">{errorMessage}</p>
          {onRetry && (
            <div className="mt-3">
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-md bg-rose-600/30 px-3 py-1 text-xs font-medium text-rose-200 hover:bg-rose-600/40 border border-rose-500/35 transition-colors"
              >
                Retry Request
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
