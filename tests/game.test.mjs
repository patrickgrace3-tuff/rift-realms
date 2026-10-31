// Run with: npm test   (or: node --test tests/)
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadGame, GAREN_LIKE, champ } from "./harness.mjs";

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
  for(const id of G.QUEST_ORDER.slice(0, G.QUEST_ORDER.indexOf("lynx") + 1)) assert.equal(h.quests[id].state, "done", `${id} done`);
  console.log(`# level at the end of the first Peaks quest: ${h.lvl}`);
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
  for(const style of ["melee", "caster", "ranged", "farmer", "hunter", "fisher", "guard", "bandit", "warden", "miner", "healer", "merchant"])
    for(const pose of ["idle", "cast", "attack", "dead"]) new G.CharArt({ style, initial: "A", tier: 1 }).draw(1, true, pose, true);
  const g = document_ctx();
  for(let f = 0; f < 4; f++){ G.drawSheep(g, f, f % 2, true); G.drawBoar(g, f, f % 2, true, true); G.drawWolf(g, f, f % 2, true); G.drawRam(g, f, f % 2, true, f > 1); G.drawLynx(g, f, f % 2, true); G.drawCragling(g, f, f % 2, true); G.drawWisp(g, f, f % 2, true); G.drawYeti(g, f, f % 2, true, f > 1); G.drawDragon(g, f, f % 2, true, f > 1, 320, 220); G.drawDragon(g, f, f % 2, false, false, 160, 110); }
  G.drawPick(g); G.drawOre(g); G.drawFrostbloom(g);
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
  for(const h of [a, b]){ h.x = wolf.x + 100; h.y = wolf.y; h.lvl = 4; } // same level as the wolf, so no misses
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

test("zones: the list covers the world without overlaps, and zoneAt finds each one", () => {
  for(const a of G.ZONES) for(const b of G.ZONES) if(a !== b)
    assert.ok(a.x0 + a.w <= b.x0 || b.x0 + b.w <= a.x0 || a.y0 + a.h <= b.y0 || b.y0 + b.h <= a.y0, `${a.name} overlaps ${b.name}`);
  for(const z of G.ZONES) assert.equal(G.zoneAt(z.y0 + z.h / 2, z.x0 + z.w / 2).key, z.key);
  assert.equal(new Set(G.ZONES.map(z => z.key)).size, G.ZONES.length, "zone keys are unique");
});

/* ---------- Fighting above your level ---------- */
test("level gap: no penalty within 1 level, then misses, softer hits and harder hits taken", () => {
  for(const g of [-5, 0, 1]){ const L = G.levelGap(g); assert.ok(L.miss === 0 && L.dealt === 1 && L.taken === 1, `gap ${g}`); }
  let prev = G.levelGap(1);
  for(let g = 2; g <= 10; g++){
    const L = G.levelGap(g);
    assert.ok(L.miss >= prev.miss && L.dealt <= prev.dealt && L.taken >= prev.taken, `gap ${g} is at least as bad as ${g - 1}`);
    prev = L;
  }
  const two = G.levelGap(2); assert.ok(two.miss > 0 && two.dealt < 1 && two.taken > 1, "a 2-level gap already counts");
  assert.ok(G.levelGap(20).miss <= .75 && G.levelGap(20).dealt >= .25 && G.levelGap(20).taken <= 2, "capped");
});

test("level gap: a level 1 hero misses a lot and deals little to a level 11 lynx, and gets hit harder", () => {
  const { W, h } = newWorld();
  const lynx = W.mobs.find(m => m.kind === "lynx"); h.x = lynx.x + 120; h.y = lynx.y;
  let misses = 0, dealt = 0;
  for(let i = 0; i < 400; i++){ lynx.hp = lynx.maxHp; lynx.dead = false; const r = SIM.damage(W, lynx, 100, h); if(r < 0) misses++; else dealt += r; }
  assert.ok(misses > 200 && misses < 360, `missed ${misses} of 400 (expected about 75%)`);
  assert.ok(Math.abs(dealt / (400 - misses) - 25) < 1, "hits deal 25%");
  h.hp = h.maxHp; const before = h.hp; SIM.damage(W, h, 100, lynx);
  assert.ok(before - h.hp > 150, "the lynx hits a level 1 hero harder");
  h.lvl = 11; SIM.recalc(h); h.hp = h.maxHp;
  for(let i = 0; i < 50; i++){ lynx.hp = lynx.maxHp; assert.ok(SIM.damage(W, lynx, 100, h) > 0, "no misses at the same level"); }
});

