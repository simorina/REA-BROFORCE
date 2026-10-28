interface Props {
  result: 'won' | 'lost';
  broName: string; // the bro playing when the level ended
  final: boolean; // the island won: the campaign is over
  onRestart: () => void; // the same mission again
  onMap: () => void;
  onMenu: () => void;
}

/** The lore's epilogue (docs/lore.md), shown once the island is won. */
export const EPILOGUE =
  'Il Goliath è un rottame fumante e i Fascicoli sono in mano alla Broforce. Il corpo di J.E., come al solito, non si trova. ' +
  'Silvio prepara la conferenza stampa a reti unificate, Trump il post, Musk lo pubblica su X prima di tutti. ' +
  'Poi Bro In Black alza il neuralizzatore: un lampo, e nessuno ricorda più niente. Per questo i Fascicoli veri non escono mai del tutto. ' +
  "Dall'inferno arriva una risata: nel lampo il Libro Nero è sparito. Ce l'ha Satana.";

export function endMessage(result: 'won' | 'lost', broName: string, final = false): string {
  if (result === 'lost') return 'Hai finito le vite.';
  const boarded = `${broName} è salito sull'elicottero.`;
  return final ? `${boarded} Epstein è sconfitto: campagna completata!` : boarded;
}

export function EndScreen({ result, broName, final, onRestart, onMap, onMenu }: Props) {
  return (
    <div className="screen end">
      <h1>{result === 'won' ? (final ? 'CAMPAGNA COMPLETATA' : 'MISSIONE COMPIUTA') : 'GAME OVER'}</h1>
      <p>{endMessage(result, broName, final)}</p>
      {final && result === 'won' && <p className="epilogue">{EPILOGUE}</p>}
      {result === 'lost' && (
        <button onClick={onRestart} autoFocus>
          Riprova la missione
        </button>
      )}
      <button onClick={onMap} autoFocus={result === 'won'}>
        Mappa
      </button>
      <button onClick={onMenu}>Menu</button>
    </div>
  );
}
