const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { extname, join, resolve, sep } = require('node:path');

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }

  const requestedPath = resolve(root, `.${pathname}`);
  if (requestedPath !== root && !requestedPath.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  let filePath = requestedPath;
  try {
    if (pathname.endsWith('/')) filePath = join(requestedPath, 'index.html');
    const body = await readFile(filePath);
    response.writeHead(200, { 'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    if (extname(pathname)) {
      response.writeHead(404).end('Not found');
      return;
    }
    try {
      const directoryIndex = await readFile(join(requestedPath, 'index.html'));
      response.writeHead(200, { 'Content-Type': contentTypes['.html'] });
      response.end(request.method === 'HEAD' ? undefined : directoryIndex);
      return;
    } catch {
      // Fall through to the SPA entry for client-side routes.
    }
    filePath = join(root, 'index.html');
    try {
      const body = await readFile(filePath);
      response.writeHead(200, { 'Content-Type': contentTypes['.html'] });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch {
      response.writeHead(500).end('Application entry point is missing');
    }
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Catalog demo available at http://127.0.0.1:${port}`);
});