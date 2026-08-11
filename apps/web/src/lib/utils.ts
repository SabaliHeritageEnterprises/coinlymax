import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as a price with sensible precision. */
export function fmtPrice(value: number | string, precision?: number): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!isFinite(n)) return '—';
  const p = precision ?? (n >= 1000 ? 2 : n >= 1 ? 2 : n >= 0.01 ? 4 : 6);
  return n.toLocaleString('en-US', { minimumFractionDigits: p, maximumFractionDigits: p });
}

export function fmtChange(value: number | string): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function fmtCompact(value: number | string): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!isFinite(n)) return '—';
  return Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(n);
}

export function fmtUsd(value: number | string): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
