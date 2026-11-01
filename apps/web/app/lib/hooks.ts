/**
 * Generic data-fetching hook with loading/error/retry states.
 */
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiClientError } from './api';

export type FetchState<T> =
  | { status: 'idle'; data: null; error: null }
  | { status: 'loading'; data: T | null; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: null; error: ApiClientError | Error };

export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  options?: { enabled?: boolean },
) {
  const [state, setState] = useState<FetchState<T>>({
    status: 'idle',
    data: null,
    error: null,
  });

  const enabled = options?.enabled !== false;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const execute = useCallback(async () => {
    setState((prev) => ({ status: 'loading', data: prev.data ?? null, error: null }));
    try {
      const data = await fetcherRef.current();
      setState({ status: 'success', data, error: null });
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setState({ status: 'error', data: null, error });
      return null;
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      execute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  const retry = useCallback(() => execute(), [execute]);

  return {
    ...state,
    isLoading: state.status === 'loading',
    isError: state.status === 'error',
    isSuccess: state.status === 'success',
    isIdle: state.status === 'idle',
    retry,
    refetch: execute,
  };
}

/**
 * Polling hook for job status
 */
export function useJobPolling(
  jobId: number | null,
  onComplete?: (job: unknown) => void,
  interval = 1500,
) {
  const [job, setJob] = useState<unknown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const callbackRef = useRef(onComplete);
  callbackRef.current = onComplete;

  useEffect(() => {
    if (!jobId) return;

    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('Job not found');
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        if (active) {
          setJob(data);
          if (data.status === 'succeeded' || data.status === 'failed') {
            callbackRef.current?.(data);
            return;
          }
        }
        if (active) {
          setTimeout(poll, interval);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Polling failed');
        }
      }
    };

    poll();
    return () => {
      active = false;
    };
  }, [jobId, interval]);

  return { job, error };
}
