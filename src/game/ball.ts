// Fixed-step ball flight with continuous collision against walls and board objects.
import type { BoardObject } from './board';
import { castShape, reflect, type CastHit } from './geometry';

export interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface ArenaWalls {
  left: number;
  right: number;
  top: number;
}

export type HitTarget =
  | { kind: 'wall'; wall: 'left' | 'right' | 'top' }
  | { kind: 'object'; object: BoardObject };

export interface SweepContact {
  target: HitTarget;
  /** Seconds into the swept interval at which contact happened. */
  time: number;
  x: number;
  y: number;
  nx: number;
  ny: number;
}

const SEPARATION_EPSILON = 0.01;

function castWalls(ball: BallState, walls: ArenaWalls, r: number, tMax: number): (CastHit & { wall: 'left' | 'right' | 'top' }) | null {
  let best: (CastHit & { wall: 'left' | 'right' | 'top' }) | null = null;
  const consider = (t: number, nx: number, ny: number, wall: 'left' | 'right' | 'top') => {
    const tt = Math.max(t, 0);
    if (tt <= tMax && (best === null || tt < best.t)) best = { t: tt, nx, ny, wall };
  };
  // A ball already past a wall plane while moving outward is caught at t=0, so it can never escape.
  if (ball.vx < 0) consider((walls.left + r - ball.x) / ball.vx, 1, 0, 'left');
  if (ball.vx > 0) consider((walls.right - r - ball.x) / ball.vx, -1, 0, 'right');
  if (ball.vy < 0) consider((walls.top + r - ball.y) / ball.vy, 0, 1, 'top');
  return best;
}

interface FirstContact {
  hit: CastHit;
  target: HitTarget;
}

/** Earliest contact within tMax seconds of straight-line travel, or null. */
export function findFirstContact(
  ball: BallState, tMax: number, objects: readonly BoardObject[], walls: ArenaWalls, r: number,
): FirstContact | null {
  let best: FirstContact | null = null;
  const wallHit = castWalls(ball, walls, r, tMax);
  if (wallHit) best = { hit: wallHit, target: { kind: 'wall', wall: wallHit.wall } };
  for (const obj of objects) {
    if (obj.destroyed) continue;
    const hit = castShape(ball.x, ball.y, ball.vx, ball.vy, obj.shape, r, tMax);
    // Ties go to the lower stable ID because objects are iterated in ID order.
    if (hit && (best === null || hit.t < best.hit.t)) best = { hit, target: { kind: 'object', object: obj } };
  }
  return best;
}

/** Move to the contact point, reflect, and separate by a small epsilon. */
function applyContact(ball: BallState, hit: CastHit): void {
  ball.x += ball.vx * hit.t;
  ball.y += ball.vy * hit.t;
  const v = reflect(ball.vx, ball.vy, hit.nx, hit.ny);
  ball.vx = v.x;
  ball.vy = v.y;
  ball.x += hit.nx * SEPARATION_EPSILON;
  ball.y += hit.ny * SEPARATION_EPSILON;
}

/**
 * Advance the ball by dt seconds, resolving every contact in time order.
 * `onContact` runs after each reflection and may destroy objects; destroyed objects
 * are skipped for the rest of the step. Returns the contacts in order.
 */
export function sweepBall(
  ball: BallState,
  dt: number,
  objects: readonly BoardObject[],
  walls: ArenaWalls,
  r: number,
  maxIterations: number,
  onContact?: (contact: SweepContact) => void,
): SweepContact[] {
  const contacts: SweepContact[] = [];
  let remaining = dt;
  let elapsed = 0;
  for (let iter = 0; iter < maxIterations; iter++) {
    const first = findFirstContact(ball, remaining, objects, walls, r);
    if (!first) {
      ball.x += ball.vx * remaining;
      ball.y += ball.vy * remaining;
      return contacts;
    }
    applyContact(ball, first.hit);
    remaining -= first.hit.t;
    elapsed += first.hit.t;
    const contact: SweepContact = { target: first.target, time: elapsed, x: ball.x, y: ball.y, nx: first.hit.nx, ny: first.hit.ny };
    contacts.push(contact);
    onContact?.(contact);
  }
  // Pathological contact (e.g. wedged in a corner): hold position for the rest of the step
  // rather than moving without collision checks, which could tunnel.
  if (import.meta.env?.DEV) console.warn('[ball] collision iteration cap reached', { ...ball });
  return contacts;
}

/**
 * Trace a preview path from a point along a direction: the segment to the first contact
 * and one reflected segment. Used for the aim guide only.
 */
export function tracePreview(
  x: number, y: number, dirX: number, dirY: number,
  objects: readonly BoardObject[], walls: ArenaWalls, r: number,
  maxLength: number, reflectLength: number,
): { points: { x: number; y: number }[]; hitObject: BoardObject | null } {
  const probe: BallState = { x, y, vx: dirX, vy: dirY };
  const points = [{ x, y }];
  const first = findFirstContact(probe, maxLength, objects, walls, r);
  if (!first) {
    points.push({ x: x + dirX * maxLength, y: y + dirY * maxLength });
    return { points, hitObject: null };
  }
  applyContact(probe, first.hit);
  points.push({ x: probe.x, y: probe.y });
  if (reflectLength > 0) {
    const second = findFirstContact(probe, reflectLength, objects, walls, r);
    const len = second ? second.hit.t : reflectLength;
    points.push({ x: probe.x + probe.vx * len, y: probe.y + probe.vy * len });
  }
  return { points, hitObject: first.target.kind === 'object' ? first.target.object : null };
}
