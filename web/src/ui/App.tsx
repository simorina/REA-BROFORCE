import { useCallback, useEffect, useState } from 'react';
import { loadVoiceSetting, saveVoiceSetting } from '../app/settings';
import { loadAssets, type Assets } from '../render/assets';
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
  const [run, setRun] = useState(0);

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

  if (screen.name === 'loading') return <div className="screen">Caricamento…</div>;
  if (screen.name === 'missing') return <MissingData reason={screen.reason} />;
  if (!assets) return null;
  if (screen.name === 'menu') return <Menu voice={voice} onToggleVoice={toggleVoice} onStart={start} />;
  if (screen.name === 'playing') {
    return <GameView key={run} assets={assets} voice={voice} onEnd={onEnd} onMenu={() => setScreen({ name: 'menu' })} />;
  }
  return <EndScreen result={screen.result} onRestart={start} onMenu={() => setScreen({ name: 'menu' })} />;
}
