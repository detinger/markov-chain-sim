// Interval estimators for independent replications (PLAN.md Module E, statistical contract).

export interface Interval {
  estimate: number;
  lower: number;
  upper: number;
  level: number;
  method: string;
}

const Z95 = 1.959963984540054;

/** Wilson score interval for k successes in n independent trials (pointwise). */
export function wilson(k: number, n: number, level = 0.95): Interval | null {
  if (!(n > 0) || k < 0 || k > n) return null;
  const z = level === 0.95 ? Z95 : normalQuantile(0.5 + level / 2);
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  // Exact boundary cases: the interval touches 0 (or 1) when no (or every) trial succeeds.
  const lower = k === 0 ? 0 : Math.max(0, center - half);
  const upper = k === n ? 1 : Math.min(1, center + half);
  return { estimate: p, lower, upper, level, method: 'Wilson score' };
}

export interface MeanSummary {
  n: number;
  mean: number;
  sd: number;
  se: number;
  df: number;
  interval: Interval | null;
}

/** Mean of independent replication-level values with a Student-t interval (none when n < 2). */
export function meanInterval(sum: number, sumSq: number, n: number, level = 0.95): MeanSummary {
  const mean = n > 0 ? sum / n : NaN;
  const variance = n > 1 ? Math.max(0, (sumSq - n * mean * mean) / (n - 1)) : NaN;
  const sd = Math.sqrt(variance);
  const se = sd / Math.sqrt(n);
  const df = n - 1;
  if (n < 2) return { n, mean, sd, se, df, interval: null };
  const t = studentTQuantile(0.5 + level / 2, df);
  return { n, mean, sd, se, df, interval: { estimate: mean, lower: mean - t * se, upper: mean + t * se, level, method: `Student t (df = ${df})` } };
}

// ───────────── special functions ─────────────

function logGamma(x: number): number {
  // Lanczos approximation (g = 7, n = 9)
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function betaContinuedFraction(a: number, b: number, x: number): number {
  const TINY = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return h;
}

/** Regularized incomplete beta I_x(a, b). */
export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betaContinuedFraction(a, b, x)) / a : 1 - (bt * betaContinuedFraction(b, a, 1 - x)) / b;
}

export function studentTCdf(t: number, df: number): number {
  const tail = 0.5 * incompleteBeta(df / (df + t * t), df / 2, 0.5);
  return t >= 0 ? 1 - tail : tail;
}

/** Quantile of Student's t by bisection on the CDF. */
export function studentTQuantile(p: number, df: number): number {
  if (p === 0.5) return 0;
  if (p < 0.5) return -studentTQuantile(1 - p, df);
  let lo = 0;
  let hi = 1;
  while (studentTCdf(hi, df) < p) hi *= 2;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (studentTCdf(mid, df) < p) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Standard normal quantile (Acklam's rational approximation, |rel err| < 1.2e-9). */
export function normalQuantile(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pl) return -normalQuantile(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
