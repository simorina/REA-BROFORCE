import { useEffect, useMemo, useRef } from 'react';
import { createHudStore } from '../app/hudStore';
import { Keyboard } from '../app/input';
import { createLoop } from '../app/loop';
import { speak } from '../app/speech';
import { BROLUSCONI } from '../bros';
import { LIVES_START } from '../engine/constants';
import { NO_CONTROLS, type Controls } from '../engine/types';
import { createWorld, stepWorld } from '../engine/world';
import { buildLevel1 } from '../levels/level1';
import { isSheetKey, type Assets } from '../render/assets';
import { VIEW_H, VIEW_W } from '../render/camera';
import { Renderer } from '../render/renderer';
import { Hud } from './Hud';

const SCALE = 3;
const BRO = BROLUSCONI;
if (!isSheetKey(BRO.sheet)) throw new Error(`bro ${BRO.id}: sheet '${BRO.sheet}' is not extracted`);
const BRO_SHEET = BRO.sheet;

interface Props {
  assets: Assets;
  voice: boolean;
  onEnd: (result: 'won' | 'lost') => void;
}

export function GameView({ assets, voice, onEnd }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hud = useMemo(() => createHudStore({ lives: LIVES_START, ammo: assets.stats.units.bro.specialAmmo }), [assets]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const world = createWorld(buildLevel1(), assets.stats, BRO);
    const renderer = new Renderer(ctx, assets, SCALE, BRO_SHEET);
    const keyboard = new Keyboard();
    keyboard.attach(window);
    let prev: Controls = NO_CONTROLS;
    let ended = false;
    let endTimer = 0;
    const loop = createLoop(
      (dt) => {
        const controls = keyboard.snapshot();
        stepWorld(world, controls, prev, dt);
        prev = controls;
        for (const e of world.events.splice(0)) if (e.type === 'voice') speak(e.text, voice);
        hud.set({ lives: world.lives, ammo: world.specialAmmo });
        if (!ended && (world.state === 'won' || world.state === 'lost')) {
          ended = true;
          const result = world.state;
          endTimer = window.setTimeout(() => onEnd(result), 800);
        }
      },
      (frameTime) => renderer.render(world, frameTime),
    );
    loop.start();
    return () => {
      loop.stop();
      keyboard.detach();
      window.clearTimeout(endTimer);
    };
  }, [assets, voice, onEnd, hud]);

  return (
    <div className="game">
      <canvas ref={canvasRef} width={VIEW_W * SCALE} height={VIEW_H * SCALE} />
      <Hud store={hud} portrait={`/${assets.sheets[BRO_SHEET].file}`} />
    </div>
  );
}
