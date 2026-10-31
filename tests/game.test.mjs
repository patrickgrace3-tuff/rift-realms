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
    const n = W.nodes.filter(n => n.ready && n.kind === "herb").sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
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
  for(let k = 0; k < 60 && p.duel; k++){
    b.hp = b.maxHp; p.hp = p.maxHp; b.potions = 0;
    b.x = G.ARENA.x + 100; b.y = G.ARENA.y; p.x = b.x - 650; p.y = b.y; b.target = null; b.move = null;   // both well inside the ring
    const before = b.hp;
    W.shots.push({ id: "s" + W.nid++, kind: "sk", slot: "Q", team: p.team, owner: p.id, x: p.x + 60, y: p.y, vx: 1400, vy: 0, life: 1, r: 60, p: { dmg: 80, cc: {} }, hits: new Set() });
    fired++; step(1); if(b.hp < before - 20) hits++;
  }
  console.log(`# computer champion was hit by ${hits} of ${fired} skillshots`);
  assert.ok(fired >= 40 && hits <= fired * .45, `dodged most (${hits}/${fired} hit)`);
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

/* ---------- Hired raid party (Scout Yrsa) ---------- */
const TANKY = () => champ("Tanky", 175, ["Tank"], [["Bash", "Strikes, dealing damage and stunning."], ["Bulwark", "Gains a shield."], ["Charge", "Dashes forward, dealing damage."], ["Quake", "Slams the ground, dealing damage in an area."]]);
function hireWorld(d = ARCHER){
  const { W, dragon, heroes } = raidWorld([["blue", d]]), [h] = heroes, yrsa = G.NPCS.find(n => n.mercs);
  h.quests.rimewyrm = { state: "active", count: 0, flags: [] }; h.coins = 10000; h.x = yrsa.x + 100; h.y = yrsa.y;
  return { W, dragon, h, yrsa };
}
function hireNow(W, h){
  SIM.input(W, h.side, { hire: 1 });
  const req = W.mercReqs.shift(); if(!req) return [];
  const pick = { tank: TANKY, healer: HEALER, dps: MAGE };
  return SIM.mercDone(W, h.side, req.roles.map(r => [r, pick[r]()]));
}

test("hired party: roles come from tags and abilities, and the plan fills a party with a tank, a healer and damage", () => {
  const W = SIM.create();
  const roleOf = d => G.heroRole(SIM.addHero(W, "blue", d()));
  assert.equal(roleOf(TANKY), "tank"); assert.equal(roleOf(HEALER), "healer"); assert.equal(roleOf(ARCHER), "dps");
  assert.deepEqual([...G.mercPlan(["dps"])], ["tank", "healer", "dps", "dps"]);
  assert.deepEqual([...G.mercPlan(["tank"])], ["healer", "dps", "dps", "dps"]);
  assert.deepEqual([...G.mercPlan(["healer", "dps"])], ["tank", "dps", "dps"]);
  assert.deepEqual([...G.mercPlan(["tank", "healer", "dps", "dps", "dps"])], []);
});

test("hired party: only from Yrsa, only during the Skarnvir hunt, paid for, and only once", () => {
  const { W, h, yrsa } = hireWorld();
  const was = h.quests.rimewyrm; delete h.quests.rimewyrm; SIM.input(W, "blue", { hire: 1 }); assert.equal(W.mercReqs.length, 0, "not before you've taken the hunt");
  h.quests.rimewyrm = was;
  h.x = yrsa.x + 2000; SIM.input(W, "blue", { hire: 1 }); assert.equal(W.mercReqs.length, 0, "not from far away");
  h.x = yrsa.x + 100; h.coins = 5; SIM.input(W, "blue", { hire: 1 }); assert.equal(W.mercReqs.length, 0, "not without the coins");
  h.coins = 10000;
  const mercs = hireNow(W, h);
  assert.equal(mercs.length, 4); assert.equal(h.coins, 10000 - 4 * G.MERCS.price * h.lvl, "paid per champion");
  assert.deepEqual([...mercs.map(m => m.merc.role).sort()], ["dps", "dps", "healer", "tank"]);
  const p = SIM.party(W, h); assert.ok(p && p.leader === "blue" && p.members.length === 5, "they join your party");
  assert.ok(mercs.every(m => m.bot && m.lvl === h.lvl && !SIM.hero(W, m.side)), "computer-controlled, at your level, can't be commanded");
  SIM.input(W, "blue", { hire: 1 }); assert.equal(W.mercReqs.length, 0, "only one hired party at a time");
  // if champions can't be found, you get your coins back
  const b = hireWorld(), coins = b.h.coins; SIM.input(b.W, "blue", { hire: 1 }); b.W.mercReqs.shift(); SIM.mercDone(b.W, "blue", []);
  assert.equal(b.h.coins, coins);
  // sending one home, or leaving the party, makes them leave
  SIM.input(W, "blue", { pkick: mercs[0].side }); for(let i = 0; i < 15; i++) SIM.step(W, 1 / 30);
  assert.ok(!W.heroes[mercs[0].side], "a kicked merc goes home");
  SIM.input(W, "blue", { pleave: 1 }); for(let i = 0; i < 30; i++) SIM.step(W, 1 / 30);
  assert.ok(mercs.every(m => !W.heroes[m.side]), "leaving the party sends them all home");
});

test("hired party: a lone player with a hired party kills Skarnvir; the hired champions take no loot and stay on", () => {
  const { W, dragon, h } = hireWorld();
  const mercs = hireNow(W, h);
  h.x = dragon.x + 200; h.y = dragon.y - 1250;
  for(let i = 0; i < 120; i++){ SIM.step(W, 1 / 30); }   // they catch up
  assert.ok(mercs.every(m => Math.hypot(m.x - h.x, m.y - h.y) < 800), "they follow you");
  const tank = mercs.find(m => m.merc.role === "tank"), brain = raidBrain(W, dragon, [tank, mercs.find(m => m.merc.role === "healer"), h]);
  h.x = dragon.x + 300; h.y = dragon.y - 1100; SIM.input(W, "blue", { atk: dragon.id });
  let t = 0, deaths = 0;
  for(; t < 600 * 60 && !dragon.dead; t++){
    if(t % 15 === 0) brain();
    for(const r of W.rolls) SIM.input(W, "blue", { roll: r.id, pick: "need" });
    SIM.step(W, 1 / 60);
    for(const f of W.fxNet) if(f.k === "died") deaths++;
    W.fxNet.length = W.fxLocal.length = 0;
  }
  console.log(`# hired raid: ${dragon.dead ? "killed" : "NOT killed"} in ${Math.round(t / 60)}s, ${deaths} deaths, dragon hp ${Math.round(dragon.hp)}`);
  assert.ok(dragon.dead, "Skarnvir dies");
  assert.equal(h.quests.rimewyrm.state, "ready");
  for(let k = 0; k < 60 * 8; k++){ for(const r of W.rolls) SIM.input(W, "blue", { roll: r.id, pick: "need" }); SIM.step(W, 1 / 60); }
  assert.ok(mercs.every(m => W.heroes[m.side]), "the hired party stays for the Ashen Cathedral");
  assert.ok(W.riftOpen > W.t, "and the Rift is open");
  const mine = [...h.inv, ...W.loot.filter(l => l.side === "blue").flatMap(l => l.items || [])];
  assert.ok(mine.filter(it => it.r === 4).length >= 1, "the player gets the Legendary loot");
  assert.ok(W.loot.every(l => l.side === "blue" || !l.side), "no loot bags for hired champions");
});

