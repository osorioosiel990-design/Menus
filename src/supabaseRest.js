(() => {
  const configuration = window.CATALOG_CONFIG || {};
  const storageKey = 'catalog-admin-session-v1';
  const catalogBucket = 'restaurant-catalog';

  function getConfigurationError() {
    if (!configuration.supabaseUrl || !configuration.publishableKey) {
      return 'Falta la URL del proyecto y su clave pública. Configura src/config.js para habilitar la administración.';
    }
    try {
      const url = new URL(configuration.supabaseUrl);
      const local = ['localhost', '127.0.0.1'].includes(url.hostname);
      if (url.protocol !== 'https:' && !local) return 'La URL de Supabase debe usar HTTPS.';
      if (!url.hostname) return 'La URL configurada para Supabase no es válida.';
    } catch {
      return 'La URL configurada para Supabase no es válida.';
    }
    if (configuration.publishableKey.startsWith('sb_secret_') || isServiceRoleJwt(configuration.publishableKey)) {
      return 'Esta clave no es publicable. Usa la clave sb_publishable o anon del proyecto.';
    }
    return '';
  }

  function projectUrl() {
    return configuration.supabaseUrl.replace(/\/+$/, '');
  }

  function isServiceRoleJwt(key) {
    const parts = key.split('.');
    if (parts.length !== 3) return false;
    try {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.role === 'service_role';
    } catch {
      return false;
    }
  }

  async function request(path, { method = 'GET', body, session, prefer, skipRefresh = false } = {}) {
    if (session?.refresh_token && !skipRefresh && session.expires_at <= Math.floor(Date.now() / 1000) + 60) {
      await refreshSession(session);
    }
    const headers = { apikey: configuration.publishableKey };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    else headers.Authorization = `Bearer ${configuration.publishableKey}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (prefer) headers.Prefer = prefer;

    let response;
    try {
      response = await fetch(`${projectUrl()}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new Error('No fue posible conectar con Supabase. Revisa la conexión a Internet y la URL del proyecto.');
    }

    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }
    if (!response.ok) {
      const message = data?.msg || data?.message || data?.error_description || data?.error || `Error de Supabase (${response.status}).`;
      throw new Error(message);
    }
    return data;
  }

  function persistSession(session, remember = session.remember === true) {
    const normalized = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at || Math.floor(Date.now() / 1000) + (session.expires_in || 3600),
      user: session.user || null,
      remember,
    };
    const storage = remember ? localStorage : sessionStorage;
    const otherStorage = remember ? sessionStorage : localStorage;
    storage.setItem(storageKey, JSON.stringify(normalized));
    otherStorage.removeItem(storageKey);
    return normalized;
  }

  function clearSession() {
    sessionStorage.removeItem(storageKey);
    localStorage.removeItem(storageKey);
  }

  function readSession() {
    try {
      const stored = localStorage.getItem(storageKey) || sessionStorage.getItem(storageKey);
      return JSON.parse(stored || 'null');
    } catch {
      clearSession();
      return null;
    }
  }

  async function refreshSession(session) {
    const updated = await request('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: { refresh_token: session.refresh_token },
      skipRefresh: true,
    });
    Object.assign(session, {
      access_token: updated.access_token,
      refresh_token: updated.refresh_token,
      expires_at: updated.expires_at || Math.floor(Date.now() / 1000) + (updated.expires_in || 3600),
      user: updated.user || session.user,
    });
    persistSession(session);
    return session;
  }

  async function getValidSession() {
    let session = readSession();
    if (!session?.access_token || !session?.refresh_token) return null;
    if (session.expires_at <= Math.floor(Date.now() / 1000) + 60) {
      session = await refreshSession(session);
    }
    const user = await request('/auth/v1/user', { session });
    session.user = user;
    persistSession(session);
    return session;
  }

  function rest(path, options) {
    return request(`/rest/v1/${path}`, options);
  }

  function publicStorageUrl(path) {
    if (!path) return '';
    const base = configuration.supabaseUrl.replace(/\/+$/, '');
    const encodedPath = String(path).split('/').map(encodeURIComponent).join('/');
    return `${base}/storage/v1/object/public/${catalogBucket}/${encodedPath}`;
  }

  function encodeStoragePath(path) {
    return String(path).split('/').map(encodeURIComponent).join('/');
  }

  async function uploadObject(path, file, { session, upsert = true } = {}) {
    if (session?.refresh_token && session.expires_at <= Math.floor(Date.now() / 1000) + 60) {
      await refreshSession(session);
    }
    const headers = {
      apikey: configuration.publishableKey,
      Authorization: `Bearer ${session?.access_token || configuration.publishableKey}`,
      'x-upsert': String(upsert),
    };
    if (file.type) headers['Content-Type'] = file.type;

    let response;
    try {
      response = await fetch(`${projectUrl()}/storage/v1/object/${catalogBucket}/${encodeStoragePath(path)}`, {
        method: 'POST',
        headers,
        body: file,
      });
    } catch {
      throw new Error('No fue posible conectar con Storage. Revisa la conexión a Internet.');
    }

    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }
    if (!response.ok) {
      const message = data?.message || data?.error || data?.statusCode || `Storage respondió con el código ${response.status}.`;
      throw new Error(message);
    }
    return data;
  }

  async function removeObjects(paths, { session } = {}) {
    const list = (Array.isArray(paths) ? paths : [paths]).filter(Boolean);
    if (!list.length) return null;
    const result = await request(`/storage/v1/object/${catalogBucket}`, {
      method: 'DELETE',
      body: { prefixes: list },
      session,
    });
    return result;
  }

  window.CatalogSupabase = {
    getConfigurationError,
    request,
    rest,
    createRestaurant: (name, slug, ownerUserId, session) => request('/rest/v1/rpc/create_restaurant_for_owner', {
      method: 'POST',
      body: { p_name: name, p_slug: slug, p_owner_id: ownerUserId },
      session,
    }),
    publicStorageUrl,
    uploadObject,
    removeObjects,
    persistSession,
    readSession,
    clearSession,
    getValidSession,
    signIn: (email, password) => request('/auth/v1/token?grant_type=password', {
      method: 'POST', body: { email, password },
    }),
    recover: (email) => {
      const redirectTo = `${window.location.origin}${window.CatalogRouter.path('/admin/')}`;
      return request(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
        method: 'POST', body: { email },
      });
    },
    updatePassword: (session, password) => request('/auth/v1/user', {
      method: 'PUT', body: { password }, session,
    }),
    signOut: (session) => request('/auth/v1/logout?scope=local', { method: 'POST', session }),
  };
})();