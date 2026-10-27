// Minimal hit-tested button drawn into a shared Graphics, with its own label Text.
import Phaser from 'phaser';
import { CSS, FONT, PALETTE } from './palette';

export type ButtonStyle = 'primary' | 'secondary' | 'icon';

export class Button {
  visible = false;
  pressed = false;
  readonly text: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    public x: number,
    public y: number,
    public w: number,
    public h: number,
    label: string,
    public style: ButtonStyle,
    public onTap: () => void,
    resolution: number,
    depth: number,
  ) {
    const size = style === 'primary' ? 26 : style === 'icon' ? 18 : 17;
    this.text = scene.add
      .text(x, y, label, {
        fontFamily: FONT,
        fontSize: `${size}px`,
        fontStyle: '900',
        color: style === 'secondary' ? CSS.ink : CSS.cream,
      })
      .setOrigin(0.5)
      .setResolution(resolution)
      .setDepth(depth + 1)
      .setVisible(false);
  }

  setLabel(label: string): void {
    this.text.setText(label);
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.text.setVisible(v);
    if (!v) this.pressed = false;
  }

  /** Touch slop beyond the drawn edge keeps targets comfortably above 44 CSS px. */
  contains(px: number, py: number): boolean {
    const slop = 4;
    return this.visible && Math.abs(px - this.x) <= this.w / 2 + slop && Math.abs(py - this.y) <= this.h / 2 + slop;
  }

  draw(g: Phaser.GameObjects.Graphics): void {
    if (!this.visible) return;
    const dy = this.pressed ? 2 : 0;
    const l = this.x - this.w / 2;
    const t = this.y - this.h / 2;
    const r = Math.min(this.h / 2, 18);
    this.text.setY(this.y + dy);
    g.fillStyle(PALETTE.ink, 0.35);
    g.fillRoundedRect(l + 2, t + 4, this.w, this.h, r);
    const fill = this.style === 'primary' ? PALETTE.coral : this.style === 'icon' ? PALETTE.inkSoft : PALETTE.cream;
    g.fillStyle(fill, 1);
    g.fillRoundedRect(l, t + dy, this.w, this.h, r);
    if (this.style === 'primary') {
      g.fillStyle(PALETTE.white, 0.22);
      g.fillRoundedRect(l + 8, t + dy + 5, this.w - 16, 6, 3);
    }
    g.lineStyle(3, PALETTE.ink, 1);
    g.strokeRoundedRect(l, t + dy, this.w, this.h, r);
  }
}
