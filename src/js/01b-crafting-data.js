"use strict";
// Professions and crafting: gathering (Mining, Herbalism, Skinning), Artisanry (refining materials and
// forging the first item sets), the three class sets and their bonuses. Pure data and pure functions.

const PROF_MAX = 150;
const PROFS = {
  mining: { name: "Mining", kind: "gather", verb: "Mined", hint: "Copperstone in the Vale's south-west hills, Glimmerstone in Hollowdeep Mine, Emberite in the jungle's Ember Hollow." },
  herbalism: { name: "Herbalism", kind: "gather", verb: "Picked", hint: "Sunpetal by Stillwater Pond, Frostbloom round Glassmere, Bloodvine in the jungle north of the river." },
  skinning: { name: "Skinning", kind: "gather", verb: "Skinned", hint: "Skin beasts you kill: wolves and the Old Tusker in the Vale, rams, lynxes and Whitemane in the Peaks, prowlers, apes and crocodiles in the jungle." },
  artisanry: { name: "Artisanry", kind: "craft", hint: "Refine ore, hides and herbs at an Artisan's Forge, then forge set armor and weapons." },
};
const PROF_KEYS = Object.keys(PROFS);
// skill gained from a gather or craft, by how far your skill is past what it needs (bigger gains early)
const skillGain = (skill, req) => skill >= PROF_MAX ? 0 : skill < req + 25 ? 3 : skill < req + 50 ? 2 : skill < req + 75 ? 1 : 0;

// gathering nodes (NODE_SPOTS kinds) and what they give
const GATHER = {
  copper: { prof: "mining", req: 0, mat: "copperore" }, ore: { prof: "mining", req: 50, mat: "glimore" }, emberite: { prof: "mining", req: 100, mat: "emberore" },
  herb: { prof: "herbalism", req: 0, mat: "sunpetal" }, frostbloom: { prof: "herbalism", req: 50, mat: "frostpetal" }, bloodvine: { prof: "herbalism", req: 100, mat: "bloodpetal" },
};
// beasts you can skin after a kill
const SKIN = { wolf: ["lighthide", 0, 1], boar: ["lighthide", 0, 3], ram: ["frostfur", 50, 1], lynx: ["frostfur", 50, 1], yeti: ["frostfur", 50, 3],
  prowler: ["primalhide", 100, 1], ape: ["primalhide", 100, 1], croc: ["primalhide", 100, 1], greyback: ["primalhide", 100, 3] };
// new gathering spots
const COPPER_HILLS = { x: 2300, y: 2100 }, EMBER_HOLLOW = { x: ZS + 5300, y: DZ + 5500 };
NODE_SPOTS.push({ kind: "copper", x: COPPER_HILLS.x, y: COPPER_HILLS.y, rmin: 150, rmax: 650, n: 10 }, { kind: "emberite", x: EMBER_HOLLOW.x, y: EMBER_HOLLOW.y, rmin: 150, rmax: 650, n: 10 });
Object.assign(NODE_INFO, { copper: { name: "Copperstone", idle: "A seam of copper-veined stone. A miner could work it." }, emberite: { name: "Emberite", idle: "Rock that glows from within like a coal. A miner could work it." } });
POIS.push({ name: "Copperstone Hills", x: COPPER_HILLS.x, y: COPPER_HILLS.y - 800 }, { name: "Ember Hollow", x: EMBER_HOLLOW.x, y: EMBER_HOLLOW.y - 800 });

