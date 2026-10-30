"use strict";
// Authoritative game simulation (runs on the host). Combat, AI, quests, loot, gear. No DOM or three.js.

/* =====================================================================
   SIMULATION (host only; zone units)
   ===================================================================== */
const SIM = {
  create(){
    const W = { t: 0, heroes: {}, mobs: [], shots: [], zones: [], fields: [], pets: [], loot: [], respawnQ: [], fxNet: [], fxLocal: [], nid: 1, parties: {}, invites: [], rolls: [] };
    for(const kind in MOBS) for(let i = 0; i < MOBS[kind].count; i++) SIM.spawnMob(W, kind);
    W.nodes = [];
    for(let i = 0, tries = 0; W.nodes.length < 10 && tries < 400; tries++){
      const a = Math.random() * Math.PI * 2, r = 720 + Math.random() * 380, x = clampX(HERB_AREA.x + Math.cos(a) * r), y = clampY(HERB_AREA.y + Math.sin(a) * r);
      if(OBSTACLES.some(o => Math.hypot(o.x - x, o.y - y) < o.r + 140) || W.nodes.some(n => Math.hypot(n.x - x, n.y - y) < 260)) continue;
      W.nodes.push({ id: "n" + i++, x, y, ready: true, respawnAt: 0 });
    }
    return W;
  },
  addHero(W, side, d){
    const st = d.stats;
    const c = { id: "c:" + side, side, team: "hero", champId: d.id, name: d.name, kit: buildKit(d),
      x: SPAWN[0] + (SIDES.indexOf(side) - 2) * 60, y: SPAWN[1], r: 55,
      base: { hp: st.hp, hpl: st.hpperlevel, ad: st.attackdamage, adl: st.attackdamageperlevel },
      as: Math.max(.5, Math.min(1.1, st.attackspeed || .65)), range: st.attackrange, ranged: st.attackrange > 300, ms: st.movespeed,
      lvl: 1, xp: 0, cds: { Q: 0, W: 0, E: 0, R: 0 }, move: null, target: null, talkTo: null, atkT: 0, dead: 0, castSeq: 0, castKey: "", atkSeq: 0,
      face: Math.PI, moving: false, dash: null, forced: null, spin: null, orbT: 0, orbA: 0, orbHits: {}, orbP: null,
      cc: { stun: 0, root: 0, slow: 0, slowAmt: 0 }, shield: 0, shieldT: 0, buffT: 0, buffAS: 0, buffOnHit: 0, boostT: 0, boost: 0, stealthT: 0,
      lastCombat: -99, quests: {}, weapon: null, lootTo: null, talents: newTalents(), orbN: 3, ambush: false,
      inv: [], equip: {}, coins: 0, gearVer: 1, party: null, chatT: -99, chatN: 0, gatherTo: null, useTo: null, channel: null, ap: 0, armor: 0, hasteG: 0, msPct: 0 };
    SIM.recalc(c); c.hp = c.maxHp;
    W.heroes[side] = c;
    return c;
  },
  recalc(c){
    const gs = {}; for(const sl of EQ_SLOTS){ const it = c.equip[sl]; if(it) for(const k in it.st) gs[k] = (gs[k] || 0) + it.st[k]; }
    const ratio = c.maxHp ? c.hp / c.maxHp : 1;
    c.maxHp = Math.round((c.base.hp + c.base.hpl * (c.lvl - 1) + (gs.hp || 0)) * (1 + TALENT.vit.per * c.talents.core.vit));
    c.hp = Math.min(c.maxHp, Math.max(1, ratio * c.maxHp));
    c.ad = (c.base.ad + c.base.adl * (c.lvl - 1) + (gs.ad || 0)) * (1 + TALENT.might.per * c.talents.core.might);
    c.ap = gs.ap || 0; c.armor = gs.armor || 0; c.hasteG = Math.min(40, gs.haste || 0); c.msPct = Math.min(30, gs.ms || 0);
    c.weapon = c.equip.weapon ? { name: c.equip.weapon.n, glow: !!c.equip.weapon.glow } : null;
  },
  addItem(c, it){
    if(it.stack){ const ex = c.inv.find(x => x.key === it.key && x.q < 20); if(ex){ ex.q += it.q || 1; c.gearVer++; return true; } }
    if(c.inv.length >= BAG_SIZE) return false;
    c.inv.push(it); c.gearVer++; return true;
  },
  dropItems(W, c, items, coins){
    W.loot.push({ id: "l" + W.nid++, side: c.side, bag: true, item: "bag", coins: coins || 0, items, rar: items.reduce((m, it) => Math.max(m, it.r), 0), x: c.x, y: c.y - 80, expires: W.t + 300, blockT: W.t + 3 });
  },
  giveReward(W, c, it){
    const cur = c.equip[it.s];
    if(!cur || it.r > cur.r){ if(cur && !SIM.addItem(c, cur)) SIM.dropItems(W, c, [cur]); c.equip[it.s] = it; SIM.recalc(c); }
    else if(!SIM.addItem(c, it)) SIM.dropItems(W, c, [it]);
    c.gearVer++;
  },
  questWeapon(W, c){
    const it = genItem({ ilvl: 7, rarity: 3, cls: c.kit.cls, slot: "weapon", nid: W.nid++ });
    it.n = WEAPON_REWARD[c.kit.cls]; it.st = { ad: WEAPON_REWARD.ad, ap: Math.round(WEAPON_REWARD.abil * 100), hp: 80 }; it.glow = true; it.v = 250;
    return it;
  },
  dropBag(W, c, u, group){
    const L = LOOT[u.kind]; if(!L) return;
    let items = [];
    const coins = L.coins[0] + Math.floor(Math.random() * (L.coins[1] - L.coins[0] + 1));
    if(L.mat && Math.random() < L.mat[1]) items.push(makeMat(L.mat[0], W.nid++));
    if(Math.random() < L.gear) items.push(genItem({ ilvl: L.ilvl + Math.floor(Math.random() * 2), rarity: rollRarity(L.minRarity || 0, L.epic || 0), cls: c.kit.cls, nid: W.nid++ }));
    // in a party, Rare and better gear goes to a Need/Greed roll instead of the killer's bag
    const rollers = (group || []).filter(h => !h.dead);
    if(rollers.length > 1){ for(const it of items) if(it.s !== "mat" && it.r >= ROLL_MIN) SIM.startRoll(W, it, rollers, c); items = items.filter(it => it.s === "mat" || it.r < ROLL_MIN); }
    const a = Math.random() * Math.PI * 2;
    W.loot.push({ id: "l" + W.nid++, side: c.side, bag: true, item: "bag", coins, items, rar: items.reduce((m, it) => Math.max(m, it.r), 0), x: clampX(u.x + Math.cos(a) * 40), y: clampY(u.y + Math.sin(a) * 40), expires: W.t + 90 });
    const bags = W.loot.filter(l => l.bag);
    if(bags.length > 60) W.loot = W.loot.filter(l => l !== bags[0]);
  },
  removeHero(W, side){ if(W.heroes[side]) SIM.forgetHero(W, W.heroes[side]); delete W.heroes[side]; for(const m of W.mobs) if(m.aggro === "c:" + side) m.aggro = null; },
  spawnMob(W, kind, at){
    const T = MOBS[kind], a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * T.roam;
    const x = at ? at.x : T.home[0] + Math.cos(a) * r, y = at ? at.y : T.home[1] + Math.sin(a) * r;
    const m = { id: "m" + W.nid++, kind, team: "mob", name: T.name, x, y, home: T.home, r: T.r, hp: T.hp, maxHp: T.hp, dmg: T.dmg, ms: T.ms,
      atkT: 0, aggro: null, returning: false, wp: null, wait: Math.random() * 3, face: Math.random() < .5 ? Math.PI / 2 : -Math.PI / 2, moving: false,
      cc: { stun: 0, root: 0, slow: 0, slowAmt: 0 }, forced: null, boostT: 0, boost: 0, shield: 0, dead: false, lastHit: null, windup: 0, charging: null, chargeCd: 0, event: null };
    W.mobs.push(m); return m;
  },
  alertPack(W, m, heroId){
    if(!MOBS[m.kind].pack) return;
    for(const o of W.mobs) if(o !== m && o.kind === m.kind && !o.dead && !o.aggro && !o.returning && Math.hypot(o.x - m.x, o.y - m.y) < 650){ o.aggro = heroId; o.wp = null; SIM.fx(W, { k: "angry", id: o.id }); }
  },
  scanAggro(W, m, T){
    const h = SIM.heroes(W).find(h => !h.dead && SIM.visibleTo(h, "mob") && Math.hypot(h.x - m.x, h.y - m.y) < T.aggroR);
    if(!h) return false;
    m.aggro = h.id; m.wp = null; SIM.fx(W, { k: "angry", id: m.id }); SIM.alertPack(W, m, h.id); return true;
  },
  xpNext: xpForLevel,
  // fallen heroes return to the village, or to Highwatch if they fell in the Peaks
  respawnAt: c => c.y >= ZS ? [OUTPOST.x + 120, OUTPOST.y - 260] : SPAWN,
  dmgScale: c => (1 + .09 * ((c.lvl || 1) - 1)) * (1 + (c.ap || 0) / 100),
  fx(W, f){ W.fxNet.push(f); W.fxLocal.push(f); },
  isHero: u => u.team === "hero",
  heroes: W => Object.values(W.heroes),
  units(W){ const out = []; for(const c of SIM.heroes(W)) if(!c.dead) out.push(c); for(const m of W.mobs) if(!m.dead) out.push(m); return out; },
  enemies(W, team){ return SIM.units(W).filter(u => u.team !== team); },
  visibleTo: (u, team) => !(u.team === "hero" && u.stealthT > 0 && team !== "hero"),
  find(W, id){ if(!id) return null; if(id[0] === "c"){ const c = W.heroes[id.slice(2)]; return c && !c.dead ? c : null; } return W.mobs.find(m => m.id === id && !m.dead) || null; },
  effMs(u){ let m = u.ms * (1 + (u.msPct || 0) / 100); if(u.cc.slow > 0) m *= 1 - u.cc.slowAmt; if(u.boostT > 0) m *= 1 + u.boost; return m; },
  canMove: u => !(u.cc.stun > 0 || u.cc.root > 0 || u.forced),
  canAct: u => !(u.cc.stun > 0 || u.forced),
  applyCC(u, cc){
    if(!cc || u.dead) return;
    if(cc.stun) u.cc.stun = Math.max(u.cc.stun, cc.stun);
    if(cc.root) u.cc.root = Math.max(u.cc.root, cc.root);
    if(cc.slow){ u.cc.slow = Math.max(u.cc.slow, 1.6); u.cc.slowAmt = Math.max(u.cc.slowAmt, cc.slow); }
  },
  force(u, tx, ty, dur){ u.forced = { sx: u.x, sy: u.y, tx: clampX(tx), ty: clampY(ty), t: 0, dur }; u.dash = null; },
  hitAbility(W, c, u, p, mult = 1){
    let d = (p.dmg || 0) * SIM.dmgScale(c) * mult;
    if(p.execute) d *= 1 + (1 - u.hp / u.maxHp);
    const dealt = d > 0 ? SIM.damage(W, u, d, c) : 0;
    SIM.applyCC(u, p.cc);
    if(p.drain && dealt > 0) c.hp = Math.min(c.maxHp, c.hp + dealt * .35);
    return dealt;
  },
  burst(W, c, x, y, radius, p){ for(const u of SIM.enemies(W, c.team)) if(Math.hypot(u.x - x, u.y - y) < radius + u.r) SIM.hitAbility(W, c, u, p); },
  gainXp(W, c, v){
    if(c.lvl >= MAX_LEVEL || v <= 0) return;
    c.xp += v; SIM.fx(W, { k: "xp", side: c.side, v, x: c.x, y: c.y });
    while(c.lvl < MAX_LEVEL && c.xp >= SIM.xpNext(c.lvl)){
      c.xp -= SIM.xpNext(c.lvl); c.lvl++;
      SIM.recalc(c); c.hp = c.maxHp;
      SIM.fx(W, { k: "lvl", x: c.x, y: c.y, side: c.side, lvl: c.lvl });
    }
  },
  damage(W, u, amount, src){
    if(u.dead || amount <= 0) return 0;
    if(src && SIM.isHero(src)) src.lastCombat = W.t;
    if(SIM.isHero(u)) u.lastCombat = W.t;
    if(!SIM.isHero(u) && src && SIM.isHero(src)){ u.lastHit = src.id; if(!u.aggro && !u.returning){ u.aggro = src.id; SIM.fx(W, { k: "angry", id: u.id }); SIM.alertPack(W, u, src.id); } }
    if(u.shield > 0){ const ab = Math.min(u.shield, amount); u.shield -= ab; amount -= ab; if(amount <= 0){ SIM.fx(W, { k: "num", x: u.x, y: u.y, v: "absorbed", hero: 1 }); return 0; } }
    if(SIM.isHero(u) && u.armor) amount *= 300 / (300 + u.armor);
    u.hp -= amount;
    SIM.fx(W, { k: "num", x: u.x, y: u.y, v: Math.round(amount), hero: SIM.isHero(u) ? 1 : 0, src: src && src.side ? src.side : "" });
    if(u.hp > 0) return amount;
    u.hp = 0;
    if(SIM.isHero(u)){
      u.dead = 1; u.respawnAt = W.t + 6; u.move = u.target = u.talkTo = null; u.dash = u.forced = u.spin = null; u.orbT = 0;
      u.shield = 0; u.buffT = u.boostT = u.stealthT = 0; u.cc = { stun: 0, root: 0, slow: 0, slowAmt: 0 };
      for(const m of W.mobs) if(m.aggro === u.id){ m.aggro = null; m.returning = true; }
      SIM.fx(W, { k: "died", side: u.side });
      for(const qid in u.quests){ const qs = u.quests[qid]; if(qs.state === "active" && qs.phase) SIM.failQuest(W, u, qid); }
    }else{
      u.dead = true;
      if(!u.event && MOBS[u.kind].count > 0) W.respawnQ.push({ kind: u.kind, at: W.t + MOBS[u.kind].respawn });
      SIM.fx(W, { k: "pop", x: u.x, y: u.y, id: u.id });
      const killer = W.heroes[(u.lastHit || "c:").slice(2)];
      const looter = killer || SIM.heroes(W).filter(h => !h.dead).sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0];
      // the killer and their nearby party members share XP, quest credit and quest drops
      const group = looter ? SIM.creditGroup(W, looter, u) : [];
      if(looter) SIM.dropBag(W, looter, u, group);
      for(const c of group){
        if(c.dead) continue;
        SIM.gainXp(W, c, mobXp(MOBS[u.kind].xp, MOBS[u.kind].lvl, c.lvl));
        for(const qid in c.quests){
          const qs = c.quests[qid], Q = QUESTS[qid];
          if(qs.state !== "active") continue;
          if(Q.obj.type === "kill" && Q.obj.kind === u.kind){
            qs.count = Math.min(Q.obj.count, qs.count + 1);
            SIM.fx(W, { k: "qprog", side: c.side, quest: qid, count: qs.count });
            if(qs.count >= Q.obj.count){ qs.state = "ready"; SIM.fx(W, { k: "qready", side: c.side, quest: qid }); }
          }else if(Q.obj.type === "loot" && Q.obj.from === u.kind && !W.loot.some(l => l.side === c.side && l.quest === qid)){
            const a = Math.random() * Math.PI * 2;
            W.loot.push({ id: "l" + W.nid++, side: c.side, quest: qid, item: Q.obj.item, x: clampX(u.x + Math.cos(a) * 70), y: clampY(u.y + Math.sin(a) * 70) });
            SIM.fx(W, { k: "drop", side: c.side, quest: qid });
          }
        }
      }
    }
    return amount;
  },
  talk(W, c, npc){
    const qf = questFor(c.quests, npc.id);
    SIM.fx(W, { k: "dialog", side: c.side, npc: npc.id, quest: qf.quest, state: qf.state });
  },
  pickup(W, c, l){
    if(l.bag){
      const got = [], left = [];
      for(const it of l.items){ if(SIM.addItem(c, it)) got.push({ n: it.n, r: it.r, q: it.q || 1 }); else left.push(it); }
      if(l.coins){ c.coins += l.coins; c.gearVer++; }
      SIM.fx(W, { k: "loot", side: c.side, coins: l.coins, items: got, full: left.length > 0 });
      l.coins = 0; l.items = left;
      if(left.length) l.blockT = W.t + 4; else W.loot = W.loot.filter(x => x !== l);
      return;
    }
    W.loot = W.loot.filter(x => x !== l);
    const qs = c.quests[l.quest], Q = QUESTS[l.quest];
    if(qs && qs.state === "active"){ qs.count = Q.obj.count; qs.state = "ready"; SIM.fx(W, { k: "looted", side: c.side, quest: l.quest }); SIM.fx(W, { k: "qready", side: c.side, quest: l.quest }); }
  },
  activeQuest(c, type){ return Object.keys(c.quests).find(id => QUESTS[id].obj.type === type && c.quests[id].state === "active"); },
  questReady(W, c, qid){ c.quests[qid].state = "ready"; SIM.fx(W, { k: "qready", side: c.side, quest: qid }); },
  progress(W, c, qid){
    const qs = c.quests[qid], Q = QUESTS[qid];
    qs.count = Math.min(Q.obj.count, qs.count + 1);
    SIM.fx(W, { k: "qprog", side: c.side, quest: qid, count: qs.count });
    if(qs.count >= Q.obj.count) SIM.questReady(W, c, qid);
  },
  failQuest(W, c, qid){
    const qs = c.quests[qid]; qs.state = "failed"; qs.phase = 0;
    SIM.clearEvent(W, c.side); SIM.fx(W, { k: "qfail", side: c.side, quest: qid });
  },
  clearEvent(W, side){ for(const m of W.mobs) if(m.event === side && !m.dead){ m.dead = true; SIM.fx(W, { k: "pop", x: m.x, y: m.y, id: m.id }); } },
  gather(W, c, n){
    const qid = SIM.activeQuest(c, "collect");
    if(!qid){ SIM.fx(W, { k: "msg", side: c.side, text: "A pretty flower. Someone might have a use for it." }); return; }
    n.ready = false; n.respawnAt = W.t + 25;
    SIM.fx(W, { k: "pick", x: n.x, y: n.y }); SIM.progress(W, c, qid);
    // party members gathering nearby get the flower too
    for(const m of SIM.partyMembers(W, c)){
      if(m === c || m.dead || Math.hypot(m.x - n.x, m.y - n.y) > SHARE_RANGE) continue;
      const mq = SIM.activeQuest(m, "collect"); if(mq) SIM.progress(W, m, mq);
    }
  },
  startUse(W, c, i){
    const qid = SIM.activeQuest(c, "interact");
    if(!qid){ SIM.fx(W, { k: "msg", side: c.side, text: c.quests.beacons && c.quests.beacons.state !== "active" ? "The beacon is already burning." : "A cold signal beacon. Captain Rhea might know what it's for." }); return; }
    if(c.quests[qid].flags[i]){ SIM.fx(W, { k: "msg", side: c.side, text: "This beacon is already burning." }); return; }
    c.channel = { i, t: 0, dur: 2.5, name: `Lighting the ${BEACONS[i].name}` }; c.move = c.target = null;
  },
  finishUse(W, c, i){
    const qid = SIM.activeQuest(c, "interact"); if(!qid) return;
    const qs = c.quests[qid]; if(qs.flags[i]) return;
    qs.flags[i] = 1; SIM.fx(W, { k: "lit", side: c.side, i }); SIM.progress(W, c, qid);
  },
  questTick(W, c){
    for(const qid in c.quests){
      const qs = c.quests[qid], Q = QUESTS[qid], o = Q.obj;
      if(qs.state !== "active") continue;
      if(o.type === "collect"){ for(const n of W.nodes) if(n.ready && Math.hypot(n.x - c.x, n.y - c.y) < 90){ SIM.gather(W, c, n); break; } }
      else if(o.type === "explore"){
        o.points.forEach((p, i) => {
          if(qs.state !== "active" || qs.flags[i] || Math.hypot(p.x - c.x, p.y - c.y) > 380) return;
          qs.flags[i] = 1; SIM.fx(W, { k: "explored", side: c.side, quest: qid, name: p.name, count: qs.count + 1 }); SIM.progress(W, c, qid);
        });
      }else if(o.type === "defend"){
        const d = Math.hypot(o.at.x - c.x, o.at.y - c.y);
        if(!qs.phase){ if(d < 550){ qs.phase = 1; qs.endAt = W.t + o.dur; qs.waveI = 0; qs.nextWave = W.t + 2; SIM.fx(W, { k: "defstart", side: c.side }); } }
        else if(d > 1150) SIM.failQuest(W, c, qid);
        else {
          if(qs.waveI < WAVES.length && W.t >= qs.nextWave){
            const n = WAVES[qs.waveI++];
            for(let k = 0; k < n; k++){ const a = -Math.PI / 2 + (Math.random() - .5) * 2.4, rr = 850 + Math.random() * 150; const m = SIM.spawnMob(W, "bandit", { x: clampX(o.at.x + Math.cos(a) * rr), y: clampY(o.at.y + Math.sin(a) * rr) }); m.event = c.side; m.aggro = c.id; }
            qs.nextWave = W.t + 14; SIM.fx(W, { k: "wave", side: c.side, n: qs.waveI, of: WAVES.length });
          }
          if(W.t >= qs.endAt){ qs.phase = 0; SIM.clearEvent(W, c.side); SIM.questReady(W, c, qid); SIM.fx(W, { k: "defwin", side: c.side }); }
        }
      }
    }
  },
  questView(W, c){
    const o = {};
    for(const id in c.quests){ const q = c.quests[id]; o[id] = { state: q.state, count: q.count }; if(q.flags && q.flags.length) o[id].flags = q.flags.slice(); if(q.phase){ o[id].phase = 1; o[id].left = Math.max(0, Math.ceil(q.endAt - W.t)); } if(q.deadline && q.state === "active") o[id].left = Math.max(0, Math.ceil(q.deadline - W.t)); }
    return o;
  },
  input(W, side, cmd){
    const c = SIM.hero(W, side); if(!c || !cmd || typeof cmd !== "object") return;
    if(SIM.socialInput(W, c, cmd)) return;
    if(cmd.stop){ c.move = c.target = c.talkTo = null; return; }
    if(cmd.accept){
      const Q = QUESTS[cmd.accept]; if(!Q) return;
      const npc = NPCS.find(n => n.id === Q.giver), qs = c.quests[Q.id];
      const prereq = prereqMet(c.quests, Q);
      if((!qs || qs.state === "failed") && prereq && Math.hypot(c.x - npc.x, c.y - npc.y) < 500){
        if(Q.obj.type === "defend") SIM.clearEvent(W, side);
        c.quests[Q.id] = { state: "active", count: 0, deadline: Q.timeLimit ? W.t + Q.timeLimit : 0, flags: [], phase: 0 };
        SIM.fx(W, { k: "qaccept", side, quest: Q.id });
      }
      return;
    }
    if(cmd.turnin){
      const Q = QUESTS[cmd.turnin]; if(!Q) return;
      const npc = NPCS.find(n => n.id === Q.turnin), qs = c.quests[Q.id];
      const ready = qs && (qs.state === "ready" || (qs.state === "active" && Q.obj.type === "deliver"));
      if(ready && Math.hypot(c.x - npc.x, c.y - npc.y) < 500){
        qs.state = "done";
        let item = null;
        let got = null;
        if(Q.reward === "weapon") got = SIM.questWeapon(W, c);
        else if(Q.reward && Q.reward.item !== undefined){
          got = genItem({ ilvl: c.lvl + 1, rarity: Q.reward.item, cls: c.kit.cls, slot: Q.reward.slot || ARMOR_SLOTS[Math.floor(Math.random() * ARMOR_SLOTS.length)], nid: W.nid++ });
          if(Q.reward.name) got.n = `${Q.reward.name} ${BASE_NAMES[got.s][got.m]}`;
        }
        if(got){ item = got.n; SIM.giveReward(W, c, got); }
        if(Q.coins){ c.coins += Q.coins; c.gearVer++; }
        const xp = questXp(Q, c.lvl);
        SIM.fx(W, { k: "qdone", side, quest: Q.id, xp, item, itemR: got ? got.r : 0, coins: Q.coins || 0 });
        SIM.gainXp(W, c, xp);
      }
      return;
    }
    if(cmd.talent){
      const [slot, node] = String(cmd.talent).split(".");
      if(canTalent(c.lvl, c.talents, slot, node)){ c.talents[slot][node]++; if(slot === "core") SIM.recalc(c); SIM.fx(W, { k: "talent", side }); }
      return;
    }
    if(cmd.respec){ c.talents = newTalents(); SIM.recalc(c); SIM.fx(W, { k: "talent", side }); return; }
    if(cmd.equip){
      const i = c.inv.findIndex(x => x.id === String(cmd.equip)), it = c.inv[i];
      if(!it || !EQ_SLOTS.includes(it.s)) return;
      const prev = c.equip[it.s]; c.equip[it.s] = it; c.inv.splice(i, 1); if(prev) c.inv.splice(i, 0, prev);
      SIM.recalc(c); c.gearVer++; return;
    }
    if(cmd.unequip){
      const sl = String(cmd.unequip); if(!EQ_SLOTS.includes(sl) || !c.equip[sl]) return;
      if(c.inv.length >= BAG_SIZE){ SIM.fx(W, { k: "msg", side, text: "Your bags are full." }); return; }
      c.inv.push(c.equip[sl]); delete c.equip[sl]; SIM.recalc(c); c.gearVer++; return;
    }
    if(cmd.salvage){
      const i = c.inv.findIndex(x => x.id === String(cmd.salvage)), it = c.inv[i]; if(!it) return;
      const val = it.v * (it.q || 1); c.coins += val; c.inv.splice(i, 1); c.gearVer++;
      SIM.fx(W, { k: "salvage", side, n: it.n, coins: val }); return;
    }
    if(cmd.pickup){
      const l = W.loot.find(x => x.id === String(cmd.pickup) && x.side === side);
      if(l && !c.dead){ c.lootTo = l.id; c.move = c.target = c.talkTo = null; }
      return;
    }
    if(c.dead) return;
    if(cmd.move || cmd.atk || cmd.talk || cmd.gather || cmd.use !== undefined){ c.lootTo = null; c.gatherTo = null; c.useTo = null; c.channel = null; }
    if(cmd.gather){ const n = W.nodes.find(x => x.id === String(cmd.gather)); if(n){ c.gatherTo = n.id; c.move = c.target = c.talkTo = null; } return; }
    if(cmd.use !== undefined){ const i = +cmd.use; if(BEACONS[i]){ c.useTo = i; c.move = c.target = c.talkTo = null; } return; }
    if(cmd.talk){ const npc = NPCS.find(n => n.id === cmd.talk); if(npc){ c.talkTo = npc.id; c.target = null; c.move = null; } return; }
    if(cmd.move){ c.move = [clampX(+cmd.move[0] || 0), clampY(+cmd.move[1] || 0)]; c.target = null; c.talkTo = null; }
    else if(cmd.atk){ const t = SIM.find(W, String(cmd.atk)); if(t && t.team !== c.team){ c.target = t.id; c.move = null; c.talkTo = null; } }
    else if(cmd.cast && ["Q", "W", "E", "R"].includes(cmd.cast) && Array.isArray(cmd.at)) SIM.cast(W, c, cmd.cast, [+cmd.at[0] || 0, +cmd.at[1] || 0]);
  },
  cast(W, c, key, at){
    if(c.dead || c.cds[key] > 0 || c.dash || !SIM.canAct(c)) return;
    if(key === "R" && c.lvl < 3) return;
    c.channel = null; c.useTo = null;
    const p = applyTalents(c.kit[key], c.talents[key]);
    const ax = at[0] - c.x, ay = at[1] - c.y, d = Math.hypot(ax, ay) || 1, nx = ax / d, ny = ay / d;
    const reach = Math.min(p.range || 0, d), tx = clampX(c.x + nx * reach), ty = clampY(c.y + ny * reach);
    switch(p.type){
      case "bolt": case "hook":
        W.shots.push({ id: "s" + W.nid++, kind: p.type === "hook" ? "hook" : "sk", slot: key, team: c.team, owner: c.id,
          x: c.x + nx * 60, y: c.y + ny * 60, vx: nx * p.speed, vy: ny * p.speed, life: p.range / p.speed, r: p.width, p, hits: new Set() });
        if(p.extra) for(const a of [-.22, .22]){
          const ex = nx * Math.cos(a) - ny * Math.sin(a), ey = nx * Math.sin(a) + ny * Math.cos(a), pe = Object.assign({}, p, { dmg: p.dmg * .6 });
          W.shots.push({ id: "s" + W.nid++, kind: "sk", slot: key, team: c.team, owner: c.id, x: c.x + ex * 60, y: c.y + ey * 60, vx: ex * p.speed, vy: ey * p.speed, life: p.range / p.speed, r: p.width, p: pe, hits: new Set() });
        }
        break;
      case "dash": case "leap":
        c.dash = { sx: c.x, sy: c.y, tx, ty, t: 0, dur: p.type === "leap" ? .35 : .2, p, hits: new Set() }; c.move = null; c.target = null; break;
      case "blink": {
        const ox = c.x, oy = c.y;
        if(p.origin){ SIM.burst(W, c, ox, oy, p.radius, p); SIM.fx(W, { k: "ring", x: ox, y: oy, r: p.radius }); }
        c.x = tx; c.y = ty; c.move = null;
        SIM.fx(W, { k: "blink", x: ox, y: oy, x2: c.x, y2: c.y });
        if(p.dmg) SIM.burst(W, c, c.x, c.y, p.radius, p);
        break;
      }
      case "aoe": W.zones.push({ id: "z" + W.nid++, team: c.team, owner: c.id, slot: key, x: tx, y: ty, r: p.radius, t: p.delay, dur: p.delay, p }); break;
      case "cone": {
        const half = p.angle / 2 * Math.PI / 180;
        for(const u of SIM.enemies(W, c.team)){
          const ux = u.x - c.x, uy = u.y - c.y, ud = Math.hypot(ux, uy) || 1;
          if(ud < p.range + u.r && Math.acos(Math.max(-1, Math.min(1, (ux * nx + uy * ny) / ud))) <= half + Math.atan2(u.r, ud)) SIM.hitAbility(W, c, u, p);
        }
        SIM.fx(W, { k: "cone", x: c.x, y: c.y, dx: nx, dy: ny, r: p.range, ang: p.angle });
        break;
      }
      case "spin": c.spin = { left: p.dur, done: 0, p }; break;
      case "shield":
        c.shield = p.amount * (1 + .1 * (c.lvl - 1)); c.shieldT = p.dur; c.boostT = 2; c.boost = p.boost;
        if(p.cleanse) c.cc = { stun: 0, root: 0, slow: 0, slowAmt: 0 };
        if(p.dmg){ SIM.burst(W, c, c.x, c.y, p.radius, p); SIM.fx(W, { k: "ring", x: c.x, y: c.y, r: p.radius }); }
        break;
      case "heal":
        c.hp = Math.min(c.maxHp, c.hp + p.amount * (1 + .1 * (c.lvl - 1))); SIM.fx(W, { k: "heal", side: c.side });
        if(p.dmg){ SIM.burst(W, c, c.x, c.y, p.radius, p); SIM.fx(W, { k: "ring", x: c.x, y: c.y, r: p.radius }); }
        break;
      case "steroid": c.buffT = p.dur; c.buffAS = p.as; c.buffOnHit = p.onHit * SIM.dmgScale(c); break;
      case "field": W.fields.push({ id: "f" + W.nid++, team: c.team, owner: c.id, slot: key, x: tx, y: ty, r: p.radius, t: p.dur, tick: 0, p }); break;
      case "summon": {
        const n = p.count || 1;
        for(let i = 0; i < n; i++){ const off = n > 1 ? (i ? 130 : -130) : 0; W.pets.push({ id: "p" + W.nid++, team: c.team, owner: c.id, slot: key, x: clampX(tx - ny * off), y: clampY(ty + nx * off), t: p.dur, atkT: .3 + i * .2, p }); }
        break;
      }
      case "stealth": c.stealthT = p.dur; c.boostT = p.dur; c.boost = p.boost; c.ambush = !!p.ambush; break;
      case "orbit": c.orbT = p.dur; c.orbHits = {}; c.orbP = p; c.orbN = p.orbs || 3; break;
    }
    if(!["steroid", "stealth", "shield", "heal"].includes(p.type)) c.face = Math.atan2(nx, ny);
    c.cds[key] = Math.round(p.cd * (1 - (c.hasteG || 0) / 100) * 10) / 10; c.castSeq++; c.castKey = key; c.lastCombat = W.t;
  },
  tickTimers(u, dt){
    u.cc.stun = Math.max(0, u.cc.stun - dt); u.cc.root = Math.max(0, u.cc.root - dt);
    if(u.cc.slow > 0){ u.cc.slow -= dt; if(u.cc.slow <= 0){ u.cc.slow = 0; u.cc.slowAmt = 0; } }
    if(u.forced){ const f = u.forced; f.t += dt; const k = Math.min(1, f.t / f.dur); u.x = f.sx + (f.tx - f.sx) * k; u.y = f.sy + (f.ty - f.sy) * k; if(k >= 1) u.forced = null; }
  },
  step(W, dt){
    W.t += dt;
    W.respawnQ = W.respawnQ.filter(r => { if(W.t >= r.at){ SIM.spawnMob(W, r.kind); return false; } return true; });
    for(const n of W.nodes) if(!n.ready && W.t >= n.respawnAt) n.ready = true;
    W.loot = W.loot.filter(l => !l.expires || l.expires > W.t);
    SIM.socialTick(W);
    // heroes
    for(const c of SIM.heroes(W)){
      for(const k in c.cds) c.cds[k] = Math.max(0, c.cds[k] - dt);
      if(c.dead){ if(W.t >= c.respawnAt){ const home = SIM.respawnAt(c); c.dead = 0; c.hp = c.maxHp; c.x = home[0]; c.y = home[1]; SIM.fx(W, { k: "spawn", side: c.side }); } continue; }
      SIM.tickTimers(c, dt);
      c.shieldT -= dt; if(c.shieldT <= 0) c.shield = 0;
      c.buffT = Math.max(0, c.buffT - dt); c.boostT = Math.max(0, c.boostT - dt); c.stealthT = Math.max(0, c.stealthT - dt);
      c.moving = false;
      if(c.dash){
        const ds = c.dash; ds.t += dt; const k = Math.min(1, ds.t / ds.dur);
        c.x = ds.sx + (ds.tx - ds.sx) * k; c.y = ds.sy + (ds.ty - ds.sy) * k; c.moving = true;
        if(ds.p.type === "dash") for(const u of SIM.enemies(W, c.team)) if(!ds.hits.has(u.id) && Math.hypot(u.x - c.x, u.y - c.y) < c.r + u.r + 40){ ds.hits.add(u.id); SIM.hitAbility(W, c, u, ds.p); }
        if(k >= 1){
          c.dash = null;
          if(ds.p.type === "leap"){
            for(const u of SIM.enemies(W, c.team)){
              const dd = Math.hypot(u.x - c.x, u.y - c.y) || 1;
              if(dd < ds.p.radius + u.r){ SIM.hitAbility(W, c, u, ds.p); if(!ds.p.cc.stun && !ds.p.cc.root && !u.dead) SIM.force(u, u.x + (u.x - c.x) / dd * 180, u.y + (u.y - c.y) / dd * 180, .15); }
            }
            SIM.fx(W, { k: "ring", x: c.x, y: c.y, r: ds.p.radius });
          }
        }
      }else if(!c.forced){
        let goal = null, tgt = SIM.find(W, c.target);
        if(c.target && !tgt) c.target = null;
        if(c.channel){
          c.channel.t += dt;
          if(c.channel.t >= c.channel.dur){ const ch = c.channel; c.channel = null; SIM.finishUse(W, c, ch.i); }
        }else if(c.gatherTo){
          const n = W.nodes.find(x => x.id === c.gatherTo);
          if(!n || !n.ready) c.gatherTo = null;
          else if(Math.hypot(n.x - c.x, n.y - c.y) < 130){ SIM.gather(W, c, n); c.gatherTo = null; }
          else goal = [n.x, n.y];
        }else if(c.useTo !== null && c.useTo !== undefined){
          const b = BEACONS[c.useTo];
          if(Math.hypot(b.x - c.x, b.y - c.y) < 230){ const i = c.useTo; c.useTo = null; SIM.startUse(W, c, i); }
          else goal = [b.x, b.y];
        }else if(c.lootTo){
          const l = W.loot.find(x => x.id === c.lootTo);
          if(!l) c.lootTo = null;
          else if(Math.hypot(l.x - c.x, l.y - c.y) < 140){ SIM.pickup(W, c, l); c.lootTo = null; }
          else goal = [l.x, l.y];
        }else if(c.talkTo){
          const npc = NPCS.find(n => n.id === c.talkTo);
          if(Math.hypot(npc.x - c.x, npc.y - c.y) < 280){ SIM.talk(W, c, npc); c.talkTo = null; c.face = Math.atan2(npc.x - c.x, npc.y - c.y); }
          else goal = [npc.x, npc.y];
        }else if(tgt){
          const d = Math.hypot(tgt.x - c.x, tgt.y - c.y);
          if(d <= c.range + c.r + tgt.r){
            c.face = Math.atan2(tgt.x - c.x, tgt.y - c.y);
            if(c.atkT <= 0 && SIM.canAct(c)){
              c.atkT = 1 / (c.as * (1 + (c.buffT > 0 ? c.buffAS : 0))); c.atkSeq++;
              let dmg = c.ad + (c.buffT > 0 ? c.buffOnHit : 0);
              if(c.ambush){ dmg *= 2.5; c.ambush = false; }
              if(c.stealthT > 0) c.stealthT = 0;
              if(c.ranged) W.shots.push({ id: "s" + W.nid++, kind: "aa", team: c.team, owner: c.id, target: tgt.id, x: c.x, y: c.y, speed: 1800, dmg, life: 2 });
              else SIM.damage(W, tgt, dmg, c);
            }
          }else goal = [tgt.x, tgt.y];
        }else if(c.move) goal = c.move;
        if(goal && SIM.canMove(c)){
          const dx = goal[0] - c.x, dy = goal[1] - c.y, d = Math.hypot(dx, dy);
          if(d < 8 && !tgt && !c.talkTo) c.move = null;
          else if(d > 0){ const s = Math.min(d, SIM.effMs(c) * dt); c.x += dx / d * s; c.y += dy / d * s; c.face = Math.atan2(dx, dy); c.moving = true; }
        }
      }
      c.atkT -= dt;
      if(c.spin){
        const sp = c.spin, every = sp.p.dur / sp.p.ticks; sp.left -= dt;
        while(sp.done < sp.p.ticks && sp.p.dur - sp.left >= sp.done * every){ SIM.burst(W, c, c.x, c.y, sp.p.radius, sp.p); SIM.fx(W, { k: "ring", x: c.x, y: c.y, r: sp.p.radius }); sp.done++; }
        if(sp.done >= sp.p.ticks) c.spin = null;
      }
      if(c.orbT > 0){
        c.orbT -= dt; c.orbA += dt * 3.2;
        const op = c.orbP || { dmg: 28, cc: {} };
        const on = c.orbN || 3;
        for(let i = 0; i < on; i++){
          const a = c.orbA + i * Math.PI * 2 / on, ox = c.x + Math.cos(a) * 230, oy = c.y + Math.sin(a) * 230;
          for(const u of SIM.enemies(W, c.team)) if(Math.hypot(u.x - ox, u.y - oy) < 70 + u.r && (c.orbHits[u.id + ":" + i] || 0) <= W.t){ SIM.hitAbility(W, c, u, op); c.orbHits[u.id + ":" + i] = W.t + .5; }
        }
      }
      // walking over your own quest loot picks it up; timed quests expire
      for(const l of W.loot) if(l.side === c.side && !(l.blockT > W.t) && Math.hypot(l.x - c.x, l.y - c.y) < 110){ SIM.pickup(W, c, l); break; }
      SIM.questTick(W, c);
      for(const qid in c.quests){ const qs = c.quests[qid]; if(qs.state === "active" && qs.deadline && W.t > qs.deadline){ qs.state = "failed"; SIM.fx(W, { k: "qfail", side: c.side, quest: qid }); } }
      // resting: fast regen out of combat, faster by the campfire
      const resting = W.t - c.lastCombat > 5, byFire = FIRES.some(f => Math.hypot(c.x - f[0], c.y - f[1]) < 700);
      c.hp = Math.min(c.maxHp, c.hp + c.maxHp * (byFire ? .12 : resting ? .04 : .005) * dt);
    }
    // mobs
    for(const m of W.mobs){
      if(m.dead) continue;
      SIM.tickTimers(m, dt); m.atkT -= dt; m.moving = false;
      if(m.forced || m.cc.stun > 0) continue;
      const T = MOBS[m.kind], rooted = m.cc.root > 0;
      // the Old Tusker paws the ground, then charges in a straight line
      if(m.windup > 0){
        m.windup -= dt;
        if(m.windup <= 0){
          const t = SIM.find(W, m.aggro);
          if(t){ const dx = t.x - m.x, dy = t.y - m.y, d = Math.hypot(dx, dy) || 1, len = Math.min(d + 160, 950); m.charging = { sx: m.x, sy: m.y, tx: clampX(m.x + dx / d * len), ty: clampY(m.y + dy / d * len), t: 0, dur: len / 1400, hit: false }; m.face = Math.atan2(dx, dy); }
        }
        continue;
      }
      if(m.charging){
        const ch = m.charging; ch.t += dt; const k = Math.min(1, ch.t / ch.dur);
        m.x = ch.sx + (ch.tx - ch.sx) * k; m.y = ch.sy + (ch.ty - ch.sy) * k; m.moving = true;
        if(!ch.hit) for(const h of SIM.heroes(W)){
          if(h.dead) continue; const dd = Math.hypot(h.x - m.x, h.y - m.y) || 1;
          if(dd < m.r + h.r + 30){ ch.hit = true; SIM.damage(W, h, 70, m); if(!h.dead){ SIM.force(h, h.x + (h.x - m.x) / dd * 260, h.y + (h.y - m.y) / dd * 260, .2); SIM.applyCC(h, { stun: .5 }); } SIM.fx(W, { k: "hit", x: h.x, y: h.y }); }
        }
        if(k >= 1) m.charging = null;
        continue;
      }
      const moveTo = (x, y, spd) => { if(rooted) return; const dx = x - m.x, dy = y - m.y, d = Math.hypot(dx, dy); if(d < 1) return; const s = Math.min(d, spd * dt); m.x += dx / d * s; m.y += dy / d * s; m.face = Math.atan2(dx, dy); m.moving = true; };
      if(m.aggro){
        const t = SIM.find(W, m.aggro);
        if(!t || !SIM.visibleTo(t, "mob") || Math.hypot(m.x - m.home[0], m.y - m.home[1]) > T.leash){ m.aggro = null; m.returning = true; }
        else {
          const d = Math.hypot(t.x - m.x, t.y - m.y);
          if(T.charge && W.t >= m.chargeCd && d > 320 && d < 1000 && !rooted){ m.windup = .7; m.chargeCd = W.t + 7; SIM.fx(W, { k: "roar", id: m.id }); continue; }
          if(d <= m.r + t.r + 40){ m.face = Math.atan2(t.x - m.x, t.y - m.y); if(m.atkT <= 0){ m.atkT = T.atkCd; SIM.damage(W, t, m.dmg, m); SIM.fx(W, { k: "butt", id: m.id }); } }
          else moveTo(t.x, t.y, SIM.effMs(m));
        }
      }else if(m.returning){
        m.hp = Math.min(m.maxHp, m.hp + m.maxHp * .5 * dt);
        moveTo(m.home[0], m.home[1], 420);
        if(Math.hypot(m.x - m.home[0], m.y - m.home[1]) < 200){ m.returning = false; m.hp = m.maxHp; m.windup = 0; m.charging = null; }
      }else{
        if(T.aggroR && SIM.scanAggro(W, m, T)) continue;
        if(!m.wp){ m.wait -= dt; if(m.wait <= 0){ const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * T.roam; m.wp = [m.home[0] + Math.cos(a) * r, m.home[1] + Math.sin(a) * r]; } }
        else { moveTo(m.wp[0], m.wp[1], T.wander); if(Math.hypot(m.wp[0] - m.x, m.wp[1] - m.y) < 20){ m.wp = null; m.wait = 1 + Math.random() * 4; } }
      }
    }
    // separation, obstacles, zone edges
    const all = SIM.units(W);
    for(let i = 0; i < all.length; i++) for(let j = i + 1; j < all.length; j++){
      const a = all[i], b = all[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = (a.r + b.r) * .85;
      if(d < min && d > .01){ const push = (min - d) / 2, nx = dx / d, ny = dy / d; if(!a.dash && !a.forced){ a.x -= nx * push; a.y -= ny * push; } if(!b.dash && !b.forced){ b.x += nx * push; b.y += ny * push; } }
    }
    for(const u of all){
      for(const o of OBSTACLES){ const dx = u.x - o.x, dy = u.y - o.y, d = Math.hypot(dx, dy), min = o.r + u.r; if(d < min && d > .01){ u.x = o.x + dx / d * min; u.y = o.y + dy / d * min; } }
      if(Math.hypot(u.x - POND.x, u.y - POND.y) < POND.r * .62){ const dx = u.x - POND.x, dy = u.y - POND.y, d = Math.hypot(dx, dy) || 1; u.x = POND.x + dx / d * POND.r * .62; u.y = POND.y + dy / d * POND.r * .62; }
      u.x = clampX(u.x); u.y = clampY(u.y);
    }
    // projectiles
    for(const sh of W.shots){
      sh.life -= dt;
      const owner = W.heroes[sh.owner.slice(2)];
      if(!owner){ sh.life = 0; continue; }
      if(sh.kind === "sk" || sh.kind === "hook"){
        sh.x += sh.vx * dt; sh.y += sh.vy * dt;
        for(const u of SIM.units(W)){
          if(u.team === sh.team || sh.hits.has(u.id) || Math.hypot(u.x - sh.x, u.y - sh.y) >= sh.r + u.r) continue;
          sh.hits.add(u.id); SIM.hitAbility(W, owner, u, sh.p); SIM.fx(W, { k: "hit", x: sh.x, y: sh.y });
          if(sh.kind === "hook" && !u.dead){ const dx = u.x - owner.x, dy = u.y - owner.y, d = Math.hypot(dx, dy) || 1, gap = owner.r + u.r + 30; SIM.force(u, owner.x + dx / d * gap, owner.y + dy / d * gap, .25); }
          if(!sh.p.pierce){ sh.life = 0; break; }
        }
      }else{
        const t = SIM.find(W, sh.target); if(!t){ sh.life = 0; continue; }
        const dx = t.x - sh.x, dy = t.y - sh.y, d = Math.hypot(dx, dy), stp = sh.speed * dt;
        if(d <= stp + t.r){ SIM.damage(W, t, sh.dmg, owner); sh.life = 0; } else { sh.x += dx / d * stp; sh.y += dy / d * stp; }
      }
    }
    W.shots = W.shots.filter(sh => sh.life > 0);
    for(const z of W.zones){ z.t -= dt; if(z.t <= 0){ const o = W.heroes[z.owner.slice(2)]; if(o) SIM.burst(W, o, z.x, z.y, z.r, z.p); SIM.fx(W, { k: "nova", x: z.x, y: z.y, r: z.r }); } }
    W.zones = W.zones.filter(z => z.t > 0);
    for(const f of W.fields){
      f.t -= dt; f.tick -= dt;
      const o = W.heroes[f.owner.slice(2)]; if(!o){ f.t = 0; continue; }
      if(f.tick <= 0){ f.tick = .5; for(const u of SIM.enemies(W, f.team)) if(Math.hypot(u.x - f.x, u.y - f.y) < f.r + u.r){ SIM.damage(W, u, f.p.dmg * SIM.dmgScale(o), o); SIM.applyCC(u, Object.assign({}, f.p.cc, { slow: Math.max(f.p.slow, f.p.cc.slow || 0) })); } }
    }
    W.fields = W.fields.filter(f => f.t > 0);
    for(const pt of W.pets){
      pt.t -= dt; pt.atkT -= dt;
      const o = W.heroes[pt.owner.slice(2)]; if(!o){ pt.t = 0; continue; }
      if(pt.atkT > 0) continue;
      let best = null, bd = pt.p.atkRange;
      for(const u of SIM.enemies(W, pt.team)){ const d = Math.hypot(u.x - pt.x, u.y - pt.y); if(d < bd){ bd = d; best = u; } }
      if(best){ pt.atkT = .8; W.shots.push({ id: "s" + W.nid++, kind: "aa", team: pt.team, owner: o.id, target: best.id, x: pt.x, y: pt.y, speed: 1600, dmg: pt.p.dmg * SIM.dmgScale(o), life: 2 }); }
    }
    W.pets = W.pets.filter(pt => pt.t > 0);
    W.mobs = W.mobs.filter(m => !m.dead);
  },
  snapshot(W){
    const r = v => Math.round(v);
    return { ...SIM.socialSnapshot(W),
      t: Math.round(W.t * 100) / 100,
      h: SIM.heroes(W).map(c => ({
        side: c.side, champId: c.champId, name: c.name, x: r(c.x), y: r(c.y), hp: r(c.hp), maxHp: r(c.maxHp), lvl: c.lvl, xp: r(c.xp), xpNext: SIM.xpNext(c.lvl),
        face: Math.round(c.face * 100) / 100, moving: c.moving ? 1 : 0, dead: c.dead ? Math.max(1, Math.ceil(c.respawnAt - W.t)) : 0,
        castSeq: c.castSeq, castKey: c.castKey, atkSeq: c.atkSeq, cds: { Q: +c.cds.Q.toFixed(1), W: +c.cds.W.toFixed(1), E: +c.cds.E.toFixed(1), R: +c.cds.R.toFixed(1) },
        orbT: c.orbT > 0 ? 1 : 0, orbA: Math.round(c.orbA * 100) / 100, shield: r(c.shield), buff: c.buffT > 0 ? 1 : 0, stealth: c.stealthT > 0 ? 1 : 0,
        cc: c.cc.stun > 0 ? "stun" : c.cc.root > 0 ? "root" : c.cc.slow > 0 ? "slow" : "", quests: SIM.questView(W, c), weapon: c.weapon ? c.weapon.name : null,
        talents: c.talents, points: talentPoints(c.lvl, c.talents), orbN: c.orbN || 3, ad: Math.round(c.ad),
        wglow: c.weapon && c.weapon.glow ? 1 : 0, coins: c.coins, ap: Math.round(c.ap), armor: Math.round(c.armor), haste: Math.round(c.hasteG), msPct: Math.round(c.msPct),
        chan: c.channel ? { n: c.channel.name, p: Math.round(c.channel.t / c.channel.dur * 100) / 100 } : null, party: c.party || "",
        gear: { ver: c.gearVer, inv: c.inv, equip: c.equip } })),
      m: W.mobs.map(m => [m.id, m.kind, r(m.x), r(m.y), r(m.hp), r(m.maxHp), Math.round(m.face * 10) / 10, (m.moving ? 1 : 0) | (m.aggro ? 2 : 0) | (m.charging ? 4 : 0) | (m.windup > 0 ? 8 : 0)]),
      l: W.loot.map(l => [l.id, l.side, l.item, r(l.x), r(l.y), l.rar || 0]),
      n: W.nodes.map(n => [n.id, r(n.x), r(n.y), n.ready ? 1 : 0]),
      s: W.shots.map(sh => [sh.id, sh.kind, r(sh.x), r(sh.y), sh.owner, sh.slot || ""]),
      z: W.zones.map(z => [z.id, r(z.x), r(z.y), z.r, Math.round(z.t * 100) / 100, z.dur, z.slot, z.owner]),
      f: W.fields.map(f => [f.id, r(f.x), r(f.y), f.r, f.slot, f.owner]),
      p: W.pets.map(pt => [pt.id, r(pt.x), r(pt.y), pt.slot, pt.owner]),
    };
  },
};
