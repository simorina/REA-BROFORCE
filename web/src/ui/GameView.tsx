import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createHudStore } from '../app/hudStore';
import { Keyboard } from '../app/input';
import { createLoop } from '../app/loop';
import { MookVoices, MusicIntensity, musicFor } from '../app/gameAudio';
import { LevelMusic, type MusicTracks } from '../app/levelMusic';
import { Music, anthemShouldPlay } from '../app/music';
import { createPause, isPauseKey } from '../app/pause';
import { Sfx, sfxFor } from '../app/sfx';
import { speak } from '../app/speech';
import { BROS, rosterStartingWith } from '../bros';
import type { BroDef } from '../engine/bro';
import { JET_FUEL, LIVES_START } from '../engine/constants';
import { VIEW_H, VIEW_W } from '../engine/camera';
import type { Jet } from '../engine/jet';
import { NO_CONTROLS, type Controls } from '../engine/types';
import { bossBar, bossFight, bossName } from '../engine/boss';
import { createWorld, stepWorld } from '../engine/world';
import type { LevelData } from '../engine/level';
import { broSheet, gunSheet, type Assets } from '../render/assets';
import { fitCanvas } from '../render/layout';
import { Renderer } from '../render/renderer';
import { Hud } from './Hud';

const SCALE = 3;
for (const b of BROS) broSheet(b); // every bro's sheet must be one the extractor writes

interface Props {
  assets: Assets;
  broId: string;
  buildLevel: () => LevelData; // the mission's level
  voice: boolean;
  sound: boolean; // the effects and the mobs' voices
  music: boolean; // the level's music, and the vehicles' and Django's
  onEnd: (result: 'won' | 'lost', broName: string) => void;
  onMenu: () => void;
}

