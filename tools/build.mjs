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
// inlined code can't end its own tag early, or open an HTML comment the parser would honour
const safe = s => s.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const safeCss = s => s.replace(/<\/style/gi, '<\\/style');
// each piece of index.html that's inlined must be found exactly, or the build fails (it used to fall through quietly to a
// page that still loads src/ and styles.css, which the Artifact can't serve)
const swap = (html, tag, by) => { if (!html.includes(tag)) throw new Error(`build: index.html no longer has ${tag}`); return html.replace(tag, by); };
let html = read('index.html');
html = swap(html, '<link rel="stylesheet" href="styles.css">', () => `<style>\n${safeCss(read('styles.css'))}</style>`);
html = swap(html, '<script type="module" src="src/main.js"></script>', () => `<script type="module">\n${safe(js)}</script>`);
for (const bad of ['src="src/', 'href="styles.css"']) if (html.includes(bad)) throw new Error(`build: the output still refers to ${bad}`);
fs.mkdirSync(path.join(root, 'dist'), {recursive: true});
fs.writeFileSync(path.join(root, 'dist/afterglow.html'), html);
console.log(`dist/afterglow.html: ${(html.length/1024).toFixed(0)} KB`);
