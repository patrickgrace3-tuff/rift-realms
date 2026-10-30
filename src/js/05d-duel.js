"use strict";
// PvP duels between two players. Adds to SIM (host only). No DOM or three.js.
// A challenge is accepted, a flag drops between the duelists, a countdown runs from 5,
// then the two can damage each other (SIM.hostile). The duel ends at 1 health: nobody dies.

const DUEL = {
  reach: 1500,     // how close the two must be to challenge or accept
  radius: 1000,    // the duel area around the flag
  count: 5,        // countdown seconds
  outGrace: 6,     // seconds you may stand outside the area before you forfeit
  askTime: 30,     // seconds a challenge waits for an answer
};

Object.assign(SIM, {
  // can `a` damage `u`? Creatures and heroes always can; two heroes only in a running duel together
  hostile(a, u){ return !!a && !!u && a !== u && (a.team !== u.team || (!!a.duel && a.duel === u.duel && a.duel.state === "fight")); },
  duelInput(W, c, cmd){
    if(cmd.duel !== undefined){ SIM.duelChallenge(W, c, String(cmd.duel)); return true; }
    if(cmd.duelaccept !== undefined){ SIM.duelAccept(W, c, String(cmd.duelaccept)); return true; }
    if(cmd.dueldecline !== undefined){ SIM.duelDecline(W, c, String(cmd.dueldecline)); return true; }
    if(cmd.duelyield){ if(c.duel) SIM.duelEnd(W, c.duel, SIM.duelOther(W, c), c, "yield"); return true; }
    return false;
  },
  duelOther(W, c){ const d = c.duel; return d ? W.heroes[d.a === c.side ? d.b : d.a] || null : null; },
  duelChallenge(W, c, side){
    const t = SIM.hero(W, side); if(!t || t === c) return;
    if(c.dead || t.dead){ SIM.tell(W, c, "You can't duel right now."); return; }
    if(c.duel){ SIM.tell(W, c, "You're already in a duel."); return; }
    if(t.duel){ SIM.tell(W, c, `${t.name} is already in a duel.`); return; }
    if(Math.hypot(c.x - t.x, c.y - t.y) > DUEL.reach){ SIM.tell(W, c, `${t.name} is too far away to challenge.`); return; }
    if(W.duelReqs.some(q => q.from === c.side && q.to === side)) return;
    W.duelReqs = W.duelReqs.filter(q => q.to !== side);
    W.duelReqs.push({ from: c.side, to: side, until: W.t + DUEL.askTime });
    SIM.note(W, [c.side], `You challenged ${t.name} to a duel.`);
    SIM.fx(W, { k: "duelreq", to: [side], from: c.side, name: c.name });
  },
  duelAccept(W, c, from){
    const q = W.duelReqs.find(x => x.from === from && x.to === c.side); if(!q) return;
    W.duelReqs = W.duelReqs.filter(x => x !== q);
    const a = SIM.hero(W, from);
    if(!a || a.dead || c.dead || a.duel || c.duel || Math.hypot(a.x - c.x, a.y - c.y) > DUEL.reach){ SIM.tell(W, c, "That duel can't start now."); return; }
    const d = { id: "d" + W.nid++, a: a.side, b: c.side, x: (a.x + c.x) / 2, y: (a.y + c.y) / 2, r: DUEL.radius, state: "count", startAt: W.t + DUEL.count, lastN: DUEL.count + 1, out: {} };
    W.duels.push(d); a.duel = c.duel = d;
    SIM.note(W, [a.side, c.side], `Duel! ${a.name} vs ${c.name}. Stay near the flag.`);
  },
  duelDecline(W, c, from){
    const had = W.duelReqs.some(q => q.from === from && q.to === c.side);
    W.duelReqs = W.duelReqs.filter(q => !(q.from === from && q.to === c.side));
    if(had && SIM.hero(W, from)) SIM.note(W, [from], `${c.name} declined your duel.`);
  },
  // winner may be null (a cancelled duel)
  duelEnd(W, d, winner, loser, why){
    if(d.state === "done") return;
    d.state = "done"; W.duels = W.duels.filter(x => x !== d);
    const A = W.heroes[d.a], B = W.heroes[d.b], both = [A, B].filter(Boolean);
    for(const h of both){ if(h.duel === d) h.duel = null; const o = h === A ? B : A; if(o && h.target === o.id) h.target = null; }
    const near = SIM.heroes(W).filter(h => Math.hypot(h.x - d.x, h.y - d.y) < 3000).map(h => h.side);
    if(winner && loser){
      SIM.fx(W, { k: "duelend", to: both.map(h => h.side), win: winner.side, winName: winner.name, loseName: loser.name, why });
      if(near.length) SIM.note(W, near, why === "fled" ? `${loser.name} fled from a duel with ${winner.name}.` : why === "yield" ? `${loser.name} yielded to ${winner.name} in a duel.` : `${winner.name} has defeated ${loser.name} in a duel!`);
    }else if(both.length) SIM.note(W, both.map(h => h.side), "The duel was cancelled.");
  },
  duelTick(W){
    if(W.duelReqs.length) W.duelReqs = W.duelReqs.filter(q => q.until > W.t && SIM.hero(W, q.from) && SIM.hero(W, q.to));
    for(const d of W.duels.slice()){
      const A = W.heroes[d.a], B = W.heroes[d.b];
      if(!A || !B || A.dead || B.dead){ SIM.duelEnd(W, d, null, null, "cancel"); continue; }
      if(d.state === "count"){
        const n = Math.ceil(d.startAt - W.t);
        if(n < d.lastN && n > 0){ d.lastN = n; SIM.fx(W, { k: "duelcount", to: [d.a, d.b], n }); }
        if(W.t >= d.startAt){ d.state = "fight"; SIM.fx(W, { k: "duelcount", to: [d.a, d.b], n: 0 }); }
      }
      // stay inside the area or forfeit
      for(const [h, o] of [[A, B], [B, A]]){
        if(d.state === "done") break;
        const out = Math.hypot(h.x - d.x, h.y - d.y) > d.r;
        if(!out){ d.out[h.side] = 0; continue; }
        if(!d.out[h.side]){ d.out[h.side] = W.t + DUEL.outGrace; SIM.fx(W, { k: "msg", side: h.side, text: `You're leaving the duel area! Return within ${DUEL.outGrace} seconds or you forfeit.` }); }
        else if(W.t >= d.out[h.side]) SIM.duelEnd(W, d, o, h, "fled");
      }
    }
  },
  // called from SIM.damage when one duelist hits the other: nobody dies, the duel ends at 1 health
  duelHit(W, u, src, amount){
    if(u.hp - amount >= 1) return amount;
    const dealt = Math.max(0, u.hp - 1);
    u.hp = 1; SIM.duelEnd(W, u.duel, src, u, "won");
    return dealt;
  },
  duelSnapshot(W){
    return {
      du: W.duels.map(d => [d.a, d.b, Math.round(d.x), Math.round(d.y), d.state === "fight" ? 1 : 0, d.r]),
      dq: W.duelReqs.map(q => [q.from, q.to]),
    };
  },
});
