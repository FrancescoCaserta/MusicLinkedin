/** Small deterministic PRNG (mulberry32) so the demo data is identical on every machine. */
export class Rng {
  private s: number;

  constructor(seed: number | string) {
    if (typeof seed === 'string') {
      let h = 2166136261;
      for (let k = 0; k < seed.length; k++) {
        h ^= seed.charCodeAt(k);
        h = Math.imul(h, 16777619);
      }
      this.s = h >>> 0;
    } else {
      this.s = seed >>> 0;
    }
  }

  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max]. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.next() * list.length)];
  }

  shuffle<T>(list: readonly T[]): T[] {
    const a = [...list];
    for (let k = a.length - 1; k > 0; k--) {
      const j = Math.floor(this.next() * (k + 1));
      [a[k], a[j]] = [a[j], a[k]];
    }
    return a;
  }

  sample<T>(list: readonly T[], n: number): T[] {
    return this.shuffle(list).slice(0, Math.max(0, Math.min(n, list.length)));
  }

  /** A child generator, so adding data in one place does not reshuffle another. */
  fork(label: string): Rng {
    return new Rng(`${this.s}:${label}`);
  }
}