/* ---------- Support abilities and the potion vendor ---------- */
const HEALER = () => champ("Healer", 550, ["Support"], [["Mend", "Heals an ally."], ["Ward", "Shields an ally."], ["Spark", "Fires a bolt of light."], ["Radiance", "Calls down a blast."]]);

test("heals and shields go to the ally nearest the cursor, in or out of combat", () => {
  const W = SIM.create(), a = SIM.addHero(W, "blue", HEALER()), b = SIM.addHero(W, "red", GAREN_LIKE());
  const heal = G.SLOTS.find(k => a.kit[k].type === "heal"), shield = G.SLOTS.find(k => a.kit[k].type === "shield");
  assert.ok(heal && shield, `healer kit: ${G.SLOTS.map(k => a.kit[k].type)}`);
  b.x = a.x + 500; b.y = a.y; b.hp = 100; b.lastCombat = W.t; // the ally is in combat
  SIM.cast(W, a, heal, [b.x + 40, b.y]);
  assert.ok(b.hp > 100, "the ally was healed");
  SIM.cast(W, a, shield, [b.x, b.y + 30]);
  assert.ok(b.shield > 0 && a.shield === 0, "the ally got the shield, not the caster");
  // cursor away from everyone: it goes to the caster
  a.cds[heal] = 0; a.hp = 50; SIM.cast(W, a, heal, [a.x - 2000, a.y]);
  assert.ok(a.hp > 50, "self-heal when no ally is near the cursor");
  // allies too far from the caster aren't picked
  b.x = a.x + 3000; const bh = b.hp = 100; a.cds[heal] = 0; SIM.cast(W, a, heal, [b.x, b.y]);
  assert.equal(b.hp, bh, "out of reach");
});

test("vendor: buy potions near Peddler Osric, drink them with a cooldown", () => {
  const { W, h } = newWorld(), osric = G.NPCS.find(n => n.id === "osric");
  h.coins = 100; h.x = osric.x; h.y = osric.y - 150;
  SIM.input(W, "blue", { talk: "osric" }); const fx = []; for(let i = 0; i < 120; i++){ SIM.step(W, 1 / 60); fx.push(...W.fxNet); W.fxNet.length = W.fxLocal.length = 0; }
  assert.ok(fx.some(f => f.k === "shop" && f.npc === "osric"), "talking to Osric opens his shop");
  SIM.input(W, "blue", { buy: "hpot", n: 3 });
  const pots = () => h.inv.filter(x => x.key === "hpot").reduce((a, x) => a + x.q, 0);
  assert.equal(pots(), 3); assert.equal(h.coins, 100 - 3 * G.SHOP_ITEMS.hpot.price);
  SIM.input(W, "blue", { buy: "hpot", n: 5 });
  assert.equal(pots(), 3, "can't buy what you can't afford");
  for(const bad of [{ buy: "__proto__" }, { buy: "toString" }, { buy: "hpot", n: -5 }, { buy: "hpot", n: "lots" }]) SIM.input(W, "blue", bad);
  assert.ok(h.coins >= 0 && pots() <= 4, "bad buy commands never overspend"); // a count below 1 buys one
  const p0 = pots();
  h.x = osric.x + 3000; h.coins = 1000; SIM.input(W, "blue", { buy: "hpot", n: 1 });
  assert.equal(pots(), p0, "you must be at the vendor to buy");
  h.hp = 100; SIM.input(W, "blue", { potion: 1 });
  assert.ok(h.hp > 100 && pots() === p0 - 1, "drinking heals and uses one potion");
  h.hp = 100; SIM.input(W, "blue", { potion: 1 });
  assert.ok(h.hp === 100 && pots() === p0 - 1, "cooldown blocks a second potion");
  SIM.step(W, G.POTION.cd + 1); h.hp = 100; SIM.input(W, "blue", { potion: 1 });
  assert.ok(h.hp > 100 && pots() === p0 - 2, "usable again after the cooldown");
});

