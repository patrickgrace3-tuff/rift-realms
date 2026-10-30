// Loads the game's script files in the same order as index.html, into one shared
// scope (like a browser), with just enough fake DOM to run the simulation and the
// canvas drawing code headless. No three.js, no network: boot() exits early.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fakeCtx(){
  return new Proxy({}, {
    get: (t, k) => k in t ? t[k] : () => ({ addColorStop(){}, data: new Uint8ClampedArray(256 * 256 * 4) }),
    set: (t, k, v) => { t[k] = v; return true; },
  });
}
function fakeEl(){
  return new Proxy(function(){}, {
    get: (t, k) => {
      if(k === Symbol.toPrimitive) return () => "";
      if(k === "children") return [];
      if(k === "getContext") return () => fakeCtx();
      if(k === "getBoundingClientRect") return () => ({ width: 640, height: 640 });
      if(k === "closest") return () => null;
      return fakeEl();
    },
    set: () => true,
    apply: () => fakeEl(),
  });
}

export function loadGame(){
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const files = [...html.matchAll(/<script src="(src\/js\/[^"]+)"><\/script>/g)].map(m => m[1]);
  if(!files.length) throw new Error("No game scripts found in index.html");
  const ctx = {
    console, Math, JSON, Date, Map, Set, Promise, Proxy, Array, Object, String, Number, Uint8ClampedArray, Float32Array, setTimeout, clearTimeout,
    document: { querySelector: () => fakeEl(), createElement: () => ({ width: 0, height: 0, getContext: () => fakeCtx(), toDataURL: () => "data:," }), body: fakeEl() },
    addEventListener(){}, requestAnimationFrame(){}, innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
    localStorage: { getItem: () => null, setItem(){} }, location: { reload(){} }, performance: { now: () => Date.now() },
    fetch: () => Promise.reject(new Error("offline in tests")), Image: function(){ return {}; },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for(const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
  // Script-scope bindings (const/let/functions) are shared across scripts in one context.
  const names = ["SIM", "SIDES", "MAX_PLAYERS", "PARTY_MAX", "ROLL_TIME", "QUESTS", "QUEST_ORDER", "NPCS", "MOBS", "LOOT", "ARCH", "SLOTS", "BEACONS", "LOOKOUTS", "DEN", "PINES", "TOWER", "RARITY", "ZS", "WH", "PASS", "OUTPOST", "LYNX_RIDGE", "zoneAt", "xpForLevel", "mobXp", "questXp", "MAX_LEVEL",
    "buildKit", "abilityParams", "applyTalents", "talentPoints", "talentsSpent", "questFor", "genItem", "rollRarity", "makeMat", "fmtCoins",
    "CharArt", "drawSheep", "drawBoar", "drawWolf", "drawRam", "drawLynx", "drawBag", "drawFlower", "drawTooth", "HEADS", "itemIconURL", "applyLook"];
  return vm.runInContext(`({ ${names.join(", ")} })`, ctx);
}

// A small fake champion in Data Dragon's shape, with paraphrased ability text.
export function champ(id, range, tags, spells){
  return { id, name: id, tags,
    stats: { hp: 600, hpperlevel: 100, attackdamage: 60, attackdamageperlevel: 3, attackspeed: .65, attackrange: range, movespeed: 340 },
    spells: spells.map(([name, description]) => ({ name, description, image: { full: name + ".png" } })) };
}
export const GAREN_LIKE = () => champ("Garen", 175, ["Fighter"], [
  ["Decisive Strike", "Gains movement speed and his next attack silences."], ["Courage", "Gains a shield."],
  ["Judgment", "Rapidly spins his sword around his body."], ["Demacian Justice", "Executes an enemy based on missing health."]]);
