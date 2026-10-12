const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const defaultOutput = fs.existsSync(path.join(projectRoot, 'dist/.vite/manifest.json'))
  ? path.join(projectRoot, 'dist')
  : projectRoot;
const outputRoot = path.resolve(process.env.SITE_OUTPUT_DIR || defaultOutput);
const configContext = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(projectRoot, 'src/config.js'), 'utf8'), configContext);
const config = configContext.window.CATALOG_CONFIG;
const [owner, repository] = (process.env.GITHUB_REPOSITORY || 'osorioosiel990-design/Menus').split('/');
const siteRoot = (process.env.PAGES_SITE_URL || `https://${owner}.github.io/${repository}/`).replace(/\/?$/, '/');
const assetVersion = process.env.GITHUB_SHA || process.env.ASSET_VERSION || 'local';
const escapeXml = (value) => String(value).replace(/[<>&'\"]/g, (character) => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
}[character]));
const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));
const escapeJsonLd = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

function applicationAssets() {
  const manifestPath = path.join(outputRoot, '.vite/manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const entry = manifest['src/ui/legacy-entry.jsx']
    || Object.values(manifest).find((item) => item.name === 'legacy-entry' && item.file?.endsWith('.js'));
  if (!entry?.file) throw new Error('The Vite manifest is missing the React frontend entry.');
  const styles = (entry.css || []).map((file) => `<link rel="stylesheet" href="${escapeHtml(file)}" />`).join('\n    ');
  return {
    styles,
    script: `<script type="module" crossorigin src="${escapeHtml(entry.file)}"></script>`,
  };
}

async function activeSlugs() {
  if (!config.supabaseUrl || !config.publishableKey) return [];
  const entries = [];
  const pageSize = 500;
  for (let offset = 0; offset < 500000; offset += pageSize) {
    const query = new URLSearchParams({
      select: 'name,slug,description,logo_url,cover_image_url,phone,address,updated_at',
      is_active: 'eq.true',
      order: 'slug.asc',
      limit: String(pageSize),
      offset: String(offset),
    });
    try {
      const response = await fetch(`${config.supabaseUrl.replace(/\/+$/, '')}/rest/v1/restaurants?${query}`, {
        headers: {
          apikey: config.publishableKey,
          Authorization: `Bearer ${config.publishableKey}`,
        },
      });
      if (!response.ok) {
        console.warn(`Sitemap generated with ${entries.length} restaurant row(s) (Supabase HTTP ${response.status}).`);
        return entries;
      }
      const rows = await response.json();
      if (!Array.isArray(rows) || rows.length === 0) return entries;
      entries.push(...rows);
    } catch (error) {
      console.warn(`Sitemap generated with ${entries.length} restaurant row(s) (${error.message}).`);
      return entries;
    }
  }
  return entries;
}

function renderRestaurantPage(restaurant, canonicalUrl) {
  const application = applicationAssets();
  const name = escapeHtml(restaurant.name);
  const description = escapeHtml(restaurant.description || `Consulta el catálogo digital de ${restaurant.name} en ${config.brandName}.`);
  const title = `${restaurant.name} | Menú y catálogo digital · ${config.brandName}`;
  const image = restaurant.cover_image_url || restaurant.logo_url || '';
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: restaurant.name,
    description: restaurant.description || undefined,
    url: canonicalUrl,
    menu: canonicalUrl,
    image: image || undefined,
    telephone: restaurant.phone || undefined,
    address: restaurant.address ? { '@type': 'PostalAddress', streetAddress: restaurant.address } : undefined,
  };
  const imageMetadata = image
    ? `<meta property="og:image" content="${escapeHtml(image)}" /><meta name="twitter:image" content="${escapeHtml(image)}" />`
    : '';
  const cover = image
    ? `<img class="seo-restaurant-image" src="${escapeHtml(image)}" alt="${name}" />`
    : `<span class="seo-restaurant-mark" aria-hidden="true">${escapeHtml(restaurant.name.slice(0, 1).toLocaleUpperCase('es'))}</span>`;

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="index,follow,max-image-preview:large" />
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <base href="../../" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="../../src/styles.css?v=${encodeURIComponent(assetVersion)}" />
    ${application?.styles || ''}
    <meta property="og:site_name" content="${escapeHtml(config.brandName)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    ${imageMetadata}
    <meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${description}" />
    <script id="page-structured-data" type="application/ld+json">${escapeJsonLd(structuredData)}</script>
    <title>${escapeHtml(title)}</title>
    <script>window.CATALOG_BASE_PATH = new URL('../../', window.location.href).pathname; window.CATALOG_ASSET_VERSION = '${escapeHtml(assetVersion)}';</script>
  </head>
  <body>
    <div id="app" aria-live="polite">
      <div class="catalog-shell">
        <header class="topbar"><a class="wordmark" href="./"><span class="wordmark-icon">M</span><span>${escapeHtml(config.brandName)}</span></a><nav class="site-nav" aria-label="Navegación principal"><a href="./">Inicio</a><a href="negocios/">Para negocios</a><a href="admin/">Administración</a></nav><span class="demo-flag is-public"><span></span>CATÁLOGO PÚBLICO</span></header>
        <main class="seo-restaurant-page"><div class="seo-restaurant-art">${cover}</div><p class="eyebrow">CATÁLOGO PÚBLICO</p><h1>${name}</h1><p>${description}</p><a class="admin-preview-link" href="./">Abrir menú digital ↗</a></main>
      </div>
    </div>
    ${application?.script || `<script defer src="src/data/demoRestaurants.js?v=${encodeURIComponent(assetVersion)}"></script>
    <script defer src="src/router.js?v=${encodeURIComponent(assetVersion)}"></script>
    <script defer src="src/config.js?v=${encodeURIComponent(assetVersion)}"></script>
    <script defer src="src/seo.js?v=${encodeURIComponent(assetVersion)}"></script>
    <script defer src="src/supabaseRest.js?v=${encodeURIComponent(assetVersion)}"></script>
    <script defer src="src/admin.js?v=${encodeURIComponent(assetVersion)}"></script>
    <script defer src="src/main.js?v=${encodeURIComponent(assetVersion)}"></script>`}
  </body>
</html>
`;
}

function renderDirectoryCard(restaurant) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(restaurant.slug || '')) return '';
  const name = escapeHtml(restaurant.name);
  const description = escapeHtml(restaurant.description || `Consulta el catálogo digital de ${restaurant.name} en ${config.brandName}.`);
  const image = restaurant.cover_image_url || restaurant.logo_url || '';
  const media = image
    ? `<span class="directory-row-image"><img src="${escapeHtml(image)}" alt="" loading="lazy" decoding="async" /></span>`
    : `<span class="directory-row-image"><span class="directory-monogram">${escapeHtml(restaurant.name.slice(0, 1).toLocaleUpperCase('es'))}</span></span>`;
  return `<article class="directory-row"><a class="directory-row-link" href="./r/${encodeURIComponent(restaurant.slug)}/" aria-label="Abrir catálogo de ${name}">${media}<span class="directory-row-copy"><span class="directory-row-name">${name}</span><span class="directory-row-description">${description}</span></span><span class="directory-row-tag">CATÁLOGO DISPONIBLE</span><span class="directory-row-arrow" aria-hidden="true">↗</span></a></article>`;
}

function renderDirectoryItemList(restaurants) {
  const entries = restaurants.filter((restaurant) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(restaurant.slug || ''));
  return `<script id="page-structured-data" type="application/ld+json">${escapeJsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', name: config.brandName, url: siteRoot, inLanguage: 'es' },
      { '@type': 'Organization', name: config.brandName, url: siteRoot },
      ...(entries.length ? [{
        '@type': 'ItemList',
        name: `Restaurantes disponibles en ${config.brandName}`,
        itemListElement: entries.map((restaurant, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: new URL(`r/${encodeURIComponent(restaurant.slug)}/`, siteRoot).href,
          name: restaurant.name,
        })),
      }] : []),
    ],
  })}</script>`;
}

function renderBusinessPage(canonicalUrl) {
  const application = applicationAssets();
  const formatter = new Intl.NumberFormat('es-ES', { useGrouping: 'always' });
  const plans = config.businessPlans.map((plan) => {
    const regularPrice = config.businessMonthlyPrice * plan.months;
    const savings = regularPrice - plan.totalPrice;
    return {
      ...plan,
      savings,
      discountPercent: Math.round((savings / regularPrice) * 100),
      monthlyEquivalent: Math.round(plan.totalPrice / plan.months),
    };
  });
  const message = `Hola, quiero información sobre el servicio de menús digitales de ${config.brandName}.`;
  const contactUrl = `https://wa.me/${encodeURIComponent(config.businessWhatsApp)}?text=${encodeURIComponent(message)}`;
  const description = 'Publica el menú de tu negocio en un catálogo digital fácil de consultar, actualizar y compartir.';
  const structuredData = escapeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `Menús digitales para negocios | ${config.brandName}`,
    description,
    provider: { '@type': 'Organization', name: config.brandName },
    offers: plans.map((plan) => ({
      '@type': 'Offer',
      price: String(plan.totalPrice),
      priceCurrency: config.businessCurrency,
      description: `Plan ${plan.label} por ${plan.months} ${plan.months === 1 ? 'mes' : 'meses'}`,
    })),
  });
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="index,follow,max-image-preview:large" />
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <base href="../" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="src/styles.css?v=${encodeURIComponent(assetVersion)}" />
    ${application?.styles || ''}
    <meta property="og:site_name" content="${escapeHtml(config.brandName)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Menú digital para negocios | ${escapeHtml(config.brandName)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta name="twitter:card" content="summary" />
    <script id="page-structured-data" type="application/ld+json">${structuredData}</script>
    <title>Menú digital para negocios | ${escapeHtml(config.brandName)}</title>
    <script>window.CATALOG_BASE_PATH = new URL('../', window.location.href).pathname; window.CATALOG_ASSET_VERSION = '${escapeHtml(assetVersion)}';</script>
  </head>
  <body>
    <div id="app" aria-live="polite">
      <div class="business-shell">
        <header class="directory-topbar"><a class="directory-brand" href="./"><span class="brand-symbol">M</span><span>${escapeHtml(config.brandName)}</span></a><nav class="site-nav" aria-label="Navegación principal"><a href="./">Inicio</a><a href="negocios/" aria-current="page">Para negocios</a><a href="admin/">Administración</a></nav></header>
        <main>
          <section class="business-hero"><p class="eyebrow">SERVICIO PARA NEGOCIOS</p><h1>Tu menú digital, listo para compartir<span>.</span></h1><p>${escapeHtml(description)} Tus clientes lo abren desde un enlace, sin descargar una aplicación.</p><a class="business-whatsapp" href="${contactUrl}" target="_blank" rel="noopener noreferrer">Contactar por WhatsApp</a></section>
          <section class="business-includes"><div class="business-section-heading"><p class="eyebrow">LO ESENCIAL, EN UN SOLO ENLACE</p><h2>Tu negocio, presentado con claridad.</h2></div><div class="business-feature-list"><article><span>01</span><h3>Catálogo propio</h3><p>Productos y categorías organizados para que tus clientes encuentren lo que buscan.</p></article><article><span>02</span><h3>Actualizaciones sencillas</h3><p>Administra nombres, precios, disponibilidad e imágenes desde tu panel.</p></article><article><span>03</span><h3>Un enlace para compartir</h3><p>Tu catálogo público se puede abrir desde redes sociales, mensajes o un código QR.</p></article></div></section>
          <section class="business-pricing"><div class="business-section-heading"><p class="eyebrow">PLAN BÁSICO</p><h2>Todo lo necesario para publicar tu menú.</h2><p>Catálogo de productos, categorías, imágenes, precios y disponibilidad en un enlace para compartir.</p></div><p class="business-plan-note">Incluye soporte durante las 24 horas. El pago trimestral ofrece el mejor equilibrio para comenzar.</p><div class="business-plan-grid">${plans.map((plan) => `<article class="business-plan${plan.months === 3 ? ' is-recommended' : ''}">${plan.months === 3 ? '<p class="business-plan-badge">RECOMENDADO</p>' : ''}<h3>${plan.label}</h3><p class="business-plan-total"><strong>${formatter.format(plan.totalPrice)}</strong><span>${config.businessCurrency} · ${plan.months === 1 ? 'cada mes' : `cada ${plan.months} meses`}</span></p><p class="business-plan-monthly">Equivale a ${formatter.format(plan.monthlyEquivalent)} ${config.businessCurrency}/mes</p>${plan.discountPercent ? `<p class="business-plan-savings">Ahorras ${formatter.format(plan.savings)} ${config.businessCurrency} (${plan.discountPercent}%)</p>` : '<p class="business-plan-savings">Sin compromiso trimestral</p>'}</article>`).join('')}</div><div class="business-payment"><img src="../transfermovil.svg" alt="Ilustración de pago por Transfermóvil" width="160" height="112" /><div><p class="eyebrow">FORMA DE PAGO</p><h3>Pago por Transfermóvil</h3><p>El pago del plan se realiza mediante transferencia por Transfermóvil.</p></div></div><a class="business-whatsapp business-whatsapp-dark" href="${contactUrl}" target="_blank" rel="noopener noreferrer">Hablar sobre mi negocio</a></section>
        </main>
        <footer class="directory-footer"><span class="footer-mark">${escapeHtml(config.brandName.toLocaleUpperCase('es'))}</span><a href="./">Volver al inicio</a></footer>
      </div>
    </div>
    ${application?.script || `<script defer src="src/data/demoRestaurants.js?v=${encodeURIComponent(assetVersion)}"></script>
    <script defer src="src/router.js?v=${encodeURIComponent(assetVersion)}"></script>
    <script defer src="src/config.js?v=${encodeURIComponent(assetVersion)}"></script>
    <script defer src="src/seo.js?v=${encodeURIComponent(assetVersion)}"></script>
    <script defer src="src/supabaseRest.js?v=${encodeURIComponent(assetVersion)}"></script>
    <script defer src="src/admin.js?v=${encodeURIComponent(assetVersion)}"></script>
    <script defer src="src/main.js?v=${encodeURIComponent(assetVersion)}"></script>`}
  </body>
