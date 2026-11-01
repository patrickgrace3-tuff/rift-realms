"use strict";
// The Amberveil Wastes: the left-hand portal behind the Saint's altar, the waystones between Sandglass Oasis
// and Highwatch, and the desert's two raid bosses (their scripts join DBOSS; they run on SIM.dbossTick).
// Adds to SIM (host only).

const inDesert = (x, y) => x > ZS && y > ZS && y <= DZ;

/* ---------- Raid boss scripts ---------- */
Object.assign(DBOSS, {
  // Zahrak, the Dune Wyrm: a colossal sandworm. Sand blasts, a tail sweep, quicksand under your feet; twice
  // it burrows and erupts under the party while its scuttlers attack, then bursts back up.
  zahrak: {
    intro: "When it burrows, keep moving: it comes up under somebody.",
    abilities: [
      { id: "sweep", cd: 12, first: 6, ok: (W, m, t, ar) => ar.some(h => Math.hypot(h.x - m.x, h.y - m.y) < m.r + 320),
        use(W, m){ SIM.danger(W, m, { shape: "circle", x: m.x, y: m.y, r: m.r + 300, t: 1.5, dmg: 495, knock: 380, name: "Tail Sweep" }); SIM.bossSay(W, m, "", "Zahrak's tail sweeps the sand!"); } },
      { id: "blast", cd: 13, first: 4, ok: (W, m, t) => Math.hypot(t.x - m.x, t.y - m.y) < 1100,
        use(W, m, t){ const d = Math.hypot(t.x - m.x, t.y - m.y) || 1; SIM.danger(W, m, { shape: "cone", x: m.x, y: m.y, dx: (t.x - m.x) / d, dy: (t.y - m.y) / d, r: 1000, ang: 55, t: 1.2, dmg: 360, name: "Sandblast" }); } },
      { id: "quicksand", cd: 16, first: 9,
        use(W, m, t, ar){ for(const h of ar.slice().sort(() => Math.random() - .5).slice(0, 2)) SIM.danger(W, m, { shape: "circle", x: h.x, y: h.y, r: 220, t: 1.6, dmg: 160, hazard: { r: 240, dur: 12, dmg: 55 }, name: "Quicksand" }, 0);
          SIM.bossSay(W, m, "", "The sand sinks under your feet!"); } },
    ],
    phase(W, m, hp){
      for(const at of [.65, .3]) if(hp < at && !m.flags["burrow" + at]){
        m.flags["burrow" + at] = 1; Object.assign(m, { immune: true, hidden: true, subT: 9, ambushT: 1.2, cast: null });
        SIM.bossSay(W, m, "Zahrak burrows!", "It will erupt under someone. Keep moving, and kill the scuttlers!");
        SIM.bossAdds(W, m, ["scuttler", "scuttler", "scuttler"]);
      }
      if(hp < .12 && !m.enraged){ m.enraged = true; SIM.bossSay(W, m, "Zahrak is enraged!", "Finish it!"); }
    },
    channel(W, m, dt, ar){
      if(m.surfacing) return SIM.resurfacing(W, m, dt);
      m.subT -= dt; m.ambushT -= dt;
      if(m.ambushT <= 0 && m.subT > 2){ m.ambushT = 2; for(const h of ar.slice().sort(() => Math.random() - .5).slice(0, 2)) SIM.danger(W, m, { shape: "circle", x: h.x, y: h.y, r: 270, t: 1.6, dmg: 445, name: "Sand Spout" }, 0); }
      if(m.subT <= 0 && ar.length){
        const h = ar[Math.floor(Math.random() * ar.length)], T = MOBS[m.kind], a = Math.atan2(h.y - T.home[1], h.x - T.home[0]), k = Math.min(Math.hypot(h.x - T.home[0], h.y - T.home[1]), SCOURED_BASIN.r - 100);
        SIM.surface(W, m, T.home[0] + Math.cos(a) * k, T.home[1] + Math.sin(a) * k, { r: 480, dmg: 495, knock: 320, name: "Eruption", t: 1.6 });
        SIM.bossSay(W, m, "", "The ground trembles...");
      }
    },
  },
  // Queen Ankhara, the Sun-Bound: a risen queen. Lances of sunlight, a curse that burns the sand you stand
  // on, a scorching sandstorm; twice her tomb guard rises and shields her until they fall.
  ankhara: {
    intro: "Kill her tomb guard when they shield her. Step out of cursed sand.",
    abilities: [
      { id: "lance", cd: 9, first: 3, ok: (W, m, t, ar) => ar.length > 0,
        use(W, m, t, ar){
          const far = ar.slice().sort((a, b) => Math.hypot(b.x - m.x, b.y - m.y) - Math.hypot(a.x - m.x, a.y - m.y))[0], d = Math.hypot(far.x - m.x, far.y - m.y) || 1;
          SIM.danger(W, m, { shape: "line", x: m.x, y: m.y, dx: (far.x - m.x) / d, dy: (far.y - m.y) / d, len: Math.min(1800, d + 300), w: 260, t: 1.3, dmg: 455, name: "Solar Lance" });
          SIM.bossSay(W, m, "", `Ankhara points at ${far.name}. Sunlight gathers...`);
        } },
      { id: "curse", cd: 15, first: 8,
        use(W, m, t, ar){ for(const h of ar) SIM.danger(W, m, { shape: "circle", x: h.x, y: h.y, r: 230, t: 2, dmg: 260, hazard: { r: 230, dur: 14, dmg: 60 }, name: "Curse of Sand" }, 1);
          SIM.bossSay(W, m, "", "The sand under each of you is cursed! Move!"); } },
      { id: "storm", cd: 18, first: 2, when: (m, hp) => hp < .75,
        use(W, m){ SIM.danger(W, m, { shape: "pulse", x: m.x, y: m.y, r: 1600, t: 1.5, dmg: 270, name: "Scorching Sandstorm" }); SIM.bossSay(W, m, "", "A scorching sandstorm fills the tomb!"); } },
    ],
    phase(W, m, hp){
      // twice, her tomb guard rises and shields her until it's dead
      for(const at of [.6, .25]) if(hp < at && !m.flags["guard" + at]){
        m.flags["guard" + at] = 1; m.immune = true; m.cast = null; m.burnT = 4; m.x = m.home[0]; m.y = m.home[1];
        SIM.bossSay(W, m, "Rise, my guard!", "Ankhara is shielded by her tomb guard. Kill them!");
        SIM.bossAdds(W, m, ["husk", "husk", "husk"]);
      }
      if(m.immune && !W.mobs.some(a => !a.dead && a.event === "dboss:" + m.id)){ m.immune = false; SIM.bossSay(W, m, "The guard has fallen!", "Ankhara is exposed. Strike now!"); }
      if(hp < .12 && !m.enraged){ m.enraged = true; SIM.bossSay(W, m, "Ankhara is enraged!", "Finish her!"); }
    },
    // while shielded she stands at her sarcophagus and the sun scorches everyone a little
    channel(W, m, dt, ar){
      m.burnT -= dt;
      if(m.burnT <= 0){ m.burnT = 3; SIM.fx(W, { k: "nova", x: m.x, y: m.y, r: 1500, fire: 1 }); for(const h of ar) SIM.damage(W, h, 150, m); }
    },
  },
});

