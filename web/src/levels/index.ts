import type { LevelData } from '../engine/level';
import { buildAirstrip } from './airstrip';
import { buildBurning } from './burning';
import { buildDesert } from './desert';
import { buildHarbor } from './harbor';
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
 * The campaign "Operation: Little Saint James" — seven missions tracing the Epstein files from
 * desert intelligence intercepts through harbor raids, burning evidence, a Manhattan skyscraper,
 * a private airstrip, an underground temple, and the final assault on Epstein's island.
 */
export const MISSIONS: readonly Mission[] = [
  {
    id: 'desert', name: 'Il deserto',
    briefing: 'Un informatore ha parlato. In una base segreta nel deserto, ledgers finanziari rivelano un flusso di denaro sporco verso un misterioso beneficiario: J.E. Segui il denaro.',
    build: buildDesert, map: { x: 0.10, y: 0.38 }, territory: 'afghanistan',
  },
  {
    id: 'harbor', name: 'Il porto dei segreti',
    briefing: 'I registri portano a un porto fantasma. Container sigillati arrivano ogni notte — dentro: documenti, hard disk, prove. Intercetta il carico prima che salpi.',
    build: buildHarbor, map: { x: 0.22, y: 0.55 }, territory: 'hongkong',
  },
  {
    id: 'burning', name: 'La giungla in fiamme',
    briefing: "Gli uomini di Epstein stanno bruciando le prove in un compound nella giungla. Attraversa l'inferno e salva i file prima che sia troppo tardi.",
    build: buildBurning, map: { x: 0.36, y: 0.62 }, territory: 'vietnam',
  },
  {
    id: 'tower', name: 'Il grattacielo',
    briefing: "I file rivelano l'indirizzo segreto: un grattacielo a Manhattan. Dentro una cassaforte al piano attico c'è la lista dei clienti. Sali piano per piano, elimina le guardie.",
    build: buildTower, map: { x: 0.48, y: 0.40 }, territory: 'usa',
  },
  {
    id: 'airstrip', name: "La pista d'atterraggio",
    briefing: "La lista dei clienti cita voli privati da una pista segreta — il 'Lolita Express'. Raid alla base aerea: ferma l'ultimo volo prima che decolli con le prove.",
    build: buildAirstrip, map: { x: 0.60, y: 0.52 }, territory: 'panama',
  },
  {
    id: 'temple', name: 'Il tempio sotterraneo',
    briefing: "Sotto la pista c'è un tempio sotterraneo, sede del culto di Epstein. Scendi nelle sue viscere: corridoi segreti, stanze rituali, trappole esplosive. La verità è sepolta qui.",
    build: buildTemple, map: { x: 0.72, y: 0.60 }, territory: 'amazon',
  },
  {
    id: 'island', name: "L'isola di Epstein",
    briefing: "La destinazione finale: Little Saint James. Attraversa la spiaggia, la giungla, il tempio dove Epstein ti attende. Battilo — poi inseguilo nel bunker dove comanda il Goliath.",
    build: buildLevel1, map: { x: 0.86, y: 0.74 }, territory: 'hawaii',
  },
];
