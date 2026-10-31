"use strict";
// Hired raid party: Scout Yrsa rents out computer champions (tank, healer, damage) for the Skarnvir raid.
// Adds to SIM (host only). Hired champions are heroes flagged `bot` with `merc: { owner, role }`;
// they join the hirer's party, fight in their role, and leave when the raid boss dies.

const MERCS = {
  price: 10,           // coins per hired champion, per level of the hirer
  tankThreat: 6,       // a hired tank builds threat this much faster
  tankArmor: .35,      // and takes this much less damage
  tankHp: 1.4,         // and has this much more health
  mendEvery: 3,        // the healer's own heal, every few seconds
  follow: 320,         // how close they stay to you outside a fight
  leaveAfter: 6,       // seconds after the boss dies before they go home
};
const ROLE_NAMES = { tank: "Tank", healer: "Healer", dps: "Damage" };

// A champion's raid role, from its League tags and its abilities
function heroRole(c){
  const tags = c.tags || [], types = SLOTS.map(k => c.kit[k] && c.kit[k].type);
  if(types.includes("heal") || (tags.includes("Support") && types.includes("shield"))) return "healer";
  if(tags.includes("Tank")) return "tank";
  return "dps";
}
// Which roles to hire to fill a party to 5: one tank, one healer, the rest damage
function mercPlan(roles){
  const slots = PARTY_MAX - roles.length, need = [];
  if(!roles.includes("tank")) need.push("tank");
  if(!roles.includes("healer")) need.push("healer");
  while(need.length < slots) need.push("dps");
  return need.slice(0, Math.max(0, slots));
}

