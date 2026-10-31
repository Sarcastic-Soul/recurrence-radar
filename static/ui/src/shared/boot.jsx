import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { enableTheme, inForge } from './api.js';
import { MockFlags } from './components.jsx';
import './styles.css';

export async function boot(App) {
  await enableTheme();
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
      {!inForge && <MockFlags />}
    </StrictMode>,
  );
}