// materials (raw and refined); icon picks the drawing in itemIconURL
Object.assign(MATERIALS, {
  copperore: { n: "Copperstone Ore", v: 4, icon: "ore", col: "#c87a4a" }, glimore: { n: "Glimmerstone Ore", v: 9, icon: "ore", col: "#9fe6ff" }, emberore: { n: "Emberite Ore", v: 16, icon: "ore", col: "#ff6a2a" },
  sunpetal: { n: "Sunpetal", v: 4, icon: "herb", col: "#ffe066" }, frostpetal: { n: "Frostbloom", v: 9, icon: "herb", col: "#9fd8ff" }, bloodpetal: { n: "Bloodvine Blossom", v: 16, icon: "herb", col: "#d01a2a" },
  lighthide: { n: "Light Hide", v: 4, icon: "hide", col: "#b08a5a" }, frostfur: { n: "Frostfur Hide", v: 9, icon: "hide", col: "#e8ecf2" }, primalhide: { n: "Primal Hide", v: 16, icon: "hide", col: "#6a8a3a" },
  copperbar: { n: "Copper Bar", v: 10, icon: "bar", col: "#d88a4a" }, glimbar: { n: "Glimmersteel Bar", v: 22, icon: "bar", col: "#a8f0ff" }, emberbar: { n: "Emberite Bar", v: 40, icon: "bar", col: "#ff7a2a" },
  curedleather: { n: "Cured Leather", v: 10, icon: "leather", col: "#a8743a" }, frostleather: { n: "Frostfur Leather", v: 22, icon: "leather", col: "#c8d8e8" }, primalleather: { n: "Primal Leather", v: 40, icon: "leather", col: "#5a8a2a" },
  sundye: { n: "Sunpetal Tincture", v: 10, icon: "vial", col: "#ffd040" }, frostessence: { n: "Frost Essence", v: 22, icon: "vial", col: "#7fd3ff" }, bloodelixir: { n: "Bloodvine Elixir", v: 40, icon: "vial", col: "#e0203a" },
});

/* ---------- The sets ---------- */
RARITY.push({ n: "Set", c: "#3ff0d0", m: 3.2 });   // rarity 5: crafted set items
const SET_RARITY = 5, SET_ILVL = 24;
const SETS = {
  dawn: { name: "Dawnforged Vanguard", cls: "melee", mat: "plate", wt: "sword", color: "#ffd25a", trim: "#fff4c8", glow: "#ffb030", fx: 0xffc040,
    names: { head: "Dawnforged Crown", chest: "Dawnforged Aegis", hands: "Dawnforged Gauntlets", legs: "Dawnforged Greaves", feet: "Dawnforged Sabatons", weapon: "Dawnbreaker, Blade of First Light" },
    stats: { weapon: { ad: .55, hp: .25, haste: .2 }, armor: { armor: .45, hp: .35, ad: .2 } },
    bonus: [[2, "+10% health"], [4, "+15% attack damage"], [6, "Radiant Wrath: every 4th basic attack bursts with light, hitting every enemy around your target for 150% attack damage. You take 10% less damage."]] },
  storm: { name: "Stormwing Regalia", cls: "ranged", mat: "leather", wt: "bow", color: "#3fd8ff", trim: "#e0fbff", glow: "#7fe8ff", fx: 0x5fe0ff,
    names: { head: "Stormwing Cowl", chest: "Stormwing Harness", hands: "Stormwing Grips", legs: "Stormwing Leggings", feet: "Stormwing Striders", weapon: "Thunderstring, Bow of the Tempest" },
    stats: { weapon: { ad: .55, haste: .25, ms: .2 }, armor: { ad: .35, hp: .35, ms: .15, haste: .15 } },
    bonus: [[2, "+8% movement speed"], [4, "+15% attack damage"], [6, "Chain Lightning: your basic attacks arc to 2 more enemies for 60% damage."]] },
  void: { name: "Voidweave Arcanum", cls: "caster", mat: "cloth", wt: "staff", color: "#9b4dff", trim: "#f0d0ff", glow: "#d070ff", fx: 0xb050ff,
    names: { head: "Voidweave Diadem", chest: "Voidweave Vestments", hands: "Voidweave Handwraps", legs: "Voidweave Leggings", feet: "Voidweave Slippers", weapon: "Nightfall, Staff of the Endless Dark" },
    stats: { weapon: { ap: .55, haste: .25, hp: .2 }, armor: { ap: .4, hp: .35, haste: .25 } },
    bonus: [[2, "+10% health"], [4, "+20% ability damage"], [6, "Void Echo: every 3rd ability you cast doesn't go on cooldown."]] },
};
const SET_KEYS = Object.keys(SETS);
function makeSetItem(key, slot, nid){
  const S = SETS[key], budget = (5 + SET_ILVL * 2.2) * RARITY[SET_RARITY].m * (slot === "weapon" ? 1.3 : slot === "chest" || slot === "legs" ? 1.15 : 1), shares = S.stats[slot === "weapon" ? "weapon" : "armor"], st = {};
  for(const k in shares) st[k] = Math.max(1, Math.round(budget * shares[k] * STAT[k].w));
  return { id: "i" + nid, n: S.names[slot], s: slot, r: SET_RARITY, m: slot === "weapon" ? CLASS_MAT[S.cls] : S.mat, st, il: SET_ILVL, v: 600, color: S.color,
    wt: slot === "weapon" ? S.wt : null, glow: slot === "weapon", set: key };
}
// how many pieces of each set are worn, and the set that counts (the one with the most)
function setCount(equip){
  const n = {}; for(const sl of EQ_SLOTS){ const it = equip && equip[sl]; if(it && SETS[it.set]) n[it.set] = (n[it.set] || 0) + 1; }
  let key = null; for(const k in n) if(!key || n[k] > n[key]) key = k;
  return { key, n: key ? n[key] : 0, all: n };
}

