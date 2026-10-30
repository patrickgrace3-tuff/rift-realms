// Builds the site into _site/ for hosting (Render, GitHub Pages).
// Each script and stylesheet link gets ?v=<hash of the file>, so browsers fetch a fresh
// copy whenever a file changes instead of mixing old and new files from their cache.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "_site");
const hash = file => crypto.createHash("sha1").update(fs.readFileSync(path.join(root, file))).digest("hex").slice(0, 10);

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
fs.cpSync(path.join(root, "src"), path.join(out, "src"), { recursive: true });
let n = 0;
const html = fs.readFileSync(path.join(root, "index.html"), "utf8")
  .replace(/(src|href)="(src\/[^"?]+)"/g, (m, attr, file) => { n++; return `${attr}="${file}?v=${hash(file)}"`; });
fs.writeFileSync(path.join(out, "index.html"), html);
console.log(`Built _site/ with ${n} versioned files.`);