/* ---------- Frostspine Peaks quest line ---------- */
test("Peaks: all ten quests after Claws on the Ridge can be completed", () => {
  const t = newWorld(), { W, h } = t;
  for(const id of G.QUEST_ORDER.slice(0, G.QUEST_ORDER.indexOf("lynx") + 1)) h.quests[id] = { state: "done", count: 0, flags: [] };
  h.lvl = 10; SIM.recalc(h); h.hp = h.maxHp;
  for(const [slot, r] of [["chest", 2], ["legs", 2], ["weapon", 2]]){ const it = G.genItem({ ilvl: 11, rarity: r, cls: "melee", slot, nid: 900 + r + slot.length }); h.equip[slot] = it; } SIM.recalc(h);
  const npc = id => G.NPCS.find(n => n.id === id);
  const goTalk = id => { const n = npc(id); t.travel(n.x, n.y - 200, 200); };
  // like a player: walk over (fighting off anything on the way), and try again after a respawn
  const acceptAt = (id, qid) => { for(let k = 0; k < 3 && !h.quests[qid]; k++){ goTalk(id); t.step(7); SIM.input(W, "blue", { accept: qid }); t.step(.2); } assert.ok(h.quests[qid], `${qid} accepted`); };
  const turnInAt = (id, qid) => { for(let k = 0; k < 3 && h.quests[qid].state !== "done"; k++){ goTalk(id); t.step(7); SIM.input(W, "blue", { turnin: qid }); t.step(.2); } assert.equal(h.quests[qid].state, "done", `${qid} turned in`); };
  const gatherAll = (qid, kind) => {
    for(let k = 0; k < 30 && h.quests[qid].state === "active"; k++){
      const n = W.nodes.filter(n => n.ready && n.kind === kind).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
      if(!n){ t.step(5); continue; }
      t.travel(n.x, n.y, 120); SIM.input(W, "blue", { gather: n.id }); t.step(2);
    }
  };
  acceptAt("halvard", "rams"); t.travel(G.QUESTS.rams.where[0], G.QUESTS.rams.where[1]); t.fightUntil("rams", "ram", 400); turnInAt("halvard", "rams");
  acceptAt("ketil", "delve"); G.QUESTS.delve.obj.points.forEach((p, i) => { for(let k = 0; k < 4 && !h.quests.delve.flags[i]; k++) t.travel(p.x, p.y, 200); }); turnInAt("ketil", "delve");
  acceptAt("ketil", "craglings"); acceptAt("ketil", "pick");
  t.travel(G.QUESTS.craglings.where[0], G.QUESTS.craglings.where[1]);
  for(let s = 0; s < 500 && (h.quests.craglings.state === "active" || h.quests.pick.state === "active"); s += 5){
    const pick = W.loot.find(l => l.quest === "pick" && l.side === "blue");
    if(pick){ SIM.input(W, "blue", { pickup: pick.id }); t.step(5); } else t.step(5, t.fight("cragling"));
  }
  turnInAt("ketil", "craglings"); turnInAt("ketil", "pick");
  acceptAt("ketil", "ore"); gatherAll("ore", "ore"); turnInAt("ketil", "ore");
  acceptAt("maren", "frostbloom"); gatherAll("frostbloom", "frostbloom"); turnInAt("maren", "frostbloom");
  acceptAt("maren", "wisps"); t.travel(G.QUESTS.wisps.where[0], G.QUESTS.wisps.where[1]); t.fightUntil("wisps", "wisp", 400); turnInAt("maren", "wisps");
  acceptAt("halvard", "whitemane"); t.travel(G.QUESTS.whitemane.where[0], G.QUESTS.whitemane.where[1] - 600); t.fightUntil("whitemane", "yeti", 600); turnInAt("halvard", "whitemane");
  acceptAt("yrsa", "wards");
  G.QUESTS.wards.obj.points.forEach(p => { const i = G.USE_POINTS.indexOf(p); for(let k = 0; k < 4 && !h.quests.wards.flags[G.QUESTS.wards.obj.points.indexOf(p)]; k++){ t.travel(p.x, p.y - 160, 200); SIM.input(W, "blue", { use: i }); t.step(5); } });
  turnInAt("yrsa", "wards");
  for(let k = 0; k < 3 && (!h.quests.brood || h.quests.brood.state !== "ready"); k++){
    goTalk("yrsa"); SIM.input(W, "blue", { accept: "brood" }); t.step(.2);   // (re-)accept, after a failed attempt too
    t.travel(G.YRSA_CAMP.x, G.YRSA_CAMP.y - 100); t.step(75, t.fight("whelp"));
  }
  turnInAt("yrsa", "brood");
  for(const id of ["rams", "delve", "craglings", "pick", "ore", "frostbloom", "wisps", "whitemane", "wards", "brood"]) assert.equal(h.quests[id].state, "done", `${id} done`);
  assert.ok(h.inv.some(x => x.key === "yetifur") || h.quests.whitemane.state === "done");
  console.log(`# level after the Peaks quests: ${h.lvl}`);
  const f = G.questFor(h.quests, "yrsa"); assert.ok(f.quest === "rimewyrm" && f.state === "offer", "the raid quest is offered last");
});