/* ---------- Recipes (Artisanry) ---------- */
// refining: 2 raw → 1 refined. Set pieces: refined materials plus trophies from the raids and the cathedral.
const RECIPES = {};
for(const [out, inp, req] of [["copperbar", "copperore", 0], ["curedleather", "lighthide", 0], ["sundye", "sunpetal", 0],
  ["glimbar", "glimore", 40], ["frostleather", "frostfur", 40], ["frostessence", "frostpetal", 40],
  ["emberbar", "emberore", 85], ["primalleather", "primalhide", 85], ["bloodelixir", "bloodpetal", 85]]) RECIPES[out] = { id: out, group: "refine", req, out: { mat: out }, need: { [inp]: 2 } };
const SET_MATS = { dawn: ["emberbar", "primalleather", "bloodelixir", "glimbar"], storm: ["primalleather", "emberbar", "bloodelixir", "frostleather"], void: ["bloodelixir", "primalleather", "emberbar", "frostessence"] };
const SLOT_COST = { head: [100, 4, 2, 1], hands: [105, 3, 2, 1], feet: [110, 3, 2, 1], legs: [120, 5, 2, 2], chest: [130, 6, 3, 2], weapon: [140, 6, 3, 3] };
for(const key of SET_KEYS) for(const slot of EQ_SLOTS){
  const [req, a, b, c] = SLOT_COST[slot], [m1, m2, m3, m4] = SET_MATS[key], need = { [m1]: a, [m2]: b, [m3]: c, [m4]: 2 };
  if(slot === "chest") need.rimescale = 2;
  if(slot === "weapon"){ need.ashcloth = 3; need.junglehide = 3; }
  RECIPES[key + "_" + slot] = { id: key + "_" + slot, group: key, req, out: { set: key, slot }, need };
}
const RECIPE_GROUPS = [["refine", "Refining"], ["dawn", "Dawnforged (melee)"], ["storm", "Stormwing (ranged)"], ["void", "Voidweave (caster)"]];
const recipeName = R => R.out.mat ? MATERIALS[R.out.mat].n : SETS[R.out.set].names[R.out.slot];

// Master Artisan Brenna teaches every profession; Artisan's Forges stand in the village, at Highwatch and at Canopy Camp
NPCS.push({ id: "brenna", profs: true, name: "Master Artisan Brenna", title: "Professions", x: 3600, y: 3720, head: "miner", style: "miner", idle: "Ore, herbs, hides: everything out there is a suit of armor waiting to happen." });
OBSTACLES.push({ x: 3600, y: 3720, r: 55 });
const FORGES = [{ x: 3440, y: 3930, name: "Artisan's Forge" }, { x: OUTPOST.x + 520, y: OUTPOST.y - 320, name: "Artisan's Forge" }, { x: CANOPY.x - 470, y: CANOPY.y + 470, name: "Artisan's Forge" }];
const FORGE_RANGE = 450;
