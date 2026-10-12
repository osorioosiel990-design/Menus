const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const staticFiles = [
  '404.html',
  '_redirects',
  '.nojekyll',
  'robots.txt',
  'src/styles.css',
  'src/main.js',
  'src/admin.js',
  'src/supabaseRest.js',
  'src/router.js',
  'src/config.js',
  'src/seo.js',
  'src/data/demoRestaurants.js',
];

for (const relativePath of staticFiles) {
  const source = path.join(root, relativePath);
  const destination = path.join(output, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}
