// Loads tuning.json and objects.json, validating shape and rejecting unknown fields
// so schema changes are deliberate rather than silently ignored.
import tuningJson from './tuning.json';
import objectsJson from './objects.json';

export interface Tuning {
  schemaVersion: number;
  logicalWidth: number;
  logicalHeight: number;
  arena: { left: number; right: number; top: number; bottom: number };
  ballRadius: number;
  launchSpeed: number;
  flightTimeoutSeconds: number;
  returnSeconds: number;
  minimumReturnSeconds: number;
  returnDifficultyCapCatch: number;
  landingMarkerSeconds: number;
  firstReturnSeconds: number;
  catcherY: number;
  launchY: number;
  catcherInitialWidth: number;
  catcherMinimumWidth: number;
  catcherShrinkPerCatch: number;
  perfectCatchWidthFraction: number;
  perfectCatchBonus: number;
  catchSettleSeconds: number;
  simulationStepSeconds: number;
  maxCollisionIterations: number;
  initialObjectCap: number;
  objectCap: number;
  refillEveryCatches: number;
  refillObjectCount: number;
  explosionRadius: number;
  coinScoreDivisor: number;
  coinScoreCap: number;
  completionCoinBonus: number;
  cosmeticPrices: number[];
  launchX: number;
  returnCorridorTop: number;
  controlStrip: { top: number; bottom: number; touchTop: number };
  aim: {
    horizontalGain: number;
    baseHeight: number;
    verticalGain: number;
    minAngleDeg: number;
    maxAngleDeg: number;
    previewReflectLength: number;
  };
  catcherHeight: number;
  catchToleranceBallFraction: number;
  missFallSeconds: number;
  blastChainDelaySeconds: number;
  clearedBoardReturnDelaySeconds: number;
  refillArrivalSeconds: number;
  maxFrameSeconds: number;
  scoreMultiplierEvery: number;
  scoreMultiplierCap: number;
  minimumObjectSeparation: number;
  minimumOpeningWidth: number;
  maxPlacementAttempts: number;
}

export type ObjectKind = 'crate' | 'paint_pot' | 'bell' | 'bumper' | 'jar' | 'armoured_tin';

export interface ObjectDef {
  id: ObjectKind;
  shape: 'box' | 'circle';
  width?: number;
  height?: number;
  radius?: number;
  hp: number | null;
  baseScore: number;
  behaviour: 'break' | 'explode' | 'arm_next_destruction_multiplier' | 'reflect';
  blastRadius?: number;
  multiplier?: number;
  oncePerShot?: boolean;
  minimumPass?: number;
}

type FieldSpec = 'number' | 'boolean' | 'string' | 'number[]' | 'number|null' | { [key: string]: FieldSpec };

const TUNING_SPEC: { [key: string]: FieldSpec } = {
  schemaVersion: 'number',
  logicalWidth: 'number',
  logicalHeight: 'number',
  arena: { left: 'number', right: 'number', top: 'number', bottom: 'number' },
  ballRadius: 'number',
  launchSpeed: 'number',
  flightTimeoutSeconds: 'number',
  returnSeconds: 'number',
  minimumReturnSeconds: 'number',
  returnDifficultyCapCatch: 'number',
  landingMarkerSeconds: 'number',
  firstReturnSeconds: 'number',
  catcherY: 'number',
  launchY: 'number',
  catcherInitialWidth: 'number',
  catcherMinimumWidth: 'number',
  catcherShrinkPerCatch: 'number',
  perfectCatchWidthFraction: 'number',
  perfectCatchBonus: 'number',
  catchSettleSeconds: 'number',
  simulationStepSeconds: 'number',
  maxCollisionIterations: 'number',
  initialObjectCap: 'number',
  objectCap: 'number',
  refillEveryCatches: 'number',
  refillObjectCount: 'number',
  explosionRadius: 'number',
  coinScoreDivisor: 'number',
  coinScoreCap: 'number',
  completionCoinBonus: 'number',
  cosmeticPrices: 'number[]',
  launchX: 'number',
  returnCorridorTop: 'number',
  controlStrip: { top: 'number', bottom: 'number', touchTop: 'number' },
  aim: {
    horizontalGain: 'number',
    baseHeight: 'number',
    verticalGain: 'number',
    minAngleDeg: 'number',
    maxAngleDeg: 'number',
    previewReflectLength: 'number',
  },
  catcherHeight: 'number',
  catchToleranceBallFraction: 'number',
  missFallSeconds: 'number',
  blastChainDelaySeconds: 'number',
  clearedBoardReturnDelaySeconds: 'number',
  refillArrivalSeconds: 'number',
  maxFrameSeconds: 'number',
  scoreMultiplierEvery: 'number',
  scoreMultiplierCap: 'number',
  minimumObjectSeparation: 'number',
  minimumOpeningWidth: 'number',
  maxPlacementAttempts: 'number',
};

const OBJECT_SPEC: { [key: string]: FieldSpec } = {
  id: 'string',
  shape: 'string',
  width: 'number',
  height: 'number',
  radius: 'number',
  hp: 'number|null',
  baseScore: 'number',
  behaviour: 'string',
  blastRadius: 'number',
  multiplier: 'number',
  oncePerShot: 'boolean',
  minimumPass: 'number',
};

