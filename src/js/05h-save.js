"use strict";
// Saved progress: one record per champion, kept in the player's own browser (08d-save.js writes it).
// saveRecord builds the record from a hero (or the hero's snapshot); SIM.loadSave puts it back on a
// freshly added hero. Saves come from the player's browser, so a guest's save is untrusted: every
// value is checked, clamped or rebuilt here, and anything unknown is dropped.

const SAVE_VERSION = 1;
const QUEST_STATES = ["active", "ready", "done", "failed"];

// h: a hero in the simulation, or the same hero in a snapshot (gear under h.gear)
function saveRecord(h, champ){
  const gear = h.gear || h, quests = {};
  for(const id in h.quests || {}){ const q = h.quests[id]; quests[id] = { state: q.state, count: q.count || 0, flags: (q.flags || []).slice() }; }
  return { v: SAVE_VERSION, champ, lvl: h.lvl, xp: Math.round(h.xp), coins: h.coins, quests,
    inv: gear.inv || [], equip: gear.equip || {}, talents: h.talents, x: Math.round(h.x), y: Math.round(h.y),
    arenaWins: h.arenaWins ?? h.aw ?? 0, arenaBest: h.arenaBest ?? h.ab ?? 0, prof: Object.assign({}, h.prof || {}), at: Date.now() };
}

const int = (v, lo, hi, dflt = lo) => { v = Math.floor(+v); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : dflt; };
const str = (v, max) => typeof v === "string" ? v.slice(0, max) : "";

Object.assign(SIM, {
  // rebuild one saved item from known fields only; returns null for anything that isn't a real item
  cleanItem(W, it){
    if(!it || typeof it !== "object") return null;
    const id = "i" + W.nid++;
    if(it.s === "mat") return Object.hasOwn(MATERIALS, it.key) ? Object.assign(makeMat(it.key, W.nid++), { id, q: int(it.q, 1, 20, 1) }) : null;
    if(it.s === "use") return Object.hasOwn(SHOP_ITEMS, it.key) ? Object.assign(makePotion(W.nid++, int(it.q, 1, 20, 1)), { id }) : null;
    if(!EQ_SLOTS.includes(it.s)) return null;
    const st = {};
    for(const k in it.st || {}) if(Object.hasOwn(STAT, k)) st[k] = int(it.st[k], 0, 5000);
    return { id, n: str(it.n, 80) || "Item", s: it.s, r: Object.hasOwn(SETS, it.set) ? SET_RARITY : int(it.r, 0, 4), m: Object.hasOwn(MATERIAL, it.m) ? it.m : null, st, il: int(it.il, 1, 40, 1), v: int(it.v, 0, 1e6),
      color: /^#[0-9a-f]{6}$/i.test(it.color) ? it.color : "#b8a68a", wt: ["sword", "staff", "bow"].includes(it.wt) ? it.wt : null, glow: !!it.glow, ...(Object.hasOwn(SETS, it.set) ? { set: it.set } : {}) };
  },
  // put a saved record back on a hero that was just added (only the host calls this, once, when the hero joins)
  loadSave(W, c, save){
    if(!save || typeof save !== "object" || save.v !== SAVE_VERSION || save.champ !== c.champId) return false;
    c.lvl = int(save.lvl, 1, MAX_LEVEL, 1);
    c.xp = c.lvl >= MAX_LEVEL ? 0 : int(save.xp, 0, SIM.xpNext(c.lvl) - 1);
    c.coins = int(save.coins, 0, 1e9);
    c.arenaWins = int(save.arenaWins, 0, 1e6); c.arenaBest = int(save.arenaBest, 0, 10);
    c.prof = {}; for(const p of PROF_KEYS) if(save.prof && save.prof[p] !== undefined && save.prof[p] !== null) c.prof[p] = int(save.prof[p], 1, PROF_MAX, 1);   // professions you've learned, and their skill
    // quests: known ids and states only; timers and defenses start over
    c.quests = {};
    for(const id in save.quests || {}){
      if(!Object.hasOwn(QUESTS, id)) continue;
      const q = save.quests[id], Q = QUESTS[id]; if(!q || !QUEST_STATES.includes(q.state)) continue;
      const flags = Array.isArray(q.flags) ? q.flags.slice(0, 10).map(f => f ? 1 : 0) : [];
      c.quests[id] = { state: q.state, count: int(q.count, 0, Q.obj.count || 1), flags, phase: 0, deadline: q.state === "active" && Q.timeLimit ? W.t + Q.timeLimit : 0 };
    }
    // bags and equipped gear
    c.inv = []; c.equip = {};
    for(const it of Array.isArray(save.inv) ? save.inv.slice(0, BAG_SIZE) : []){ const x = SIM.cleanItem(W, it); if(x) c.inv.push(x); }
    for(const sl of EQ_SLOTS){ const x = SIM.cleanItem(W, save.equip && save.equip[sl]); if(x && x.s === sl) c.equip[sl] = x; }
    // talents: replay each point through the tree's own rules, so only a legal build survives
    c.talents = newTalents();
    const T = save.talents || {}, want = (slot, node) => int(T[slot] && T[slot][node], 0, 9);
    for(const node of ["vit", "might"]) for(let n = want("core", node); n > 0 && canTalent(c.lvl, c.talents, "core", node); n--) c.talents.core[node]++;
    for(const slot of SLOTS) for(const node of ["power", "haste", "mastery"]) for(let n = want(slot, node); n > 0 && canTalent(c.lvl, c.talents, slot, node); n--) c.talents[slot][node]++;
    // where you were: the cathedral starts over at its entrance (each world has its own)
    const x = +save.x, y = +save.y;
    if(Number.isFinite(x) && Number.isFinite(y)){
      if(inJungle(x, y)){ c.x = x; c.y = y; SIM.bound(W, c); }       // the jungle is open country: pick up where you were
      else if(y > DZ){ c.x = CATHEDRAL.arrive[0]; c.y = CATHEDRAL.arrive[1]; }
      else { c.x = x; c.y = y; SIM.bound(W, c); }
    }
    SIM.recalc(c); c.hp = c.maxHp; c.gearVer++; c.portalT = W.t + 3;
    return true;
  },
});
