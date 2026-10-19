import { describe, expect, it } from 'vitest';
import { parseLevel } from '../engine/level';
import { TEST_STATS } from '../engine/testStats';
import { MISSIONS } from './index';

const built = MISSIONS.map((m) => {
  const level = m.build();
  return { m, level, parsed: parseLevel(level, TEST_STATS) };
});
const enemies = (i: number, kind?: string) => built[i].parsed.enemies.filter((e) => !kind || e.kind === kind).length;

describe('the campaign missions', () => {
  it("are seven missions tracing the Epstein files to the final battle on Epstein's island", () => {
    expect(MISSIONS.map((m) => m.id)).toEqual(['desert', 'harbor', 'burning', 'tower', 'airstrip', 'temple', 'island']);
    expect(MISSIONS.map((m) => m.name)).toEqual([
      'Il deserto',
      'Il porto dei segreti',
      'La giungla in fiamme',
      'Il grattacielo',
      "La pista d'atterraggio",
      'Il tempio sotterraneo',
      "L'isola di Epstein",
    ]);
  });

  it('each mission has a lore briefing explaining the story', () => {
    for (const m of MISSIONS) {
      expect(m.briefing).toBeDefined();
      expect(m.briefing.length).toBeGreaterThan(20);
    }
  });

  it('each level has its assigned background theme', () => {
    expect(built.map((b) => b.level.theme)).toEqual([
      'desert',
      'jungle',
      'burning',
      'jungle',
      'desert',
      'burning',
      'jungle',
    ]);
  });

  it('every level has the new enemies: riot shield mooks, grenadiers and dogs', () => {
    for (let i = 0; i < built.length; i++) {
      for (const kind of ['mook_shield', 'mook_grenadier', 'dog']) {
        expect(enemies(i, kind), `${MISSIONS[i].id} ${kind}`).toBeGreaterThan(0);
      }
    }
  });

  it('gets harder: each mission is longer and holds more enemies than the one before', () => {
    for (let i = 1; i < built.length; i++) {
      expect(built[i].level.cols, `cols ${MISSIONS[i].id} > ${MISSIONS[i - 1].id}`).toBeGreaterThan(built[i - 1].level.cols);
      expect(enemies(i), `enemies ${MISSIONS[i].id} > ${MISSIONS[i - 1].id}`).toBeGreaterThan(enemies(i - 1));
    }
  });

  it('only the island, the final mission, has Epstein and his Goliath', () => {
    expect(built.map((b) => b.parsed.boss !== null)).toEqual([false, false, false, false, false, false, true]);
    expect(built.map((b) => b.parsed.mech !== null)).toEqual([false, false, false, false, false, false, true]);
  });

  it('every level starts the bro on solid ground and ends at a flag past him', () => {
    for (const { parsed } of built) {
      expect(parsed.map.isSolid(parsed.player.c, parsed.player.r - 1)).toBe(true);
      expect(parsed.flag.c).toBeGreaterThan(parsed.player.c + 50);
    }
  });

  it('has a spot on the world map for each mission, all different and inside the map', () => {
    for (const m of MISSIONS) {
      expect(m.map.x).toBeGreaterThan(0);
      expect(m.map.x).toBeLessThan(1);
      expect(m.map.y).toBeGreaterThan(0);
      expect(m.map.y).toBeLessThan(1);
    }
    expect(new Set(MISSIONS.map((m) => `${m.map.x},${m.map.y}`)).size).toBe(MISSIONS.length);
  });
});
