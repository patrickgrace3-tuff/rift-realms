"use strict";
// Low-poly 3D bodies, in the chunky style of the first 3D online worlds. Everything is built in code from boxes and
// simple solids (no model files). Champions, NPCs and robed enemies are `Humanoid3D`: a 3D body whose head is the
// portrait medallion, drawn by the same code as the pixel bodies and always turned to the camera, so every champion
// stays recognisable from any side. Creatures are `Creature3D`, one builder per kind in `CREATURE_BUILD`.
// Models face +z; `face` (the simulation's angle) turns them with `faceYaw`.

const M3 = {};
function m3geo(){
  if(M3.box) return M3;
  M3.box = new THREE.BoxGeometry(1, 1, 1); M3.ico = new THREE.IcosahedronGeometry(.5, 0); M3.ball = new THREE.IcosahedronGeometry(.5, 1);
  M3.cyl = new THREE.CylinderGeometry(.5, .5, 1, 7); M3.cone = new THREE.ConeGeometry(.5, 1, 6); M3.oct = new THREE.OctahedronGeometry(.5, 0);
  M3.dod = new THREE.DodecahedronGeometry(.5, 0);
  M3.arc = new THREE.TorusGeometry(.5, .07, 4, 12, Math.PI);           // a bow's limbs, a ram's horn
  const wing = new THREE.BufferGeometry();                              // a flat wing: a triangle fan out to the side
  wing.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, .5, 1, 0, .2, 0, 0, -.5, 1, 0, .2, .9, 0, -.6, 0, 0, -.5], 3)); wing.computeVertexNormals();
  M3.wing = wing;
  return M3;
}
// shared materials for creatures (a few dozen colours in all)
const M3_MATS = new Map();
function m3mat(color, glow){
  const key = color + "|" + (glow || ""); let m = M3_MATS.get(key);
  if(!m){ m = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }); if(glow){ m.emissive = new THREE.Color(glow); m.emissiveIntensity = .9; } M3_MATS.set(key, m); }
  return m;
}
// a part made of shared geometry, sized w×h×d at x,y,z inside parent
function m3part(parent, geo, mat, w, h, d, x = 0, y = 0, z = 0){ const m = new THREE.Mesh(geo, mat); m.scale.set(w, h, d); m.position.set(x, y, z); parent.add(m); return m; }
function m3pivot(parent, x = 0, y = 0, z = 0){ const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; }
// the simulation's facing angle → the model's rotation about y (models face +z)
const faceYaw = face => Math.PI - face;
function turnToward(obj, target, dt, rate = 10){ let d = target - obj.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); obj.rotation.y += d * Math.min(1, dt * rate); }
const ease = (cur, to, dt, k = 16) => cur + (to - cur) * Math.min(1, dt * k);

/* =====================================================================
   HUMANOIDS: champions, NPCs, bandits and the cathedral's clergy
   ===================================================================== */
// the portrait medallion (or an NPC's drawn head) on its own canvas
function drawHead3D(g, art){
  const o = art.o, hx = 64, hy = 66, hr = 46;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 128, 128); g.imageSmoothingEnabled = true;
  if(o.drawHead){ o.drawHead(g, hx, hy, hr); return; }
  g.save(); g.beginPath(); g.arc(hx, hy, hr, 0, Math.PI * 2); g.clip();
  if(art.head){ try{ g.drawImage(art.head, hx - hr - 6, hy - hr - 6, (hr + 6) * 2, (hr + 6) * 2); }catch(e){} }
  else { g.fillStyle = "#3a4a66"; g.fill(); g.fillStyle = "#f0d58e"; g.font = "700 40px 'Barlow Condensed', sans-serif"; g.textAlign = "center"; g.fillText(o.initial || "?", hx, hy + 14); }
  g.restore();
  g.lineWidth = 5; g.strokeStyle = "#1b1410"; g.beginPath(); g.arc(hx, hy, hr, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2.5; g.strokeStyle = o.ring || "#c9a55c"; g.beginPath(); g.arc(hx, hy, hr - 3, 0, Math.PI * 2); g.stroke();
  if(o.helm){
    g.save(); g.lineCap = "round";
    g.lineWidth = 15; g.strokeStyle = "#1b1410"; g.beginPath(); g.arc(hx, hy, hr + 3, Math.PI * 1.06, Math.PI * 1.94); g.stroke();
    g.lineWidth = 11; g.strokeStyle = o.helm; g.beginPath(); g.arc(hx, hy, hr + 3, Math.PI * 1.06, Math.PI * 1.94); g.stroke();
    g.lineWidth = 3; g.strokeStyle = shade(o.helm, 1.35); g.beginPath(); g.arc(hx, hy, hr + 6, Math.PI * 1.2, Math.PI * 1.5); g.stroke();
    g.restore();
  }
}

