import { useEffect } from 'react';
import type { BroDef, SpecialId, WeaponId } from '../engine/bro';

const WEAPON_HINT: Record<WeaponId, string> = {
  football: 'Calcia un pallone esplosivo',
  judo: 'Presa di judo: afferra un mook e scaraventalo',
  rifle: "Fucile d'assalto (raffiche da tre)",
};
const SPECIAL_HINT: Record<SpecialId, string> = {
  airstrike: 'Attacco aereo (con ↓ lo lanci corto)',
  tank: 'Carro armato: lancia il segnale e salici sopra (X spara, C cambia arma, F scendi)',
  jet: 'Jet: lancia il segnale e salici sopra (frecce per volare, X razzi, C bomba, F salti giù)',
};

interface Props {
  bros: readonly BroDef[];
  selected: string;
  portraits: Record<string, string>; // bro id -> URL of his sheet
  voice: boolean;
  sound: boolean;
  onSelect: (id: string) => void;
  onToggleVoice: () => void;
  onToggleSound: () => void;
  onStart: () => void;
}

export function Menu({ bros, selected, portraits, voice, sound, onSelect, onToggleVoice, onToggleSound, onStart }: Props) {
  const index = Math.max(0, bros.findIndex((b) => b.id === selected));
  const bro = bros[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      // a focused button already starts on Enter through its click
      if (e.code === 'Enter' && !(e.target instanceof HTMLButtonElement)) onStart();
      const step = e.code === 'ArrowLeft' || e.code === 'KeyA' ? -1 : e.code === 'ArrowRight' || e.code === 'KeyD' ? 1 : 0;
      if (step !== 0) onSelect(bros[(index + step + bros.length) % bros.length].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bros, index, onSelect, onStart]);

  return (
    <div className="screen menu">
      <h1>
        BROFORCE<span>{bro.name.split(' ').pop()?.toUpperCase()}</span>
      </h1>
      <div className="bros" role="radiogroup" aria-label="Scegli il bro">
        {bros.map((b) => (
          <button
            key={b.id}
            type="button"
            role="radio"
            aria-checked={b.id === bro.id}
            tabIndex={-1}
            className={b.id === bro.id ? 'bro-card selected' : 'bro-card'}
            onMouseDown={(e) => e.preventDefault()} // keep the focus on Start, so Enter still starts
            onClick={() => onSelect(b.id)}
          >
            <span className="portrait" style={{ backgroundImage: `url(${portraits[b.id]})` }} />
            {b.name}
          </button>
        ))}
      </div>
      <p className="hint">← → per scegliere il bro (salvare un prigioniero ti passa all'altro)</p>
      <table className="controls">
        <tbody>
          <tr><td>← → / A D</td><td>Muoviti</td></tr>
          <tr><td>Z / Spazio</td><td>Salta (tienilo premuto contro un muro per arrampicarti)</td></tr>
          <tr><td>X / J</td><td>{WEAPON_HINT[bro.weapon]}</td></tr>
          <tr><td>C / K</td><td>{SPECIAL_HINT[bro.special]}</td></tr>
          <tr><td>Shift</td><td>Scatto</td></tr>
          <tr><td>F / L</td><td>Flessiona i muscoli (col potere Allure i mook vengono a guardare)</td></tr>
          <tr><td>Esc / P</td><td>Pausa</td></tr>
        </tbody>
      </table>
      <div className="toggles">
        <label className="toggle">
          <input type="checkbox" checked={sound} onChange={onToggleSound} /> Effetti sonori
        </label>
        <label className="toggle">
          <input type="checkbox" checked={voice} onChange={onToggleVoice} /> Voce (sintesi vocale)
        </label>
      </div>
      <button onClick={onStart} autoFocus>
        Inizia (Invio)
      </button>
      <p className="note">Uso personale: sprite e valori estratti dalla tua copia di Broforce (© Free Lives).</p>
      <p className="note">Inno russo: Orchestra presidenziale della Federazione Russa (kremlin.ru, via Wikimedia Commons).</p>
      <p className="note">Inno USA: United States Navy Band (pubblico dominio, via Wikimedia Commons).</p>
    </div>
  );
}
