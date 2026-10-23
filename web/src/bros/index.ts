import { parseBro, type BroDef } from '../engine/bro';
import brolusconi from './brolusconi.json';
import che from './che.json';
import kim from './kim.json';
import meloni from './meloni.json';
import musk from './musk.json';
import putin from './putin.json';
import samuel from './samuel.json';
import trump from './trump.json';
import willsmith from './willsmith.json';

export const BROLUSCONI = parseBro(brolusconi);
export const PUTIN = parseBro(putin);
export const TRUMP = parseBro(trump);
export const KIM = parseBro(kim);
export const WILL_SMITH = parseBro(willsmith);
export const SAMUEL = parseBro(samuel);
export const CHE = parseBro(che);
export const MELONI = parseBro(meloni);
export const MUSK = parseBro(musk);

/** Every playable bro, in the order a rescue cycles through them. */
export const BROS: readonly BroDef[] = [BROLUSCONI, PUTIN, TRUMP, KIM, WILL_SMITH, SAMUEL, CHE, MELONI, MUSK];

/** The roster of a level that starts with bro `id` (with the first bro if `id` is unknown). */
export function rosterStartingWith(id: string): BroDef[] {
  const i = Math.max(0, BROS.findIndex((b) => b.id === id));
  return [...BROS.slice(i), ...BROS.slice(0, i)];
}
