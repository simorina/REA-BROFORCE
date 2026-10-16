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
    </div>
  );
}
