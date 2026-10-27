import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/data/config';
import { sweepBall } from '../src/game/ball';
import type { BoardObject } from '../src/game/board';
import { castCircle, castRoundedBox, foldInto } from '../src/game/geometry';
import { GameSession } from '../src/game/session';

const walls = { left: 20, right: 340, top: 78 };

function thinBox(x: number, y: number, hw: number, hh: number): BoardObject {
  return { id: 1, kind: 'crate', x, y, shape: { kind: 'box', x, y, hw, hh }, hp: 1, destroyed: false, variant: 0, bornAt: 0 };
}

describe('swept collision', () => {
  it('check 8: detects a ball crossing a thin target within a single step', () => {
    // 2-unit-thick target; the ball travels 300 units in this one step.
    const target = thinBox(180, 200, 30, 1);
    const ball = { x: 180, y: 350, vx: 0, vy: -3000 };
    const contacts = sweepBall(ball, 0.1, [target], walls, 7, 8);
    expect(contacts[0]?.target).toMatchObject({ kind: 'object' });
    expect(ball.vy).toBeGreaterThan(0);
    expect(ball.y).toBeGreaterThan(200);
  });

  it('check 8: the catch sweep sees a catcher that moved across the landing point between ticks', () => {
    // Catcher jumped from x=60 to x=300 in one tick; landing at 180 lies inside that sweep.
    expect(GameSession.sweptCatchDistance(180, 60, 300)).toBe(0);
    expect(GameSession.sweptCatchDistance(180, 300, 60)).toBe(0);
    expect(GameSession.sweptCatchDistance(40, 60, 300)).toBe(20);
  });

  it('only reports entry contacts (no re-hit while embedded or moving away)', () => {
    expect(castCircle(0, 0, 1, 0, 0, 0, 10, 100)).toBeNull();
    expect(castCircle(20, 0, 1, 0, 0, 0, 10, 100)).toBeNull();
    expect(castRoundedBox(0, 0, 1, 0, 0, 0, 10, 10, 5, 100)).toBeNull();
  });

  it('hits rounded box corners with a diagonal normal', () => {
    const hit = castRoundedBox(-20, -20, 1, 1, 0, 0, 10, 10, 5, 100)!;
    expect(hit).not.toBeNull();
    expect(hit.nx).toBeCloseTo(-Math.SQRT1_2, 5);
    expect(hit.ny).toBeCloseTo(-Math.SQRT1_2, 5);
  });

  it('preserves speed on reflection and never leaves the arena', () => {
    const ball = { x: 300, y: 100, vx: 420 * Math.cos(1), vy: -420 * Math.sin(1) };
    for (let i = 0; i < 2000; i++) {
      sweepBall(ball, TUNING.simulationStepSeconds, [], walls, 7, 8);
      expect(ball.x).toBeGreaterThanOrEqual(27 - 1e-6);
      expect(ball.x).toBeLessThanOrEqual(333 + 1e-6);
      expect(ball.y).toBeGreaterThanOrEqual(85 - 1e-6);
      if (ball.vy > 0 && ball.y > 400) ball.vy = -ball.vy; // keep it bouncing for the test
    }
    expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(420, 6);
  });

  it('a corner shot resolves through multiple contacts in one step', () => {
    const ball = { x: 30, y: 90, vx: -1000, vy: -1000 };
    const contacts = sweepBall(ball, 0.05, [], walls, 7, 8);
    expect(contacts.length).toBe(2);
    expect(ball.vx).toBeGreaterThan(0);
    expect(ball.vy).toBeGreaterThan(0);
  });

  it('folds projected landing positions back inside the span', () => {
    expect(foldInto(50, 0, 100)).toBe(50);
    expect(foldInto(120, 0, 100)).toBe(80);
    expect(foldInto(-30, 0, 100)).toBe(30);
    expect(foldInto(230, 0, 100)).toBe(30);
  });
});
