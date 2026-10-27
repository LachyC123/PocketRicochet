// GameSession owns run state and the fixed-step simulation. It knows nothing about
// rendering; presentation reads its state and subscribes to its events.
import { objectDef, TUNING, type Tuning } from '../data/config';
import type { SaveRepository } from '../save/repository';
import { sweepBall, tracePreview, type ArenaWalls, type BallState } from './ball';
import { Board, type PlacedObject } from './board';
import type { GameEvent, GameEventListener, GameState, RunSummary } from './events';
import { createRng, FIRST_TEMPLATE, generateLayout, planRefill, TEMPLATES, type Rng } from './generation';
import { clamp, foldInto, lerp, quadBezier, quadBezierTangent, type Vec } from './geometry';
import { aimAngleFromDrag, directionFromAngle, InputController } from './input';
import { InteractionResolver } from './interactions';
import { catcherWidthFor, coinsForRun, returnSecondsFor, RunScore, ShotScore } from './scoring';

export const RULESET_VERSION = 'pass1.0';

const MISS_GRAVITY = 1400;
const CATCHER_EASE_RATE = 16;
const SETTLE_ROLL_RATE = 25;

export interface ReturnPath {
  p0: Vec;
  control: Vec;
  p1: Vec;
  duration: number;
  elapsed: number;
  landingX: number;
  markerSeconds: number;
  early: boolean;
}

export interface SessionOptions {
  tuning?: Tuning;
  save?: SaveRepository;
  seedSource?: () => number;
  runIdSource?: () => string;
}

let runCounter = 0;
function defaultRunId(): string {
  runCounter += 1;
  const c = globalThis.crypto as Crypto | undefined;
  return c?.randomUUID ? c.randomUUID() : `${Date.now().toString(36)}-${runCounter}`;
}

export class GameSession {
  readonly t: Tuning;
  readonly board = new Board();
  readonly input: InputController;
  readonly ball: BallState;
  readonly walls: ArenaWalls;
  readonly shot: ShotScore;
  run: RunScore;

  state: GameState = 'HOME';
  /** Session time in seconds; advances only while the simulation runs. */
  time = 0;
  catcherX: number;
  catcherWidth: number;
  runId = '';
  seed = 0;
  shots = 0;
  aimLock = 0;
  flightTime = 0;
  settleTime = 0;
  missTime = 0;
  returnPath: ReturnPath | null = null;
  lastSummary: RunSummary | null = null;
  /** True for a run that started before the player had ever caught a ball. */
  tutorialActive = false;

  private pausedFrom: GameState | null = null;
  private catcherTarget: number;
  private accumulator = 0;
  private clearedTimer = 0;
  private missVelocity: Vec = { x: 0, y: 0 };
  private resolver: InteractionResolver;
  private rng: Rng = createRng(1);
  private cosmeticRng: Rng = createRng(2);
  private templateIndex = FIRST_TEMPLATE;
  private runEnded = false;
  private listeners = new Set<GameEventListener>();
  private readonly save?: SaveRepository;
  private readonly seedSource: () => number;
  private readonly runIdSource: () => string;

  constructor(options: SessionOptions = {}) {
    this.t = options.tuning ?? TUNING;
    this.save = options.save;
    this.seedSource = options.seedSource ?? (() => Math.floor(Math.random() * 0xffffffff));
    this.runIdSource = options.runIdSource ?? defaultRunId;
    this.input = new InputController(this.t);
    this.walls = { left: this.t.arena.left, right: this.t.arena.right, top: this.t.arena.top };
    this.ball = { x: this.t.launchX, y: this.t.launchY, vx: 0, vy: 0 };
    this.catcherX = this.t.launchX;
    this.catcherTarget = this.catcherX;
    this.catcherWidth = this.t.catcherInitialWidth;
    this.shot = ShotScore.fromTuning(this.t, objectDef('bell').multiplier ?? 2);
    this.run = new RunScore(this.t.perfectCatchBonus);
    this.resolver = new InteractionResolver(this.board, this.shot, (e) => this.emit(e), this.t.blastChainDelaySeconds);
    // Show a board behind the home overlay.
    this.populate(generateLayout(FIRST_TEMPLATE, createRng(0x5eed), this.t).objects);
  }

  // ---- events -------------------------------------------------------------

