import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";

const files = [];
function walk(path) {
  for (const name of readdirSync(path)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const file = resolve(path, name);
    if (statSync(file).isDirectory()) walk(file);
    else if (file.endsWith(".js")) files.push(file);
  }
}
walk("packages");
let failures = 0;
for (const file of files) {
  const check = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8",
  });
  if (check.status) {
    failures++;
    process.stderr.write(check.stderr);
  }
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(
    /(?:from\s*|import\s*\()\s*['"](\.[^'"]+)['"]/g,
  )) {
    if (!existsSync(resolve(dirname(file), match[1]))) {
      failures++;
      console.error("Missing module:", file, match[1]);
    }
  }
}
console.log(
  `${files.length} JavaScript modules checked; ${failures} failures.`,
);
process.exitCode = failures ? 1 : 0;
