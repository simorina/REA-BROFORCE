# REA-BROFORCE

Una versione reverse-engineered di **Broforce**. È un remake per browser (React + TypeScript) che ricostruisce dal gioco
originale fisica, armi, nemici, intelligenza artificiale ed effetti. Sprite, valori, suoni e musica li legge dalla tua
copia installata di Broforce.

Sopra c'è una campagna parodia: **Operazione Little Saint James**.

> Progetto amatoriale e non ufficiale, senza legami con Free Lives o Devolver Digital. Broforce © Free Lives.
> **Questa repo non contiene nessun asset del gioco**: per giocare serve una copia di Broforce.

## Com'è fatto

- **Il reverse engineering.** Il codice di Broforce (Unity, C#) è stato decompilato in locale per studiarlo.
  - Il motore ne reimplementa il comportamento in TypeScript: i movimenti dei bros, l'IA dei mook, armi, esplosioni,
    porte, alieni, inferno e boss.
  - Nei commenti cita classe e metodo originali, per esempio `TestVanDammeAnim`, `PolymorphicAI.GreetPlayer`,
    `Sound.PlayMusic`.
  - [docs/findings.md](docs/findings.md) documenta ogni valore con la sua fonte nel gioco.
- **Gli asset.** [extractor/](extractor/) (Python 3.12 + UnityPy) legge dalla tua installazione e scrive tutto in
  `game-data/`, che non viene mai committata. Legge:
  - gli sprite e i valori dei prefab;
  - gli effetti e gli sfondi;
  - il globo 3D della mappa del mondo;
  - le voci dei nemici e la musica dei livelli.
- **Il gioco.** [web/](web/) usa React 18, Vite e TypeScript in modalità strict. Il motore è TypeScript puro, disegnato
  su un canvas, e ha circa 700 test con Vitest.

## La campagna

Sono dieci missioni sul globo di Broforce, dal deserto all'isola del Finanziere, passando per un laboratorio alieno e
per l'inferno. I bros sono parodie di personaggi pubblici, ciascuno con arma e speciale presi da un bro originale:

| Bro | Arma | Speciale |
| --- | --- | --- |
| Silvio Brolusconi | pallone esplosivo | attacco aereo |
| Vladimir Putin | judo | carro armato |
| Donald Trump | fucile d'assalto | jet |
| Kim Jong-un | lanciarazzi | missile nucleare |
| Bro In Black | Noisy Cricket | neuralizzatore |
| Samuel L. Jackson | katana | diventa Django |
| Che Guevara | M60 | molotov |
| Giorgia Meloni | lanciafiamme | muro di fuoco |
| Elon Musk | laser Tesla | droni e jetpack |

La trama e i personaggi sono in [docs/lore.md](docs/lore.md). È satira in stile cartone animato: la lore usa solo fatti
pubblici e documentati. Il cattivo è un finanziere da fumetto, e non si parla dei suoi crimini né delle vittime.

## Come si avvia

Serve:
- Broforce installato (Steam, Windows);
- Python 3.12;
- Node.js 22;
- ffmpeg (facoltativo: comprime la musica in Ogg; senza, la musica resta in WAV e pesa dieci volte tanto).

**1. Estrai i dati dalla tua copia del gioco:**

```sh
cd extractor
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt
.venv/Scripts/python -m extractor "C:/Program Files (x86)/Steam/steamapps/common/Broforce/Broforce_beta_Data" ../game-data
```

Le opzioni:
- `--no-audio` salta il download degli inni (da Wikimedia Commons);
- `--no-game-audio` salta voci e musica, utile quando cambiano solo sprite o valori.

**2. Avvia il gioco:**

```sh
cd web
npm install
npm run dev
```

Poi apri http://localhost:5173.

**Comandi:**
- frecce o A/D per muoverti;
- Z o Spazio per saltare;
- X per sparare;
- C per lo speciale;
- Shift per lo scatto;
- F per flettere i muscoli;
- Esc per la pausa.

## Test

```sh
cd web && npm test
cd extractor && .venv/Scripts/python -m pytest   # i test d'integrazione leggono la tua installazione di Broforce
```

## Struttura

- `web/src/engine/`: il motore (fisica, IA, armi, mondo), senza DOM.
- `web/src/render/`: il rendering su canvas e gli effetti.
- `web/src/levels/` e `web/src/bros/`: le missioni e i bros, come dati.
- `web/src/app/` e `web/src/ui/`: suoni, musica, impostazioni e le schermate React.
- `extractor/`: l'estrattore degli asset e le sue ricolorazioni.
- `docs/`: findings (i valori del gioco con le loro fonti), specifiche, piani e lore.

## Note

- La repo contiene solo codice e documentazione nostri. Sprite, suoni, musica e codice decompilato di Broforce restano
  in locale (`game-data/`, `decompiled/`, esclusi da git).
- Le voci dei bros sono lette dalla sintesi vocale del browser; non si usano registrazioni delle persone reali.
- Gli inni li scarica l'estrattore da Wikimedia Commons:
  - l'inno russo, dell'Orchestra presidenziale della Federazione Russa (kremlin.ru);
  - l'inno USA, della United States Navy Band (pubblico dominio).