test("obstacles never leave a gap narrower than a player (you'd get wedged in it)", () => {
  const bad = [], O = G.OBSTACLES;
  for(let i = 0; i < O.length; i++) for(let j = i + 1; j < O.length; j++){
    const gap = Math.hypot(O[i].x - O[j].x, O[i].y - O[j].y) - O[i].r - O[j].r;
    if(!(gap > 0 && gap < 120)) continue;
    // a gap filled by a third obstacle (like the overlapping ridge circles) isn't a gap
    const d = Math.hypot(O[j].x - O[i].x, O[j].y - O[i].y), k = (O[i].r + gap / 2) / d, mx = O[i].x + (O[j].x - O[i].x) * k, my = O[i].y + (O[j].y - O[i].y) * k;
    if(O.some((o, n) => n !== i && n !== j && Math.hypot(o.x - mx, o.y - my) < o.r)) continue;
    bad.push(`(${O[i].x},${O[i].y}) and (${O[j].x},${O[j].y}): gap ${Math.round(gap)}`);
  }
  assert.deepEqual(bad, []);
});

/* ---------- Raid boss: Skarnvir the Rimewyrm ---------- */
const ARCHER = () => champ("Archer", 525, ["Marksman"], [["Volley", "Fires a bolt that deals damage."], ["Focus", "Gains attack speed."], ["Tumble", "Dashes forward, dealing damage."], ["Longshot", "Fires a long-range missile that deals damage."]]);
function raidWorld(roster){
  const W = SIM.create(), dragon = W.mobs.find(m => m.kind === "dragon");
  const heroes = roster.map(([side, d], k) => {
    const h = SIM.addHero(W, side, d()); h.lvl = 15;
    for(const slot of ["head", "chest", "hands", "legs", "feet", "weapon"]) h.equip[slot] = G.genItem({ ilvl: 15, rarity: 3, cls: h.kit.cls, slot, nid: 5000 + k * 10 + slot.length });
    SIM.recalc(h); h.hp = h.maxHp; h.x = G.LAIR.x + 300 * (k - 1); h.y = G.LAIR.y - 1250;
    SIM.addItem(h, { id: "pot" + k, n: "Health Potion", s: "use", key: "hpot", r: 0, q: 10, v: 6, stack: true });
    return h;
  });
  return { W, dragon, heroes };
}
// a scripted player: dodge telegraphs, drink potions, and play their role
function raidBrain(W, dragon, heroes){
  const [tank, healer, dps] = heroes, foe = h => W.mobs.filter(m => !m.dead && m.kind === "whelp").sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
  const castAll = (h, t, skip = []) => { for(const k of ["Q", "W", "E", "R"]) if(!skip.includes(h.kit[k].type)) SIM.input(W, h.side, { cast: k, at: [t.x, t.y] }); };
  return () => {
    for(const h of heroes){
      if(h.dead) continue;
      if(h.hp < h.maxHp * .35) SIM.input(W, h.side, { potion: 1 });
      const cs = dragon.cast;
      if(cs && G.SIM.inCone(dragon, h, cs.dx, cs.dy, cs.kind === "breath" ? G.RAID.breath.range + 80 : dragon.r + G.RAID.tail.reach + 80, (cs.kind === "breath" ? G.RAID.breath.angle : G.RAID.tail.angle) + 30)){
        const px = -cs.dy, py = cs.dx, side = (h.x - dragon.x) * px + (h.y - dragon.y) * py >= 0 ? 1 : -1;
        SIM.input(W, h.side, { move: [h.x + px * side * 600, h.y + py * side * 600] }); continue;   // step out sideways
      }
      if(h === tank){ SIM.input(W, h.side, { atk: dragon.id }); castAll(h, dragon, ["shield", "heal"]); continue; }
      if(h === healer){
        const hurt = heroes.filter(x => !x.dead).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        const heal = ["Q", "W", "E", "R"].find(k => h.kit[k].type === "heal"), shield = ["Q", "W", "E", "R"].find(k => h.kit[k].type === "shield");
        if(heal && hurt.hp < hurt.maxHp * .8) SIM.input(W, h.side, { cast: heal, at: [hurt.x, hurt.y] });
        if(shield) SIM.input(W, h.side, { cast: shield, at: [tank.x, tank.y] });
      }
      // damage dealers (and the healer when nobody needs healing) attack from the side, whelps first
      const w = foe(h), t = w && Math.hypot(w.x - h.x, w.y - h.y) < 1500 ? w : dragon;
      if(t === dragon){
        const fx = Math.sin(dragon.face), fy = Math.cos(dragon.face), sx = h === dps ? 1 : -1, want = [dragon.x - fy * sx * (dragon.r + 380), dragon.y + fx * sx * (dragon.r + 380)];
        if(Math.hypot(h.x - want[0], h.y - want[1]) > 250){ SIM.input(W, h.side, { move: want }); continue; }
      }
      SIM.input(W, h.side, { atk: t.id }); castAll(h, t, ["shield", "heal"]);
    }
  };
}

