import type { ObjectKind } from '../src/data/config';
import type { GameEvent, GameState } from '../src/game/events';
import { GameSession } from '../src/game/session';
import { MemoryStorage, SaveRepository } from '../src/save/repository';

export const FRAME = 1 / 60;
export const STRIP_Y = 590;

export function makeSession(seed = 1234) {
  const storage = new MemoryStorage();
  const save = new SaveRepository(storage);
  let runs = 0;
  const session = new GameSession({ save, seedSource: () => seed, runIdSource: () => `run-${++runs}` });
  const events: GameEvent[] = [];
  session.on((e) => events.push(e));
  return { session, save, storage, events };
}

/** Replace the board with exactly these objects (IDs follow array order). */
export function setBoard(session: GameSession, objects: { kind: ObjectKind; x: number; y: number }[]) {
  session.board.reset();
  return objects.map((o) => session.board.add(o, 0, session.time));
}

export function runFrames(session: GameSession, seconds: number, frame = FRAME) {
  const n = Math.round(seconds / frame);
  for (let i = 0; i < n; i++) session.update(frame);
}

export function runUntil(session: GameSession, states: GameState[], maxSeconds = 10, frame = FRAME): boolean {
  const n = Math.round(maxSeconds / frame);
  for (let i = 0; i < n; i++) {
    if (states.includes(session.state)) return true;
    session.update(frame);
  }
  return states.includes(session.state);
}

/** Wait out the aim lock, then drag-and-release a shot at the given drag offset. */
export function shoot(session: GameSession, dx = 0, dy = 0, pointerId = 1) {
  runFrames(session, 0.3);
  session.pointerDown(pointerId, 180, STRIP_Y);
  session.pointerMove(pointerId, 180 + dx, STRIP_Y + dy);
  session.pointerUp(pointerId, 180 + dx, STRIP_Y + dy);
}

/** During a return, drag the catcher so its centre sits at x (relative drag). */
export function steerCatcherTo(session: GameSession, x: number, pointerId = 7) {
  session.pointerDown(pointerId, 100, STRIP_Y);
  session.pointerMove(pointerId, 100 + (x - session.catcherX), STRIP_Y);
}

export function count<T extends GameEvent['type']>(events: GameEvent[], type: T) {
  return events.filter((e) => e.type === type).length;
}