/* ---------- The Ashen Cathedral (dungeon) ---------- */
function cathedralHero(W, side, d, lvl = 16, rarity = 3){
  const h = SIM.addHero(W, side, d()); h.lvl = lvl;
  for(const slot of G.EQ_SLOTS) h.equip[slot] = G.genItem({ ilvl: lvl, rarity, cls: h.kit.cls, slot, nid: 7000 + slot.length + side.length * 10 });
  SIM.recalc(h); h.hp = h.maxHp;
  SIM.addItem(h, { id: "pot" + side, n: "Health Potion", s: "use", key: "hpot", r: 0, q: 15, v: 6, stack: true });
  return h;
}
const runFor = (W, secs, each) => { for(let i = 0; i < secs * 30; i++){ if(each) each(i); SIM.step(W, 1 / 30); W.fxNet.length = W.fxLocal.length = 0; } };

test("cathedral: walls keep you in, the choir is sealed, and the Peaks don't lead there", () => {
  const W = SIM.create(), h = cathedralHero(W, "blue", ARCHER);
  for(const m of W.mobs) if(m.spawnId) m.dead = true;
  h.x = 4000; h.y = 15000; SIM.input(W, "blue", { move: [4000, 23000] }); runFor(W, 8);
  assert.ok(h.y <= G.WH, "walking north in the Peaks stops at the mountains");
  h.x = 4000; h.y = 18150; SIM.input(W, "blue", { move: [800, 18150] }); runFor(W, 6);
  assert.ok(h.x >= G.CATHEDRAL.narthex[0], `the narthex wall stops you (x ${Math.round(h.x)})`);
  SIM.input(W, "blue", { move: [4000, 23100] }); runFor(W, 25);
  assert.ok(h.y < G.CATHEDRAL.door, `the seal stops you at the choir (y ${Math.round(h.y)})`);
  W.dungeon.sealed = false; runFor(W, 6);
  assert.ok(h.y > G.CATHEDRAL.door + 200, "once it's broken you can walk in");
  SIM.input(W, "blue", { move: [1300, 22000] }); runFor(W, 15);
  assert.ok(Math.hypot(h.x - 1300, h.y - 22000) < 200, "the west chapel can be reached through the transept");
});

test("cathedral: Skarnvir's death opens the Rift, which takes your whole party in; hired champions stay", () => {
  const { W, dragon, heroes } = raidWorld([["blue", GAREN_LIKE], ["red", HEALER]]);
  const [a, b] = heroes, out = SIM.addHero(W, "green", ARCHER());
  SIM.input(W, "blue", { pinvite: "red" }); SIM.input(W, "red", { paccept: "blue" });
  a.quests.rimewyrm = b.quests.rimewyrm = { state: "active", count: 0, flags: [] }; a.coins = 99999;
  // before the kill the Rift is sealed
  a.x = G.RIFT.x; a.y = G.RIFT.y; SIM.step(W, 1 / 30);
  assert.ok(a.y < G.DZ, "the Rift is sealed while Skarnvir lives");
  // hire a party at Yrsa: it fills the party to five
  const yrsa = G.NPCS.find(n => n.id === "yrsa"); a.x = yrsa.x + 100; a.y = yrsa.y;
  SIM.input(W, "blue", { hire: 1 }); const req = W.mercReqs.shift();
  const mercs = SIM.mercDone(W, "blue", req.roles.map(r => [r, { tank: TANKY, healer: HEALER, dps: MAGE }[r]()]));
  assert.equal(SIM.partyMembers(W, a).length, 5);
  for(const h of [a, b, ...mercs]){ h.x = dragon.x + 200; h.y = dragon.y - 800; }
  out.x = dragon.x - 400; out.y = dragon.y - 900;
  SIM.damage(W, dragon, 100, a); dragon.hp = 1; SIM.damage(W, dragon, 1e9, a);
  assert.ok(dragon.dead && W.riftOpen > W.t, "the Rift opens");
  runFor(W, 10);
  assert.ok(mercs.every(m => W.heroes[m.side]), "the hired party doesn't leave after Skarnvir");
  // step in: the whole party goes, the stranger doesn't
  a.x = G.RIFT.x + 20; a.y = G.RIFT.y; runFor(W, .2);
  assert.ok([a, b, ...mercs].every(h => h.y > G.DZ), "everyone in the party is in the cathedral");
  assert.ok(out.y < G.DZ, "someone outside the party stays behind");
  assert.ok(Math.hypot(a.x - G.CATHEDRAL.arrive[0], a.y - G.CATHEDRAL.arrive[1]) < 400, "you arrive in the narthex");
  // the way out leads back to Yrsa's Watch, hired champions in tow
  runFor(W, 4); a.x = G.CATHEDRAL.exit.x; a.y = G.CATHEDRAL.exit.y; runFor(W, .2);
  assert.ok(a.y < G.DZ && Math.hypot(a.x - G.YRSA_CAMP.x, a.y - G.YRSA_CAMP.y) < 900, "the exit leads to Yrsa's Watch");
  assert.ok(mercs.every(m => m.y < G.DZ), "your hired champions come out with you");
  assert.ok(b.y > G.DZ, "other players stay inside until they leave");
  // later, a Skarnvir slayer can always use the Rift
  W.riftOpen = 0; a.quests.rimewyrm.state = "done"; runFor(W, 4); a.x = G.RIFT.x; a.y = G.RIFT.y; runFor(W, .2);
  assert.ok(a.y > G.DZ, "the Rift stays open for whoever killed Skarnvir");
});