test("raid: a party of three (tank, healer, damage) can kill Skarnvir and gets Legendary loot", () => {
  const { W, dragon, heroes } = raidWorld([["blue", GAREN_LIKE], ["red", HEALER], ["green", ARCHER]]);
  const [tank] = heroes;
  for(const h of heroes.slice(1)){ SIM.input(W, "blue", { pinvite: h.side }); SIM.input(W, h.side, { paccept: "blue" }); }
  assert.ok(heroes.every(h => h.party && h.party === tank.party));
  for(const h of heroes){ h.quests.rimewyrm = { state: "active", count: 0, flags: [] }; }
  const brain = raidBrain(W, dragon, heroes), fx = [];
  // the tank pulls
  tank.x = dragon.x; tank.y = dragon.y - 1000; SIM.input(W, "blue", { atk: dragon.id });
  let t = 0, deaths = 0;
  for(; t < 600 * 60 && !dragon.dead; t++){
    if(t % 15 === 0) brain();
    for(const r of W.rolls) for(const h of heroes) SIM.input(W, h.side, { roll: r.id, pick: "need" });
    SIM.step(W, 1 / 60);
    for(const f of W.fxNet){ fx.push(f.k); if(f.k === "died") deaths++; }
    W.fxNet.length = W.fxLocal.length = 0;
  }
  console.log(`# raid: ${dragon.dead ? "killed" : "NOT killed"} in ${Math.round(t / 60)}s, ${deaths} deaths, dragon hp ${Math.round(dragon.hp)}`);
  assert.ok(dragon.dead, "Skarnvir dies");
  assert.ok(fx.includes("warn") && fx.includes("bossmsg"), "telegraphs and boss messages happened");
  assert.ok(heroes.every(h => h.quests.rimewyrm.state === "ready"), "everyone in the party gets quest credit");
  for(let k = 0; k < 120; k++){ for(const r of W.rolls) for(const h of heroes) SIM.input(W, h.side, { roll: r.id, pick: "need" }); SIM.step(W, 1 / 60); }
  const legendaries = heroes.flatMap(h => [...h.inv, ...W.loot.filter(l => l.side === h.side).flatMap(l => l.items || [])]).filter(it => it.r === 4);
  assert.equal(legendaries.length, 2, "two Legendary items were rolled for and handed out");
  // (a player standing on their bag picks it up automatically, so check bags and bags' contents in inventories)
  assert.ok(heroes.every(h => h.inv.some(it => it.r === 3 && it.il === G.LOOT.dragon.ilvl) || W.loot.some(l => l.side === h.side && l.items && l.items.some(it => it.r === 3))), "everyone gets their own Epic");
});

test("raid: Skarnvir can't be soloed", () => {
  const { W, dragon, heroes } = raidWorld([["blue", GAREN_LIKE]]);
  const [h] = heroes; h.x = dragon.x; h.y = dragon.y - 700;
  for(let t = 0; t < 90 * 60; t++){
    if(t % 15 === 0 && !h.dead){ SIM.input(W, "blue", { atk: dragon.id }); for(const k of ["Q", "W", "E", "R"]) SIM.input(W, "blue", { cast: k, at: [dragon.x, dragon.y] }); if(h.hp < h.maxHp * .35) SIM.input(W, "blue", { potion: 1 }); }
    SIM.step(W, 1 / 60); W.fxNet.length = W.fxLocal.length = 0;
  }
  assert.ok(!dragon.dead && dragon.hp > dragon.maxHp * .9, `dragon at ${Math.round(dragon.hp / dragon.maxHp * 100)}% after 90s alone`);
});

test("raid: party members who died and respawned during the fight still share the kill", () => {
  const { W, dragon, heroes } = raidWorld([["blue", GAREN_LIKE], ["red", HEALER], ["green", ARCHER]]);
  const [a, b, c] = heroes;
  for(const h of [b, c]){ SIM.input(W, "blue", { pinvite: h.side }); SIM.input(W, h.side, { paccept: "blue" }); }
  for(const h of heroes) h.quests.rimewyrm = { state: "active", count: 0, flags: [] };
  for(const h of heroes){ h.x = dragon.x; h.y = dragon.y - 700; }
  SIM.damage(W, dragon, 100, a); SIM.damage(W, dragon, 100, c);   // c fought...
  c.x = G.OUTPOST.x; c.y = G.OUTPOST.y;                             // ...then died and respawned far away
  dragon.hp = 1; SIM.damage(W, dragon, 1e9, a);
  assert.ok(dragon.dead);
  for(const h of heroes) assert.equal(h.quests.rimewyrm.state, "ready", `${h.side} gets quest credit`);
  assert.ok(W.loot.some(l => l.side === c.side && l.items.some(it => it.r === 3)), "the respawned member still gets their Epic");
});

