"use strict";
// The Champion's Ring: Arenamaster Vex sends out a computer-controlled champion for a practice duel.
// Adds to SIM (host only). The opponent is a normal hero (flagged `bot`) driven by SIM.botTick.

const ARENA_RULES = {
  reward: 1.5,         // coins for a win: reward × difficulty × your level
  defaultDiff: 5,
};
// How good the opponent is at difficulty 1–10 (k runs from 0 at 1 to 1 at 10)
const ARENA_DIFF_NAMES = ["", "Novice", "Novice", "Easy", "Easy", "Normal", "Normal", "Hard", "Hard", "Brutal", "Champion"];
function arenaSkill(diff){
  const n = Math.round(Number(diff)); diff = Number.isFinite(n) && diff !== null && diff !== "" ? Math.max(1, Math.min(10, n)) : ARENA_RULES.defaultDiff;
  const k = (diff - 1) / 9;
  return {
    diff,
    react: [.55 - .43 * k, .75 - .57 * k],  // seconds between decisions (slow → fast)
    dodge: .05 + .8 * k,                    // chance to sidestep each skillshot or blast
    aim: k,                                 // how well it leads your movement (0: aims where you are, with some error)
    abilities: .3 + .7 * k,                 // how often it uses an ability when one is ready
    dmg: .5 + .4 * k,                       // share of its damage that lands
    hp: .75 + .25 * k,                      // share of its health
    rarity: diff >= 8 ? 2 : diff >= 4 ? 1 : 0,
    potions: diff >= 9 ? 2 : diff >= 5 ? 1 : 0,
    kite: diff >= 4,                        // ranged champions keep their distance
    talents: diff >= 3,                     // spends its skill points
  };
}

