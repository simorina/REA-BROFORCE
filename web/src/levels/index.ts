import type { LevelData } from '../engine/level';
import { buildBurning } from './burning';
import { buildDesert } from './desert';
import { buildLevel1 } from './level1';

/** A campaign mission: its level and where it sits on the world map (fractions of the map's width and height). */
export interface Mission {
  id: string;
  name: string;
  build: () => LevelData;
  map: { x: number; y: number };
}

/** The campaign, in order: two easier missions, then Epstein's island. */
export const MISSIONS: readonly Mission[] = [
  { id: 'desert', name: 'Il deserto', build: buildDesert, map: { x: 0.2, y: 0.42 } },
  { id: 'burning', name: 'La giungla in fiamme', build: buildBurning, map: { x: 0.5, y: 0.62 } },
  { id: 'island', name: "L'isola di Epstein", build: buildLevel1, map: { x: 0.8, y: 0.74 } },
];
