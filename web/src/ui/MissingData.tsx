const COMMAND = `cd Desktop/REA-BROFORCE/extractor
.venv/Scripts/python -m extractor "C:/Program Files (x86)/Steam/steamapps/common/Broforce/Broforce_beta_Data" ../game-data`;

export function MissingData({ reason }: { reason: string }) {
  return (
    <div className="screen missing">
      <h1>Mancano i dati del gioco</h1>
      <p>Il remake usa sprite e valori estratti dalla tua installazione di Broforce. Esegui l'estrattore una volta:</p>
      <pre>{COMMAND}</pre>
      <p>Poi ricarica la pagina.</p>
      <p className="note">Dettaglio: {reason}</p>
    </div>
  );
}
