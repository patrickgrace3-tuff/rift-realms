"use strict";
// The Ashen Cathedral: a five-player dungeon reached through the Rift that opens when Skarnvir dies.
// Walls (rooms), the Rift and the exit, elite packs, priests that shoot and heal, telegraphed boss
// attacks ("dangers"), burning ground ("hazards"), the three boss scripts and their loot. Adds to SIM (host only).

const DUNGEON = {
  riftOpen: 600,        // seconds the Rift stays open for everyone after Skarnvir dies (slayers can always use it)
  carry: 2600,          // party members this close to the Rift go in with you
  shotSpeed: 1100,      // priests' firebolts
  hazardTick: .5,       // burning ground hurts every half second
  exposed: 1.3,         // the Saint takes this much more damage just after his choir falls
};
const ROOM_LIST = CATHEDRAL_ROOMS.map(k => CATHEDRAL[k]);

/* ---------- Boss scripts ----------
   Each ability: id, cd (seconds), first (seconds before its first use), optional when(m, hpPct) and
   ok(W, m, target, arena) checks, and use(W, m, target, arena). Telegraphs go through SIM.danger. */
const DBOSS = {
  deacon: {
    intro: "The censer swings. Get out of the burning ground!",
    abilities: [
      { id: "sweep", cd: 11, first: 6, ok: (W, m, t, ar) => ar.some(h => Math.hypot(h.x - m.x, h.y - m.y) < 600),
        use(W, m){ SIM.danger(W, m, { shape: "circle", x: m.x, y: m.y, r: 470, t: 1.6, dmg: 380, knock: 320, name: "Censer Sweep" }); SIM.bossSay(W, m, "", "Deacon Varrow raises his censer!"); } },
      { id: "incense", cd: 13, first: 12,
        use(W, m){ SIM.danger(W, m, { shape: "pulse", x: m.x, y: m.y, r: 1500, t: 1.2, dmg: 240, name: "Choking Incense" }); SIM.bossSay(W, m, "", "Choking incense pours from the censer!"); } },
      { id: "embers", cd: 15, first: 9,
        use(W, m, t, ar){ for(const h of ar.slice().sort(() => Math.random() - .5).slice(0, 3)) SIM.danger(W, m, { shape: "circle", x: h.x, y: h.y, r: 230, t: 1.8, dmg: 310, hazard: { r: 210, dur: 14, dmg: 60 }, name: "Ember Rain" }, .8); } },
    ],
    phase(W, m, hp){
      if(hp < .5 && !m.flags.blaze){ m.flags.blaze = 1; m.frenzy = 1.3; SIM.bossSay(W, m, "The censer blazes!", "Varrow calls his acolytes"); SIM.bossAdds(W, m, ["acolyte", "acolyte"]); }
    },
  },
  abbess: {
    intro: "Never stand in front of her. Her palm silences.",
    abilities: [
      { id: "palm", cd: 9, first: 4, ok: (W, m, t) => Math.hypot(t.x - m.x, t.y - m.y) < 700,
        use(W, m, t){ const d = Math.hypot(t.x - m.x, t.y - m.y) || 1; SIM.danger(W, m, { shape: "cone", x: m.x, y: m.y, dx: (t.x - m.x) / d, dy: (t.y - m.y) / d, r: 620, ang: 90, t: 1.1, dmg: 350, silence: 3, name: "Palm of Silence" }); } },
      { id: "kick", cd: 13, first: 8, ok: (W, m, t, ar) => ar.some(h => Math.hypot(h.x - m.x, h.y - m.y) > 450),
        use(W, m, t, ar){
          const far = ar.slice().sort((a, b) => Math.hypot(b.x - m.x, b.y - m.y) - Math.hypot(a.x - m.x, a.y - m.y))[0], d = Math.hypot(far.x - m.x, far.y - m.y) || 1, len = Math.min(1600, d + 150);
          SIM.danger(W, m, { shape: "line", x: m.x, y: m.y, dx: (far.x - m.x) / d, dy: (far.y - m.y) / d, len, w: 260, t: 1.1, dmg: 325, stun: .8, leap: true, name: "Flying Kick" });
          SIM.bossSay(W, m, "", `Ysolde fixes her eyes on ${far.name}!`);
        } },
      { id: "fire", cd: 10, first: 3, when: (m, hp) => hp < .6,
        use(W, m){ SIM.danger(W, m, { shape: "pulse", x: m.x, y: m.y, r: 1600, t: 1.5, dmg: 280, name: "Inner Fire" }); SIM.bossSay(W, m, "", "Ysolde's inner fire flares! Brace yourselves."); } },
    ],
    phase(W, m, hp){
      if(hp < .5 && !m.flags.fists){ m.flags.fists = 1; SIM.bossSay(W, m, "A hundred fists!", "Ysolde calls her monks"); SIM.bossAdds(W, m, ["monk", "monk"]); }
    },
  },
  saint: {
    intro: "Kill his choir when it shields him. Get close when he calls the Nova.",
    abilities: [
      { id: "sermon", cd: 10, first: 5, ok: (W, m, t) => Math.hypot(t.x - m.x, t.y - m.y) < 900,
        use(W, m, t){ const d = Math.hypot(t.x - m.x, t.y - m.y) || 1; SIM.danger(W, m, { shape: "cone", x: m.x, y: m.y, dx: (t.x - m.x) / d, dy: (t.y - m.y) / d, r: 900, ang: 70, t: 1.5, dmg: 445, name: "Sermon of Cinders" }); } },
      { id: "judgment", cd: 16, first: 10,
        use(W, m, t, ar){ for(const h of ar) SIM.danger(W, m, { shape: "circle", x: h.x, y: h.y, r: 240, t: 2.2, dmg: 380, name: "Judgment" }, 1); SIM.bossSay(W, m, "", "Judgment falls on each of you! Spread out!"); } },
      { id: "pillar", cd: 6, first: 2, when: (m, hp) => m.flags.ascend,
        use(W, m, t, ar){ const h = ar[Math.floor(Math.random() * ar.length)]; SIM.danger(W, m, { shape: "circle", x: h.x, y: h.y, r: 230, t: 1.5, dmg: 270, hazard: { r: 220, dur: 16, dmg: 65 }, name: "Pillar of Flame" }, 0); } },
      { id: "nova", cd: 20, first: 4, when: (m, hp) => m.flags.ascend,
        use(W, m){ SIM.danger(W, m, { shape: "donut", x: m.x, y: m.y, r0: 420, r1: 3200, t: 3.2, dmg: 700, name: "Radiant Nova" }); SIM.bossSay(W, m, "Radiant Nova!", "Get close to Malchar. Only his shadow is safe!"); } },
    ],
    phase(W, m, hp){
      // phase 2: the Choir of Ash shields him until it's dead
      if(hp < .7 && !m.flags.choir){
        m.flags.choir = 1; m.immune = true; m.litanyT = 4; m.cast = null; m.x = m.home[0]; m.y = m.home[1];
        SIM.bossSay(W, m, "Choir of Ash!", "Malchar is shielded by his choir. Kill them!");
        SIM.bossAdds(W, m, ["acolyte", "acolyte", "monk", "monk"]);
      }
      if(m.immune && !W.mobs.some(a => !a.dead && a.event === "dboss:" + m.id)){
        m.immune = false; m.exposedT = W.t + 10; SIM.bossSay(W, m, "The choir falls silent!", "Malchar is exposed. Strike now!");
      }
      // phase 3: he ascends; flame pillars and the Radiant Nova
      if(hp < .4 && !m.flags.ascend){ m.flags.ascend = 1; m.cds.pillar = 2; m.cds.nova = 4; SIM.bossSay(W, m, "Malchar ascends!", "The floor burns. Watch for the Radiant Nova!"); }
      if(hp < .12 && !m.enraged){ m.enraged = true; SIM.bossSay(W, m, "Malchar is enraged!", "Finish him!"); }
    },
    // while shielded he stays at the altar and chants a litany that hurts everyone a little
    channel(W, m, dt, ar){
      m.litanyT -= dt;
      if(m.litanyT <= 0){ m.litanyT = 3; SIM.fx(W, { k: "nova", x: m.x, y: m.y, r: 1600, fire: 1 }); for(const h of ar) SIM.damage(W, h, 170, m); }
    },
  },
};

