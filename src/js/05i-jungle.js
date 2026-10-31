"use strict";
// The Thornveil Jungle: the portals behind the Saint's altar, the waystones between Canopy Camp and
// Highwatch, and the jungle's two raid bosses (their scripts join DBOSS; they run on SIM.dbossTick).
// Adds to SIM (host only).

const JUNGLE = {
  portalR: 150,       // how close you must step to a portal or waystone
  carry: 2600,        // party members this close to the portal go through with you
};
const inJungle = (x, y) => x > ZS && y > DZ;

/* ---------- Raid boss scripts ---------- */
Object.assign(DBOSS, {
  // Mawgrot, the River Tyrant: a colossal crocodile. Thrash, death roll, murky spray; dives twice and
  // ambushes from under the water while his crocodiles attack, then erupts back up.
  mawgrot: {
    intro: "When he dives, keep moving: he comes up under somebody.",
    abilities: [
      { id: "thrash", cd: 12, first: 6, ok: (W, m, t, ar) => ar.some(h => Math.hypot(h.x - m.x, h.y - m.y) < m.r + 300),
        use(W, m){ SIM.danger(W, m, { shape: "circle", x: m.x, y: m.y, r: m.r + 280, t: 1.5, dmg: 435, knock: 350, name: "Thrash" }); SIM.bossSay(W, m, "", "Mawgrot thrashes his tail!"); } },
      { id: "roll", cd: 15, first: 10, ok: (W, m, t, ar) => ar.some(h => Math.hypot(h.x - m.x, h.y - m.y) > 500),
        use(W, m, t, ar){
          const far = ar.slice().sort((a, b) => Math.hypot(b.x - m.x, b.y - m.y) - Math.hypot(a.x - m.x, a.y - m.y))[0], d = Math.hypot(far.x - m.x, far.y - m.y) || 1;
          SIM.danger(W, m, { shape: "line", x: m.x, y: m.y, dx: (far.x - m.x) / d, dy: (far.y - m.y) / d, len: Math.min(1700, d + 200), w: 320, t: 1.3, dmg: 485, stun: 1, leap: true, name: "Death Roll" });
          SIM.bossSay(W, m, "", `Mawgrot rolls toward ${far.name}!`);
        } },
      { id: "spray", cd: 14, first: 4, ok: (W, m, t) => Math.hypot(t.x - m.x, t.y - m.y) < 1000,
        use(W, m, t){ const d = Math.hypot(t.x - m.x, t.y - m.y) || 1, dx = (t.x - m.x) / d, dy = (t.y - m.y) / d;
          SIM.danger(W, m, { shape: "cone", x: m.x, y: m.y, dx, dy, r: 950, ang: 60, t: 1.2, dmg: 300, name: "Murky Spray" });
          SIM.danger(W, m, { shape: "circle", x: m.x + dx * 600, y: m.y + dy * 600, r: 200, t: 1.2, dmg: 0, hazard: { r: 230, dur: 10, dmg: 45 }, name: "Bog Water" }); } },
    ],
    phase(W, m, hp){
      for(const at of [.65, .3]) if(hp < at && !m.flags["dive" + at]){
        m.flags["dive" + at] = 1; Object.assign(m, { immune: true, hidden: true, subT: 9, ambushT: 1.2, cast: null });
        SIM.bossSay(W, m, "Mawgrot dives!", "He'll come up under someone. Keep moving, and kill his crocodiles!");
        SIM.bossAdds(W, m, ["croc", "croc"]);
      }
      if(hp < .12 && !m.enraged){ m.enraged = true; SIM.bossSay(W, m, "Mawgrot is enraged!", "Finish him!"); }
    },
    channel(W, m, dt, ar){
      if(m.surfacing) return SIM.resurfacing(W, m, dt);
      m.subT -= dt; m.ambushT -= dt;
      if(m.ambushT <= 0 && m.subT > 2){ m.ambushT = 2; for(const h of ar.slice().sort(() => Math.random() - .5).slice(0, 2)) SIM.danger(W, m, { shape: "circle", x: h.x, y: h.y, r: 260, t: 1.6, dmg: 435, name: "Ambush" }, 0); }
      if(m.subT <= 0 && ar.length){
        const h = ar[Math.floor(Math.random() * ar.length)], T = MOBS[m.kind], a = Math.atan2(h.y - T.home[1], h.x - T.home[0]), k = Math.min(Math.hypot(h.x - T.home[0], h.y - T.home[1]), DELTA.r - 100);
        SIM.surface(W, m, T.home[0] + Math.cos(a) * k, T.home[1] + Math.sin(a) * k, { r: 480, dmg: 485, knock: 300, name: "Eruption", t: 1.6 });
        SIM.bossSay(W, m, "", "The water boils...");
      }
    },
  },
  // Shadowmane, Queen of the Canopy: a great black jaguar. Rending claws, long pounces, a roar that hurts
  // everyone; twice she vanishes, strikes from the shadows, and comes back with a pounce and her cubs.
  shadowmane: {
    intro: "Never stand in front of her. When she vanishes, spread out.",
    abilities: [
      { id: "rend", cd: 7, first: 3, ok: (W, m, t) => Math.hypot(t.x - m.x, t.y - m.y) < m.r + 380,
        use(W, m, t){ const d = Math.hypot(t.x - m.x, t.y - m.y) || 1; SIM.danger(W, m, { shape: "cone", x: m.x, y: m.y, dx: (t.x - m.x) / d, dy: (t.y - m.y) / d, r: m.r + 330, ang: 100, t: .9, dmg: 415, name: "Rending Claws" }); } },
      { id: "pounce", cd: 11, first: 7, ok: (W, m, t, ar) => ar.some(h => h !== t && Math.hypot(h.x - m.x, h.y - m.y) > 350),
        use(W, m, t, ar){
          const others = ar.filter(h => h !== t && Math.hypot(h.x - m.x, h.y - m.y) > 350), v = others[Math.floor(Math.random() * others.length)], d = Math.hypot(v.x - m.x, v.y - m.y) || 1;
          SIM.danger(W, m, { shape: "line", x: m.x, y: m.y, dx: (v.x - m.x) / d, dy: (v.y - m.y) / d, len: Math.min(1500, d + 120), w: 240, t: 1, dmg: 390, stun: .6, leap: true, name: "Pounce" });
          SIM.bossSay(W, m, "", `Shadowmane crouches, eyes on ${v.name}!`);
        } },
      { id: "roar", cd: 16, first: 2, when: (m, hp) => hp < .75,
        use(W, m){ SIM.danger(W, m, { shape: "pulse", x: m.x, y: m.y, r: 1600, t: 1.4, dmg: 255, name: "Jungle Roar" }); SIM.bossSay(W, m, "", "Shadowmane's roar shakes the ruins!"); } },
    ],
    phase(W, m, hp){
      for(const at of [.55, .2]) if(hp < at && !m.flags["vanish" + at]){
        m.flags["vanish" + at] = 1; Object.assign(m, { immune: true, hidden: true, subT: 8, ambushT: 1, cast: null });
        SIM.bossSay(W, m, "Shadowmane vanishes!", "She strikes from the shadows. Spread out, and kill her cubs!");
        SIM.bossAdds(W, m, ["prowler", "prowler"]);
      }
      if(hp < .12 && !m.enraged){ m.enraged = true; SIM.bossSay(W, m, "Shadowmane is enraged!", "Finish her!"); }
    },
    channel(W, m, dt, ar){
      if(m.surfacing) return SIM.resurfacing(W, m, dt);
      m.subT -= dt; m.ambushT -= dt;
      if(m.ambushT <= 0 && m.subT > 1.5 && ar.length){ m.ambushT = 1.5; const h = ar[Math.floor(Math.random() * ar.length)]; SIM.danger(W, m, { shape: "circle", x: h.x, y: h.y, r: 220, t: 1.1, dmg: 345, name: "Shadow Strike" }, 0); }
      if(m.subT <= 0 && ar.length){
        const h = ar.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];   // she comes back on the weakest
        SIM.surface(W, m, h.x, h.y, { r: 300, dmg: 415, name: "Ambush Pounce", t: 1.1 });
        SIM.bossSay(W, m, "", `Shadowmane leaps at ${h.name} from the dark!`);
      }
    },
  },
});

