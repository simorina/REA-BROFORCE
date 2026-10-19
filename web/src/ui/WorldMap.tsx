import { useEffect, useMemo, useRef, useState } from 'react';
import { currentMission, flightStart, heliAt } from '../app/campaign';
import { MISSIONS } from '../levels';
import type { Assets } from '../render/assets';
import { fitCanvas } from '../render/layout';
import { MAP_H, MAP_W, drawWorldMap, type MapMission } from '../render/worldmap';

const SCALE = 3;
const MAP_CHROME = 250; // the title, the message, the mission line and the buttons around the map

interface Props {
  assets: Assets;
  done: number; // missions done, in order
  message: string | null; // how the last mission went
  onPlay: (index: number) => void;
  onMenu: () => void;
}

type Spot = { x: number; y: number };

/** The campaign's world map: Broforce's helicopter flies to the mission to play; Enter starts it. */
export function WorldMap({ assets, done, message, onPlay, onMenu }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const unlocked = currentMission(done);
  const [selected, setSelected] = useState(unlocked);
  const flight = useRef<{ from: Spot; to: Spot; start: number }>({
    from: flightStart(unlocked), to: MISSIONS[unlocked].map, start: performance.now(),
  });
  const [size, setSize] = useState(() => fitCanvas(window.innerWidth - 32, window.innerHeight - MAP_CHROME));
  const themes = useMemo(() => MISSIONS.map((m) => m.build().theme ?? 'jungle'), []);

  useEffect(() => {
    const onResize = () => setSize(fitCanvas(window.innerWidth - 32, window.innerHeight - MAP_CHROME));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // choosing another mission sends the helicopter there from where it is
  const choose = (i: number) => {
    if (i === selected) return;
    const now = performance.now();
    const f = flight.current;
    const at = heliAt(f.from, f.to, (now - f.start) / 1000);
    flight.current = { from: { x: at.x, y: at.y }, to: MISSIONS[i].map, start: now };
    setSelected(i);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Enter' && !(e.target instanceof HTMLButtonElement)) onPlay(selected);
      else if (e.code === 'Escape') onMenu();
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') choose(Math.max(0, selected - 1));
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') choose(Math.min(unlocked, selected + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const sheet = assets.sheets.helicopter;
    const art = { image: assets.images.helicopter, frameW: sheet.frameW, frameH: sheet.frameH };
    const missions: MapMission[] = MISSIONS.map((m, i) => ({
      spot: m.map, theme: themes[i], name: m.name, missionId: m.id,
      state: i < done ? 'done' : i === unlocked ? 'next' : 'locked',
    }));
    const t0 = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const f = flight.current;
      const heli = heliAt(f.from, f.to, (now - f.start) / 1000);
      drawWorldMap(ctx, SCALE, { missions, selected, heli }, art, (now - t0) / 1000);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [assets, done, unlocked, selected, themes]);

  const mission = MISSIONS[selected];
  return (
    <div className="screen worldmap">
      <h1>MAPPA DELLE OPERAZIONI</h1>
      {message && <p className="map-message">{message}</p>}
      <div className="map-canvas" style={{ width: size.width, height: size.height }}>
        <canvas ref={canvasRef} width={MAP_W * SCALE} height={MAP_H * SCALE} />
      </div>
      <p className="map-mission">
        Missione {selected + 1}: <strong>{mission.name}</strong>
        {selected < done ? ' (completata)' : ''}
      </p>
      <p className="map-briefing">{mission.briefing}</p>
      <button onClick={() => onPlay(selected)} autoFocus>
        Parti (Invio)
      </button>
      <button onClick={onMenu}>Menu (Esc)</button>
      <p className="hint">← → per scegliere tra le missioni sbloccate</p>
    </div>
  );
}
