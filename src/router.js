window.CatalogRouter = {
  getBasePath(pathname = window.location.pathname) {
    const configuredBase = (window.CATALOG_BASE_PATH || '').replace(/\/+$/, '');
    if (configuredBase && configuredBase !== '/' && pathname.startsWith(`${configuredBase}/`)) {
      return configuredBase;
    }

    const segments = pathname.split('/').filter(Boolean);
    let routeIndex = -1;
    segments.forEach((segment, index) => {
      if ((segment === 'r' && segments.length - index === 2) || (['admin', 'negocios'].includes(segment) && segments.length - index === 1)) routeIndex = index;
    });
    if (routeIndex <= 0) return '';
    return `/${segments.slice(0, routeIndex).join('/')}`;
  },

  path(routePath) {
    const basePath = this.getBasePath();
    const normalizedRoute = routePath.startsWith('/') ? routePath : `/${routePath}`;
    return `${basePath}${normalizedRoute}`;
  },

  resolveRoute(pathname) {
    const normalizedPath = pathname.replace(/\/+$/, '') || '/';
    const basePath = window.CatalogRouter.getBasePath(pathname);
    const path = basePath ? normalizedPath.slice(basePath.length) || '/' : normalizedPath;

    if (path === '/') return { name: 'home' };

    if (path === '/admin') return { name: 'admin' };

    if (path === '/negocios') return { name: 'business' };

    const restaurantMatch = path.match(/^\/r\/([^/]+)$/);
    if (restaurantMatch) {
      try {
        return { name: 'restaurant', slug: decodeURIComponent(restaurantMatch[1]) };
      } catch {
        return { name: 'not-found' };
      }
    }

    return { name: 'not-found' };
  },
};