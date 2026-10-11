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
  setTitle(title);
  app.innerHTML = `
    <main class="message-screen">
      <div class="message-mark">${icon('utensils')}</div>
      <p class="eyebrow">${escapeHtml(code)}</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="message-copy">${escapeHtml(description)}</p>
      <a class="text-link" href="${window.CatalogRouter.path('/r/mesa-limon/')}">Ver catálogo de demostración ${icon('arrow-up-right')}</a>
    </main>`;
}

function renderCatalog(restaurant) {
  const { name, label, description, location, hours, currency, theme, cover, categories, products } = restaurant;
  const categoryButtons = [
    `<button class="category-button is-active" type="button" data-category="all" aria-pressed="true">Todo <span>${products.length}</span></button>`,
    ...categories.map((category) => `<button class="category-button" type="button" data-category="${escapeHtml(category.id)}" aria-pressed="false">${escapeHtml(category.name)} <span>${products.filter((item) => item.category === category.id).length}</span></button>`),
  ].join('');

  setTitle(`${name} · Catálogo digital`);
  document.documentElement.style.setProperty('--accent', theme.accent);
  document.documentElement.style.setProperty('--ink', theme.ink);
  document.documentElement.style.setProperty('--paper', theme.paper);

  app.innerHTML = `
    <div class="catalog-shell">
      <header class="topbar">
        <a class="wordmark" href="${window.CatalogRouter.path(`/r/${encodeURIComponent(restaurant.slug)}/`)}" aria-label="${escapeHtml(name)}, inicio">
          <span class="wordmark-icon">${icon('utensils')}</span>
          <span>${escapeHtml(name)}</span>
        </a>
        <span class="demo-flag"><span></span>${escapeHtml(label)}</span>
      </header>

      <section class="restaurant-hero" style="--cover-image: url('${escapeHtml(cover)}')" aria-labelledby="restaurant-title">
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
        <span class="footer-mark">${icon('utensils')} CATÁLOGO DIGITAL</span>
        <span>Contenido de demostración para desarrollo</span>
      </footer>
    </div>`;

  attachCatalogInteractions(products);
}

function renderProduct(product, currency, index) {
  return `
    <article class="product-card" data-category="${escapeHtml(product.category)}" data-search="${escapeHtml(`${product.name} ${product.description}`.toLocaleLowerCase('es'))}" style="--card-index:${index}">
      <div class="product-image-wrap">
        <img class="product-image" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async" />
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
  if (route.name === 'admin') {
    window.CatalogAdmin.render(app);
    return;
  }
  if (route.name === 'not-found') {
    renderUnavailable('Esta página no está disponible', 'Revisa la dirección e inténtalo de nuevo.', 'ERROR 404');
    return;
  }

  renderLoading(route.slug);
  window.setTimeout(() => {
    const restaurant = demoRestaurants[route.slug];
    if (!restaurant) {
      renderUnavailable('No encontramos este restaurante', 'Comprueba que el enlace sea correcto.', 'ERROR 404');
      return;
    }
    if (restaurant.isActive === false) {
      renderUnavailable('Este catálogo está temporalmente cerrado', 'El restaurante no tiene un catálogo público activo en este momento.', 'NO DISPONIBLE');
      return;
    }
    restaurant.slug = route.slug;
    renderCatalog(restaurant);
  }, 220);
}

window.addEventListener('popstate', render);
render();