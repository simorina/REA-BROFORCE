interface Props {
  result: 'won' | 'lost';
  broName: string; // the bro playing when the level ended
  onRestart: () => void;
  onMenu: () => void;
}

export function endMessage(result: 'won' | 'lost', broName: string): string {
  return result === 'won' ? `${broName} è salito sull'elicottero.` : 'Hai finito le vite.';
}

export function EndScreen({ result, broName, onRestart, onMenu }: Props) {
  return (
    <div className="screen end">
      <h1>{result === 'won' ? 'MISSIONE COMPIUTA' : 'GAME OVER'}</h1>
      <p>{endMessage(result, broName)}</p>
      <button onClick={onRestart} autoFocus>
        Rigioca
      </button>
      <button onClick={onMenu}>Menu</button>
    </div>
  );
}
