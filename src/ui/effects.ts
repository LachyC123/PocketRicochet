// Cosmetic-only effects with fixed pools. Nothing here can affect score or collisions.
import type Phaser from 'phaser';
import { PALETTE } from './palette';

type ParticleKind = 'chip' | 'drop' | 'star';

interface Particle {
  active: boolean;
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: number;
  life: number;
  maxLife: number;
  gravity: number;
}

interface Ring {
  active: boolean;
  x: number;
  y: number;
  r0: number;
  r1: number;
  color: number;
  width: number;
  filled: boolean;
  life: number;
  maxLife: number;
}

interface Decal {
  x: number;
  y: number;
  color: number;
  blobs: { dx: number; dy: number; r: number }[];
  age: number;
}

const PARTICLE_POOL = 100;
const RING_POOL = 24;
const DECAL_CAP = 14;

export class Effects {
  /** Decorative particle cap: 100 normally, 40 with reduced motion. */
  cap = PARTICLE_POOL;
  /** Reduced motion turns off bright impact flashes; collision feedback rings remain. */
  flashes = true;
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private decals: Decal[] = [];

  constructor() {
    for (let i = 0; i < PARTICLE_POOL; i++) {
      this.particles.push({ active: false, kind: 'chip', x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, size: 0, color: 0, life: 0, maxLife: 1, gravity: 0 });
    }
    for (let i = 0; i < RING_POOL; i++) {
      this.rings.push({ active: false, x: 0, y: 0, r0: 0, r1: 0, color: 0, width: 0, filled: false, life: 0, maxLife: 1 });
    }
  }

  clear(): void {
    for (const p of this.particles) p.active = false;
    for (const r of this.rings) r.active = false;
    this.decals = [];
  }

  clearDecals(): void {
    this.decals = [];
  }

  private activeCount(): number {
    let n = 0;
    for (const p of this.particles) if (p.active) n++;
    return n;
  }

  private spawn(kind: ParticleKind, x: number, y: number, speed: number, color: number, size: number, life: number, gravity: number): void {
    if (this.activeCount() >= this.cap) return;
    const p = this.particles.find((q) => !q.active);
    if (!p) return;
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.5 + Math.random() * 0.6);
    Object.assign(p, {
      active: true, kind, x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.3,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 14,
      size: size * (0.7 + Math.random() * 0.6), color, life: life, maxLife: life, gravity,
    });
  }

  ring(x: number, y: number, r0: number, r1: number, color: number, life: number, width = 3, filled = false): void {
    const r = this.rings.find((q) => !q.active);
    if (!r) return;
    Object.assign(r, { active: true, x, y, r0, r1, color, life, maxLife: life, width, filled });
  }

  crateBreak(x: number, y: number, color: number): void {
    if (this.flashes) this.ring(x, y, 10, 22, PALETTE.white, 0.09, 0, true);
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) this.spawn('chip', x, y, 150, i % 2 ? color : PALETTE.woodDark, 6, 0.55, 600);
  }

  paintBurst(x: number, y: number, radius: number, color: number): void {
    this.ring(x, y, 12, radius, color, 0.32, 5);
    if (this.flashes) this.ring(x, y, 6, radius * 0.6, PALETTE.white, 0.14, 0, true);
    for (let i = 0; i < 8; i++) this.spawn('drop', x, y, 190, color, 4.5, 0.6, 500);
    const blobs = Array.from({ length: 6 }, () => ({
      dx: (Math.random() - 0.5) * 34, dy: (Math.random() - 0.5) * 34, r: 5 + Math.random() * 9,
    }));
    this.decals.push({ x, y, color, blobs, age: 0 });
    if (this.decals.length > DECAL_CAP) this.decals.shift();
  }

  bellRing(x: number, y: number): void {
    this.ring(x, y, 14, 32, PALETTE.yellow, 0.4, 3);
  }

  stars(x: number, y: number): void {
    for (let i = 0; i < 7; i++) this.spawn('star', x, y, 170, i % 2 ? PALETTE.yellow : PALETTE.white, 4, 0.5, 200);
  }

  wallTick(x: number, y: number): void {
    this.ring(x, y, 3, 10, PALETTE.ink, 0.12, 1.5);
  }

  update(dt: number): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    for (const r of this.rings) {
      if (!r.active) continue;
      r.life -= dt;
      if (r.life <= 0) r.active = false;
    }
    for (const d of this.decals) d.age += dt;
  }

  /** Paint splats on the backing board, drawn behind targets. */
  drawDecals(g: Phaser.GameObjects.Graphics): void {
    for (const d of this.decals) {
      const alpha = 0.32 * Math.min(1, d.age / 0.15);
      g.fillStyle(d.color, alpha);
      for (const b of d.blobs) g.fillCircle(d.x + b.dx, d.y + b.dy, b.r);
    }
  }

  draw(g: Phaser.GameObjects.Graphics): void {
    for (const r of this.rings) {
      if (!r.active) continue;
      const k = 1 - r.life / r.maxLife;
      const radius = r.r0 + (r.r1 - r.r0) * (1 - (1 - k) * (1 - k));
      if (r.filled) {
        g.fillStyle(r.color, 0.7 * (1 - k));
        g.fillCircle(r.x, r.y, radius);
      } else {
        g.lineStyle(r.width * (1 - k * 0.6), r.color, 0.85 * (1 - k));
        g.strokeCircle(r.x, r.y, radius);
      }
    }
    for (const p of this.particles) {
      if (!p.active) continue;
      const alpha = Math.min(1, (p.life / p.maxLife) * 1.6);
      g.fillStyle(p.color, alpha);
      if (p.kind === 'drop') {
        g.fillCircle(p.x, p.y, p.size * 0.6);
      } else if (p.kind === 'star') {
        const s = p.size;
        g.fillTriangle(p.x, p.y - s, p.x - s * 0.35, p.y, p.x + s * 0.35, p.y);
        g.fillTriangle(p.x, p.y + s, p.x - s * 0.35, p.y, p.x + s * 0.35, p.y);
        g.fillTriangle(p.x - s, p.y, p.x, p.y - s * 0.35, p.x, p.y + s * 0.35);
        g.fillTriangle(p.x + s, p.y, p.x, p.y - s * 0.35, p.x, p.y + s * 0.35);
      } else {
        const c = Math.cos(p.rot) * p.size * 0.5;
        const s = Math.sin(p.rot) * p.size * 0.5;
        g.fillTriangle(p.x - c, p.y - s, p.x + s, p.y - c, p.x + c * 0.6, p.y + s * 0.6);
      }
    }
  }
}
