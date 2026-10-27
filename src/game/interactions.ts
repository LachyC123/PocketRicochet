// Resolves ball contacts and paint blasts into destruction and score events exactly once.
import { objectDef } from '../data/config';
import type { Board, BoardObject } from './board';
import type { GameEvent } from './events';
import { pointShapeDistance } from './geometry';
import type { ShotScore } from './scoring';

interface QueuedBlast {
  sourceId: number;
  x: number;
  y: number;
  radius: number;
  at: number;
}

export class InteractionResolver {
  private queue: QueuedBlast[] = [];

  constructor(
    private readonly board: Board,
    private readonly score: ShotScore,
    private readonly emit: (event: GameEvent) => void,
    private readonly blastDelay: number,
  ) {}

  get pendingBlasts(): number {
    return this.queue.length;
  }

  /** The ball made entry contact with an object at session time `now`. */
  onBallContact(obj: BoardObject, now: number, nx: number, ny: number): void {
    if (obj.destroyed) return;
    this.emit({ type: 'TargetHit', id: obj.id, kind: obj.kind, x: obj.x, y: obj.y, nx, ny });
    const def = objectDef(obj.kind);
    if (def.behaviour === 'arm_next_destruction_multiplier') {
      if (this.score.ringBell(obj.id)) this.emit({ type: 'BellArmed', id: obj.id, x: obj.x, y: obj.y });
      return;
    }
    if (obj.hp === null) return;
    obj.hp -= 1;
    if (obj.hp <= 0) this.destroy(obj, now, 'ball');
  }

  /** Process blasts whose time has come, in (time, source ID) order. */
  update(now: number): void {
    while (this.queue.length > 0 && this.queue[0].at <= now) {
      this.detonate(this.queue.shift()!);
    }
  }

  /** Resolve every queued blast immediately, including blasts they trigger. */
  flush(): void {
    while (this.queue.length > 0) this.detonate(this.queue.shift()!);
  }

  clear(): void {
    this.queue = [];
  }

  private destroy(obj: BoardObject, now: number, cause: 'ball' | 'blast'): void {
    // Mark first so no later contact or overlapping blast can score this object again.
    obj.destroyed = true;
    obj.hp = 0;
    const def = objectDef(obj.kind);
    const result = this.score.recordDestruction(def.baseScore);
    this.emit({
      type: 'TargetDestroyed',
      id: obj.id,
      kind: obj.kind,
      x: obj.x,
      y: obj.y,
      cause,
      points: result.points,
      ordinal: result.ordinal,
      multiplier: result.multiplier,
      bellBoost: result.bellBoost,
      pending: this.score.pending,
    });
    if (def.behaviour === 'explode') {
      const blast: QueuedBlast = { sourceId: obj.id, x: obj.x, y: obj.y, radius: def.blastRadius!, at: now + this.blastDelay };
      this.insert(blast);
      this.emit({ type: 'ExplosionQueued', id: obj.id, x: obj.x, y: obj.y, radius: blast.radius });
    }
  }

  private insert(blast: QueuedBlast): void {
    let i = this.queue.length;
    while (i > 0) {
      const prev = this.queue[i - 1];
      if (prev.at < blast.at || (prev.at === blast.at && prev.sourceId < blast.sourceId)) break;
      i--;
    }
    this.queue.splice(i, 0, blast);
  }

  private detonate(blast: QueuedBlast): void {
    this.emit({ type: 'ExplosionResolved', id: blast.sourceId, x: blast.x, y: blast.y, radius: blast.radius });
    const victims = this.board.objects
      .filter((o) => !o.destroyed && o.hp !== null && pointShapeDistance(blast.x, blast.y, o.shape) <= blast.radius)
      .sort((a, b) => a.id - b.id);
    for (const victim of victims) {
      if (victim.destroyed || victim.hp === null) continue;
      victim.hp -= 1;
      if (victim.hp <= 0) this.destroy(victim, blast.at, 'blast');
    }
  }
}
