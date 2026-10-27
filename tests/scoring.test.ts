import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/data/config';
import { Board } from '../src/game/board';
import type { GameEvent } from '../src/game/events';
import { InteractionResolver } from '../src/game/interactions';
import { catcherWidthFor, coinsForRun, returnSecondsFor, RunScore, ShotScore } from '../src/game/scoring';

const shot = () => ShotScore.fromTuning(TUNING, 2);

describe('shot scoring', () => {
  it('check 1: seven 10-point crates score 30 + 60 + 30 = 120', () => {
    const s = shot();
    for (let i = 0; i < 7; i++) s.recordDestruction(10);
    expect(s.pending).toBe(120);
  });

  it('caps the ordinal multiplier at x5', () => {
    const s = shot();
    expect(s.multiplierFor(13)).toBe(5);
    expect(s.multiplierFor(40)).toBe(5);
  });

  it('check 2: a bell before the first destruction doubles that destruction only', () => {
    const s = shot();
    expect(s.ringBell(1)).toBe(true);
    expect(s.recordDestruction(10)).toMatchObject({ points: 20, bellBoost: true });
    expect(s.recordDestruction(10)).toMatchObject({ points: 10, bellBoost: false });
  });

  it('check 3: bell followed by another bell gives one x2, never x4', () => {
    const s = shot();
    s.ringBell(1);
    s.ringBell(2);
    expect(s.recordDestruction(10).points).toBe(20);
    expect(s.recordDestruction(10).points).toBe(10);
  });

  it('re-hitting the same bell in a shot has no effect; it works again next shot', () => {
    const s = shot();
    expect(s.ringBell(1)).toBe(true);
    s.recordDestruction(10);
    expect(s.ringBell(1)).toBe(false);
    expect(s.recordDestruction(10).bellBoost).toBe(false);
    s.reset();
    expect(s.ringBell(1)).toBe(true);
  });
});

describe('run scoring', () => {
  it('check 5: a miss after 120 pending adds 0 to banked score', () => {
    const s = shot();
    const run = new RunScore(TUNING.perfectCatchBonus);
    for (let i = 0; i < 7; i++) s.recordDestruction(10);
    expect(run.loseShot(s)).toBe(120);
    expect(run.banked).toBe(0);
    expect(s.pending).toBe(0);
  });

  it('check 6: a normal catch banks pending once; a perfect catch adds 25 once, unmultiplied', () => {
    const run = new RunScore(TUNING.perfectCatchBonus);
    const s = shot();
    for (let i = 0; i < 4; i++) s.recordDestruction(10);
    expect(run.bankCatch(s, false).banked).toBe(50);
    expect(run.bankCatch(s, false).banked).toBe(50); // nothing pending the second time
    s.recordDestruction(10);
    expect(run.bankCatch(s, true)).toMatchObject({ shotPoints: 10, bonus: 25, banked: 85 });
  });

  it('pays coins as floor(banked/100) capped, plus 1 for a catch; zero catches pays zero', () => {
    expect(coinsForRun(0, 0, TUNING)).toBe(0);
    expect(coinsForRun(250, 1, TUNING)).toBe(3);
    expect(coinsForRun(999_999, 40, TUNING)).toBe(26);
  });

  it('check 12: difficulty never narrows the catcher below 72 or the return below 0.65 s', () => {
    expect(catcherWidthFor(0, TUNING)).toBe(100);
    expect(catcherWidthFor(14, TUNING)).toBe(72);
    expect(catcherWidthFor(500, TUNING)).toBe(72);
    expect(returnSecondsFor(0, TUNING)).toBeCloseTo(0.9);
    expect(returnSecondsFor(15, TUNING)).toBeCloseTo(0.65);
    expect(returnSecondsFor(500, TUNING)).toBeCloseTo(0.65);
  });
});

describe('interaction resolver', () => {
  function setup() {
    const board = new Board();
    const s = shot();
    const events: GameEvent[] = [];
    const resolver = new InteractionResolver(board, s, (e) => events.push(e), 0.1);
    return { board, s, events, resolver };
  }

  it('check 4: overlapping explosions cannot destroy or score the same object twice', () => {
    const { board, s, events, resolver } = setup();
    const potA = board.add({ kind: 'paint_pot', x: 150, y: 200 }, 0, 0);
    board.add({ kind: 'paint_pot', x: 210, y: 200 }, 0, 0);
    // These crates sit inside both blast radii.
    board.add({ kind: 'crate', x: 180, y: 150 }, 0, 0);
    board.add({ kind: 'crate', x: 180, y: 250 }, 0, 0);
    resolver.onBallContact(potA, 0, 0, 1);
    resolver.update(1);
    const destroyed = events.filter((e) => e.type === 'TargetDestroyed').map((e) => (e as { id: number }).id);
    expect(destroyed.sort()).toEqual([1, 2, 3, 4]);
    expect(new Set(destroyed).size).toBe(destroyed.length);
    // Pot A (15), then blast victims by ID: pot B (15), crate (10), crate at ordinal 4 (x2 = 20).
    expect(s.pending).toBe(15 + 15 + 10 + 20);
    expect(resolver.pendingBlasts).toBe(0);
  });

  it('resolves simultaneous blast victims in stable ID order', () => {
    const { board, events, resolver } = setup();
    const pot = board.add({ kind: 'paint_pot', x: 180, y: 200 }, 0, 0);
    board.add({ kind: 'crate', x: 230, y: 200 }, 0, 0);
    board.add({ kind: 'crate', x: 130, y: 200 }, 0, 0);
    resolver.onBallContact(pot, 0, 0, 1);
    resolver.flush();
    const order = events.filter((e) => e.type === 'TargetDestroyed').map((e) => (e as { id: number }).id);
    expect(order).toEqual([1, 2, 3]);
  });

  it('a bell armed by the ball boosts the next blast destruction only', () => {
    const { board, s, resolver } = setup();
    const bell = board.add({ kind: 'bell', x: 60, y: 100 }, 0, 0);
    const crate = board.add({ kind: 'crate', x: 180, y: 300 }, 0, 0);
    resolver.onBallContact(bell, 0, 0, 1);
    resolver.onBallContact(bell, 0.1, 0, 1);
    resolver.onBallContact(crate, 0.2, 0, 1);
    expect(s.pending).toBe(20);
    expect(bell.destroyed).toBe(false);
  });
});
