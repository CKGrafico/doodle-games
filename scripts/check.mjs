import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
async function walk(path) {
  const files = [];
  for (const item of await readdir(path, { withFileTypes: true })) {
    if (item.name.startsWith('.') || item.name === 'node_modules') continue;
    const full = join(path, item.name);
    if (item.isDirectory()) files.push(...await walk(full)); else files.push(full);
  }
  return files;
}
async function localLink(file, link) {
  if (!link || /^(?:[a-z]+:|\/\/|#)/i.test(link)) return;
  const clean = link.split(/[?#]/)[0];
  if (!clean) return;
  if (clean.startsWith('/')) throw Error(`${relative(root, file)} uses a root-absolute URL: ${link}`);
  const target = resolve(dirname(file), clean);
  try { await stat(target); } catch { throw Error(`${relative(root, file)} missing local resource: ${link}`); }
}
const files = await walk(root);
for (const file of files.filter(f => /\.m?js$/.test(f))) {
  const result = spawnSync(process.execPath, ['--check', file]);
  if (result.status) throw Error(`${relative(root, file)}: ${result.stderr}`);
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/(?:from\s*|import\s*\(?\s*)['"](\.[^'"]+)['"]/g)) await localLink(file, match[1]);
}
for (const file of files.filter(f => f.endsWith('.html'))) {
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/(?:src|href)=["']([^"']+)["']/g)) await localLink(file, match[1]);
  const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  if (new Set(ids).size !== ids.length) throw Error(`${relative(root, file)} has duplicate IDs`);
  if (file === join(root, 'index.html')) continue;
  const mainFile = join(dirname(file), 'main.js'), main = await readFile(mainFile, 'utf8');
  for (const match of main.matchAll(/\$\(['"]([^'"]+)['"]\)/g)) {
    if (!ids.includes(match[1])) throw Error(`${relative(root, mainFile)} references missing #${match[1]}`);
  }
  if (!source.includes('../shared/theme.css')) throw Error(`${relative(root, file)} must load the shared theme`);
  const renderer = await readFile(join(dirname(file), 'render.js'), 'utf8');
  if (!renderer.includes('../shared/ink.js')) throw Error(`${relative(root, file)} must use the shared ink renderer`);
  if (!main.includes('../shared/controls.js')) throw Error(`${relative(root, file)} must use the shared control contract`);
}
for (const file of files.filter(f => f.endsWith('.css'))) {
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/g)) await localLink(file, match[1] ?? match[2] ?? match[3]);
}
for (const required of ['AGENTS.md', 'MECHANICS.md', 'DESIGN.md', 'docs/quality-review.md']) await stat(join(root, required));
const home = await readFile(join(root, 'index.html'), 'utf8');
if (!home.includes('https://x.com/EvanMilenko/status/2096356126145015885')) throw Error('Preserve the original inspiration credit');
console.log(`Checked ${files.length} files: script syntax, local resources, DOM IDs, shared contracts and inspiration credit.`);
