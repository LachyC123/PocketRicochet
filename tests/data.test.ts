import { describe, expect, it } from 'vitest';
import tuningJson from '../src/data/tuning.json';
import objectsJson from '../src/data/objects.json';
import { TUNING, validateObjects, validateTuning } from '../src/data/config';
import { createRng, generateLayout, planRefill, TEMPLATES, validateLayout } from '../src/game/generation';
import { aimAngleFromDrag } from '../src/game/input';
import { defaultSave, MemoryStorage, SaveRepository } from '../src/save/repository';

describe('data validation', () => {
  it('accepts the shipped data', () => {
    expect(() => validateTuning(tuningJson)).not.toThrow();
    expect(validateObjects(objectsJson).size).toBe(6);
  });

  it('rejects unknown and mistyped fields', () => {
    expect(() => validateTuning({ ...tuningJson, surprise: 1 })).toThrow(/unknown field/);
    expect(() => validateTuning({ ...tuningJson, launchSpeed: '420' })).toThrow(/expected number/);
    expect(() => validateObjects({ ...objectsJson, objects: [{ ...objectsJson.objects[0], colour: 'red' }] })).toThrow(/unknown field/);
  });
});

describe('aim mapping', () => {
  it('a tap without drag fires straight up', () => {
    expect(aimAngleFromDrag(0, 0, TUNING)).toBe(90);
  });
  it('dragging right steers right, clamped to 25–155°', () => {
    expect(aimAngleFromDrag(50, 0, TUNING)).toBeLessThan(90);
    expect(aimAngleFromDrag(-50, 0, TUNING)).toBeGreaterThan(90);
    expect(aimAngleFromDrag(5000, 0, TUNING)).toBe(25);
    expect(aimAngleFromDrag(-5000, 0, TUNING)).toBe(155);
    expect(aimAngleFromDrag(20, 2000, TUNING)).toBe(25); // pulled far down: still upward and legal
  });
  it('upward drag steepens the shot', () => {
    expect(aimAngleFromDrag(60, -80, TUNING)).toBeGreaterThan(aimAngleFromDrag(60, 0, TUNING));
  });
});

describe('generation', () => {
  it('every authored template is valid as written', () => {
    for (const template of TEMPLATES) {
      expect(validateLayout(template.objects, TUNING), template.name).toEqual({ ok: true });
    }
  });

  it('seeded variation is reproducible and validated', () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (let i = 0; i < TEMPLATES.length; i++) {
        const a = generateLayout(i, createRng(seed), TUNING);
        const b = generateLayout(i, createRng(seed), TUNING);
        expect(a).toEqual(b);
        expect(validateLayout(a.objects, TUNING).ok).toBe(true);
        expect(a.objects.length).toBeLessThanOrEqual(TUNING.initialObjectCap);
      }
    }
  });

  it('rejects layouts that crowd the return corridor or overlap', () => {
    expect(validateLayout([{ kind: 'crate', x: 180, y: 450 }], TUNING).ok).toBe(false);
    expect(validateLayout([{ kind: 'crate', x: 180, y: 200 }, { kind: 'crate', x: 190, y: 200 }], TUNING).ok).toBe(false);
  });

  it('refill never exceeds the object cap', () => {
    const rng = createRng(9);
    let objects = generateLayout(0, rng, TUNING).objects;
    for (let i = 0; i < 20; i++) objects = [...objects, ...planRefill(objects, 2, rng, TUNING)];
    expect(objects.length).toBeLessThanOrEqual(TUNING.objectCap);
    expect(validateLayout(objects, TUNING).ok).toBe(true);
  });
});

describe('save repository', () => {
  it('falls back to the backup when the primary save is corrupt', () => {
    const storage = new MemoryStorage();
    const repo = new SaveRepository(storage);
    repo.settleRun('a', 300, 4);
    repo.settleRun('b', 100, 2);
    storage.setItem('pocket-ricochet/save', '{broken');
    const reloaded = new SaveRepository(storage);
    expect(reloaded.data.coins).toBe(4);
    expect(reloaded.data.bestByMode.normal).toBe(300);
  });

  it('keeps playing without storage', () => {
    const repo = new SaveRepository(null);
    expect(repo.available).toBe(false);
    expect(repo.settleRun('x', 10, 1).coinsAwarded).toBe(1);
    expect(repo.data).toMatchObject({ ...defaultSave(), coins: 1, bestByMode: { normal: 10 }, lastSettledRunId: 'x' });
  });

  it('marks storage unavailable when a write throws', () => {
    const repo = new SaveRepository({ getItem: () => null, setItem: () => { throw new Error('quota'); } });
    repo.settleRun('x', 10, 1);
    expect(repo.available).toBe(false);
  });
});
