import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  loadBroSetting, loadMusicSetting, loadSoundSetting, loadVoiceSetting, saveBroSetting, saveMusicSetting, saveSoundSetting,
  saveVoiceSetting,
} from '../app/settings';
import { BROS } from '../bros';
import { afterMission, campaignComplete, loadProgress, saveProgress } from '../app/campaign';
import { MISSIONS } from '../levels';
import { broSheet, loadAssets, type Assets } from '../render/assets';
import { EndScreen } from './EndScreen';
import { GameView } from './GameView';
import { Menu } from './Menu';
import { MissingData } from './MissingData';
import { WorldMap } from './WorldMap';

type Screen =
  | { name: 'loading' }
  | { name: 'missing'; reason: string }
  | { name: 'menu' }
  | { name: 'map'; message: string | null }
  | { name: 'playing'; mission: number }
  | { name: 'end'; result: 'won' | 'lost'; broName: string; mission: number; final: boolean };

export function App() {
  const [assets, setAssets] = useState<Assets | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'loading' });
  const [voice, setVoice] = useState(loadVoiceSetting);
  const [sound, setSound] = useState(loadSoundSetting);
  const [music, setMusic] = useState(loadMusicSetting);
  const [run, setRun] = useState(0);
  const [broId, setBroId] = useState(() => loadBroSetting(BROS[0].id));
  const [done, setDone] = useState(loadProgress); // missions done in the campaign

  useEffect(() => {
    let alive = true;
    loadAssets()
      .then((a) => {
        if (!alive) return;
        setAssets(a);
        setScreen({ name: 'menu' });
      })
      .catch((e: unknown) => {
        if (alive) setScreen({ name: 'missing', reason: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      alive = false;
    };
  }, []);

  const play = useCallback((mission: number) => {
    setRun((r) => r + 1);
    setScreen({ name: 'playing', mission });
  }, []);
  const openMap = useCallback(() => setScreen({ name: 'map', message: null }), []);
  // a won mission flies the helicopter on to the next one; a loss, or the island won, gets the end screen
  // (read through refs, so the game in play never sees a new onEnd)
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const doneRef = useRef(done);
  doneRef.current = done;
  const onEnd = useCallback((result: 'won' | 'lost', broName: string) => {
    const s = screenRef.current;
    if (s.name !== 'playing') return;
    const before = doneRef.current;
    const next = afterMission(before, s.mission, result);
    if (next !== before) {
      saveProgress(next);
      setDone(next);
    }
    const final = result === 'won' && s.mission === MISSIONS.length - 1 && campaignComplete(next);
    if (result === 'won' && !final) {
      setScreen({ name: 'map', message: `${broName} è salito sull'elicottero: missione "${MISSIONS[s.mission].name}" compiuta!` });
    } else {
      setScreen({ name: 'end', result, broName, mission: s.mission, final });
    }
  }, []);
  const toggleVoice = useCallback(() => {
    setVoice((v) => {
      saveVoiceSetting(!v);
      return !v;
    });
  }, []);
  const toggleSound = useCallback(() => {
    setSound((v) => {
      saveSoundSetting(!v);
      return !v;
    });
  }, []);
  const toggleMusic = useCallback(() => {
    setMusic((v) => {
      saveMusicSetting(!v);
      return !v;
    });
  }, []);
  const selectBro = useCallback((id: string) => {
    saveBroSetting(id);
    setBroId(id);
  }, []);
  const portraits = useMemo(
    () => (assets ? Object.fromEntries(BROS.map((b) => [b.id, `/${assets.sheets[broSheet(b)].file}`])) : {}),
    [assets],
  );

  if (screen.name === 'loading') return <div className="screen">Caricamento…</div>;
  if (screen.name === 'missing') return <MissingData reason={screen.reason} />;
  if (!assets) return null;
  if (screen.name === 'menu') {
    return (
      <Menu bros={BROS} selected={broId} portraits={portraits} voice={voice} sound={sound} music={music} onSelect={selectBro}
        onToggleVoice={toggleVoice} onToggleSound={toggleSound} onToggleMusic={toggleMusic} onStart={openMap} />
    );
  }
  if (screen.name === 'map') {
    return <WorldMap assets={assets} done={done} message={screen.message} onPlay={play} onMenu={() => setScreen({ name: 'menu' })} />;
  }
  if (screen.name === 'playing') {
    return (
      <GameView key={run} assets={assets} broId={broId} buildLevel={MISSIONS[screen.mission].build} voice={voice} sound={sound}
        music={music} onEnd={onEnd} onMenu={() => setScreen({ name: 'menu' })} />
    );
  }
  const mission = screen.mission;
  return (
    <EndScreen result={screen.result} broName={screen.broName} final={screen.final} onRestart={() => play(mission)}
      onMap={openMap} onMenu={() => setScreen({ name: 'menu' })} />
  );
}
