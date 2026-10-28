import type { LevelData } from '../engine/level';
import { buildAirstrip } from './airstrip';
import { buildBurning } from './burning';
import { buildConvoy } from './convoy';
import { buildDesert } from './desert';
import { buildHarbor } from './harbor';
import { buildInferno } from './inferno';
import { buildLab } from './lab';
import { buildLevel1 } from './level1';
import { buildTemple } from './temple';
import { buildTower } from './tower';

/** A campaign mission: its level and where it sits on the world map (fractions of the map's width and height). */
export interface Mission {
  id: string;
  name: string;
  briefing: string;
  build: () => LevelData;
  map: { x: number; y: number }; // on the flat fallback map
  territory: string; // on Broforce's 3D globe (game-data/worldmap territories)
}

/**
 * The campaign "Operation: Little Saint James" (its story: docs/lore.md) — missions tracing the Epstein files from
 * desert intelligence intercepts through harbor raids, burning evidence, a Manhattan skyscraper,
 * a private airstrip, an underground temple, an armoured convoy, an alien lab and hell itself, to the final assault on Epstein's island.
 */
export const MISSIONS: readonly Mission[] = [
  {
    id: 'desert', name: 'Il deserto',
    briefing: "Il Contabile di J.E. ha parlato: vuole uscirne e si fida solo di Silvio. In una base segreta nel deserto ci sono i Fascicoli, la contabilità di trent'anni di denaro sporco verso un beneficiario che firma con due iniziali: J.E. Prendili e segui il denaro.",
    build: buildDesert, map: { x: 0.10, y: 0.38 }, territory: 'afghanistan',
  },
  {
    id: 'harbor', name: 'Il porto dei segreti',
    briefing: 'I Fascicoli portano a uno dei porti più trafficati del mondo. Ogni notte arrivano container sigillati: dentro documenti, hard disk e le pagine del Libro Nero, la rubrica di chi deve un favore a J.E. Intercetta il carico prima che salpi.',
    build: buildHarbor, map: { x: 0.22, y: 0.55 }, territory: 'hongkong',
  },
  {
    id: 'burning', name: 'La giungla in fiamme',
    briefing: "Il carico rivela un compound nella giungla dove gli uomini di J.E. stanno bruciando le prove. Che la giungla la conosce, Giorgia dice che il fuoco ormai lo porta lei: attraversa l'incendio e salva i file prima che sia troppo tardi.",
    build: buildBurning, map: { x: 0.36, y: 0.62 }, territory: 'vietnam',
  },
  {
    id: 'tower', name: 'Il grattacielo',
    briefing: "Tra i file salvati c'è un indirizzo a Manhattan: un grattacielo di J.E., più alto della Trump Tower (e Trump non l'ha presa bene). Nella cassaforte dell'attico c'è la lista dei clienti della sua finanziaria. Sali piano per piano ed elimina le guardie.",
    build: buildTower, map: { x: 0.48, y: 0.40 }, territory: 'usa',
  },
  {
    id: 'airstrip', name: "La pista d'atterraggio",
    briefing: "La lista porta a una pista privata a Panama, il paese dei Panama Papers. Da qui decolla il jet privato di J.E., carico di prove. Raid alla base aerea: ferma l'ultimo volo prima che decolli.",
    build: buildAirstrip, map: { x: 0.60, y: 0.52 }, territory: 'panama',
  },
  {
    id: 'temple', name: 'Il tempio sotterraneo',
    briefing: "Sotto la pista c'è un tempio sotterraneo, la copia di quello a strisce bianche e blu che J.E. ha sull'isola. Scendi nelle sue viscere: corridoi segreti, trappole esplosive, burroni senza fondo. In fondo c'è la prossima pista.",
    build: buildTemple, map: { x: 0.72, y: 0.60 }, territory: 'amazon',
  },
  {
    id: 'convoy', name: 'Il convoglio',
    briefing: "Dal tempio parte un convoglio blindato carico di prove: camion, blindati, motociclisti suicidi, artiglieria e un elicottero d'assalto. In testa marcia il Soldato Universale, il pezzo più caro del catalogo di J.E., che a terra non ci resta mai. Fermali tutti e scopri dove sono diretti.",
    build: buildConvoy, map: { x: 0.79, y: 0.30 }, territory: 'ukraine',
  },
  {
    id: 'lab', name: 'Il laboratorio',
    briefing: "Il convoglio era diretto nel Congo: con le sue \"donazioni alla scienza\" J.E. finanzia un laboratorio che alleva creature aliene, e qualcuno ha aperto le gabbie: xenomorfi, facehugger, melter acidi, zanzare giganti e due bruti corazzati girano tra le guardie in preda al panico. Attraversalo e libera i prigionieri. Se un facehugger ti salta in faccia, fletti i muscoli (F) prima che sia tardi!",
    build: buildLab, map: { x: 0.83, y: 0.48 }, territory: 'congo',
  },
  {
    id: 'inferno', name: "L'inferno",
    briefing: "Gli esperimenti del laboratorio hanno aperto un varco verso l'inferno: J.E. cercava il paradiso fiscale definitivo. Ora l'inferno si riversa fuori: non-morti che si rialzano, mook scuoiati che ti saltano sulla schiena (fletti con F per scrollarteli di dosso), stregoni che evocano portali, anime perdute, Boomer che esplodono, Bruiser infernali. E Satana che ride. Chiudi il varco prima che raggiunga l'isola.",
    build: buildInferno, map: { x: 0.92, y: 0.60 }, territory: 'hell',
  },
  {
    id: 'island', name: "L'isola di Epstein",
    briefing: "La destinazione finale: Little Saint James, l'isola del Finanziere. Attraversa la spiaggia, la giungla e il burrone fino al tempio dove J.E. ti attende. Battilo, poi inseguilo oltre la sua ultima guarnigione fino al bunker del Goliath, il suo ultimo investimento.",
    build: buildLevel1, map: { x: 0.86, y: 0.74 }, territory: 'hawaii',
  },
];
