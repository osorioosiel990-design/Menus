import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import '../styles.css';
import './theme.css';

const roots = new WeakMap();
let pageKey = 0;

function PageSurface({ markup }) {
  return (
    <div className="react-page-surface is-entered" dangerouslySetInnerHTML={{ __html: markup }} />
  );
}

window.CatalogUI = {
  renderMarkup(container, markup) {
    let root = roots.get(container);
    if (!root) {
      container.replaceChildren();
      root = createRoot(container);
      roots.set(container, root);
    }
    flushSync(() => root.render(<PageSurface key={++pageKey} markup={markup} />));
  },
};

function loadScript(source) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${window.CATALOG_BASE_PATH}${source}?v=${encodeURIComponent(window.CATALOG_ASSET_VERSION || 'local')}`;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`No se pudo cargar ${source}.`));
    document.body.append(script);
  });
}

async function startLegacyFeatures() {
  const files = [
    'src/data/demoRestaurants.js',
    'src/router.js',
    'src/config.js',
    'src/seo.js',
    'src/supabaseRest.js',
    'src/admin.js',
    'src/main.js',
  ];
  for (const file of files) await loadScript(file);
}

startLegacyFeatures().catch((error) => {
  console.error('No se pudo iniciar Menú Abierto.', error);
  window.CatalogUI.renderMarkup(
    document.querySelector('#app'),
    '<main class="message-screen"><h1>No se pudo cargar la aplicación</h1><p class="message-copy">Comprueba la conexión e inténtalo de nuevo.</p><button class="admin-secondary-button" type="button" onclick="location.reload()">Reintentar</button></main>',
  );
});
