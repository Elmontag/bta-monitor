import type { ParliamentPeriod } from '../types/api';

/**
 * Format a parliament period as a year range ("2021–2025", "2025–heute", etc.).
 * Falls back to extracting years from the label string when dates are missing.
 */
export function formatPeriodYears(period: ParliamentPeriod): string {
  const start = period.start_date_period
    ? new Date(period.start_date_period).getFullYear()
    : null;
  const end = period.end_date_period
    ? new Date(period.end_date_period).getFullYear()
    : null;
  const today = new Date().toISOString().slice(0, 10);

  if (start && end) {
    const isCurrent = period.end_date_period! > today;
    if (isCurrent) return `${start}–heute`;
    if (start === end) return `${start}`;
    return `${start}–${end}`;
  }
  if (start) return `${start}–heute`;

  const years = period.label.match(/\d{4}/g);
  if (years && years.length >= 2) return `${years[0]}–${years[1]}`;
  if (years?.length === 1) return years[0];
  return period.label;
}
