// Writes ?v=<hash of the file> onto every script and stylesheet link in index.html, in the repo.
// Browsers cache files by their full URL, so a changed file gets a new URL and is always fetched
// fresh, and players never run a mix of old and new files. Run after changing any file in src/:
//   node scripts/stamp.mjs
// The test "index.html links carry up-to-date version codes" fails if this was forgotten.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hash = file => crypto.createHash("sha1").update(fs.readFileSync(path.join(root, file))).digest("hex").slice(0, 10);
// index.html with every src/… link stamped with its file's current hash
// index.html with every src/… link stamped with its file's current hash, and a build code
// (a hash of all of them) in <meta name="build"> so an out-of-date page can notice and reload
export function stamped(html){
  const all = [];
  let out = html.replace(/(src|href)="(src\/[^"?]+)(\?v=[0-9a-f]*)?"/g, (m, attr, file) => { const h = hash(file); all.push(h); return `${attr}="${file}?v=${h}"`; });
  const build = crypto.createHash("sha1").update(all.join(",")).digest("hex").slice(0, 10);
  return out.replace(/<meta name="build" content="[0-9a-f]*">/, `<meta name="build" content="${build}">`);
}

if(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)){
  const file = path.join(root, "index.html"), html = fs.readFileSync(file, "utf8"), out = stamped(html);
  if(out !== html){ fs.writeFileSync(file, out); console.log("index.html: version codes updated."); }
  else console.log("index.html: version codes already up to date.");
}
