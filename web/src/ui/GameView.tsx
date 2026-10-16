import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createHudStore } from '../app/hudStore';
import { Keyboard } from '../app/input';
import { createLoop } from '../app/loop';
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
import { createWorld, stepWorld } from '../engine/world';
import { buildLevel1 } from '../levels/level1';
import { broSheet, type Assets } from '../render/assets';
import { fitCanvas } from '../render/layout';
import { Renderer } from '../render/renderer';
import { Hud } from './Hud';

const SCALE = 3;
for (const b of BROS) broSheet(b); // every bro's sheet must be one the extractor writes

interface Props {
  assets: Assets;
  broId: string;
  voice: boolean;
  sound: boolean;
  onEnd: (result: 'won' | 'lost', broName: string) => void;
  onMenu: () => void;
}

export function GameView({ assets, broId, voice, sound, onEnd, onMenu }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const roster = useMemo(() => rosterStartingWith(broId), [broId]);
  const portraitOf = useCallback((b: BroDef) => `/${assets.sheets[broSheet(b)].file}`, [assets]);
  const hud = useMemo(
    () => createHudStore({ lives: LIVES_START, ammo: assets.stats.bros[roster[0].base].specialAmmo, portrait: portraitOf(roster[0]), fuel: null }),
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
    const level = buildLevel1();
    const world = createWorld(level, assets.stats, roster);
    const renderer = new Renderer(ctx, assets, SCALE, () => broSheet(world.bro), () => (world.bro.weapon === 'rifle' ? 'rifle_gun' : null), level.parallax);
    const keyboard = new Keyboard();
    keyboard.attach(window);
    const sfx = new Sfx(sound);
    const music = new Music(sound ? new Audio('/audio/anthem_ru.ogg') : null);
    const unsubscribePause = pause.subscribe(() => {
      sfx.setPaused(pause.get());
      if (pause.get()) music.silence(); // a hidden tab pauses without rendering frames, so don't wait for a fade
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
        for (const e of world.events.splice(0)) {
          if (e.type === 'voice') {
            speak(e.text, e.lang, voice);
            continue;
          }
          const name = sfxFor(e);
          if (name) sfx.play(name, e.x, world.camera.x);
          renderer.onEvent(e);
        }
        hud.set({
          lives: world.lives, ammo: world.specialAmmo, portrait: portraitOf(world.bro),
          fuel: world.driving?.kind === 'jet' ? Math.round(((world.driving as Jet).fuel / JET_FUEL) * 20) / 20 : null,
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
        music.update(anthemShouldPlay(world.driving !== null, world.state, paused, sound), paused ? 1 : frameTime);
      },
    );
    loop.start();
    return () => {
      loop.stop();
      keyboard.detach();
      unsubscribePause();
      sfx.dispose();
      music.dispose();
      window.removeEventListener('keydown', onPauseKey);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearTimeout(endTimer);
    };
  }, [assets, voice, sound, onEnd, hud, pause, roster, portraitOf]);

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
