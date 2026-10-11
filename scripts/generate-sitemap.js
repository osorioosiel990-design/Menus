const fs = require('node:fs');
const vm = require('node:vm');

const configContext = { window: {} };
vm.runInNewContext(fs.readFileSync('src/config.js', 'utf8'), configContext);
const config = configContext.window.CATALOG_CONFIG;
const [owner, repository] = (process.env.GITHUB_REPOSITORY || 'osorioosiel990-design/Menus').split('/');
const siteRoot = (process.env.PAGES_SITE_URL || `https://${owner}.github.io/${repository}/`).replace(/\/?$/, '/');
const escapeXml = (value) => String(value).replace(/[<>&'\"]/g, (character) => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
}[character]));
const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));
const escapeJsonLd = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

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
  const name = escapeHtml(restaurant.name);
  const description = escapeHtml(restaurant.description || `Consulta el catálogo digital de ${restaurant.name} en Mesa Abierta.`);
  const title = `${restaurant.name} | Menú y catálogo digital · Mesa Abierta`;
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
    <link rel="stylesheet" href="../../src/styles.css" />
    <meta property="og:site_name" content="Mesa Abierta" />
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
    <script>window.CATALOG_BASE_PATH = new URL('../../', window.location.href).pathname;</script>
  </head>
  <body>
    <div id="app" aria-live="polite">
      <div class="catalog-shell">
        <header class="topbar"><a class="wordmark" href="./"><span class="wordmark-icon">M</span><span>Mesa Abierta</span></a><span class="demo-flag is-public"><span></span>CATÁLOGO PÚBLICO</span></header>
        <main class="seo-restaurant-page"><div class="seo-restaurant-art">${cover}</div><p class="eyebrow">CATÁLOGO PÚBLICO</p><h1>${name}</h1><p>${description}</p><a class="admin-preview-link" href="./">Abrir menú digital ↗</a></main>
      </div>
    </div>
    <script defer src="src/data/demoRestaurants.js"></script>
    <script defer src="src/router.js"></script>
    <script defer src="src/config.js"></script>
    <script defer src="src/seo.js"></script>
    <script defer src="src/supabaseRest.js"></script>
    <script defer src="src/admin.js"></script>
    <script defer src="src/main.js"></script>
  </body>
</html>
`;
}

function renderDirectoryCard(restaurant) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(restaurant.slug || '')) return '';
  const name = escapeHtml(restaurant.name);
  const description = escapeHtml(restaurant.description || `Consulta el catálogo digital de ${restaurant.name} en Mesa Abierta.`);
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
      { '@type': 'WebSite', name: 'Mesa Abierta', url: siteRoot, inLanguage: 'es' },
      { '@type': 'Organization', name: 'Mesa Abierta', url: siteRoot },
      ...(entries.length ? [{
        '@type': 'ItemList',
        name: 'Restaurantes disponibles en Mesa Abierta',
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
  const html = fs.readFileSync('index.html', 'utf8');
  fs.writeFileSync('index.html', renderDirectoryHtml(html, restaurants));
}

async function main() {
  const restaurants = await activeSlugs();
  updateDirectoryHtml(restaurants);
  let prerendered = 0;
  const urls = [
    `<url><loc>${escapeXml(siteRoot)}</loc></url>`,
    ...restaurants.map((restaurant) => {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(restaurant.slug || '')) return '';
      const loc = new URL(`r/${encodeURIComponent(restaurant.slug)}/`, siteRoot).href;
      const lastmod = restaurant.updated_at && Number.isFinite(Date.parse(restaurant.updated_at))
        ? `<lastmod>${new Date(restaurant.updated_at).toISOString().slice(0, 10)}</lastmod>`
        : '';
      const pagePath = `r/${restaurant.slug}/index.html`;
      fs.mkdirSync(require('node:path').dirname(pagePath), { recursive: true });
      fs.writeFileSync(pagePath, renderRestaurantPage(restaurant, loc));
      prerendered += 1;
      return `<url><loc>${escapeXml(loc)}</loc>${lastmod}</url>`;
    }).filter(Boolean),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  ${urls.join('\n  ')}\n</urlset>\n`;
  fs.writeFileSync('sitemap.xml', xml);
  console.log(`Generated ${prerendered} restaurant page(s) and sitemap URLs.`);
}

module.exports = { renderDirectoryCard, renderDirectoryHtml, renderDirectoryItemList, renderRestaurantPage };

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}