Object.assign(SIM, {
  mercInput(W, c, cmd){
    if(!cmd.hire) return false;
    const npc = NPCS.filter(n => n.mercs).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
    if(c.dead || c.mercPending) return true;
    if(Math.hypot(c.x - npc.x, c.y - npc.y) > 500){ SIM.tell(W, c, `Talk to ${npc.name} to hire a party.`); return true; }
    if(!npc.mercs.some(q => c.quests[q] && c.quests[q].state === "active")){ SIM.tell(W, c, `${npc.name} only hires out a party while you're on ${npc.id === "yrsa" ? "the hunt for Skarnvir" : "her quests in the cathedral"}.`); return true; }
    const members = SIM.partyMembers(W, c);
    if(members.some(h => h.merc)){ SIM.tell(W, c, "You already have a hired party."); return true; }
    const p = SIM.party(W, c);
    if(p && p.leader !== c.side){ SIM.tell(W, c, "Only the party leader can hire."); return true; }
    const need = mercPlan(members.map(heroRole));
    if(!need.length){ SIM.tell(W, c, "Your party is already full."); return true; }
    const cost = need.length * MERCS.price * c.lvl;
    if(c.coins < cost){ SIM.tell(W, c, `Hiring ${need.length} champions costs ${fmtCoins(cost)}.`); return true; }
    c.coins -= cost; c.gearVer++; c.mercPending = { n: need.length, price: MERCS.price * c.lvl };
    W.mercReqs.push({ side: c.side, roles: need, taken: members.map(h => h.champId) });
    SIM.fx(W, { k: "msg", side: c.side, text: `${npc.name} sends word to the outpost. Your party is on its way (${fmtCoins(cost)}).` });
    return true;
  },
  // the host found champions for the roles (or couldn't): add them, or refund
  mercDone(W, side, list){
    const c = SIM.hero(W, side); if(!c) return [];
    const paid = c.mercPending || { n: 0, price: 0 }; c.mercPending = false;
    const out = [];
    for(const [role, d] of list.slice(0, paid.n)){ const m = SIM.mercSpawn(W, c, role, d); if(m) out.push(m); }
    const refund = (paid.n - out.length) * paid.price;
    if(refund > 0){ c.coins += refund; c.gearVer++; }
    if(out.length) SIM.note(W, SIM.partyMembers(W, c).filter(h => !h.bot).map(h => h.side), `Hired: ${out.map(m => `${m.name} (${ROLE_NAMES[m.merc.role]})`).join(", ")}.`);
    return out;
  },
  mercSpawn(W, c, role, d){
    let p = SIM.party(W, c);
    if(!p){ p = { id: "P" + W.nid++, leader: c.side, members: [c.side] }; W.parties[p.id] = p; c.party = p.id; }
    if(p.members.length >= PARTY_MAX) return null;
    const ms = "merc" + W.nid++, m = SIM.addHero(W, ms, d);
    Object.assign(m, { bot: true, merc: { owner: c.side, role }, lvl: c.lvl, skill: arenaSkill(9), hpMult: role === "tank" ? MERCS.tankHp : 1,
      aiT: 0, potions: 2, dodged: {}, seen: null, mendAt: 0, slot: p.members.length });
    for(const sl of EQ_SLOTS) m.equip[sl] = genItem({ ilvl: c.lvl + 1, rarity: 2, cls: m.kit.cls, slot: sl, nid: W.nid++ });
    m.talents = SIM.botTalents(m); SIM.recalc(m); m.hp = m.maxHp;
    const a = m.slot / PARTY_MAX * Math.PI * 2; m.x = clampX(c.x + Math.cos(a) * 220); m.y = clampY(c.y + Math.sin(a) * 220);
    p.members.push(ms); m.party = p.id;
    SIM.fx(W, { k: "blink", x: m.x, y: m.y, x2: m.x, y2: m.y });
    return m;
  },
  // the raid boss died: the hired party says goodbye and leaves
  mercsDismiss(W, heroes){
    const mercs = heroes.filter(h => h.merc);
    if(!mercs.length) return;
    for(const m of mercs) W.botLeave.push({ side: m.side, at: W.t + MERCS.leaveAfter });
    const owners = [...new Set(mercs.map(m => m.merc.owner))].filter(s => W.heroes[s]);
    if(owners.length) SIM.note(W, owners, "Your hired party salutes you and heads back to the outpost.");
  },

  /* ---------- How hired champions fight ---------- */
  mercTick(W, m, dt){
    const owner = W.heroes[m.merc.owner];
    if(!owner || !m.party || owner.party !== m.party){ if(!W.botLeave.some(q => q.side === m.side)) W.botLeave.push({ side: m.side, at: W.t }); return; }
    // track the main target's movement for aiming (same helper as the arena opponent)
    m.aiT -= dt; if(m.aiT > 0) return;
    m.aiT = .14 + Math.random() * .06;
    const near = (u, r) => Math.hypot(u.x - m.x, u.y - m.y) < r;
    const party = SIM.partyMembers(W, m).filter(h => !h.dead);
    const boss = W.mobs.find(b => b.boss && !b.dead && b.aggro && near(b, 2600));
    const can = k => m.cds[k] <= 0 && !(k === "R" && m.lvl < ULT_LEVEL) && SIM.canAct(m) && !m.dash;
    const cast = (k, at) => { SIM.cast(W, m, k, [Math.round(at[0]), Math.round(at[1])]); return true; };
    // 1. never stand in a telegraphed attack
    if(boss && boss.cast){
      const cs = boss.cast, wide = cs.kind === "breath" ? [RAID.breath.range + 120, RAID.breath.angle + 30] : [boss.r + RAID.tail.reach + 120, RAID.tail.angle + 30];
      if(SIM.inCone(boss, m, cs.dx, cs.dy, wide[0], wide[1])){
        const px = -cs.dy, py = cs.dx, side = (m.x - boss.x) * px + (m.y - boss.y) * py >= 0 ? 1 : -1;
        m.target = null; m.move = [clampX(m.x + px * side * 650), clampY(m.y + py * side * 650)]; return;
      }
    }
    // (and never stand in a cathedral boss's telegraph or in burning ground)
    const esc = SIM.dangerEscape(W, m);
    if(esc){ m.target = null; m.move = [clampX(esc[0]), clampY(esc[1])]; return; }
    // 2. drink when low
    if(m.hp < m.maxHp * .35 && m.potions > 0 && W.t >= (m.potT || 0)){ m.hp = Math.min(m.maxHp, m.hp + m.maxHp * POTION.heal); m.potT = W.t + POTION.cd; m.potions--; SIM.fx(W, { k: "heal", side: m.side, v: Math.round(m.maxHp * POTION.heal) }); }
    // what to fight: the raid boss, else whatever is attacking the party
    const foes = W.mobs.filter(u => !u.dead && u.aggro && party.some(h => h.id === u.aggro) && near(u, 1600));
    const whelp = foes.filter(u => !u.boss).sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y))[0];
    const open = boss && !boss.immune ? boss : null;   // (the Saint is immune while his choir lives: kill the adds)
    const enemy = m.merc.role === "tank" ? (open || whelp || boss) : m.merc.role === "dps" ? (whelp || open) : null;
    const attackWith = (t, skip = []) => {
      if(!t) return false;
      if(m.seen && m.seen.id === t.id && W.t > m.seen.t){ const k = W.t - m.seen.t; m.seen.vx = (t.x - m.seen.x) / k; m.seen.vy = (t.y - m.seen.y) / k; }
      m.seen = { id: t.id, x: t.x, y: t.y, t: W.t, vx: m.seen && m.seen.id === t.id ? m.seen.vx : 0, vy: m.seen && m.seen.id === t.id ? m.seen.vy : 0 };
      const d = Math.hypot(t.x - m.x, t.y - m.y);
      for(const k of ["R", "Q", "E", "W"]){
        if(!can(k)) continue; const p = applyTalents(m.kit[k], m.talents[k]); if(skip.includes(p.type)) continue;
        const lead = SIM.botLead(m, t, p.speed ? d / p.speed : (p.delay || .3));
        if((p.type === "bolt" || p.type === "hook") && d < p.range * .95) return cast(k, lead);
        if((p.type === "aoe" || p.type === "field") && d < p.range + (p.radius || 0) * .4) return cast(k, lead);
        if(p.type === "cone" && d < p.range * .9 + t.r) return cast(k, [t.x, t.y]);
        if((p.type === "spin" || p.type === "orbit") && d < (p.radius || 230) + t.r + 40) return cast(k, [t.x, t.y]);
        if((p.type === "summon" || p.type === "steroid") && d < m.range + t.r + 300) return cast(k, [t.x, t.y]);
      }
      return false;
    };
    // 3. the healer: keep everyone up, from a safe distance
    if(m.merc.role === "healer"){
      const hurt = party.filter(h => near(h, 1300)).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if(hurt && hurt.hp < hurt.maxHp * .9 && W.t >= m.mendAt){   // the healer's own steady heal
        const amt = Math.min(hurt.maxHp - hurt.hp, (120 + 22 * m.lvl) * (1 + (m.ap || 0) / 100));
        hurt.hp += amt; m.mendAt = W.t + MERCS.mendEvery; SIM.fx(W, { k: "heal", side: hurt.side, v: Math.round(amt), from: m.side, name: m.name }); SIM.healThreat(W, m, amt);
      }
      for(const k of SLOTS){
        if(!can(k)) continue; const t = m.kit[k].type;
        if(t === "heal" && hurt && hurt.hp < hurt.maxHp * .75) return void cast(k, [hurt.x, hurt.y]);
        if(t === "shield" && boss){ const tank = party.find(h => h.merc && h.merc.role === "tank") || hurt; if(tank) return void cast(k, [tank.x, tank.y]); }
      }
      if(boss){ const a = Math.atan2(Math.cos(boss.face), Math.sin(boss.face)) + Math.PI * .75, want = [boss.x + Math.cos(a) * (boss.r + 650), boss.y + Math.sin(a) * (boss.r + 650)]; // behind and to the side
        if(Math.hypot(m.x - want[0], m.y - want[1]) > 200){ m.target = null; m.move = [clampX(want[0]), clampY(want[1])]; } else { m.move = null; m.target = null; attackWith(boss, ["shield", "heal", "dash", "leap", "blink"]); } return; }
    }
    // 4. the tank: get in its face; damage dealers: whelps first, from the side
    if(enemy){
      if(m.merc.role === "tank"){
        if(m.hp < m.maxHp * .7) for(const k of SLOTS) if(can(k) && m.kit[k].type === "shield") return void cast(k, [m.x, m.y]);
        m.move = null; m.target = enemy.id; attackWith(enemy, ["shield", "heal", "blink"]); return;
      }
      if(enemy.boss){
        const fx = Math.sin(enemy.face), fy = Math.cos(enemy.face), sd = m.slot % 2 ? 1 : -1, reach = m.ranged ? Math.min(m.range + enemy.r - 60, enemy.r + 450) : enemy.r + 120;
        const want = [enemy.x - fy * sd * reach, enemy.y + fx * sd * reach];
        if(Math.hypot(m.x - want[0], m.y - want[1]) > 220){ m.target = null; m.move = [clampX(want[0]), clampY(want[1])]; return; }
      }
      m.move = null; m.target = enemy.id; attackWith(enemy, ["shield", "heal", "blink", "dash", "leap"]); return;
    }
    // 5. nothing to fight: follow the hirer (and catch up if left far behind)
    m.target = null;
    const d = Math.hypot(owner.x - m.x, owner.y - m.y);
    if(d > 3000 && !boss){ const a = m.slot / PARTY_MAX * Math.PI * 2; m.x = clampX(owner.x + Math.cos(a) * 250); m.y = clampY(owner.y + Math.sin(a) * 250); m.move = null; return; }
    if(d > MERCS.follow){ const a = m.slot / PARTY_MAX * Math.PI * 2; m.move = [clampX(owner.x + Math.cos(a) * 200), clampY(owner.y + Math.sin(a) * 200)]; }
    else m.move = null;
  },
});
