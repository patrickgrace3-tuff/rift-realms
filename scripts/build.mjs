// Builds the site into _site/ for hosting (Render, GitHub Pages): index.html (with fresh
// version codes, see stamp.mjs) and the src/ folder.
import fs from "node:fs";
import path from "node:path";
import { root, stamped } from "./stamp.mjs";

const out = path.join(root, "_site");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
fs.cpSync(path.join(root, "src"), path.join(out, "src"), { recursive: true });
fs.writeFileSync(path.join(out, "index.html"), stamped(fs.readFileSync(path.join(root, "index.html"), "utf8")));
console.log("Built _site/.");