class Humanoid3D {
  // art: a CharArt (its options carry the style, gear colours, set pieces and the portrait)
  constructor(art, opt = {}){
    m3geo(); this.art = art; this.opt = opt; this.root = new THREE.Group(); this.body = m3pivot(this.root); this.mats = []; this.key = null;
    this.ph = 0; this.opacity = 1;
    this.headC = document.createElement("canvas"); this.headC.width = this.headC.height = 128;
    this.headTex = new THREE.CanvasTexture(this.headC); this.headTex.encoding = THREE.sRGBEncoding;
    this.headMat = new THREE.SpriteMaterial({ map: this.headTex, transparent: true, alphaTest: .1 });
    this.head = new THREE.Sprite(this.headMat); this.head.center.set(.5, .1); this.head.scale.set(1.4, 1.4, 1);
    this.headKey = null;
    this.sync();
  }
  // rebuild when the gear, set pieces or weapon glow change; redraw the head when the portrait arrives or the helm changes
  sync(){
    const o = this.art.o, key = [o.gearSig, o.setKey, o.setN, o.setWeapon, o.tier ? 1 : 0].join("|");
    if(key !== this.key){ this.key = key; this.build(); }
    const hk = (this.art.head ? 1 : 0) + "|" + (o.helm || "");
    if(hk !== this.headKey){ this.headKey = hk; drawHead3D(this.headC.getContext("2d"), this.art); this.headTex.needsUpdate = true; }
  }
  mat(color, glow){ const m = new THREE.MeshLambertMaterial({ color }); if(glow){ m.emissive = new THREE.Color(glow); m.emissiveIntensity = .85; } this.mats.push(m); return m; }
  build(){
    const o = this.art.o, b = Object.assign({}, BODY[o.style] || BODY.melee, o.gear || {}), G3 = M3;
    for(const ch of [...this.body.children]) this.body.remove(ch);
    for(const m of this.mats) m.dispose(); this.mats = [];
    const tunic = this.mat(b.tunic), dark = this.mat(b.dark), trim = this.mat(b.trim), pants = this.mat(b.pants), boots = this.mat(b.boots), hand = this.mat(b.gloves || "#e8b88a");
    const SL = o.setKey && typeof SETS !== "undefined" ? SETS[o.setKey] : null, setN = SL ? o.setN : 0;
    // legs from the hips
    this.legs = [-1, 1].map(s => { const p = m3pivot(this.body, .16 * s, .92, 0); m3part(p, G3.box, pants, .22, .8, .24, 0, -.4, 0); m3part(p, G3.box, boots, .26, .16, .34, 0, -.84, .04); return p; });
    // torso, belt, robe
    m3part(this.body, G3.box, tunic, .64, .72, .38, 0, 1.28, 0);
    m3part(this.body, G3.box, dark, .66, .1, .4, 0, .96, 0); m3part(this.body, G3.box, trim, .12, .1, .05, 0, .96, .2);
    if(b.robe){ m3part(this.body, G3.box, tunic, .62, .7, .44, 0, .58, 0); m3part(this.body, G3.box, dark, .64, .06, .46, 0, .25, 0); m3part(this.body, G3.box, trim, .1, .82, .05, 0, .82, .2); }
    if(b.shirt) m3part(this.body, G3.box, this.mat(b.shirt), .32, .3, .05, 0, 1.5, .18);
    if(o.style === "melee" || o.style === "guard"){ const steel = this.mat("#aab6c6"); for(const s of [-1, 1]) m3part(this.body, G3.box, steel, .28, .18, .4, .4 * s, 1.62, 0); }
    if(o.style === "ranged" || o.style === "hunter"){ const bd = m3part(this.body, G3.box, trim, .08, .95, .05, 0, 1.3, .2); bd.rotation.z = .65; }
    m3part(this.body, G3.box, dark, .26, .1, .26, 0, 1.68, 0);   // neck
    // arms from the shoulders
    this.arms = [-1, 1].map(s => { const p = m3pivot(this.body, .42 * s, 1.58, 0); p.rotation.z = .08 * s; m3part(p, G3.box, dark, .18, .58, .2, 0, -.29, 0); m3part(p, G3.box, hand, .2, .18, .22, 0, -.66, 0); return p; });
    // the weapon sits in a hand: bows in the left, everything else in the right
    const bowHand = b.weapon === "bow" || o.setWeapon === "storm";
    this.wpn = m3pivot(this.arms[bowHand ? 0 : 1], 0, -.68, .02); this.bowHand = bowHand; this.weaponType = o.setWeapon || b.weapon;
    this.buildWeapon(b, o);
    // a pickaxe, shown only while mining
    this.pick = m3pivot(this.arms[1], 0, -.68, .02); this.pick.visible = false;
    m3part(this.pick, G3.box, this.mat("#7a5232"), .06, .06, .9, 0, 0, .3); const ph = m3part(this.pick, G3.box, this.mat("#9aa6b8"), .06, .5, .1, 0, 0, .74); ph.rotation.x = .2;
    // crafted sets: glowing pauldrons (2+), a cape and trim belt (4+), a blazing chest emblem (6)
    this.cape = null;
    if(setN >= 2){
      const pm = this.mat(SL.color, SL.glow), tm = this.mat(SL.trim, SL.glow);
      for(const s of [-1, 1]){ m3part(this.body, G3.box, pm, .34, .2, .44, .42 * s, 1.68, 0); m3part(this.body, G3.box, tm, .36, .05, .46, .42 * s, 1.79, 0); }
      if(setN >= 4){
        m3part(this.body, G3.box, tm, .68, .08, .42, 0, .96, 0);
        this.cape = m3pivot(this.body, 0, 1.62, -.22); m3part(this.cape, G3.box, this.mat(shade(SL.color, .55)), .6, 1.15, .04, 0, -.58, 0); m3part(this.cape, G3.box, tm, .62, .08, .05, 0, -1.14, 0);
      }
      if(setN >= 6){ this.emblem = m3part(this.body, G3.oct, this.mat(SL.trim, SL.glow), .2, .26, .1, 0, 1.36, .21); }
    }
    this.body.add(this.head); this.head.position.set(0, 1.66, 0);
    this.setOpacity(this.opacity, true);
  }
  buildWeapon(b, o){
    const G3 = M3, w = this.wpn, S = o.setWeapon && typeof SETS !== "undefined" ? SETS[o.setWeapon] : null, tier = !!o.tier;
    if(S && o.setWeapon === "dawn"){       // Dawnbreaker: a huge blade of light
      m3part(w, G3.box, this.mat("#5a3a22"), .07, .07, .26, 0, 0, -.05); m3part(w, G3.box, this.mat(S.color, S.glow), .5, .08, .1, 0, 0, .1);
      m3part(w, G3.box, this.mat(S.trim, S.glow), .16, .05, 1.5, 0, 0, .9); m3part(w, G3.oct, this.mat("#ffffff", S.glow), .14, .14, .2, 0, 0, 1.7);
    }else if(S && o.setWeapon === "storm"){ // a bow strung with lightning
      const arc = m3part(w, G3.arc, this.mat(S.color, S.glow), 1.5, 1.5, 1.5); arc.rotation.y = Math.PI / 2;
      m3part(w, G3.box, this.mat("#ffffff", S.glow), .02, 1.5, .02, 0, 0, -.02);
      for(const y of [-.5, 0, .5]) m3part(w, G3.oct, this.mat(S.glow, S.glow), .1, .16, .1, 0, y, .55);
    }else if(S){                            // the void staff: a dark rod crowned with a burning orb
      m3part(w, G3.cyl, this.mat("#2a1a3a"), .08, 1.9, .08, 0, .3, 0);
      m3part(w, G3.ball, this.mat(S.color, S.glow), .34, .34, .34, 0, 1.4, 0);
      this.voidBits = [0, 1, 2].map(() => m3part(w, G3.oct, this.mat(S.trim, S.glow), .09, .12, .09, 0, 1.4, 0));
    }else if(b.weapon === "sword"){
      m3part(w, G3.box, this.mat("#5a3a22"), .07, .07, .22, 0, 0, -.04); m3part(w, G3.box, this.mat(tier ? "#e0a040" : "#c9a55c"), .3, .06, .08, 0, 0, .1);
      m3part(w, G3.box, tier ? this.mat("#ffe2a8", "#ffb347") : this.mat("#cfd6e0"), .09, .035, .95, 0, 0, .6);
    }else if(b.weapon === "staff"){
      m3part(w, G3.cyl, this.mat(tier ? "#e8dcc0" : "#7a5232"), .07, 1.7, .07, 0, .25, 0);
      m3part(w, G3.ico, this.mat(tier ? "#ffffff" : "#c98cff", tier ? "#c98cff" : "#6a3aa8"), .24, .24, .24, 0, 1.15, 0);
    }else if(b.weapon === "bow"){
      const arc = m3part(w, G3.arc, this.mat(tier ? "#c8ffb0" : "#7a5232", tier ? "#8cff9a" : null), 1.3, 1.3, 1.3); arc.rotation.y = Math.PI / 2;
      m3part(w, G3.box, this.mat("#e8e2d4"), .015, 1.3, .015, 0, 0, -.02);
    }else if(b.weapon === "censer"){
      m3part(w, G3.box, this.mat("#8a7a5a"), .03, .5, .03, 0, -.25, 0); m3part(w, G3.ico, this.mat("#c9a55c", "#ff7a2a"), .22, .22, .22, 0, -.56, 0);
    }
  }
  setOpacity(a, force){
    if(a === this.opacity && !force) return; this.opacity = a;
    for(const m of this.mats){ const tr = a < 1; if(m.transparent !== tr){ m.transparent = tr; m.needsUpdate = true; } m.opacity = a; }
    this.headMat.opacity = a;
  }
  // pose: idle | attack | cast | mine0 | mine1 | pick | dead; k: how far through an attack (0..1)
  animate(pose, moving, t, dt, k = 0, jumping = false){
    this.ph = moving ? this.ph + dt * 10 : 0;
    const sw = moving ? Math.sin(this.ph) : 0;
    let lA = sw * .6, rA = -sw * .6, lL = -sw * .65, rL = sw * .65, y = moving ? Math.abs(Math.cos(this.ph)) * .06 : Math.sin(t * 2.5) * .012;
    let lean = moving ? .1 : 0, spread = .08, down = 0, wx = this.bowHand ? 0 : .5;
    if(pose === "attack"){
      if(this.bowHand){ lA = -1.55; rA = -1.45; wx = 0; }
      else if(this.weaponType === "staff" || this.weaponType === "void" || this.weaponType === "censer"){ rA = -1.9 + k * 1.2; }
      else { rA = -2.9 + k * 3; wx = .1; lean = .18; }
    }else if(pose === "cast"){ lA = rA = -2.6; spread = .35; wx = 0; }
    else if(pose === "mine0"){ rA = -2.9; lA = -.6; }
    else if(pose === "mine1"){ rA = -.5; lA = -.4; lean = .25; }
    else if(pose === "pick"){ y = -.34; lL = -1.4; rL = .3; rA = -.5; lean = .55; }
    else if(pose === "dead"){ down = 1; }
    if(jumping){ lL = -.8; rL = -.3; lA = -.9; rA = -.9; }
    const [la, ra] = this.arms, [ll, rl] = this.legs;
    la.rotation.x = ease(la.rotation.x, lA, dt); ra.rotation.x = ease(ra.rotation.x, rA, dt, pose === "attack" ? 40 : 16);
    la.rotation.z = ease(la.rotation.z, -spread, dt); ra.rotation.z = ease(ra.rotation.z, spread, dt);
    ll.rotation.x = ease(ll.rotation.x, lL, dt); rl.rotation.x = ease(rl.rotation.x, rL, dt);
    this.wpn.rotation.x = ease(this.wpn.rotation.x, wx, dt);
    this.pick.visible = pose === "mine0" || pose === "mine1"; if(!this.bowHand) this.wpn.visible = !this.pick.visible;
    this.body.rotation.x = ease(this.body.rotation.x, down ? -Math.PI / 2 : lean, dt, 8);
    this.body.position.y = down ? .18 : y;
    if(this.cape) this.cape.rotation.x = ease(this.cape.rotation.x, (moving ? .5 + sw * .08 : .08) + (jumping ? .4 : 0), dt, 6);
    if(this.emblem) this.emblem.rotation.y = t * 2;
    if(this.voidBits) this.voidBits.forEach((m, i) => { const a = t * 2.4 + i * 2.1; m.position.set(Math.cos(a) * .32, 1.4 + Math.sin(t * 3 + i) * .08, Math.sin(a) * .32); });
  }
  dispose(){ for(const m of this.mats) m.dispose(); this.headMat.dispose(); this.headTex.dispose(); }
}

