// Builds dist/afterglow.html: index.html with styles.css and the bundled modules inlined, as one
// self-contained file for publishing (the claude.ai Artifact) or sharing. Usage: npm run build
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const js = (await esbuild.build({entryPoints: [path.join(root, 'src/main.js')], bundle: true, format: 'esm', write: false,
  target: 'es2020', legalComments: 'none'})).outputFiles[0].text;
const safe = s => s.replace(/<\/script/gi, '<\\/script');
const html = read('index.html')
  .replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${read('styles.css')}</style>`)
  .replace('<script type="module" src="src/main.js"></script>', () => `<script type="module">\n${safe(js)}</script>`);
fs.mkdirSync(path.join(root, 'dist'), {recursive: true});
fs.writeFileSync(path.join(root, 'dist/afterglow.html'), html);
console.log(`dist/afterglow.html: ${(html.length/1024).toFixed(0)} KB`);
