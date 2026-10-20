import { useEffect, useMemo, useRef, useState } from 'react';
import { currentMission, flightStart, heliAt } from '../app/campaign';
import { MISSIONS } from '../levels';
import type { Assets } from '../render/assets';
import { loadGlobe, type GlobeTerritory } from '../render/globe/data';
import { GlobeView, type GlobeMission } from '../render/globe/GlobeView';
import { ICON_UNITS, UI_HALF_HEIGHT, bounceIcon, placeIcon, popIcon, stepIcon, type IconSpring } from '../render/globe/markers';
import { fromLatLon, normalize, type Vec3 } from '../render/globe/orbit';
import { fitCanvas } from '../render/layout';
import { MAP_H, MAP_W, drawWorldMap, type MapMission } from '../render/worldmap';

const SCALE = 3;
const MAP_CHROME = 270; // the title, the message, the mission lines and the buttons around the map
const SEA_START: Vec3 = fromLatLon(0.25, 1.0); // where the first flight comes in from, north of the first mission
// Broforce's threat levels are colour names (THREAT LEVEL: Salmon, Burgundy, Infinite...): ours climb with the campaign
const THREATS: ReadonlyArray<readonly [string, string]> = [
  ['Giallo', '#ffe400'], ['Ambra', '#ffbb00'], ['Salmone', '#ff717e'], ['Rosso', '#ff0000'], ['Cremisi', '#eb133e'],
  ['Bordeaux', '#c00030'], ['Vinaccia', '#9e0028'], ['Porpora', '#a0135f'], ['Nero', '#5a0010'],
];
const LAST_THREAT: readonly [string, string] = ['Infinito', '#ff0000']; // the island, always

interface Props {
  assets: Assets;
  done: number; // missions done, in order
  message: string | null; // how the last mission went
  onPlay: (index: number) => void;
  onMenu: () => void;
}

type Spot = { x: number; y: number };
type Mode = 'loading' | 'globe' | 'flat';

