"use strict";
// Raid bosses: Skarnvir the Rimewyrm. Threat, telegraphed attacks, adds, raid loot. Adds to SIM (host only).

/* =====================================================================
   RAID BOSS
   A party of 3+ is needed: a tank holds the boss's attention (melee champions build threat
   three times faster), a healer keeps them alive, and damage dealers stay out of the breath
   and away from the tail. Attackers without a party of 3+ nearby barely scratch him.
   ===================================================================== */
const RAID = {
  party: 3,            // party members needed nearby for full damage
  soloDmg: .1,         // share of damage dealt without that party
  tankThreat: 3,       // threat multiplier for melee champions
  healThreat: .5,      // threat per point healed or shielded
  breath: { cd: 13, wind: 1.6, range: 1200, angle: 70, dmg: 300, slow: .5 },
  tail: { cd: 7, wind: .8, reach: 450, angle: 110, dmg: 170, push: 320, stun: .4 },
  storm: { below: .5, every: 5, dmg: 85, radius: 1500 },
  whelps: { at: [.7, .35], n: 4 },
  enrage: { below: .15, speed: .65, dmg: 1.3 },
};

Object.assign(SIM, {
  raidReady(W, c, boss){ return SIM.partyMembers(W, c).filter(h => !h.dead && Math.hypot(h.x - boss.x, h.y - boss.y) < 2600).length >= RAID.party; },
  bossArena(W, m){ const T = MOBS[m.kind]; return SIM.heroes(W).filter(h => !h.dead && Math.hypot(h.x - T.home[0], h.y - T.home[1]) < T.leash); },
  bossSay(W, m, big, small){ const sides = SIM.heroes(W).filter(h => Math.hypot(h.x - m.x, h.y - m.y) < 3000).map(h => h.side); if(sides.length) SIM.fx(W, { k: "bossmsg", to: sides, big, small }); },
  bossStart(W, m, hero){
    if(MOBS[m.kind].script) return SIM.dbossStart(W, m, hero); // cathedral bosses (05g-dungeon.js)
    Object.assign(m, { threat: { [hero.id]: 1 }, aggro: hero.id, whelped: {}, stormT: RAID.storm.every, breathCd: 8, tailCd: 5, pickT: 0, cast: null, warned: 0 });
    SIM.bossSay(W, m, `${m.name} awakens!`, "Rare Raid Boss · bring a party of 3 or more");
  },
  bossReset(W, m){
    const T = MOBS[m.kind];
    Object.assign(m, { aggro: null, threat: {}, cast: null, hp: m.maxHp, x: T.home[0], y: T.home[1], atkT: 0 });
    SIM.clearEvent(W, "raid:" + m.id);
    SIM.bossSay(W, m, `${m.name} returns to his roost`, "The fight has reset");
  },
  // a hero hit the boss: track threat, and scale the damage down without a party
  bossHit(W, m, c, amount){
    if(!m.aggro) SIM.bossStart(W, m, c);
    if(!SIM.raidReady(W, c, m)){
      amount *= RAID.soloDmg;
      if(!(c.soloWarnT > W.t)){ c.soloWarnT = W.t + 8; SIM.fx(W, { k: "msg", side: c.side, text: `${m.name}'s scales turn your blows aside. You need a party of ${RAID.party} or more nearby.` }); }
    }
    if(m.exposedT > W.t) amount *= DUNGEON.exposed; // the Saint, right after his choir falls
    m.threat[c.id] = (m.threat[c.id] || 0) + amount * (c.merc && c.merc.role === "tank" ? MERCS.tankThreat : c.kit.cls === "melee" ? RAID.tankThreat : 1);
    return amount;
  },
  // healing and shielding draws a little of the boss's attention
  healThreat(W, c, amount){
    for(const m of W.mobs) if(m.boss && m.aggro && !m.dead && Math.hypot(c.x - m.x, c.y - m.y) < 2600) m.threat[c.id] = (m.threat[c.id] || 0) + amount * RAID.healThreat;
  },
  inCone(m, h, dx, dy, range, angle){
    const vx = h.x - m.x, vy = h.y - m.y, d = Math.hypot(vx, vy) || 1;
    return d < range + h.r && Math.acos(Math.max(-1, Math.min(1, (vx * dx + vy * dy) / d))) <= angle / 2 * Math.PI / 180 + Math.atan2(h.r, d);
  },
  bossTick(W, m, dt){
    const T = MOBS[m.kind], arena = SIM.bossArena(W, m);
    m.moving = false;
    if(!m.aggro){
      m.hp = Math.min(m.maxHp, m.hp + m.maxHp * .05 * dt);
      const h = arena.find(h => SIM.visibleTo(h, "mob") && Math.hypot(h.x - m.x, h.y - m.y) < T.aggroR + m.r);
      if(h) SIM.bossStart(W, m, h);
      return;
    }
    if(!arena.length || Math.hypot(m.x - T.home[0], m.y - T.home[1]) > T.leash){ SIM.bossReset(W, m); return; }
    // the target is whoever has the most threat
    m.pickT -= dt;
    if(m.pickT <= 0){ m.pickT = .5; let best = null, bt = -1; for(const h of arena){ const th = m.threat[h.id] || 0; if(th > bt){ bt = th; best = h; } } m.aggro = best.id; }
    const t = SIM.find(W, m.aggro) || arena[0], hpPct = m.hp / m.maxHp, enraged = hpPct < RAID.enrage.below;
    if(enraged && !m.warned){ m.warned = 1; SIM.bossSay(W, m, `${m.name} is enraged!`, "Finish him!"); }
    // whelps join the fight
    for(const at of RAID.whelps.at) if(hpPct < at && !m.whelped[at]){
      m.whelped[at] = 1; SIM.bossSay(W, m, "The brood answers!", "Frost whelps join the fight");
      for(let k = 0; k < RAID.whelps.n; k++){ const a = k / RAID.whelps.n * Math.PI * 2, w = SIM.spawnMob(W, "whelp", { x: clampX(m.x + Math.cos(a) * (m.r + 260)), y: clampY(m.y + Math.sin(a) * (m.r + 260)) }); w.event = "raid:" + m.id; w.aggro = arena[k % arena.length].id; }
    }
    // a blizzard hits everyone in the lair
    if(hpPct < RAID.storm.below){
      m.stormT -= dt;
      if(m.stormT <= 0){ m.stormT = RAID.storm.every; SIM.fx(W, { k: "nova", x: m.x, y: m.y, r: RAID.storm.radius, frost: 1 }); for(const h of arena) if(Math.hypot(h.x - m.x, h.y - m.y) < RAID.storm.radius) SIM.damage(W, h, RAID.storm.dmg, m); }
    }
    // a telegraphed attack is winding up
    if(m.cast){
      m.cast.t -= dt;
      if(m.cast.t > 0) return;
      const cs = m.cast; m.cast = null;
      if(cs.kind === "breath"){
        const B = RAID.breath; SIM.fx(W, { k: "cone", x: m.x, y: m.y, dx: cs.dx, dy: cs.dy, r: B.range, ang: B.angle, frost: 1 });
        for(const h of SIM.bossArena(W, m)) if(SIM.inCone(m, h, cs.dx, cs.dy, B.range, B.angle)){ SIM.damage(W, h, B.dmg, m); SIM.applyCC(h, { slow: B.slow }); }
      }else{
        const L = RAID.tail; SIM.fx(W, { k: "cone", x: m.x, y: m.y, dx: cs.dx, dy: cs.dy, r: m.r + L.reach, ang: L.angle, frost: 1 });
        for(const h of SIM.bossArena(W, m)) if(SIM.inCone(m, h, cs.dx, cs.dy, m.r + L.reach, L.angle)){
          SIM.damage(W, h, L.dmg, m);
          if(!h.dead){ const dd = Math.hypot(h.x - m.x, h.y - m.y) || 1; SIM.force(h, h.x + (h.x - m.x) / dd * L.push, h.y + (h.y - m.y) / dd * L.push, .25); SIM.applyCC(h, { stun: L.stun }); }
        }
      }
      return;
    }
    m.breathCd -= dt; m.tailCd -= dt;
    const d = Math.hypot(t.x - m.x, t.y - m.y), fx = Math.sin(m.face), fy = Math.cos(m.face);
    // Frost Breath: a cone toward the target, marked on the ground first
    if(m.breathCd <= 0 && d < RAID.breath.range){
      const B = RAID.breath, dx = (t.x - m.x) / (d || 1), dy = (t.y - m.y) / (d || 1);
      m.face = Math.atan2(dx, dy); m.cast = { kind: "breath", t: B.wind, dx, dy }; m.breathCd = enraged ? B.cd * .7 : B.cd;
      SIM.fx(W, { k: "warn", x: m.x, y: m.y, dx, dy, r: B.range, ang: B.angle, dur: B.wind });
      SIM.bossSay(W, m, "", `${m.name} draws a deep breath!`);
      return;
    }
    // Tail Swipe: anyone standing behind him
    if(m.tailCd <= 0 && arena.some(h => { const vx = h.x - m.x, vy = h.y - m.y, dd = Math.hypot(vx, vy) || 1; return dd < m.r + RAID.tail.reach && (vx * fx + vy * fy) / dd < -.5; })){
      const L = RAID.tail; m.cast = { kind: "tail", t: L.wind, dx: -fx, dy: -fy }; m.tailCd = L.cd;
      SIM.fx(W, { k: "warn", x: m.x, y: m.y, dx: -fx, dy: -fy, r: m.r + L.reach, ang: L.angle, dur: L.wind });
      return;
    }
    // chase the target and bite
    const reach = m.r + t.r + 60;
    m.face = Math.atan2(t.x - m.x, t.y - m.y);
    if(d > reach){ const s = Math.min(d - reach + 1, T.ms * dt); m.x += (t.x - m.x) / d * s; m.y += (t.y - m.y) / d * s; m.moving = true; }
    else if(m.atkT <= 0){ m.atkT = T.atkCd * (enraged ? RAID.enrage.speed : 1); SIM.damage(W, t, T.dmg * (enraged ? RAID.enrage.dmg : 1), m); SIM.fx(W, { k: "butt", id: m.id }); }
  },
  // Raid loot: everyone who shared the kill gets coins, Rimescale and an Epic of their own;
  // two Legendaries are rolled on (Need/Greed/Pass) by the party
  raidLoot(W, looter, m, group){
    // hired champions take no loot (they stay with you for the Ashen Cathedral, and leave after its last boss)
    const L = LOOT[m.kind], members = (group.length ? group : [looter]).filter(h => !h.bot);
    if(!members.length) return;
    looter = members.includes(looter) ? looter : members[0];
    members.forEach((h, k) => {
      const a = k / members.length * Math.PI * 2, coins = L.coins[0] + Math.floor(Math.random() * (L.coins[1] - L.coins[0] + 1));
      const items = [genItem({ ilvl: L.ilvl, rarity: 3, cls: h.kit.cls, nid: W.nid++ }), Object.assign(makeMat("rimescale", W.nid++), { q: 3 })];
      W.loot.push({ id: "l" + W.nid++, side: h.side, bag: true, item: "bag", coins, items, rar: 3, x: clampX(m.x + Math.cos(a) * (m.r + 80)), y: clampY(m.y + Math.sin(a) * (m.r + 80)), expires: W.t + 600 });
    });
    const rollers = members.filter(h => !h.dead && !h.bot);
    for(let i = 0; i < 2; i++){
      const cls = members[Math.floor(Math.random() * members.length)].kit.cls, it = genItem({ ilvl: L.ilvl, rarity: 4, cls, nid: W.nid++ });
      if(it.s === "weapon") it.glow = true;
      if(rollers.length > 1) SIM.startRoll(W, it, rollers, looter);
      else W.loot.push({ id: "l" + W.nid++, side: looter.side, bag: true, item: "bag", coins: 0, items: [it], rar: 4, x: m.x, y: m.y, expires: W.t + 600 });
    }
    SIM.clearEvent(W, "raid:" + m.id);
    SIM.bossSay(W, m, `${m.name} has fallen!`, "Legendary loot drops from the Rimewyrm");
    // his death breaks the seal under the mountain: the Rift to the Ashen Cathedral opens in the Crown
    W.riftOpen = W.t + DUNGEON.riftOpen;
    SIM.bossSay(W, m, "", "A Rift tears open in the Crown! Step into it with your party to enter the Ashen Cathedral.");
  },
});
