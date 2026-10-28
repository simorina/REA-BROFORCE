import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerGameDataWorker } from './app/gameDataStore';
import { App } from './ui/App';
import './ui/styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('index.html is missing #root');
const start = () =>
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
// a deployed site serves the player's own game-data through its service worker; the dev server serves game-data/ itself
if (import.meta.env.PROD) void registerGameDataWorker().finally(start);
else start();
