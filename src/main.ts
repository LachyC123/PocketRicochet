import Phaser from 'phaser';
import { TUNING } from './data/config';
import { GameScene } from './scenes/GameScene';

// Render at device resolution: the logical 360×640 world is drawn through a zoomed camera
// so vector shapes and text stay crisp on high-DPI phones.
const parent = document.getElementById('game')!;
const cssScale = Math.min(parent.clientWidth / TUNING.logicalWidth, parent.clientHeight / TUNING.logicalHeight) || 1;
const zoom = Math.max(1, Math.min(3, Math.ceil(cssScale * (window.devicePixelRatio || 1))));

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent,
  width: TUNING.logicalWidth * zoom,
  height: TUNING.logicalHeight * zoom,
  backgroundColor: '#203047',
  antialias: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 2 },
  scene: [],
});
game.scene.add('game', GameScene, true, { zoom });