Object.assign(SIM, {
  inDesert: u => inDesert(u.x, u.y),
  canEnterDesert(W, c){ const q = c.quests.ashensaint; return !!(q && (q.state === "ready" || q.state === "done")) || Object.keys(c.quests).some(id => QUESTS[id].giver === "daro" || QUESTS[id].giver === "nadira"); },
  desertTick(W){
    const D = W.dungeon, open = !!(D && D.down.saint);
    for(const c of SIM.heroes(W)){
      if(c.bot || c.dead || c.portalT > W.t) continue;
      const near = p => Math.hypot(c.x - p.x, c.y - p.y) < JUNGLE.portalR;
      const tell = text => { if(!(c.portalWarnT > W.t)){ c.portalWarnT = W.t + 6; SIM.fx(W, { k: "msg", side: c.side, text }); } };
      if(SIM.inCathedral(c)){
        if(open && near(CHOIR_PORTALS.left)) SIM.portalParty(W, c, CHOIR_PORTALS.left, DESERT_ARRIVE, "The Amberveil Wastes", "Blinding sun and endless dunes. Caravan Master Daro's camp is by the oasis.");
      }else if(SIM.inDesert(c)){
        if(near(WAYSTONES.desert)) SIM.waystone(W, c, WAYSTONES.peaksDesert, "The waystone hums, and you step out by Highwatch Outpost.");
      }else if(!SIM.inJungle(c) && near(WAYSTONES.peaksDesert)){
        if(SIM.canEnterDesert(W, c)) SIM.waystone(W, c, WAYSTONES.desert, "The waystone hums, and a wave of dry heat hits you. Sandglass Oasis.");
        else tell("The waystone is dark. Its twin lies somewhere beyond the Ashen Cathedral.");
      }
    }
  },
});
