export type Matrix = number[][];
export type Vector = number[];

export function multiplyMatrix(a: Matrix, b: Matrix): Matrix {
  const result = Array(a.length).fill(0).map(() => Array(b[0].length).fill(0));
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b[0].length; j++) {
      for (let k = 0; k < a[0].length; k++) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  return result;
}

export function multiplyVectorMatrix(v: Vector, m: Matrix): Vector {
  const result = Array(m[0].length).fill(0);
  for (let j = 0; j < m[0].length; j++) {
    for (let k = 0; k < v.length; k++) {
      result[j] += v[k] * m[k][j];
    }
  }
  return result;
}

// Simulates the next state given a current state and transition matrix
export function simulateNextState(currentStateIndex: number, transitionMatrix: Matrix): number {
  const probabilities = transitionMatrix[currentStateIndex];
  const rand = Math.random();
  let sum = 0;
  for (let i = 0; i < probabilities.length; i++) {
    sum += probabilities[i];
    if (rand <= sum) return i;
  }
  return probabilities.length - 1; // Fallback to last state due to floating point inaccuracies
}

// Calculates the distribution history up to maxSteps
export function calculateStepsDistribution(initialDist: Vector, matrix: Matrix, maxSteps: number): Vector[] {
  let current = initialDist;
  const history: Vector[] = [current];
  for (let i = 0; i < maxSteps; i++) {
    current = multiplyVectorMatrix(current, matrix);
    history.push(current);
  }
  return history;
}

// Compute the stationary distribution by finding long-term convergence
export function getStationaryDistribution(matrix: Matrix): Vector {
  const n = matrix.length;
  if (n === 0) return [];
  if (n === 1) return [1];

  // Repeated squaring of matrix (P^1024) to find steady state
  let resultMat = matrix.map(row => [...row]);
  for (let step = 0; step < 10; step++) {
    resultMat = multiplyMatrix(resultMat, resultMat);
  }
  
  // After converging, the rows of resultMat should be identical.
  // We return the first row. We average the rows to handle periodic irreducible chains slightly better, 
  // but for a learning tool first row is usually fine or averaging is safer.
  const dist = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      dist[j] += resultMat[i][j];
    }
  }
  return dist.map(val => val / n);
}
