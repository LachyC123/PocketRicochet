import { describe, expect, it } from 'vitest';
import type { GameState } from '../src/game/events';
import { count, makeSession, runFrames, runUntil, setBoard, shoot, steerCatcherTo, STRIP_Y } from './helpers';

/** Play one shot and steer the catcher under the landing point during the return. */
function playCatch(session: ReturnType<typeof makeSession>['session'], dx = 0) {
  shoot(session, dx);
  expect(runUntil(session, ['RETURNING'])).toBe(true);
  steerCatcherTo(session, session.returnPath!.landingX);
  expect(runUntil(session, ['CATCH_SETTLE', 'MISSED'])).toBe(true);
  session.pointerUp(7);
}

describe('state machine', () => {
  it('walks HOME → AIM_READY → AIMING → FLIGHT → RETURNING → CATCH_SETTLE → AIM_READY', () => {
    const { session, events } = makeSession();
    expect(session.state).toBe('HOME');
    session.startRun();
    playCatch(session);
    runUntil(session, ['AIM_READY']);
    const path = events.filter((e) => e.type === 'StateChanged').map((e) => (e as { to: GameState }).to);
    expect(path).toEqual(['AIM_READY', 'AIMING', 'FLIGHT', 'RETURNING', 'CATCH_SETTLE', 'AIM_READY']);
  });

  it('a miss goes RETURNING → MISSED → RESULTS and loses only the pending shot', () => {
    const { session } = makeSession();
    session.startRun();
    shoot(session);
    runUntil(session, ['RETURNING']);
    // Park the catcher as far as possible from the landing point.
    const far = session.returnPath!.landingX < 180 ? 340 : 20;
    steerCatcherTo(session, far);
    expect(runUntil(session, ['MISSED'])).toBe(true);
    expect(runUntil(session, ['RESULTS'])).toBe(true);
    expect(session.lastSummary).toMatchObject({ banked: 0, catches: 0, coinsEarned: 0 });
  });

  it('every flight resolves: return commits by the 3.5 s timeout', () => {
    const { session } = makeSession();
    session.startRun();
    setBoard(session, [{ kind: 'crate', x: 60, y: 110 }]);
    shoot(session, 0, 0);
    // Force a shot that rattles sideways between the walls and never descends on its own.
    Object.assign(session.ball, { x: 180, y: 300, vx: 420, vy: 0 });
    runFrames(session, 3.3);
    expect(session.state).toBe('FLIGHT');
    runFrames(session, 0.3);
    expect(session.state).toBe('RETURNING');
  });

  it('a catch banks the shot; the first return is the forgiving 1.2 s one', () => {
    const { session, events } = makeSession();
    session.startRun();
    playCatch(session);
    const committed = events.find((e) => e.type === 'ReturnCommitted') as { duration: number };
    expect(committed.duration).toBeCloseTo(1.2);
    expect(session.state).toBe('CATCH_SETTLE');
    expect(count(events, 'BallCaught')).toBe(1);
    const caught = events.find((e) => e.type === 'BallCaught') as { banked: number; shotPoints: number; bonus: number };
    expect(caught.banked).toBe(caught.shotPoints + caught.bonus);
    expect(session.run.banked).toBe(caught.banked);
  });

  it('catches at the far left and right edges are possible', () => {
    for (const edge of [27, 333]) {
      const { session } = makeSession();
      session.startRun();
      shoot(session);
      runUntil(session, ['RETURNING']);
      session.returnPath!.landingX = edge;
      session.returnPath!.p1.x = edge;
      steerCatcherTo(session, edge);
      expect(runUntil(session, ['CATCH_SETTLE', 'MISSED'])).toBe(true);
      expect(session.state).toBe('CATCH_SETTLE');
    }
  });
});