/** The campaign's world map: Broforce's 3D globe with its helicopter flying to the mission to play; Enter lands it there. */
export function WorldMap({ assets, done, message, onPlay, onMenu }: Props) {
  const glRef = useRef<HTMLCanvasElement>(null);
  const flatRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<GlobeView | null>(null);
  const iconRefs = useRef<Array<HTMLDivElement | null>>([]);
  const arrowRefs = useRef<Array<HTMLImageElement | null>>([]);
  const springs = useRef<IconSpring[]>([]);
  const unlocked = currentMission(done);
  const [selected, setSelected] = useState(unlocked);
  const [mode, setMode] = useState<Mode>('loading');
  const [icons, setIcons] = useState<{ terror: string; arrow: string } | null>(null);
  const [departing, setDeparting] = useState(false);
  const flat = useRef<{ from: Spot; to: Spot; start: number }>({
    from: flightStart(unlocked), to: MISSIONS[unlocked].map, start: performance.now(),
  });
  const [size, setSize] = useState(() => fitCanvas(window.innerWidth - 32, window.innerHeight - MAP_CHROME));
  const themes = useMemo(() => MISSIONS.map((m) => m.build().theme ?? 'jungle'), []);
  const states = useMemo(() => MISSIONS.map((_, i) => (i < done ? 'done' : i === unlocked ? 'next' : 'locked') as GlobeMission['state']), [done, unlocked]);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useEffect(() => {
    const onResize = () => setSize(fitCanvas(window.innerWidth - 32, window.innerHeight - MAP_CHROME));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // choosing another mission sends the helicopter there from where it is
  const choose = (i: number) => {
    if (i === selected || departing) return;
    if (viewRef.current) {
      viewRef.current.select(i);
    } else {
      const now = performance.now();
      const f = flat.current;
      const at = heliAt(f.from, f.to, (now - f.start) / 1000);
      flat.current = { from: { x: at.x, y: at.y }, to: MISSIONS[i].map, start: now };
    }
    setSelected(i);
  };

  // on the globe the helicopter first sets down on the territory's landing zone, as in Broforce
  const play = () => {
    if (departing) return;
    const view = viewRef.current;
    if (!view) {
      onPlay(selected);
      return;
    }
    setDeparting(true);
    const mission = selected;
    view.land(() => onPlay(mission));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Enter' && !(e.target instanceof HTMLButtonElement)) play();
      else if (e.code === 'Escape') onMenu();
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') choose(Math.max(0, selected - 1));
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') choose(Math.min(unlocked, selected + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // the globe: Broforce's WorldMap3D, or the flat map if game-data/worldmap or WebGL isn't there
  useEffect(() => {
    let alive = true;
    let raf = 0;
    loadGlobe()
      .then(({ data, bin }) => {
        if (!alive || !glRef.current) return;
        const missions = MISSIONS.map((m, i) => ({ territory: m.territory, state: states[i] }));
        const start = unlocked > 0 ? landingOf(data.territories[MISSIONS[unlocked - 1].territory]) : SEA_START;
        const view = new GlobeView(glRef.current, data, bin, missions, unlocked, start);
        viewRef.current = view;
        springs.current = MISSIONS.map(() => popIcon());
        setIcons(data.icons);
        setMode('globe');
        let last = performance.now();
        let wasFlying = view.flying;
        const frame = (now: number) => {
          const dt = Math.min(0.05, (now - last) / 1000);
          last = now;
          view.update(dt);
          if (wasFlying && !view.flying) springs.current[selectedRef.current] = bounceIcon(springs.current[selectedRef.current]);
          wasFlying = view.flying;
          placeIcons(view, dt);
          raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
      })
      .catch(() => {
        if (alive) setMode('flat');
      });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      viewRef.current?.dispose();
      viewRef.current = null;
    };
    // the view is built once per visit; choosing a mission flies the helicopter inside it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  // WMIcon: each territory still to liberate shows its number over its centre, or an arrow at the rim once it's round the back
  const placeIcons = (view: GlobeView, dt: number) => {
    const width = 2 * UI_HALF_HEIGHT * view.aspect;
    MISSIONS.forEach((_, i) => {
      const icon = iconRefs.current[i];
      const arrow = arrowRefs.current[i];
      if (!icon || !arrow) return;
      const s = (springs.current[i] = stepIcon(springs.current[i] ?? popIcon(), dt));
      const v = view.icon(i);
      const p = placeIcon(v, v.front, view.aspect, view.fov);
      const left = `${50 + (p.x / width) * 100}%`;
      const top = `${50 - (p.y / (2 * UI_HALF_HEIGHT)) * 100}%`;
      const el = p.front ? icon : arrow;
      (p.front ? arrow : icon).style.display = 'none';
      el.style.display = 'block';
      el.style.left = left;
      el.style.top = top;
      el.style.transform = `translate(-50%, -50%) rotate(${-p.angle}deg) scale(${Math.max(0, s.scale)})`;
    });
  };

  // the flat map, drawn only when the globe can't be
  useEffect(() => {
    if (mode !== 'flat') return;
    const ctx = flatRef.current?.getContext('2d');
    if (!ctx) return;
    const sheet = assets.sheets.helicopter;
    const art = { image: assets.images.helicopter, frameW: sheet.frameW, frameH: sheet.frameH };
    const missions: MapMission[] = MISSIONS.map((m, i) => ({ spot: m.map, theme: themes[i], name: m.name, missionId: m.id, state: states[i] }));
    const t0 = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const f = flat.current;
      drawWorldMap(ctx, SCALE, { missions, selected, heli: heliAt(f.from, f.to, (now - f.start) / 1000) }, art, (now - t0) / 1000);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [mode, assets, selected, themes, states]);

  const mission = MISSIONS[selected];
  const [threat, threatColor] = selected === MISSIONS.length - 1 ? LAST_THREAT : THREATS[Math.min(selected, THREATS.length - 1)];
  const iconPx = Math.round((size.height * ICON_UNITS) / (2 * UI_HALF_HEIGHT));
  return (
    <div className="screen worldmap">
      <h1>MAPPA DELLE OPERAZIONI</h1>
      {message && <p className="map-message">{message}</p>}
      <div className="map-canvas" style={{ width: size.width, height: size.height }}>
        {mode !== 'flat' && <canvas ref={glRef} width={MAP_W * SCALE} height={MAP_H * SCALE} />}
        {mode === 'flat' && <canvas ref={flatRef} width={MAP_W * SCALE} height={MAP_H * SCALE} />}
        {mode === 'loading' && <div className="map-loading">Caricamento del globo…</div>}
        {mode === 'globe' && icons && MISSIONS.map((_, i) => states[i] !== 'done' && (
          <div key={i}>
            <div ref={(el) => { iconRefs.current[i] = el; }} className={`map-icon${states[i] === 'locked' ? ' locked' : ''}`}
              style={{ width: iconPx, height: iconPx, fontSize: Math.round(iconPx * 0.5) }}>
              <img src={`/${icons.terror}`} alt="" />
              <span>{i + 1}</span>
            </div>
            <img ref={(el) => { arrowRefs.current[i] = el; }} className={`map-arrow${states[i] === 'locked' ? ' locked' : ''}`}
              src={`/${icons.arrow}`} alt=""
              style={{ width: iconPx, height: iconPx }} />
          </div>
        ))}
        {departing && <div className="map-godspeed">CHE DIO VI ASSISTA, BROFORCE!</div>}
      </div>
      <p className="map-mission">
        Missione {selected + 1}: <strong>{mission.name}</strong>
        {selected < done ? ' (completata)' : ''}
      </p>
      <p className="map-threat">
        LIVELLO DI MINACCIA: <span style={{ color: threatColor }}>{threat.toUpperCase()}</span>
      </p>
      <p className="map-briefing">{mission.briefing}</p>
      <button onClick={play} autoFocus disabled={departing}>
        Parti (Invio)
      </button>
      <button onClick={onMenu}>Menu (Esc)</button>
      <p className="hint">← → per scegliere tra le missioni sbloccate</p>
    </div>
  );
}

function landingOf(t: GlobeTerritory | undefined): Vec3 {
  return t ? normalize([t.landing[0], t.landing[1], t.landing[2]]) : SEA_START;
}
