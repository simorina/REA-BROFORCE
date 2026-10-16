import { parseBro, type BroDef } from '../engine/bro';
import brolusconi from './brolusconi.json';
import putin from './putin.json';

export const BROLUSCONI = parseBro(brolusconi);
export const PUTIN = parseBro(putin);

/** Every playable bro, in the order a rescue cycles through them. */
export const BROS: readonly BroDef[] = [BROLUSCONI, PUTIN];

/** The roster of a level that starts with bro `id` (with the first bro if `id` is unknown). */
export function rosterStartingWith(id: string): BroDef[] {
  const i = Math.max(0, BROS.findIndex((b) => b.id === id));
  return [...BROS.slice(i), ...BROS.slice(0, i)];
}
