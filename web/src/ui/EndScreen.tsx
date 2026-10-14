interface Props {
  result: 'won' | 'lost';
  onRestart: () => void;
  onMenu: () => void;
}

export function EndScreen({ result, onRestart, onMenu }: Props) {
  return (
    <div className="screen end">
      <h1>{result === 'won' ? 'MISSIONE COMPIUTA' : 'GAME OVER'}</h1>
      <p>{result === 'won' ? "Brolusconi è salito sull'elicottero." : 'Hai finito le vite.'}</p>
      <button onClick={onRestart} autoFocus>
        Rigioca
      </button>
      <button onClick={onMenu}>Menu</button>
    </div>
  );
}
