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
  // walk like a player: fight back when something attacks, otherwise keep heading for (x, y)
  const travel = (x, y, max = 60) => {
    for(let s = 0; s < max && Math.hypot(h.x - x, h.y - y) > 150; s++) step(1, i => {
      if(i % 15) return;
      const foe = W.mobs.filter(m => !m.dead && m.aggro === h.id).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
      if(foe){ SIM.input(W, "blue", { atk: foe.id }); for(const k of ["Q", "W", "E", "R"]) SIM.input(W, "blue", { cast: k, at: [foe.x, foe.y] }); }
      else SIM.input(W, "blue", { move: [x, y] });
    });
  };
  const accept = (npc, qid) => { talk(npc); SIM.input(W, "blue", { accept: qid }); step(.2); assert.ok(h.quests[qid], `${qid} should be accepted from ${npc}`); };
  const turnIn = (npc, qid) => { talk(npc); SIM.input(W, "blue", { turnin: qid }); step(.2); assert.equal(h.quests[qid].state, "done", `${qid} should be turned in to ${npc}`); };
  return { W, h, step, fight, fightUntil, talk, walk, travel, accept, turnIn, events };
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
  t.accept("rhea", "beacons");
  G.BEACONS.forEach((b, i) => {
    for(let k = 0; k < 4 && !h.quests.beacons.flags[i]; k++){ t.travel(b.x, b.y - 150); SIM.input(W, "blue", { use: i }); t.step(5); }
  });
  t.turnIn("rhea", "beacons");
  t.accept("rhea", "defend"); t.walk(G.TOWER.x + 200, G.TOWER.y + 300, 12); t.step(70, t.fight("bandit")); t.turnIn("rhea", "defend");
  // all of the Vale is done: Rhea sends you north through Greywind Pass
  t.accept("rhea", "northpass");
  t.travel(G.PASS.x, G.PASS.y - 700); t.travel(G.PASS.x, G.PASS.y + 700);
  assert.ok(h.y > G.ZS, "walked through Greywind Pass into the Peaks");
  t.turnIn("halvard", "northpass");
  t.accept("halvard", "lynx"); t.walk(G.LYNX_RIDGE.x - 300, G.LYNX_RIDGE.y - 300, 16); t.fightUntil("lynx", "lynx", 480);
  const halvard = G.NPCS.find(n => n.id === "halvard"); t.travel(halvard.x, halvard.y - 250); t.turnIn("halvard", "lynx");
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
  for(const style of ["melee", "caster", "ranged", "farmer", "hunter", "fisher", "guard", "bandit", "warden"])
    for(const pose of ["idle", "cast", "attack", "dead"]) new G.CharArt({ style, initial: "A", tier: 1 }).draw(1, true, pose, true);
  const g = document_ctx();
  for(let f = 0; f < 4; f++){ G.drawSheep(g, f, f % 2, true); G.drawBoar(g, f, f % 2, true, true); G.drawWolf(g, f, f % 2, true); G.drawRam(g, f, f % 2, true, f > 1); G.drawLynx(g, f, f % 2, true); }
  G.drawBag(g, 2); G.drawFlower(g); G.drawTooth(g);
  for(const k in G.HEADS) G.HEADS[k](g, 32, 32, 46);
  for(let i = 0; i < 20; i++) G.itemIconURL(G.genItem({ ilvl: 4, rarity: i % 4, cls: "ranged", nid: i }));
});
function document_ctx(){ return new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop(){} }), set: (t, k, v) => { t[k] = v; return true; } }); }

/* ---------- Parties, rolls and chat ---------- */
function partyWorld(n = 3){
  const W = SIM.create(), hs = G.SIDES.slice(0, n).map(s => { const h = SIM.addHero(W, s, GAREN_LIKE()); h.name = s; return h; });
  const fx = [];
  const step = secs => { for(let i = 0; i < secs * 60; i++){ SIM.step(W, 1 / 60); fx.push(...W.fxNet); W.fxNet.length = 0; W.fxLocal.length = 0; } };
  const cmd = (h, c) => SIM.input(W, h.side, c);
  const group = (...members) => { const [lead, ...rest] = members; for(const m of rest){ cmd(lead, { pinvite: m.side }); cmd(m, { paccept: lead.side }); } };
  return { W, hs, fx, step, cmd, group };
}

