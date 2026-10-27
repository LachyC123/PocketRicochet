// Presentation: draws the session, routes pointers, and turns events into sound and effects.
// It holds no rules; everything it shows is read from GameSession.
import Phaser from 'phaser';
import { objectDef, TUNING } from '../data/config';
import type { GameEvent } from '../game/events';
import { GameSession } from '../game/session';
import { SaveRepository } from '../save/repository';
import { Sfx } from '../ui/audio';
import { Button } from '../ui/button';
import * as Draw from '../ui/draw';
import { Effects } from '../ui/effects';
import { CSS, FONT, PALETTE } from '../ui/palette';

const T = TUNING;
const PLAY_STATES = new Set(['AIM_READY', 'AIMING', 'FLIGHT', 'RETURNING', 'CATCH_SETTLE', 'MISSED']);

interface ObjectVis {
  swing: number;
  swingVel: number;
}

interface Popup {
  text: Phaser.GameObjects.Text;
  life: number;
  vy: number;
}

export class GameScene extends Phaser.Scene {
  session!: GameSession;
  private save!: SaveRepository;
  private sfx = new Sfx();
  private fx = new Effects();
  private zoomFactor = 1;
  private reducedMotion = false;
  private motionQuery: MediaQueryList | null = null;

  private worldG!: Phaser.GameObjects.Graphics;
  private fxG!: Phaser.GameObjects.Graphics;
  private ballG!: Phaser.GameObjects.Graphics;
  private hudG!: Phaser.GameObjects.Graphics;
  private uiG!: Phaser.GameObjects.Graphics;

  private scoreText!: Phaser.GameObjects.Text;
  private pendingLabel!: Phaser.GameObjects.Text;
  private pendingText!: Phaser.GameObjects.Text;
  private bellBadge!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private noticeText!: Phaser.GameObjects.Text;
  private homeTexts: Phaser.GameObjects.Text[] = [];
  private homeBest!: Phaser.GameObjects.Text;
  private pauseTitle!: Phaser.GameObjects.Text;
  private results: Record<'heading' | 'label' | 'score' | 'best' | 'stats' | 'lost', Phaser.GameObjects.Text> = {} as never;
  private popups: Popup[] = [];

  private pauseBtn!: Button;
  private playBtn!: Button;
  private homeSoundBtn!: Button;
  private resumeBtn!: Button;
  private restartBtn!: Button;
  private pauseHomeBtn!: Button;
  private soundBtn!: Button;
  private motionBtn!: Button;
  private tutorialBtn!: Button;
  private retryBtn!: Button;
  private resultsHomeBtn!: Button;
  private buttons: Button[] = [];
  private uiPointer: { id: number; button: Button } | null = null;

  private vis = new Map<number, ObjectVis>();
  /** Pots already destroyed whose blast is still queued: they swell, then burst. */
  private primedPots = new Map<number, { x: number; y: number; radius: number; variant: number; age: number }>();
  private trail: { x: number; y: number }[] = [];
  private armedBellId: number | null = null;
  private launchFx = 99;
  private catchDip = 99;
  private aimTime = 0;
  private idleTime = 0;
  private shakeTime = 0;
  private displayScore = 0;
  private catcherDrawWidth = T.catcherInitialWidth;
  private clock = 0;

  constructor() {
    super('game');
  }

  init(data: { zoom?: number }): void {
    this.zoomFactor = data.zoom ?? 1;
  }

  create(): void {
    const cam = this.cameras.main;
    cam.setZoom(this.zoomFactor);
    cam.centerOn(T.logicalWidth / 2, T.logicalHeight / 2);
    cam.setBackgroundColor(PALETTE.ink);

    this.save = SaveRepository.fromBrowser();
    this.sfx.enabled = this.save.data.settings.sound;
    this.session = new GameSession({ save: this.save });
    this.session.on((e) => this.onEvent(e));
    this.motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
    this.applyMotionSetting();

    Draw.drawCabinet(this.add.graphics().setDepth(0), T);
    this.worldG = this.add.graphics().setDepth(10);
    this.fxG = this.add.graphics().setDepth(20);
    this.ballG = this.add.graphics().setDepth(30);
    this.hudG = this.add.graphics().setDepth(40);
    this.uiG = this.add.graphics().setDepth(60);

    this.createHud();
    this.createOverlays();
    this.bindInput();
    this.refreshOverlay();

    if (new URLSearchParams(window.location.search).has('qa')) {
      (window as unknown as { __pocketRicochet: unknown }).__pocketRicochet = { session: this.session, scene: this };
    }
  }