Object.assign(SIM, {
  inJungle: u => inJungle(u.x, u.y),
  // a hidden boss telegraphs where it will come back up, then appears there
  surface(W, m, x, y, o){
    m.surfacing = { x, y, t: o.t }; m.subT = 99;
    SIM.danger(W, m, { shape: "circle", x, y, r: o.r, t: o.t, dmg: o.dmg, knock: o.knock, name: o.name }, 0);
  },
  resurfacing(W, m, dt){
    const s = m.surfacing; s.t -= dt;
    if(s.t <= 0){ m.x = s.x; m.y = s.y; m.surfacing = null; m.immune = false; m.hidden = false; }
  },
  canEnterJungle(W, c){ const q = c.quests.ashensaint; return !!(q && (q.state === "ready" || q.state === "done")) || Object.keys(c.quests).some(id => QUESTS[id].giver === "tamsin" || QUESTS[id].giver === "ezo"); },
  // step into a portal: you and your party nearby (hired champions too) go through
  portalParty(W, c, from, to, big, small){
    const group = SIM.partyMembers(W, c).filter(h => !h.dead && (h === c || Math.hypot(h.x - from.x, h.y - from.y) < JUNGLE.carry));
    group.forEach((h, k) => SIM.teleport(W, h, to[0] + (k % 3 - 1) * 170, to[1] - Math.floor(k / 3) * 170));
    SIM.fx(W, { k: "bossmsg", to: group.filter(h => !h.bot).map(h => h.side), big, small });
  },
  // a waystone takes you and your hired champions to its twin
  waystone(W, c, to, text){
    const group = [c, ...SIM.heroes(W).filter(h => h.merc && h.merc.owner === c.side && !h.dead)];
    group.forEach((h, k) => SIM.teleport(W, h, to.x + (k - 1) * 140, to.y - 320));
    SIM.fx(W, { k: "msg", side: c.side, text });
  },
  jungleTick(W){
    const D = W.dungeon, open = !!(D && D.down.saint);
    for(const c of SIM.heroes(W)){
      if(c.bot || c.dead || c.portalT > W.t) continue;
      const near = p => Math.hypot(c.x - p.x, c.y - p.y) < JUNGLE.portalR;
      const tell = text => { if(!(c.portalWarnT > W.t)){ c.portalWarnT = W.t + 6; SIM.fx(W, { k: "msg", side: c.side, text }); } };
      if(SIM.inCathedral(c)){
        if(open && near(CHOIR_PORTALS.right)) SIM.portalParty(W, c, CHOIR_PORTALS.right, JUNGLE_ARRIVE, "The Thornveil Jungle", "Heat, birdsong and the smell of rain. Ranger Tamsin's camp is close by.");
        else if(open && near(CHOIR_PORTALS.left)) tell("The left portal shimmers, but its far side is still sealed. Another day.");
      }else if(SIM.inJungle(c)){
        if(near(WAYSTONES.jungle)) SIM.waystone(W, c, WAYSTONES.peaks, "The waystone hums, and you step out by Highwatch Outpost.");
      }else if(near(WAYSTONES.peaks)){
        if(SIM.canEnterJungle(W, c)) SIM.waystone(W, c, WAYSTONES.jungle, "The waystone hums, and the air turns warm and wet. Canopy Camp.");
        else tell("The waystone is dark. Its twin lies somewhere beyond the Ashen Cathedral.");
      }
    }
  },
});
