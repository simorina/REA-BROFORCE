import { useState, type ChangeEvent } from 'react';
import { checkFolder, relativePath, storeGameData, type PickedFile } from '../app/gameDataStore';

const COMMAND = `cd REA-BROFORCE/extractor
.venv/Scripts/python -m extractor "C:/Program Files (x86)/Steam/steamapps/common/Broforce/Broforce_beta_Data" ../game-data`;
const REPO = 'https://github.com/simorina/REA-BROFORCE';
// a deployed site: the player loads his own game-data into the browser (the dev server serves game-data/ itself)
const IN_BROWSER = import.meta.env.PROD && typeof navigator !== 'undefined' && 'serviceWorker' in navigator;

export function MissingData({ reason }: { reason: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []) as PickedFile[];
    const problem = checkFolder(files.map(relativePath).filter((p): p is string => p !== null));
    if (problem) {
      setStatus(problem);
      return;
    }
    setBusy(true);
    try {
      await storeGameData(files, caches, (done, total) => setStatus(`Carico i dati nel browser… ${done}/${total}`));
      location.reload();
    } catch (err) {
      setBusy(false);
      setStatus(`Non sono riuscito a salvare i dati nel browser: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  if (!IN_BROWSER) {
    return (
      <div className="screen missing">
        <h1>Mancano i dati del gioco</h1>
        <p>
          Il remake usa sprite e valori estratti dalla tua installazione di Broforce. Esegui l'estrattore (di nuovo, se
          hai aggiornato il remake e mancano dei valori):
        </p>
        <pre>{COMMAND}</pre>
        <p>Poi ricarica la pagina.</p>
        <p className="note">Dettaglio: {reason}</p>
      </div>
    );
  }
  return (
    <div className="screen missing">
      <h1>Mancano i dati del gioco</h1>
      <p>
        Questo sito non contiene niente di Broforce: sprite, valori, voci e musica vengono dalla tua copia del gioco
        (© Free Lives). Per giocare:
      </p>
      <ol className="steps">
        <li>
          sul tuo PC scarica <a href={REPO}>la repo REA-BROFORCE</a> ed estrai i dati dalla tua installazione di Broforce
          (le istruzioni sono nel README):
          <pre>{COMMAND}</pre>
        </li>
        <li>
          scegli qui la cartella <code>game-data</code> che ha creato. I file restano nel tuo browser: non vengono caricati
          da nessuna parte.
        </li>
      </ol>
      <label className={busy ? 'pick busy' : 'pick'}>
        Scegli la cartella game-data
        <input type="file" multiple hidden disabled={busy} onChange={pick} ref={(el) => el?.setAttribute('webkitdirectory', '')} />
      </label>
      {status && <p className="pick-status">{status}</p>}
      <p className="note">Dettaglio: {reason}</p>
    </div>
  );
}
