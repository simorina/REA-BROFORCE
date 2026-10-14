import { useEffect } from 'react';

interface Props {
  voice: boolean;
  onToggleVoice: () => void;
  onStart: () => void;
}

export function Menu({ voice, onToggleVoice, onStart }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter') onStart();
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
        </tbody>
      </table>
      <label className="toggle">
        <input type="checkbox" checked={voice} onChange={onToggleVoice} /> Voce (sintesi vocale)
      </label>
      <button onClick={onStart} autoFocus>
        Inizia (Invio)
      </button>
      <p className="note">Uso personale: sprite e valori estratti dalla tua copia di Broforce (© Free Lives).</p>
    </div>
  );
}