  // ---- construction -------------------------------------------------------

  private text(x: number, y: number, str: string, size: number, color: string, depth = 41): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: '900', color })
      .setResolution(this.zoomFactor)
      .setDepth(depth);
  }

  private button(x: number, y: number, w: number, h: number, label: string, style: 'primary' | 'secondary' | 'icon', onTap: () => void, depth = 60): Button {
    const b = new Button(this, x, y, w, h, label, style, onTap, this.zoomFactor, depth);
    this.buttons.push(b);
    return b;
  }

  private createHud(): void {
    this.text(24, 11, 'SCORE', 11, CSS.cream).setAlpha(0.6);
    this.scoreText = this.text(22, 22, '0', 28, CSS.cream);
    this.pendingLabel = this.text(180, 11, 'THIS SHOT', 11, CSS.cream).setOrigin(0.5, 0).setAlpha(0.6);
    this.pendingText = this.text(180, 24, '+0', 22, CSS.yellow).setOrigin(0.5, 0);
    this.bellBadge = this.text(0, 36, '×2', 15, CSS.ink, 42).setOrigin(0.5);
    this.hintText = this.text(180, (T.controlStrip.top + T.controlStrip.bottom) / 2, '', 17, CSS.cream).setOrigin(0.5);
    this.noticeText = this.text(180, 632, 'Progress cannot be saved on this device', 10, CSS.cream, 70).setOrigin(0.5, 1).setAlpha(0.7);
    this.pauseBtn = this.button(316, 32, 46, 42, 'II', 'icon', () => this.session.pause(), 45);
    for (let i = 0; i < 4; i++) {
      const text = this.text(0, 0, '', 20, CSS.yellow, 36).setOrigin(0.5).setStroke(CSS.ink, 5).setVisible(false);
      this.popups.push({ text, life: 0, vy: 0 });
    }
  }

  private createOverlays(): void {
    const title1 = this.text(180, 196, 'POCKET', 46, CSS.cream, 61).setOrigin(0.5).setStroke(CSS.ink, 10);
    const title2 = this.text(180, 246, 'RICOCHET', 46, CSS.coral, 61).setOrigin(0.5).setStroke(CSS.ink, 10);
    const tagline = this.text(180, 292, 'One ball. One thumb. Catch it.', 15, CSS.cream, 61).setOrigin(0.5);
    this.homeBest = this.text(180, 322, '', 14, CSS.yellow, 61).setOrigin(0.5);
    this.homeTexts = [title1, title2, tagline, this.homeBest];
    this.playBtn = this.button(180, 390, 210, 66, 'PLAY', 'primary', () => this.session.startRun());
    this.homeSoundBtn = this.button(180, 468, 150, 44, '', 'secondary', () => this.toggleSound());

    this.pauseTitle = this.text(180, 182, 'PAUSED', 28, CSS.ink, 61).setOrigin(0.5);
    this.resumeBtn = this.button(180, 244, 224, 58, 'RESUME', 'primary', () => this.session.resume());
    this.restartBtn = this.button(180, 308, 224, 46, 'Restart', 'secondary', () => this.session.startRun());
    this.pauseHomeBtn = this.button(180, 362, 224, 46, 'Home', 'secondary', () => this.session.goHome());
    this.soundBtn = this.button(119, 420, 102, 44, '', 'secondary', () => this.toggleSound());
    this.motionBtn = this.button(241, 420, 102, 44, '', 'secondary', () => this.toggleMotion());
    this.tutorialBtn = this.button(180, 474, 224, 44, 'Replay tutorial', 'secondary', () => {
      this.save.setTutorialSeen(false);
      this.tutorialBtn.setLabel('Tutorial next run');
    });

    this.results.heading = this.text(180, 186, '', 19, CSS.ink, 61).setOrigin(0.5);
    this.results.label = this.text(180, 222, 'SCORE', 12, CSS.ink, 61).setOrigin(0.5).setAlpha(0.6);
    this.results.score = this.text(180, 258, '0', 50, CSS.coral, 61).setOrigin(0.5).setStroke(CSS.ink, 5);
    this.results.best = this.text(180, 302, '', 15, CSS.ink, 61).setOrigin(0.5);
    this.results.stats = this.text(180, 336, '', 15, CSS.ink, 61).setOrigin(0.5);
    this.results.lost = this.text(180, 362, '', 13, CSS.coral, 61).setOrigin(0.5);
    this.retryBtn = this.button(180, 420, 224, 62, 'RETRY', 'primary', () => this.session.startRun());
    this.resultsHomeBtn = this.button(180, 486, 140, 44, 'Home', 'secondary', () => this.session.goHome());
  }

  private bindInput(): void {
    const toLogical = (p: Phaser.Input.Pointer) => this.cameras.main.getWorldPoint(p.x, p.y);
    const isPrimary = (p: Phaser.Input.Pointer) => {
      const e = p.event as PointerEvent | undefined;
      return e?.isPrimary ?? true;
    };
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      this.sfx.unlock();
      const w = toLogical(p);
      const hit = this.buttons.find((b) => b.contains(w.x, w.y));
      if (hit) {
        hit.pressed = true;
        this.uiPointer = { id: p.id, button: hit };
        return;
      }
      this.idleTime = 0;
      this.session.pointerDown(p.id, w.x, w.y, isPrimary(p));
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      const w = toLogical(p);
      if (this.uiPointer?.id === p.id) {
        this.uiPointer.button.pressed = this.uiPointer.button.contains(w.x, w.y);
        return;
      }
      this.session.pointerMove(p.id, w.x, w.y);
    });
    const up = (p: Phaser.Input.Pointer) => {
      const w = toLogical(p);
      if (this.uiPointer?.id === p.id) {
        const { button } = this.uiPointer;
        this.uiPointer = null;
        const tapped = button.contains(w.x, w.y);
        button.pressed = false;
        if (tapped) button.onTap();
        return;
      }
      if (p.wasCanceled) this.session.pointerCancel(p.id);
      else this.session.pointerUp(p.id, w.x, w.y);
    };
    this.input.on(Phaser.Input.Events.POINTER_UP, up);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, up);
    this.input.keyboard?.on('keydown-ESC', () => (this.session.state === 'PAUSED' ? this.session.resume() : this.session.pause()));

    const background = () => {
      this.session.pause();
      this.sfx.suspend();
    };
    this.game.events.on(Phaser.Core.Events.BLUR, background);
    this.game.events.on(Phaser.Core.Events.HIDDEN, background);
  }

  // ---- settings -------------------------------------------------------------

  private toggleSound(): void {
    this.save.updateSettings({ sound: !this.save.data.settings.sound });
    this.sfx.enabled = this.save.data.settings.sound;
    this.refreshOverlay();
  }

  private toggleMotion(): void {
    this.save.updateSettings({ reducedMotion: !this.save.data.settings.reducedMotion });
    this.applyMotionSetting();
    this.refreshOverlay();
  }

  private applyMotionSetting(): void {
    this.reducedMotion = this.save.data.settings.reducedMotion || (this.motionQuery?.matches ?? false);
    this.fx.cap = this.reducedMotion ? 40 : 100;
    this.fx.flashes = !this.reducedMotion;
  }

  private vibrate(ms: number): void {
    if (!this.save.data.settings.haptics) return;
    try {
      navigator.vibrate?.(ms);
    } catch {
      // Unsupported: silently omit.
    }
  }

  // ---- events -------------------------------------------------------------

  private onEvent(e: GameEvent): void {
    switch (e.type) {
      case 'RunStarted':
        this.fx.clear();
        this.vis.clear();
        this.primedPots.clear();
        this.trail = [];
        this.displayScore = 0;
        this.armedBellId = null;
        this.catcherDrawWidth = T.catcherInitialWidth;
        this.tutorialBtn.setLabel('Replay tutorial');
        for (const p of this.popups) p.text.setVisible(false);
        break;
      case 'StateChanged':
        if (e.to === 'AIMING') this.aimTime = 0;
        if (e.to === 'AIM_READY') this.idleTime = 0;
        if (e.to === 'HOME') this.primedPots.clear();
        this.refreshOverlay();
        break;
      case 'ShotLaunched':
        this.launchFx = 0;
        this.trail = [];
        this.armedBellId = null;
        this.sfx.launch();
        break;
      case 'WallHit':
        this.sfx.wall();
        this.fx.wallTick(e.x - e.nx * T.ballRadius, e.y - e.ny * T.ballRadius);
        break;
      case 'TargetHit':
        if (e.kind === 'bell') {
          const v = this.visFor(e.id);
          v.swingVel += (e.nx >= 0 ? -1 : 1) * 9;
          this.sfx.bellDull();
        }
        break;
      case 'BellArmed':
        this.armedBellId = e.id;
        this.fx.bellRing(e.x, e.y);
        this.sfx.bell();
        break;
      case 'TargetDestroyed': {
        const variant = this.session.board.get(e.id)?.variant ?? 0;
        if (e.kind === 'paint_pot') {
          this.primedPots.set(e.id, { x: e.x, y: e.y, radius: objectDef('paint_pot').radius!, variant, age: 0 });
          this.sfx.splat(e.ordinal);
        } else {
          this.fx.crateBreak(e.x, e.y, PALETTE.wood[variant % PALETTE.wood.length]);
          this.sfx.crate(e.ordinal);
        }
        if (e.bellBoost) this.popup(e.x, e.y - 18, '×2', CSS.yellow, 18);
        else if (e.multiplier > 1 && (e.ordinal - 1) % T.scoreMultiplierEvery === 0) this.popup(e.x, e.y - 18, `×${e.multiplier}`, CSS.cream, 16);
        break;
      }
      case 'ExplosionResolved': {
        this.primedPots.delete(e.id);
        const variant = this.session.board.get(e.id)?.variant ?? 0;
        this.fx.paintBurst(e.x, e.y, e.radius, PALETTE.paint[variant % PALETTE.paint.length]);
        if (!this.reducedMotion && this.session.state === 'FLIGHT') this.shakeTime = 0.14;
        this.vibrate(12);
        break;
      }
      case 'ReturnCommitted':
        this.trail = [];
        this.sfx.returnCue();
        break;
      case 'BallCaught':
        this.catchDip = 0;
        this.sfx.catch(e.perfect);
        this.vibrate(20);
        if (e.shotPoints > 0) this.popup(e.x, T.catcherY - 32, `+${e.shotPoints}`, CSS.yellow, 22);
        if (e.perfect) {
          this.popup(e.x, T.catcherY - (e.shotPoints > 0 ? 66 : 32), `PERFECT +${e.bonus}`, CSS.teal, 15);
          this.fx.stars(e.x, T.catcherY - 8);
        }
        break;
      case 'BallMissed':
        this.primedPots.clear();
        this.sfx.miss();
        break;
      case 'BoardRefilled':
        if (e.full) this.fx.clearDecals();
        break;
      case 'RunEnded':
        if (e.summary.newBest) this.sfx.newBest();
        break;
      default:
        break;
    }
  }

  private visFor(id: number): ObjectVis {
    let v = this.vis.get(id);
    if (!v) {
      v = { swing: 0, swingVel: 0 };
      this.vis.set(id, v);
    }
    return v;
  }

  private popup(x: number, y: number, str: string, color: string, size: number): void {
    const p = this.popups.find((q) => q.life <= 0) ?? this.popups[0];
    p.text.setText(str).setColor(color).setFontSize(size).setPosition(x, y).setAlpha(1).setVisible(true);
    p.life = 0.8;
    p.vy = -36;
  }

  // ---- overlays ---------------------------------------------------------------

  private refreshOverlay(): void {
    const s = this.session.state;
    const home = s === 'HOME';
    const paused = s === 'PAUSED';
    const results = s === 'RESULTS';
    const soundLabel = `Sound: ${this.save.data.settings.sound ? 'On' : 'Off'}`;

    for (const t of this.homeTexts) t.setVisible(home);
    this.homeBest.setText(this.save.data.bestByMode.normal > 0 ? `Best ${this.save.data.bestByMode.normal}` : '');
    this.playBtn.setVisible(home);
    this.homeSoundBtn.setVisible(home);
    this.homeSoundBtn.setLabel(soundLabel);

    this.pauseTitle.setVisible(paused);
    for (const b of [this.resumeBtn, this.restartBtn, this.pauseHomeBtn, this.soundBtn, this.motionBtn, this.tutorialBtn]) b.setVisible(paused);
    this.soundBtn.setLabel(this.save.data.settings.sound ? 'Sound ✓' : 'Sound ✗');
    this.motionBtn.setLabel(this.reducedMotion ? 'Calm ✓' : 'Calm ✗');

    for (const t of Object.values(this.results)) t.setVisible(results);
    this.retryBtn.setVisible(results);
    this.resultsHomeBtn.setVisible(results);
    const summary = this.session.lastSummary;
    if (results && summary) {
      this.results.heading.setText(this.session.tutorialActive ? 'Missed it. One more shot?' : 'Missed!');
      this.results.score.setText(String(summary.banked));
      this.results.best.setText(summary.newBest ? '★ NEW BEST ★' : `Best ${summary.best}`).setColor(summary.newBest ? CSS.coral : CSS.ink);
      const coins = summary.coinsEarned === 1 ? '1 coin' : `${summary.coinsEarned} coins`;
      this.results.stats.setText(`${summary.catches} ${summary.catches === 1 ? 'catch' : 'catches'}  ·  +${coins}`);
      this.results.lost.setText(summary.lostShot > 0 ? `Lost with the missed shot: ${summary.lostShot}` : '');
    }

    this.pauseBtn.setVisible(PLAY_STATES.has(s));
    this.noticeText.setVisible(!this.save.available && (home || results));
    if (this.uiPointer && !this.uiPointer.button.visible) this.uiPointer = null;
  }

  private drawPanel(g: Phaser.GameObjects.Graphics, top: number, bottom: number): void {
    g.fillStyle(PALETTE.ink, 0.35);
    g.fillRoundedRect(38 + 4, top + 6, 284, bottom - top, 22);
    g.fillStyle(PALETTE.cream, 1);
    g.fillRoundedRect(38, top, 284, bottom - top, 22);
    g.lineStyle(4, PALETTE.ink, 1);
    g.strokeRoundedRect(38, top, 284, bottom - top, 22);
  }

  private drawOverlay(): void {
    const g = this.uiG;
    g.clear();
    const s = this.session.state;
    if (s === 'HOME') {
      g.fillStyle(PALETTE.ink, 0.62);
      g.fillRect(0, 0, T.logicalWidth, T.logicalHeight);
    } else if (s === 'PAUSED') {
      g.fillStyle(PALETTE.ink, 0.55);
      g.fillRect(0, 0, T.logicalWidth, T.logicalHeight);
      this.drawPanel(g, 140, 516);
    } else if (s === 'RESULTS') {
      g.fillStyle(PALETTE.ink, 0.5);
      g.fillRect(0, 0, T.logicalWidth, T.logicalHeight);
      this.drawPanel(g, 150, 528);
      if (this.session.lastSummary?.newBest) {
        g.fillStyle(PALETTE.yellow, 1);
        g.fillRoundedRect(98, 289, 164, 26, 13);
        g.lineStyle(2.5, PALETTE.ink, 1);
        g.strokeRoundedRect(98, 289, 164, 26, 13);
      }
    }
    for (const b of this.buttons) {
      if (b === this.pauseBtn) continue;
      b.draw(g);
    }
  }

  // ---- frame ----------------------------------------------------------------

  update(): void {
    // Phaser's smoothed delta is clamped to its 60 fps target, which would play the game in
    // slow motion on a 30 fps device. Use the raw frame time; the session bounds it.
    const dt = Math.min(Math.max(this.game.loop.rawDelta, 0) / 1000, T.maxFrameSeconds);
    const session = this.session;
    session.update(dt);
    const frozen = session.state === 'PAUSED';
    if (!frozen) {
      this.clock += dt;
      this.fx.update(dt);
      this.launchFx += dt;
      this.catchDip += dt;
      this.aimTime += dt;
      this.idleTime += dt;
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      for (const pot of this.primedPots.values()) pot.age += dt;
      for (const v of this.vis.values()) {
        // Damped spring: bell swings with diminishing amplitude.
        v.swingVel += (-90 * v.swing - 5 * v.swingVel) * dt;
        v.swing += v.swingVel * dt;
      }
      for (const p of this.popups) {
        if (p.life <= 0) continue;
        p.life -= dt;
        p.text.y += p.vy * dt;
        p.text.setAlpha(Math.min(1, p.life / 0.3));
        if (p.life <= 0) p.text.setVisible(false);
      }
      const target = session.run.banked;
      if (this.displayScore < target) this.displayScore = Math.min(target, this.displayScore + Math.max(1, (target - this.displayScore) * dt * 8));
      if (this.displayScore > target) this.displayScore = target;
      this.catcherDrawWidth += (session.catcherWidth - this.catcherDrawWidth) * Math.min(1, dt * 10);
    }

    const shake = this.shakeTime > 0 && session.state === 'FLIGHT' ? 1.5 * (this.shakeTime / 0.14) : 0;
    const ox = shake ? (Math.random() - 0.5) * 2 * shake : 0;
    const oy = shake ? (Math.random() - 0.5) * 2 * shake : 0;
    this.worldG.setPosition(ox, oy);
    this.fxG.setPosition(ox, oy);

    this.drawWorld();
    this.drawBallLayer();
    this.drawHud();
    this.drawOverlay();
  }

  private drawWorld(): void {
    const g = this.worldG;
    const session = this.session;
    const now = session.time;
    g.clear();
    this.fx.drawDecals(g);

    const armed = session.shot.bellArmed && (session.state === 'FLIGHT' || session.state === 'RETURNING');
    for (const obj of session.board.objects) {
      if (obj.destroyed) continue;
      const age = now - obj.bornAt;
      const k = Math.min(1, Math.max(0, age / T.refillArrivalSeconds));
      const scale = k >= 1 ? 1 : easeOutBack(k);
      if (scale <= 0.01) continue;
      const def = objectDef(obj.kind);
      if (obj.kind === 'crate') {
        Draw.drawCrate(g, obj.x, obj.y, def.width!, def.height!, scale, obj.variant);
      } else if (obj.kind === 'paint_pot') {
        Draw.drawPaintPot(g, obj.x, obj.y, def.radius!, scale, obj.variant);
      } else if (obj.kind === 'bell') {
        const swing = this.vis.get(obj.id)?.swing ?? 0;
        Draw.drawBell(g, obj.x, obj.y, def.radius!, scale, this.reducedMotion ? swing * 0.4 : swing, armed && this.armedBellId === obj.id);
      }
    }

    for (const pot of this.primedPots.values()) {
      const k = Math.min(1, pot.age / T.blastChainDelaySeconds);
      Draw.drawPaintPot(g, pot.x, pot.y, pot.radius, 1 + 0.18 * k, pot.variant, k);
    }

    if (session.state === 'RETURNING') {
      // Targets wash out while the ball is a harmless return orb.
      g.fillStyle(PALETTE.cream, 0.32);
      g.fillRect(T.arena.left, T.arena.top, T.arena.right - T.arena.left, T.returnCorridorTop - T.arena.top);
      if (session.landingMarkerVisible()) {
        const remaining = session.returnRemaining() ?? 0;
        const strength = Math.min(1, (session.returnPath!.markerSeconds - remaining) / 0.08 + 0.3);
        Draw.drawLandingMarker(g, session.returnPath!.landingX, T.catcherY - T.catcherHeight / 2 - 2, this.clock, strength);
      }
    }

    // Catcher dips 5 units on a catch and springs back.
    const dip = this.catchDip < 0.3 ? 5 * Math.sin((this.catchDip / 0.3) * Math.PI) * (1 - this.catchDip / 0.3) : 0;
    const highlight = session.tutorialHint() === 'Slide to catch.' ? 0.5 + 0.5 * Math.sin(this.clock * 6) : 0;
    Draw.drawCatcher(g, session.catcherX, T.catcherY + dip, this.catcherDrawWidth, highlight);

    const preview = session.aimPreview();
    if (preview) this.drawAimPreview(g, preview);
  }

  private drawAimPreview(g: Phaser.GameObjects.Graphics, pts: { x: number; y: number }[]): void {
    const ease = Math.min(1, this.aimTime / 0.15);
    const spacing = 11;
    for (let seg = 0; seg < pts.length - 1; seg++) {
      const a = pts[seg];
      const b = pts[seg + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const first = seg === 0;
      for (let d = first ? 16 : spacing; d < len; d += spacing) {
        const k = d / len;
        const alpha = first ? 0.6 : 0.4 * (1 - k);
        g.fillStyle(PALETTE.ink, alpha * ease);
        g.fillCircle(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, first ? 2.4 : 1.9);
      }
    }
    if (pts.length >= 2) {
      // Ghost ball at the first contact.
      g.lineStyle(1.5, PALETTE.ink, 0.45 * ease);
      g.strokeCircle(pts[1].x, pts[1].y, T.ballRadius);
    }
  }

  private drawBallLayer(): void {
    const g = this.ballG;
    const session = this.session;
    const ball = session.ball;
    const state = session.state;
    g.clear();
    if (state === 'HOME') return;

    const inFlight = state === 'FLIGHT' || state === 'RETURNING' || state === 'MISSED';
    if (inFlight && this.session.state !== 'PAUSED') {
      this.trail.push({ x: ball.x, y: ball.y });
      if (this.trail.length > 12) this.trail.shift();
    }
    const orb = state === 'RETURNING';
    for (let i = 0; i < this.trail.length - 1; i++) {
      const p = this.trail[i];
      const k = (i + 1) / this.trail.length;
      if (orb) {
        g.fillStyle(PALETTE.returnBlue, 0.35 * k);
        g.fillCircle(p.x, p.y, 2 + 4 * k);
      } else if (i % 2 === 0) {
        g.fillStyle(PALETTE.ink, 0.14 * k);
        g.fillCircle(p.x, p.y, 1 + 1.6 * k);
      }
    }

    let stretch = 1;
    let angle = 0;
    if (state === 'FLIGHT' && this.launchFx < 0.16) {
      angle = Math.atan2(ball.vy, ball.vx);
      stretch = this.launchFx < 0.05 ? 0.82 : 1 + 0.3 * (1 - (this.launchFx - 0.05) / 0.11);
    }
    let y = ball.y;
    if (state === 'CATCH_SETTLE' || state === 'AIM_READY' || state === 'AIMING') {
      y += this.catchDip < 0.3 ? 5 * Math.sin((this.catchDip / 0.3) * Math.PI) * (1 - this.catchDip / 0.3) : 0;
    }
    Draw.drawBall(g, ball.x, y, T.ballRadius, { stretch, angle, orb });
  }

  private drawHud(): void {
    const g = this.hudG;
    const session = this.session;
    const state = session.state;
    g.clear();

    this.scoreText.setText(String(Math.round(this.displayScore)));
    const showPending = state === 'FLIGHT' || state === 'RETURNING' || (state === 'PAUSED' && session.shot.pending > 0);
    this.pendingLabel.setVisible(showPending);
    this.pendingText.setVisible(showPending).setText(`+${session.shot.pending}`);
    const armed = session.shot.bellArmed && showPending;
    this.bellBadge.setVisible(armed);
    if (armed) {
      const bx = 180 + this.pendingText.width / 2 + 22;
      this.bellBadge.setPosition(bx, 37);
      g.fillStyle(PALETTE.yellow, 1);
      g.fillRoundedRect(bx - 17, 27, 34, 20, 10);
      g.lineStyle(2, PALETTE.ink, 1);
      g.strokeRoundedRect(bx - 17, 27, 34, 20, 10);
    }

    const hint = session.tutorialHint();
    const showHint = hint !== null && state !== 'AIMING' && PLAY_STATES.has(state);
    this.hintText.setVisible(showHint).setText(hint ?? '');
    if (showHint && hint === 'Slide to catch.') {
      const pulse = 0.5 + 0.5 * Math.sin(this.clock * 6);
      g.lineStyle(3, PALETTE.tealLight, 0.4 + 0.5 * pulse);
      g.strokeRoundedRect(14, T.controlStrip.top, T.logicalWidth - 28, T.controlStrip.bottom - T.controlStrip.top, 20);
    }
    if (hint === 'Drag to aim. Lift to shoot.' && state === 'AIM_READY' && this.idleTime > 2) {
      const k = ((this.idleTime - 2) % 2.4) / 2.4;
      const x = T.launchX + Math.sin(k * Math.PI * 2) * 46;
      Draw.drawHandHint(g, x, T.controlStrip.bottom - 20, Math.min(1, (this.idleTime - 2) * 2));
    }

    this.pauseBtn.draw(g);
  }
}

function easeOutBack(k: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
}
