/** Builds the static desktop into _site/ with relative URLs so it can be served from any base path (e.g. GitHub Pages). */
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative, dirname, extname, sep } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = join(root, '_site');
const copies = [["standalone/index.html", "index.html"], ["public/favicon.svg", "favicon.svg"], ["public/assets", "assets"], ["packages", "packages"]];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const [from, to] of copies) {
  await mkdir(dirname(join(out, to)), { recursive: true });
  await cp(join(root, from), join(out, to), { recursive: true, filter: source => !source.split(sep).includes('node_modules') });
}

// Root-absolute URLs become relative: to the document in HTML/JS, to the stylesheet in CSS.
const rooted = /(["'`(])\/(?:((?:packages|assets)\/)|((?:favicon\.svg)(?=["'`)])))/g;
async function* walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}
for await (const file of walk(out)) {
  const type = extname(file);
  if (!['.html', '.js', '.css'].includes(type)) continue;
  const prefix = type === '.css' ? `${relative(dirname(file), out).split(sep).join('/') || '.'}/` : './';
  const source = await readFile(file, 'utf8');
  let text = source.replace(rooted, (match, quote, directory, name) => `${quote}${prefix}${directory ?? name}`);
  if (text !== source) await writeFile(file, text);
}
console.log('Static site written to _site');
