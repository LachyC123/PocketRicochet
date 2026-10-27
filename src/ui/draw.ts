// Code-drawn toy-cabinet art. Every function draws into a Graphics in logical units.
import type Phaser from 'phaser';
import type { Tuning } from '../data/config';
import { PALETTE } from './palette';

type G = Phaser.GameObjects.Graphics;

const OUTLINE = 2.5;

/** Graphics point APIs are typed as Vector2[] but only read x/y; avoid per-frame allocations. */
const pts = (points: { x: number; y: number }[]) => points as unknown as Phaser.Math.Vector2[];

export function drawCabinet(g: G, t: Tuning): void {
  const { left, right, top } = t.arena;
  const floor = t.catcherY + 20;
  g.fillStyle(PALETTE.ink, 1);
  g.fillRect(0, 0, t.logicalWidth, t.logicalHeight);

  // Cabinet body and backing board.
  g.fillStyle(PALETTE.inkLight, 1);
  g.fillRoundedRect(left - 10, top - 10, right - left + 20, floor - top + 20, 18);
  g.fillStyle(PALETTE.cream, 1);
  g.fillRoundedRect(left, top, right - left, floor - top, 10);

  // Pegboard texture.
  g.fillStyle(PALETTE.pegDot, 1);
  for (let y = top + 16; y < t.returnCorridorTop; y += 22) {
    for (let x = left + 16; x < right - 8; x += 22) g.fillCircle(x, y, 1.6);
  }

  // Return corridor and catch floor: a slightly deeper shade so the catch zone reads as a place.
  g.fillStyle(PALETTE.creamShade, 0.55);
  g.fillRect(left, t.returnCorridorTop, right - left, floor - t.returnCorridorTop - 10);
  g.fillStyle(PALETTE.creamShade, 1);
  g.fillRoundedRect(left, floor - 12, right - left, 12, { tl: 0, tr: 0, bl: 10, br: 10 });

  // Inner shadow along the top and side walls.
  g.fillStyle(PALETTE.ink, 0.08);
  g.fillRect(left, top, right - left, 6);
  g.fillRect(left, top, 5, floor - top - 10);
  g.fillStyle(PALETTE.ink, 0.04);
  g.fillRect(right - 4, top, 4, floor - top - 10);

  // Glass sheen.
  g.fillStyle(PALETTE.white, 0.16);
  g.fillTriangle(left, top + 40, left + 40, top, left + 70, top);
  g.fillTriangle(left, top + 40, left + 70, top, left, top + 110);

  // Frame bolts.
  g.fillStyle(PALETTE.inkSoft, 1);
  for (const [bx, by] of [[left - 2, top - 2], [right + 2, top - 2], [left - 2, floor + 2], [right + 2, floor + 2]]) {
    g.fillCircle(bx, by, 3);
  }

  // Control strip.
  const s = t.controlStrip;
  g.fillStyle(PALETTE.strip, 1);
  g.fillRoundedRect(14, s.top, t.logicalWidth - 28, s.bottom - s.top, 20);
  g.lineStyle(2, PALETTE.inkSoft, 1);
  g.strokeRoundedRect(14, s.top, t.logicalWidth - 28, s.bottom - s.top, 20);
  const midY = (s.top + s.bottom) / 2;
  g.lineStyle(3, PALETTE.inkSoft, 1);
  for (const dx of [-8, 0, 8]) g.lineBetween(t.launchX + dx, midY - 12, t.launchX + dx, midY + 12);
  g.fillStyle(PALETTE.inkSoft, 1);
  g.fillTriangle(48, midY, 60, midY - 8, 60, midY + 8);
  g.fillTriangle(t.logicalWidth - 48, midY, t.logicalWidth - 60, midY - 8, t.logicalWidth - 60, midY + 8);
}

export function drawCrate(g: G, x: number, y: number, w: number, h: number, scale: number, variant: number): void {
  const W = w * scale;
  const H = h * scale;
  const l = x - W / 2;
  const tp = y - H / 2;
  const r = 4 * scale;
  g.fillStyle(PALETTE.ink, 0.18);
  g.fillRoundedRect(l + 3, tp + 3, W, H, r);
  g.fillStyle(PALETTE.wood[variant % PALETTE.wood.length], 1);
  g.fillRoundedRect(l, tp, W, H, r);
  g.fillStyle(PALETTE.woodDark, 0.35);
  g.fillRect(l + 3, tp + H / 3 - 0.75, W - 6, 1.5);
  g.fillRect(l + 3, tp + (2 * H) / 3 - 0.75, W - 6, 1.5);
  g.lineStyle(3 * scale, PALETTE.woodLight, 1);
  g.lineBetween(l + 6 * scale, tp + H - 6 * scale, l + W - 6 * scale, tp + 6 * scale);
  g.lineStyle(1.5, PALETTE.woodDark, 0.8);
  g.strokeRect(l + 3, tp + 3, W - 6, H - 6);
  g.fillStyle(PALETTE.white, 0.28);
  g.fillRect(l + 4, tp + 2, W - 8, 2);
  g.lineStyle(OUTLINE, PALETTE.ink, 1);
  g.strokeRoundedRect(l, tp, W, H, r);
  g.fillStyle(PALETTE.ink, 0.55);
  for (const [nx, ny] of [[l + 4, tp + 4], [l + W - 4, tp + 4], [l + 4, tp + H - 4], [l + W - 4, tp + H - 4]]) g.fillCircle(nx, ny, 1.1);
}

