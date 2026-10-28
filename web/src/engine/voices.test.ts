import { describe, expect, it } from 'vitest';
import { BROLUSCONI } from '../bros';
import { attract, hearSound } from './ai';
import { FIXED_DT } from './constants';
import type { LevelData } from './level';
import { TEST_STATS } from './testStats';
import { NO_CONTROLS, type Controls, type Unit, type VoiceLine } from './types';
import { damageUnit } from './units';
import { createWorld, setOnFire, stepWorld, type GameEvent, type World } from './world';

const COLS = 40;

/** A flat floor with the bro at 3, the flag at 38 and `cells` on the floor row. */
function floor(cells: Array<[number, string]>): LevelData {
  const a = Array<string>(COLS).fill('.');
  for (const [c, ch] of [[3, 'P'], [38, 'F'], ...cells] as Array<[number, string]>) a[c] = ch;
  const e = '.'.repeat(COLS);
  return { cols: COLS, rows: 6, tiles: [e, e, e, a.join(''), 'd'.repeat(COLS), 's'.repeat(COLS)] };
}

const world = (cells: Array<[number, string]>): World => {
  const w = createWorld(floor(cells), TEST_STATS, [BROLUSCONI], () => 0.5);
  w.player.invulnerable = 999;
  return w;
};
const steps = (s: number) => Math.round(s / FIXED_DT);

function play(w: World, frames: number, controls: Partial<Controls> = {}): void {
  const c = { ...NO_CONTROLS, ...controls };
  for (let i = 0; i < frames; i++) stepWorld(w, c, c, FIXED_DT);
}

type MookVoice = Extract<GameEvent, { type: 'mookVoice' }>;
const voices = (w: World, line?: VoiceLine): MookVoice[] =>
  w.events.filter((e): e is MookVoice => e.type === 'mookVoice' && (line === undefined || e.line === line));
const said = (w: World, m: Unit, line: VoiceLine) => voices(w, line).filter((e) => e.unit === m.id);

describe("the mobs' voices (TestVanDammeAnim's Play*Sound, called where Broforce calls them)", () => {
  it('a mook that spots the bro greets him ("!"), with his kind and where he stands', () => {
    const w = world([[9, 'm']]);
    const m = w.enemies[0];
    play(w, steps(1.5));
    expect(said(w, m, 'greet')).toHaveLength(1);
    expect(said(w, m, 'greet')[0]).toMatchObject({ kind: 'mook', unit: m.id });
  });

  it('a noise makes an idle mook say "Huh?" with his "?" (ShowQuestionBubble: PlayConfusedSound)', () => {
    const w = world([[30, 'm']]);
    const m = w.enemies[0];
    m.facing = 1; // looking away
    hearSound(m, TEST_STATS.ai.mook, () => 0.5, m.x - 40, m.y);
    play(w, steps(1));
    expect(said(w, m, 'confused').length).toBeGreaterThan(0);
  });

  it('a mook drawn in by the Alluring flex asks with his attracted line instead', () => {
    const w = world([[30, 'm']]);
    const m = w.enemies[0];
    attract(m, m.x - 40, m.y, () => 0.5);
    play(w, steps(1.5));
    expect(said(w, m, 'attract').length).toBeGreaterThan(0);
    expect(said(w, m, 'confused')).toHaveLength(0);
  });

  it('the mooks who saw him laugh when the bro dies (LaughAtPlayer)', () => {
    const w = world([[9, 'm']]);
    const m = w.enemies[0];
    play(w, steps(1.5));
    w.player.invulnerable = 0;
    damageUnit(w.player, w.player.health + 1, true);
    play(w, steps(2.5));
    expect(said(w, m, 'laugh').length).toBeGreaterThan(0);
  });

  it('a mook set on fire screams in panic (PolymorphicAI.Panic: PlayPanicSound)', () => {
    const w = world([[30, 'm']]);
    const m = w.enemies[0];
    setOnFire(w, m, 0, 50);
    play(w, 1);
    expect(said(w, m, 'panic')).toHaveLength(1);
  });

  it('a mook killed outright says his death line; one blown to bits says nothing', () => {
    const w = world([[20, 'm'], [26, 'm']]);
    const [shot, gibbed] = w.enemies;
    damageUnit(shot, shot.health, true);
    damageUnit(gibbed, gibbed.health + 100, true);
    play(w, 1);
    expect(said(w, shot, 'death')).toHaveLength(1);
    expect(gibbed.gibbed).toBe(true);
    expect(said(w, gibbed, 'death')).toHaveLength(0);
  });

  it('a Bruiser hit but still standing grunts (PlayHitSound: hurtSounds while health > 0)', () => {
    const w = world([[30, 'B']]);
    const b = w.enemies[0];
    expect(b.kind).toBe('mook_bruiser');
    damageUnit(b, 1, true);
    play(w, 1);
    expect(said(w, b, 'hurt')).toHaveLength(1);
  });

  it('a suicide mook screams as he charges, after his greeting and his look (SuicideAI.FullyAlert queues PlaySpecialSound last)', () => {
    const w = world([[9, 'k']]);
    const m = w.enemies[0];
    expect(m.kind).toBe('mook_suicide');
    play(w, steps(3));
    expect(said(w, m, 'greet')).toHaveLength(1);
    expect(said(w, m, 'charge')).toHaveLength(1);
  });

  it('an undead mook lying dead groans as he gets up again (PlayResurrectionSound)', () => {
    const w = world([[6, 'r']]);
    const m = w.enemies[0];
    play(w, steps(4));
    expect(said(w, m, 'rise').length).toBeGreaterThan(0);
  });

  it('Satan laughs out loud', () => {
    const w = world([[12, '6']]);
    const s = w.enemies[0];
    play(w, steps(3));
    expect(said(w, s, 'laugh').length).toBeGreaterThan(0);
  });
});
