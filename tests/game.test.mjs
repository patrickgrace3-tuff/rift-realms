// Run with: npm test   (or: node --test tests/)
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadGame, GAREN_LIKE } from "./harness.mjs";

const G = loadGame();
const { SIM } = G;

function newWorld(){
  const W = SIM.create();
  SIM.addHero(W, "blue", GAREN_LIKE());
  const h = W.heroes.blue, events = {};
  const step = (secs, each) => {
    for(let i = 0; i < secs * 60; i++){
      if(each) each(i);
      SIM.step(W, 1 / 60);
      for(const f of W.fxNet) events[f.k] = (events[f.k] || 0) + 1;
      W.fxNet.length = 0; W.fxLocal.length = 0;
    }
  };
  const nearest = kind => W.mobs.filter(m => m.kind === kind && !m.dead).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
  const fight = kind => i => {
    if(i % 15) return;
    const t = nearest(kind); if(!t) return;
    SIM.input(W, "blue", { atk: t.id });
    if(Math.hypot(t.x - h.x, t.y - h.y) < 600) for(const k of ["Q", "W", "E", "R"]) SIM.input(W, "blue", { cast: k, at: [t.x, t.y] });
  };
  const fightUntil = (qid, kind, max = 240) => { for(let s = 0; s < max && h.quests[qid].state === "active"; s += 5) step(5, fight(kind)); };
  const talk = (npc, secs = 30) => { SIM.input(W, "blue", { talk: npc }); step(secs); };
  const walk = (x, y, secs) => { SIM.input(W, "blue", { move: [x, y] }); step(secs); };
  const accept = (npc, qid) => { talk(npc); SIM.input(W, "blue", { accept: qid }); step(.2); assert.ok(h.quests[qid], `${qid} should be accepted from ${npc}`); };
  const turnIn = (npc, qid) => { talk(npc); SIM.input(W, "blue", { turnin: qid }); step(.2); assert.equal(h.quests[qid].state, "done", `${qid} should be turned in to ${npc}`); };
  return { W, h, step, fight, fightUntil, talk, walk, accept, turnIn, events };
}

test("full quest chain can be completed in order", () => {
  const t = newWorld(), { W, h } = t;
  t.accept("bram", "sheep"); t.fightUntil("sheep", "sheep"); t.turnIn("bram", "sheep");
  t.accept("bram", "tusker"); t.walk(G.DEN.x - 300, G.DEN.y - 300, 14);
  for(let s = 0; s < 240 && h.quests.tusker.state === "active"; s += 5){
    const tooth = W.loot.find(l => l.quest === "tusker");
    if(tooth){ SIM.input(W, "blue", { pickup: tooth.id }); t.step(5); } else t.step(5, t.fight("boar"));
  }
  t.turnIn("kaela", "tusker");
  assert.ok(h.equip.weapon && h.equip.weapon.glow, "Old Tusker reward is a glowing weapon");
  t.accept("kaela", "courier"); t.turnIn("merrin", "courier");
  t.accept("rhea", "scout"); for(const p of G.LOOKOUTS) t.walk(p.x, p.y, 25); t.turnIn("rhea", "scout");
  t.accept("kaela", "wolves"); t.walk(G.PINES.x, G.PINES.y - 300, 16); t.fightUntil("wolves", "wolf"); t.turnIn("kaela", "wolves");
  t.accept("merrin", "herbs");
  for(let k = 0; k < 10 && h.quests.herbs.state === "active"; k++){
    const n = W.nodes.filter(n => n.ready).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
    SIM.input(W, "blue", { gather: n.id }); t.step(15);
  }
  t.turnIn("merrin", "herbs");
  t.accept("rhea", "beacons"); G.BEACONS.forEach((b, i) => { SIM.input(W, "blue", { use: i }); t.step(30); }); t.turnIn("rhea", "beacons");
  t.accept("rhea", "defend"); t.walk(G.TOWER.x + 200, G.TOWER.y + 300, 12); t.step(70, t.fight("bandit")); t.turnIn("rhea", "defend");
  for(const id of G.QUEST_ORDER) assert.equal(h.quests[id].state, "done", `${id} done`);
  assert.ok(h.coins > 0, "earned coins");
  assert.ok(Object.keys(h.equip).length >= 2, "has gear equipped");
});

test("timed delivery fails after 10 minutes and can be retried", () => {
  const t = newWorld(), { h } = t;
  h.quests = { sheep: { state: "done" }, tusker: { state: "done" } };
  t.accept("kaela", "courier"); t.step(601);
  assert.equal(h.quests.courier.state, "failed");
  assert.equal(G.questFor(h.quests, "kaela").state, "offer");
});

