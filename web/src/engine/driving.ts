import { screenMaxY, VIEW_W } from './camera';
import type { Blast } from './explosions';
import { NO_DRIVE, makeTank, stepTankBody, tankDrop } from './tank';
import type { World } from './world';

/** GrenadeAirstrike.SpawnTank: the tank falls in over the flattest ground near the grenade, facing the throw. */
export function callTank(w: World, x: number, y: number, facing: 1 | -1): void {
  const d = tankDrop(w.map, x, y, screenMaxY(w.camera), w.camera.x - VIEW_W / 2);
  w.tanks.push(makeTank(w.nextId++, d.x, d.y, d.fallback ? 1 : facing));
}

/** Every tank's step: its body for now (driving, the turret and damage come next). */
export function stepTanks(w: World, t: number, _blasts: Blast[]): void {
  for (const k of w.tanks) {
    if (k.exploded) continue;
    stepTankBody(k, k.driven ? k.drive : NO_DRIVE, w.map, w.stats.tank, t);
  }
  w.tanks = w.tanks.filter((k) => !k.exploded);
}
