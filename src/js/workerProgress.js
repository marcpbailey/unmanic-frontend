export function workerProgress(stats) {
  const raw = stats?.percent;
  const percent = Number(raw);
  const known = raw !== null && raw !== undefined && raw !== '' && Number.isFinite(percent) && percent >= 0 && percent <= 100;
  const elapsed = Number(stats?.elapsed);
  const hasElapsed = stats?.elapsed !== null && stats?.elapsed !== undefined && stats?.elapsed !== '' && Number.isFinite(elapsed) && elapsed >= 0;
  return { known, percent: known ? percent : null, elapsed, hasElapsed, phase: stats?.progress_scope === 'phase' };
}