test("index.html links carry up-to-date version codes (run: node scripts/stamp.mjs)", async () => {
  const fs = await import("node:fs"), { stamped, root } = await import("../scripts/stamp.mjs");
  const html = fs.readFileSync(root + "/index.html", "utf8");
  assert.ok(/src="src\/js\/00-core\.js\?v=[0-9a-f]{10}"/.test(html), "links are stamped");
  assert.equal(stamped(html), html, "a file in src/ changed since index.html was stamped: run node scripts/stamp.mjs");
});

/* ---------- PvP duels ---------- */
function duelWorld(){
  const W = SIM.create(), a = SIM.addHero(W, "blue", GAREN_LIKE()), b = SIM.addHero(W, "red", GAREN_LIKE()), c = SIM.addHero(W, "green", GAREN_LIKE());
  a.name = "Alice"; b.name = "Bob"; c.name = "Cat";
  for(const [h, dx] of [[a, -200], [b, 200], [c, 0]]){ h.x = 2400 + dx; h.y = 2000; }  // an empty field south-west of the village
  const fx = [], step = secs => { for(let i = 0; i < secs * 60; i++){ SIM.step(W, 1 / 60); fx.push(...W.fxNet); W.fxNet.length = W.fxLocal.length = 0; } };
  return { W, a, b, c, fx, step };
}

test("duel: challenge, accept, a 5-second countdown, then the two can fight", () => {
  const { W, a, b, c, fx, step } = duelWorld();
  SIM.input(W, "blue", { duel: "red" });
  assert.ok(W.duelReqs.length === 1 && fx.length === 0 && W.fxNet.some(f => f.k === "duelreq" && f.to[0] === "red"));
  SIM.input(W, "red", { duelaccept: "blue" });
  const d = W.duels[0];
  assert.ok(d && a.duel === d && b.duel === d && d.state === "count", "a duel with a flag between them");
  assert.ok(Math.abs(d.x - (a.x + b.x) / 2) < 1 && Math.abs(d.y - (a.y + b.y) / 2) < 1);
  // during the countdown nobody can be hit
  assert.ok(!SIM.hostile(a, b) && !SIM.enemies(W, a).includes(b));
  step(2.5);
  assert.deepEqual(fx.filter(f => f.k === "duelcount").map(f => f.n), [5, 4, 3], "counts down 5, 4, 3…");
  step(3);
  assert.deepEqual(fx.filter(f => f.k === "duelcount").map(f => f.n), [5, 4, 3, 2, 1, 0], "…2, 1, Fight!");
  assert.ok(d.state === "fight" && SIM.hostile(a, b) && SIM.hostile(b, a));
  assert.ok(!SIM.hostile(a, c) && !SIM.hostile(c, b), "players outside the duel stay safe");
  // area abilities hit the opponent but never a bystander
  const hpB = b.hp, hpC = c.hp; c.x = a.x + 100; b.x = a.x + 150; b.y = c.y = a.y;
  SIM.burst(W, a, a.x, a.y, 400, { dmg: 50, cc: {} });
  assert.ok(b.hp < hpB && c.hp === hpC);
  // heals can't go to your opponent (with nobody else near the cursor, they come back to you)
  c.x = a.x - 3000; assert.equal(SIM.supportTarget(W, a, [b.x, b.y]), a);
});

test("duel: the loser is left at 1 health, the winner is announced, and the fighting stops", () => {
  const { W, a, b, fx, step } = duelWorld();
  SIM.input(W, "blue", { duel: "red" }); SIM.input(W, "red", { duelaccept: "blue" }); step(5.2);
  SIM.input(W, "blue", { atk: b.id }); assert.equal(a.target, b.id, "you can target your opponent");
  SIM.damage(W, b, 1e6, a);
  assert.ok(!b.dead && b.hp === 1, "nobody dies in a duel");
  assert.ok(!W.duels.length && !a.duel && !b.duel && a.target === null);
  assert.ok(fx.concat(W.fxNet).some(f => f.k === "duelend" && f.win === "blue"));
  assert.ok(W.fxNet.some(f => f.k === "sys" && /Alice has defeated Bob in a duel/.test(f.text)));
  assert.ok(!SIM.hostile(a, b), "after the duel they're allies again");
  const hp = b.hp; SIM.burst(W, a, b.x, b.y, 300, { dmg: 50, cc: {} }); assert.equal(b.hp, hp);
});

