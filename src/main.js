import { CardGameScene } from './scene.js';
const config = {
  type: Phaser.AUTO,
  parent: 'phaser-root',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: 'rgba(0,0,0,0)',
  transparent: true,
  scene: [CardGameScene],
};
new Phaser.Game(config);