test("party: invite, accept, decline and limits", () => {
  const { W, hs: [a, b, c], cmd, fx } = partyWorld(3);
  cmd(a, { pinvite: b.side });
  assert.ok(fx.length === 0 && W.fxNet.some(f => f.k === "pinvite" && f.to.includes(b.side)), "invite reaches only the invited player");
  cmd(b, { paccept: a.side });
  const p = W.parties[a.party];
  assert.ok(p && a.party === b.party && p.leader === a.side && p.members.length === 2);
  cmd(b, { pinvite: c.side });
  assert.ok(!W.invites.some(i => i.to === c.side), "only the leader can invite");
  cmd(a, { pinvite: c.side }); cmd(c, { pdecline: a.side });
  assert.ok(!c.party && !W.invites.length, "declining clears the invite");
  cmd(c, { paccept: a.side });
  assert.ok(!c.party, "can't accept an invite you don't have");
  cmd(a, { pinvite: c.side }); cmd(c, { paccept: a.side });
  assert.equal(W.parties[a.party].members.length, 3);
});

test("party: leaving, kicking, leader handover and disconnects", () => {
  const { W, hs: [a, b, c, d], cmd, group } = partyWorld(4);
  group(a, b, c, d);
  cmd(b, { pkick: c.side });
  assert.ok(c.party, "only the leader can remove members");
  cmd(a, { pkick: c.side });
  assert.ok(!c.party && W.parties[a.party].members.length === 3);
  cmd(a, { pleave: 1 });
  const p = W.parties[b.party];
  assert.ok(!a.party && p.leader === b.side, "leadership passes on when the leader leaves");
  SIM.removeHero(W, d.side);
  assert.ok(!b.party && !Object.keys(W.parties).length, "a party of one disbands");
});

test("party: kills share XP, quest credit and quest drops; outsiders get nothing", () => {
  const { W, hs: [a, b, c], cmd, group } = partyWorld(3);
  const bram = G.NPCS.find(n => n.id === "bram");
  for(const h of [a, b, c]){ h.x = bram.x; h.y = bram.y; cmd(h, { accept: "sheep" }); }
  assert.ok(a.quests.sheep && b.quests.sheep && c.quests.sheep);
  group(a, b);
  const sheep = W.mobs.find(m => m.kind === "sheep");
  for(const h of [a, b, c]){ h.x = sheep.x + 100; h.y = sheep.y; }
  SIM.damage(W, sheep, 1e6, a);
  assert.equal(b.quests.sheep.count, 1, "party member gets quest credit");
  assert.ok(b.xp > 0 && a.xp === b.xp, "party member gets the same XP");
  assert.ok(c.xp === 0 && c.quests.sheep.count === 0, "a nearby player outside the party gets nothing");
  const far = W.mobs.find(m => m.kind === "sheep" && !m.dead);
  b.x = far.x + 5000 > 8000 ? far.x - 3000 : far.x + 3000;
  const bxp = b.xp; SIM.damage(W, far, 1e6, a);
  assert.equal(b.xp, bxp, "party members far away don't share");
});

