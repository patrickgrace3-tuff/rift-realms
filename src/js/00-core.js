"use strict";
// Shared helpers and the ability bank: matches each champion's Q/W/E/R to an archetype from Data Dragon text.

const $ = s => document.querySelector(s);
const DD = "https://ddragon.leagueoflegends.com";
let V = null, champs = [], detailCache = new Map();
const champIcon = id => `${DD}/cdn/${V}/img/champion/${id}.png`;
const spellIcon = f => `${DD}/cdn/${V}/img/spell/${f}`;
const strip = s => (s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ---------- Ability bank ----------
   Each champion's Q/W/E/R is matched to an archetype by reading the real ability text from Data Dragon.
   Crowd control, life drain and execute wording in the text carry over. Champions with no clear match
   fall back to a kit for their class: melee, caster or ranged. */
const ARCH = {
  bolt:    { label: "Skillshot", text: "Fires toward your cursor and hits the first enemy" },
  hook:    { label: "Hook", text: "Pulls the first enemy hit to you and stuns them" },
  dash:    { label: "Dash", text: "Dashes toward your cursor, hitting enemies you pass through" },
  leap:    { label: "Leap", text: "Leaps toward your cursor and slams down where you land" },
  blink:   { label: "Blink", text: "Teleports toward your cursor" },
  aoe:     { label: "Blast", text: "Strikes the target area after a short delay" },
  cone:    { label: "Cleave", text: "Hits every enemy in a cone in front of you" },
  spin:    { label: "Spin", text: "Spins, hitting everything around you several times" },
  shield:  { label: "Shield", text: "Shields you, or the ally nearest your cursor, and gives a burst of speed" },
  heal:    { label: "Heal", text: "Restores health to you, or to the ally nearest your cursor" },
  steroid: { label: "Empower", text: "Your attacks are faster and hit harder for a few seconds" },
  field:   { label: "Zone", text: "Creates a zone that damages and slows enemies inside" },
  summon:  { label: "Summon", text: "Places an ally that attacks nearby enemies" },
  stealth: { label: "Stealth", text: "Turns you invisible and speeds you up" },
  orbit:   { label: "Orbit", text: "Orbs circle you, damaging anything they touch" },
};
const RULES = [
  ["hook", /(hook|grab|pulls? (an |the |a |all |nearby )?(enemy|enemies|target|champion|them))/],
  ["stealth", /(invisib|camouflag|stealth|unseen)/],
  ["blink", /(blink|teleport)/],
  ["summon", /(summon|turret|tibbers|spawns? an? |plants? an? |creates? an? (hidden |small )?(box|clone|ward|totem|turret|minion|pet|decoy)|clone|decoy)/],
  ["leap", /(leap|jumps?|slams? down|pounce|lands at)/],
  ["dash", /(dash|lunge|charges? (forward|toward|at)|vault|rolls?|tumble|rushes|surges? forward|glides?)/],
  ["shield", /shield/],
  ["heal", /(\bheals?\b|\bhealing\b|restores? (health|hp))/],
  ["steroid", /(attack speed|empower|next basic attack|next attack|basic attacks (deal|gain|apply))/],
  ["orbit", /(orbit|circle around|swirl)/],
  ["field", /(zone|pool|field|lingering|area for \d|burns? the ground|over the area)/],
  ["spin", /(spin|whirl|surrounding|around (him|her|them|itself)|nearby enemies)/],
  ["cone", /(cone|in front|sweep|swings?|cleave|arc)/],
  ["aoe", /(area|explod|detonat|target location|crashes|rains?|strikes the ground|location)/],
  ["bolt", /(missile|bolt|fires?|throws?|hurls?|launch|shoots?|projectile|in a line|skillshot|orb|sends|first enemy|enemy hit|blows? a|releases? an? |sphere|beam|wave)/],
];
const FALLBACK = {
  melee:  { Q: "cone", W: "shield", E: "dash", R: "leap" },
  caster: { Q: "bolt", W: "field", E: "blink", R: "aoe" },
  ranged: { Q: "bolt", W: "steroid", E: "dash", R: "bolt" },
};
const BASE_CD = { bolt: 5, hook: 11, dash: 9, leap: 10, blink: 12, aoe: 8, cone: 6, spin: 7, shield: 14, heal: 15, steroid: 12, field: 10, summon: 16, stealth: 18, orbit: 12 };
const DAMAGING = new Set(["bolt", "hook", "dash", "leap", "blink", "aoe", "cone", "spin", "field", "orbit"]);
function champClass(d){
  if(!d.stats || d.stats.attackrange <= 300) return "melee";
  return (d.tags || [])[0] === "Marksman" ? "ranged" : "caster";
}
function readCC(text){
  const cc = {};
  if(/(stun|knock|airborne|suppress|charm|taunt|fear|sleep|stasis)/.test(text)) cc.stun = .8;
  else if(/(root|snare|immobiliz|ensnar|binds?)/.test(text)) cc.root = 1.2;
  if(/slow/.test(text)) cc.slow = .4;
  return cc;
}
function abilityParams(type, cls, isR, cc, text){
  const melee = cls === "melee", caster = cls === "caster", m = isR ? 2.4 : 1;
  const p = { type, cc, cd: isR ? 45 : BASE_CD[type], drain: /(heals? (for|equal)|life ?steal|drain|siphon)/.test(text), execute: /(missing health|low health|execute)/.test(text) };
  switch(type){
    case "bolt": Object.assign(p, { dmg: (melee ? 100 : 90) * m, range: isR ? 2600 : melee ? 900 : caster ? 1150 : 1250, speed: isR ? 2200 : 1700, width: isR ? 110 : 60, pierce: isR }); break;
    case "hook": Object.assign(p, { dmg: 70 * m, range: 1000, speed: 1600, width: 60 }); p.cc = Object.assign({}, cc, { stun: .5 }); break;
    case "dash": Object.assign(p, { dmg: 70 * m, range: isR ? 750 : melee ? 500 : 400 }); break;
    case "leap": Object.assign(p, { dmg: 75 * m, range: isR ? 800 : 550, radius: isR ? 400 : 270 }); break;
    case "blink": Object.assign(p, { range: isR ? 800 : 450, dmg: (caster || isR) ? 55 * m : 0, radius: isR ? 380 : 250 }); break;
    case "aoe": Object.assign(p, { dmg: 110 * m, range: isR ? 1400 : 950, radius: isR ? 420 : 250, delay: isR ? .8 : .6 }); break;
    case "cone": Object.assign(p, { dmg: 95 * m, range: (isR ? 1.6 : 1) * (caster ? 650 : 450), angle: isR ? 100 : 70 }); break;
    case "spin": Object.assign(p, { dmg: 38 * m, radius: isR ? 420 : 300, ticks: isR ? 5 : 3, dur: isR ? 1.6 : .9 }); break;
    case "shield": Object.assign(p, { amount: 120 * (isR ? 2.5 : 1), dur: isR ? 4 : 2.5, boost: .25, dmg: isR ? 120 : 0, radius: 350 }); break;
    case "heal": Object.assign(p, { amount: 150 * (isR ? 2.5 : 1), dmg: isR ? 120 : 0, radius: 350 }); break;
    case "steroid": Object.assign(p, { dur: isR ? 7 : 4, as: isR ? 1 : .6, onHit: isR ? 40 : 20 }); break;
    case "field": Object.assign(p, { dmg: 22 * (isR ? 2 : 1), range: isR ? 1100 : 800, radius: isR ? 420 : 260, dur: isR ? 4.5 : 3, slow: .3 }); break;
    case "summon": Object.assign(p, { dmg: 30 * (isR ? 2 : 1), range: 450, dur: isR ? 10 : 7, atkRange: 650 }); break;
    case "stealth": Object.assign(p, { dur: isR ? 4 : 2.5, boost: isR ? .5 : .3 }); break;
    case "orbit": Object.assign(p, { dmg: 28 * m, dur: 4 }); break;
  }
  return p;
}
function buildKit(d){
  const cls = champClass(d), used = new Set(), kit = { cls };
  ["Q", "W", "E", "R"].forEach((k, i) => {
    const sp = (d.spells && d.spells[i]) || { name: k, description: "", image: { full: "" } }, text = (sp.name + " " + strip(sp.description)).toLowerCase();
    const matches = RULES.filter(r => r[1].test(text)).map(r => r[0]);
    let type;
    if(k === "R") type = matches[0] || FALLBACK[cls].R;
    else type = matches.find(m => !used.has(m))
      || (Object.keys(readCC(text)).length ? (cls === "melee" ? ["cone", "leap", "spin"] : ["aoe", "cone", "bolt"]).find(m => !used.has(m)) : null)
      || (!used.has(FALLBACK[cls][k]) ? FALLBACK[cls][k] : null)
      || Object.values(FALLBACK[cls]).find(m => !used.has(m)) || matches[0] || FALLBACK[cls][k];
    used.add(type);
    kit[k] = Object.assign(abilityParams(type, cls, k === "R", readCC(text), text), { key: k, name: sp.name, icon: sp.image.full });
  });
  return kit;
}
function describeAbility(p){
  let s = ARCH[p.type].text;
  if(DAMAGING.has(p.type) || p.dmg){
    if(p.type !== "hook" && p.cc.stun) s += ", stunning";
    else if(p.cc.root) s += ", rooting";
    if(p.cc.slow) s += ", slowing";
    if(p.drain) s += ", healing you for part of the damage";
    if(p.execute) s += "; hits harder on low-health targets";
  }
  if(p.key === "R" && (p.type === "shield" || p.type === "heal")) s += ", and blasts nearby enemies";
  return s + ".";
}