Object.assign(SIM, {
  // talk → arena dialog; fight → ask the host to pick a champion (it has the Data Dragon list)
  arenaInput(W, c, cmd){
    if(!cmd.arena) return false;
    const npc = NPCS.find(n => n.arena);
    if(c.dead || c.duel || c.arenaPending) return true;
    const diff = arenaSkill(cmd.diff).diff;
    if(Math.hypot(c.x - npc.x, c.y - npc.y) > 500){ SIM.tell(W, c, `Talk to ${npc.name} to start a practice duel.`); return true; }
    c.arenaPending = true; W.arenaReqs.push({ side: c.side, diff });
    SIM.fx(W, { k: "msg", side: c.side, text: `${npc.name} whistles. A challenger steps into the ring...` });
    return true;
  },
  arenaFail(W, side){ const c = SIM.hero(W, side); if(c){ c.arenaPending = false; SIM.tell(W, c, "No challenger came. Try again."); } },
  // spawn the opponent (champion detail `d`) and start the duel in the ring
  arenaStart(W, side, d, diff){
    const c = SIM.hero(W, side); if(!c) return null;
    c.arenaPending = false;
    if(c.dead || c.duel) return null;
    const skill = arenaSkill(diff), bs = "bot" + W.nid++, b = SIM.addHero(W, bs, d);
    b.bot = true; b.lvl = c.lvl; b.skill = skill; b.hpMult = skill.hp;
    for(const sl of EQ_SLOTS) b.equip[sl] = genItem({ ilvl: c.lvl + 1, rarity: skill.rarity, cls: b.kit.cls, slot: sl, nid: W.nid++ });
    b.talents = skill.talents ? SIM.botTalents(b) : newTalents(); SIM.recalc(b); b.hp = b.maxHp;
    Object.assign(b, { aiT: 0, potions: skill.potions, dodged: {}, seen: null });
    // Vex sends you both to the Proving Grounds, each behind your own gate
    SIM.pgDuel(W, c, b, { arena: true, diff: skill.diff });
    SIM.note(W, [c.side], `${b.name} waits behind the far gate of the Proving Grounds. Level ${b.lvl} · Difficulty ${skill.diff} (${ARENA_DIFF_NAMES[skill.diff]}). The gates open on "Fight!"`);
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
    if(winner && winner === p){
      const coins = Math.round(ARENA_RULES.reward * d.diff * p.lvl); p.coins += coins; p.gearVer++;
      p.arenaWins = (p.arenaWins || 0) + 1; p.arenaBest = Math.max(p.arenaBest || 0, d.diff);
      SIM.fx(W, { k: "msg", side: p.side, text: `Vex tosses you ${fmtCoins(coins)}. Arena wins: ${p.arenaWins} · best: difficulty ${p.arenaBest}.` });
    }
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
      if(!(sh.id in b.dodged)) b.dodged[sh.id] = Math.random() < b.skill.dodge;
      if(!b.dodged[sh.id]) continue;
      const side = (rx * vy - ry * vx) >= 0 ? 1 : -1;
      return SIM.botInRing(b, [b.x + vy * side * 280, b.y - vx * side * 280]);
    }
    for(const z of [...W.zones, ...W.fields]){
      if(z.owner !== o.id) continue;
      const dx = b.x - z.x, dy = b.y - z.y, dd = Math.hypot(dx, dy) || 1; if(dd > z.r + b.r) continue;
      if(!(z.id in b.dodged)) b.dodged[z.id] = Math.random() < b.skill.dodge;
      if(!b.dodged[z.id]) continue;
      return SIM.botInRing(b, [z.x + dx / dd * (z.r + b.r + 90), z.y + dy / dd * (z.r + b.r + 90)]);
    }
    return null;
  },
  // keep a destination inside the duel area (slide around the edge instead of leaving)
  botInRing(b, p){
    const d = b.duel; if(!d) return p;
    if(d.pg){ const u = { x: p[0], y: p[1], r: b.r, duel: d, side: b.side }; SIM.boundIn(null, u); return [u.x, u.y]; }
    const dx = p[0] - d.x, dy = p[1] - d.y, dd = Math.hypot(dx, dy) || 1, lim = d.r * .85;
    return dd <= lim ? p : [d.x + dx / dd * lim, d.y + dy / dd * lim];
  },
  // where the opponent will be after `secs`, from how it has been moving
  // (worse aim at low difficulty: it leads you less and scatters its shots)
  botLead(b, o, secs){
    const s = b.seen, aim = b.skill.aim, err = (1 - aim) * 140, a = Math.random() * Math.PI * 2, e = Math.random() * err;
    if(!s) return [o.x + Math.cos(a) * e, o.y + Math.sin(a) * e];
    const t = Math.min(secs, 1.2) * aim;
    return [o.x + s.vx * t + Math.cos(a) * e, o.y + s.vy * t + Math.sin(a) * e];
  },
  botTick(W, b, dt){
    const d = b.duel, o = d && SIM.duelOther(W, b);
    // track the opponent's velocity for aiming
    if(o){ if(b.seen && W.t > b.seen.t){ const k = W.t - b.seen.t; b.seen.vx = b.seen.vx * .5 + (o.x - b.seen.x) / k * .5; b.seen.vy = b.seen.vy * .5 + (o.y - b.seen.y) / k * .5; } b.seen = { x: o.x, y: o.y, t: W.t, vx: b.seen ? b.seen.vx : 0, vy: b.seen ? b.seen.vy : 0 }; }
    b.aiT -= dt; if(b.aiT > 0) return;
    b.aiT = b.skill.react[0] + Math.random() * (b.skill.react[1] - b.skill.react[0]);
    if(!o || b.dead){ b.move = b.target = null; return; }
    const dist = Math.hypot(o.x - b.x, o.y - b.y), hpP = b.hp / b.maxHp;
    if(d.state !== "fight"){ b.move = b.target = null; b.face = Math.atan2(o.x - b.x, o.y - b.y); return; }
    const can = k => b.cds[k] <= 0 && !ultLocked(b.kit, b.lvl, k) && SIM.canAct(b) && !b.dash;
    const cast = (k, at) => { SIM.cast(W, b, k, [Math.round(at[0]), Math.round(at[1])]); return true; };
    const away = len => SIM.botInRing(b, [b.x - (o.x - b.x) / (dist || 1) * len, b.y - (o.y - b.y) / (dist || 1) * len]);
    // 1. dodge, and shield up if something is coming
    const dodge = SIM.botThreat(W, b, o);
    if(dodge){
      b.target = null; b.move = dodge;
      for(const k of kitKeys(b.kit)) if(can(k) && b.kit[k].type === "shield"){ cast(k, [b.x, b.y]); break; }
      for(const k of kitKeys(b.kit)) if(can(k) && b.kit[k].type === "blink"){ cast(k, dodge); break; }
      return;
    }
    // 2. stay alive
    if(hpP < .35 && b.potions > 0 && W.t >= (b.potT || 0)){ b.hp = Math.min(b.maxHp, b.hp + b.maxHp * POTION.heal); b.potT = W.t + POTION.cd; b.potions--; SIM.fx(W, { k: "heal", side: b.side, v: Math.round(b.maxHp * POTION.heal) }); }
    for(const k of kitKeys(b.kit)){
      if(!can(k)) continue; const p = b.kit[k];
      if(p.type === "heal" && hpP < .6) return void cast(k, [b.x, b.y]);
      if(p.type === "shield" && hpP < .55 && dist < 700) return void cast(k, [b.x, b.y]);
      if(p.type === "stealth" && hpP < .3) return void cast(k, [b.x, b.y]);
    }
    // 2b. no line of sight (a pillar in the way): don't waste a shot, walk round to find one
    if(SIM.losBlocked(b.x, b.y, o.x, o.y)){ b.move = null; b.target = o.id; return; }
    // 3. attack with abilities, best first (ultimate, then the rest); easier opponents hold back more often
    if(Math.random() < b.skill.abilities) for(const k of ["R", "Q", "E", "W"]){
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
    if(b.ranged && b.skill.kite && dist < b.range * .55){
      const perp = [-(o.y - b.y) / (dist || 1), (o.x - b.x) / (dist || 1)], sideStep = (Math.floor(W.t / 1.5) % 2) ? 1 : -1, back = away(260);
      b.target = null; b.move = SIM.botInRing(b, [back[0] + perp[0] * 140 * sideStep, back[1] + perp[1] * 140 * sideStep]);
    }else{ b.move = null; b.target = o.id; }
  },
});
