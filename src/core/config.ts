// Simulation rules have no Phaser, DOM, or wall-clock dependency.
export const CONFIG = Object.freeze({
  width: 1280,
  height: 720,
  arenaInset: 32,
  tickRate: 60,
  clipTicks: 360,
  maxEchoes: 3,
  matchTicks: 10800,
  enemyCap: 70,
  friendlyProjectileCap: 240,
  hostileProjectileCap: 120,
  effectCap: 150,
});
