// Numerical policy constants and helpers (PLAN.md §4.2).

/** Absolute row-sum tolerance: discrepancies at or below this are floating-point noise. */
export const EPS_ROW = 1e-12;
/** Residual target for linear solves. */
export const EPS_SOLVE = 1e-10;
/** Default display precision (decimal places). */
export const DISPLAY_DECIMALS = 4;

/** Neumaier-compensated summation. */
export function compensatedSum(values: readonly number[]): number {
  let sum = 0;
  let c = 0;
  for (const v of values) {
    const t = sum + v;
    if (Math.abs(sum) >= Math.abs(v)) c += sum - t + v;
    else c += v - t + sum;
    sum = t;
  }
  return sum + c;
}

export type ParsedProbability =
  | { kind: 'value'; value: number }
  | { kind: 'draft'; message: string }
  | { kind: 'invalid'; message: string };

const DECIMAL = /^[+]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const PARTIAL = /^([+]?(\d+\.?\d*|\.\d*)?([eE][+-]?)?)$/;

/**
 * Parse a probability typed by a user. Plain decimals and scientific notation only;
 * text is never evaluated. Incomplete input is a draft, never silently zero.
 */
export function parseProbability(raw: string): ParsedProbability {
  const text = raw.trim();
  if (text === '' || text === '.' || text === '+' || text === '-') {
    return { kind: 'draft', message: 'Enter a probability from 0 to 1.' };
  }
  if (!DECIMAL.test(text)) {
    if (text.startsWith('-')) return { kind: 'invalid', message: 'Probabilities cannot be negative.' };
    if (PARTIAL.test(text)) return { kind: 'draft', message: 'Finish typing the number.' };
    return { kind: 'invalid', message: 'Enter a probability from 0 to 1.' };
  }
  const value = Number(text);
  if (!Number.isFinite(value)) return { kind: 'invalid', message: 'Enter a finite number.' };
  if (value < 0 || value > 1) return { kind: 'invalid', message: 'Enter a probability from 0 to 1.' };
  return { kind: 'value', value };
}

/** Format a probability without disguising tiny positives as zero. */
export function formatProbability(value: number, decimals = DISPLAY_DECIMALS): string {
  if (Number.isNaN(value)) return 'Not defined';
  if (value === 0) return '0';
  const threshold = 0.5 * 10 ** -decimals;
  if (Math.abs(value) < threshold) return value.toExponential(2);
  const fixed = value.toFixed(decimals);
  // Trim trailing zeros but keep at least one decimal for non-integers.
  return fixed.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
}

/** Format a signed discrepancy such as "+0.2" or "−0.05". */
export function formatSigned(value: number, decimals = DISPLAY_DECIMALS): string {
  const body = formatProbability(Math.abs(value), decimals);
  return (value < 0 ? '−' : '+') + body;
}

/** Row-total text that never rounds an invalid total to a seemingly valid 1. */
export function formatTotal(sum: number): string {
  if (Math.abs(sum - 1) <= EPS_ROW) return '1';
  let decimals = DISPLAY_DECIMALS;
  let text = sum.toFixed(decimals);
  while ((Number(text) === 1 || text === '1.' + '0'.repeat(decimals)) && decimals < 15) {
    decimals += 2;
    text = sum.toFixed(decimals);
  }
  return text.replace(/(\.\d*?[1-9])0+$/, '$1');
}
