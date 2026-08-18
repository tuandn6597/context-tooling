/**
 * Deterministic seeded randomness for mock data generation.
 *
 * Same seed -> same sequence, so generated mock data is idempotent per week
 * (byte-identical on re-runs) while still varying across weeks (different seed).
 */

export function hashSeed(...parts: string[]): number {
  let h = 2166136261 >>> 0; // FNV-1a
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      h ^= part.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SeededRandom {
  next: () => number;
  int: (min: number, max: number) => number;
  float: (min: number, max: number) => number;
  pick: <T>(items: readonly T[]) => T;
}

export function seededRandom(seed: number): SeededRandom {
  const rand = mulberry32(seed);
  return {
    next: rand,
    int(min, max) {
      return Math.floor(rand() * (max - min + 1)) + min;
    },
    float(min, max) {
      return rand() * (max - min) + min;
    },
    pick(items) {
      return items[Math.floor(rand() * items.length)]!;
    },
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
