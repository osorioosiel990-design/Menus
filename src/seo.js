(() => {
  function meta(attribute, key, content) {
    let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attribute, key);
      document.head.appendChild(element);
    }
    element.content = content;
  }

  function canonical(path) {
    let element = document.head.querySelector('link[rel="canonical"]');
    if (!element) {
      element = document.createElement('link');
      element.rel = 'canonical';
      document.head.appendChild(element);
    }
    element.href = new URL(path, window.location.origin).href;
  }

  function structuredData(value) {
    document.head.querySelector('#page-structured-data')?.remove();
    if (!value) return;
    const element = document.createElement('script');
    element.id = 'page-structured-data';
    element.type = 'application/ld+json';
    element.textContent = JSON.stringify(value);
    document.head.appendChild(element);
  }

  function update({ title, description, path, image, robots = 'index,follow,max-image-preview:large', data }) {
    document.title = title;
    meta('name', 'description', description);
    meta('name', 'robots', robots);
    meta('property', 'og:site_name', window.CATALOG_CONFIG.brandName);
    meta('property', 'og:type', 'website');
    meta('property', 'og:title', title);
    meta('property', 'og:description', description);
    meta('property', 'og:url', new URL(path, window.location.origin).href);
    meta('name', 'twitter:card', image ? 'summary_large_image' : 'summary');
    meta('name', 'twitter:title', title);
    meta('name', 'twitter:description', description);
    if (image) {
      meta('property', 'og:image', image);
      meta('name', 'twitter:image', image);
    } else {
      document.head.querySelector('meta[property="og:image"]')?.remove();
      document.head.querySelector('meta[name="twitter:image"]')?.remove();
    }
    canonical(path);
    structuredData(data);
  }

  window.CatalogSeo = { update };
})();