export function GameView({ assets, broId, buildLevel, voice, sound, music, onEnd, onMenu }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const roster = useMemo(() => rosterStartingWith(broId), [broId]);
  const portraitOf = useCallback((b: BroDef) => `/${assets.sheets[broSheet(b)].file}`, [assets]);
  const hud = useMemo(
    () => createHudStore({ lives: LIVES_START, ammo: assets.stats.bros[roster[0].base].specialAmmo, portrait: portraitOf(roster[0]), fuel: null, boss: null, bossName: null }),
    [assets, roster, portraitOf],
  );
  const pause = useMemo(() => createPause(), []);
  const paused = useSyncExternalStore(pause.subscribe, pause.get);
  const [size, setSize] = useState(() => fitCanvas(window.innerWidth, window.innerHeight));

  useEffect(() => {
    const onResize = () => setSize(fitCanvas(window.innerWidth, window.innerHeight));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const level = buildLevel();
    const world = createWorld(level, assets.stats, roster);
    const renderer = new Renderer(ctx, assets, SCALE, () => broSheet(world.bro), () => gunSheet(world.bro.weapon, world.django !== null), level.parallax, Math.random, level.theme);
    const keyboard = new Keyboard();
    keyboard.attach(window);
    const sfx = new Sfx(sound);
    // one player per vehicle: the tank's anthem, and the jet's sound (the user's own, else the US anthem)
    const tankAnthem = new Music(music ? new Audio() : null, ['/audio/anthem_ru.ogg']);
    // Samuel as Django: the user's own copy of the theme if there is one (never committed), else our western loop
    const djangoMusic = new Music(music ? new Audio() : null, ['/audio/django_custom.mp3', '/audio/django_western.wav']);
    const jetMusic = new Music(music ? new Audio() : null, ['/audio/trump_custom.mp3', '/audio/anthem_us.ogg']);
    // Broforce's own sounds, when the extractor has read them: the mobs' voices and the level's music with its boss fights
    const gameAudio = assets.audio;
    const voices = gameAudio ? new MookVoices(gameAudio) : null;
    const intensity = new MusicIntensity();
    let levelMusic: LevelMusic | null = null;
    if (gameAudio && music) {
      const track = gameAudio.music[musicFor(level)];
      const b = gameAudio.boss;
      const tracks: MusicTracks = {
        low: `/${track.low}`, high: `/${track.high}`, boss: { epstein: `/${b.epstein}`, goliath: `/${b.goliath}`, dolph: `/${b.dolph}` },
        sting: `/${b.sting}`,
      };
      levelMusic = new LevelMusic((src) => {
        const a = new Audio(src);
        a.preload = 'auto';
        return a;
      }, tracks);
    }
    const unsubscribePause = pause.subscribe(() => {
      sfx.setPaused(pause.get());
      if (pause.get()) { // a hidden tab pauses without rendering frames, so don't wait for a fade
        tankAnthem.silence();
        djangoMusic.silence();
        jetMusic.silence();
        levelMusic?.silence();
      }
    });
    const onPauseKey = (e: KeyboardEvent) => {
      if (!isPauseKey(e.code)) return;
      e.preventDefault();
      if (!e.repeat) pause.toggle(); // holding Esc must not flicker the pause
    };
    const onBlur = () => pause.set(true);
    const onVisibility = () => {
      if (document.hidden) pause.set(true);
    };
    window.addEventListener('keydown', onPauseKey);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    let prev: Controls = NO_CONTROLS;
    let ended = false;
    let endTimer = 0;
    const loop = createLoop(
      (dt) => {
        if (pause.get()) {
          keyboard.snapshot(); // taps made while paused don't fire on resume
          return;
        }
        const controls = keyboard.snapshot();
        stepWorld(world, controls, prev, dt);
        prev = controls;
        intensity.step(dt);
        for (const e of world.events.splice(0)) {
          if (e.type === 'voice') {
            speak(e.text, e.lang, voice);
            continue;
          }
          if (e.type === 'mookVoice') {
            const said = voices?.say(e, world.time);
            if (said) sfx.playFile(said.file, e.x, world.camera.x, said.volume, said.rate);
          }
          if (e.type === 'kill') intensity.kill();
          if (e.type === 'explosion' && e.source === 'vehicle') intensity.vehicle();
          if (e.type === 'django') djangoMusic.rewind(); // the theme starts from the top
          const name = sfxFor(e);
          if (name) sfx.play(name, e.x, world.camera.x);
          renderer.onEvent(e);
        }
        hud.set({
          lives: world.lives, ammo: world.specialAmmo, portrait: portraitOf(world.bro),
          fuel: world.driving?.kind === 'jet' ? Math.round(((world.driving as Jet).fuel / JET_FUEL) * 20) / 20 : null,
          boss: bossBar(world),
          bossName: bossName(world),
        });
        if (!ended && (world.state === 'won' || world.state === 'lost')) {
          ended = true;
          const result = world.state;
          const broName = world.bro.name;
          endTimer = window.setTimeout(() => onEnd(result, broName), 800);
        }
      },
      (frameTime) => {
        const paused = pause.get();
        renderer.render(world, paused ? 0 : frameTime);
        const musicDt = paused ? 1 : frameTime;
        tankAnthem.update(anthemShouldPlay(world.driving?.kind === 'tank', world.state, paused, music), musicDt);
        djangoMusic.update(anthemShouldPlay(world.django !== null, world.state, paused, music), musicDt);
        jetMusic.update(anthemShouldPlay(world.driving?.kind === 'jet', world.state, paused, music), musicDt);
        levelMusic?.update(musicDt, {
          on: !paused && (world.state === 'playing' || world.state === 'extracting'),
          high: intensity.high,
          boss: bossFight(world),
          duck: Math.max(tankAnthem.level, djangoMusic.level, jetMusic.level), // under the vehicles' and Django's music
          victory: world.mech?.destroyed === true,
        });
      },
    );
    loop.start();
    return () => {
      loop.stop();
      keyboard.detach();
      unsubscribePause();
      sfx.dispose();
      tankAnthem.dispose();
      djangoMusic.dispose();
      jetMusic.dispose();
      levelMusic?.dispose();
      window.removeEventListener('keydown', onPauseKey);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearTimeout(endTimer);
    };
  }, [assets, buildLevel, voice, sound, music, onEnd, hud, pause, roster, portraitOf]);

  return (
    <div className="game" style={{ width: size.width, height: size.height }}>
      <canvas ref={canvasRef} width={VIEW_W * SCALE} height={VIEW_H * SCALE} />
      <Hud store={hud} />
      {paused && (
        <div className="pause">
          <h2>PAUSA</h2>
          <button onClick={() => pause.set(false)} autoFocus>
            Riprendi (Esc)
          </button>
          <button onClick={onMenu}>Menu</button>
        </div>
      )}
    </div>
  );
}