/* =====================================================================
   CREATURES
   ===================================================================== */
// A four-legged animal. p: body [w,h,l], col, belly, head [w,h,l], headCol, snout [w,h,l], legH, legW, legCol, paw,
// tail [w,h,l,col,lift], ears ("point" | "flop" | "tuft" | "round"), horns ("ram" | "tusk"), eye, stripes, spikes, fluff, mane, teeth
function quadruped(p){
  const G3 = m3geo(), root = new THREE.Group(), body = m3pivot(root, 0, p.legH + p.body[1] / 2, 0), parts = { root, body };
  const [bw, bh, bl] = p.body, col = m3mat(p.col);
  m3part(body, G3.box, col, bw, bh, bl);
  if(p.belly) m3part(body, G3.box, m3mat(p.belly), bw * .8, bh * .3, bl * .8, 0, -bh * .38, 0);
  if(p.stripes) for(let i = 0; i < p.stripes[0]; i++) m3part(body, G3.box, m3mat(p.stripes[1]), bw * 1.02, bh * .5, bl * .06, 0, bh * .3, -bl * .38 + i * bl * .76 / Math.max(1, p.stripes[0] - 1));
  if(p.fluff) for(const [x, y, z] of [[-.3, .35, .25], [.3, .3, -.2], [0, .45, -.05], [-.25, .3, -.35], [.28, .4, .3]]) m3part(body, G3.ico, col, bw * .55, bh * .55, bw * .55, x * bw, y * bh, z * bl);
  if(p.spikes) for(let i = 0; i < p.spikes[0]; i++) m3part(body, G3.cone, m3mat(p.spikes[1]), bw * .18, bh * .4, bw * .18, 0, bh * .6, -bl * .4 + i * bl * .8 / Math.max(1, p.spikes[0] - 1));
  if(p.mane) m3part(body, G3.box, m3mat(p.mane), bw * 1.2, bh * 1.15, bl * .3, 0, bh * .1, bl * .38);
  // head on a neck pivot at the front
  const [hw, hh, hl] = p.head, head = m3pivot(body, 0, p.headY ?? bh * .3, bl / 2); parts.head = head;
  const hc = m3mat(p.headCol || p.col);
  m3part(head, G3.box, hc, hw, hh, hl, 0, 0, hl * .4);
  if(p.snout){ const [sw, sh, sl] = p.snout; m3part(head, G3.box, m3mat(p.snoutCol || p.headCol || p.col), sw, sh, sl, 0, -hh * .18, hl * .85 + sl / 2 - .02); if(p.nose) m3part(head, G3.box, m3mat(p.nose), sw * .5, sh * .35, .04, 0, -hh * .05, hl * .85 + sl); }
  if(p.teeth && p.snout) for(const s of [-1, 1]) for(let i = 0; i < 3; i++) m3part(head, G3.cone, m3mat("#f2ecd8"), .04, .07, .04, s * p.snout[0] * .45, -hh * .18 - p.snout[1] * .55, hl * .9 + i * p.snout[2] * .3).rotation.x = Math.PI;
  parts.eyes = [-1, 1].map(s => m3part(head, G3.box, m3mat(p.eye || "#1b1410"), hw * .16, hh * .16, .04, s * hw * .3, hh * .18, hl * .9));
  if(p.ears === "point" || p.ears === "tuft") for(const s of [-1, 1]){ m3part(head, G3.cone, hc, hw * .26, hh * (p.ears === "tuft" ? .7 : .55), hw * .18, s * hw * .3, hh * .72, hl * .3); if(p.ears === "tuft") m3part(head, G3.box, m3mat("#2a2420"), .03, hh * .3, .03, s * hw * .3, hh * 1.15, hl * .3); }
  if(p.ears === "flop") for(const s of [-1, 1]){ const e = m3part(head, G3.box, hc, hw * .14, hh * .5, hl * .3, s * hw * .58, hh * .05, hl * .35); e.rotation.z = s * .4; }
  if(p.ears === "round") for(const s of [-1, 1]) m3part(head, G3.ico, hc, hw * .3, hh * .3, hw * .15, s * hw * .38, hh * .6, hl * .3);
  if(p.horns === "ram") for(const s of [-1, 1]){ const h = m3part(head, G3.arc, m3mat(p.hornCol || "#d8ccb0"), hh * .7, hh * .7, hh * 1.4, s * hw * .5, hh * .25, hl * .2); h.rotation.set(0, s * Math.PI / 2, -Math.PI / 2); }
  if(p.horns === "tusk") for(const s of [-1, 1]){ const h = m3part(head, G3.cone, m3mat("#f2ead6"), .06, .22, .06, s * p.snout[0] * .55, -hh * .2, hl * .95 + p.snout[2] * .6); h.rotation.x = -.5; }
  if(p.horns === "spike") for(const s of [-1, 1]){ const h = m3part(head, G3.cone, m3mat(p.hornCol || "#e8f6ff"), hw * .16, hh * .9, hw * .16, s * hw * .3, hh * .8, -hl * .05); h.rotation.x = -.6; }
  // legs at the corners
  const lx = bw / 2 - p.legW / 2 + (p.splay || 0), lz = bl / 2 - p.legW * .8, lc = m3mat(p.legCol || p.col), pc = m3mat(p.paw || p.legCol || p.col);
  parts.legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => {
    const lp = m3pivot(root, sx * lx, p.legH, sz * lz);
    m3part(lp, G3.box, lc, p.legW, p.legH, p.legW * 1.1, 0, -p.legH / 2, 0); m3part(lp, G3.box, pc, p.legW * 1.15, p.legH * .2, p.legW * 1.4, 0, -p.legH * .9, p.legW * .15);
    return lp;
  });
  if(p.tail){ const [tw, th, tl, tc, lift = .3] = p.tail, tp = m3pivot(body, 0, bh * .2, -bl / 2); m3part(tp, G3.box, m3mat(tc || p.col), tw, th, tl, 0, 0, -tl / 2); if(p.tail2) m3part(tp, G3.box, m3mat(tc || p.col), tw * .6, th * .6, tl * .7, 0, 0, -tl * 1.2); tp.rotation.x = -lift; parts.tail = tp; parts.tailLift = lift; }
  return parts;
}
// a great ape (also the Yeti): a heavy chest, long arms to the ground, short legs
function apeBody(pal){
  const G3 = m3geo(), root = new THREE.Group(), body = m3pivot(root, 0, .55, 0), parts = { root, body, ape: true };
  const c = m3mat(pal.body), d = m3mat(pal.dark), back = m3mat(pal.back), face = m3mat(pal.face);
  const chest = m3part(body, G3.box, c, 1, .9, .7, 0, .5, .05); chest.rotation.x = .35;
  m3part(body, G3.box, back, .9, .4, .6, 0, .85, -.12).rotation.x = .35;
  const head = m3pivot(body, 0, 1.02, .38); parts.head = head;
  m3part(head, G3.box, c, .48, .44, .42, 0, 0, .1); m3part(head, G3.box, face, .36, .26, .12, 0, -.05, .32); m3part(head, G3.box, d, .5, .1, .14, 0, .14, .3);
  parts.eyes = [-1, 1].map(s => m3part(head, G3.box, m3mat(pal.eye || "#1b1410"), .07, .06, .04, s * .1, .04, .39));
  if(pal.horns) for(const s of [-1, 1]){ const h = m3part(head, G3.cone, m3mat(pal.horns), .1, .3, .1, s * .22, .3, 0); h.rotation.z = -s * .4; }
  parts.arms = [-1, 1].map(s => { const p = m3pivot(body, s * .6, .8, .15); m3part(p, G3.box, c, .3, 1.1, .32, 0, -.5, 0); m3part(p, G3.box, d, .32, .18, .36, 0, -1.08, .04); return p; });
  parts.legs = [-1, 1].map(s => { const p = m3pivot(root, s * .28, .55, -.15); m3part(p, G3.box, c, .3, .55, .32, 0, -.27, 0); m3part(p, G3.box, d, .32, .1, .4, 0, -.52, .05); return p; });
  return parts;
}
function frogBody(){
  const G3 = m3geo(), root = new THREE.Group(), body = m3pivot(root, 0, .3, 0), parts = { root, body, hop: true };
  const g = m3mat("#4fae4a"), d = m3mat("#2f7a3a");
  m3part(body, G3.ball, g, .9, .55, 1); m3part(body, G3.box, m3mat("#c8e86a"), .6, .12, .7, 0, -.2, .1);
  for(const [x, z] of [[-.25, -.15], [.2, .2], [.1, -.3]]) m3part(body, G3.ico, d, .16, .08, .16, x, .25, z);
  parts.eyes = [-1, 1].map(s => { m3part(body, G3.ball, g, .26, .26, .26, s * .26, .28, .32); return m3part(body, G3.box, m3mat("#1b1410"), .1, .1, .04, s * .28, .3, .45); });
  parts.legs = [-1, 1].map(s => { const p = m3pivot(root, s * .42, .28, -.25); m3part(p, G3.box, d, .22, .2, .5, 0, -.1, .05); m3part(p, G3.box, d, .24, .06, .3, 0, -.24, .25); return p; })
    .concat([-1, 1].map(s => { const p = m3pivot(root, s * .3, .25, .3); m3part(p, G3.box, d, .1, .25, .1, 0, -.12, 0); return p; }));
  parts.head = m3pivot(body);
  return parts;
}
function serpentBody(){
  const G3 = m3geo(), root = new THREE.Group(), parts = { root, body: m3pivot(root), seg: [] };
  const c = m3mat("#4a7a32"), d = m3mat("#3a6a2a"), y = m3mat("#a8c84a");
  for(let i = 0; i < 8; i++){ const s = .38 - i * .03, m = m3pivot(parts.body, 0, s / 2, -i * .3); m3part(m, G3.box, i % 2 ? d : c, s, s, .34); m3part(m, G3.box, y, s * .8, .05, .3, 0, -s / 2, 0); parts.seg.push(m); }
  const head = m3pivot(parts.body, 0, .62, .25); parts.head = head;
  m3part(parts.body, G3.box, c, .3, .5, .3, 0, .35, .05).rotation.x = -.4;   // the raised neck
  m3part(head, G3.box, c, .4, .22, .46, 0, 0, .12); m3part(head, G3.box, d, .5, .08, .3, 0, .1, 0);
  for(const s of [-1, 1]) m3part(head, G3.cone, m3mat("#f2ecd8"), .04, .12, .04, s * .1, -.14, .3).rotation.x = Math.PI;
  parts.eyes = [-1, 1].map(s => m3part(head, G3.box, m3mat("#ffd84a"), .07, .06, .04, s * .14, .06, .32));
  return parts;
}
function spiderBody(){
  const G3 = m3geo(), root = new THREE.Group(), body = m3pivot(root, 0, .55, 0), parts = { root, body, legs: [] };
  const c = m3mat("#3a2a3a"), d = m3mat("#4a3448"), mark = m3mat("#c8a030");
  m3part(body, G3.ball, c, .7, .5, .7, 0, 0, .3); const ab = m3part(body, G3.ball, d, 1.1, .9, 1.2, 0, .2, -.55); ab.rotation.x = .2;
  for(const [x, z] of [[0, -.3], [-.2, -.6], [.2, -.6], [0, -.85]]) m3part(body, G3.ico, mark, .16, .06, .16, x, .63, z);
  const head = m3pivot(body, 0, 0, .62); parts.head = head;
  for(const s of [-1, 1]) m3part(head, G3.cone, m3mat("#6a8a2a"), .08, .24, .08, s * .1, -.15, .06).rotation.x = Math.PI - .4;
  parts.eyes = [[-.12, .08], [.12, .08], [-.06, .14], [.06, .14]].map(([x, y]) => m3part(head, G3.box, m3mat("#8aff6a", "#4aff3a"), .07, .07, .04, x, y, .02));
  for(const s of [-1, 1]) for(let i = 0; i < 4; i++){
    const p = m3pivot(body, s * .3, 0, .5 - i * .2); p.rotation.y = s * (.4 - i * .35) + (s < 0 ? Math.PI : 0);
    const upper = m3pivot(p); upper.rotation.z = .7; m3part(upper, G3.box, c, .7, .08, .08, .35, 0, 0);
    const lower = m3pivot(upper, .7, 0, 0); lower.rotation.z = -1.9; m3part(lower, G3.box, d, .8, .07, .07, .4, 0, 0);
    parts.legs.push(p);
  }
  parts.spider = true;
  return parts;
}
function wispBody(){
  const G3 = m3geo(), root = new THREE.Group(), body = m3pivot(root, 0, .9, 0), parts = { root, body, float: true, trail: [] };
  m3part(body, G3.ico, m3mat("#bfefff", "#7fd3ff"), .5, .5, .5); m3part(body, G3.ico, m3mat("#eaffff", "#ffffff"), .24, .24, .24);
  if(typeof glowMat !== "undefined" && glowMat){ const g = new THREE.Sprite(glowMat); g.scale.set(1.6, 1.6, 1); body.add(g); }
  for(let i = 0; i < 4; i++) parts.trail.push(m3part(body, G3.oct, m3mat("#3a7ab0", "#2a5aa0"), .14 - i * .02, .14 - i * .02, .14 - i * .02, 0, 0, -.3 - i * .2));
  parts.eyes = [-1, 1].map(s => m3part(body, G3.box, m3mat("#2a5aa0"), .06, .08, .02, s * .08, .04, .26));
  parts.head = m3pivot(body);
  return parts;
}
function craglingBody(){
  const G3 = m3geo(), root = new THREE.Group(), body = m3pivot(root, 0, .4, 0), parts = { root, body };
  const r = m3mat("#6e6a62"), d = m3mat("#4a4640");
  m3part(body, G3.dod, r, .95, .75, .85, 0, .3, 0); m3part(body, G3.dod, m3mat("#8a857c"), .5, .3, .5, -.1, .62, .1);
  const cr = m3part(body, G3.cone, m3mat("#7fd3ff", "#4ab0ff"), .2, .55, .2, 0, .85, -.15); cr.rotation.x = -.3;
  const head = m3pivot(body, 0, .35, .35); parts.head = head;
  parts.eyes = [-1, 1].map(s => m3part(head, G3.box, m3mat("#9fe6ff", "#6fd0ff"), .1, .07, .04, s * .14, .05, .08));
  parts.arms = [-1, 1].map(s => { const p = m3pivot(body, s * .5, .3, .1); m3part(p, G3.box, d, .18, .32, .18, 0, -.16, 0); return p; });
  parts.legs = [-1, 1].map(s => { const p = m3pivot(root, s * .22, .4, 0); m3part(p, G3.box, d, .2, .4, .22, 0, -.2, 0); return p; });
  return parts;
}
function dragonBody(pal){
  const G3 = m3geo(), root = new THREE.Group(), parts = quadruped({ body: [.9, .7, 1.6], col: pal.body, belly: pal.belly, head: [.42, .36, .5], headY: .55, snout: [.3, .2, .4], legH: .55, legW: .2,
    legCol: pal.dark, paw: pal.dark, tail: [.32, .26, 1, pal.body, .1], tail2: true, horns: "spike", hornCol: pal.belly, eye: "#1b1410", teeth: true, spikes: [5, pal.dark] });
  // a long neck between the body and the head
  const neck = m3part(parts.body, G3.box, m3mat(pal.body), .34, .34, .6, 0, .45, .85); neck.rotation.x = -.6;
  parts.head.position.set(0, .8, 1.1);
  parts.wings = [-1, 1].map(s => { const w = m3pivot(parts.body, s * .4, .35, .1); const m = new THREE.Mesh(M3.wing, m3mat(pal.wing)); m.scale.set(s * 1.5, 1, 1.2); w.add(m);
    m3part(w, M3.box, m3mat(pal.dark), 1.5, .07, .07, s * .75, 0, .2); return w; });   // the wing's leading bone
  return parts;
}
function humanoidMob(kind, A){
  const art = new CharArt({ style: A.style, drawHead: A.head, tier: A.tier });
  const h = new Humanoid3D(art, { mob: true }); return { root: h.root, humanoid: h };
}
const CREATURE_BUILD = {
  sheep: () => quadruped({ body: [.62, .5, .8], col: "#f4f1ea", fluff: true, head: [.28, .28, .3], headCol: "#2b2420", headY: .2, legH: .3, legW: .1, legCol: "#2b2420", tail: [.14, .14, .12, "#f4f1ea"], ears: "flop", eye: "#ffffff" }),
  boar: () => quadruped({ body: [.7, .6, 1.1], col: "#7a5a46", belly: "#4a3222", head: [.46, .44, .4], headCol: "#4a3222", headY: .05, snout: [.24, .2, .22], snoutCol: "#7a5a46", nose: "#2a1c14", horns: "tusk", legH: .3, legW: .13, legCol: "#2a1c14", tail: [.05, .05, .2, "#2a1c14", .6], ears: "point", spikes: [5, "#2a1c14"], eye: "#e8c040" }),
  wolf: () => quadruped({ body: [.42, .42, 1], col: "#6e6a64", belly: "#56524e", head: [.32, .3, .32], headY: .22, snout: [.16, .14, .24], nose: "#1b1410", legH: .45, legW: .1, legCol: "#56524e", tail: [.12, .12, .55, "#56524e", .4], ears: "point", eye: "#e8d040" }),
  ram: () => quadruped({ body: [.6, .55, .9], col: "#d8ccb0", fluff: true, head: [.3, .32, .34], headCol: "#a8987e", headY: .22, snout: [.18, .16, .14], legH: .42, legW: .1, legCol: "#6e6050", horns: "ram", hornCol: "#e8c040", tail: [.1, .1, .12], eye: "#1b1410" }),
  lynx: () => quadruped({ body: [.42, .42, .9], col: "#d8d4ca", belly: "#f2efe8", stripes: [3, "#c8c4ba"], head: [.34, .3, .28], headY: .22, snout: [.16, .12, .1], nose: "#c08080", legH: .42, legW: .12, legCol: "#c8c4ba", tail: [.1, .1, .22, "#2a2420", .6], ears: "tuft", eye: "#e8d040" }),
  prowler: () => quadruped({ body: [.46, .44, 1.15], col: PROWLER_PAL.body, belly: PROWLER_PAL.belly, stripes: [5, PROWLER_PAL.stripe], head: [.38, .34, .32], headY: .22, snout: [.2, .14, .12], nose: "#3a2418", legH: .42, legW: .13, legCol: PROWLER_PAL.dark, tail: [.1, .1, .8, PROWLER_PAL.body, .2], ears: "round", eye: PROWLER_PAL.eye }),
  shadowmane: () => quadruped({ body: [.5, .48, 1.2], col: SHADOW_PAL.body, belly: SHADOW_PAL.belly, stripes: [4, SHADOW_PAL.stripe], mane: SHADOW_PAL.dark, head: [.42, .38, .34], headY: .25, snout: [.22, .16, .14], nose: "#000000", legH: .45, legW: .14, legCol: SHADOW_PAL.dark, tail: [.12, .12, .9, SHADOW_PAL.body, .2], ears: "round", eye: SHADOW_PAL.eye, glowEyes: true }),
  croc: () => quadruped({ body: [.55, .26, 1.2], col: "#5a7a3a", belly: "#c8c08a", spikes: [6, "#3a5426"], head: [.34, .2, .3], headY: .02, snout: [.26, .14, .55], legH: .16, legW: .12, splay: .08, legCol: "#3a5426", tail: [.3, .2, .9, "#5a7a3a", 0], tail2: true, teeth: true, eye: "#e8d040" }),
  mawgrot: () => quadruped({ body: [.6, .3, 1.25], col: "#4a5a2a", belly: "#c8c08a", spikes: [8, "#2e3a1a"], head: [.4, .24, .32], headY: .04, snout: [.32, .16, .6], legH: .18, legW: .14, splay: .1, legCol: "#2e3a1a", tail: [.34, .22, 1, "#4a5a2a", 0], tail2: true, teeth: true, eye: "#ff6030", glowEyes: true }),
  ape: () => apeBody(APE_PAL),
  greyback: () => apeBody(GREY_PAL),
  yeti: () => apeBody({ body: "#e8ecf2", dark: "#c8ccd4", back: "#f6f8fc", face: "#8aa6c8", horns: "#dde2ea" }),
  frog: frogBody, serpent: serpentBody, sizzra: spiderBody, wisp: wispBody, cragling: craglingBody,
  whelp: () => dragonBody({ body: "#7fa6c8", belly: "#dfeefa", dark: "#4f6f8f", wing: "#9fc0dc" }),
  dragon: () => dragonBody({ body: "#6a92b8", belly: "#dfeefa", dark: "#3f5f80", wing: "#8fb2d2" }),
};