describe('input contract', () => {
  it('check 9: an old pointer-up after a catch cannot launch', () => {
    const { session } = makeSession();
    session.startRun();
    shoot(session);
    runUntil(session, ['RETURNING']);
    steerCatcherTo(session, session.returnPath!.landingX, 9); // finger 9 stays down
    runUntil(session, ['AIM_READY']);
    const shots = session.shots;
    session.pointerMove(9, 250, STRIP_Y - 40);
    session.pointerUp(9, 250, STRIP_Y - 40);
    expect(session.state).toBe('AIM_READY');
    expect(session.shots).toBe(shots);
    // A fresh touch does aim and launch.
    session.pointerDown(10, 180, STRIP_Y);
    expect(session.state).toBe('AIMING');
    session.pointerUp(10, 180, STRIP_Y);
    expect(session.state).toBe('FLIGHT');
  });

  it('check 9: an old pointer-up after pause/resume cannot launch', () => {
    const { session } = makeSession();
    session.startRun();
    runFrames(session, 0.3);
    session.pointerDown(1, 180, STRIP_Y);
    expect(session.state).toBe('AIMING');
    session.pause();
    expect(session.state).toBe('PAUSED');
    session.resume();
    expect(session.state).toBe('AIM_READY');
    session.pointerUp(1, 180, STRIP_Y);
    expect(session.state).toBe('AIM_READY');
    expect(session.shots).toBe(0);
  });

  it('ignores secondary fingers and touches outside the control strip', () => {
    const { session } = makeSession();
    session.startRun();
    runFrames(session, 0.3);
    session.pointerDown(1, 180, 300);
    expect(session.state).toBe('AIM_READY');
    session.pointerDown(2, 180, STRIP_Y, false);
    expect(session.state).toBe('AIM_READY');
    session.pointerDown(3, 180, STRIP_Y);
    session.pointerDown(4, 100, STRIP_Y);
    session.pointerUp(4, 100, STRIP_Y);
    expect(session.state).toBe('AIMING');
  });

  it('pointer cancel cancels an unlaunched aim', () => {
    const { session } = makeSession();
    session.startRun();
    runFrames(session, 0.3);
    session.pointerDown(1, 180, STRIP_Y);
    session.pointerCancel(1);
    expect(session.state).toBe('AIM_READY');
    expect(session.shots).toBe(0);
  });

  it('relative catcher drag: regripping never teleports the catcher', () => {
    const { session } = makeSession();
    session.startRun();
    setBoard(session, [{ kind: 'bell', x: 180, y: 120 }]);
    shoot(session);
    session.pointerDown(5, 300, STRIP_Y);
    session.pointerMove(5, 260, STRIP_Y);
    runFrames(session, 0.05);
    expect(session.catcherX).toBeCloseTo(140, 3);
    session.pointerUp(5);
    session.pointerDown(6, 40, STRIP_Y); // far-left regrip
    runFrames(session, 0.05);
    expect(session.catcherX).toBeCloseTo(140, 3);
    session.pointerMove(6, 1000, STRIP_Y); // clamped to arena
    runFrames(session, 0.05);
    expect(session.catcherX).toBe(340 - session.catcherWidth / 2);
  });
});

