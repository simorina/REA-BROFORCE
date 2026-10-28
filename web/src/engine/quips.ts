import { isAlien } from './aliens';
import { isVisible } from './camera';
import { QUIP, SATAN, SATAN_LASER_LINE, SPEECH_DURATION } from './constants';
import type { HellState } from './hell';
import type { Unit } from './types';
import type { World } from './world';

/**
 * Ours (docs/lore.md): the bro's kill line over an enemy of its kind that has died (Trump's "You're fired!" over a
 * mook, Bro In Black's "Welcome to Earth!" over an alien), over his head and aloud. At most every QUIP.cooldown, and
 * never over a line of his still showing.
 */
export function killQuip(w: World, m: Unit): void {
  const q = w.bro.killLine;
  if (!q || w.player.dead || w.quipCooldown > 0) return;
  if (q.on === 'mook' ? !m.kind.startsWith('mook') : !isAlien(m.kind)) return;
  if (w.effects.some((e) => e.kind === 'speech' && e.unit === undefined)) return;
  w.quipCooldown = QUIP.cooldown;
  w.effects.push({ kind: 'speech', x: w.player.x, y: w.player.y + 40, age: 0, duration: SPEECH_DURATION, text: q.text });
  w.events.push({ type: 'voice', text: q.text, lang: w.bro.voiceLang });
}

/** Ours: Satan, on screen, sees his own beam burning in Musk's hands (the Tesla laser is his LaserBeam) and laughs at it, once. */
export function satanSeesLaser(w: World, m: Unit, h: HellState): void {
  if (h.mocked || m.dead || w.player.laser?.phase !== 'on' || !isVisible(w.camera, m.x, m.y, 16, 16)) return;
  h.mocked = true;
  h.laugh = Math.max(h.laugh, SATAN.laughs * SATAN.laughFrames * SATAN.laughRate);
  w.events.push({ type: 'alert', x: m.x, y: m.y });
  w.effects.push({ kind: 'speech', x: m.x, y: m.y + 40, age: 0, duration: SPEECH_DURATION, text: SATAN_LASER_LINE, unit: m.id });
}