Object.assign(SIM, {
  /* ---------- Walls ---------- */
  inCathedral: u => u.y > DZ,
  rooms: W => W.dungeon && W.dungeon.sealed ? ROOM_LIST.filter(r => r !== CATHEDRAL.choir) : ROOM_LIST,
  // keep a unit inside the world: the Peaks' north edge, or the cathedral's rooms
  bound(W, u){
    u.x = clampX(u.x);
    if(!SIM.inCathedral(u)){ u.y = Math.max(ZMIN, Math.min(WH - ZMIN, u.y)); return; }
    const pad = u.r || 50, rooms = SIM.rooms(W);
    let bx = u.x, by = u.y, bd = Infinity;
    for(const r of rooms){
      const px = Math.max(r[0] + pad, Math.min(r[2] - pad, u.x)), py = Math.max(r[1] + pad, Math.min(r[3] - pad, u.y)), d = Math.hypot(px - u.x, py - u.y);
      if(d === 0) return;
      if(d < bd){ bd = d; bx = px; by = py; }
    }
    u.x = bx; u.y = by;
  },

  /* ---------- Setup, the Rift, the exit and resets ---------- */
  dungeonCreate(W){
    W.dungeon = { sealed: true, down: {}, emptyT: 0 }; W.dangers = []; W.hazards = []; W.mshots = []; W.riftOpen = 0;
    for(const sp of CATHEDRAL_SPAWNS) SIM.dspawn(W, sp);
  },
  dspawn(W, sp){
    const m = SIM.spawnMob(W, sp.kind, { x: sp.x, y: sp.y });
    Object.assign(m, { home: [sp.x, sp.y], spawnId: sp.id, pack: sp.pack || null, face: Math.PI, wait: 1e9 });
    return m;
  },
  canEnterRift(W, c){ const q = c.quests.rimewyrm; return (q && (q.state === "ready" || q.state === "done")) || W.riftOpen > W.t; },
  // step into the Rift: you and your party nearby (hired champions too) are taken into the cathedral
  enterCathedral(W, c){
    const group = SIM.partyMembers(W, c).filter(h => !h.dead && (h === c || Math.hypot(h.x - RIFT.x, h.y - RIFT.y) < DUNGEON.carry));
    group.forEach((h, k) => SIM.teleport(W, h, CATHEDRAL.arrive[0] + (k % 3 - 1) * 170, CATHEDRAL.arrive[1] + Math.floor(k / 3) * 170));
    SIM.fx(W, { k: "bossmsg", to: group.filter(h => !h.bot).map(h => h.side), big: "The Ashen Cathedral", small: group.length > 1 ? "The Rift pulls your party through" : "The Rift pulls you through" });
  },
  // the way out: back to Yrsa's Watch (your hired champions come too)
  leaveCathedral(W, c){
    const group = [c, ...SIM.heroes(W).filter(h => h.merc && h.merc.owner === c.side && !h.dead)];
    group.forEach((h, k) => SIM.teleport(W, h, YRSA_CAMP.x + 320 + k * 120, YRSA_CAMP.y - 260));
    SIM.fx(W, { k: "msg", side: c.side, text: "You step back out into the cold, at Yrsa's Watch." });
  },
  teleport(W, h, x, y){
    SIM.fx(W, { k: "blink", x: h.x, y: h.y, x2: x, y2: y });
    h.x = x; h.y = y; h.move = h.target = h.talkTo = null; h.dash = h.forced = null; h.channel = null; h.portalT = W.t + 3;
    for(const m of W.mobs) if(m.aggro === h.id && !m.boss){ m.aggro = null; m.returning = true; }
  },
  dungeonReset(W){
    const alive = new Set(W.mobs.filter(m => !m.dead && m.spawnId).map(m => m.spawnId));
    for(const m of W.mobs) if(!m.dead && m.event && m.event.startsWith("dboss:")) m.dead = true;
    for(const sp of CATHEDRAL_SPAWNS) if(!alive.has(sp.id)) SIM.dspawn(W, sp);
    for(const m of W.mobs) if(m.spawnId && !m.dead){ m.hp = m.maxHp; m.x = m.home[0]; m.y = m.home[1]; m.aggro = null; m.returning = false; if(m.boss) SIM.dbossReset(W, m, true); }
    W.dungeon.sealed = true; W.dungeon.down = {}; W.dangers = []; W.hazards = []; W.mshots = [];
  },

  /* ---------- Telegraphed attacks and burning ground ---------- */
  // add a telegraph; the boss stands still while it winds up (wind = how long, or the danger's own time)
  danger(W, m, d, wind){
    d.id = "dg" + W.nid++; d.src = m; W.dangers.push(d);
    m.cast = { t: wind === undefined ? d.t : wind };
    if(d.shape === "cone" || d.shape === "line") m.face = Math.atan2(d.dx, d.dy);
    const f = { k: "warn", x: d.x, y: d.y, dur: d.t, fire: 1 };
    if(d.shape === "circle" || d.shape === "pulse") Object.assign(f, { dx: 0, dy: 1, r: d.r, ang: 360 });
    else if(d.shape === "donut") Object.assign(f, { dx: 0, dy: 1, r: d.r1, inner: d.r0, ang: 360 });
    else if(d.shape === "cone") Object.assign(f, { dx: d.dx, dy: d.dy, r: d.r, ang: d.ang });
    else if(d.shape === "line") Object.assign(f, { dx: d.dx, dy: d.dy, len: d.len, w: d.w, r: d.len });
    if(d.shape !== "pulse") SIM.fx(W, f);
    return d;
  },
  // is unit u inside this danger (or within `pad` of it)?
  inDanger(d, u, pad = 0){
    const dist = Math.hypot(u.x - d.x, u.y - d.y);
    if(d.shape === "circle") return dist < d.r + u.r * .5 + pad;
    if(d.shape === "pulse") return dist < d.r;
    if(d.shape === "donut") return dist > d.r0 - pad && dist < d.r1;
    if(d.shape === "cone") return SIM.inCone(d, u, d.dx, d.dy, d.r + pad, d.ang + pad / 10);
    if(d.shape === "line"){ const vx = u.x - d.x, vy = u.y - d.y, along = vx * d.dx + vy * d.dy, across = Math.abs(vx * d.dy - vy * d.dx); return along > -u.r && along < d.len + u.r && across < d.w / 2 + u.r * .5 + pad; }
    return false;
  },
  resolveDanger(W, d){
    const m = d.src; if(!m || m.dead) return;
    const hit = SIM.heroes(W).filter(h => !h.dead && SIM.inCathedral(h) && SIM.inDanger(d, h));
    for(const h of hit){
      SIM.damage(W, h, d.dmg * (m.enraged ? 1.3 : 1), m);
      if(h.dead) continue;
      if(d.knock){ const dd = Math.hypot(h.x - d.x, h.y - d.y) || 1; SIM.force(h, h.x + (h.x - d.x) / dd * d.knock, h.y + (h.y - d.y) / dd * d.knock, .25); }
      if(d.stun) SIM.applyCC(h, { stun: d.stun });
      if(d.silence){ h.silenceT = W.t + d.silence; SIM.fx(W, { k: "msg", side: h.side, text: "Silenced! You can't use abilities for a few seconds." }); }
    }
    if(d.shape === "circle") SIM.fx(W, { k: "nova", x: d.x, y: d.y, r: d.r, fire: 1 });
    else if(d.shape === "pulse" || d.shape === "donut") SIM.fx(W, { k: "nova", x: d.x, y: d.y, r: d.shape === "donut" ? 2200 : d.r, fire: 1 });
    else if(d.shape === "cone") SIM.fx(W, { k: "cone", x: d.x, y: d.y, dx: d.dx, dy: d.dy, r: d.r, ang: d.ang, fire: 1 });
    else if(d.shape === "line") for(let s = 0; s <= d.len; s += 180) SIM.fx(W, { k: "pop", x: d.x + d.dx * s, y: d.y + d.dy * s });
    if(d.hazard) W.hazards.push({ id: "hz" + W.nid++, x: d.x, y: d.y, r: d.hazard.r, until: W.t + d.hazard.dur, dmg: d.hazard.dmg, src: m, tick: 0 });
    if(d.leap){ m.leap = { sx: m.x, sy: m.y, tx: d.x + d.dx * d.len, ty: d.y + d.dy * d.len, t: 0, dur: .3 }; }
  },
  // where should a unit standing in a telegraph or in fire go? null if it's safe where it is
  dangerEscape(W, u){
    for(const d of W.dangers){
      if(d.shape === "pulse" || !SIM.inDanger(d, u, 70)) continue;
      const vx = u.x - d.x, vy = u.y - d.y, dist = Math.hypot(vx, vy) || 1;
      if(d.shape === "circle"){ const k = (d.r + u.r + 140) / dist; return [d.x + vx * k, d.y + vy * k]; }
      if(d.shape === "donut") return [d.x + vx / dist * Math.max(0, d.r0 - 200), d.y + vy / dist * Math.max(0, d.r0 - 200)];
      const side = vx * d.dy - vy * d.dx >= 0 ? 1 : -1, sx = d.dy * side, sy = -d.dx * side;   // step out sideways
      return [u.x + sx * (d.shape === "line" ? d.w + 120 : 600), u.y + sy * (d.shape === "line" ? d.w + 120 : 600)];
    }
    for(const z of W.hazards){
      const vx = u.x - z.x, vy = u.y - z.y, dist = Math.hypot(vx, vy) || 1;
      if(dist < z.r + u.r){ const k = (z.r + u.r + 120) / dist; return [z.x + vx * k, z.y + vy * k]; }
    }
    return null;
  },

  /* ---------- Priests ---------- */
  mobShoot(W, m, t){ W.mshots.push({ id: "ms" + W.nid++, x: m.x, y: m.y, tid: t.id, m, life: 3 }); SIM.fx(W, { k: "butt", id: m.id }); },
  // acolytes mend the most hurt creature near them
  priestHeals(W, m, T, dt){
    if(m.healT === undefined) m.healT = 2 + Math.random() * 2;
    m.healT -= dt;
    if(m.healT > 0) return;
    const hurt = W.mobs.filter(o => !o.dead && !o.boss && o.hp < o.maxHp * .85 && Math.hypot(o.x - m.x, o.y - m.y) < T.heals.range).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if(!hurt){ m.healT = 1; return; }
    m.healT = T.heals.every; const v = Math.min(hurt.maxHp - hurt.hp, hurt.maxHp * T.heals.pct); hurt.hp += v;
    SIM.fx(W, { k: "mheal", x: hurt.x, y: hurt.y, v: Math.round(v), id: m.id });
  },

  /* ---------- Every tick ---------- */
  dungeonTick(W, dt){
    const D = W.dungeon; if(!D) return;
    // the Saint can't be touched (or pulled) through the seal on the choir
    for(const m of W.mobs) if(m.kind === "saint" && !m.dead && !m.aggro) m.immune = D.sealed;
    // the Rift in the Crown, and the way out
    for(const c of SIM.heroes(W)){
      if(c.bot || c.dead || c.portalT > W.t) continue;
      if(!SIM.inCathedral(c) && Math.hypot(c.x - RIFT.x, c.y - RIFT.y) < RIFT.r){
        if(SIM.canEnterRift(W, c)) SIM.enterCathedral(W, c);
        else if(!(c.riftWarnT > W.t)){ c.riftWarnT = W.t + 6; SIM.fx(W, { k: "msg", side: c.side, text: "The Rift is sealed while Skarnvir lives." }); }
      }else if(SIM.inCathedral(c) && Math.hypot(c.x - CATHEDRAL.exit.x, c.y - CATHEDRAL.exit.y) < 150) SIM.leaveCathedral(W, c);
    }
    // priests' firebolts fly at their target
    for(const sh of W.mshots){
      sh.life -= dt; const t = SIM.find(W, sh.tid); if(!t){ sh.life = 0; continue; }
      const dx = t.x - sh.x, dy = t.y - sh.y, d = Math.hypot(dx, dy), stp = DUNGEON.shotSpeed * dt;
      if(d <= stp + t.r){ SIM.damage(W, t, sh.m.dmg, sh.m); SIM.fx(W, { k: "hit", x: t.x, y: t.y }); sh.life = 0; } else { sh.x += dx / d * stp; sh.y += dy / d * stp; }
    }
    W.mshots = W.mshots.filter(sh => sh.life > 0);
    for(const m of W.mobs){ const T = MOBS[m.kind]; if(T.heals && !m.dead && m.aggro) SIM.priestHeals(W, m, T, dt); }
    // telegraphs land; burning ground burns
    for(const d of W.dangers){ d.t -= dt; if(d.t <= 0) SIM.resolveDanger(W, d); }
    W.dangers = W.dangers.filter(d => d.t > 0 && d.src && !d.src.dead);
    for(const z of W.hazards){
      z.tick -= dt; if(z.tick > 0) continue; z.tick = DUNGEON.hazardTick;
      for(const h of SIM.heroes(W)) if(!h.dead && Math.hypot(h.x - z.x, h.y - z.y) < z.r + h.r * .5) SIM.damage(W, h, z.dmg, z.src);
    }
    W.hazards = W.hazards.filter(z => z.until > W.t && !z.src.dead && z.src.aggro);
    // once nobody has been inside for a while, everything comes back
    if(SIM.heroes(W).some(h => !h.bot && SIM.inCathedral(h))) D.emptyT = 0;
    else if((D.emptyT += dt) > CATHEDRAL.resetAfter && D.emptyT - dt <= CATHEDRAL.resetAfter) SIM.dungeonReset(W);
  },

  /* ---------- Bosses ---------- */
  bossAdds(W, m, kinds){
    const ar = SIM.bossArena(W, m);
    kinds.forEach((kind, k) => {
      const a = k / kinds.length * Math.PI * 2 + .4, add = SIM.spawnMob(W, kind, { x: m.x + Math.cos(a) * (m.r + 260), y: m.y + Math.sin(a) * (m.r + 260) });
      SIM.bound(W, add); add.home = [add.x, add.y]; add.event = "dboss:" + m.id; add.wait = 1e9;
      if(ar.length){ add.aggro = ar[k % ar.length].id; SIM.fx(W, { k: "angry", id: add.id }); }
    });
  },
  dbossStart(W, m, hero){
    const B = DBOSS[MOBS[m.kind].script], cds = {};
    for(const ab of B.abilities) cds[ab.id] = ab.first;
    Object.assign(m, { threat: { [hero.id]: 1 }, aggro: hero.id, pickT: 0, cast: null, cds, flags: {}, immune: false, enraged: false, frenzy: 1, leap: null });
    SIM.bossSay(W, m, `${m.name} attacks!`, B.intro);
  },
  dbossReset(W, m, quiet){
    Object.assign(m, { aggro: null, threat: {}, cast: null, hp: m.maxHp, x: m.home[0], y: m.home[1], immune: false, enraged: false, frenzy: 1, leap: null, flags: {}, exposedT: 0, atkT: 0 });
    SIM.clearEvent(W, "dboss:" + m.id);
    W.dangers = W.dangers.filter(d => d.src !== m); W.hazards = W.hazards.filter(z => z.src !== m);
    if(!quiet) SIM.bossSay(W, m, `${m.name} is victorious`, "The fight has reset");
  },
  dbossTick(W, m, dt){
    const T = MOBS[m.kind], B = DBOSS[T.script], ar = SIM.bossArena(W, m);
    m.moving = false;
    if(m.leap){   // the Abbess's flying kick carries her along the line
      const L = m.leap; L.t += dt; const k = Math.min(1, L.t / L.dur);
      m.x = L.sx + (L.tx - L.sx) * k; m.y = L.sy + (L.ty - L.sy) * k; m.moving = true; if(k >= 1) m.leap = null; return;
    }
    if(!m.aggro){
      m.hp = Math.min(m.maxHp, m.hp + m.maxHp * .05 * dt);
      if(m.immune) return;   // sealed away: he won't wake until the seals break
      const h = ar.find(h => SIM.visibleTo(h, "mob") && Math.hypot(h.x - m.x, h.y - m.y) < T.aggroR + m.r);
      if(h) SIM.dbossStart(W, m, h);
      return;
    }
    if(!ar.length){ SIM.dbossReset(W, m); return; }
    m.pickT -= dt;
    if(m.pickT <= 0 || !SIM.find(W, m.aggro)){ m.pickT = .5; let best = ar[0], bt = -1; for(const h of ar){ const th = m.threat[h.id] || 0; if(th > bt){ bt = th; best = h; } } m.aggro = best.id; }
    const t = SIM.find(W, m.aggro) || ar[0], hp = m.hp / m.maxHp;
    B.phase(W, m, hp);
    if(m.cast){ m.cast.t -= dt; if(m.cast.t > 0) return; m.cast = null; }
    if(m.immune){ if(B.channel) B.channel(W, m, dt, ar); return; }
    for(const ab of B.abilities) m.cds[ab.id] -= dt;
    for(const ab of B.abilities){
      if(m.cds[ab.id] > 0 || (ab.when && !ab.when(m, hp)) || (ab.ok && !ab.ok(W, m, t, ar))) continue;
      m.cds[ab.id] = ab.cd * (m.enraged ? .7 : 1);
      ab.use(W, m, t, ar);
      return;
    }
    // chase whoever has the most threat and hit them
    const d = Math.hypot(t.x - m.x, t.y - m.y), reach = m.r + t.r + 60;
    m.face = Math.atan2(t.x - m.x, t.y - m.y);
    if(d > reach){ const s = Math.min(d - reach + 1, T.ms * dt); m.x += (t.x - m.x) / d * s; m.y += (t.y - m.y) / d * s; m.moving = true; }
    else if(m.atkT <= 0){ m.atkT = T.atkCd / m.frenzy * (m.enraged ? .65 : 1); SIM.damage(W, t, T.dmg * (m.enraged ? 1.3 : 1), m); SIM.fx(W, { k: "butt", id: m.id }); }
  },

  /* ---------- Loot ---------- */
  // every player who fought gets coins and an Epic of their own; the Saint also drops one Legendary,
  // rolled on by the party (Need/Greed/Pass). Hired champions take nothing, and leave after the Saint.
  dungeonLoot(W, looter, m, group){
    const L = LOOT[m.kind], all = group.length ? group : [looter], members = all.filter(h => !h.bot), D = W.dungeon;
    SIM.clearEvent(W, "dboss:" + m.id); W.dangers = W.dangers.filter(d => d.src !== m); W.hazards = W.hazards.filter(z => z.src !== m);
    D.down[m.kind] = true;
    if(D.sealed && D.down.deacon && D.down.abbess){ D.sealed = false; SIM.bossSay(W, m, "The seals are broken!", "The choir is open. Archprelate Malchar waits at the altar."); }
    else SIM.bossSay(W, m, `${m.name} has fallen!`, "Epic loot for everyone who fought");
    if(L.dungeon === "final") SIM.mercsDismiss(W, all);
    if(!members.length) return;
    if(!members.includes(looter)) looter = members[0];
    members.forEach((h, k) => {
      const a = k / members.length * Math.PI * 2, coins = L.coins[0] + Math.floor(Math.random() * (L.coins[1] - L.coins[0] + 1));
      const items = [genItem({ ilvl: L.ilvl, rarity: 3, cls: h.kit.cls, nid: W.nid++ }), Object.assign(makeMat("ashcloth", W.nid++), { q: 2 })];
      W.loot.push({ id: "l" + W.nid++, side: h.side, bag: true, item: "bag", coins, items, rar: 3, x: clampX(m.x + Math.cos(a) * (m.r + 90)), y: clampY(m.y + Math.sin(a) * (m.r + 90)), expires: W.t + 600 });
    });
    if(L.dungeon !== "final") return;
    const rollers = members.filter(h => !h.dead), cls = members[Math.floor(Math.random() * members.length)].kit.cls, it = genItem({ ilvl: L.ilvl, rarity: 4, cls, nid: W.nid++ });
    if(it.s === "weapon") it.glow = true;
    if(rollers.length > 1) SIM.startRoll(W, it, rollers, looter);
    else W.loot.push({ id: "l" + W.nid++, side: looter.side, bag: true, item: "bag", coins: 0, items: [it], rar: 4, x: m.x, y: m.y, expires: W.t + 600 });
    SIM.bossSay(W, m, "The Ashen Saint is dead!", `A Legendary ${it.n} drops`);
  },

  dungeonSnapshot(W){
    const r = Math.round;
    return { dg: { s: W.dungeon && W.dungeon.sealed ? 1 : 0, ro: W.riftOpen > W.t ? 1 : 0, hz: W.hazards.map(z => [z.id, r(z.x), r(z.y), z.r]), ms: W.mshots.map(sh => [sh.id, r(sh.x), r(sh.y)]) } };
  },
});