test("duel: leaving the area forfeits; declines, timeouts and bad input are handled", () => {
  const { W, a, b, c, step } = duelWorld();
  SIM.input(W, "blue", { duel: "red" }); SIM.input(W, "red", { duelaccept: "blue" }); step(5.2);
  const d = W.duels[0]; b.x = d.x + d.r + 300; b.move = null;
  step(2); assert.ok(W.duels.length === 1, "a few seconds' grace outside the area");
  step(G.DUEL.outGrace); assert.ok(!W.duels.length && !b.duel, "stayed out: forfeited");
  // decline
  SIM.input(W, "blue", { duel: "green" }); SIM.input(W, "green", { dueldecline: "blue" });
  assert.ok(!W.duelReqs.length && !W.duels.length);
  // a challenge times out
  SIM.input(W, "blue", { duel: "green" }); step(G.DUEL.askTime + 1); assert.ok(!W.duelReqs.length);
  // too far away, yourself, nonsense
  c.x = a.x + 5000; SIM.input(W, "blue", { duel: "green" }); assert.ok(!W.duelReqs.length, "too far away");
  for(const bad of [{ duel: "blue" }, { duel: "__proto__" }, { duelaccept: "constructor" }, { dueldecline: "x" }, { duel: null }]) SIM.input(W, "blue", bad);
  SIM.input(W, "__proto__", { duel: "red" });
  assert.ok(!W.duelReqs.length && !W.duels.length);
  // a disconnect cancels a duel
  SIM.input(W, "blue", { duel: "red" }); SIM.input(W, "red", { duelaccept: "blue" }); SIM.removeHero(W, "red"); step(.1);
  assert.ok(!W.duels.length && !a.duel);
});

/* ---------- Arena: practice duels against a computer champion ---------- */
const MAGE = () => champ("Mage", 550, ["Mage"], [["Spark", "Fires a bolt that deals damage."], ["Ward", "Gains a shield."], ["Flicker", "Blinks a short distance."], ["Meteor", "Calls down a blast in an area, dealing damage."]]);
function arenaWorld(lvl = 8){
  const W = SIM.create(), p = SIM.addHero(W, "blue", GAREN_LIKE()), vex = G.NPCS.find(n => n.arena);
  p.lvl = lvl; for(const sl of ["head", "chest", "hands", "legs", "feet", "weapon"]) p.equip[sl] = G.genItem({ ilvl: lvl + 1, rarity: 2, cls: "melee", slot: sl, nid: 7000 + sl.length });
  SIM.recalc(p); p.hp = p.maxHp; p.x = vex.x + 120; p.y = vex.y;
  const fx = [], step = (secs, each) => { for(let i = 0; i < secs * 60; i++){ if(each) each(i); SIM.step(W, 1 / 60); fx.push(...W.fxNet); W.fxNet.length = W.fxLocal.length = 0; } };
  return { W, p, vex, fx, step };
}

test("arena: talk to Vex, a computer champion of your level enters the ring, and the duel counts down", () => {
  const { W, p, vex, fx, step } = arenaWorld();
  SIM.input(W, "blue", { talk: "vex" }); step(1);
  assert.ok(fx.some(f => f.k === "arena" && f.npc === "vex"), "talking opens the arena");
  p.x = vex.x + 3000; SIM.input(W, "blue", { arena: 1 }); assert.equal(W.arenaReqs.length, 0, "you must be at Vex");
  p.x = vex.x + 120; SIM.input(W, "blue", { arena: 1 }); SIM.input(W, "blue", { arena: 1 });
  assert.equal(W.arenaReqs.length, 1, "one request at a time");
  W.arenaReqs.shift();
  const b = SIM.arenaStart(W, "blue", MAGE(), 7);
  assert.ok(b && b.bot && b.lvl === p.lvl && Object.keys(b.equip).length === 6, "same level, geared");
  assert.ok(b.skill.diff === 7 && b.duel.diff === 7);
  assert.ok(p.duel && p.duel === b.duel && p.duel.arena && p.duel.state === "count");
  assert.equal(G.SIM.hero(W, b.side), null, "nobody can send commands as the computer champion");
  assert.ok(Math.hypot(p.x - G.ARENA.x, p.y - G.ARENA.y) < G.ARENA.r * .6, "you're placed inside the ring");
  step(5.5); assert.equal(p.duel.state, "fight");
  const snap = SIM.snapshot(W); assert.ok(snap.h.some(h => h.side === b.side && h.bot === 1));
});

