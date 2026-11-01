export function formatDate(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return (
      d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      }) + ' UTC'
    );
  } catch {
    return isoString;
  }
}

export function formatPercent(ratio?: number | null): string {
  if (ratio === undefined || ratio === null || isNaN(ratio)) return '—';
  return `${Math.round(ratio * 100)}%`;
}

export function parseRepoTarget(input: string): { owner: string; repo: string } | null {
  const clean = input
    .trim()
    .replace(/^https?:\/\/github\.com\//, '')
    .replace(/\.git$/, '');
  const parts = clean.split('/');
  if (parts.length === 2 && parts[0].length > 0 && parts[1].length > 0) {
    return { owner: parts[0], repo: parts[1] };
  }
  return null;
}