class Creature3D {
  constructor(kind){
    m3geo(); const A = MOB_ART[kind] || MOB_ART.sheep; this.kind = kind; this.A = A;
    this.root = new THREE.Group(); this.ph = Math.random() * 6;
    const P = A.char ? humanoidMob(kind, A) : (CREATURE_BUILD[kind] || CREATURE_BUILD.sheep)();
    this.P = P; this.inner = m3pivot(this.root); this.inner.add(P.root);
    // fit the model into the creature's old sprite box: its length along z, its height along y
    const box = new THREE.Box3().setFromObject(P.root), size = box.getSize(new THREE.Vector3());
    const len = Math.max(size.z, size.x * .6), s = A.char ? A.sy / 2.55 : Math.min(A.sx * .95 / Math.max(.1, len), A.sy * .9 / Math.max(.1, size.y));
    this.inner.scale.setScalar(s);
    this.eyeMat = P.eyes && P.eyes[0] ? P.eyes[0].material : null;
    this.angryMat = m3mat("#ff4030", "#ff2010");
  }
  // moving, angry, charging, windup, lunge (0..1 of a bite or swing)
  animate(st, t, dt){
    const P = this.P;
    if(P.humanoid){ P.humanoid.animate(st.dead ? "dead" : st.lunge > 0 ? "attack" : "idle", st.moving, t, dt, 1 - st.lunge); return; }
    const speed = st.charging ? 18 : st.angry ? 13 : 8;
    if(st.moving) this.ph += dt * speed;
    const sw = st.moving ? Math.sin(this.ph) : 0;
    if(P.legs){
      if(P.spider) P.legs.forEach((l, i) => { l.rotation.x = Math.sin(this.ph + i * 1.3) * (st.moving ? .25 : .03); });
      else if(P.hop){ const k = st.moving ? Math.max(0, Math.sin(this.ph * .6)) : 0; P.body.position.y = .3 + k * .35; P.legs.forEach((l, i) => { l.rotation.x = i < 2 ? -k * .9 : k * .4; }); }
      else if(P.ape){ P.legs[0].rotation.x = sw * .5; P.legs[1].rotation.x = -sw * .5; }
      else P.legs.forEach((l, i) => { l.rotation.x = (i === 0 || i === 3 ? sw : -sw) * .6; });
    }
    if(P.arms) P.arms.forEach((a, i) => { a.rotation.x = (i ? -sw : sw) * .5 - (st.lunge > 0 ? Math.sin(st.lunge * Math.PI) * 1.6 : 0) - (st.windup ? 1.2 : 0); });
    if(P.tail) P.tail.rotation.y = Math.sin(t * (st.angry ? 9 : 3) + this.ph) * .25;
    if(P.wings) P.wings.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * (Math.sin(t * (st.moving || st.windup ? 7 : 1.5)) * (st.moving || st.windup ? .5 : .1) + .45); });
    if(P.seg){ P.seg.forEach((s, i) => { s.position.x = Math.sin(t * (st.moving ? 8 : 2) - i * .9) * (.06 + i * .02); }); }
    if(P.float){ P.body.position.y = .9 + Math.sin(t * 2.2 + this.ph) * .12; P.body.rotation.y = t * .8; P.trail.forEach((m, i) => { m.position.x = Math.sin(t * 3 - i) * .08; }); }
    if(P.head){ const bite = st.lunge > 0 ? Math.sin(st.lunge * Math.PI) : 0; P.head.rotation.x = (st.moving ? Math.sin(this.ph * 2) * .05 : Math.sin(t * 1.3) * .04) + bite * .35; }
    P.body.rotation.z = st.windup ? Math.sin(t * 40) * .04 : 0;
    if(P.body && !P.hop && !P.float && !P.ape && P.body.userData.y0 === undefined) P.body.userData.y0 = P.body.position.y;
    if(P.body.userData.y0 !== undefined) P.body.position.y = P.body.userData.y0 + (st.moving ? Math.abs(Math.cos(this.ph)) * .03 : Math.sin(t * 2) * .01);
    if(this.eyeMat && P.eyes){ const m = st.angry ? this.angryMat : this.eyeMat; if(P.eyes[0].material !== m) P.eyes.forEach(e => { e.material = m; }); }
  }
  dispose(){ if(this.P.humanoid) this.P.humanoid.dispose(); }
}
