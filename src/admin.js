(() => {
  const api = () => window.CatalogSupabase;
  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
  let appRoot;
  let session;
  let restaurants = [];
  let isPlatformAdmin = false;
  let selectedRestaurantId = '';
  let selectedPanel = 'profile';
  let recoverySession = null;
  let qrCodeLibraryPromise;
  let catalogState = {
    restaurantId: '',
    loaded: false,
    loading: false,
    error: '',
    categories: [],
    products: [],
  };

  function setTitle(title = 'Administración · Catálogos') {
    document.title = title;
      window.CatalogSeo.update({
        title: `${title.replace('Catálogos', window.CATALOG_CONFIG.brandName)} · Acceso privado`,
        description: 'Panel privado para administrar restaurantes y catálogos autorizados.',
        path: window.location.pathname,
        robots: 'noindex,nofollow,noarchive',
      });
  }

  function publicNavigation() {
    return `<nav class="site-nav admin-public-nav" aria-label="Navegación principal"><a href="${window.CatalogRouter.path('/')}">Inicio</a><a href="${window.CatalogRouter.path('/negocios/')}">Para negocios</a><a href="${window.CatalogRouter.path('/admin/')}" aria-current="page">Administración</a></nav>`;
  }

  function renderLoading(message = 'Conectando de forma segura') {
    setTitle();
    appRoot.innerHTML = `
      <main class="admin-loading" aria-live="polite">
        <span class="loading-mark"><span class="admin-spinner"></span></span>
        <p>${escapeHtml(message)}</p>
      </main>`;
  }

  function renderConfiguration() {
    setTitle();
    appRoot.innerHTML = `
      <main class="message-screen admin-config-screen">
        <div class="message-mark"><span class="admin-lock" aria-hidden="true"></span></div>
        <p class="eyebrow">ACCESO PRIVADO</p>
        <h1>Panel de administración</h1>
        <p class="message-copy">${escapeHtml(api().getConfigurationError())}</p>
        <div class="config-reminder">Solo configura una URL de proyecto y una clave pública. Nunca pongas aquí sb_secret ni service_role.</div>
        <a class="text-link" href="${window.CatalogRouter.path('/r/mesa-limon/')}">Volver al catálogo de demostración</a>
      </main>`;
  }

  function authLayout(content, eyebrow = 'SISTEMA MULTIRRESTAURANTE') {
    appRoot.innerHTML = `
      <main class="admin-auth-shell">
        <section class="admin-auth-intro">
          <a class="wordmark admin-wordmark" href="${window.CatalogRouter.path('/')}" >
            <span class="wordmark-icon">M</span><span>${escapeHtml(window.CATALOG_CONFIG.brandName)}</span>
          </a>
          ${publicNavigation()}
          <div class="auth-intro-copy">
            <p class="eyebrow">${eyebrow}</p>
            <h1>Tu restaurante,<br />a tu manera<span>.</span></h1>
            <p>Administra la información pública de tus catálogos desde un solo lugar.</p>
          </div>
          <span class="auth-side-note">ESPACIO DE ADMINISTRACIÓN</span>
        </section>
        <section class="admin-auth-form-area">${content}</section>
      </main>`;
  }

  function renderLogin({ notice = '', error = '' } = {}) {
    setTitle('Iniciar sesión · Administración');
    authLayout(`
      <div class="auth-form-wrap">
        <p class="eyebrow">BIENVENIDO DE VUELTA</p>
        <h2>Iniciar sesión</h2>
        <p class="auth-lead">Accede con el correo autorizado para tu restaurante.</p>
        ${notice ? `<p class="admin-alert is-success" role="status">${escapeHtml(notice)}</p>` : ''}
        ${error ? `<p class="admin-alert is-error" role="alert">${escapeHtml(error)}</p>` : ''}
        <form id="admin-login-form" class="admin-form">
          <label>Correo electrónico<input name="email" type="email" autocomplete="username" required /></label>
          <label>Contraseña<input name="password" type="password" autocomplete="current-password" required /></label>
          <button class="admin-primary-button" type="submit">Entrar al panel <span aria-hidden="true">→</span></button>
        </form>
        <button class="admin-text-button" id="show-recovery" type="button">¿Olvidaste tu contraseña?</button>
        <p class="no-signup-note">El acceso es por invitación. No hay registro público.</p>
      </div>`);

    appRoot.querySelector('#admin-login-form').addEventListener('submit', onLogin);
    appRoot.querySelector('#show-recovery').addEventListener('click', () => renderRecovery());
  }

  function renderRecovery({ error = '', notice = '' } = {}) {
    setTitle('Recuperar contraseña · Administración');
    authLayout(`
      <div class="auth-form-wrap">
        <p class="eyebrow">RECUPERAR ACCESO</p>
        <h2>Restablecer contraseña</h2>
        <p class="auth-lead">Te enviaremos un enlace si el correo pertenece a una cuenta habilitada.</p>
        ${notice ? `<p class="admin-alert is-success" role="status">${escapeHtml(notice)}</p>` : ''}
        ${error ? `<p class="admin-alert is-error" role="alert">${escapeHtml(error)}</p>` : ''}
        <form id="admin-recovery-form" class="admin-form">
          <label>Correo electrónico<input name="email" type="email" autocomplete="email" required /></label>
          <button class="admin-primary-button" type="submit">Enviar enlace <span aria-hidden="true">→</span></button>
        </form>
        <button class="admin-text-button" id="back-to-login" type="button">Volver al inicio de sesión</button>
      </div>`);
    appRoot.querySelector('#admin-recovery-form').addEventListener('submit', onRecovery);
    appRoot.querySelector('#back-to-login').addEventListener('click', () => renderLogin());
  }

  function renderPasswordReset(error = '') {
    setTitle('Nueva contraseña · Administración');
    authLayout(`
      <div class="auth-form-wrap">
        <p class="eyebrow">RECUPERACIÓN DE ACCESO</p>
        <h2>Elige una contraseña</h2>
        <p class="auth-lead">Usa al menos 8 caracteres.</p>
        ${error ? `<p class="admin-alert is-error" role="alert">${escapeHtml(error)}</p>` : ''}
        <form id="admin-password-form" class="admin-form">
          <label>Nueva contraseña<input name="password" type="password" minlength="8" autocomplete="new-password" required /></label>
          <label>Confirma la contraseña<input name="confirmation" type="password" minlength="8" autocomplete="new-password" required /></label>
          <button class="admin-primary-button" type="submit">Guardar contraseña <span aria-hidden="true">→</span></button>
        </form>
      </div>`);
    appRoot.querySelector('#admin-password-form').addEventListener('submit', onPasswordReset);
  }

  async function onLogin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const values = new FormData(form);
    button.disabled = true;
    button.textContent = 'Comprobando acceso…';
    try {
      const result = await api().signIn(String(values.get('email')).trim(), String(values.get('password')));
      api().persistSession(result);
      await startDashboard();
    } catch (error) {
      renderLogin({ error: error.message });
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  }

  async function onRecovery(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const email = String(new FormData(form).get('email')).trim();
    button.disabled = true;
    button.textContent = 'Enviando…';
    try {
      await api().recover(email);
      renderRecovery({ notice: 'Si existe una cuenta con ese correo, recibirás instrucciones para restablecer el acceso.' });
    } catch (error) {
      renderRecovery({ error: error.message });
    }
  }

  async function onPasswordReset(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const password = String(values.get('password'));
    if (password.length < 8) {
      renderPasswordReset('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== String(values.get('confirmation'))) {
      renderPasswordReset('Las contraseñas no coinciden.');
      return;
    }
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Guardando…';
    try {
      await api().updatePassword(recoverySession, password);
      api().clearSession();
      recoverySession = null;
      renderLogin({ notice: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
    } catch (error) {
      renderPasswordReset(error.message);
    }
  }

  function consumeRecoveryLink() {
    const parameters = new URLSearchParams(window.location.hash.slice(1));
    if (parameters.get('type') !== 'recovery' || !parameters.get('access_token')) return null;
    const recovered = {
      access_token: parameters.get('access_token'),
      refresh_token: parameters.get('refresh_token'),
      expires_at: Number(parameters.get('expires_at')) || Math.floor(Date.now() / 1000) + Number(parameters.get('expires_in') || 3600),
    };
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    return recovered;
  }

  async function loadMemberships(user) {
    const userId = encodeURIComponent(user.id);
    const memberships = await api().rest(`restaurant_members?select=restaurant_id,role&user_id=eq.${userId}`, { session });
    if (!memberships.length) return [];
    const ids = memberships.map((membership) => membership.restaurant_id);
    const filter = encodeURIComponent(`in.(${ids.join(',')})`);
    const records = await api().rest(`restaurants?select=id,name,slug,description,logo_url,cover_image_url,phone,whatsapp,address,opening_hours,currency,theme_settings,is_active&id=${filter}`, { session });
    return records.map((restaurant) => ({
      ...restaurant,
      role: memberships.find((membership) => membership.restaurant_id === restaurant.id)?.role || 'editor',
    }));
  }

  async function loadPlatformAdminStatus(user) {
    const filter = new URLSearchParams({
      select: 'user_id',
      user_id: `eq.${user.id}`,
      limit: '1',
    });
    try {
      const rows = await api().rest(`platform_admins?${filter}`, { session });
      return rows.length > 0;
    } catch (error) {
      if (error.message.includes('public.platform_admins') && error.message.includes('schema cache')) {
        return false;
      }
      throw error;
    }
  }

  async function loadAllRestaurants() {
    const records = [];
    const pageSize = 500;
    for (let offset = 0; offset < 500000; offset += pageSize) {
      const query = new URLSearchParams({
        select: 'id,name,slug,description,logo_url,cover_image_url,phone,whatsapp,address,opening_hours,currency,theme_settings,is_active',
        order: 'name.asc,slug.asc',
        limit: String(pageSize),
        offset: String(offset),
      });
      const page = await api().rest(`restaurants?${query}`, { session });
      if (!Array.isArray(page)) throw new Error('Supabase devolvió una lista de restaurantes no válida.');
      if (!page.length) break;
      records.push(...page);
    }
    return records.map((restaurant) => ({ ...restaurant, role: 'super_admin' }));
  }

  async function loadDashboardAccess(user) {
    isPlatformAdmin = await loadPlatformAdminStatus(user);
    return isPlatformAdmin ? loadAllRestaurants() : loadMemberships(user);
  }

  async function startDashboard() {
    renderLoading('Cargando tus restaurantes');
    try {
      session = await api().getValidSession();
      if (!session) {
        renderLogin();
        return;
      }
      restaurants = await loadDashboardAccess(session.user);
      if (!restaurants.some((restaurant) => restaurant.id === selectedRestaurantId)) {
        selectedRestaurantId = restaurants[0]?.id || '';
      }
      renderDashboard();
    } catch (error) {
      api().clearSession();
      session = null;
      renderLogin({ error: `No se pudo validar tu acceso. ${error.message}` });
    }
  }

  function selectedRestaurant() {
    return restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) || null;
  }

  function renderDashboard(message = '') {
    const restaurant = selectedRestaurant();
    setTitle('Panel · Administración');
    if (!restaurant) {
      appRoot.innerHTML = `
        <div class="admin-app-shell">
          <header class="admin-topbar"><a class="wordmark" href="${window.CatalogRouter.path('/') }" ><span class="wordmark-icon">M</span><span>${escapeHtml(window.CATALOG_CONFIG.brandName)}</span></a>${publicNavigation()}<button id="admin-signout" class="admin-signout">Cerrar sesión</button></header>
          <main class="admin-empty-access"><p class="eyebrow">${isPlatformAdmin ? 'SUPER ADMIN' : 'CUENTA AUTENTICADA'}</p><h1>${isPlatformAdmin ? 'Todavía no hay restaurantes registrados.' : 'Aún no tienes restaurantes asignados.'}</h1><p>${isPlatformAdmin ? 'Cuando se registren restaurantes, aparecerán aquí para administración global.' : 'Solicita que te asignen como miembro de un restaurante. El registro público está desactivado.'}</p></main>
        </div>`;
      appRoot.querySelector('#admin-signout').addEventListener('click', onSignOut);
      return;
    }

    const canEditProfile = ['owner', 'admin', 'super_admin'].includes(restaurant.role);
    appRoot.innerHTML = `
      <div class="admin-app-shell">
        <header class="admin-topbar">
            <a class="wordmark" href="${window.CatalogRouter.path('/')}" ><span class="wordmark-icon">M</span><span>${escapeHtml(window.CATALOG_CONFIG.brandName)}</span></a>
          <div class="admin-top-actions">
            ${publicNavigation()}
            <span class="admin-user-email">${escapeHtml(session.user.email || '')}</span>
            <a class="admin-preview-link" href="${window.CatalogRouter.path(`/r/${encodeURIComponent(restaurant.slug)}/`)}" target="_blank" rel="noreferrer">Ver catálogo ↗</a>
            <button id="admin-signout" class="admin-signout" type="button">Cerrar sesión</button>
          </div>
        </header>
        <div class="admin-layout">
          <aside class="admin-sidebar">
            <p class="eyebrow">${isPlatformAdmin ? 'ADMINISTRACIÓN GLOBAL' : 'TU NEGOCIO'}</p>
            ${restaurants.length > 1 ? `<label class="restaurant-select-label">Restaurante<select id="restaurant-select">${restaurants.map((item) => `<option value="${escapeHtml(item.id)}"${item.id === restaurant.id ? ' selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select></label>` : `<div class="sidebar-restaurant">${escapeHtml(restaurant.name)}</div>`}
            <nav class="admin-nav" aria-label="Administración">
              <button type="button" data-panel="profile" class="${selectedPanel === 'profile' ? 'is-active' : ''}">Información del negocio</button>
              <button type="button" data-panel="design" class="${selectedPanel === 'design' ? 'is-active' : ''}">Diseño del catálogo</button>
              <button type="button" data-panel="catalog" class="${selectedPanel === 'catalog' ? 'is-active' : ''}">Productos y categorías</button>
              <button type="button" data-panel="qr" class="${selectedPanel === 'qr' ? 'is-active' : ''}">Código QR</button>
            </nav>
            <div class="admin-sidebar-foot"><span class="role-dot"></span>${isPlatformAdmin ? 'SUPER ADMIN · TODA LA PLATAFORMA' : `${escapeHtml(restaurant.role)} · ${escapeHtml(restaurant.slug)}`}</div>
          </aside>
          <main class="admin-content">
            <div class="admin-content-heading">
              <div><p class="eyebrow">PANEL DEL RESTAURANTE</p><h1>${selectedPanel === 'design' ? 'Diseño del catálogo' : selectedPanel === 'catalog' ? 'Tu catálogo' : selectedPanel === 'qr' ? 'Código QR' : 'Información del negocio'}</h1></div>
              <span class="admin-active-status ${restaurant.is_active ? 'is-live' : ''}"><i></i>${restaurant.is_active ? 'Catálogo activo' : 'Catálogo inactivo'}</span>
            </div>
            ${message ? `<p class="admin-alert is-success" role="status">${escapeHtml(message)}</p>` : ''}
            ${selectedPanel === 'catalog' ? renderCatalogPanel(restaurant) : selectedPanel === 'qr' ? renderQrPanel(restaurant) : renderProfileForm(restaurant, canEditProfile)}
          </main>
        </div>
      </div>`;

    appRoot.querySelector('#admin-signout').addEventListener('click', onSignOut);
    appRoot.querySelector('#restaurant-select')?.addEventListener('change', (event) => {
      selectedRestaurantId = event.target.value;
      selectedPanel = 'profile';
      resetCatalogState();
      renderDashboard();
    });
    appRoot.querySelectorAll('[data-panel]').forEach((button) => button.addEventListener('click', () => {
      selectedPanel = button.dataset.panel;
      renderDashboard();
    }));
    appRoot.querySelector('#restaurant-profile-form')?.addEventListener('submit', onSaveProfile);
    appRoot.querySelector('#restaurant-profile-form')?.addEventListener('change', onProfileImagePick);
    bindCatalogEvents(restaurant);
    if (selectedPanel === 'qr') bindQrEvents(restaurant);
  }

  // ---------------------------------------------------------------- catálogo
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const maxImageBytes = 5 * 1024 * 1024;
  const uploadExtension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const pendingUploads = new Map();

  function resetCatalogState() {
    catalogState = { restaurantId: '', loaded: false, loading: false, error: '', categories: [], products: [] };
    pendingUploads.clear();
  }

  function canManageCatalog(restaurant) {
    return ['owner', 'admin', 'editor', 'super_admin'].includes(restaurant.role);
  }

  function formatPriceValue(price) {
    const numeric = Number(price);
    return Number.isFinite(numeric) ? numeric.toFixed(2) : '0.00';
  }

  function uniqueImageName(file) {
    const random = Math.random().toString(36).slice(2, 10);
    return `${Date.now().toString(36)}-${random}.${uploadExtension[file.type] || 'jpg'}`;
  }

  function validateImageFile(file) {
    if (!allowedImageTypes.includes(file.type)) return 'La imagen debe ser JPEG, PNG o WebP.';
    if (file.size > maxImageBytes) return 'La imagen supera el límite de 5 MiB de Storage.';
    return '';
  }

  function imagePreview(path) {
    return path ? api().publicStorageUrl(path) : '';
  }

  async function loadCatalog(restaurant) {
    if (catalogState.restaurantId === restaurant.id && catalogState.loaded) return;
    catalogState = { restaurantId: restaurant.id, loaded: false, loading: true, error: '', categories: [], products: [] };
    renderDashboard();
    try {
      const categoriesQuery = new URLSearchParams({
        select: 'id,name,description,display_order,is_active',
        restaurant_id: `eq.${restaurant.id}`,
        order: 'display_order.asc,name.asc',
      });
      const productsQuery = new URLSearchParams({
        select: 'id,category_id,name,description,price,image_path,is_available,is_featured,display_order',
        restaurant_id: `eq.${restaurant.id}`,
        order: 'display_order.asc,name.asc',
      });
      const [categories, products] = await Promise.all([
        api().rest(`categories?${categoriesQuery}`, { session }),
        api().rest(`products?${productsQuery}`, { session }),
      ]);
      catalogState = {
        restaurantId: restaurant.id,
        loaded: true,
        loading: false,
        error: '',
        categories: Array.isArray(categories) ? categories : [],
        products: Array.isArray(products) ? products : [],
      };
    } catch (error) {
      catalogState = { restaurantId: restaurant.id, loaded: false, loading: false, error: error.message, categories: [], products: [] };
    }
    renderDashboard();
  }

  function renderCategoryRow(category, index, disabled) {
    return `
      <form class="catalog-row" data-category-form="${escapeHtml(category.id)}">
        <span class="catalog-row-index">${String(index + 1).padStart(2, '0')}</span>
        <div class="catalog-row-fields">
          <label>Nombre<input name="name" maxlength="100" required value="${escapeHtml(category.name)}"${disabled} /></label>
          <label>Orden<input name="display_order" type="number" min="0" step="1" value="${escapeHtml(String(category.display_order ?? 0))}"${disabled} /></label>
          <label class="field-span">Descripción<textarea name="description" rows="2" maxlength="500"${disabled}>${escapeHtml(category.description || '')}</textarea></label>
          <label class="catalog-check"><input type="checkbox" name="is_active"${category.is_active ? ' checked' : ''}${disabled} /><span>Visible en el catálogo público</span></label>
        </div>
        <div class="catalog-row-actions">
          <p class="catalog-row-status" role="status" aria-live="polite"></p>
          <button class="admin-primary-button" type="submit"${disabled}>Guardar</button>
          <button class="catalog-delete" type="button" data-delete-category="${escapeHtml(category.id)}"${disabled}>Eliminar</button>
        </div>
      </form>`;
  }

  function renderNewCategoryForm(disabled) {
    return `
      <form class="catalog-row is-new" data-category-form="new">
        <span class="catalog-row-index">+</span>
        <div class="catalog-row-fields">
          <label>Nombre<input name="name" maxlength="100" required placeholder="Entradas, bebidas, postres…"${disabled} /></label>
          <label>Orden<input name="display_order" type="number" min="0" step="1" value="0"${disabled} /></label>
          <label class="field-span">Descripción<textarea name="description" rows="2" maxlength="500" placeholder="Opcional"${disabled}></textarea></label>
          <label class="catalog-check"><input type="checkbox" name="is_active" checked${disabled} /><span>Visible en el catálogo público</span></label>
        </div>
        <div class="catalog-row-actions">
          <p class="catalog-row-status" role="status" aria-live="polite"></p>
          <button class="admin-primary-button" type="submit"${disabled}>Crear categoría</button>
        </div>
      </form>`;
  }

  function categoryOptions(selectedId) {
    return catalogState.categories
      .map((category) => `<option value="${escapeHtml(category.id)}"${category.id === selectedId ? ' selected' : ''}>${escapeHtml(category.name)}</option>`)
      .join('');
  }

  function renderProductRow(product, index, disabled) {
    const preview = imagePreview(product.image_path);
    return `
      <form class="catalog-row is-product" data-product-form="${escapeHtml(product.id)}">
        <span class="catalog-row-index">${String(index + 1).padStart(2, '0')}</span>
        <span class="catalog-thumb${preview ? '' : ' is-empty'}">${preview ? `<img src="${escapeHtml(preview)}" alt="" loading="lazy" decoding="async" />` : 'M'}</span>
        <div class="catalog-row-fields">
          <label>Producto<input name="name" maxlength="140" required value="${escapeHtml(product.name)}"${disabled} /></label>
          <label>Precio<input name="price" type="number" min="0" step="0.01" required value="${escapeHtml(formatPriceValue(product.price))}"${disabled} /></label>
          <label>Categoría<select name="category_id" required${disabled}>${categoryOptions(product.category_id)}</select></label>
          <label>Orden<input name="display_order" type="number" min="0" step="1" value="${escapeHtml(String(product.display_order ?? 0))}"${disabled} /></label>
          <label class="field-span">Descripción<textarea name="description" rows="2" maxlength="1200"${disabled}>${escapeHtml(product.description || '')}</textarea></label>
          <label class="field-span catalog-upload">Fotografía<input name="image" type="file" accept="image/jpeg,image/png,image/webp" data-product-image="${escapeHtml(product.id)}"${disabled} /><small>JPEG, PNG o WebP hasta 5 MiB.${product.image_path ? ` · <button class="catalog-link" type="button" data-clear-image="${escapeHtml(product.id)}"${disabled}>Quitar imagen</button>` : ''}</small></label>
          <label class="catalog-check"><input type="checkbox" name="is_available"${product.is_available ? ' checked' : ''}${disabled} /><span>Disponible hoy</span></label>
          <label class="catalog-check"><input type="checkbox" name="is_featured"${product.is_featured ? ' checked' : ''}${disabled} /><span>Destacado</span></label>
        </div>
        <div class="catalog-row-actions">
          <p class="catalog-row-status" role="status" aria-live="polite"></p>
          <button class="admin-primary-button" type="submit"${disabled}>Guardar</button>
          <button class="catalog-delete" type="button" data-delete-product="${escapeHtml(product.id)}"${disabled}>Eliminar</button>
        </div>
      </form>`;
  }

  function renderCatalogPanel(restaurant) {
    const allowed = canManageCatalog(restaurant);
    const disabled = allowed ? '' : ' disabled';
    if (catalogState.restaurantId !== restaurant.id && !catalogState.loading) {
      loadCatalog(restaurant);
      return '<section class="catalog-panel"><p class="catalog-panel-status"><span class="admin-spinner"></span>Cargando categorías y productos…</p></section>';
    }
    if (catalogState.loading) {
      return '<section class="catalog-panel"><p class="catalog-panel-status"><span class="admin-spinner"></span>Cargando categorías y productos…</p></section>';
    }
    if (catalogState.error) {
      return `<section class="catalog-panel"><p class="admin-alert is-error" role="alert">${escapeHtml(catalogState.error)}</p><button class="admin-primary-button" type="button" data-reload-catalog="1">Reintentar</button></section>`;
    }

    const categories = catalogState.categories;
    const products = catalogState.products;
    return `
      <div class="catalog-panel">
        ${!allowed ? '<p class="admin-alert is-neutral">Tu rol no permite administrar el contenido de este restaurante.</p>' : ''}
        ${allowed && categories.length === 0 ? '<p class="admin-alert is-neutral">Crea primero una categoría: todo producto debe pertenecer a una categoría del mismo restaurante.</p>' : ''}
        <section class="profile-section">
          <div class="profile-section-heading"><div><h2>Categorías</h2><p>Organiza el menú en secciones visibles u ocultas.</p></div><span>01 · ${categories.length}</span></div>
          <div class="catalog-rows">${categories.map((category, index) => renderCategoryRow(category, index, disabled)).join('')}${renderNewCategoryForm(disabled)}</div>
        </section>
        <section class="profile-section">
          <div class="profile-section-heading"><div><h2>Productos</h2><p>Platillos y bebidas con precio, disponibilidad y fotografía.</p></div><span>02 · ${products.length}</span></div>
          <div class="catalog-rows">${products.map((product, index) => renderProductRow(product, index, disabled)).join('')}${renderNewProductForm(disabled)}</div>
        </section>
      </div>`;
  }

  function renderQrPanel(restaurant) {
    const catalogPath = window.CatalogRouter.path(`/r/${encodeURIComponent(restaurant.slug)}/`);
    const catalogUrl = new URL(catalogPath, window.location.origin).href;
    return `
      <section class="qr-panel" aria-labelledby="qr-panel-title">
        <div class="business-section-heading"><p class="eyebrow">LISTO PARA IMPRIMIR</p><h2 id="qr-panel-title">Comparte tu menú con un escaneo.</h2><p>Genera un código QR que abre el catálogo público de ${escapeHtml(restaurant.name)}. Puedes descargarlo o imprimirlo.</p></div>
        <div id="qr-print-area" class="qr-print-area">
          <div id="restaurant-qr" role="img" aria-label="Código QR del catálogo de ${escapeHtml(restaurant.name)}"></div>
          <div><p class="eyebrow">MENÚ DIGITAL</p><h2>${escapeHtml(restaurant.name)}</h2><p>Escanea para ver el menú</p><p class="qr-public-url">${escapeHtml(catalogUrl)}</p></div>
        </div>
        <p id="qr-status" class="save-status" role="status" aria-live="polite">Pulsa “Generar código QR” para preparar la imagen.</p>
        <div class="qr-actions">
          <button id="generate-qr" class="admin-primary-button" type="button">Generar código QR</button>
          <button id="print-qr" class="admin-secondary-button" type="button" disabled>Imprimir</button>
          <a id="download-qr" class="admin-secondary-button qr-download" download="${escapeHtml(restaurant.slug)}-codigo-qr.svg" hidden>Descargar SVG</a>
          <a class="admin-preview-link" href="${escapeHtml(catalogUrl)}" target="_blank" rel="noopener noreferrer">Abrir catálogo ↗</a>
        </div>
      </section>`;
  }

  function loadQrCodeLibrary() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    if (qrCodeLibraryPromise) return qrCodeLibraryPromise;
    qrCodeLibraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
      script.integrity = 'sha384-8FWZA6BGMXhsfO+BLtrJK0We6gg5o1JyO8xQm6peWDEUs17ACA5ziE/NIAkl9z2k';
      script.crossOrigin = 'anonymous';
      script.async = true;
      script.onload = () => window.qrcode
        ? resolve(window.qrcode)
        : reject(new Error('No se pudo inicializar el generador QR.'));
      script.onerror = () => reject(new Error('No se pudo cargar el generador QR. Comprueba tu conexión e inténtalo otra vez.'));
      document.head.appendChild(script);
    }).catch((error) => {
      qrCodeLibraryPromise = null;
      throw error;
    });
    return qrCodeLibraryPromise;
  }

  function bindQrEvents(restaurant) {
    const canvas = appRoot.querySelector('#restaurant-qr');
    const generateButton = appRoot.querySelector('#generate-qr');
    const printButton = appRoot.querySelector('#print-qr');
    const downloadLink = appRoot.querySelector('#download-qr');
    const status = appRoot.querySelector('#qr-status');
    const catalogUrl = new URL(
      window.CatalogRouter.path(`/r/${encodeURIComponent(restaurant.slug)}/`),
      window.location.origin,
    ).href;

    generateButton.addEventListener('click', async () => {
      generateButton.disabled = true;
      status.textContent = 'Generando código QR…';
      status.className = 'save-status';
      try {
        const createQrCode = await loadQrCodeLibrary();
        const qrCode = createQrCode(0, 'H');
        qrCode.addData(catalogUrl);
        qrCode.make();
        const svg = qrCode.createSvgTag({ cellSize: 8, margin: 4, scalable: true });
        canvas.innerHTML = svg;
        canvas.querySelector('svg')?.setAttribute('aria-hidden', 'true');
        downloadLink.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        downloadLink.hidden = false;
        printButton.disabled = false;
        status.textContent = 'QR listo. Descárgalo o imprímelo para colocarlo en tu negocio.';
        status.className = 'save-status is-success';
      } catch (error) {
        status.textContent = error.message;
        status.className = 'save-status is-error';
      } finally {
        generateButton.disabled = false;
      }
    });
    printButton.addEventListener('click', () => window.print());
  }

  function rowStatus(row, message, isError = false) {
    const status = row.querySelector('.catalog-row-status');
    if (!status) return;
    status.textContent = message || '';
    status.className = `catalog-row-status${isError ? ' is-error' : message ? ' is-success' : ''}`;
  }

  function setRowBusy(row, busy, label) {
    const button = row.querySelector('button[type="submit"]');
    if (!button) return;
    button.disabled = busy;
    button.textContent = label;
  }

  function bindCatalogEvents(restaurant) {
    const panel = appRoot.querySelector('.catalog-panel');
    if (!panel || !canManageCatalog(restaurant)) return;

    panel.querySelector('[data-reload-catalog]')?.addEventListener('click', () => {
      resetCatalogState();
      renderDashboard();
    });
    panel.querySelectorAll('[data-category-form]').forEach((row) => {
      row.addEventListener('submit', (event) => onSubmitCategory(event, restaurant));
    });
    panel.querySelectorAll('[data-product-form]').forEach((row) => {
      row.addEventListener('submit', (event) => onSubmitProduct(event, restaurant));
    });
    panel.querySelectorAll('[data-delete-category]').forEach((button) => {
      button.addEventListener('click', () => onDeleteCategory(button.dataset.deleteCategory, restaurant));
    });
    panel.querySelectorAll('[data-delete-product]').forEach((button) => {
      button.addEventListener('click', () => onDeleteProduct(button.dataset.deleteProduct, restaurant));
    });
    panel.querySelectorAll('[data-clear-image]').forEach((button) => {
      button.addEventListener('click', () => onClearProductImage(button.dataset.clearImage, restaurant));
    });
    panel.querySelectorAll('[data-product-image]').forEach((input) => {
      input.addEventListener('change', () => onPickProductImage(input));
    });
  }

  function onPickProductImage(input) {
    const file = input.files && input.files[0];
    const row = input.closest('.catalog-row');
    if (!row) return;
    if (!file) {
      pendingUploads.delete(input.dataset.productImage);
      return;
    }
    const problem = validateImageFile(file);
    if (problem) {
      input.value = '';
      pendingUploads.delete(input.dataset.productImage);
      rowStatus(row, problem, true);
      return;
    }
    pendingUploads.set(input.dataset.productImage, file);
    const thumb = row.querySelector('.catalog-thumb');
    if (thumb) {
      thumb.classList.remove('is-empty');
      thumb.innerHTML = `<img src="${escapeHtml(URL.createObjectURL(file))}" alt="Vista previa de la fotografía" />`;
    }
    rowStatus(row, `Imagen lista: ${file.name}. Guarda la fila para aplicarla.`);
  }

  async function uploadPendingImage(restaurant, key) {
    const file = pendingUploads.get(key);
    if (!file) return null;
    const path = `${restaurant.id}/products/${uniqueImageName(file)}`;
    await api().uploadObject(path, file, { session });
    return path;
  }

  function renderNewProductForm(disabled) {
    return `
      <form class="catalog-row is-product is-new" data-product-form="new">
        <span class="catalog-row-index">+</span>
        <span class="catalog-thumb is-empty">M</span>
        <div class="catalog-row-fields">
          <label>Producto<input name="name" maxlength="140" required placeholder="Nombre del platillo"${disabled} /></label>
          <label>Precio<input name="price" type="number" min="0" step="0.01" required placeholder="0.00"${disabled} /></label>
          <label>Categoría<select name="category_id" required${disabled}>${categoryOptions('')}</select></label>
          <label>Orden<input name="display_order" type="number" min="0" step="1" value="0"${disabled} /></label>
          <label class="field-span">Descripción<textarea name="description" rows="2" maxlength="1200" placeholder="Opcional"${disabled}></textarea></label>
          <label class="field-span catalog-upload">Fotografía<input name="image" type="file" accept="image/jpeg,image/png,image/webp" data-product-image="new"${disabled} /><small>JPEG, PNG o WebP hasta 5 MiB. Se sube al crear el producto.</small></label>
          <label class="catalog-check"><input type="checkbox" name="is_available" checked${disabled} /><span>Disponible hoy</span></label>
          <label class="catalog-check"><input type="checkbox" name="is_featured"${disabled} /><span>Destacado</span></label>
        </div>
        <div class="catalog-row-actions">
          <p class="catalog-row-status" role="status" aria-live="polite"></p>
          <button class="admin-primary-button" type="submit"${disabled}>Crear producto</button>
        </div>
      </form>`;
  }

  async function reloadCatalogAfterChange(restaurant, message) {
    pendingUploads.clear();
    resetCatalogState();
    catalogState = { ...catalogState, restaurantId: restaurant.id };
    await loadCatalog(restaurant);
    renderDashboard(message);
  }

  async function onDeleteCategory(categoryId, restaurant) {
    const category = catalogState.categories.find((item) => item.id === categoryId);
    const affected = catalogState.products.filter((product) => product.category_id === categoryId);
    const question = affected.length
      ? `Se eliminará la categoría "${category?.name || ''}" y sus ${affected.length} producto(s). ¿Continuar?`
      : `Se eliminará la categoría "${category?.name || ''}". ¿Continuar?`;
    if (!window.confirm(question)) return;
    try {
      await api().rest(`categories?id=eq.${encodeURIComponent(categoryId)}`, { method: 'DELETE', session });
      for (const product of affected) {
        if (!product.image_path) continue;
        try {
          await api().removeObjects(product.image_path, { session });
        } catch {
          /* la imagen huérfana no bloquea el borrado de la fila */
        }
      }
      await reloadCatalogAfterChange(restaurant, 'Categoría eliminada.');
    } catch (error) {
      renderDashboard(`No se pudo eliminar la categoría. ${error.message}`);
    }
  }

  async function onDeleteProduct(productId, restaurant) {
    const product = catalogState.products.find((item) => item.id === productId);
    if (!window.confirm(`Se eliminará el producto "${product?.name || ''}". ¿Continuar?`)) return;
    try {
      await api().rest(`products?id=eq.${encodeURIComponent(productId)}`, { method: 'DELETE', session });
      if (product?.image_path) {
        try {
          await api().removeObjects(product.image_path, { session });
        } catch {
          /* la imagen huérfana no bloquea el borrado de la fila */
        }
      }
      await reloadCatalogAfterChange(restaurant, 'Producto eliminado.');
    } catch (error) {
      renderDashboard(`No se pudo eliminar el producto. ${error.message}`);
    }
  }

  async function onClearProductImage(productId, restaurant) {
    const product = catalogState.products.find((item) => item.id === productId);
    if (!product?.image_path) return;
    if (!window.confirm('Se quitará la fotografía de este producto. ¿Continuar?')) return;
    try {
      const cleared = await api().rest(`products?id=eq.${encodeURIComponent(productId)}&select=*`, {
        method: 'PATCH',
        body: { image_path: null },
        session,
        prefer: 'return=representation',
      });
      if (!Array.isArray(cleared) || cleared.length !== 1) {
        throw new Error('Supabase no confirmó el cambio de la fotografía.');
      }
      try {
        await api().removeObjects(product.image_path, { session });
      } catch {
        /* la imagen huérfana no bloquea la actualización de la fila */
      }
      await reloadCatalogAfterChange(restaurant, 'Fotografía eliminada.');
    } catch (error) {
      renderDashboard(`No se pudo quitar la fotografía. ${error.message}`);
    }
  }

  async function onSubmitCategory(event, restaurant) {
    event.preventDefault();
    const row = event.currentTarget;
    const values = new FormData(row);
    const id = row.dataset.categoryForm;
    const name = String(values.get('name') || '').trim();
    if (!name) {
      rowStatus(row, 'El nombre de la categoría es obligatorio.', true);
      return;
    }
    const body = {
      name,
      description: String(values.get('description') || '').trim(),
      display_order: Math.max(0, Number(values.get('display_order')) || 0),
      is_active: values.get('is_active') === 'on',
    };
    if (id === 'new') body.restaurant_id = restaurant.id;

    setRowBusy(row, true, 'Guardando…');
    rowStatus(row, '');
    try {
      const filter = new URLSearchParams({ select: '*' });
      if (id !== 'new') filter.set('id', `eq.${id}`);
      const saved = await api().rest(`categories?${filter}`, {
        method: id === 'new' ? 'POST' : 'PATCH',
        body,
        session,
        prefer: 'return=representation',
      });
      if (!Array.isArray(saved) || saved.length !== 1) {
        throw new Error('Supabase no confirmó el cambio de la categoría. Revisa tu rol y las políticas RLS.');
      }
      pendingUploads.clear();
      resetCatalogState();
      catalogState = { ...catalogState, restaurantId: restaurant.id };
      await loadCatalog(restaurant);
      renderDashboard(id === 'new' ? 'Categoría creada.' : 'Categoría guardada.');
    } catch (error) {
      rowStatus(row, error.message, true);
      setRowBusy(row, false, id === 'new' ? 'Crear categoría' : 'Guardar');
    }
  }

  async function onSubmitProduct(event, restaurant) {
    event.preventDefault();
    const row = event.currentTarget;
    const values = new FormData(row);
    const id = row.dataset.productForm;
    const previousImagePath = id === 'new' ? '' : catalogState.products.find((product) => product.id === id)?.image_path;
    const name = String(values.get('name') || '').trim();
    const categoryId = String(values.get('category_id') || '');
    const price = Number(values.get('price'));
    if (!name) {
      rowStatus(row, 'El nombre del producto es obligatorio.', true);
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      rowStatus(row, 'El precio debe ser un número mayor o igual que cero.', true);
      return;
    }
    if (!categoryId) {
      rowStatus(row, 'Elige una categoría del mismo restaurante.', true);
      return;
    }

    const body = {
      name,
      description: String(values.get('description') || '').trim(),
      price,
      category_id: categoryId,
      display_order: Math.max(0, Number(values.get('display_order')) || 0),
      is_available: values.get('is_available') === 'on',
      is_featured: values.get('is_featured') === 'on',
    };
    if (id === 'new') body.restaurant_id = restaurant.id;

    setRowBusy(row, true, 'Guardando…');
    rowStatus(row, '');
    try {
      if (pendingUploads.has(id)) {
        rowStatus(row, 'Subiendo la fotografía…');
        body.image_path = await uploadPendingImage(restaurant, id);
      }
      const filter = new URLSearchParams({ select: '*' });
      if (id !== 'new') filter.set('id', `eq.${id}`);
      const saved = await api().rest(`products?${filter}`, {
        method: id === 'new' ? 'POST' : 'PATCH',
        body,
        session,
        prefer: 'return=representation',
      });
      if (!Array.isArray(saved) || saved.length !== 1) {
        throw new Error('Supabase no confirmó el cambio del producto. Revisa tu rol y las políticas RLS.');
      }
      if (previousImagePath && saved[0].image_path !== previousImagePath) {
        try {
          await api().removeObjects(previousImagePath, { session });
        } catch {
          /* la fila ya referencia la nueva imagen; una limpieza fallida no invalida el guardado */
        }
      }
      pendingUploads.clear();
      resetCatalogState();
      catalogState = { ...catalogState, restaurantId: restaurant.id };
      await loadCatalog(restaurant);
      renderDashboard(id === 'new' ? 'Producto creado.' : 'Producto guardado.');
    } catch (error) {
      rowStatus(row, error.message, true);
      setRowBusy(row, false, id === 'new' ? 'Crear producto' : 'Guardar');
    }
  }

  function renderProfileForm(restaurant, canEditProfile) {
    const theme = restaurant.theme_settings || {};
    const disabled = canEditProfile ? '' : ' disabled';
    return `
      ${!canEditProfile ? '<p class="admin-alert is-neutral">Tu rol puede administrar contenido, pero solo owner o admin puede cambiar esta ficha.</p>' : ''}
      <form id="restaurant-profile-form" class="profile-form">
        <section class="profile-section">
          <div class="profile-section-heading"><div><h2>Datos públicos</h2><p>Información que verá quien abra tu catálogo.</p></div><span>01</span></div>
          <div class="profile-fields">
            <label>Nombre del negocio<input name="name" maxlength="120" required value="${escapeHtml(restaurant.name)}"${disabled} /></label>
            <label>Dirección web (slug)<span class="input-prefix">/r/<input name="slug" maxlength="63" pattern="[a-z0-9]+(-[a-z0-9]+)*" required value="${escapeHtml(restaurant.slug)}"${disabled} /></span></label>
            <label class="field-span">Descripción<textarea name="description" rows="3" maxlength="2000"${disabled}>${escapeHtml(restaurant.description || '')}</textarea></label>
            <label>Teléfono<input name="phone" type="tel" maxlength="40" value="${escapeHtml(restaurant.phone || '')}"${disabled} /></label>
            <label>WhatsApp<input name="whatsapp" type="tel" maxlength="40" value="${escapeHtml(restaurant.whatsapp || '')}"${disabled} /></label>
            <label class="field-span">Dirección<input name="address" maxlength="500" value="${escapeHtml(restaurant.address || '')}"${disabled} /></label>
            <label>Moneda<select name="currency"${disabled}>${['CUP', 'MXN', 'USD', 'EUR', 'COP', 'ARS', 'CLP', 'PEN'].map((currency) => `<option value="${currency}"${restaurant.currency === currency ? ' selected' : ''}>${currency}</option>`).join('')}</select></label>
            <label class="field-span">Horario (JSON)<textarea name="opening_hours" rows="4" class="json-input"${disabled}>${escapeHtml(JSON.stringify(restaurant.opening_hours || {}, null, 2))}</textarea><small>Se guardará como objeto JSON; el formato de edición se ampliará junto al catálogo.</small></label>
          </div>
        </section>
        ${renderThemeSection(restaurant, theme, disabled)}
        <section class="profile-section">
          <div class="profile-section-heading"><div><h2>Imágenes del negocio</h2><p>Sube un archivo desde tu dispositivo o pega una URL pública. Se guarda en <code>&lt;restaurante&gt;/logo/…</code> y <code>&lt;restaurante&gt;/cover/…</code>.</p></div><span>03</span></div>
          <div class="profile-fields">
            <label class="field-span">Subir logo<input name="logo_file" type="file" accept="image/jpeg,image/png,image/webp"${disabled} /><small>JPEG, PNG o WebP hasta 5 MiB. La subida rellena la URL de abajo; guarda después.</small></label>
            <label class="field-span">URL del logo<input name="logo_url" type="url" value="${escapeHtml(restaurant.logo_url || '')}" placeholder="https://…"${disabled} /></label>
            <label class="field-span">Subir portada<input name="cover_file" type="file" accept="image/jpeg,image/png,image/webp"${disabled} /><small>Se recomienda una imagen apaisada de al menos 1600 px de ancho.</small></label>
            <label class="field-span">URL de portada<input name="cover_image_url" type="url" value="${escapeHtml(restaurant.cover_image_url || '')}" placeholder="https://…"${disabled} /></label>
          </div>
        </section>
        <div class="profile-save-row"><p id="profile-save-status" class="save-status" role="status" aria-live="polite"></p><button class="admin-primary-button" type="submit"${disabled}>Guardar cambios <span aria-hidden="true">→</span></button></div>
      </form>`;
  }

  function renderThemeSection(restaurant, theme, disabled) {
    return `
      <section class="profile-section">
        <div class="profile-section-heading"><div><h2>Colores</h2><p>Elige una paleta controlada para la identidad del catálogo.</p></div><span>02</span></div>
        <div class="theme-fields">
          ${[['accent', 'Color de acento', '#bc4f34'], ['ink', 'Color de texto', '#273c32'], ['paper', 'Fondo', '#f4f2eb']].map(([key, label, fallback]) => `<label class="theme-control"><input type="color" name="theme_${key}" value="${escapeHtml(theme[key] || fallback)}" aria-label="${label}"${disabled} /><span><strong>${label}</strong><small>${escapeHtml(theme[key] || fallback)}</small></span></label>`).join('')}
        </div>
      </section>`;
  }

  async function onSaveProfile(event) {
    event.preventDefault();
    const restaurant = selectedRestaurant();
    if (!restaurant || !['owner', 'admin', 'super_admin'].includes(restaurant.role)) return;
    const form = event.currentTarget;
    const status = form.querySelector('#profile-save-status');
    const button = form.querySelector('button[type="submit"]');
    const values = new FormData(form);
    const slug = String(values.get('slug')).trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      status.textContent = 'El slug solo admite minúsculas, números y guiones entre palabras.';
      status.className = 'save-status is-error';
      return;
    }

    let openingHours;
    try {
      openingHours = JSON.parse(String(values.get('opening_hours') || '{}'));
      if (!openingHours || Array.isArray(openingHours) || typeof openingHours !== 'object') throw new Error();
    } catch {
      status.textContent = 'El horario debe ser un objeto JSON válido.';
      status.className = 'save-status is-error';
      return;
    }

    const body = {
      name: String(values.get('name')).trim(),
      slug,
      description: String(values.get('description') || '').trim(),
      phone: String(values.get('phone') || '').trim() || null,
      whatsapp: String(values.get('whatsapp') || '').trim() || null,
      address: String(values.get('address') || '').trim() || null,
      currency: String(values.get('currency')),
      opening_hours: openingHours,
      logo_url: String(values.get('logo_url') || '').trim() || null,
      cover_image_url: String(values.get('cover_image_url') || '').trim() || null,
      theme_settings: {
        accent: String(values.get('theme_accent')),
        ink: String(values.get('theme_ink')),
        paper: String(values.get('theme_paper')),
      },
    };

    button.disabled = true;
    button.textContent = 'Guardando…';
    status.textContent = '';
    status.className = 'save-status';
    const filter = new URLSearchParams({ id: `eq.${restaurant.id}`, select: '*' });
    try {
      const updated = await api().rest(`restaurants?${filter}`, {
        method: 'PATCH', body, session, prefer: 'return=representation',
      });
      if (!Array.isArray(updated) || updated.length !== 1) {
        throw new Error('Supabase no confirmó la actualización. Comprueba tu rol y las políticas RLS.');
      }
      Object.assign(restaurant, updated[0]);
      status.textContent = 'Cambios guardados en Supabase.';
      status.className = 'save-status is-success';
      setTitle(`${restaurant.name} · Panel`);
    } catch (error) {
      status.textContent = error.message;
      status.className = 'save-status is-error';
    } finally {
      button.disabled = false;
      button.innerHTML = 'Guardar cambios <span aria-hidden="true">→</span>';
    }
  }

  async function onProfileImagePick(event) {
    const input = event.target;
    if (input.name !== 'logo_file' && input.name !== 'cover_file') return;
    const file = input.files && input.files[0];
    const restaurant = selectedRestaurant();
    const status = appRoot.querySelector('#profile-save-status');
    const button = appRoot.querySelector('#restaurant-profile-form button[type="submit"]');
    if (!file || !restaurant) return;
    const problem = validateImageFile(file);
    if (problem) {
      input.value = '';
      if (status) {
        status.textContent = problem;
        status.className = 'save-status is-error';
      }
      return;
    }
    const folder = input.name === 'logo_file' ? 'logo' : 'cover';
    if (button) {
      button.disabled = true;
      button.textContent = 'Subiendo imagen…';
    }
    try {
      const path = `${restaurant.id}/${folder}/${uniqueImageName(file)}`;
      await api().uploadObject(path, file, { session });
      const target = input.name === 'logo_file' ? 'logo_url' : 'cover_image_url';
      const urlInput = appRoot.querySelector(`#restaurant-profile-form input[name="${target}"]`);
      if (urlInput) urlInput.value = api().publicStorageUrl(path);
      if (status) {
        status.textContent = 'Imagen subida. Guarda los cambios para aplicarla.';
        status.className = 'save-status is-success';
      }
    } catch (error) {
      if (status) {
        status.textContent = error.message;
        status.className = 'save-status is-error';
      }
    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML = 'Guardar cambios <span aria-hidden="true">→</span>';
      }
    }
  }

  async function onSignOut() {
    const currentSession = session || api().readSession();
    api().clearSession();
    session = null;
    restaurants = [];
      isPlatformAdmin = false;
    try {
      if (currentSession) await api().signOut(currentSession);
      renderLogin({ notice: 'Sesión cerrada.' });
    } catch (error) {
      renderLogin({ error: `La sesión local se cerró, pero Supabase respondió: ${error.message}` });
    }
  }

  async function render(root) {
    appRoot = root;
    recoverySession = consumeRecoveryLink();
    if (api().getConfigurationError()) {
      renderConfiguration();
      return;
    }
    if (recoverySession) {
      renderPasswordReset();
      return;
    }
    renderLoading();
    try {
      const currentSession = await api().getValidSession();
      if (!currentSession) {
        isPlatformAdmin = false;
        restaurants = [];
        renderLogin();
        return;
      }
      session = currentSession;
      restaurants = await loadDashboardAccess(session.user);
      selectedRestaurantId = restaurants[0]?.id || '';
      renderDashboard();
    } catch {
      api().clearSession();
      renderLogin();
    }
  }

  window.CatalogAdmin = { render };
})();