test("cathedral: packs pull together; acolytes shoot from range and heal their allies", () => {
  const W = SIM.create(), h = cathedralHero(W, "blue", ARCHER);
  const packA = W.mobs.filter(m => m.pack === "A"), acolyte = packA.find(m => m.kind === "acolyte"), monk = packA.find(m => m.kind === "monk");
  h.x = 4000; h.y = 18300; SIM.damage(W, monk, 10, h);
  assert.ok(packA.every(m => m.aggro === h.id), "hitting one pulls the whole pack");
  assert.ok(W.mobs.filter(m => m.pack === "B").every(m => !m.aggro), "other packs stay put");
  monk.hp = monk.maxHp * .4; const before = monk.hp, hp0 = h.hp; let shots = 0;
  runFor(W, 6, () => { shots = Math.max(shots, W.mshots.length); h.x = 4000; h.y = 18300; h.hp = Math.max(h.hp, 500); });
  assert.ok(monk.hp > before, "the acolyte healed the monk");
  assert.ok(shots > 0 && Math.hypot(acolyte.x - h.x, acolyte.y - h.y) > 300, "the acolyte casts firebolts from range");
});

test("cathedral: boss mechanics (sweep, palm of silence, the sealed Saint, his choir and the Radiant Nova)", () => {
  const W = SIM.create(), a = cathedralHero(W, "blue", GAREN_LIKE), b = cathedralHero(W, "red", HEALER), c = cathedralHero(W, "green", ARCHER);
  for(const h of [b, c]){ SIM.input(W, "blue", { pinvite: h.side }); SIM.input(W, h.side, { paccept: "blue" }); }
  for(const m of W.mobs) if(m.pack) m.dead = true;
  const boss = k => W.mobs.find(m => m.kind === k && !m.dead), dz = W => { for(let i = 0; i < 90; i++){ SIM.step(W, 1 / 30); } W.fxNet.length = W.fxLocal.length = 0; };
  // Deacon Varrow: the censer sweep hits those close to him, not those far away
  const dea = boss("deacon"); a.x = dea.x + 200; a.y = dea.y; c.x = dea.x + 900; c.y = dea.y; b.x = dea.x + 1000; b.y = dea.y + 200;
  SIM.damage(W, dea, 100, a); dea.cds.sweep = 0; dea.cds.incense = 99; dea.cds.embers = 99;
  const ha = a.hp, hc = c.hp; for(let i = 0; i < 70; i++){ SIM.step(W, 1 / 30); a.x = dea.x + 200; a.y = dea.y; c.x = dea.x + 900; c.y = dea.y; a.hp = Math.max(a.hp, 1500); }
  assert.ok(a.hp < ha - 300 && c.hp >= hc - 50, "the sweep hit the close hero only");
  dea.dead = true; W.mobs = W.mobs.filter(m => !m.dead); W.dangers = [];
  // Abbess Ysolde: her palm silences, and a silenced hero can't cast
  const ab = boss("abbess"); a.x = ab.x + 200; a.y = ab.y; b.x = ab.x - 800; c.x = ab.x - 900; b.y = c.y = ab.y;
  SIM.damage(W, ab, 100, a); ab.cds.palm = 0; ab.cds.kick = 99; ab.cds.fire = 99;
  for(let i = 0; i < 60; i++){ SIM.step(W, 1 / 30); a.x = ab.x + 200; a.y = ab.y; a.hp = Math.max(a.hp, 1500); }
  assert.ok(a.silenceT > W.t, "Palm of Silence silences");
  a.cds.Q = 0; SIM.input(W, "blue", { cast: "Q", at: [ab.x, ab.y] }); assert.equal(a.cds.Q, 0, "no casting while silenced");
  ab.dead = true; W.mobs = W.mobs.filter(m => !m.dead); W.dangers = [];
  // Archprelate Malchar: untouchable while sealed
  const st = boss("saint"); a.x = 4000; a.y = 22500; SIM.step(W, 1 / 30);
  assert.equal(SIM.damage(W, st, 500, a), 0, "the Saint can't be hurt through the seal");
  W.dungeon.sealed = false; SIM.step(W, 1 / 30);
  for(const h of [a, b, c]){ h.x = st.x + (h === a ? 150 : 0); h.y = st.y - (h === a ? 0 : 600); }
  SIM.damage(W, st, 500, a); assert.ok(st.aggro, "he wakes once the seals are broken");
  // phase 2: below 70% his choir shields him until it dies
  st.hp = st.maxHp * .69; SIM.step(W, 1 / 30);
  assert.ok(st.immune, "the choir shields him");
  const adds = W.mobs.filter(m => m.event === "dboss:" + st.id); assert.equal(adds.length, 4, "four choir adds");
  for(const m of adds) m.dead = true; SIM.step(W, 1 / 30);
  assert.ok(!st.immune && st.exposedT > W.t, "with the choir dead he's exposed");
  // phase 3: the Radiant Nova hurts everyone except those close to him
  st.hp = st.maxHp * .39; W.dangers = []; W.hazards = []; st.cast = null; SIM.step(W, 1 / 30);
  st.cds.nova = 0; st.cds.pillar = 99; st.cds.sermon = 99; st.cds.judgment = 99; st.cast = null;
  for(let i = 0; i < 6; i++) SIM.step(W, 1 / 30);
  const nova = W.dangers.find(d => d.name === "Radiant Nova"); assert.ok(nova, "he calls the Radiant Nova");
  const near = { x: st.x + 200, y: st.y, r: 55 }, far = { x: st.x + 900, y: st.y, r: 55 };
  assert.ok(!SIM.inDanger(nova, near) && SIM.inDanger(nova, far), "only his shadow is safe");
  const to = SIM.dangerEscape(W, far); assert.ok(Math.hypot(to[0] - st.x, to[1] - st.y) < 420, "and the escape is towards him");
});