test("leaving the watchtower fails the defense", () => {
  const t = newWorld(), { W, h } = t;
  h.quests = { sheep: { state: "done" }, scout: { state: "done" }, beacons: { state: "done" } };
  t.accept("rhea", "defend"); t.walk(G.TOWER.x + 200, G.TOWER.y + 300, 12);
  assert.equal(h.quests.defend.phase, 1, "defense started");
  t.walk(G.TOWER.x, G.TOWER.y + 2500, 10);
  assert.equal(h.quests.defend.state, "failed");
  assert.equal(W.mobs.filter(m => m.kind === "bandit").length, 0, "bandits cleared");
});

test("skill points follow the tree rules", () => {
  const { W, h } = newWorld(), tal = n => SIM.input(W, "blue", { talent: n });
  tal("Q.power"); assert.equal(h.talents.Q.power, 0, "no points at level 1");
  h.lvl = 8; SIM.recalc(h);
  tal("Q.mastery"); assert.equal(h.talents.Q.mastery, 0, "mastery needs 3 points first");
  tal("Q.power"); tal("Q.power"); tal("Q.haste"); tal("Q.mastery");
  assert.equal(h.talents.Q.mastery, 1);
  tal("bogus.power"); tal("Q.__proto__"); tal("core.power");
  assert.equal(G.talentsSpent(h.talents), 4, "bad input ignored");
  SIM.input(W, "blue", { respec: 1 });
  assert.equal(G.talentsSpent(h.talents), 0);
  assert.equal(G.talentPoints(h.lvl, h.talents), 7);
});

test("every ability archetype casts with full upgrades without errors", () => {
  for(const type of Object.keys(G.ARCH)){
    const W = SIM.create(); SIM.addHero(W, "blue", GAREN_LIKE());
    const c = W.heroes.blue; c.lvl = 10; SIM.recalc(c);
    const boar = W.mobs.find(m => m.kind === "boar"); c.x = boar.x - 400; c.y = boar.y;
    for(const k of G.SLOTS){ c.kit[k] = Object.assign(G.abilityParams(type, "melee", k === "R", { stun: .4 }, ""), { key: k, name: type, icon: "x" }); c.talents[k] = { power: 3, haste: 0, mastery: 1 }; }
    let casts = 0;
    for(let i = 0; i < 60 * 8; i++){
      if(i % 30 === 0) for(const k of G.SLOTS){ const s0 = c.castSeq; SIM.input(W, "blue", { cast: k, at: [boar.x, boar.y] }); if(c.castSeq > s0) casts++; }
      SIM.step(W, 1 / 60);
      JSON.stringify(SIM.snapshot(W));
    }
    assert.ok(casts >= 4, `${type} cast ${casts} times`);
  }
});

test("gear: equip, unequip, salvage and bad commands", () => {
  const { W, h } = newWorld();
  const it = G.genItem({ ilvl: 5, rarity: 2, cls: "melee", slot: "chest", nid: 999 });
  SIM.addItem(h, it); const hp0 = h.maxHp;
  SIM.input(W, "blue", { equip: it.id });
  assert.equal(h.equip.chest.id, it.id);
  assert.ok(h.maxHp >= hp0);
  SIM.input(W, "blue", { unequip: "chest" });
  assert.ok(!h.equip.chest && h.inv.some(x => x.id === it.id));
  const c0 = h.coins; SIM.input(W, "blue", { salvage: it.id });
  assert.ok(h.coins > c0 && !h.inv.some(x => x.id === it.id));
  for(const bad of [{ equip: "__proto__" }, { unequip: "constructor" }, { salvage: "nope" }]) SIM.input(W, "blue", bad);
});

test("item rarity distribution looks sane", () => {
  const counts = [0, 0, 0, 0];
  for(let i = 0; i < 2000; i++) counts[G.genItem({ ilvl: 5, rarity: G.rollRarity(0, 0), cls: "caster", nid: i }).r]++;
  assert.ok(counts[0] > counts[1] && counts[1] > counts[2] && counts[2] > counts[3], counts.join("/"));
});

test("sprites and icons draw without errors", () => {
  for(const style of ["melee", "caster", "ranged", "farmer", "hunter", "fisher", "guard", "bandit"])
    for(const pose of ["idle", "cast", "attack", "dead"]) new G.CharArt({ style, initial: "A", tier: 1 }).draw(1, true, pose, true);
  const g = document_ctx();
  for(let f = 0; f < 4; f++){ G.drawSheep(g, f, f % 2, true); G.drawBoar(g, f, f % 2, true, true); G.drawWolf(g, f, f % 2, true); }
  G.drawBag(g, 2); G.drawFlower(g); G.drawTooth(g);
  for(const k in G.HEADS) G.HEADS[k](g, 32, 32, 46);
  for(let i = 0; i < 20; i++) G.itemIconURL(G.genItem({ ilvl: 4, rarity: i % 4, cls: "ranged", nid: i }));
});
function document_ctx(){ return new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop(){} }), set: (t, k, v) => { t[k] = v; return true; } }); }