test("loot rolls: Need beats Greed, timeouts pass, everyone passing gives it to the killer", () => {
  const { W, hs: [a, b, c], cmd, step, fx } = partyWorld(3);
  const item = () => G.genItem({ ilvl: 5, rarity: 3, cls: "melee", slot: "chest", nid: W.nid++ });
  let it = item(), r = SIM.startRoll(W, it, [a, b, c], a);
  cmd(a, { roll: r.id, pick: "greed" }); cmd(b, { roll: r.id, pick: "need" }); cmd(c, { roll: r.id, pick: "pass" });
  cmd(b, { roll: r.id, pick: "pass" });
  step(.1);
  assert.ok(b.inv.some(x => x.id === it.id), "Need wins over Greed");
  assert.ok(fx.some(f => f.k === "rollwin" && f.side === b.side));
  it = item(); r = SIM.startRoll(W, it, [a, b, c], c);
  step(G.ROLL_TIME + 1);
  assert.ok(c.inv.some(x => x.id === it.id) && !W.rolls.length, "no picks before the timer: the killer keeps it");
  it = item(); r = SIM.startRoll(W, it, [a, b], a);
  cmd(c, { roll: r.id, pick: "need" });
  assert.ok(!r.choices[c.side], "players outside the roll can't pick");
  cmd(a, { roll: r.id, pick: "nope" });
  assert.ok(!r.choices[a.side], "bad picks are ignored");
});

test("loot rolls: a party kill puts Rare and Epic gear up for a roll", () => {
  const { W, hs: [a, b], group } = partyWorld(2);
  group(a, b);
  const wolf = W.mobs.find(m => m.kind === "wolf");
  for(const h of [a, b]){ h.x = wolf.x + 100; h.y = wolf.y; }
  const rnd = Math.random; Math.random = () => .001; // force a gear drop at Epic quality
  try{ SIM.damage(W, wolf, 1e6, a); } finally { Math.random = rnd; }
  assert.equal(W.rolls.length, 1);
  assert.ok(W.rolls[0].item.r >= 2 && W.rolls[0].members.length === 2);
  const bag = W.loot.find(l => l.bag && l.side === a.side);
  assert.ok(!bag || bag.items.every(i => i.r < 2 || i.s === "mat"), "the rolled item isn't also in the bag");
});

test("chat: world and party channels, cleaned up and rate-limited", () => {
  const { W, hs: [a, b, c], cmd, group } = partyWorld(3);
  group(a, b);
  cmd(a, { chat: "  hello\u0000 world  ", ch: "world" });
  const w = W.fxNet.find(f => f.k === "chat");
  assert.ok(w && w.text === "hello  world" && !w.to, "world chat goes to everyone");
  cmd(a, { chat: "x".repeat(500), ch: "party" });
  const p = W.fxNet.filter(f => f.k === "chat")[1];
  assert.ok(p.ch === "party" && p.to.length === 2 && !p.to.includes(c.side) && p.text.length === 160);
  for(let i = 0; i < 10; i++) cmd(c, { chat: "spam " + i });
  assert.equal(W.fxNet.filter(f => f.k === "chat" && f.from === c.side).length, 5, "at most 5 messages per 5 seconds");
  cmd(c, { chat: "", ch: "world" }); cmd(c, { chat: { toString: null } });
});

test("social commands ignore bad input from guests", () => {
  const { W, hs: [a, b], cmd } = partyWorld(2);
  for(const bad of [{ pinvite: "__proto__" }, { pinvite: "constructor" }, { pinvite: a.side }, { paccept: "toString" }, { pkick: "__proto__" },
    { roll: "__proto__", pick: "need" }, { pdecline: "x" }, { chat: null }, null, "x"]) cmd(a, bad);
  SIM.input(W, "__proto__", { pinvite: b.side });
  assert.ok(!W.invites.length && !a.party && !Object.keys(W.parties).length);
});

test("up to five players can share a world, each in their own slot", () => {
  assert.equal(G.MAX_PLAYERS, 5);
  const { W, hs } = partyWorld(5);
  assert.equal(new Set(hs.map(h => h.x)).size, 5, "players don't spawn on top of each other");
  const snap = SIM.snapshot(W);
  assert.ok(snap.h.length === 5 && Array.isArray(snap.pt) && Array.isArray(snap.iv) && Array.isArray(snap.r));
});

