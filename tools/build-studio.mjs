// Builds dist/studio.html: the Studio page (studio.html) with its styles and bundled modules inlined, as one self-contained
// page for publishing as its own claude.ai Artifact (the page's content only: the Artifact wraps it in a document).
// Usage: npm run build:studio
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const js = (await esbuild.build({entryPoints: [path.join(root, 'src/studio/ui.js')], bundle: true, format: 'esm', write: false, target: 'es2020', legalComments: 'none', minify: true})).outputFiles[0].text;
const safe = s => s.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const html = read('studio.html'), take = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); if (i < 0 || j < 0) throw new Error(`build-studio: studio.html no longer has ${a} … ${b}`); return html.slice(i + a.length, j); };
const head = take('<head>', '</head>').replace(/<meta[^>]*>\s*/g, '').replace('<link rel="stylesheet" href="studio.css">', () => `<style>\n${read('studio.css').replace(/<\/style/gi, '<\\/style')}</style>`);
const body = take('<body>', '</body>').replace('<script type="module" src="src/studio/ui.js"></script>', () => `<script type="module">\n${safe(js)}</script>`);
const out = head.trim() + '\n' + body.trim() + '\n';
for (const bad of ['src="src/', 'href="studio.css"']) if (out.includes(bad)) throw new Error(`build-studio: the output still refers to ${bad}`);
fs.mkdirSync(path.join(root, 'dist'), {recursive: true});
fs.writeFileSync(path.join(root, 'dist/studio.html'), out);
console.log(`dist/studio.html: ${(out.length/1024).toFixed(0)} KB`);
