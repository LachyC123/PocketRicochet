// Continuous (swept) collision primitives. A moving circle of radius r against a
// shape is solved as a ray against the shape expanded by r (Minkowski sum).
// Casts only report entry contacts: a ray that starts inside or moves away is ignored,
// so an embedded ball can never re-trigger damage on the same object.

export interface Vec {
  x: number;
  y: number;
}

export interface CastHit {
  /** Time (in the same units as the velocity's denominator) until contact. */
  t: number;
  nx: number;
  ny: number;
}

export type Shape =
  | { kind: 'circle'; x: number; y: number; radius: number }
  | { kind: 'box'; x: number; y: number; hw: number; hh: number };

/** Ray p + d·t (t in [0, tMax]) against a circle of radius R centred at c. */
export function castCircle(
  px: number, py: number, dx: number, dy: number,
  cx: number, cy: number, R: number, tMax: number,
): CastHit | null {
  const fx = px - cx;
  const fy = py - cy;
  const a = dx * dx + dy * dy;
  if (a === 0) return null;
  const halfB = fx * dx + fy * dy;
  const c = fx * fx + fy * fy - R * R;
  if (c < 0 || halfB >= 0) return null;
  const disc = halfB * halfB - a * c;
  if (disc < 0) return null;
  const t = (-halfB - Math.sqrt(disc)) / a;
  if (t < 0 || t > tMax) return null;
  return { t, nx: (fx + dx * t) / R, ny: (fy + dy * t) / R };
}

/** Distance from a point to an axis-aligned box (0 when inside). */
export function pointBoxDistance(px: number, py: number, bx: number, by: number, hw: number, hh: number): number {
  const ox = Math.max(Math.abs(px - bx) - hw, 0);
  const oy = Math.max(Math.abs(py - by) - hh, 0);
  return Math.hypot(ox, oy);
}

/** Ray against an axis-aligned box of half-extents (hw, hh) inflated by r (a rounded rectangle). */
export function castRoundedBox(
  px: number, py: number, dx: number, dy: number,
  bx: number, by: number, hw: number, hh: number, r: number, tMax: number,
): CastHit | null {
  const lx = px - bx;
  const ly = py - by;
  if (pointBoxDistance(lx, ly, 0, 0, hw, hh) < r) return null;
  const ex = hw + r;
  const ey = hh + r;
  let best: CastHit | null = null;
  const consider = (t: number, nx: number, ny: number) => {
    if (t >= 0 && t <= tMax && (best === null || t < best.t)) best = { t, nx, ny };
  };
  if (dy > 0 && ly <= -ey) {
    const t = (-ey - ly) / dy;
    if (Math.abs(lx + dx * t) <= hw) consider(t, 0, -1);
  } else if (dy < 0 && ly >= ey) {
    const t = (ey - ly) / dy;
    if (Math.abs(lx + dx * t) <= hw) consider(t, 0, 1);
  }
  if (dx > 0 && lx <= -ex) {
    const t = (-ex - lx) / dx;
    if (Math.abs(ly + dy * t) <= hh) consider(t, -1, 0);
  } else if (dx < 0 && lx >= ex) {
    const t = (ex - lx) / dx;
    if (Math.abs(ly + dy * t) <= hh) consider(t, 1, 0);
  }
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const hit = castCircle(lx, ly, dx, dy, sx * hw, sy * hh, r, tMax);
      if (hit) consider(hit.t, hit.nx, hit.ny);
    }
  }
  return best;
}

/** Ray for a circle of radius r against a shape. */
export function castShape(px: number, py: number, dx: number, dy: number, shape: Shape, r: number, tMax: number): CastHit | null {
  if (shape.kind === 'circle') return castCircle(px, py, dx, dy, shape.x, shape.y, shape.radius + r, tMax);
  return castRoundedBox(px, py, dx, dy, shape.x, shape.y, shape.hw, shape.hh, r, tMax);
}

/** Distance from a point to a shape's surface (0 when inside). */
export function pointShapeDistance(px: number, py: number, shape: Shape): number {
  if (shape.kind === 'circle') return Math.max(Math.hypot(px - shape.x, py - shape.y) - shape.radius, 0);
  return pointBoxDistance(px, py, shape.x, shape.y, shape.hw, shape.hh);
}

/** Gap between two shapes' surfaces; negative or zero when overlapping. */
export function shapeGap(a: Shape, b: Shape): number {
  if (a.kind === 'circle' && b.kind === 'circle') {
    return Math.hypot(a.x - b.x, a.y - b.y) - a.radius - b.radius;
  }
  if (a.kind === 'box' && b.kind === 'box') {
    const gx = Math.abs(a.x - b.x) - a.hw - b.hw;
    const gy = Math.abs(a.y - b.y) - a.hh - b.hh;
    if (gx <= 0 && gy <= 0) return Math.max(gx, gy);
    return Math.hypot(Math.max(gx, 0), Math.max(gy, 0));
  }
  const box = (a.kind === 'box' ? a : b) as Extract<Shape, { kind: 'box' }>;
  const circle = (a.kind === 'circle' ? a : b) as Extract<Shape, { kind: 'circle' }>;
  return pointBoxDistance(circle.x, circle.y, box.x, box.y, box.hw, box.hh) - circle.radius;
}

/** Axis-aligned bounds of a shape. */
export function shapeBounds(shape: Shape): { left: number; right: number; top: number; bottom: number } {
  const hw = shape.kind === 'circle' ? shape.radius : shape.hw;
  const hh = shape.kind === 'circle' ? shape.radius : shape.hh;
  return { left: shape.x - hw, right: shape.x + hw, top: shape.y - hh, bottom: shape.y + hh };
}

/** Reflect v about unit normal n: v' = v - 2(v·n)n. */
export function reflect(vx: number, vy: number, nx: number, ny: number): Vec {
  const d = vx * nx + vy * ny;
  return { x: vx - 2 * d * nx, y: vy - 2 * d * ny };
}

/** Fold a coordinate back into [min, max] as if it bounced off both ends. */
export function foldInto(value: number, min: number, max: number): number {
  const span = max - min;
  if (span <= 0) return min;
  let v = (value - min) % (2 * span);
  if (v < 0) v += 2 * span;
  return min + (v <= span ? v : 2 * span - v);
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Quadratic Bézier point. */
export function quadBezier(p0: Vec, c: Vec, p1: Vec, t: number): Vec {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
    y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
  };
}

/** Quadratic Bézier derivative with respect to t. */
export function quadBezierTangent(p0: Vec, c: Vec, p1: Vec, t: number): Vec {
  return {
    x: 2 * (1 - t) * (c.x - p0.x) + 2 * t * (p1.x - c.x),
    y: 2 * (1 - t) * (c.y - p0.y) + 2 * t * (p1.y - c.y),
  };
}
