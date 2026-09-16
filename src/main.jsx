import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { initTheme } from '@/lib/theme';

/**
 * Die Stilbögen von Retro und Halloween standen bis eben hier als feste
 * Importe — und landeten damit in der einen Stildatei, die den Seitenaufbau
 * anhält. Das waren 155 von 283 Kilobyte, die jeder Besucher herunterlud,
 * bevor er das erste Wort sehen konnte, obwohl die allermeisten nie ein
 * anderes Aussehen einschalten. Jetzt holt `lib/theme.js` sie per `import()`,
 * sobald ein Theme wirklich gilt.
 *
 * Gewartet wird nur, wo es nötig ist: `initTheme()` hält sofort, wenn das
 * gewohnte Aussehen gilt, und sonst so lange, bis der Stilbogen steht — sonst
 * blitzt bei Retro und Halloween kurz die weisse Voreinstellung auf.
 */
const mount = () => ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode>
  <App />
  // </React.StrictMode>,
)

initTheme().then(mount, mount)

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:beforeUpdate' }, '*');
  });
  import.meta.hot.on('vite:afterUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:afterUpdate' }, '*');
  });
}



