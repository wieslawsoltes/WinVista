import { cp, mkdir, rm, readFile } from "node:fs/promises";
import { resolve } from "node:path";
const root = process.cwd(),
  output = resolve(root, "standalone-dist");
await readFile(resolve(root, "packages/shell/index.js"));
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(root, "packages"), resolve(output, "packages"), {
  recursive: true,
  filter: source => !source.split('/').includes('node_modules'),
});
await cp(resolve(root, "public/assets"), resolve(output, "assets"), {
  recursive: true,
});
await cp(resolve(root, "public/favicon.svg"), resolve(output, "favicon.svg"));
await cp(resolve(root, "standalone/index.html"), resolve(output, "index.html"));
console.log("Standalone HTML/JavaScript desktop built at " + output);
console.log(
  "Serve this directory over HTTP(S); file:// cannot load module workers or persistent browser storage reliably.",
);
