(() => {
  const api = () => window.CatalogSupabase;
  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
  let appRoot;
  let session;
  let restaurants = [];
  let selectedRestaurantId = '';
  let selectedPanel = 'profile';
  let recoverySession = null;

  function setTitle(title = 'Administración · Catálogos') {
    document.title = title;
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
          <a class="wordmark admin-wordmark" href="${window.CatalogRouter.path('/r/mesa-limon/')}" >
            <span class="wordmark-icon">M</span><span>Menú digital</span>
          </a>
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

  async function startDashboard() {
    renderLoading('Cargando tus restaurantes');
    try {
      session = await api().getValidSession();
      if (!session) {
        renderLogin();
        return;
      }
      restaurants = await loadMemberships(session.user);
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
          <header class="admin-topbar"><a class="wordmark" href="${window.CatalogRouter.path('/r/mesa-limon/')}" ><span class="wordmark-icon">M</span><span>Menú digital</span></a><button id="admin-signout" class="admin-signout">Cerrar sesión</button></header>
          <main class="admin-empty-access"><p class="eyebrow">CUENTA AUTENTICADA</p><h1>Aún no tienes restaurantes asignados.</h1><p>Solicita a la persona responsable que te agregue como miembro. El registro público está desactivado.</p></main>
        </div>`;
      appRoot.querySelector('#admin-signout').addEventListener('click', onSignOut);
      return;
    }

    const canEditProfile = ['owner', 'admin'].includes(restaurant.role);
    appRoot.innerHTML = `
      <div class="admin-app-shell">
        <header class="admin-topbar">
          <a class="wordmark" href="${window.CatalogRouter.path(`/r/${encodeURIComponent(restaurant.slug)}/`)}"><span class="wordmark-icon">M</span><span>Menú digital</span></a>
          <div class="admin-top-actions">
            <span class="admin-user-email">${escapeHtml(session.user.email || '')}</span>
            <a class="admin-preview-link" href="${window.CatalogRouter.path(`/r/${encodeURIComponent(restaurant.slug)}/`)}" target="_blank" rel="noreferrer">Ver catálogo ↗</a>
            <button id="admin-signout" class="admin-signout" type="button">Cerrar sesión</button>
          </div>
        </header>
        <div class="admin-layout">
          <aside class="admin-sidebar">
            <p class="eyebrow">TU NEGOCIO</p>
            ${restaurants.length > 1 ? `<label class="restaurant-select-label">Restaurante<select id="restaurant-select">${restaurants.map((item) => `<option value="${escapeHtml(item.id)}"${item.id === restaurant.id ? ' selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select></label>` : `<div class="sidebar-restaurant">${escapeHtml(restaurant.name)}</div>`}
            <nav class="admin-nav" aria-label="Administración">
              <button type="button" data-panel="profile" class="${selectedPanel === 'profile' ? 'is-active' : ''}">Información del negocio</button>
              <button type="button" data-panel="design" class="${selectedPanel === 'design' ? 'is-active' : ''}">Diseño del catálogo</button>
              <button type="button" data-panel="catalog" class="${selectedPanel === 'catalog' ? 'is-active' : ''}">Productos y categorías <span>PRÓXIMO</span></button>
            </nav>
            <div class="admin-sidebar-foot"><span class="role-dot"></span>${escapeHtml(restaurant.role)} · ${escapeHtml(restaurant.slug)}</div>
          </aside>
          <main class="admin-content">
            <div class="admin-content-heading">
              <div><p class="eyebrow">PANEL DEL RESTAURANTE</p><h1>${selectedPanel === 'design' ? 'Diseño del catálogo' : selectedPanel === 'catalog' ? 'Tu catálogo' : 'Información del negocio'}</h1></div>
              <span class="admin-active-status ${restaurant.is_active ? 'is-live' : ''}"><i></i>${restaurant.is_active ? 'Catálogo activo' : 'Catálogo inactivo'}</span>
            </div>
            ${message ? `<p class="admin-alert is-success" role="status">${escapeHtml(message)}</p>` : ''}
            ${selectedPanel === 'catalog' ? renderCatalogPlaceholder() : renderProfileForm(restaurant, canEditProfile)}
          </main>
        </div>
      </div>`;

    appRoot.querySelector('#admin-signout').addEventListener('click', onSignOut);
    appRoot.querySelector('#restaurant-select')?.addEventListener('change', (event) => {
      selectedRestaurantId = event.target.value;
      selectedPanel = 'profile';
      renderDashboard();
    });
    appRoot.querySelectorAll('[data-panel]').forEach((button) => button.addEventListener('click', () => {
      selectedPanel = button.dataset.panel;
      renderDashboard();
    }));
    appRoot.querySelector('#restaurant-profile-form')?.addEventListener('submit', onSaveProfile);
  }

  function renderCatalogPlaceholder() {
    return `<section class="admin-next-phase"><span class="eyebrow">SIGUIENTE ETAPA</span><h2>Productos y categorías</h2><p>Las herramientas de catálogo y la gestión de fotografías se conectarán en la fase 5.</p></section>`;
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
            <label>Moneda<select name="currency"${disabled}>${['MXN', 'USD', 'EUR', 'COP', 'ARS', 'CLP', 'PEN'].map((currency) => `<option value="${currency}"${restaurant.currency === currency ? ' selected' : ''}>${currency}</option>`).join('')}</select></label>
            <label class="field-span">Horario (JSON)<textarea name="opening_hours" rows="4" class="json-input"${disabled}>${escapeHtml(JSON.stringify(restaurant.opening_hours || {}, null, 2))}</textarea><small>Se guardará como objeto JSON; el formato de edición se ampliará junto al catálogo.</small></label>
          </div>
        </section>
        ${renderThemeSection(restaurant, theme, disabled)}
        <section class="profile-section">
          <div class="profile-section-heading"><div><h2>Imágenes del negocio</h2><p>La carga segura desde dispositivo llegará con Storage en la fase 5.</p></div><span>03</span></div>
          <div class="profile-fields">
            <label class="field-span">URL del logo<input name="logo_url" type="url" value="${escapeHtml(restaurant.logo_url || '')}" placeholder="https://…"${disabled} /></label>
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
    if (!restaurant || !['owner', 'admin'].includes(restaurant.role)) return;
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

  async function onSignOut() {
    const currentSession = session || api().readSession();
    api().clearSession();
    session = null;
    restaurants = [];
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
        renderLogin();
        return;
      }
      session = currentSession;
      restaurants = await loadMemberships(session.user);
      selectedRestaurantId = restaurants[0]?.id || '';
      renderDashboard();
    } catch {
      api().clearSession();
      renderLogin();
    }
  }

  window.CatalogAdmin = { render };
})();