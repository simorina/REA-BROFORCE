import { describe, expect, it } from 'vitest';
import { parseLevel } from '../engine/level';
import { plantMine } from '../engine/mines';
import { TEST_STATS } from '../engine/testStats';
import { MISSIONS } from './index';

const built = MISSIONS.map((m) => {
  const level = m.build();
  return { m, level, parsed: parseLevel(level, TEST_STATS) };
});
const enemies = (i: number, kind?: string) => built[i].parsed.enemies.filter((e) => !kind || e.kind === kind).length;

describe('the campaign missions', () => {
  it("are missions tracing the Epstein files to the final battle on Epstein's island", () => {
    expect(MISSIONS.map((m) => m.id)).toEqual(['desert', 'harbor', 'burning', 'tower', 'airstrip', 'temple', 'convoy', 'lab', 'inferno', 'island']);
    expect(MISSIONS.map((m) => m.name)).toEqual([
      'Il deserto',
      'Il porto dei segreti',
      'La giungla in fiamme',
      'Il grattacielo',
      "La pista d'atterraggio",
      'Il tempio sotterraneo',
      'Il convoglio',
      'Il laboratorio',
      "L'inferno",
      "L'isola di Epstein",
    ]);
  });

  it("each mission sits on a territory of Broforce's globe", () => {
    expect(MISSIONS.map((m) => m.territory)).toEqual(['afghanistan', 'hongkong', 'vietnam', 'usa', 'panama', 'amazon', 'ukraine', 'congo', 'hell', 'hawaii']);
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
      'city',
      'forest',
      'hell',
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

  it('the desert brings in the minefield and a jetpack mook; from the harbor on, every mission mixes in all the new mobs', () => {
    expect(enemies(0, 'mook_jetpack')).toBeGreaterThan(0);
    expect(built[0].parsed.signs.length).toBeGreaterThan(0);
    for (let i = 1; i < built.length; i++) {
      for (const kind of ['mook_bruiser', 'mook_jetpack', 'mook_jetpack_bazooka', 'mook_ninja', 'mook_alarmist']) {
        expect(enemies(i, kind), `${MISSIONS[i].id} ${kind}`).toBeGreaterThan(0);
      }
      expect(built[i].parsed.signs.length, `${MISSIONS[i].id} minefield`).toBeGreaterThanOrEqual(2);
    }
  });

  it('every minefield sign stands on the surface in open air and plants its mine', () => {
    for (const { m, parsed } of built) {
      for (const s of parsed.signs) {
        expect(parsed.map.isSolid(s.c, s.r - 1) && !parsed.map.isSolid(s.c, s.r), `${m.id} sign ${s.c},${s.r}`).toBe(true);
        for (const roll of [0, 0.5, 0.99]) expect(plantMine(parsed.map, s, () => roll), `${m.id} sign ${s.c}`).not.toBeNull();
      }
    }
  });

  it('every alarmist stands under open sky, so the paratroopers his alarm calls can drop in', () => {
    for (const { m, parsed } of built) {
      for (const a of parsed.enemies.filter((e) => e.kind === 'mook_alarmist')) {
        for (let c = a.c - 1; c <= a.c + 1; c++) {
          for (let r = a.r; r < parsed.map.rows; r++) expect(parsed.map.isSolid(c, r), `${m.id} alarmist ${a.c}: ${c},${r}`).toBe(false);
        }
      }
    }
  });

  it('every jetpack mook has room over him to take off and hover (48 up)', () => {
    for (const { m, parsed } of built) {
      for (const j of parsed.enemies.filter((e) => e.kind === 'mook_jetpack' || e.kind === 'mook_jetpack_bazooka')) {
        for (let r = j.r; r <= j.r + 3; r++) expect(parsed.map.isSolid(j.c, r), `${m.id} jetpack ${j.c}: row ${r}`).toBe(false);
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
    expect(built.map((b) => b.parsed.boss !== null)).toEqual([false, false, false, false, false, false, false, false, false, true]);
    expect(built.map((b) => b.parsed.mech !== null)).toEqual([false, false, false, false, false, false, false, false, false, true]);
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