test("cathedral: a player and a hired party clear it; Epics from every boss, a Legendary from the Saint, then the party leaves", () => {
  const W = SIM.create(), h = cathedralHero(W, "blue", ARCHER), el = G.NPCS.find(n => n.id === "elowen");
  h.quests.rimewyrm = { state: "done", count: 1, flags: [] }; h.coins = 99999;
  h.x = el.x + 100; h.y = el.y;
  for(const q of ["censer", "silentvow"]){ SIM.input(W, "blue", { accept: q }); assert.equal(h.quests[q].state, "active", `${q} accepted from Elowen`); }
  SIM.input(W, "blue", { hire: 1 }); const req = W.mercReqs.shift();
  const mercs = SIM.mercDone(W, "blue", req.roles.map(r => [r, { tank: TANKY, healer: HEALER, dps: MAGE }[r]()]));
  assert.equal(mercs.length, 4, "Elowen hires out a party too");
  const route = [[4000, 19000], [4000, 20200], [3600, 21500], [2800, 22000], [1900, 22000, "deacon"], [4000, 21600], [5200, 22000], [6100, 22000, "abbess"], [4000, 21700], [4000, 22800, "saint"]];
  const alive = kind => W.mobs.some(m => !m.dead && m.kind === kind), party = () => SIM.partyMembers(W, h).map(p => p.id);
  let wi = 0, t = 0, deaths = 0, accepted = false;
  for(; t < 1500 * 30 && wi < route.length; t++){
    if(t % 6 === 0 && !h.dead){
      if(!accepted && !alive("deacon") && !alive("abbess")){ accepted = true; for(const q of ["censer", "silentvow"]) assert.equal(h.quests[q].state, "ready", `${q} complete`); }
      const esc = SIM.dangerEscape(W, h);
      if(esc) SIM.input(W, "blue", { move: esc });
      else {
        if(h.hp < h.maxHp * .35) SIM.input(W, "blue", { potion: 1 });
        const ps = party(), f = W.mobs.filter(m => !m.dead && m.aggro && ps.includes(m.aggro) && Math.hypot(m.x - h.x, m.y - h.y) < 1800 && !m.immune).sort((a, b) => (a.boss - b.boss) || Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
        const [x, y, kind] = route[wi];
        if(f){ SIM.input(W, "blue", { atk: f.id }); for(const k of ["Q", "W", "E", "R"]) SIM.input(W, "blue", { cast: k, at: [f.x, f.y] }); }
        else if(Math.hypot(h.x - x, h.y - y) > 150) SIM.input(W, "blue", { move: [x, y] });
        else if(!kind || !alive(kind)) wi++;
        else SIM.input(W, "blue", { atk: W.mobs.find(m => m.kind === kind && !m.dead).id });
      }
    }
    SIM.step(W, 1 / 30);
    for(const f of W.fxNet) if(f.k === "died") deaths++;
    W.fxNet.length = W.fxLocal.length = 0;
  }
  console.log(`# cathedral: ${wi >= route.length ? "cleared" : "NOT cleared"} in ${Math.round(t / 30)}s, ${deaths} deaths, level ${h.lvl}`);
  assert.ok(!alive("deacon") && !alive("abbess") && !alive("saint"), "all three bosses are dead");
  assert.ok(!W.dungeon.sealed, "the seals broke");
  const mine = [...h.inv, ...W.loot.filter(l => l.side === "blue").flatMap(l => l.items || [])];
  assert.ok(mine.filter(it => it.r === 3).length >= 3, "an Epic from each boss");
  assert.equal(mine.filter(it => it.r === 4).length, 1, "one Legendary from the Saint");
  runFor(W, 8);
  assert.ok(mercs.every(m => !W.heroes[m.side]), "the hired party leaves after the Saint");
  // the last quest, then turn everything in
  h.x = el.x + 100; h.y = el.y; h.dead = 0;
  for(const q of ["censer", "silentvow"]){ SIM.input(W, "blue", { turnin: q }); assert.equal(h.quests[q].state, "done"); }
  assert.equal(G.questFor(h.quests, "elowen").quest, "ashensaint", "the Saint's quest opens after both chapels");
});

test("cathedral: everything comes back after it's been empty for a while", () => {
  const W = SIM.create(), h = cathedralHero(W, "blue", ARCHER);
  for(const m of W.mobs) if(m.spawnId && m.kind !== "saint") m.dead = true;
  W.mobs = W.mobs.filter(m => !m.dead); W.dungeon.sealed = false;
  h.x = 4000; h.y = 18150; runFor(W, 5);
  h.x = G.CATHEDRAL.exit.x; h.y = G.CATHEDRAL.exit.y; runFor(W, 1);
  assert.ok(h.y < G.DZ, "left");
  runFor(W, G.CATHEDRAL.resetAfter + 5);
  assert.equal(W.mobs.filter(m => m.spawnId).length, G.CATHEDRAL_SPAWNS.length, "every creature and boss is back");
  assert.ok(W.dungeon.sealed, "and the choir is sealed again");
});

/* ---------- Saved progress ---------- */
test("save: a champion's progress survives a save and a fresh world", () => {
  const W = SIM.create(), h = cathedralHero(W, "blue", ARCHER, 14, 3);
  h.xp = 500; h.coins = 12345; h.arenaWins = 3; h.arenaBest = 7; h.x = G.YRSA_CAMP.x; h.y = G.YRSA_CAMP.y - 300;
  h.quests = { sheep: { state: "done", count: 5, flags: [] }, wards: { state: "active", count: 2, flags: [1, 0, 1] }, courier: { state: "failed", count: 0, flags: [] } };
  for(const k of ["power", "power", "haste", "mastery"]) SIM.input(W, "blue", { talent: "Q." + k });
  SIM.input(W, "blue", { talent: "core.vit" });
  SIM.addItem(h, G.genItem({ ilvl: 14, rarity: 4, cls: "ranged", slot: "weapon", nid: 4242 }));
  const before = { lvl: h.lvl, maxHp: h.maxHp, eq: G.EQ_SLOTS.map(s => h.equip[s].n), inv: h.inv.map(i => i.n + (i.q || 1)) };
  // saved the way a browser does: from the snapshot, through JSON
  const me = SIM.snapshot(W).h.find(x => x.side === "blue"), save = JSON.parse(JSON.stringify(G.saveRecord(me, h.champId)));
  const W2 = SIM.create(), h2 = SIM.addHero(W2, "blue", ARCHER());
  assert.ok(SIM.loadSave(W2, h2, save), "the save loads");
  assert.equal(h2.lvl, 14); assert.equal(h2.xp, 500); assert.equal(h2.coins, 12345); assert.equal(h2.arenaWins, 3); assert.equal(h2.arenaBest, 7);
  assert.equal(h2.quests.sheep.state, "done"); assert.equal(h2.quests.wards.state, "active"); assert.deepEqual([...h2.quests.wards.flags], [1, 0, 1]); assert.equal(h2.quests.courier.state, "failed");
  assert.equal(h2.talents.Q.mastery, 1); assert.equal(h2.talents.Q.power, 2); assert.equal(h2.talents.core.vit, 1);
  assert.deepEqual(G.EQ_SLOTS.map(s => h2.equip[s].n), before.eq, "the same gear is equipped");
  assert.deepEqual(h2.inv.map(i => i.n + (i.q || 1)), before.inv, "the same bags");
  assert.equal(h2.maxHp, before.maxHp, "same stats");
  assert.ok(Math.hypot(h2.x - h.x, h2.y - h.y) < 2, "back where you were");
  assert.equal(new Set([...h2.inv, ...Object.values(h2.equip)].map(i => i.id)).size, h2.inv.length + G.EQ_SLOTS.length, "items get fresh ids");
  assert.equal(G.questFor(h2.quests, "yrsa").state, "progress", "quest givers pick up where you left off");
});

test("save: a bad or tampered save can't break the game or cheat past the rules", () => {
  const W = SIM.create(), h = SIM.addHero(W, "blue", ARCHER());
  assert.equal(SIM.loadSave(W, h, { v: G.SAVE_VERSION, champ: "Someone", lvl: 20 }), false, "another champion's save is refused");
  assert.equal(SIM.loadSave(W, h, null), false); assert.equal(SIM.loadSave(W, h, "junk"), false); assert.equal(h.lvl, 1);
  const bad = { v: G.SAVE_VERSION, champ: "Archer", lvl: 999, xp: -5, coins: "lots", arenaBest: 50,
    quests: { nope: { state: "done" }, sheep: { state: "hacked" }, wolves: { state: "ready", count: 999 }, ["__proto__"]: { state: "done" } },
    inv: [{ s: "weapon", n: "Godblade", r: 9, st: { ad: 1e9, evil: 5, ["__proto__"]: 1 }, il: 99, color: "javascript:1", wt: "laser" }, { s: "mat", key: "unobtainium", q: 5 }, { s: "use", key: "hpot", q: 900 }, "x", null],
    equip: { head: { s: "chest", n: "Wrong slot", r: 1, st: {} }, legs: { s: "legs", n: "Pants", r: 2, st: { hp: 40 } } },
    talents: { core: { vit: 9, might: 9 }, Q: { power: 9, haste: 9, mastery: 9 }, W: { power: 9 }, E: { power: 9 }, R: { power: 9 } },
    x: 4000, y: 20000 };
  assert.ok(SIM.loadSave(W, h, bad));
  assert.equal(h.lvl, G.MAX_LEVEL); assert.equal(h.xp, 0); assert.equal(h.coins, 0); assert.equal(h.arenaBest, 10);
  assert.deepEqual(Object.keys(h.quests), ["wolves"], "only real quests in real states"); assert.equal(h.quests.wolves.count, G.QUESTS.wolves.obj.count);
  const blade = h.inv.find(i => i.s === "weapon");
  assert.ok(blade && blade.r === 4 && blade.st.ad === 5000 && !("evil" in blade.st) && blade.il === 40 && blade.wt === null && blade.color === "#b8a68a", "item stats are clamped and cleaned");
  assert.equal(h.inv.length, 2, "unknown items are dropped"); assert.equal(h.inv.find(i => i.key === "hpot").q, 20);
  assert.ok(!h.equip.head && h.equip.legs, "gear only goes in its own slot");
  assert.ok(G.talentsSpent(h.talents) <= h.lvl - 1, "talents stay within your points and the tree's rules");
  assert.ok(Object.keys(h.talents.Q).every(k => h.talents.Q[k] <= 3));
  assert.ok(h.x === G.CATHEDRAL.arrive[0] && h.y === G.CATHEDRAL.arrive[1], "a save inside the cathedral starts at its entrance");
  SIM.step(W, 1 / 30); assert.ok(!h.dead && h.hp === h.maxHp);
});

/* ---------- The Thornveil Jungle ---------- */
test("jungle: the Saint opens two portals; the right takes your party to the jungle, the left is still sealed", () => {
  const W = SIM.create(), a = cathedralHero(W, "blue", ARCHER, 17), b = cathedralHero(W, "red", HEALER, 17);
  SIM.input(W, "blue", { pinvite: "red" }); SIM.input(W, "red", { paccept: "blue" });
  const P = G.CHOIR_PORTALS; W.dungeon.sealed = false;
  for(const h of [a, b]){ h.x = 4000; h.y = 22700; }
  a.x = P.right.x; a.y = P.right.y; runFor(W, .2);
  assert.ok(a.y < G.DZ + 8000 && a.x < G.ZS, "the portals stay shut while the Saint lives");
  const saint = W.mobs.find(m => m.kind === "saint"); saint.immune = false; SIM.damage(W, saint, 100, a); saint.hp = 1; SIM.damage(W, saint, 1e9, a);
  assert.ok(saint.dead && W.dungeon.down.saint);
  runFor(W, 4); a.x = P.left.x; a.y = P.left.y; runFor(W, .2);
  assert.ok(!G.inJungle(a.x, a.y), "the left portal is sealed for now");
  a.x = P.right.x; a.y = P.right.y; runFor(W, .2);
  assert.ok(G.inJungle(a.x, a.y) && G.inJungle(b.x, b.y), "the right portal takes the whole party into the jungle");
  assert.ok(Math.hypot(a.x - G.CANOPY.x, a.y - G.CANOPY.y) < 800, "you arrive by Canopy Camp");
});

test("jungle: walls hold, you fall back to Canopy Camp, and the waystones link it with Highwatch", () => {
  const W = SIM.create(), h = cathedralHero(W, "blue", ARCHER, 17);
  for(const m of W.mobs) if(G.inJungle(m.x, m.y)) m.dead = true;
  h.x = G.CANOPY.x; h.y = G.CANOPY.y; SIM.input(W, "blue", { move: [0, 17000] }); runFor(W, 10);
  assert.ok(G.inJungle(h.x, h.y), "walking west stops at the jungle's edge");
  SIM.damage(W, h, 1e9, null); runFor(W, 7);
  assert.ok(!h.dead && Math.hypot(h.x - G.CANOPY.x, h.y - G.CANOPY.y) < 800, "you come back at Canopy Camp");
  // the Highwatch waystone is dark until you've been to the jungle
  const fresh = cathedralHero(W, "red", GAREN_LIKE, 17); fresh.x = G.WAYSTONES.peaks.x; fresh.y = G.WAYSTONES.peaks.y; runFor(W, .2);
  assert.ok(!G.inJungle(fresh.x, fresh.y), "the waystone is dark for someone who hasn't been");
  h.quests.ashensaint = { state: "done", count: 1, flags: [] };
  h.portalT = 0; h.x = G.WAYSTONES.jungle.x; h.y = G.WAYSTONES.jungle.y; runFor(W, .2);
  assert.ok(Math.hypot(h.x - G.WAYSTONES.peaks.x, h.y - G.WAYSTONES.peaks.y) < 500, "the camp waystone leads to Highwatch");
  runFor(W, 4); h.x = G.WAYSTONES.peaks.x; h.y = G.WAYSTONES.peaks.y; runFor(W, .2);
  assert.ok(G.inJungle(h.x, h.y), "and back again");
  // a save made in the jungle comes back there
  const s = JSON.parse(JSON.stringify(G.saveRecord(SIM.snapshot(W).h.find(x => x.side === "blue"), h.champId)));
  const W2 = SIM.create(), h2 = SIM.addHero(W2, "blue", ARCHER()); SIM.loadSave(W2, h2, s);
  assert.ok(G.inJungle(h2.x, h2.y) && Math.hypot(h2.x - h.x, h2.y - h.y) < 2, "saved in the jungle, back in the jungle");
});

test("jungle: a level 17 player can do every quest before the raids alone", () => {
  const W = SIM.create(), h = cathedralHero(W, "blue", GAREN_LIKE, 17, 3);
  h.quests.ashensaint = { state: "done", count: 1, flags: [] }; h.x = G.JUNGLE_ARRIVE[0]; h.y = G.JUNGLE_ARRIVE[1];
  const step = (secs, each) => runFor(W, secs, each);
  const near = (list) => list.sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
  const fightBack = i => { if(i % 6) return false; if(h.hp < h.maxHp * .35) SIM.input(W, "blue", { potion: 1 }); const f = near(W.mobs.filter(m => !m.dead && m.aggro === h.id)); if(!f) return false; SIM.input(W, "blue", { atk: f.id }); for(const k of ["Q", "W", "E", "R"]) SIM.input(W, "blue", { cast: k, at: [f.x, f.y] }); return true; };
  const travel = (x, y, max = 120) => { for(let s = 0; s < max && Math.hypot(h.x - x, h.y - y) > 150; s++) step(1, i => { if(!fightBack(i) && i % 6 === 0) SIM.input(W, "blue", { move: [x, y] }); }); };
  const hunt = (qid, kind, max = 500) => { for(let s = 0; s < max && h.quests[qid].state === "active"; s++) step(1, i => { if(fightBack(i) || i % 6) return; const t = near(W.mobs.filter(m => !m.dead && m.kind === kind)); if(t){ SIM.input(W, "blue", { atk: t.id }); if(Math.hypot(t.x - h.x, t.y - h.y) < 600) for(const k of ["Q", "W", "E", "R"]) SIM.input(W, "blue", { cast: k, at: [t.x, t.y] }); } }); };
  const npc = id => G.NPCS.find(n => n.id === id);
  const accept = (id, qid) => { for(let k = 0; k < 3 && !h.quests[qid]; k++){ travel(npc(id).x, npc(id).y - 200); SIM.input(W, "blue", { accept: qid }); step(.2); } assert.ok(h.quests[qid], `${qid} accepted`); };
  const turnIn = (id, qid) => { for(let k = 0; k < 3 && h.quests[qid].state !== "done"; k++){ travel(npc(id).x, npc(id).y - 200); SIM.input(W, "blue", { turnin: qid }); step(.2); } assert.equal(h.quests[qid].state, "done", `${qid} turned in`); };
  accept("ezo", "frogs"); hunt("frogs", "frog"); turnIn("ezo", "frogs");
  accept("tamsin", "canopy"); hunt("canopy", "serpent"); turnIn("tamsin", "canopy");
  accept("tamsin", "vantage"); G.VANTAGES.forEach((p, i) => { for(let k = 0; k < 3 && !h.quests.vantage.flags[i]; k++) travel(p.x, p.y, 200); }); turnIn("tamsin", "vantage");
  accept("ezo", "bloodvine");
  for(let k = 0; k < 30 && h.quests.bloodvine.state === "active"; k++){ const n = near(W.nodes.filter(n => n.ready && n.kind === "bloodvine")); if(!n){ step(5); continue; } travel(n.x, n.y); SIM.input(W, "blue", { gather: n.id }); step(2); }
  turnIn("ezo", "bloodvine");
  accept("ezo", "prowlers"); hunt("prowlers", "prowler"); turnIn("ezo", "prowlers");
  accept("tamsin", "greyback"); travel(G.GREYBACK_DEN.x, G.GREYBACK_DEN.y - 500, 200); hunt("greyback", "greyback", 400); turnIn("tamsin", "greyback");
  accept("ezo", "venom"); travel(G.BROODHOLLOW.x, G.BROODHOLLOW.y - 500, 200);
  for(let s = 0; s < 400 && h.quests.venom.state === "active"; s += 5){ const sac = W.loot.find(l => l.quest === "venom" && l.side === "blue"); if(sac){ SIM.input(W, "blue", { pickup: sac.id }); step(5); } else hunt("venom", "sizzra", 5); }
  turnIn("ezo", "venom");
  console.log(`# jungle quests done at level ${h.lvl}`);
  for(const id of ["frogs", "canopy", "vantage", "bloodvine", "prowlers", "greyback", "venom"]) assert.equal(h.quests[id].state, "done");
  for(const id of ["tyrant", "queen"]) assert.equal(G.questFor(h.quests, "tamsin").state === "offer" || h.quests[id], true, "the raids are offered next");
});

test("jungle: Mawgrot dives and Shadowmane vanishes; a hired party kills both for Legendary loot", () => {
  for(const [kind, qid] of [["mawgrot", "tyrant"], ["shadowmane", "queen"]]){
    const W = SIM.create(), h = cathedralHero(W, "blue", ARCHER, 17), tam = G.NPCS.find(n => n.id === "tamsin");
    h.coins = 99999; h.quests[qid] = { state: "active", count: 0, flags: [] }; h.x = tam.x + 100; h.y = tam.y;
    SIM.input(W, "blue", { hire: 1 }); const req = W.mercReqs.shift();
    const mercs = SIM.mercDone(W, "blue", req.roles.map(r => [r, { tank: TANKY, healer: HEALER, dps: MAGE }[r]()]));
    assert.equal(mercs.length, 4, "Tamsin hires out a raid party");
    const boss = W.mobs.find(m => m.kind === kind);
    for(const m of W.mobs) if(!m.boss && Math.hypot(m.x - boss.x, m.y - boss.y) < 2500) m.dead = true;
    for(const x of [h, ...mercs]){ x.x = boss.x - 300; x.y = boss.y - 1100; }
    SIM.input(W, "blue", { atk: boss.id });
    let t = 0, hid = false;
    for(; t < 900 * 30 && !boss.dead; t++){
      if(boss.hidden){ hid = true; assert.equal(SIM.damage(W, boss, 100, h), 0, "can't be hurt while hidden"); }
      if(t % 6 === 0 && !h.dead){
        const esc = SIM.dangerEscape(W, h);
        if(esc) SIM.input(W, "blue", { move: esc });
        else {
          if(h.hp < h.maxHp * .35) SIM.input(W, "blue", { potion: 1 });
          const ps = SIM.partyMembers(W, h).map(p => p.id), f = W.mobs.filter(m => !m.dead && !m.immune && (m === boss || (m.aggro && ps.includes(m.aggro))) && Math.hypot(m.x - h.x, m.y - h.y) < 2500).sort((a, b) => (a.boss - b.boss) || Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
          if(f){ SIM.input(W, "blue", { atk: f.id }); for(const k of ["Q", "W", "E", "R"]) SIM.input(W, "blue", { cast: k, at: [f.x, f.y] }); }
          else SIM.input(W, "blue", { move: [boss.x - 500, boss.y - 500] });
        }
      }
      SIM.step(W, 1 / 30); W.fxNet.length = W.fxLocal.length = 0;
    }
    console.log(`# ${kind}: ${boss.dead ? "killed" : "NOT killed"} in ${Math.round(t / 30)}s`);
    assert.ok(boss.dead, `${kind} dies`); assert.ok(hid, `${kind} hid at least once`);
    assert.equal(h.quests[qid].state, "ready");
    const mine = [...h.inv, ...W.loot.filter(l => l.side === "blue").flatMap(l => l.items || [])];
    assert.equal(mine.filter(i => i.r === 4).length, 1, "a Legendary"); assert.ok(mine.some(i => i.r === 3), "and an Epic");
    assert.ok(!W.loot.some(l => l.side && l.side.startsWith("merc")), "nothing for the hired party");
  }
});

test("hired party: after you've finished the quests you can still hire a party to go back", () => {
  for(const [npcId, quests] of [["yrsa", ["rimewyrm"]], ["elowen", ["censer", "silentvow", "ashensaint"]], ["tamsin", ["tyrant", "queen"]]]){
    const W = SIM.create(), h = cathedralHero(W, "blue", ARCHER, 18), npc = G.NPCS.find(n => n.id === npcId);
    h.coins = 99999; h.x = npc.x + 100; h.y = npc.y;
    for(const q of quests) h.quests[q] = { state: "done", count: 1, flags: [] };
    SIM.input(W, "blue", { hire: 1 });
    assert.equal(W.mercReqs.length, 1, `${npcId} hires out a party after her quests are done`);
  }
});

test("bags: sell several items to a vendor, or salvage several anywhere; bad input is ignored", () => {
  const W = SIM.create(), h = cathedralHero(W, "blue", ARCHER, 10), osric = G.NPCS.find(n => n.id === "osric");
  const items = [0, 1, 2, 3].map(k => G.genItem({ ilvl: 10, rarity: k % 3, cls: "ranged", nid: 8800 + k }));
  for(const it of items) SIM.addItem(h, it);
  const value = list => list.reduce((a, it) => a + it.v * (it.q || 1), 0);
  // selling needs a vendor nearby
  h.x = 4000; h.y = 1500; const c0 = h.coins;
  SIM.input(W, "blue", { sell: [items[0].id, items[1].id] });
  assert.equal(h.coins, c0, "no vendor nearby, nothing sold"); assert.ok(h.inv.includes(items[0]));
  h.x = osric.x; h.y = osric.y - 200;
  SIM.input(W, "blue", { sell: [items[0].id, items[1].id, items[1].id, "nope", { evil: 1 }] });
  assert.equal(h.coins, c0 + value(items.slice(0, 2)), "both sold once, at full value");
  assert.ok(!h.inv.includes(items[0]) && !h.inv.includes(items[1]));
  // salvage several anywhere (equipped gear is never touched)
  h.x = 4000; h.y = 1500; const c1 = h.coins, eq = h.equip.weapon;
  SIM.input(W, "blue", { salvage: [items[2].id, items[3].id, eq.id] });
  assert.equal(h.coins, c1 + value(items.slice(2)), "salvaged both");
  assert.equal(h.equip.weapon, eq, "equipped gear stays");
  // a single id still works, and a huge list is capped
  const one = G.genItem({ ilvl: 10, rarity: 0, cls: "ranged", nid: 8900 }); SIM.addItem(h, one);
  SIM.input(W, "blue", { salvage: one.id }); assert.ok(!h.inv.includes(one));
  SIM.input(W, "blue", { salvage: Array.from({ length: 5000 }, (_, i) => "x" + i) });
});

/* ---------- Professions and crafted sets ---------- */
function craftHero(lvl = 20){
  const W = SIM.create(), h = cathedralHero(W, "blue", GAREN_LIKE, lvl), br = G.NPCS.find(n => n.id === "brenna");
  h.inv = []; h.x = br.x + 100; h.y = br.y;
  return { W, h, br };
}
const give = (W, h, key, q) => { while(q > 0){ const n = Math.min(20, q); SIM.addItem(h, Object.assign(G.makeMat(key, W.nid++), { q: n })); q -= n; } };

test("professions: learn from Brenna, gather nodes and skin beasts, with skill tiers", () => {
  const { W, h, br } = craftHero();
  h.x = 4000; h.y = 1500; SIM.input(W, "blue", { learn: "mining" }); assert.ok(!h.prof.mining, "only from Brenna");
  h.x = br.x + 100; h.y = br.y;
  for(const p of ["mining", "herbalism", "skinning", "artisanry", "nope", "__proto__"]) SIM.input(W, "blue", { learn: p });
  assert.deepEqual(Object.keys(h.prof).sort(), ["artisanry", "herbalism", "mining", "skinning"]);
  // copper: anyone with Mining; glimmerstone needs 50
  const node = kind => W.nodes.find(n => n.kind === kind && n.ready);
  const gather = n => { h.x = n.x; h.y = n.y - 60; SIM.gather(W, h, n); };
  gather(node("copper")); assert.ok(h.inv.some(i => i.key === "copperore") && h.prof.mining > 1, "mined copper and gained skill");
  gather(node("ore")); assert.ok(!h.inv.some(i => i.key === "glimore"), "glimmerstone needs Mining 50");
  h.prof.mining = 50; gather(node("ore")); assert.ok(h.inv.some(i => i.key === "glimore"));
  // skill gains shrink as you outgrow a node, and stop at the cap
  assert.equal(G.skillGain(10, 0), 3); assert.equal(G.skillGain(30, 0), 2); assert.equal(G.skillGain(60, 0), 1); assert.equal(G.skillGain(80, 0), 0); assert.equal(G.skillGain(G.PROF_MAX, 140), 0);
  // skinning: the killer skins the beast
  const wolf = W.mobs.find(m => m.kind === "wolf"); h.x = wolf.x; h.y = wolf.y - 100;
  wolf.hp = 1; SIM.damage(W, wolf, 1e9, h);
  assert.ok(h.inv.some(i => i.key === "lighthide"), "skinned a light hide");
  const lynx = W.mobs.find(m => m.kind === "lynx"); lynx.hp = 1; SIM.damage(W, lynx, 1e9, h);
  assert.ok(!h.inv.some(i => i.key === "frostfur"), "frostfur needs Skinning 50");
});

test("artisanry: refine at a forge, then forge a set piece; skill and materials are checked", () => {
  const { W, h } = craftHero();
  h.prof = { artisanry: 1 };
  give(W, h, "copperore", 10);
  h.x = 4000; h.y = 1500; SIM.input(W, "blue", { craft: "copperbar", n: 5 }); assert.ok(!h.inv.some(i => i.key === "copperbar"), "needs a forge");
  const f = G.FORGES[0]; h.x = f.x + 50; h.y = f.y;
  SIM.input(W, "blue", { craft: "copperbar", n: 5 });
  assert.equal(h.inv.filter(i => i.key === "copperbar").reduce((a, i) => a + i.q, 0), 5, "five bars"); assert.ok(!h.inv.some(i => i.key === "copperore"), "ore used up");
  assert.ok(h.prof.artisanry > 10, "skill went up");
  SIM.input(W, "blue", { craft: "dawn_head" }); assert.ok(!h.inv.some(i => i.set), "a set piece needs Artisanry 100 and its materials");
  h.prof.artisanry = 100;
  const R = G.RECIPES.dawn_head; for(const m in R.need) give(W, h, m, R.need[m]);
  SIM.input(W, "blue", { craft: "dawn_head" });
  const helm = h.inv.find(i => i.set === "dawn");
  assert.ok(helm && helm.s === "head" && helm.r === 5, "forged the Dawnforged Crown (Set rarity)");
  for(const m in R.need) assert.ok(!h.inv.some(i => i.key === m), `${m} used up`);
  SIM.input(W, "blue", { craft: "nope" }); SIM.input(W, "blue", { craft: "__proto__" }); SIM.input(W, "blue", { craft: { x: 1 } });
  // every set piece is craftable at or below the cap, and gathering to the cap takes a sensible number of trips
  for(const id in G.RECIPES) assert.ok(G.RECIPES[id].req < G.PROF_MAX);
  let skill = 1, n = 0; for(const req of [0, 50, 100]) while(skill < req + 50 && skill < G.PROF_MAX){ skill += G.skillGain(skill, req) || 1; n++; }
  assert.ok(n < 90, `about ${n} gathers from 1 to ${G.PROF_MAX}`);
});

test("sets: 2, 4 and 6 piece bonuses, and each set's six-piece effect", () => {
  const W = SIM.create(), a = cathedralHero(W, "blue", GAREN_LIKE, 20), b = cathedralHero(W, "red", ARCHER, 20), c = cathedralHero(W, "green", MAGE, 20);
  const wear = (h, key, n) => { for(const sl of G.EQ_SLOTS) delete h.equip[sl]; G.EQ_SLOTS.slice(0, n).forEach((sl, i) => { h.equip[sl] = G.makeSetItem(key, sl, 6000 + i + h.side.length * 10); }); SIM.recalc(h); };
  wear(a, "dawn", 1); const hp1 = a.maxHp, ad1 = a.ad;
  wear(a, "dawn", 2); assert.equal(a.setN, 2); assert.ok(a.maxHp > hp1 * 1.08, "2 pieces: +10% health");
  const ad2 = a.ad; wear(a, "dawn", 4); assert.ok(a.ad > ad2 * 1.14, "4 pieces: +15% attack damage");
  wear(a, "dawn", 6); assert.equal(a.setN, 6); assert.equal(a.setKey, "dawn");
  // Dawnforged 6: every 4th basic attack hits everything around the target; you take 10% less damage
  const pack = W.mobs.filter(m => m.kind === "wolf").slice(0, 3); pack.forEach((m, i) => { m.x = 5000 + i * 80; m.y = 5000; m.hp = m.maxHp = 1e6; });
  for(let i = 0; i < 4; i++){ SIM.damage(W, pack[0], 10, a); SIM.setOnHit(W, a, pack[0], 10); }
  assert.ok(pack[1].hp < 1e6 && pack[2].hp < 1e6, "Radiant Wrath hit the others");
  const hp = a.hp; SIM.damage(W, a, 100, pack[0]); const took6 = hp - a.hp;
  wear(a, "dawn", 4); a.hp = a.maxHp; const hp4 = a.hp; SIM.damage(W, a, 100, pack[0]); assert.ok(took6 < hp4 - a.hp, "less damage with six pieces");
  // Stormwing 6: basic attacks chain to two more enemies
  wear(b, "storm", 6); for(const m of pack) m.hp = 1e6;
  SIM.setOnHit(W, b, pack[0], 100); assert.ok(pack[1].hp < 1e6 && pack[2].hp < 1e6, "Chain Lightning arced");
  // Voidweave 6: every 3rd ability doesn't go on cooldown
  wear(c, "void", 6); c.x = 5000; c.y = 4600; let free = 0;
  for(let i = 0; i < 6; i++){ c.cds.Q = 0; SIM.cast(W, c, "Q", [5000, 5000]); if(c.cds.Q === 0) free++; }
  assert.equal(free, 2, "two of six casts were free");
  // a set piece survives a save
  const s = JSON.parse(JSON.stringify(G.saveRecord(SIM.snapshot(W).h.find(x => x.side === "green"), c.champId)));
  const W2 = SIM.create(), c2 = SIM.addHero(W2, "green", MAGE()); SIM.loadSave(W2, c2, s);
  assert.equal(c2.setN, 6, "all six pieces back"); assert.equal(c2.equip.weapon.set, "void");
});
