import {
  JUDO_FRAME_RATE, JUDO_FRAMES, JUDO_GROUND, JUDO_HIT, JUDO_STRIKE_FRAME, JUDO_STRIKE_LAST, JUDO_THROW, TILE,
  UNIT_BOX_HEIGHT, UNIT_WIDTH,
} from './constants';
import { barrelBlast, type Blast } from './explosions';
import { getColumn, getRow } from './map';
import { throwBody } from './projectiles';
import type { EnemyKind, Unit } from './types';
import type { World } from './world';

/** BroLee.StartFiring, forward: a new strike, alternating between the two strike animations. */
export function startJudo(p: Unit): void {
  p.attackRow = p.attackRow === 0 ? 1 : 0;
  p.attack = { frame: 0, counter: 0, row: p.attackRow, hit: false, struck: false };
  p.flex = null;
}

/** Map.HitUnits' box test (the one Map.AlertNearbyMooks uses too). */
function inHitBox(u: Unit, x: number, y: number, range: number): boolean {
  return Math.abs(u.x - x) - range < UNIT_WIDTH && Math.abs(u.y + UNIT_BOX_HEIGHT / 2 + 3 - y) - range < UNIT_BOX_HEIGHT;
}

/** The first live enemy in BroLee's strike box. */
export function judoTarget(enemies: readonly Unit[], p: Unit): Unit | null {
  const x = p.x + p.facing * JUDO_HIT.x;
  const y = p.y + JUDO_HIT.y;
  return enemies.find((m) => !m.dead && m.invulnerable <= 0 && inHitBox(m, x, y, JUDO_HIT.range)) ?? null;
}

/**
 * The grab (ours, in place of BroLee's BackSomersault): the mook leaves the fight as a kill and flies off as a
 * body. It's marked gibbed so it vanishes from the map, and exploded so a suicide mook doesn't go off in the
 * bro's hands (MookSuicide.Gib): its body carries the blast.
 */
function grab(w: World, p: Unit, m: Unit): void {
  const kind = m.kind as EnemyKind;
  w.events.push({ type: 'kill', x: m.x, y: m.y, kind, xI: p.facing * JUDO_THROW.x, yI: JUDO_THROW.y });
  if (m.originDoor >= 0) w.doors[m.originDoor].mookCount--; // Mook.Death: MookDoor.RemoveMook
  m.originDoor = -1;
  m.dead = true;
  m.deadTime = 0;
  m.gibbed = true;
  m.reported = { death: true, gib: true };
  if (m.ai) m.ai.exploded = true;
  w.projectiles.push(throwBody(w.nextId++, p, kind));
  w.events.push({ type: 'shot', weapon: 'body', x: p.x, y: p.y, facing: p.facing });
}

/** FireWeaponGround: the first block within reach ahead takes groundSwordDamage. True when one was struck. */
function strikeGround(w: World, p: Unit, blasts: Blast[]): boolean {
  const y = p.y + JUDO_GROUND.y;
  for (let d = 0; d <= JUDO_GROUND.reach; d++) {
    const x = p.x + p.facing * (JUDO_GROUND.x + d);
    if (!w.map.blockAt(x, y)) continue;
    const c = getColumn(x);
    const r = getRow(y);
    const kind = w.map.damage(c, r, JUDO_GROUND.damage);
    if (kind) w.events.push({ type: 'block', x: c * TILE, y: r * TILE, kind, damage: JUDO_GROUND.damage });
    if (kind === 'barrel') blasts.push(barrelBlast(c * TILE, r * TILE, w.stats.barrelRange));
    return true;
  }
  return false;
}

/** BroLee.RunFiring + AnimateAttackForwards for one fixed step. */
export function stepJudo(w: World, p: Unit, t: number, blasts: Blast[]): void {
  const a = p.attack;
  if (!a) return;
  a.counter += t;
  while (a.counter >= JUDO_FRAME_RATE) {
    a.counter -= JUDO_FRAME_RATE;
    a.frame++;
  }
  if (a.frame >= JUDO_FRAMES) {
    p.attack = null;
    return;
  }
  if (a.hit || a.frame < JUDO_STRIKE_FRAME) return;
  if (a.frame <= JUDO_STRIKE_LAST) {
    const m = judoTarget(w.enemies, p);
    if (m) {
      grab(w, p, m);
      a.hit = true;
      return;
    }
  }
  if (!a.struck) {
    a.struck = true;
    a.hit = strikeGround(w, p, blasts);
  }
}
