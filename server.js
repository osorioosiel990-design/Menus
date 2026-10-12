const port = Number(process.env.PORT || 4173);

async function start() {
  const { createServer } = await import('vite');
  const server = await createServer({
    configFile: `${__dirname}/vite.config.js`,
    server: { host: '127.0.0.1', port, strictPort: true },
  });
  await server.listen();
  console.log(`Menú Abierto disponible en http://127.0.0.1:${port}`);
}

start().catch((error) => {
  console.error('No se pudo iniciar el servidor de desarrollo.', error);
  process.exitCode = 1;
});