function checkFields(value: unknown, spec: { [key: string]: FieldSpec }, path: string, requireAll: boolean): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${path}: expected object`);
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!(key in spec)) throw new Error(`${path}.${key}: unknown field`);
  }
  for (const [key, fieldSpec] of Object.entries(spec)) {
    const field = record[key];
    const fieldPath = `${path}.${key}`;
    if (field === undefined) {
      if (requireAll) throw new Error(`${fieldPath}: missing`);
      continue;
    }
    if (typeof fieldSpec === 'object') {
      checkFields(field, fieldSpec, fieldPath, true);
    } else if (fieldSpec === 'number[]') {
      if (!Array.isArray(field) || field.some((n) => typeof n !== 'number' || !Number.isFinite(n))) {
        throw new Error(`${fieldPath}: expected number[]`);
      }
    } else if (fieldSpec === 'number|null') {
      if (field !== null && (typeof field !== 'number' || !Number.isFinite(field))) {
        throw new Error(`${fieldPath}: expected number or null`);
      }
    } else if (fieldSpec === 'number') {
      if (typeof field !== 'number' || !Number.isFinite(field)) throw new Error(`${fieldPath}: expected number`);
    } else if (typeof field !== fieldSpec) {
      throw new Error(`${fieldPath}: expected ${fieldSpec}`);
    }
  }
}

export function validateTuning(raw: unknown): Tuning {
  checkFields(raw, TUNING_SPEC, 'tuning', true);
  const t = raw as Tuning;
  if (t.schemaVersion !== 2) throw new Error(`tuning.schemaVersion: unsupported ${t.schemaVersion}`);
  if (t.arena.left >= t.arena.right || t.arena.top >= t.arena.bottom) throw new Error('tuning.arena: inverted bounds');
  if (t.catcherMinimumWidth > t.catcherInitialWidth) throw new Error('tuning: catcher minimum exceeds initial width');
  if (t.minimumReturnSeconds > t.returnSeconds) throw new Error('tuning: minimum return exceeds return seconds');
  if (t.simulationStepSeconds <= 0 || t.simulationStepSeconds > 1 / 30) throw new Error('tuning.simulationStepSeconds: out of range');
  if (t.aim.minAngleDeg <= 0 || t.aim.maxAngleDeg >= 180 || t.aim.minAngleDeg >= t.aim.maxAngleDeg) {
    throw new Error('tuning.aim: angle range must lie strictly between 0 and 180 degrees');
  }
  return t;
}

const KINDS: ObjectKind[] = ['crate', 'paint_pot', 'bell', 'bumper', 'jar', 'armoured_tin'];
const BEHAVIOURS = ['break', 'explode', 'arm_next_destruction_multiplier', 'reflect'];

export function validateObjects(raw: unknown): Map<ObjectKind, ObjectDef> {
  if (typeof raw !== 'object' || raw === null) throw new Error('objects: expected object');
  for (const key of Object.keys(raw)) {
    if (key !== 'schemaVersion' && key !== 'objects') throw new Error(`objects.${key}: unknown field`);
  }
  const root = raw as { schemaVersion: number; objects: unknown };
  if (root.schemaVersion !== 1) throw new Error(`objects.schemaVersion: unsupported ${root.schemaVersion}`);
  if (!Array.isArray(root.objects)) throw new Error('objects.objects: expected array');
  const defs = new Map<ObjectKind, ObjectDef>();
  root.objects.forEach((obj, i) => {
    const path = `objects[${i}]`;
    checkFields(obj, OBJECT_SPEC, path, false);
    const def = obj as ObjectDef;
    if (!KINDS.includes(def.id)) throw new Error(`${path}.id: unknown kind ${def.id}`);
    if (!BEHAVIOURS.includes(def.behaviour)) throw new Error(`${path}.behaviour: unknown ${def.behaviour}`);
    if (def.shape === 'box') {
      if (!(def.width! > 0 && def.height! > 0)) throw new Error(`${path}: box needs width/height`);
    } else if (def.shape === 'circle') {
      if (!(def.radius! > 0)) throw new Error(`${path}: circle needs radius`);
    } else {
      throw new Error(`${path}.shape: unknown ${String(def.shape)}`);
    }
    if (def.behaviour === 'explode' && !(def.blastRadius! > 0)) throw new Error(`${path}: explode needs blastRadius`);
    if (defs.has(def.id)) throw new Error(`${path}.id: duplicate ${def.id}`);
    defs.set(def.id, def);
  });
  return defs;
}

export const TUNING: Tuning = validateTuning(tuningJson);
export const OBJECT_DEFS: Map<ObjectKind, ObjectDef> = validateObjects(objectsJson);

const paint = OBJECT_DEFS.get('paint_pot');
if (paint && paint.blastRadius !== TUNING.explosionRadius) {
  throw new Error('tuning.explosionRadius must match objects paint_pot.blastRadius');
}

export function objectDef(kind: ObjectKind): ObjectDef {
  const def = OBJECT_DEFS.get(kind);
  if (!def) throw new Error(`No object definition for ${kind}`);
  return def;
}