export function drawPaintPot(g: G, x: number, y: number, radius: number, scale: number, variant: number, squash = 0): void {
  const s = (radius / 15) * scale;
  const color = PALETTE.paint[variant % PALETTE.paint.length];
  const w = 26 * s * (1 + squash * 0.25);
  const h = 22 * s * (1 - squash * 0.25);
  const bodyTop = y - h / 2 + 3 * s;
  g.fillStyle(PALETTE.ink, 0.18);
  g.fillRoundedRect(x - w / 2 + 3, bodyTop + 3, w, h, 4 * s);
  // Tin body with a paint-coloured label.
  g.fillStyle(PALETTE.tin, 1);
  g.fillRoundedRect(x - w / 2, bodyTop, w, h, 4 * s);
  g.fillStyle(color, 1);
  g.fillRect(x - w / 2, bodyTop + h * 0.38, w, h * 0.34);
  g.fillStyle(PALETTE.tinDark, 0.6);
  g.fillRect(x + w / 2 - 6 * s, bodyTop + 2, 4 * s, h - 4);
  g.lineStyle(OUTLINE, PALETTE.ink, 1);
  g.strokeRoundedRect(x - w / 2, bodyTop, w, h, 4 * s);
  // Open lid full of paint, with a drip over the lip.
  g.fillStyle(color, 1);
  g.fillEllipse(x, bodyTop, w + 2 * s, 9 * s);
  g.fillRoundedRect(x - w / 2 + 4 * s, bodyTop, 5 * s, 10 * s, 2.5 * s);
  g.fillStyle(PALETTE.white, 0.45);
  g.fillEllipse(x - 4 * s, bodyTop - 1, 8 * s, 2.5 * s);
  g.lineStyle(OUTLINE, PALETTE.ink, 1);
  g.strokeEllipse(x, bodyTop, w + 2 * s, 9 * s);
}

function rotatePoint(px: number, py: number, cx: number, cy: number, a: number): { x: number; y: number } {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: cx + px * c - py * s, y: cy + px * s + py * c };
}

/** A bell hanging from a pivot above its centre, swung by `angle` radians. */
export function drawBell(g: G, x: number, y: number, radius: number, scale: number, angle: number, lit: boolean): void {
  const s = (radius / 14) * scale;
  const px = x;
  const py = y - 15 * s;
  const P = (dx: number, dy: number) => rotatePoint(dx * s, dy * s, px, py, angle);
  if (lit) {
    g.fillStyle(PALETTE.yellow, 0.35);
    g.fillCircle(x, y, 22 * s);
  }
  // Hanger.
  g.lineStyle(2, PALETTE.ink, 1);
  g.strokeCircle(px, py, 3 * s);
  const shadow = [P(-8, 3), P(8, 3), P(14, 26), P(-14, 26)].map((p) => ({ x: p.x + 3, y: p.y + 3 }));
  g.fillStyle(PALETTE.ink, 0.18);
  g.fillPoints(pts(shadow), true);
  // Body: dome + flare.
  const body = [P(-8, 6), P(-6, 3), P(0, 2), P(6, 3), P(8, 6), P(10, 18), P(14, 25), P(-14, 25), P(-10, 18)];
  g.fillStyle(PALETTE.yellow, 1);
  g.fillPoints(pts(body), true);
  g.fillStyle(PALETTE.yellowDark, 0.55);
  g.fillPoints(pts([P(3, 3), P(6, 3), P(8, 6), P(10, 18), P(14, 25), P(6, 25), P(5, 12)]), true);
  g.fillStyle(PALETTE.white, 0.6);
  g.fillPoints(pts([P(-5, 6), P(-3, 5), P(-5, 17), P(-7, 17)]), true);
  g.lineStyle(OUTLINE, PALETTE.ink, 1);
  g.strokePoints(pts(body), true);
  const clapper = P(0, 28);
  g.fillStyle(PALETTE.ink, 1);
  g.fillCircle(clapper.x, clapper.y, 3 * s);
}