test("arena: the computer champion dodges most skillshots", () => {
  const { W, p, step } = arenaWorld(10);
  SIM.arenaStart(W, "blue", GAREN_LIKE(), 10); const b = W.heroes[Object.keys(W.heroes).find(s => s !== "blue")];
  step(5.5);
  let fired = 0, hits = 0;
  for(let k = 0; k < 30 && p.duel; k++){
    b.hp = b.maxHp; p.hp = p.maxHp; b.potions = 0;
    b.x = G.ARENA.x + 100; b.y = G.ARENA.y; p.x = b.x - 650; p.y = b.y; b.target = null; b.move = null;   // both well inside the ring
    const before = b.hp;
    W.shots.push({ id: "s" + W.nid++, kind: "sk", slot: "Q", team: p.team, owner: p.id, x: p.x + 60, y: p.y, vx: 1400, vy: 0, life: 1, r: 60, p: { dmg: 80, cc: {} }, hits: new Set() });
    fired++; step(1); if(b.hp < before - 20) hits++;
  }
  console.log(`# computer champion was hit by ${hits} of ${fired} skillshots`);
  assert.ok(fired >= 20 && hits <= fired * .4, `dodged most (${hits}/${fired} hit)`);
});

function arenaSeries(diff){
  let botWins = 0, fights = 0;
  for(let n = 0; n < 10; n++){ const opp = n % 2 ? GAREN_LIKE : MAGE;
    const { W, p, fx, step } = arenaWorld(10);
    const b = SIM.arenaStart(W, "blue", opp(), diff);
    // an average player: walks in, attacks, spams abilities at the opponent, never dodges
    step(120, i => { if(i % 20 || !p.duel || p.duel.state !== "fight") return; SIM.input(W, "blue", { atk: b.id }); for(const k of ["Q", "W", "E", "R"]) SIM.input(W, "blue", { cast: k, at: [b.x, b.y] }); });
    const end = fx.find(f => f.k === "duelend");
    if(end){ fights++; if(end.win === b.side) botWins++; }
  }
  return { botWins, fights };
}
test("arena: at difficulty 10 the computer champion beats an average player most of the time", () => {
  const { botWins, fights } = arenaSeries(10);
  console.log(`# difficulty 10: computer champion won ${botWins} of ${fights} duels`);
  assert.ok(fights >= 7 && botWins >= fights * .5, `skilled: won ${botWins}/${fights}`);
});

test("arena: at difficulty 1 an average player usually wins", () => {
  const { botWins, fights } = arenaSeries(1);
  console.log(`# difficulty 1: computer champion won ${botWins} of ${fights} duels`);
  assert.ok(fights >= 7 && botWins <= fights * .3, `easy: won ${botWins}/${fights}`);
});

test("arena: every setting gets easier as difficulty goes down; bad input is clamped", () => {
  for(let d = 2; d <= 10; d++){
    const lo = G.arenaSkill(d - 1), hi = G.arenaSkill(d);
    assert.ok(hi.dodge > lo.dodge && hi.dmg > lo.dmg && hi.hp >= lo.hp && hi.react[0] < lo.react[0] && hi.aim > lo.aim && hi.potions >= lo.potions && hi.rarity >= lo.rarity, `difficulty ${d}`);
  }
  for(const [bad, want] of [[0, 1], [99, 10], ["x", 5], [null, 5], [3.4, 3]]) assert.equal(G.arenaSkill(bad).diff, want);
  const { W, p, vex } = arenaWorld(6);
  p.x = vex.x + 100; SIM.input(W, "blue", { arena: 1, diff: "__proto__" }); assert.equal(W.arenaReqs[0].diff, 5);
});

test("arena: winning pays coins and counts, losing leaves you at 1 health, and the opponent leaves", () => {
  const { W, p, fx, step } = arenaWorld(6);
  const b = SIM.arenaStart(W, "blue", MAGE(), 4); step(5.5);
  const coins = p.coins; b.hp = 5; SIM.damage(W, b, 1e6, p);
  assert.ok(!b.dead && b.hp === 1 && !p.duel);
  assert.ok(p.coins === coins + Math.round(1.5 * 4 * p.lvl) && p.arenaWins === 1 && p.arenaBest === 4, "a win pays by difficulty and counts");
  step(3); assert.ok(!W.heroes[b.side], "the opponent leaves the ring");
  const b2 = SIM.arenaStart(W, "blue", MAGE(), 7); step(5.5);
  SIM.damage(W, p, 1e6, b2);
  assert.ok(!p.dead && p.hp === 1 && p.arenaWins === 1, "losing: still alive, no win counted");
  step(3); assert.ok(!W.heroes[b2.side]);
});
