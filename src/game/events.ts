// Simulation → presentation event contract. Presentation reacts; it never feeds back into rules.
import type { ObjectKind } from '../data/config';

export type GameState =
  | 'HOME'
  | 'AIM_READY'
  | 'AIMING'
  | 'FLIGHT'
  | 'RETURNING'
  | 'CATCH_SETTLE'
  | 'MISSED'
  | 'RESULTS'
  | 'PAUSED';

export interface RunSummary {
  runId: string;
  seed: number;
  rulesetVersion: string;
  banked: number;
  lostShot: number;
  catches: number;
  perfectCatches: number;
  shots: number;
  coinsEarned: number;
  best: number;
  newBest: boolean;
}

export type GameEvent =
  | { type: 'StateChanged'; from: GameState; to: GameState }
  | { type: 'RunStarted'; runId: string; seed: number }
  | { type: 'ShotLaunched'; angleDeg: number; x: number; y: number }
  | { type: 'WallHit'; x: number; y: number; nx: number; ny: number }
  | { type: 'TargetHit'; id: number; kind: ObjectKind; x: number; y: number; nx: number; ny: number }
  | {
      type: 'TargetDestroyed';
      id: number;
      kind: ObjectKind;
      x: number;
      y: number;
      cause: 'ball' | 'blast';
      points: number;
      ordinal: number;
      multiplier: number;
      bellBoost: boolean;
      pending: number;
    }
  | { type: 'BellArmed'; id: number; x: number; y: number }
  | { type: 'ExplosionQueued'; id: number; x: number; y: number; radius: number }
  | { type: 'ExplosionResolved'; id: number; x: number; y: number; radius: number }
  | { type: 'ReturnCommitted'; landingX: number; duration: number; early: boolean }
  | { type: 'BallCaught'; x: number; shotPoints: number; perfect: boolean; bonus: number; banked: number; catches: number }
  | { type: 'BallMissed'; x: number; lostPoints: number }
  | { type: 'BoardRefilled'; ids: number[]; full: boolean }
  | { type: 'RunEnded'; summary: RunSummary };

export type GameEventListener = (event: GameEvent) => void;