/* ---------- Frostspine Peaks ---------- */
test("Peaks: Rhea only sends you north once every Vale quest is done", () => {
  const vale = G.QUESTS.northpass.prereq, done = Object.fromEntries(vale.map(id => [id, { state: "done" }]));
  assert.equal(vale.length, 8);
  assert.notEqual(G.questFor({ ...done, herbs: { state: "active" } }, "rhea").quest, "northpass");
  const f = G.questFor(done, "rhea"); assert.ok(f.quest === "northpass" && f.state === "offer");
  assert.equal(G.questFor({ ...done, northpass: { state: "done" } }, "halvard").state, "offer");
});

test("Peaks: the ridge can only be crossed at Greywind Pass", () => {
  const t = newWorld(), { h } = t;
  h.x = 1500; h.y = G.ZS - 900; t.walk(1500, G.ZS + 900, 12);
  assert.ok(h.y < G.ZS, "the ridge blocks the way north away from the pass");
  h.x = G.PASS.x; h.y = G.ZS - 900; t.walk(G.PASS.x, G.ZS + 900, 12);
  assert.ok(h.y > G.ZS + 600, "the pass lets you through");
  assert.equal(G.zoneAt(h.y).name, "Frostspine Peaks");
  t.walk(G.PASS.x, G.WH, 40);
  assert.ok(h.y <= G.WH - 600, "the north edge of the Peaks is closed");
});

test("Peaks: heroes who fall in the mountains return to Highwatch", () => {
  const t = newWorld(), { W, h } = t;
  h.x = G.LYNX_RIDGE.x; h.y = G.LYNX_RIDGE.y; G.SIM.damage(W, h, 1e6, null); t.step(7);
  assert.ok(!h.dead && Math.hypot(h.x - G.OUTPOST.x, h.y - G.OUTPOST.y) < 600);
});

/* ---------- Experience ---------- */
test("XP: each level takes longer than the last", () => {
  for(let l = 1; l < G.MAX_LEVEL - 1; l++){
    const a = G.xpForLevel(l), b = G.xpForLevel(l + 1), c = G.xpForLevel(l + 2);
    assert.ok(b > a && c - b >= b - a, `level ${l}: the step grows (${a}, ${b}, ${c})`);
  }
  assert.ok(G.xpForLevel(19) > 4 * G.xpForLevel(5));
});

test("XP: creatures above you give more, far below you give nothing", () => {
  assert.equal(G.mobXp(100, 10, 10), 100);
  assert.equal(G.mobXp(100, 12, 10), 120);
  assert.equal(G.mobXp(100, 20, 10), 140, "the bonus is capped");
  assert.equal(G.mobXp(100, 8, 10), 60);
  assert.equal(G.mobXp(100, 1, 10), 0, "grey creatures give no XP");
  const t = newWorld(), { W, h } = t;
  h.lvl = 9; const sheep = W.mobs.find(m => m.kind === "sheep"); h.x = sheep.x + 100; h.y = sheep.y;
  const xp = h.xp; SIM.damage(W, sheep, 1e6, h);
  assert.equal(h.xp, xp, "a level 9 hero gets nothing for a sheep");
});

test("XP: quests far below your level pay less", () => {
  const Q = G.QUESTS.sheep;
  assert.equal(G.questXp(Q, 1), Q.xp);
  assert.equal(G.questXp(Q, 4), Q.xp, "full XP up to 3 levels over");
  assert.equal(G.questXp(Q, 5), Math.round(Q.xp * .8));
  assert.equal(G.questXp(Q, 20), Math.round(Q.xp * .2), "never below 20%");
  for(const id of G.QUEST_ORDER) assert.ok(G.QUESTS[id].lvl >= 1, `${id} has a level`);
});

test("the ultimate (R) unlocks at level 6", () => {
  assert.equal(G.ULT_LEVEL, 6);
  const { W, h } = newWorld();
  h.lvl = 5; SIM.recalc(h); SIM.input(W, "blue", { cast: "R", at: [h.x + 200, h.y] });
  assert.equal(h.cds.R, 0, "R does nothing at level 5");
  h.lvl = 6; SIM.recalc(h); SIM.input(W, "blue", { cast: "R", at: [h.x + 200, h.y] });
  assert.ok(h.cds.R > 0, "R casts at level 6");
});
