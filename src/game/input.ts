// One-pointer input model in logical canvas units. The scene maps screen → logical
// coordinates; this module owns the gesture contract and the aim mapping.
import type { Tuning } from '../data/config';

export type PointerRole = 'aim' | 'catcher' | 'stale';

export interface TrackedPointer {
  id: number;
  role: PointerRole;
  startX: number;
  startY: number;
  x: number;
  y: number;
  /** Catcher centre when a catcher drag began, for relative movement. */
  catcherStartX: number;
}

/**
 * Launch angle in degrees above the rightward horizontal, from a drag of (dx, dy) in
 * logical units (dy positive = finger moved down). Drag steers a virtual aim point above
 * the launch position; it never changes power.
 */
export function aimAngleFromDrag(dx: number, dy: number, t: Tuning): number {
  const upward = -dy;
  const aimX = t.launchX + t.aim.horizontalGain * dx;
  const aimY = t.launchY - t.aim.baseHeight - t.aim.verticalGain * upward;
  let deg = (Math.atan2(t.launchY - aimY, aimX - t.launchX) * 180) / Math.PI;
  if (deg < 0) deg = aimX >= t.launchX ? t.aim.minAngleDeg : t.aim.maxAngleDeg;
  return Math.min(t.aim.maxAngleDeg, Math.max(t.aim.minAngleDeg, deg));
}

export function directionFromAngle(deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: Math.cos(rad), y: -Math.sin(rad) };
}

export class InputController {
  pointer: TrackedPointer | null = null;

  constructor(private readonly t: Tuning) {}

  inControlStrip(y: number): boolean {
    return y >= this.t.controlStrip.touchTop && y <= this.t.logicalHeight;
  }

  /**
   * Begin tracking a pointer. Secondary fingers, and any finger while one is already
   * tracked (including a stale one), are ignored.
   */
  begin(id: number, x: number, y: number, isPrimary: boolean, role: PointerRole, catcherX: number): TrackedPointer | null {
    if (!isPrimary || this.pointer !== null) return null;
    this.pointer = { id, role, startX: x, startY: y, x, y, catcherStartX: catcherX };
    return this.pointer;
  }

  move(id: number, x: number, y: number): TrackedPointer | null {
    if (!this.pointer || this.pointer.id !== id) return null;
    this.pointer.x = x;
    this.pointer.y = y;
    return this.pointer;
  }

  /** Stop tracking `id` and return the record it had, or null if it was not tracked. */
  end(id: number): TrackedPointer | null {
    if (!this.pointer || this.pointer.id !== id) return null;
    const p = this.pointer;
    this.pointer = null;
    return p;
  }

  /** Keep the finger tracked but make it inert: its moves and release do nothing. */
  makeStale(): void {
    if (this.pointer) this.pointer.role = 'stale';
  }

  /** Re-anchor a catcher drag (used when the catcher was moved by something else). */
  reanchor(catcherX: number): void {
    if (!this.pointer) return;
    this.pointer.startX = this.pointer.x;
    this.pointer.startY = this.pointer.y;
    this.pointer.catcherStartX = catcherX;
  }

  reset(): void {
    this.pointer = null;
  }

  aimAngle(): number {
    if (!this.pointer || this.pointer.role !== 'aim') return 90;
    return aimAngleFromDrag(this.pointer.x - this.pointer.startX, this.pointer.y - this.pointer.startY, this.t);
  }
}
