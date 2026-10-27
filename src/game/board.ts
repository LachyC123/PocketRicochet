// Board objects are plain simulation records; presentation reads them but never owns them.
import { objectDef, type ObjectKind } from '../data/config';
import type { Shape } from './geometry';

export interface BoardObject {
  /** Stable ID, increasing in creation order within a run; used as the deterministic tie-breaker. */
  id: number;
  kind: ObjectKind;
  x: number;
  y: number;
  shape: Shape;
  hp: number | null;
  destroyed: boolean;
  /** Cosmetic variant index chosen from the cosmetic RNG stream. */
  variant: number;
  /** Session time the object appeared, for arrival animation. */
  bornAt: number;
}

export interface PlacedObject {
  kind: ObjectKind;
  x: number;
  y: number;
}

export function shapeFor(kind: ObjectKind, x: number, y: number): Shape {
  const def = objectDef(kind);
  if (def.shape === 'circle') return { kind: 'circle', x, y, radius: def.radius! };
  return { kind: 'box', x, y, hw: def.width! / 2, hh: def.height! / 2 };
}

export function isDestructible(kind: ObjectKind): boolean {
  return objectDef(kind).hp !== null;
}

export class Board {
  objects: BoardObject[] = [];
  private nextId = 1;

  reset(): void {
    this.objects = [];
    this.nextId = 1;
  }

  add(placed: PlacedObject, variant: number, bornAt: number): BoardObject {
    const def = objectDef(placed.kind);
    const obj: BoardObject = {
      id: this.nextId++,
      kind: placed.kind,
      x: placed.x,
      y: placed.y,
      shape: shapeFor(placed.kind, placed.x, placed.y),
      hp: def.hp,
      destroyed: false,
      variant,
      bornAt,
    };
    this.objects.push(obj);
    return obj;
  }

  /** Drop destroyed records; called between shots so IDs and visuals settle. */
  compact(): void {
    this.objects = this.objects.filter((o) => !o.destroyed);
  }

  active(): BoardObject[] {
    return this.objects.filter((o) => !o.destroyed);
  }

  destructibleCount(): number {
    let n = 0;
    for (const o of this.objects) if (!o.destroyed && isDestructible(o.kind)) n++;
    return n;
  }

  get(id: number): BoardObject | undefined {
    return this.objects.find((o) => o.id === id);
  }
}
