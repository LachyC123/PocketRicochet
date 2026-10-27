// Score bookkeeping for one shot and one run. Pure and deterministic.
import type { Tuning } from '../data/config';

export interface DestructionScore {
  ordinal: number;
  multiplier: number;
  bellBoost: boolean;
  points: number;
}

export class ShotScore {
  pending = 0;
  ordinal = 0;
  bellArmed = false;
  private bellsUsed = new Set<number>();

  constructor(
    private readonly every: number,
    private readonly cap: number,
    private readonly bellMultiplier: number,
  ) {}

  static fromTuning(t: Tuning, bellMultiplier: number): ShotScore {
    return new ShotScore(t.scoreMultiplierEvery, t.scoreMultiplierCap, bellMultiplier);
  }

  /** Multiplier for the nth scoring destruction in a shot (1-based). */
  multiplierFor(ordinal: number): number {
    return Math.min(this.cap, 1 + Math.floor((ordinal - 1) / this.every));
  }

  /**
   * Ring a bell. Returns true when it armed (or refreshed) the next-destruction bonus.
   * Each bell works once per shot; a second bell refreshes rather than stacks.
   */
  ringBell(bellId: number): boolean {
    if (this.bellsUsed.has(bellId)) return false;
    this.bellsUsed.add(bellId);
    this.bellArmed = true;
    return true;
  }

  recordDestruction(baseScore: number): DestructionScore {
    this.ordinal += 1;
    const multiplier = this.multiplierFor(this.ordinal);
    const bellBoost = this.bellArmed;
    this.bellArmed = false;
    const points = baseScore * multiplier * (bellBoost ? this.bellMultiplier : 1);
    this.pending += points;
    return { ordinal: this.ordinal, multiplier, bellBoost, points };
  }

  reset(): void {
    this.pending = 0;
    this.ordinal = 0;
    this.bellArmed = false;
    this.bellsUsed.clear();
  }
}

export interface CatchResult {
  shotPoints: number;
  perfect: boolean;
  bonus: number;
  banked: number;
}

export class RunScore {
  banked = 0;
  catches = 0;
  lostShot = 0;
  perfectCatches = 0;

  constructor(private readonly perfectBonus: number) {}

  bankCatch(shot: ShotScore, perfect: boolean): CatchResult {
    const shotPoints = shot.pending;
    const bonus = perfect ? this.perfectBonus : 0;
    this.banked += shotPoints + bonus;
    this.catches += 1;
    if (perfect) this.perfectCatches += 1;
    shot.reset();
    return { shotPoints, perfect, bonus, banked: this.banked };
  }

  loseShot(shot: ShotScore): number {
    this.lostShot = shot.pending;
    shot.reset();
    return this.lostShot;
  }
}

/** Coins for a finished run: floor(banked / divisor) capped, plus a bonus for at least one catch. */
export function coinsForRun(banked: number, catches: number, t: Pick<Tuning, 'coinScoreDivisor' | 'coinScoreCap' | 'completionCoinBonus'>): number {
  if (catches <= 0) return 0;
  return Math.min(t.coinScoreCap, Math.floor(banked / t.coinScoreDivisor)) + t.completionCoinBonus;
}

/** Catcher width after a number of catches. */
export function catcherWidthFor(catches: number, t: Pick<Tuning, 'catcherInitialWidth' | 'catcherShrinkPerCatch' | 'catcherMinimumWidth'>): number {
  return Math.max(t.catcherMinimumWidth, t.catcherInitialWidth - t.catcherShrinkPerCatch * catches);
}

/** Return duration for the next return, given catches so far in the run. */
export function returnSecondsFor(
  catches: number,
  t: Pick<Tuning, 'returnSeconds' | 'minimumReturnSeconds' | 'returnDifficultyCapCatch'>,
): number {
  const progress = Math.min(Math.max(catches, 0), t.returnDifficultyCapCatch) / t.returnDifficultyCapCatch;
  return Math.max(t.minimumReturnSeconds, t.returnSeconds - (t.returnSeconds - t.minimumReturnSeconds) * progress);
}