  on(listener: GameEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: GameEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private setState(to: GameState): void {
    const from = this.state;
    if (from === to) return;
    this.state = to;
    this.emit({ type: 'StateChanged', from, to });
  }

  // ---- run lifecycle ------------------------------------------------------

  startRun(seed?: number): void {
    this.resolver.clear();
    this.input.makeStale();
    this.shot.reset();
    this.run = new RunScore(this.t.perfectCatchBonus);
    this.runId = this.runIdSource();
    this.seed = (seed ?? this.seedSource()) >>> 0;
    this.rng = createRng(this.seed);
    this.cosmeticRng = createRng(this.seed ^ 0x9e3779b9);
    this.templateIndex = FIRST_TEMPLATE;
    this.board.reset();
    this.populate(generateLayout(this.templateIndex, this.rng, this.t).objects);
    this.catcherWidth = catcherWidthFor(0, this.t);
    this.catcherX = this.t.launchX;
    this.catcherTarget = this.catcherX;
    this.resetBall();
    this.shots = 0;
    this.flightTime = 0;
    this.clearedTimer = 0;
    this.returnPath = null;
    this.aimLock = this.t.refillArrivalSeconds;
    this.accumulator = 0;
    this.pausedFrom = null;
    this.runEnded = false;
    this.lastSummary = null;
    this.tutorialActive = !(this.save?.data.tutorialSeen ?? false);
    this.emit({ type: 'RunStarted', runId: this.runId, seed: this.seed });
    this.setState('AIM_READY');
  }

  goHome(): void {
    this.resolver.clear();
    this.input.makeStale();
    this.pausedFrom = null;
    this.returnPath = null;
    this.resetBall();
    this.setState('HOME');
  }

  pause(): void {
    if (this.state === 'HOME' || this.state === 'RESULTS' || this.state === 'PAUSED') return;
    // An unlaunched aim is cancelled; during flight the catcher simply stays put.
    const resumeTo = this.state === 'AIMING' ? 'AIM_READY' : this.state;
    this.input.makeStale();
    this.pausedFrom = resumeTo;
    this.setState('PAUSED');
  }

  resume(): void {
    if (this.state !== 'PAUSED' || !this.pausedFrom) return;
    const to = this.pausedFrom;
    this.pausedFrom = null;
    this.accumulator = 0;
    this.catcherTarget = this.catcherX;
    this.setState(to);
  }

  get pausedState(): GameState | null {
    return this.pausedFrom;
  }

  private populate(objects: PlacedObject[]): number[] {
    return objects.map((o) => this.board.add(o, Math.floor(this.cosmeticRng() * 4), this.time).id);
  }

  private resetBall(): void {
    this.ball.x = this.catcherX;
    this.ball.y = this.t.launchY;
    this.ball.vx = 0;
    this.ball.vy = 0;
  }

  // ---- input ----------------------------------------------------------------

  pointerDown(id: number, x: number, y: number, isPrimary = true): void {
    const inStrip = this.input.inControlStrip(y);
    switch (this.state) {
      case 'AIM_READY':
        if (!inStrip) return;
        if (this.aimLock > 0) {
          this.input.begin(id, x, y, isPrimary, 'stale', this.catcherX);
          return;
        }
        if (this.input.begin(id, x, y, isPrimary, 'aim', this.catcherX)) this.setState('AIMING');
        return;
      case 'FLIGHT':
      case 'RETURNING':
        if (!inStrip) return;
        if (this.input.begin(id, x, y, isPrimary, 'catcher', this.catcherX)) this.catcherTarget = this.catcherX;
        return;
      case 'CATCH_SETTLE':
      case 'MISSED':
        // Track the finger so that holding it through the settle cannot launch.
        if (inStrip) this.input.begin(id, x, y, isPrimary, 'stale', this.catcherX);
        return;
      default:
        return;
    }
  }

  pointerMove(id: number, x: number, y: number): void {
    const p = this.input.move(id, x, y);
    if (!p || p.role !== 'catcher') return;
    if (this.state !== 'FLIGHT' && this.state !== 'RETURNING') return;
    this.catcherTarget = this.clampCatcher(p.catcherStartX + (x - p.startX));
  }

  pointerUp(id: number, x?: number, y?: number): void {
    if (x !== undefined && y !== undefined) this.pointerMove(id, x, y);
    const p = this.input.end(id);
    if (!p) return;
    if (p.role === 'aim' && this.state === 'AIMING') {
      this.launch(aimAngleFromDrag(p.x - p.startX, p.y - p.startY, this.t));
    }
  }

  pointerCancel(id: number): void {
    const p = this.input.end(id);
    if (p && p.role === 'aim' && this.state === 'AIMING') this.setState('AIM_READY');
  }

  /** Current aim angle while aiming, else null. */
  aimAngle(): number | null {
    return this.state === 'AIMING' ? this.input.aimAngle() : null;
  }

  aimPreview(): { x: number; y: number }[] | null {
    const angle = this.aimAngle();
    if (angle === null) return null;
    const dir = directionFromAngle(angle);
    return tracePreview(this.t.launchX, this.t.launchY, dir.x, dir.y, this.board.objects, this.walls, this.t.ballRadius, 900, this.t.aim.previewReflectLength).points;
  }

  private clampCatcher(x: number): number {
    const half = this.catcherWidth / 2;
    return clamp(x, this.t.arena.left + half, this.t.arena.right - half);
  }

  // ---- simulation -----------------------------------------------------------

  private simulating(): boolean {
    return this.state !== 'HOME' && this.state !== 'RESULTS' && this.state !== 'PAUSED';
  }

  update(frameSeconds: number): void {
    if (!this.simulating()) return;
    const dt = Math.min(Math.max(frameSeconds, 0), this.t.maxFrameSeconds);
    const h = this.t.simulationStepSeconds;
    this.accumulator += dt;
    const steps = Math.floor(this.accumulator / h + 1e-9);
    this.accumulator -= steps * h;
    const startC = this.catcherX;
    const endC = this.catcherTarget;
    for (let i = 0; i < steps; i++) {
      const prevC = this.catcherX;
      // Spread this frame's pointer motion across its steps so the catch sweep sees it.
      if (this.state === 'FLIGHT' || this.state === 'RETURNING') this.catcherX = lerp(startC, endC, (i + 1) / steps);
      this.step(h, prevC);
      if (!this.simulating()) break;
    }
    if (this.state !== 'FLIGHT' && this.state !== 'RETURNING') this.catcherTarget = this.catcherX;
  }

  private step(h: number, prevCatcherX: number): void {
    this.time += h;
    switch (this.state) {
      case 'AIM_READY':
      case 'AIMING':
        this.aimLock = Math.max(0, this.aimLock - h);
        this.catcherX += (this.t.launchX - this.catcherX) * (1 - Math.exp(-CATCHER_EASE_RATE * h));
        this.resetBall();
        break;
      case 'FLIGHT':
        this.stepFlight(h);
        break;
      case 'RETURNING':
        this.stepReturn(h, prevCatcherX);
        break;
      case 'CATCH_SETTLE':
        this.settleTime += h;
        // The ball rolls into the middle of the cup.
        this.ball.x += (this.catcherX - this.ball.x) * (1 - Math.exp(-SETTLE_ROLL_RATE * h));
        this.ball.y = this.t.launchY;
        if (this.settleTime >= this.t.catchSettleSeconds) this.finishSettle();
        break;
      case 'MISSED':
        this.missTime += h;
        this.missVelocity.y += MISS_GRAVITY * h;
        this.ball.x += this.missVelocity.x * h;
        this.ball.y += this.missVelocity.y * h;
        if (this.missTime >= this.t.missFallSeconds) this.endRun();
        break;
      default:
        break;
    }
  }

  private launch(angleDeg: number): void {
    const dir = directionFromAngle(angleDeg);
    this.ball.x = this.t.launchX;
    this.ball.y = this.t.launchY;
    this.ball.vx = dir.x * this.t.launchSpeed;
    this.ball.vy = dir.y * this.t.launchSpeed;
    this.flightTime = 0;
    this.clearedTimer = 0;
    this.shots += 1;
    this.shot.reset();
    this.catcherTarget = this.catcherX;
    this.emit({ type: 'ShotLaunched', angleDeg, x: this.ball.x, y: this.ball.y });
    this.setState('FLIGHT');
  }

  private stepFlight(h: number): void {
    this.flightTime += h;
    const stepStart = this.time - h;
    sweepBall(this.ball, h, this.board.objects, this.walls, this.t.ballRadius, this.t.maxCollisionIterations, (c) => {
      if (c.target.kind === 'wall') this.emit({ type: 'WallHit', x: c.x, y: c.y, nx: c.nx, ny: c.ny });
      else this.resolver.onBallContact(c.target.object, stepStart + c.time, c.nx, c.ny);
    });
    this.resolver.update(this.time);
    if (this.flightTime >= this.t.flightTimeoutSeconds) {
      this.commitReturn(false);
    } else if (this.ball.vy > 0 && this.ball.y >= this.t.returnCorridorTop) {
      this.commitReturn(true);
    } else if (this.board.destructibleCount() === 0 && this.resolver.pendingBlasts === 0) {
      // Nothing left to hit: don't make the player wait out the timeout.
      this.clearedTimer += h;
      if (this.clearedTimer >= this.t.clearedBoardReturnDelaySeconds) this.commitReturn(false);
    }
  }

  /** Landing x projected from the ball's position and heading, folded off the side walls. */
  projectLandingX(): number {
    const r = this.t.ballRadius;
    const minX = this.t.arena.left + r;
    const maxX = this.t.arena.right - r;
    const speed = Math.hypot(this.ball.vx, this.ball.vy) || 1;
    const down = Math.max(Math.abs(this.ball.vy), 0.35 * speed);
    const travel = (this.ball.vx / down) * (this.catchBallY - this.ball.y) * 0.6;
    return clamp(foldInto(this.ball.x + travel, minX, maxX), minX, maxX);
  }

  /** Ball-centre height at which a catch is decided (resting in the catcher). */
  get catchBallY(): number {
    return this.t.catcherY - this.t.catcherHeight / 2 - this.t.ballRadius;
  }

  get isFirstShotOfRun(): boolean {
    return this.shots === 1;
  }

  private commitReturn(early: boolean): void {
    const first = this.isFirstShotOfRun;
    const duration = first ? this.t.firstReturnSeconds : returnSecondsFor(this.run.catches, this.t);
    const landingX = this.projectLandingX();
    const r = this.t.ballRadius;
    const p0 = { x: this.ball.x, y: this.ball.y };
    const p1 = { x: landingX, y: this.catchBallY };
    const speed = Math.hypot(this.ball.vx, this.ball.vy) || 1;
    const lob = early ? 70 : 50;
    const control = {
      x: clamp((p0.x + p1.x) / 2 + (this.ball.vx / speed) * 30, this.t.arena.left + r, this.t.arena.right - r),
      y: clamp(Math.min(p0.y, p1.y) - lob, this.t.arena.top + r, p1.y),
    };
    this.returnPath = {
      p0, control, p1, duration, elapsed: 0, landingX,
      markerSeconds: first ? duration : Math.min(duration, this.t.landingMarkerSeconds),
      early,
    };
    this.emit({ type: 'ReturnCommitted', landingX, duration, early });
    this.setState('RETURNING');
  }

  private stepReturn(h: number, prevCatcherX: number): void {
    const rp = this.returnPath!;
    rp.elapsed += h;
    this.resolver.update(this.time);
    const s = Math.min(1, rp.elapsed / rp.duration);
    const pos = quadBezier(rp.p0, rp.control, rp.p1, s);
    this.ball.x = pos.x;
    this.ball.y = pos.y;
    if (s >= 1) this.resolveCatch(prevCatcherX);
  }

  /** Horizontal miss distance between the landing point and the catcher's swept span this step. */
  static sweptCatchDistance(landingX: number, catcherFrom: number, catcherTo: number): number {
    const lo = Math.min(catcherFrom, catcherTo);
    const hi = Math.max(catcherFrom, catcherTo);
    return landingX < lo ? lo - landingX : landingX > hi ? landingX - hi : 0;
  }

  private resolveCatch(prevCatcherX: number): void {
    const rp = this.returnPath!;
    const dist = GameSession.sweptCatchDistance(rp.landingX, prevCatcherX, this.catcherX);
    const reach = this.catcherWidth / 2 + this.t.catchToleranceBallFraction * this.t.ballRadius;
    if (dist <= reach) {
      const perfect = dist <= (this.t.perfectCatchWidthFraction * this.catcherWidth) / 2;
      // Settle all destruction from this shot before banking it.
      this.resolver.flush();
      const result = this.run.bankCatch(this.shot, perfect);
      this.ball.vx = 0;
      this.ball.vy = 0;
      this.settleTime = 0;
      this.input.makeStale();
      if (this.tutorialActive) this.save?.setTutorialSeen(true);
      this.emit({ type: 'BallCaught', x: rp.landingX, shotPoints: result.shotPoints, perfect, bonus: result.bonus, banked: result.banked, catches: this.run.catches });
      this.setState('CATCH_SETTLE');
    } else {
      this.resolver.clear();
      const lost = this.run.loseShot(this.shot);
      const tangent = quadBezierTangent(rp.p0, rp.control, rp.p1, 1);
      this.missVelocity = { x: tangent.x / rp.duration, y: Math.max(tangent.y / rp.duration, 120) };
      this.missTime = 0;
      this.input.makeStale();
      this.emit({ type: 'BallMissed', x: rp.landingX, lostPoints: lost });
      this.setState('MISSED');
    }
  }

  private finishSettle(): void {
    this.board.compact();
    this.catcherWidth = catcherWidthFor(this.run.catches, this.t);
    this.catcherX = this.clampCatcher(this.catcherX);
    this.catcherTarget = this.catcherX;
    this.returnPath = null;
    let added: number[] = [];
    let full = false;
    if (this.board.destructibleCount() === 0) {
      // Full clear: a fresh validated layout, only ever between shots.
      full = true;
      this.templateIndex = this.nextTemplateIndex();
      this.board.objects = [];
      added = this.populate(generateLayout(this.templateIndex, this.rng, this.t).objects);
    } else if (this.run.catches % this.t.refillEveryCatches === 0) {
      const existing = this.board.objects.map((o) => ({ kind: o.kind, x: o.x, y: o.y }));
      added = this.populate(planRefill(existing, this.t.refillObjectCount, this.rng, this.t));
    }
    if (added.length > 0) {
      this.aimLock = this.t.refillArrivalSeconds;
      this.emit({ type: 'BoardRefilled', ids: added, full });
    }
    this.setState('AIM_READY');
  }

  private nextTemplateIndex(): number {
    const others = TEMPLATES.map((_, i) => i).filter((i) => i !== this.templateIndex);
    return others[Math.floor(this.rng() * others.length)];
  }

  /** Settle the run exactly once; repeated calls are no-ops. */
  endRun(): void {
    if (this.runEnded) return;
    this.runEnded = true;
    const coins = coinsForRun(this.run.banked, this.run.catches, this.t);
    const settlement = this.save
      ? this.save.settleRun(this.runId, this.run.banked, coins)
      : { coinsAwarded: coins, best: this.run.banked, newBest: false, alreadySettled: false };
    const summary: RunSummary = {
      runId: this.runId,
      seed: this.seed,
      rulesetVersion: RULESET_VERSION,
      banked: this.run.banked,
      lostShot: this.run.lostShot,
      catches: this.run.catches,
      perfectCatches: this.run.perfectCatches,
      shots: this.shots,
      coinsEarned: settlement.coinsAwarded,
      best: settlement.best,
      newBest: settlement.newBest,
    };
    this.lastSummary = summary;
    this.emit({ type: 'RunEnded', summary });
    this.setState('RESULTS');
  }

  // ---- read-only helpers for presentation ----------------------------------

  get pendingBlasts(): number {
    return this.resolver.pendingBlasts;
  }

  /** Seconds left before the catch decision, or null outside a return. */
  returnRemaining(): number | null {
    if (this.state !== 'RETURNING' || !this.returnPath) return null;
    return Math.max(0, this.returnPath.duration - this.returnPath.elapsed);
  }

  landingMarkerVisible(): boolean {
    const remaining = this.returnRemaining();
    return remaining !== null && remaining <= this.returnPath!.markerSeconds + 1e-9;
  }

  tutorialHint(): string | null {
    if (!this.tutorialActive) return null;
    const aimingStates = this.state === 'AIM_READY' || this.state === 'AIMING';
    if (aimingStates && this.shots === 0) return 'Drag to aim. Lift to shoot.';
    if ((this.state === 'FLIGHT' || this.state === 'RETURNING') && this.shots === 1) return 'Slide to catch.';
    if ((aimingStates || this.state === 'CATCH_SETTLE') && this.shots === 1 && this.run.catches === 1) return 'Caught! Shoot again.';
    return null;
  }
}