describe('board lifecycle', () => {
  it('check 10: clearing the board refills only after the catch', () => {
    const { session, events } = makeSession();
    session.startRun();
    setBoard(session, [{ kind: 'crate', x: 180, y: 200 }]);
    shoot(session);
    expect(runUntil(session, ['RETURNING'])).toBe(true);
    expect(session.board.destructibleCount()).toBe(0);
    expect(count(events, 'BoardRefilled')).toBe(0);
    steerCatcherTo(session, session.returnPath!.landingX);
    runUntil(session, ['CATCH_SETTLE']);
    expect(count(events, 'BoardRefilled')).toBe(0);
    runUntil(session, ['AIM_READY']);
    const refill = events.find((e) => e.type === 'BoardRefilled') as { full: boolean; ids: number[] };
    expect(refill.full).toBe(true);
    expect(session.board.destructibleCount()).toBeGreaterThan(0);
    expect(session.aimLock).toBeGreaterThan(0);
  });

  it('a cleared board commits the return early instead of waiting out the timeout', () => {
    const { session } = makeSession();
    session.startRun();
    setBoard(session, [{ kind: 'crate', x: 180, y: 200 }]);
    shoot(session);
    runFrames(session, 1.2);
    expect(session.state).toBe('RETURNING');
  });

  it('adds up to two objects after every third catch, capped at 18', () => {
    const { session, events } = makeSession();
    session.startRun();
    for (let i = 0; i < 3; i++) {
      // Keep the board from clearing: indestructible bells plus far-away crates.
      if (i === 0) setBoard(session, [{ kind: 'crate', x: 50, y: 110 }, { kind: 'crate', x: 310, y: 110 }, { kind: 'bell', x: 180, y: 200 }]);
      playCatch(session);
      runUntil(session, ['AIM_READY']);
    }
    expect(session.run.catches).toBe(3);
    const refill = events.find((e) => e.type === 'BoardRefilled') as { full: boolean; ids: number[] } | undefined;
    expect(refill?.full).toBe(false);
    expect(refill!.ids.length).toBeGreaterThan(0);
    expect(refill!.ids.length).toBeLessThanOrEqual(2);
    expect(session.board.objects.length).toBeLessThanOrEqual(18);
  });

  it('check 11: retry removes delayed explosions and resets run state', () => {
    const { session } = makeSession();
    session.startRun();
    setBoard(session, [
      { kind: 'paint_pot', x: 180, y: 300 },
      { kind: 'paint_pot', x: 180, y: 240 },
      { kind: 'paint_pot', x: 180, y: 180 },
    ]);
    shoot(session);
    // Run until the first pot breaks and a blast is queued.
    for (let i = 0; i < 200 && session.pendingBlasts === 0; i++) session.update(1 / 120);
    expect(session.pendingBlasts).toBeGreaterThan(0);
    session.pause();
    session.startRun();
    expect(session.pendingBlasts).toBe(0);
    expect(session.shot.pending).toBe(0);
    expect(session.shot.bellArmed).toBe(false);
    expect(session.run.banked).toBe(0);
    expect(session.state).toBe('AIM_READY');
    runFrames(session, 1);
    expect(session.shot.pending).toBe(0);
  });

  it('20 consecutive retries do not accumulate objects, listeners or blasts', () => {
    const { session } = makeSession();
    for (let i = 0; i < 20; i++) {
      session.startRun();
      shoot(session);
      runFrames(session, 0.5);
    }
    session.startRun();
    expect(session.board.objects.length).toBeLessThanOrEqual(12);
    expect(session.pendingBlasts).toBe(0);
  });
});

describe('run settlement', () => {
  it('check 7: ending a run twice pays coins once', () => {
    const { session, save } = makeSession();
    session.startRun();
    playCatch(session);
    runUntil(session, ['AIM_READY']);
    session.run.banked = 450;
    session.endRun();
    session.endRun();
    expect(save.data.coins).toBe(5);
    // Even a second settle call against the save for the same run pays nothing.
    expect(save.settleRun(session.runId, 450, 5).coinsAwarded).toBe(0);
    expect(save.data.coins).toBe(5);
    expect(save.data.bestByMode.normal).toBe(450);
  });

  it('the tutorial is marked seen after the first catch and persists', () => {
    const { session, save, storage } = makeSession();
    session.startRun();
    expect(session.tutorialHint()).toBe('Drag to aim. Lift to shoot.');
    shoot(session);
    expect(session.tutorialHint()).toBe('Slide to catch.');
    runUntil(session, ['RETURNING']);
    steerCatcherTo(session, session.returnPath!.landingX);
    runUntil(session, ['AIM_READY']);
    expect(session.tutorialHint()).toBe('Caught! Shoot again.');
    expect(save.data.tutorialSeen).toBe(true);
    expect(JSON.parse(storage.getItem('pocket-ricochet/save')!).tutorialSeen).toBe(true);
  });
});

describe('determinism', () => {
  it('same seed + same shot give the same outcome at 120, 60 and 30 fps', () => {
    const outcomes = [1 / 120, 1 / 60, 1 / 30].map((frame) => {
      const { session, events } = makeSession(42);
      session.startRun();
      runFrames(session, 0.3, frame);
      session.pointerDown(1, 180, STRIP_Y);
      session.pointerMove(1, 150, STRIP_Y - 30);
      session.pointerUp(1, 150, STRIP_Y - 30);
      runUntil(session, ['RETURNING'], 10, frame);
      return {
        destroyed: events.filter((e) => e.type === 'TargetDestroyed').map((e) => (e as { id: number }).id),
        pending: session.shot.pending,
        landing: Math.round(session.returnPath!.landingX * 1000),
      };
    });
    expect(outcomes[0].destroyed.length).toBeGreaterThan(0);
    expect(outcomes[1]).toEqual(outcomes[0]);
    expect(outcomes[2]).toEqual(outcomes[0]);
  });
});
