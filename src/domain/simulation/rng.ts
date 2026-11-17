// Counter-based PRNG `markov-ctr32x2-v1` (docs/architecture/0002-rng-and-trajectory-contract.md).
// Stateless: every draw is a pure function of (seed, stream, counter).

export const RNG_ALGORITHM = 'markov-ctr32x2-v1';
export const MAX_SEED = 0xffffffff;

/** lowbias32 integer hash (Chris Wellons). */
export function mix32(x: number): number {
  x >>>= 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

/** Per-(seed, stream) key; compute once and reuse for many draws. */
export function streamKey(seed: number, stream: number): number {
  return mix32(mix32((seed >>> 0) ^ 0x9e3779b9) ^ mix32(((stream >>> 0) + 0x632be5ab) >>> 0));
}

/** Uniform u ∈ [0, 1) with 53-bit resolution for draw `counter` of a stream key. */
export function uniformFromKey(key: number, counter: number): number {
  const c2 = (counter * 2) >>> 0;
  const a = mix32(key ^ mix32(c2));
  const b = mix32(key ^ mix32((c2 + 1) >>> 0));
  return ((a >>> 5) * 67108864 + (b >>> 6)) / 9007199254740992;
}

export function uniform(seed: number, stream: number, counter: number): number {
  return uniformFromKey(streamKey(seed, stream), counter);
}

/** Parse a user-entered seed; only whole numbers 0…2³²−1 are accepted. */
export function parseSeed(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,10}$/.test(t)) return null;
  const v = Number(t);
  return v <= MAX_SEED ? v : null;
}
