"use strict";
// Professions (host only): learning from Master Artisan Brenna, gathering nodes, skinning beasts,
// Artisanry at a forge, set bonuses, and the three six-piece set effects. Adds to SIM.

Object.assign(SIM, {
  hasProf: (c, p) => !!c.prof && c.prof[p] !== undefined && c.prof[p] !== null,
  skillUp(W, c, p, req){
    const g = skillGain(c.prof[p], req); if(!g) return;
    c.prof[p] = Math.min(PROF_MAX, c.prof[p] + g);
    SIM.fx(W, { k: "skillup", side: c.side, prof: p, v: c.prof[p] });
  },
  craftInput(W, c, cmd){
    if(cmd.learn !== undefined){
      const p = String(cmd.learn), npc = NPCS.find(n => n.profs);
      if(!Object.hasOwn(PROFS, p) || c.dead) return true;
      if(Math.hypot(c.x - npc.x, c.y - npc.y) > 500){ SIM.tell(W, c, `Talk to ${npc.name} in Sunhollow village to learn a profession.`); return true; }
      c.prof = c.prof || {};
      if(SIM.hasProf(c, p)) return true;
      c.prof[p] = 1; SIM.fx(W, { k: "learned", side: c.side, prof: p });
      return true;
    }
    if(cmd.craft !== undefined){ SIM.craft(W, c, String(cmd.craft), Math.max(1, Math.min(10, Math.floor(+cmd.n) || 1))); return true; }
    return false;
  },
  nearForge: c => FORGES.some(f => Math.hypot(c.x - f.x, c.y - f.y) < FORGE_RANGE),
  countMat: (c, key) => c.inv.filter(x => x.key === key).reduce((a, x) => a + (x.q || 1), 0),
  takeMat(c, key, n){
    for(let i = c.inv.length - 1; i >= 0 && n > 0; i--){ const it = c.inv[i]; if(it.key !== key) continue; const k = Math.min(n, it.q || 1); it.q = (it.q || 1) - k; n -= k; if(it.q <= 0) c.inv.splice(i, 1); }
  },
  craft(W, c, id, times){
    const R = RECIPES[id];
    if(!R || !Object.hasOwn(RECIPES, id) || c.dead) return;
    if(!SIM.hasProf(c, "artisanry")){ SIM.tell(W, c, "Learn Artisanry from Master Artisan Brenna first."); return; }
    if(!SIM.nearForge(c)){ SIM.tell(W, c, "You need to be at an Artisan's Forge to craft."); return; }
    if(c.prof.artisanry < R.req){ SIM.tell(W, c, `That needs Artisanry ${R.req}.`); return; }
    if(R.out.set) times = 1;
    let made = 0;
    for(let k = 0; k < times; k++){
      if(Object.keys(R.need).some(m => SIM.countMat(c, m) < R.need[m])) break;
      const it = R.out.mat ? makeMat(R.out.mat, W.nid++) : makeSetItem(R.out.set, R.out.slot, W.nid++);
      if(!R.out.mat && c.inv.length >= BAG_SIZE) break;
      for(const m in R.need) SIM.takeMat(c, m, R.need[m]);
      if(!SIM.addItem(c, it)) SIM.dropItems(W, c, [it]);
      made++; SIM.skillUp(W, c, "artisanry", R.req);
    }
    if(!made){ SIM.tell(W, c, c.inv.length >= BAG_SIZE && R.out.set ? "Your bags are full." : "You don't have the materials for that."); return; }
    c.gearVer++;
    SIM.fx(W, { k: "crafted", side: c.side, n: recipeName(R), q: made, set: R.out.set || "", x: c.x, y: c.y });
  },
  // a node: quest progress if a collect quest wants it, and materials if you have the profession
  gather(W, c, n){
    const qid = SIM.collectQuest(c, n.kind), G2 = GATHER[n.kind], can = G2 && SIM.hasProf(c, G2.prof);
    if(!qid && !can){ SIM.fx(W, { k: "msg", side: c.side, text: G2 ? `${NODE_INFO[n.kind].idle} (Learn ${PROFS[G2.prof].name} from Master Artisan Brenna.)` : NODE_INFO[n.kind].idle }); return; }
    if(!qid && c.prof[G2.prof] < G2.req){ SIM.fx(W, { k: "msg", side: c.side, text: `${NODE_INFO[n.kind].name} needs ${PROFS[G2.prof].name} ${G2.req}.` }); return; }
    n.ready = false; n.respawnAt = W.t + 25;
    SIM.fx(W, { k: "pick", x: n.x, y: n.y });
    if(qid){
      SIM.progress(W, c, qid);
      for(const m of SIM.partyMembers(W, c)){   // party members gathering nearby get one too
        if(m === c || m.dead || Math.hypot(m.x - n.x, m.y - n.y) > SHARE_RANGE) continue;
        const mq = SIM.collectQuest(m, n.kind); if(mq) SIM.progress(W, m, mq);
      }
    }
    if(can && c.prof[G2.prof] >= G2.req){
      const got = Object.assign(makeMat(G2.mat, W.nid++), { q: 1 + (Math.random() < .35 ? 1 : 0) });
      if(!SIM.addItem(c, got)){ SIM.tell(W, c, "Your bags are full."); return; }
      SIM.fx(W, { k: "gathered", side: c.side, n: got.n, q: got.q, prof: G2.prof });
      SIM.skillUp(W, c, G2.prof, G2.req);
    }
  },
  // the killer skins a beast as it falls
  skin(W, c, u){
    const S = SKIN[u.kind]; if(!S || !c || c.bot || !SIM.hasProf(c, "skinning") || c.prof.skinning < S[1]) return;
    const got = Object.assign(makeMat(S[0], W.nid++), { q: S[2] });
    if(!SIM.addItem(c, got)) return;
    SIM.fx(W, { k: "gathered", side: c.side, n: got.n, q: got.q, prof: "skinning" });
    SIM.skillUp(W, c, "skinning", S[1]);
  },

  /* ---------- Sets ---------- */
  // called at the end of SIM.recalc: count the worn set and apply its 2- and 4-piece bonuses
  applySet(c){
    const s = setCount(c.equip); c.setKey = s.key; c.setN = s.n;
    if(!s.key) return;
    if(s.key === "dawn"){ if(s.n >= 2) c.maxHp = Math.round(c.maxHp * 1.1); if(s.n >= 4) c.ad *= 1.15; }
    if(s.key === "storm"){ if(s.n >= 2) c.msPct = Math.min(38, c.msPct + 8); if(s.n >= 4) c.ad *= 1.15; }
    if(s.key === "void"){ if(s.n >= 2) c.maxHp = Math.round(c.maxHp * 1.1); if(s.n >= 4) c.ap += 20; }
  },
  // six pieces: Radiant Wrath (melee) and Chain Lightning (ranged), after a basic attack lands
  setOnHit(W, c, t, dmg){
    if(c.setN < 6 || !t) return;
    if(c.setKey === "dawn" && ++c.setHits % 4 === 0){
      SIM.fx(W, { k: "nova", x: t.x, y: t.y, r: 340, dawn: 1 });
      for(const u of SIM.enemies(W, c)) if(Math.hypot(u.x - t.x, u.y - t.y) < 340 + u.r) SIM.damage(W, u, c.ad * 1.5, c);
    }
    if(c.setKey === "storm"){
      let from = t;
      const near = SIM.enemies(W, c).filter(u => u !== t && Math.hypot(u.x - t.x, u.y - t.y) < 650).sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y)).slice(0, 2);
      for(const u of near){ SIM.fx(W, { k: "zap", x: from.x, y: from.y, x2: u.x, y2: u.y }); SIM.damage(W, u, dmg * .6, c); from = u; }
    }
  },
  // six Voidweave pieces: every 3rd ability you cast doesn't go on cooldown
  voidEcho(W, c, key){
    if(c.setKey !== "void" || c.setN < 6 || ++c.setCasts % 3) return;
    c.cds[key] = 0; SIM.fx(W, { k: "voidecho", side: c.side, x: c.x, y: c.y });
  },
});
