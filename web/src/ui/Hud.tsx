import { useSyncExternalStore } from 'react';
import type { HudStore } from '../app/hudStore';

export function Hud({ store }: { store: HudStore }) {
  const hud = useSyncExternalStore(store.subscribe, store.get);
  return (
    <div className="hud">
      <div className="portrait" style={{ backgroundImage: `url(${hud.portrait})` }} />
      <div className="lives">Vite × {hud.lives}</div>
      <div className="ammo" aria-label={`Special: ${hud.ammo}`}>
        {Array.from({ length: hud.ammo }, (_, i) => (
          <span key={i} className="pip" />
        ))}
      </div>
      {hud.boss !== null && (
        <div className="boss" aria-label={`Jeffrey Epstein: ${Math.round(hud.boss * 100)}%`}>
          <span className="boss-name">JEFFREY EPSTEIN</span>
          <span className="boss-bar"><span style={{ width: `${hud.boss * 100}%` }} /></span>
        </div>
      )}
      {hud.fuel !== null && (
        <div className="fuel" aria-label={`Carburante: ${Math.round(hud.fuel * 100)}%`}>
          <span style={{ width: `${hud.fuel * 100}%` }} />
        </div>
      )}
    </div>
  );
}
