import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createHudStore } from '../app/hudStore';
import { Keyboard } from '../app/input';
import { createLoop } from '../app/loop';
import { createPause, isPauseKey } from '../app/pause';
import { Sfx, sfxFor } from '../app/sfx';
import { speak } from '../app/speech';
import { BROLUSCONI } from '../bros';
import { LIVES_START } from '../engine/constants';
import { VIEW_H, VIEW_W } from '../engine/camera';
import { NO_CONTROLS, type Controls } from '../engine/types';
import { createWorld, stepWorld } from '../engine/world';
import { buildLevel1 } from '../levels/level1';
import { isSheetKey, type Assets } from '../render/assets';
import { fitCanvas } from '../render/layout';
import { Renderer } from '../render/renderer';
import { Hud } from './Hud';

const SCALE = 3;
const BRO = BROLUSCONI;
if (!isSheetKey(BRO.sheet)) throw new Error(`bro ${BRO.id}: sheet '${BRO.sheet}' is not extracted`);
const BRO_SHEET = BRO.sheet;

interface Props {
  assets: Assets;
  voice: boolean;
  sound: boolean;
  onEnd: (result: 'won' | 'lost') => void;
  onMenu: () => void;
}

export function GameView({ assets, voice, sound, onEnd, onMenu }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hud = useMemo(() => createHudStore({ lives: LIVES_START, ammo: assets.stats.units.bro.specialAmmo }), [assets]);
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
    const world = createWorld(level, assets.stats, BRO);
    const renderer = new Renderer(ctx, assets, SCALE, BRO_SHEET, level.parallax);
    const keyboard = new Keyboard();
    keyboard.attach(window);
    const sfx = new Sfx(sound);
    const unsubscribePause = pause.subscribe(() => sfx.setPaused(pause.get()));
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
            speak(e.text, voice);
            continue;
          }
          const name = sfxFor(e);
          if (name) sfx.play(name, e.x, world.camera.x);
          renderer.onEvent(e);
        }
        hud.set({ lives: world.lives, ammo: world.specialAmmo });
        if (!ended && (world.state === 'won' || world.state === 'lost')) {
          ended = true;
          const result = world.state;
          endTimer = window.setTimeout(() => onEnd(result), 800);
        }
      },
      (frameTime) => renderer.render(world, pause.get() ? 0 : frameTime),
    );
    loop.start();
    return () => {
      loop.stop();
      keyboard.detach();
      unsubscribePause();
      sfx.dispose();
      window.removeEventListener('keydown', onPauseKey);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearTimeout(endTimer);
    };
  }, [assets, voice, sound, onEnd, hud, pause]);

  return (
    <div className="game" style={{ width: size.width, height: size.height }}>
      <canvas ref={canvasRef} width={VIEW_W * SCALE} height={VIEW_H * SCALE} />
      <Hud store={hud} portrait={`/${assets.sheets[BRO_SHEET].file}`} />
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
