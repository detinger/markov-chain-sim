// Small dense linear algebra with partial pivoting. No explicit inverses.

export type Mat = number[][];

export interface SolveResult {
  X: Mat;
  /** Max-abs residual ‖AX − B‖∞ */
  residual: number;
  /** Ratio of smallest to largest pivot magnitude — a cheap conditioning hint. */
  pivotRatio: number;
}

export function identity(n: number): Mat {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
}

/** Solve A X = B (A is n×n, B is n×k). Returns null when A is numerically singular. */
export function solve(A: Mat, B: Mat): SolveResult | null {
  const n = A.length;
  if (n === 0) return { X: [], residual: 0, pivotRatio: 1 };
  const k = B[0]?.length ?? 0;
  const M = A.map((row, i) => [...row, ...B[i]]);
  let maxPivot = 0;
  let minPivot = Infinity;
  const scale = Math.max(1, ...A.map((r) => r.reduce((s, v) => s + Math.abs(v), 0)));

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivotRow][col])) pivotRow = r;
    const pivot = M[pivotRow][col];
    if (Math.abs(pivot) <= 1e-14 * scale) return null;
    if (pivotRow !== col) [M[col], M[pivotRow]] = [M[pivotRow], M[col]];
    maxPivot = Math.max(maxPivot, Math.abs(pivot));
    minPivot = Math.min(minPivot, Math.abs(pivot));
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / pivot;
      if (f === 0) continue;
      for (let c = col; c < n + k; c++) M[r][c] -= f * M[col][c];
    }
  }
  const X: Mat = Array.from({ length: n }, () => new Array(k).fill(0));
  for (let c = 0; c < k; c++) {
    for (let r = n - 1; r >= 0; r--) {
      let s = M[r][n + c];
      for (let j = r + 1; j < n; j++) s -= M[r][j] * X[j][c];
      X[r][c] = s / M[r][r];
    }
  }
  let residual = 0;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < k; c++) {
      let s = -B[i][c];
      for (let j = 0; j < n; j++) s += A[i][j] * X[j][c];
      residual = Math.max(residual, Math.abs(s));
    }
  }
  return { X, residual, pivotRatio: minPivot / maxPivot };
}

export function column(values: number[]): Mat {
  return values.map((v) => [v]);
}
