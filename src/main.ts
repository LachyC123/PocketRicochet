import Phaser from 'phaser';
import { TUNING } from './data/config';
import { GameScene } from './scenes/GameScene';

const W = TUNING.logicalWidth;
const H = TUNING.logicalHeight;
const MAX_EXTRA = 400;

const parent = document.getElementById('game')!;

/**
 * Fit the 360×640 playfield to the available width; on taller screens (most phones) grow the
 * canvas upward by `extra` logical units instead of leaving an empty band.
 */
function measure(): { cssScale: number; extra: number } {
  const w = parent.clientWidth || window.innerWidth;
  const h = parent.clientHeight || window.innerHeight;
  const cssScale = Math.min(w / W, h / H) || 1;
  const extra = w / W < h / H ? Math.min(MAX_EXTRA, Math.floor((h * W) / w - H)) : 0;
  return { cssScale, extra };
}

// Render at device resolution: the logical world is drawn through a zoomed camera so vector
// shapes and text stay crisp on high-DPI phones.
const initial = measure();
const zoom = Math.max(1, Math.min(3, Math.ceil(initial.cssScale * (window.devicePixelRatio || 1))));
let extra = initial.extra;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent,
  width: W * zoom,
  height: (H + extra) * zoom,
  backgroundColor: '#203047',
  antialias: true,
  // Placement is left to CSS: the cabinet is anchored to the bottom so the control strip
  // sits under the thumb.
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.NO_CENTER },
  input: { activePointers: 2 },
  scene: [],
});
game.scene.add('game', GameScene, true, { zoom, extra });

// Rotation, browser chrome showing/hiding, or split screen: re-fit the tall-screen extension.
let pending = 0;
window.addEventListener('resize', () => {
  window.clearTimeout(pending);
  pending = window.setTimeout(() => {
    const next = measure().extra;
    if (Math.abs(next - extra) < 6) return;
    extra = next;
    game.scale.setGameSize(W * zoom, (H + extra) * zoom);
    (game.scene.getScene('game') as GameScene | null)?.setLayout(extra);
  }, 120);
});
