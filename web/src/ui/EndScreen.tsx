interface Props {
  result: 'won' | 'lost';
  broName: string; // the bro playing when the level ended
  final: boolean; // the island won: the campaign is over
  onRestart: () => void; // the same mission again
  onMap: () => void;
  onMenu: () => void;
}

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
