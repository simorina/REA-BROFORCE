import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  loadBroSetting, loadSoundSetting, loadVoiceSetting, saveBroSetting, saveSoundSetting, saveVoiceSetting,
} from '../app/settings';
import { BROS } from '../bros';
import { broSheet, loadAssets, type Assets } from '../render/assets';
import { EndScreen } from './EndScreen';
import { GameView } from './GameView';
import { Menu } from './Menu';
import { MissingData } from './MissingData';

type Screen =
  | { name: 'loading' }
  | { name: 'missing'; reason: string }
  | { name: 'menu' }
  | { name: 'playing' }
  | { name: 'end'; result: 'won' | 'lost' };

export function App() {
  const [assets, setAssets] = useState<Assets | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'loading' });
  const [voice, setVoice] = useState(loadVoiceSetting);
  const [sound, setSound] = useState(loadSoundSetting);
  const [run, setRun] = useState(0);
  const [broId, setBroId] = useState(() => loadBroSetting(BROS[0].id));

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

  const onEnd = useCallback((result: 'won' | 'lost') => setScreen({ name: 'end', result }), []);
  const start = useCallback(() => {
    setRun((r) => r + 1);
    setScreen({ name: 'playing' });
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
      <Menu bros={BROS} selected={broId} portraits={portraits} voice={voice} sound={sound} onSelect={selectBro}
        onToggleVoice={toggleVoice} onToggleSound={toggleSound} onStart={start} />
    );
  }
  if (screen.name === 'playing') {
    return (
      <GameView key={run} assets={assets} broId={broId} voice={voice} sound={sound} onEnd={onEnd} onMenu={() => setScreen({ name: 'menu' })} />
    );
  }
  return <EndScreen result={screen.result} onRestart={start} onMenu={() => setScreen({ name: 'menu' })} />;
}
