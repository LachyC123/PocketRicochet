// Seeded board generation: authored templates with safe variation, validated before use.
import type { ObjectKind, Tuning } from '../data/config';
import { tracePreview } from './ball';
import { shapeFor, isDestructible, type BoardObject, type PlacedObject } from './board';
import { shapeBounds, shapeGap, type Shape } from './geometry';

export type Rng = () => number;

/** Mulberry32: small, fast, seedable PRNG. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(rng: Rng, min: number, maxInclusive: number): number {
  return min + Math.floor(rng() * (maxInclusive - min + 1));
}

export interface Template {
  name: string;
  objects: PlacedObject[];
}

const crate = (x: number, y: number): PlacedObject => ({ kind: 'crate', x, y });
const pot = (x: number, y: number): PlacedObject => ({ kind: 'paint_pot', x, y });
const bell = (x: number, y: number): PlacedObject => ({ kind: 'bell', x, y });

/** Starter templates 1–3 from the content spec, authored for the 360×640 logical canvas. */
export const TEMPLATES: Template[] = [
  {
    // Direct hit teaches destruction; the side bell rewards an angled first shot.
    name: 'FIRST POP',
    objects: [
      crate(128, 146), crate(180, 146), crate(232, 146),
      crate(128, 186), crate(180, 186), crate(232, 186),
      pot(180, 244),
      bell(78, 236),
    ],
  },
  {
    // Mirrored side clusters; a left-wall bank links the bell to the paint pot beyond it.
    name: 'BANK SHOT',
    objects: [
      crate(66, 172), crate(110, 172), crate(66, 214),
      crate(294, 172), crate(250, 172), crate(294, 214),
      crate(160, 132), crate(200, 132),
      pot(60, 112),
      bell(46, 300),
    ],
  },
  {
    // Three pots within blast reach of each other; one accurate hit sets off the chain.
    name: 'DOMINO PAINT',
    objects: [
      pot(110, 206), pot(180, 186), pot(250, 206),
      crate(52, 150), crate(52, 192), crate(52, 234),
      crate(308, 150), crate(308, 192), crate(308, 234),
      crate(180, 104),
    ],
  },
];

export const FIRST_TEMPLATE = 0;

function toShapes(objects: readonly PlacedObject[]): Shape[] {
  return objects.map((o) => shapeFor(o.kind, o.x, o.y));
}

/** Pseudo board objects so validation can reuse the flight sweep code. */
function asProbeObjects(objects: readonly PlacedObject[]): BoardObject[] {
  return objects.map((o, i) => ({
    id: i + 1, kind: o.kind, x: o.x, y: o.y, shape: shapeFor(o.kind, o.x, o.y),
    hp: 1, destroyed: false, variant: 0, bornAt: 0,
  }));
}

function lowestPlacementY(t: Tuning): number {
  return t.returnCorridorTop - 2 * t.ballRadius - t.minimumObjectSeparation;
}

function shapeInBounds(shape: Shape, t: Tuning): boolean {
  const b = shapeBounds(shape);
  const sep = t.minimumObjectSeparation;
  return b.left >= t.arena.left + sep && b.right <= t.arena.right - sep && b.top >= t.arena.top + sep && b.bottom <= lowestPlacementY(t);
}

/** Launch angles (degrees) sampled for reachability checks. */
function sampleAngles(t: Tuning, step: number): number[] {
  const out: number[] = [];
  for (let a = t.aim.minAngleDeg; a <= t.aim.maxAngleDeg + 1e-9; a += step) out.push(a);
  return out;
}

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

