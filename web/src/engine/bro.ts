/** A custom bro is data: its sheet shares TestVanDammeAnim's layout and the extracted bro physics. */
export const WEAPONS = ['football'] as const;
export const SPECIALS = ['airstrike'] as const;
export type WeaponId = (typeof WEAPONS)[number];
export type SpecialId = (typeof SPECIALS)[number];

export interface BroDef {
  id: string;
  name: string;
  sheet: string;
  weapon: WeaponId;
  special: SpecialId;
  voiceLine: string;
}

function text(raw: Record<string, unknown>, field: string): string {
  const v = raw[field];
  if (typeof v !== 'string' || v.trim() === '') throw new Error(`bro: ${field} must be a non-empty string`);
  return v;
}

export function parseBro(raw: unknown): BroDef {
  if (typeof raw !== 'object' || raw === null) throw new Error('bro: definition is not an object');
  const r = raw as Record<string, unknown>;
  const id = text(r, 'id');
  const weapon = text(r, 'weapon');
  const special = text(r, 'special');
  if (!(WEAPONS as readonly string[]).includes(weapon)) throw new Error(`bro ${id}: unknown weapon '${weapon}'`);
  if (!(SPECIALS as readonly string[]).includes(special)) throw new Error(`bro ${id}: unknown special '${special}'`);
  return {
    id, name: text(r, 'name'), sheet: text(r, 'sheet'), weapon: weapon as WeaponId, special: special as SpecialId,
    voiceLine: text(r, 'voiceLine'),
  };
}
