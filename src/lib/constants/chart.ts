/**
 * Shared Recharts tooltip content style. Import instead of inlining per-chart.
 * Uses CSS custom-property fallbacks so it reads correctly in dark mode.
 */
export const CHART_TOOLTIP_STYLE = {
  fontSize: 12,
  border: '1px solid var(--border)',
  borderRadius: 8,
  boxShadow: '0 1px 4px rgba(0,0,0,.06)',
  background: 'var(--bg)',
  color: 'var(--fg)',
} as const