export function drawCatcher(g: G, x: number, y: number, width: number, highlight: number): void {
  const h = 14;
  const l = x - width / 2;
  const tp = y - h / 2;
  if (highlight > 0) {
    g.lineStyle(4, PALETTE.tealLight, highlight);
    g.strokeRoundedRect(l - 5, tp - 7, width + 10, h + 12, 10);
  }
  g.fillStyle(PALETTE.ink, 0.22);
  g.fillRoundedRect(l + 3, tp + 4, width, h, 7);
  g.fillStyle(PALETTE.teal, 1);
  g.fillRoundedRect(l, tp, width, h, 7);
  g.fillStyle(PALETTE.tealDark, 1);
  g.fillRoundedRect(l, tp + h / 2, width, h / 2, { tl: 0, tr: 0, bl: 7, br: 7 });
  // Padding with stitching.
  g.fillStyle(PALETTE.tealLight, 1);
  g.fillRoundedRect(l + 6, tp + 2, width - 12, 5, 2.5);
  g.fillStyle(PALETTE.cream, 0.85);
  for (let sx = l + 10; sx < l + width - 10; sx += 7) g.fillRect(sx, tp + 9, 3.5, 1.3);
  // Raised lips at each end make it read as a cupped tray.
  for (const ex of [l + 4, l + width - 4]) {
    g.fillStyle(PALETTE.teal, 1);
    g.fillCircle(ex, tp + 1, 5);
    g.lineStyle(OUTLINE, PALETTE.ink, 1);
    g.strokeCircle(ex, tp + 1, 5);
  }
  g.lineStyle(OUTLINE, PALETTE.ink, 1);
  g.strokeRoundedRect(l, tp, width, h, 7);
  // Perfect-catch zone ticks (central 40%).
  g.lineStyle(1.5, PALETTE.ink, 0.45);
  g.lineBetween(x - width * 0.2, tp + 2, x - width * 0.2, tp + 6);
  g.lineBetween(x + width * 0.2, tp + 2, x + width * 0.2, tp + 6);
}

function ellipsePoints(cx: number, cy: number, rx: number, ry: number, angle: number, n = 22): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const ex = Math.cos(a) * rx;
    const ey = Math.sin(a) * ry;
    pts.push({ x: cx + ex * c - ey * s, y: cy + ex * s + ey * c });
  }
  return pts;
}

export interface BallLook {
  stretch: number;
  angle: number;
  orb: boolean;
}

export function drawBall(g: G, x: number, y: number, r: number, look: BallLook): void {
  const rx = r * look.stretch;
  const ry = r / look.stretch;
  const outline = pts(ellipsePoints(x, y, rx, ry, look.angle));
  if (look.orb) {
    g.fillStyle(PALETTE.returnBlue, 0.22);
    g.fillCircle(x, y, r + 6);
    g.fillStyle(PALETTE.coral, 0.6);
    g.fillPoints(outline, true);
    g.lineStyle(2.5, PALETTE.returnBlue, 1);
    g.strokePoints(outline, true);
    g.fillStyle(PALETTE.white, 0.8);
    g.fillCircle(x - r * 0.35, y - r * 0.35, r * 0.28);
    return;
  }
  g.fillStyle(PALETTE.coral, 1);
  g.fillPoints(outline, true);
  g.fillStyle(PALETTE.coralDark, 0.6);
  g.fillCircle(x + r * 0.22, y + r * 0.22, r * 0.62);
  g.fillStyle(PALETTE.coral, 1);
  g.fillCircle(x - r * 0.12, y - r * 0.12, r * 0.62);
  g.fillStyle(PALETTE.white, 0.9);
  g.fillCircle(x - r * 0.35, y - r * 0.38, r * 0.26);
  g.lineStyle(2, PALETTE.ink, 1);
  g.strokePoints(outline, true);
}

export function drawLandingMarker(g: G, x: number, y: number, time: number, strength: number): void {
  const pulse = 0.75 + 0.25 * Math.sin(time * 18);
  g.lineStyle(2.5, PALETTE.returnBlue, strength);
  g.strokeEllipse(x, y, 26 * pulse, 8 * pulse);
  g.fillStyle(PALETTE.returnBlue, strength);
  const cy = y - 26;
  g.fillTriangle(x - 7, cy - 6, x + 7, cy - 6, x, cy + 3);
}

/** A faint thumb print drifting along the strip to suggest the drag gesture. */
export function drawHandHint(g: G, x: number, y: number, alpha: number): void {
  g.fillStyle(PALETTE.cream, 0.35 * alpha);
  g.fillEllipse(x, y, 26, 32);
  g.lineStyle(2, PALETTE.cream, 0.8 * alpha);
  g.strokeEllipse(x, y, 26, 32);
  g.lineStyle(1.2, PALETTE.cream, 0.5 * alpha);
  g.strokeEllipse(x, y + 2, 14, 18);
}
