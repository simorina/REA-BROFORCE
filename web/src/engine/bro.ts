import { BRO_BASES, type BroBase } from './types';

/** A custom bro is data: his sheet shares TestVanDammeAnim's layout, and his physics are his `base` prefab's. */
export const WEAPONS = ['football', 'judo', 'rifle', 'cricket', 'blade', 'rpg', 'm60', 'flamethrower', 'tesla'] as const;
export const SPECIALS = ['airstrike', 'tank', 'jet', 'neuralyzer', 'glaive', 'nuke', 'django', 'molotov', 'flamewall', 'drone'] as const;
export type WeaponId = (typeof WEAPONS)[number];
export type SpecialId = (typeof SPECIALS)[number];
export const KILL_TARGETS = ['mook', 'alien'] as const;
export type KillTarget = (typeof KILL_TARGETS)[number];

/** Ours (docs/lore.md): what the bro says over an enemy he kills, and which enemies it is for. */
export interface KillLine {
  text: string;
  on: KillTarget;
}

export interface BroDef {
  id: string;
  name: string;
  sheet: string;
  base: BroBase;
  weapon: WeaponId;
  special: SpecialId;
  voiceLine: string; // said with his special
  voiceLang: string; // BCP 47 tag for the speech synthesis
  specialAmmo?: number;
  jetpack?: true; // The Brocketeer's jetpack: holding jump keeps him up
  bio?: string; // ours: who he is and why he hunts J.E., for the menu (docs/lore.md)
  killLine?: KillLine;
}

function text(raw: Record<string, unknown>, field: string): string {
  const v = raw[field];
  if (typeof v !== 'string' || v.trim() === '') throw new Error(`bro: ${field} must be a non-empty string`);
  return v;
}

function killLine(id: string, v: unknown): KillLine {
  if (typeof v !== 'object' || v === null) throw new Error(`bro ${id}: killLine must be an object`);
  const k = v as Record<string, unknown>;
  if (typeof k.text !== 'string' || k.text.trim() === '') throw new Error(`bro ${id}: killLine.text must be a non-empty string`);
  if (!(KILL_TARGETS as readonly unknown[]).includes(k.on)) throw new Error(`bro ${id}: unknown killLine target '${String(k.on)}'`);
  return { text: k.text, on: k.on as KillTarget };
}

export function parseBro(raw: unknown): BroDef {
  if (typeof raw !== 'object' || raw === null) throw new Error('bro: definition is not an object');
  const r = raw as Record<string, unknown>;
  const id = text(r, 'id');
  const base = text(r, 'base');
  const weapon = text(r, 'weapon');
  const special = text(r, 'special');
  if (!(BRO_BASES as readonly string[]).includes(base)) throw new Error(`bro ${id}: unknown base '${base}'`);
  if (!(WEAPONS as readonly string[]).includes(weapon)) throw new Error(`bro ${id}: unknown weapon '${weapon}'`);
  if (!(SPECIALS as readonly string[]).includes(special)) throw new Error(`bro ${id}: unknown special '${special}'`);
  const specialAmmo = typeof r.specialAmmo === 'number' ? r.specialAmmo : undefined;
  return {
    id, name: text(r, 'name'), sheet: text(r, 'sheet'), base: base as BroBase, weapon: weapon as WeaponId,
    special: special as SpecialId, voiceLine: text(r, 'voiceLine'), voiceLang: text(r, 'voiceLang'),
    ...(specialAmmo !== undefined ? { specialAmmo } : {}),
    ...(r.jetpack === true ? { jetpack: true as const } : {}),
    ...(r.bio !== undefined ? { bio: text(r, 'bio') } : {}),
    ...(r.killLine !== undefined ? { killLine: killLine(id, r.killLine) } : {}),
  };
}