</html>
`;
}

function renderDirectoryHtml(html, restaurants) {
  const startMarker = '<!-- DIRECTORY_CARDS_START -->';
  const endMarker = '<!-- DIRECTORY_CARDS_END -->';
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);
  if (start < 0 || end < start) throw new Error('Homepage directory markers are missing or out of order.');
  const cards = restaurants.map(renderDirectoryCard).filter(Boolean).join('\n          ');
  const updated = cards
    ? html.slice(0, start + startMarker.length) + '\n          ' + cards + '\n          ' + html.slice(end)
    : html;
  return updated.replace('<!-- DIRECTORY_JSON_LD -->', renderDirectoryItemList(restaurants));
}

function updateDirectoryHtml(restaurants) {
  const indexPath = path.join(outputRoot, 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');
  fs.writeFileSync(indexPath, renderDirectoryHtml(html, restaurants).replaceAll('__ASSET_VERSION__', assetVersion));
  const adminIndexPath = path.join(outputRoot, 'admin/index.html');
  if (fs.existsSync(adminIndexPath)) {
    fs.writeFileSync(adminIndexPath, fs.readFileSync(adminIndexPath, 'utf8').replaceAll('__ASSET_VERSION__', assetVersion));
  }
}

async function main() {
  const restaurants = await activeSlugs();
  updateDirectoryHtml(restaurants);
  const businessUrl = new URL('negocios/', siteRoot).href;
  const businessDirectory = path.join(outputRoot, 'negocios');
  fs.mkdirSync(businessDirectory, { recursive: true });
  fs.writeFileSync(path.join(businessDirectory, 'index.html'), renderBusinessPage(businessUrl));
  let prerendered = 0;
  const urls = [
    `<url><loc>${escapeXml(siteRoot)}</loc></url>`,
    `<url><loc>${escapeXml(businessUrl)}</loc></url>`,
    ...restaurants.map((restaurant) => {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(restaurant.slug || '')) return '';
      const loc = new URL(`r/${encodeURIComponent(restaurant.slug)}/`, siteRoot).href;
      const lastmod = restaurant.updated_at && Number.isFinite(Date.parse(restaurant.updated_at))
        ? `<lastmod>${new Date(restaurant.updated_at).toISOString().slice(0, 10)}</lastmod>`
        : '';
      const pagePath = path.join(outputRoot, 'r', restaurant.slug, 'index.html');
      fs.mkdirSync(path.dirname(pagePath), { recursive: true });
      fs.writeFileSync(pagePath, renderRestaurantPage(restaurant, loc));
      prerendered += 1;
      return `<url><loc>${escapeXml(loc)}</loc>${lastmod}</url>`;
    }).filter(Boolean),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  ${urls.join('\n  ')}\n</urlset>\n`;
  fs.writeFileSync(path.join(outputRoot, 'sitemap.xml'), xml);
  console.log(`Generated ${prerendered} restaurant page(s) and sitemap URLs.`);
}

module.exports = { renderBusinessPage, renderDirectoryCard, renderDirectoryHtml, renderDirectoryItemList, renderRestaurantPage };

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}