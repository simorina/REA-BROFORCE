import { useEffect } from 'react';

interface Props {
  voice: boolean;
  sound: boolean;
  onToggleVoice: () => void;
  onToggleSound: () => void;
  onStart: () => void;
}

export function Menu({ voice, sound, onToggleVoice, onToggleSound, onStart }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // a focused button already starts on Enter through its click
      if (e.code === 'Enter' && !e.repeat && !(e.target instanceof HTMLButtonElement)) onStart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStart]);

  return (
    <div className="screen menu">
      <h1>
        BROFORCE<span>BROLUSCONI</span>
      </h1>
      <table className="controls">
        <tbody>
          <tr><td>← → / A D</td><td>Muoviti</td></tr>
          <tr><td>Z / Spazio</td><td>Salta (tienilo premuto contro un muro per arrampicarti)</td></tr>
          <tr><td>X / J</td><td>Calcia un pallone esplosivo</td></tr>
          <tr><td>C / K</td><td>Attacco aereo (con ↓ lo lanci corto)</td></tr>
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
    </div>
  );
}