export function validateLayout(objects: readonly PlacedObject[], t: Tuning): ValidationResult {
  if (objects.length > t.objectCap) return { ok: false, reason: 'too many objects' };
  const shapes = toShapes(objects);
  for (let i = 0; i < shapes.length; i++) {
    if (!shapeInBounds(shapes[i], t)) return { ok: false, reason: `object ${i} out of bounds` };
    for (let j = i + 1; j < shapes.length; j++) {
      if (shapeGap(shapes[i], shapes[j]) < t.minimumObjectSeparation) return { ok: false, reason: `objects ${i}/${j} too close` };
    }
  }
  if (!objects.some((o) => isDestructible(o.kind))) return { ok: false, reason: 'no destructible target' };

  const probes = asProbeObjects(objects);
  const walls = { left: t.arena.left, right: t.arena.right, top: t.arena.top };
  const toRad = Math.PI / 180;
  // Opening: a corridor as wide as minimumOpeningWidth reaches the upper region before touching anything.
  const upperRegionY = t.arena.top + 0.4 * (t.arena.bottom - t.arena.top);
  const openRadius = t.minimumOpeningWidth / 2;
  const open = sampleAngles(t, 2.5).some((deg) => {
    const trace = tracePreview(t.launchX, t.launchY, Math.cos(deg * toRad), -Math.sin(deg * toRad), probes, walls, openRadius, 800, 0);
    return trace.points[1].y <= upperRegionY;
  });
  if (!open) return { ok: false, reason: 'no opening into upper region' };
  // Accessible target: some direct launch line's first contact is a destructible object.
  const direct = sampleAngles(t, 1).some((deg) => {
    const trace = tracePreview(t.launchX, t.launchY, Math.cos(deg * toRad), -Math.sin(deg * toRad), probes, walls, t.ballRadius, 800, 0);
    return trace.hitObject !== null && isDestructible(trace.hitObject.kind);
  });
  if (!direct) return { ok: false, reason: 'no directly reachable destructible' };
  return { ok: true };
}

/** Mirror, then jitter positions slightly; structure stays authored. */
function varyTemplate(template: Template, rng: Rng, t: Tuning): PlacedObject[] {
  const mirror = rng() < 0.5;
  const offsetY = randomInt(rng, -6, 6);
  const centre = (t.arena.left + t.arena.right) / 2;
  return template.objects.map((o) => ({
    kind: o.kind,
    x: (mirror ? 2 * centre - o.x : o.x) + randomInt(rng, -2, 2),
    y: o.y + offsetY + randomInt(rng, -2, 2),
  }));
}

export interface GeneratedLayout {
  objects: PlacedObject[];
  templateName: string;
  usedFallback: boolean;
}

export function generateLayout(templateIndex: number, rng: Rng, t: Tuning): GeneratedLayout {
  const template = TEMPLATES[templateIndex % TEMPLATES.length];
  for (let attempt = 0; attempt < t.maxPlacementAttempts; attempt++) {
    const objects = varyTemplate(template, rng, t);
    if (objects.length <= t.initialObjectCap && validateLayout(objects, t).ok) {
      return { objects, templateName: template.name, usedFallback: false };
    }
  }
  return { objects: TEMPLATES[FIRST_TEMPLATE].objects.map((o) => ({ ...o })), templateName: TEMPLATES[FIRST_TEMPLATE].name, usedFallback: true };
}

const REFILL_KINDS: { kind: ObjectKind; weight: number }[] = [
  { kind: 'crate', weight: 0.6 },
  { kind: 'paint_pot', weight: 0.28 },
  { kind: 'bell', weight: 0.12 },
];

function pickRefillKind(rng: Rng): ObjectKind {
  let roll = rng();
  for (const entry of REFILL_KINDS) {
    if (roll < entry.weight) return entry.kind;
    roll -= entry.weight;
  }
  return 'crate';
}

/**
 * Choose up to `count` new objects that fit among `existing` without breaking validation.
 * Each object gets at most maxPlacementAttempts tries; failures are skipped, never forced.
 */
export function planRefill(existing: readonly PlacedObject[], count: number, rng: Rng, t: Tuning): PlacedObject[] {
  const added: PlacedObject[] = [];
  const room = Math.max(0, t.objectCap - existing.length);
  const target = Math.min(count, room);
  const minY = t.arena.top + 30;
  const maxY = lowestPlacementY(t) - 40;
  for (let n = 0; n < target; n++) {
    for (let attempt = 0; attempt < t.maxPlacementAttempts; attempt++) {
      const candidate: PlacedObject = {
        kind: pickRefillKind(rng),
        x: randomInt(rng, t.arena.left + 30, t.arena.right - 30),
        y: randomInt(rng, minY, maxY),
      };
      if (validateLayout([...existing, ...added, candidate], t).ok) {
        added.push(candidate);
        break;
      }
    }
  }
  return added;
}
