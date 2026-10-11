const app = document.querySelector('#app');
const demoRestaurants = window.DEMO_RESTAURANTS;
const resolveRoute = window.CatalogRouter.resolveRoute;

const iconPaths = {
  utensils: '<path d="M3 2v7a3 3 0 0 0 6 0V2M6 2v20M18 22V2a5 5 0 0 0-5 5v4a3 3 0 0 0 3 3h2"/>',
  'map-pin': '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  'clock-3': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
  'arrow-up-right': '<path d="M7 17 17 7M7 7h10v10"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4 4"/>',
};

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

function icon(name, className = '') {
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || ''}</svg>`;
}

function formatPrice(price, currency) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 0 }).format(price);
}

function setTitle(title) {
  document.title = title;
}

function pagePath(path) {
  return window.CatalogRouter.path(path);
}

function updateSeo({ title, description, path, image, robots, data }) {
  window.CatalogSeo.update({ title, description, path, image, robots, data });
}

function renderLoading(slug) {
  setTitle('Cargando catálogo');
  app.innerHTML = `
    <main class="loading-screen" aria-label="Cargando catálogo">
      <span class="loading-mark">${icon('utensils')}</span>
      <span>Abriendo el menú<span class="loading-dots">...</span></span>
      <span class="sr-only">${escapeHtml(slug)}</span>
    </main>`;
}

function renderUnavailable(title, description, code = 'CATÁLOGO') {
  updateSeo({
    title: `${title} | Mesa Abierta`,
    description,
    path: window.location.pathname,
    robots: 'noindex,follow',
  });
  app.innerHTML = `
    <main class="message-screen">
      <div class="message-mark">${icon('utensils')}</div>
      <p class="eyebrow">${escapeHtml(code)}</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="message-copy">${escapeHtml(description)}</p>
      <a class="text-link" href="${pagePath('/')}">Explorar restaurantes ${icon('arrow-up-right')}</a>
    </main>`;
}

function demoDirectoryEntries() {
  return Object.entries(demoRestaurants)
    .filter(([, restaurant]) => restaurant.isActive !== false)
    .map(([slug, restaurant]) => ({
      id: slug,
      slug,
      name: restaurant.name,
      description: restaurant.description,
      logo_url: null,
      cover_image_url: restaurant.cover,
      isDemo: true,
    }));
}

async function fetchAllPublicRows(table, filters) {
  const entries = [];
  const pageSize = 500;
  for (let offset = 0; offset < 500000; offset += pageSize) {
    const query = new URLSearchParams({ ...filters, limit: String(pageSize), offset: String(offset) });
    const page = await window.CatalogSupabase.rest(`${table}?${query}`);
    if (!Array.isArray(page)) throw new Error(`Respuesta inesperada al consultar ${table}.`);
    if (page.length === 0) break;
    entries.push(...page);
  }
  return entries;
}

async function loadDirectoryEntries() {
  if (window.CatalogSupabase.getConfigurationError()) {
    return { entries: demoDirectoryEntries(), isDemo: true, error: 'La conexión pública aún no está configurada.' };
  }
  try {
    const entries = await fetchAllPublicRows('restaurants', {
      select: 'id,name,slug,description,logo_url,cover_image_url,address,updated_at',
      is_active: 'eq.true',
      order: 'name.asc,slug.asc',
    });
    return { entries: entries.map((entry) => ({ ...entry, isDemo: false })), isDemo: false, error: '' };
  } catch (error) {
    return { entries: demoDirectoryEntries(), isDemo: true, error: error.message };
  }
}

function directoryStructuredData(entries, directoryUrl) {
  const businesses = entries.filter((entry) => !entry.isDemo);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', name: 'Mesa Abierta', url: directoryUrl, inLanguage: 'es' },
      { '@type': 'Organization', name: 'Mesa Abierta', url: directoryUrl },
      ...(businesses.length ? [{
        '@type': 'ItemList',
        name: 'Restaurantes disponibles en Mesa Abierta',
        itemListElement: businesses.map((entry, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: new URL(pagePath(`/r/${encodeURIComponent(entry.slug)}/`), window.location.origin).href,
          name: entry.name,
        })),
      }] : []),
    ],
  };
}

function renderDirectoryCard(entry) {
  const image = entry.cover_image_url || entry.logo_url;
  return `
    <article class="directory-row">
      <a class="directory-row-link" href="${pagePath(`/r/${encodeURIComponent(entry.slug)}/`)}" aria-label="Abrir catálogo de ${escapeHtml(entry.name)}">
        <span class="directory-row-image" data-initial="${escapeHtml(entry.name.slice(0, 1).toLocaleUpperCase('es'))}">${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy" decoding="async" />` : `<span class="directory-monogram">${escapeHtml(entry.name.slice(0, 1).toLocaleUpperCase('es'))}</span>`}</span>
        <span class="directory-row-copy">
          <span class="directory-row-name">${escapeHtml(entry.name)}</span>
          <span class="directory-row-description">${escapeHtml(entry.description || 'Consulta el catálogo y la información del restaurante.')}</span>
        </span>
        <span class="directory-row-tag${entry.isDemo ? ' is-demo' : ''}">${entry.isDemo ? 'DEMOSTRACIÓN' : 'CATÁLOGO DISPONIBLE'}</span>
        <span class="directory-row-arrow" aria-hidden="true">↗</span>
      </a>
    </article>`;
}

function renderDirectory({ entries, isDemo, error }) {
  const directoryUrl = new URL(pagePath('/'), window.location.origin).href;
  updateSeo({
    title: 'Mesa Abierta | Restaurantes y catálogos digitales',
    description: 'Encuentra restaurantes disponibles, descubre sus propuestas y consulta cada catálogo digital en Mesa Abierta.',
    path: pagePath('/'),
    data: directoryStructuredData(entries, directoryUrl),
  });

  const state = isDemo
    ? `<p class="directory-status is-demo" role="status">Directorio de demostración. La lista real aparecerá cuando la base de datos esté disponible.${error ? `<details><summary>Estado de conexión</summary><span>${escapeHtml(error)}</span></details>` : ''}</p>`
    : entries.length === 0
      ? '<p class="directory-status" role="status">Todavía no hay restaurantes con catálogo público activo.</p>'
      : `<p class="directory-status" role="status"><strong id="directory-count">${entries.length}</strong> ${entries.length === 1 ? 'restaurante disponible' : 'restaurantes disponibles'}</p>`;

  app.innerHTML = `
    <div class="directory-shell">
      <header class="directory-topbar">
        <a class="directory-brand" href="${pagePath('/')}" aria-label="Mesa Abierta, inicio"><span class="brand-symbol">M</span><span>Mesa Abierta</span></a>
        <span class="directory-top-note">RESTAURANTES INDEPENDIENTES</span>
      </header>
      <main>
        <section class="directory-hero" aria-labelledby="directory-title">
          <p class="eyebrow">UN BUEN LUGAR PARA EMPEZAR</p>
          <h1 id="directory-title">Encuentra tu próxima mesa<span>.</span></h1>
          <p>Explora restaurantes, descubre sus propuestas y abre sus catálogos digitales.</p>
          <label class="directory-search">${icon('search')}<span class="sr-only">Buscar restaurante</span><input id="directory-search" type="search" placeholder="Buscar restaurante" autocomplete="off" /><kbd>/</kbd></label>
        </section>
        <section class="directory-results" aria-labelledby="directory-list-title">
          <div class="directory-results-heading"><h2 id="directory-list-title">Restaurantes</h2>${state}</div>
          <div id="directory-list" class="directory-list" aria-live="polite">${entries.map(renderDirectoryCard).join('')}</div>
          <div id="directory-empty" class="directory-empty" hidden><h3>No encontramos restaurantes</h3><p>Prueba otra búsqueda.</p></div>
        </section>
      </main>
      <footer class="directory-footer"><span class="footer-mark">MESA ABIERTA</span><span>Catálogos digitales para descubrir y compartir</span></footer>
    </div>`;

  const search = app.querySelector('#directory-search');
  const cards = [...app.querySelectorAll('.directory-row')];
  const empty = app.querySelector('#directory-empty');
  const count = app.querySelector('#directory-count');
  for (const image of app.querySelectorAll('.directory-row-image img')) {
    image.addEventListener('error', () => {
      const wrapper = image.parentElement;
      image.remove();
      wrapper.classList.add('is-placeholder');
      wrapper.textContent = wrapper.dataset.initial || 'M';
    }, { once: true });
  }
  search.addEventListener('input', () => {
    const term = search.value.trim().toLocaleLowerCase('es');
    let visible = 0;
    for (const card of cards) {
      const show = card.textContent.toLocaleLowerCase('es').includes(term);
      card.hidden = !show;
      if (show) visible += 1;
    }
    if (count) count.textContent = String(visible);
    empty.hidden = visible !== 0 || entries.length === 0;
  });
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      search.value = '';
      search.dispatchEvent(new Event('input'));
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && document.activeElement !== search && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      event.preventDefault();
      search.focus();
    }
  }, { once: true });
}

async function renderDirectoryRoute() {
  setTitle('Mesa Abierta | Restaurantes y catálogos digitales');
  updateSeo({
    title: 'Mesa Abierta | Restaurantes y catálogos digitales',
    description: 'Encuentra restaurantes disponibles, descubre sus propuestas y consulta cada catálogo digital en Mesa Abierta.',
    path: pagePath('/'),
    data: directoryStructuredData([], new URL(pagePath('/'), window.location.origin).href),
  });
  app.innerHTML = `<main class="directory-loading"><span class="admin-spinner"></span><p>Buscando restaurantes disponibles…</p></main>`;
  const result = await loadDirectoryEntries();
  renderDirectory(result);
}

function publicStorageUrl(path) {
  if (!path) return '';
  const base = window.CATALOG_CONFIG.supabaseUrl.replace(/\/+$/, '');
  const encodedPath = String(path).split('/').map(encodeURIComponent).join('/');
  return `${base}/storage/v1/object/public/restaurant-catalog/${encodedPath}`;
}

function openingHoursLabel(openingHours) {
  if (typeof openingHours === 'string' && openingHours.trim()) return openingHours;
  if (openingHours && typeof openingHours === 'object' && Object.keys(openingHours).length) return 'Consulta el horario del día';
  return 'Horario no especificado';
}

async function loadRestaurantFromSupabase(slug) {
  if (window.CatalogSupabase.getConfigurationError()) return null;
  const restaurantQuery = new URLSearchParams({
    select: 'id,name,slug,description,logo_url,cover_image_url,phone,whatsapp,address,opening_hours,currency,theme_settings,is_active',
    slug: `eq.${slug}`,
    is_active: 'eq.true',
    limit: '1',
  });
  const restaurants = await window.CatalogSupabase.rest(`restaurants?${restaurantQuery}`);
  const restaurant = restaurants[0];
  if (!restaurant) return null;

  const categoriesQuery = new URLSearchParams({
    select: 'id,name,description,display_order',
    restaurant_id: `eq.${restaurant.id}`,
    is_active: 'eq.true',
    order: 'display_order.asc',
  });
  const productsQuery = new URLSearchParams({
    select: 'id,category_id,name,description,price,image_path,is_available,is_featured,display_order',
    restaurant_id: `eq.${restaurant.id}`,
    order: 'display_order.asc',
  });
  const [categories, products] = await Promise.all([
    window.CatalogSupabase.rest(`categories?${categoriesQuery}`),
    window.CatalogSupabase.rest(`products?${productsQuery}`),
  ]);

  return {
    ...restaurant,
    label: 'CATÁLOGO PÚBLICO',
    location: restaurant.address || 'Dirección no especificada',
    hours: openingHoursLabel(restaurant.opening_hours),
    theme: restaurant.theme_settings || { accent: '#bc4f34', ink: '#273c32', paper: '#f4f2eb' },
    cover: restaurant.cover_image_url || '',
    categories: categories.map((category) => ({ ...category, id: category.id })),
    products: products.map((product) => ({
      ...product,
      category: product.category_id,
      available: product.is_available,
      featured: product.is_featured,
      image: publicStorageUrl(product.image_path),
    })),
    isDemo: false,
  };
}

function restaurantStructuredData(restaurant, canonicalUrl) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: restaurant.name,
    url: canonicalUrl,
    menu: canonicalUrl,
  };
  if (restaurant.description) data.description = restaurant.description;
  if (restaurant.cover || restaurant.logo_url) data.image = [restaurant.cover, restaurant.logo_url].filter(Boolean);
  if (restaurant.phone) data.telephone = restaurant.phone;
  if (restaurant.address) data.address = { '@type': 'PostalAddress', streetAddress: restaurant.address };
  return data;
}

function renderCatalog(restaurant) {
  const { name, label, description, location, hours, currency, theme, cover, categories, products } = restaurant;
  const canonicalPath = pagePath(`/r/${encodeURIComponent(restaurant.slug)}/`);
  const canonicalUrl = new URL(canonicalPath, window.location.origin).href;
  const seoDescription = description || `Consulta el catálogo digital de ${name} en Mesa Abierta.`;
  updateSeo({
    title: `${name} | Menú y catálogo digital · Mesa Abierta`,
    description: seoDescription,
    path: canonicalPath,
    image: cover || restaurant.logo_url || undefined,
    robots: 'index,follow,max-image-preview:large',
    data: restaurant.isDemo ? undefined : restaurantStructuredData(restaurant, canonicalUrl),
  });
  const categoryButtons = [
    `<button class="category-button is-active" type="button" data-category="all" aria-pressed="true">Todo <span>${products.length}</span></button>`,
    ...categories.map((category) => `<button class="category-button" type="button" data-category="${escapeHtml(category.id)}" aria-pressed="false">${escapeHtml(category.name)} <span>${products.filter((item) => item.category === category.id).length}</span></button>`),
  ].join('');

  document.documentElement.style.setProperty('--accent', theme.accent);
  document.documentElement.style.setProperty('--ink', theme.ink);
  document.documentElement.style.setProperty('--paper', theme.paper);

  app.innerHTML = `
    <div class="catalog-shell">
      <header class="topbar">
        <a class="wordmark" href="${pagePath(`/r/${encodeURIComponent(restaurant.slug)}/`)}" aria-label="${escapeHtml(name)}, inicio">
          <span class="wordmark-icon">${icon('utensils')}</span>
          <span>${escapeHtml(name)}</span>
        </a>
        <span class="demo-flag${restaurant.isDemo ? '' : ' is-public'}"><span></span>${escapeHtml(restaurant.isDemo ? label : 'CATÁLOGO PÚBLICO')}</span>
      </header>

      <section class="restaurant-hero"${cover ? ` style="--cover-image: url('${escapeHtml(cover)}')"` : ''} aria-labelledby="restaurant-title">
        <div class="hero-shade"></div>
        <div class="hero-content">
          <p class="eyebrow hero-eyebrow">${escapeHtml(label)}</p>
          <h1 id="restaurant-title">${escapeHtml(name)}<span>.</span></h1>
          <p class="hero-description">${escapeHtml(description)}</p>
          <div class="hero-details">
            <span>${icon('map-pin')} ${escapeHtml(location)}</span>
            <span>${icon('clock-3')} ${escapeHtml(hours)}</span>
          </div>
        </div>
        <div class="hero-index">01 <span>/</span> 01</div>
      </section>

      <main class="menu-area">
        <div class="menu-heading">
          <div>
            <p class="eyebrow">HECHO PARA DISFRUTAR</p>
            <h2>El menú<span>.</span></h2>
          </div>
          <p class="menu-count"><span id="visible-count">${products.length}</span> propuestas</p>
        </div>

        <div class="catalog-controls">
          <div class="category-list" role="group" aria-label="Filtrar por categoría">${categoryButtons}</div>
          <label class="search-field">
            ${icon('search')}
            <span class="sr-only">Buscar en el menú</span>
            <input id="catalog-search" type="search" placeholder="Buscar en el menú" autocomplete="off" />
            <kbd>/</kbd>
          </label>
        </div>

        <div id="product-grid" class="product-grid" aria-live="polite">
          ${products.map((product, index) => renderProduct(product, currency, index)).join('')}
        </div>
        <div id="empty-state" class="empty-state" hidden>
          <span class="empty-icon">${icon('search')}</span>
          <h3>No encontramos coincidencias</h3>
          <p>Prueba otra búsqueda o elige una categoría diferente.</p>
          <button id="clear-search" class="clear-button" type="button">Limpiar filtros</button>
        </div>
        <noscript><p class="empty-state">Activa JavaScript para consultar este catálogo.</p></noscript>
      </main>

      <footer class="catalog-footer">
        <span class="footer-mark">${icon('utensils')} MESA ABIERTA</span>
        <span>${restaurant.isDemo ? 'Contenido de demostración para desarrollo' : 'Catálogo digital público'}</span>
      </footer>
    </div>`;

  attachCatalogInteractions(products);
}

function renderProduct(product, currency, index) {
  return `
    <article class="product-card" data-category="${escapeHtml(product.category)}" data-search="${escapeHtml(`${product.name} ${product.description}`.toLocaleLowerCase('es'))}" style="--card-index:${index}">
      <div class="product-image-wrap">
        ${product.image ? `<img class="product-image" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async" />` : '<span class="product-image-placeholder" role="img" aria-label="Fotografía no disponible">M</span>'}
        ${product.featured ? '<span class="featured-label">Favorito</span>' : ''}
        ${!product.available ? '<span class="unavailable-label">Por hoy, agotado</span>' : ''}
      </div>
      <div class="product-copy">
        <div class="product-title-row">
          <h3>${escapeHtml(product.name)}</h3>
          <span class="product-price">${formatPrice(product.price, currency)}</span>
        </div>
        <p>${escapeHtml(product.description)}</p>
        <span class="availability ${product.available ? 'is-available' : 'is-unavailable'}"><span></span>${product.available ? 'Disponible' : 'No disponible'}</span>
      </div>
    </article>`;
}

function attachCatalogInteractions(products) {
  let activeCategory = 'all';
  let searchTerm = '';
  const cards = [...document.querySelectorAll('.product-card')];
  const count = document.querySelector('#visible-count');
  const emptyState = document.querySelector('#empty-state');
  const grid = document.querySelector('#product-grid');
  const search = document.querySelector('#catalog-search');

  const update = () => {
    let visible = 0;
    for (const card of cards) {
      const matchesCategory = activeCategory === 'all' || card.dataset.category === activeCategory;
      const matchesSearch = card.dataset.search.includes(searchTerm);
      const shouldShow = matchesCategory && matchesSearch;
      card.hidden = !shouldShow;
      if (shouldShow) visible += 1;
    }
    count.textContent = String(visible);
    grid.hidden = visible === 0;
    emptyState.hidden = visible !== 0;
    const noun = visible === 1 ? 'propuesta' : 'propuestas';
    document.querySelector('.menu-count').innerHTML = `<span id="visible-count">${visible}</span> ${noun}`;
  };

  document.querySelectorAll('.category-button').forEach((button) => {
    button.addEventListener('click', () => {
      activeCategory = button.dataset.category;
      document.querySelectorAll('.category-button').forEach((item) => {
        const isActive = item === button;
        item.classList.toggle('is-active', isActive);
        item.setAttribute('aria-pressed', String(isActive));
      });
      update();
    });
  });

  search.addEventListener('input', () => {
    searchTerm = search.value.trim().toLocaleLowerCase('es');
    update();
  });
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      search.value = '';
      searchTerm = '';
      update();
    }
  });
  document.querySelector('#clear-search').addEventListener('click', () => {
    activeCategory = 'all';
    searchTerm = '';
    search.value = '';
    document.querySelector('[data-category="all"]').click();
    search.focus();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && document.activeElement !== search && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      event.preventDefault();
      search.focus();
    }
  });
  for (const image of document.querySelectorAll('.product-image')) {
    image.addEventListener('error', () => {
      image.classList.add('image-failed');
      image.removeAttribute('src');
    }, { once: true });
  }
  if (products.length === 0) update();
}

function render() {
  const route = resolveRoute(window.location.pathname);
  if (route.name === 'home') {
    renderDirectoryRoute();
    return;
  }
  if (route.name === 'admin') {
    window.CatalogAdmin.render(app);
    return;
  }
  if (route.name === 'not-found') {
    renderUnavailable('Esta página no está disponible', 'Revisa la dirección e inténtalo de nuevo.', 'ERROR 404');
    return;
  }

  renderLoading(route.slug);
  window.setTimeout(async () => {
    let restaurant = null;
    let catalogError = null;
    try {
      restaurant = await loadRestaurantFromSupabase(route.slug);
    } catch (error) {
      catalogError = error;
    }
    if (!restaurant) {
      const demo = demoRestaurants[route.slug];
      if (demo && demo.isActive === false) {
        renderUnavailable('Este catálogo está temporalmente cerrado', 'El restaurante no tiene un catálogo público activo en este momento.', 'NO DISPONIBLE');
        return;
      }
      if (demo) restaurant = { ...demo, slug: route.slug, isDemo: true };
    }
    if (!restaurant) {
      renderUnavailable('No encontramos este restaurante', catalogError ? 'Este catálogo no existe o no está publicado.' : 'Comprueba que el enlace sea correcto.', 'ERROR 404');
      return;
    }
    renderCatalog(restaurant);
  }, 100);
}

window.addEventListener('popstate', render);
window.CatalogApp = { render };
render();