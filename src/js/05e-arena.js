"use strict";
// The Champion's Ring: Arenamaster Vex sends out a computer-controlled champion for a practice duel.
// Adds to SIM (host only). The opponent is a normal hero (flagged `bot`) driven by SIM.botTick.

const ARENA_RULES = {
  react: [.12, .18],   // seconds between the opponent's decisions
  dodge: .85,          // chance it sees and sidesteps each of your skillshots and blasts
  potions: 2,          // potions it may drink per duel
  reward: 15,          // coins per level for a win
};

Object.assign(SIM, {
  // talk → arena dialog; fight → ask the host to pick a champion (it has the Data Dragon list)
  arenaInput(W, c, cmd){
    if(!cmd.arena) return false;
    const npc = NPCS.find(n => n.arena);
    if(c.dead || c.duel || c.arenaPending) return true;
    if(Math.hypot(c.x - npc.x, c.y - npc.y) > 500){ SIM.tell(W, c, `Talk to ${npc.name} to start a practice duel.`); return true; }
    c.arenaPending = true; W.arenaReqs.push({ side: c.side });
    SIM.fx(W, { k: "msg", side: c.side, text: `${npc.name} whistles. A challenger steps into the ring...` });
    return true;
  },
  arenaFail(W, side){ const c = SIM.hero(W, side); if(c){ c.arenaPending = false; SIM.tell(W, c, "No challenger came. Try again."); } },
  // spawn the opponent (champion detail `d`) and start the duel in the ring
  arenaStart(W, side, d){
    const c = SIM.hero(W, side); if(!c) return null;
    c.arenaPending = false;
    if(c.dead || c.duel) return null;
    const bs = "bot" + W.nid++, b = SIM.addHero(W, bs, d);
    b.bot = true; b.lvl = c.lvl;
    for(const sl of EQ_SLOTS) b.equip[sl] = genItem({ ilvl: c.lvl + 1, rarity: 2, cls: b.kit.cls, slot: sl, nid: W.nid++ });
    b.talents = SIM.botTalents(b); SIM.recalc(b); b.hp = b.maxHp;
    Object.assign(b, { aiT: 0, potions: ARENA_RULES.potions, dodged: {}, seen: null });
    b.x = clampX(ARENA.x + 300); b.y = clampY(ARENA.y + 40); b.face = -Math.PI / 2;
    // Vex walks you into the ring, facing your challenger
    SIM.fx(W, { k: "blink", x: c.x, y: c.y, x2: ARENA.x - 300, y2: ARENA.y - 40 });
    c.x = clampX(ARENA.x - 300); c.y = clampY(ARENA.y - 40); c.move = c.target = c.talkTo = null; c.face = Math.PI / 2;
    const dl = { id: "d" + W.nid++, a: c.side, b: bs, x: ARENA.x, y: ARENA.y, r: ARENA.r, state: "count", startAt: W.t + DUEL.count, lastN: DUEL.count + 1, out: {}, arena: true };
    W.duels.push(dl); c.duel = b.duel = dl;
    SIM.note(W, [c.side], `${b.name} enters the Champion's Ring. Level ${b.lvl}.`);
    return b;
  },
  // spend the opponent's skill points sensibly: power on its damage, haste on its ultimate
  botTalents(b){
    const t = newTalents(); let pts = talentPoints(b.lvl, t);
    const order = ["Q.power", "Q.power", "Q.power", "Q.mastery", "R.haste", "E.power", "core.vit", "W.power", "E.power", "core.might", "W.haste", "E.mastery", "core.vit", "R.power", "core.might", "W.power", "R.haste", "core.vit", "E.haste"];
    for(const step of order){ if(pts <= 0) break; const [s, n] = step.split("."); if(canTalent(b.lvl, t, s, n)){ t[s][n]++; pts--; } }
    return t;
  },
  // called when a duel ends: arena opponents leave the ring, and a win pays out
  arenaEnd(W, d, winner){
    if(!d.arena) return;
    const p = W.heroes[d.a], b = W.heroes[d.b];
    if(winner && winner === p){ const coins = ARENA_RULES.reward * p.lvl; p.coins += coins; p.gearVer++; p.arenaWins = (p.arenaWins || 0) + 1; SIM.fx(W, { k: "msg", side: p.side, text: `Vex tosses you ${fmtCoins(coins)}. Arena wins: ${p.arenaWins}.` }); }
    if(b) W.botLeave.push({ side: b.side, at: W.t + 2.5 });
  },
  arenaTick(W){
    if(!W.botLeave.length) return;
    W.botLeave = W.botLeave.filter(q => { if(W.t < q.at) return true; const b = W.heroes[q.side]; if(b){ SIM.fx(W, { k: "pop", x: b.x, y: b.y, id: "c:" + b.side }); SIM.removeHero(W, q.side); } return false; });
  },

  /* ---------- The opponent's brain ---------- */
  // somewhere to sidestep to, if a skillshot or blast is about to hit
  botThreat(W, b, o){
    for(const sh of W.shots){
      if(sh.owner !== o.id || (sh.kind !== "sk" && sh.kind !== "hook")) continue;
      const sp = Math.hypot(sh.vx, sh.vy) || 1, vx = sh.vx / sp, vy = sh.vy / sp, rx = b.x - sh.x, ry = b.y - sh.y;
      const along = rx * vx + ry * vy; if(along < 0 || along / sp > .9) continue;
      const miss = Math.abs(rx * vy - ry * vx); if(miss > sh.r + b.r + 25) continue;
      if(!(sh.id in b.dodged)) b.dodged[sh.id] = Math.random() < ARENA_RULES.dodge;
      if(!b.dodged[sh.id]) continue;
      const side = (rx * vy - ry * vx) >= 0 ? 1 : -1;
      return SIM.botInRing(b, [b.x + vy * side * 280, b.y - vx * side * 280]);
    }
    for(const z of [...W.zones, ...W.fields]){
      if(z.owner !== o.id) continue;
      const dx = b.x - z.x, dy = b.y - z.y, dd = Math.hypot(dx, dy) || 1; if(dd > z.r + b.r) continue;
      if(!(z.id in b.dodged)) b.dodged[z.id] = Math.random() < ARENA_RULES.dodge;
      if(!b.dodged[z.id]) continue;
      return SIM.botInRing(b, [z.x + dx / dd * (z.r + b.r + 90), z.y + dy / dd * (z.r + b.r + 90)]);
    }
    return null;
  },
  // keep a destination inside the duel area (slide around the edge instead of leaving)
  botInRing(b, p){
    const d = b.duel; if(!d) return p;
    const dx = p[0] - d.x, dy = p[1] - d.y, dd = Math.hypot(dx, dy) || 1, lim = d.r * .85;
    return dd <= lim ? p : [d.x + dx / dd * lim, d.y + dy / dd * lim];
  },
  // where the opponent will be after `secs`, from how it has been moving
  botLead(b, o, secs){
    const s = b.seen; if(!s) return [o.x, o.y];
    return [o.x + s.vx * Math.min(secs, 1.2), o.y + s.vy * Math.min(secs, 1.2)];
  },
  botTick(W, b, dt){
    const d = b.duel, o = d && SIM.duelOther(W, b);
    // track the opponent's velocity for aiming
    if(o){ if(b.seen && W.t > b.seen.t){ const k = W.t - b.seen.t; b.seen.vx = b.seen.vx * .5 + (o.x - b.seen.x) / k * .5; b.seen.vy = b.seen.vy * .5 + (o.y - b.seen.y) / k * .5; } b.seen = { x: o.x, y: o.y, t: W.t, vx: b.seen ? b.seen.vx : 0, vy: b.seen ? b.seen.vy : 0 }; }
    b.aiT -= dt; if(b.aiT > 0) return;
    b.aiT = ARENA_RULES.react[0] + Math.random() * (ARENA_RULES.react[1] - ARENA_RULES.react[0]);
    if(!o || b.dead){ b.move = b.target = null; return; }
    const dist = Math.hypot(o.x - b.x, o.y - b.y), hpP = b.hp / b.maxHp;
    if(d.state !== "fight"){ b.move = b.target = null; b.face = Math.atan2(o.x - b.x, o.y - b.y); return; }
    const can = k => b.cds[k] <= 0 && !(k === "R" && b.lvl < ULT_LEVEL) && SIM.canAct(b) && !b.dash;
    const cast = (k, at) => { SIM.cast(W, b, k, [Math.round(at[0]), Math.round(at[1])]); return true; };
    const away = len => SIM.botInRing(b, [b.x - (o.x - b.x) / (dist || 1) * len, b.y - (o.y - b.y) / (dist || 1) * len]);
    // 1. dodge, and shield up if something is coming
    const dodge = SIM.botThreat(W, b, o);
    if(dodge){
      b.target = null; b.move = dodge;
      for(const k of SLOTS) if(can(k) && b.kit[k].type === "shield"){ cast(k, [b.x, b.y]); break; }
      for(const k of SLOTS) if(can(k) && b.kit[k].type === "blink"){ cast(k, dodge); break; }
      return;
    }
    // 2. stay alive
    if(hpP < .35 && b.potions > 0 && W.t >= (b.potT || 0)){ b.hp = Math.min(b.maxHp, b.hp + b.maxHp * POTION.heal); b.potT = W.t + POTION.cd; b.potions--; SIM.fx(W, { k: "heal", side: b.side, v: Math.round(b.maxHp * POTION.heal) }); }
    for(const k of SLOTS){
      if(!can(k)) continue; const p = b.kit[k];
      if(p.type === "heal" && hpP < .6) return void cast(k, [b.x, b.y]);
      if(p.type === "shield" && hpP < .55 && dist < 700) return void cast(k, [b.x, b.y]);
      if(p.type === "stealth" && hpP < .3) return void cast(k, [b.x, b.y]);
    }
    // 3. attack with abilities, best first (ultimate, then the rest)
    for(const k of ["R", "Q", "E", "W"]){
      if(!can(k)) continue;
      const p = applyTalents(b.kit[k], b.talents[k]), lead = SIM.botLead(b, o, p.speed ? dist / p.speed : (p.delay || .3));
      switch(p.type){
        case "bolt": case "hook": if(dist < p.range * .95) return void cast(k, lead); break;
        case "aoe": case "field": if(dist < p.range + (p.radius || 0) * .4) return void cast(k, lead); break;
        case "cone": if(dist < p.range * .9) return void cast(k, [o.x, o.y]); break;
        case "spin": case "orbit": if(dist < (p.radius || 230) + o.r + 40) return void cast(k, [o.x, o.y]); break;
        case "summon": if(dist < p.range + 300) return void cast(k, [o.x, o.y]); break;
        case "steroid": if(dist < b.range + 200) return void cast(k, [o.x, o.y]); break;
        case "dash": case "leap": case "blink":
          if(!b.ranged && dist > 260 && dist < p.range + 100) return void cast(k, lead);            // close the gap
          if(b.ranged && dist < 320 && hpP < .8) return void cast(k, away(p.range || 400));       // get away
          break;
      }
    }
    // 4. positioning: ranged champions kite, melee champions chase
    if(b.ranged && dist < b.range * .55){
      const perp = [-(o.y - b.y) / (dist || 1), (o.x - b.x) / (dist || 1)], sideStep = (Math.floor(W.t / 1.5) % 2) ? 1 : -1, back = away(260);
      b.target = null; b.move = SIM.botInRing(b, [back[0] + perp[0] * 140 * sideStep, back[1] + perp[1] * 140 * sideStep]);
    }else{ b.move = null; b.target = o.id; }
  },
});
