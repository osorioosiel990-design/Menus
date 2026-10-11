window.CatalogRouter = {
  getBasePath(pathname = window.location.pathname) {
    const segments = pathname.split('/').filter(Boolean);
    let routeIndex = -1;
    segments.forEach((segment, index) => {
      if ((segment === 'r' && segments.length - index === 2) || (segment === 'admin' && segments.length - index === 1)) routeIndex = index;
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
    const basePath = window.CatalogRouter.getBasePath(normalizedPath);
    const path = basePath ? normalizedPath.slice(basePath.length) || '/' : normalizedPath;

    if (path === '/admin') return { name: 'admin' };

    const restaurantMatch = path.match(/^\/r\/([^/]+)$/);
    if (restaurantMatch) {
      return { name: 'restaurant', slug: decodeURIComponent(restaurantMatch[1]) };
    }

    return { name: 'not-found' };
  },
};