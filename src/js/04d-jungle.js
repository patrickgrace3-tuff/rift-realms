"use strict";
// The Thornveil Jungle: terrain (a winding river and the Sunken Delta), trees, ferns and palms, Canopy Camp,
// the waystones, Sizzra's Broodhollow, the Moonlit Ruins, the Overgrown Gate, the two portals behind the
// cathedral's altar, the map picture, and the warm green fog while you're there.

let JUNG = null;
const JUNGLE_PATHS = [
  [[CANOPY.x, CANOPY.y], [FERNREACH.x - 300, FERNREACH.y + 300], [FERNREACH.x + 600, FERNREACH.y + 500], [ZS + 3900, DZ + 3500]],
  [[CANOPY.x, CANOPY.y], [ZS + 1300, DZ + 3500], [HOWLER.x, HOWLER.y - 500]],
  [[ZS + 3900, DZ + 3500], [ZS + 4400, DZ + 4700], [BROODHOLLOW.x, BROODHOLLOW.y - 400]],
  [[ZS + 3900, DZ + 3500], [THICKET.x - 600, THICKET.y - 200], [RUINS.x - 300, RUINS.y - 600]],
  [[FERNREACH.x + 600, FERNREACH.y + 500], [DELTA.x - 900, DELTA.y + 300]],
  [[BROODHOLLOW.x, BROODHOLLOW.y + 300], [OLD_GATE.x, OLD_GATE.y - 300]],
];

function buildJungle(g){
  const outside = ZH, grp = new THREE.Group(); g.add(grp);
  let seed = 31; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const segD = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))); return Math.hypot(px - ax - t * dx, py - ay - t * dy); };
  const polyD = (px, py, pl) => { let m = 1e9; for(let i = 0; i < pl.length - 1; i++) m = Math.min(m, segD(px, py, pl[i][0], pl[i][1], pl[i + 1][0], pl[i + 1][1])); return m; };
  const noise = (x, y) => Math.sin(x * .0011 + 2.1) * Math.cos(y * .0013 + .4) + .5 * Math.sin(x * .0031 - y * .0027 + 1.3) + .25 * Math.sin(x * .0071 + y * .0063);
  const D = (x, y, p) => Math.hypot(x - p.x, y - p.y);
  const fields = (x, y) => {
    const lx = x - JX, ly = y - JY, dRiv = polyD(x, y, RIVER); let dP = 1e9; for(const p of JUNGLE_PATHS) dP = Math.min(dP, polyD(x, y, p));
    return { dRiv, river: 1 - ss(110, 300, dRiv), bank: 1 - ss(250, 520, dRiv), delta: 1 - ss(DELTA.r * .8, DELTA.r + 160, D(x, y, DELTA)), shore: 1 - ss(DELTA.r, DELTA.r + 420, D(x, y, DELTA)),
      camp: 1 - ss(CANOPY.r, CANOPY.r + 250, D(x, y, CANOPY)), path: 1 - ss(90, 200, dP), ruins: 1 - ss(RUINS.r * .7, RUINS.r + 120, D(x, y, RUINS)), brood: 1 - ss(BROODHOLLOW.r, BROODHOLLOW.r + 200, D(x, y, BROODHOLLOW)),
      clear: Math.max(1 - ss(FERNREACH.r * .6, FERNREACH.r, D(x, y, FERNREACH)), 1 - ss(THICKET.r * .5, THICKET.r, D(x, y, THICKET)), 1 - ss(HOWLER.r * .6, HOWLER.r, D(x, y, HOWLER))),
      edge: 1 - ss(300, 1100, Math.min(lx, ZS - lx, ZS - ly)), south: 1 - ss(150, 600, ly) };   // the south edge stays low: the camera looks from there
  };
  const height = (x, y, f) => {
    let h = noise(x, y) * 1.5 + .4 * noise(x * 2.2 + 500, y * 2 - 300) + .6;
    const flat = Math.max(f.camp, f.path * .7, f.ruins * .85, f.brood * .8, f.clear * .5, f.shore * .8);
    h = h * (1 - flat) + .35 * flat;
    h -= f.river * 1.7 + f.delta * 1.5;
    h += Math.pow(f.edge, 1.5) * 15 * (.8 + .4 * noise(x * 2.6, y * 2.6)) + f.south * 4;
    return h;
  };
  const jh = (x, y) => height(x, y, fields(x, y));
  ZH = (x, y) => inJungle(x, y) ? jh(x, y) : outside(x, y);
  const place = (m, x, y, lift = 0) => { const w = XF(x, y); m.position.set(w.x, jh(x, y) + lift, w.z); grp.add(m); return m; };
  const c = new THREE.Color(), t2 = new THREE.Color();
  const colorAt = (x, y, f, h, out) => {
    const n = noise(x * 3.3, y * 3.1);
    out.setHSL(.3 + .03 * n, .55, .22 + .04 * n);                                   // deep jungle floor
    t2.setHSL(.27, .5, .3 + .03 * n); out.lerp(t2, f.clear * .6);
    t2.setHSL(.09, .4, .28 + .03 * n); out.lerp(t2, Math.max(f.bank * .7, f.shore * .7));   // mud by the water
    t2.setHSL(.08, .35, .42 + .03 * n); out.lerp(t2, Math.max(f.path * .9, f.camp * .6));
    t2.setHSL(.1, .08, .48 + .04 * n); out.lerp(t2, f.ruins * .55);                 // old flagstones
    t2.setHSL(.75, .08, .3); out.lerp(t2, f.brood * .5);
    t2.setHSL(.25, .25, .34 + .05 * n); out.lerp(t2, ss(3, 7, h) * f.edge);           // mossy cliffs
    return out;
  };
  // ground
  const geo = new THREE.PlaneGeometry(ZONE_W, ZONE_W, 200, 200); geo.rotateX(-Math.PI / 2);
  const ctr = XF(JX + ZS / 2, JY + ZS / 2); geo.translate(ctr.x, 0, ctr.z);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  for(let i = 0; i < pos.count; i++){
    const [x, y] = XF.inv(pos.getX(i), pos.getZ(i)), f = fields(x, y), h = height(x, y, f);
    pos.setY(i, h); colorAt(x, y, f, h, c).convertSRGBToLinear(); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  grp.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })));
  // water: one sheet; it shows wherever the river and the delta dip below it
  const water = new THREE.Mesh(new THREE.PlaneGeometry(ZONE_W, ZONE_W), new THREE.MeshStandardMaterial({ color: 0x3f7a6a, roughness: .25, metalness: .1, transparent: true, opacity: .82 }));
  water.rotation.x = -Math.PI / 2; water.position.set(ctr.x, -.55, ctr.z); grp.add(water);
  // trees, palms and ferns (instanced), kept off the water, paths, camp and fighting grounds
  const free = (x, y, pad = 0) => { const f = fields(x, y); return f.river < .05 && f.delta < .05 && f.path < .2 && f.camp < .1 && f.ruins < .2 && f.brood < .2 && f.edge < .9 && f.south < .5 && f.clear < .7 - pad && !KAPOKS.some(k => D(x, y, k) < 350) && D(x, y, WAYSTONES.jungle) > 300 && D(x, y, OLD_GATE) > 600; };
  const pick = (n, pad) => { const out = []; for(let k = 0; k < n * 6 && out.length < n; k++){ const x = JX + 500 + rnd() * (ZS - 1000), y = JY + 500 + rnd() * (ZS - 1000); if(free(x, y, pad)) out.push([x, y]); } return out; };
  const inst = (geom, mat, list, setup) => { const im = new THREE.InstancedMesh(geom, mat, list.length), d = new THREE.Object3D(); list.forEach((p, i) => { setup(d, p, i); d.updateMatrix(); im.setMatrixAt(i, d.matrix); }); grp.add(im); return im; };
  const trees = pick(430, 0), palms = pick(160, .2), ferns = pick(1100, .45);
  const at = (d, [x, y], lift) => { const w = XF(x, y); d.position.set(w.x, jh(x, y) + lift, w.z); };
  const sizes = trees.map(() => .75 + rnd() * .5);
  // tree tops that stand between the camera and you fade away (see updateJungle), so keep their matrices
  const tops = [];
  const fadeable = (im, list) => { const mats = []; for(let i = 0; i < list.length; i++){ const m4 = new THREE.Matrix4(); im.getMatrixAt(i, m4); mats.push(m4); } tops.push({ im, list, mats }); };
  inst(new THREE.CylinderGeometry(.22, .35, 3.4, 6), new THREE.MeshLambertMaterial({ color: 0x5a3e2a }), trees, (d, p, i) => { at(d, p, 1.7 * sizes[i]); d.scale.setScalar(sizes[i]); d.rotation.set(0, 0, 0); });
  fadeable(inst(new THREE.IcosahedronGeometry(1.7, 0), new THREE.MeshLambertMaterial({ color: 0x2f6a2a, flatShading: true }), trees, (d, p, i) => { at(d, p, 3.7 * sizes[i]); d.scale.set(sizes[i] * 1.2, sizes[i] * .75, sizes[i] * 1.2); d.rotation.set(rnd(), rnd() * 3, 0); }), trees);
  fadeable(inst(new THREE.IcosahedronGeometry(1.1, 0), new THREE.MeshLambertMaterial({ color: 0x3f8a32, flatShading: true }), trees, (d, p, i) => { at(d, [p[0] + 40, p[1] - 30], 4.7 * sizes[i]); d.scale.setScalar(sizes[i]); d.rotation.set(rnd(), rnd() * 3, 0); }), trees);
  inst(new THREE.CylinderGeometry(.12, .2, 3.8, 5), new THREE.MeshLambertMaterial({ color: 0x8a6a4a }), palms, (d, p) => { at(d, p, 1.9); d.scale.setScalar(1); d.rotation.set((rnd() - .5) * .25, 0, (rnd() - .5) * .25); });
  for(let leaf = 0; leaf < 5; leaf++) fadeable(inst(new THREE.ConeGeometry(.35, 2.4, 4), new THREE.MeshLambertMaterial({ color: leaf % 2 ? 0x4f9a3a : 0x3a8030, flatShading: true }), palms, (d, p) => { at(d, p, 3.8); d.scale.set(1, 1, .4); d.rotation.set(Math.PI / 2 - .5, leaf / 5 * Math.PI * 2, 0, "YXZ"); }), palms);
  inst(new THREE.ConeGeometry(.5, .9, 5), new THREE.MeshLambertMaterial({ color: 0x4a9a3a, flatShading: true }), ferns, (d, p) => { at(d, p, .35); d.scale.set(1 + rnd(), .7 + rnd() * .6, 1 + rnd()); d.rotation.set(0, rnd() * 3, 0); });
  // the great kapok trees (solid)
  const barkM = new THREE.MeshLambertMaterial({ color: 0x6a5240 }), crownM = new THREE.MeshLambertMaterial({ color: 0x2a5a24, flatShading: true });
  for(const k of KAPOKS){
    const tr = new THREE.Group(), trunk = new THREE.Mesh(new THREE.CylinderGeometry(k.r * ZSC * .7, k.r * ZSC, 9, 8), barkM); trunk.position.y = 4.5;
    for(let r = 0; r < 5; r++){ const root = new THREE.Mesh(new THREE.BoxGeometry(.4, 1.6, 2.2), barkM); root.rotation.y = r / 5 * Math.PI * 2; root.position.set(Math.cos(r / 5 * Math.PI * 2) * 1.6, .7, -Math.sin(r / 5 * Math.PI * 2) * 1.6); tr.add(root); }
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(4.8, 0), crownM); crown.scale.set(1.3, .55, 1.3); crown.position.y = 9.6;
    tr.add(trunk, crown); place(tr, k.x, k.y);
  }
  // the delta: reeds and lily pads
  const reedM = new THREE.MeshLambertMaterial({ color: 0x8a9a4a }), padM = new THREE.MeshLambertMaterial({ color: 0x4a8a3a });
  for(let k = 0; k < 90; k++){ const a = rnd() * 6.28, rr = DELTA.r * (.85 + rnd() * .35), reed = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, 1.4 + rnd(), 4), reedM); place(reed, DELTA.x + Math.cos(a) * rr, DELTA.y + Math.sin(a) * rr, .6); }
  for(let k = 0; k < 40; k++){ const a = rnd() * 6.28, rr = rnd() * DELTA.r * .8, pad = new THREE.Mesh(new THREE.CircleGeometry(.35 + rnd() * .3, 8), padM); pad.rotation.x = -Math.PI / 2; const w = XF(DELTA.x + Math.cos(a) * rr, DELTA.y + Math.sin(a) * rr); pad.position.set(w.x, -.52, w.z); grp.add(pad); }
  // Canopy Camp: tents, crates, Bao's stall, a fire, a map table
  const tentM = hex => new THREE.MeshStandardMaterial({ color: hex, flatShading: true, roughness: .9 });
  for(const [dx, dy, hex, rot] of [[-420, -150, 0x6a8a4a, .3], [-300, 330, 0xa8885a, -.4], [380, -380, 0x5a7a8a, .8]]){ const tent = new THREE.Mesh(new THREE.ConeGeometry(2, 2.6, 6), tentM(hex)); tent.rotation.y = rot; place(tent, CANOPY.x + dx, CANOPY.y + dy, 1.3); }
  const crateM = new THREE.MeshLambertMaterial({ color: 0x8a6a40 });
  for(let k = 0; k < 4; k++){ const cr = new THREE.Mesh(new THREE.BoxGeometry(.8, .8, .8), crateM); place(cr, JUNGLE_STALL.x - 120 + k * 80, JUNGLE_STALL.y + (k % 2) * 60, .4); }
  { const awn = new THREE.Mesh(new THREE.BoxGeometry(3.2, .1, 2), new THREE.MeshLambertMaterial({ color: 0xc8a050 })); place(awn, JUNGLE_STALL.x, JUNGLE_STALL.y, 2.4);
    for(const sx of [-1, 1]) for(const sy of [-1, 1]){ const post = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 2.4, 5), crateM); place(post, JUNGLE_STALL.x + sx * 105, JUNGLE_STALL.y + sy * 65, 1.2); } }
  { const fg = new THREE.Group(); for(const [sc, hex] of [[1, 0xff7a20], [.6, 0xffd040]]){ const fl = new THREE.Mesh(new THREE.ConeGeometry(.3 * sc, .95 * sc, 7), new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: .9 })); fl.position.y = .5 * sc + .1; fg.add(fl); fireFlames.push(fl); }
    const li = new THREE.PointLight(0xffa040, 1.1, 14, 1.6); li.position.y = 1.2; fg.add(li); place(fg, ...JUNGLE_FIRE); }
  { const table = new THREE.Mesh(new THREE.BoxGeometry(1.6, .1, 1), crateM), map = new THREE.Mesh(new THREE.PlaneGeometry(1.4, .8), new THREE.MeshLambertMaterial({ color: 0xe8dcb0 })); place(table, CANOPY.x - 330, CANOPY.y + 120, .8); map.rotation.x = -Math.PI / 2; place(map, CANOPY.x - 330, CANOPY.y + 120, .86); }
  // Howler Heights: boulders
  for(let k = 0; k < 14; k++){ const a = rnd() * 6.28, rr = HOWLER.r * (.6 + rnd() * .6), b = new THREE.Mesh(new THREE.IcosahedronGeometry(.9, 0), new THREE.MeshStandardMaterial({ color: 0x6a6a5a, flatShading: true })); const sc = 1 + rnd() * 1.5; b.scale.set(sc, sc * .8, sc); place(b, HOWLER.x + Math.cos(a) * rr, HOWLER.y + Math.sin(a) * rr, .3); }
  // the Broodhollow: webs and egg sacs
  const webM = new THREE.MeshBasicMaterial({ color: 0xf0f0f0, transparent: true, opacity: .35, side: THREE.DoubleSide, depthWrite: false });
  for(let k = 0; k < 10; k++){ const a = k / 10 * Math.PI * 2, web = new THREE.Mesh(new THREE.CircleGeometry(1.8 + rnd(), 7), webM); web.rotation.y = a; place(web, BROODHOLLOW.x + Math.cos(a) * (BROODHOLLOW.r + 60), BROODHOLLOW.y + Math.sin(a) * (BROODHOLLOW.r + 60), 2); }
  const eggM = new THREE.MeshLambertMaterial({ color: 0xe8e2d0 });
  for(let k = 0; k < 12; k++){ const a = rnd() * 6.28, rr = BROODHOLLOW.r * (.4 + rnd() * .5), e = new THREE.Mesh(new THREE.SphereGeometry(.35, 6, 5), eggM); e.scale.y = 1.3; place(e, BROODHOLLOW.x + Math.cos(a) * rr, BROODHOLLOW.y + Math.sin(a) * rr, .35); }
  // the Moonlit Ruins: broken pillars, steps, and a great cat statue
  const ruinM = new THREE.MeshStandardMaterial({ color: 0x9a988a, flatShading: true }), mossM = new THREE.MeshLambertMaterial({ color: 0x4a7a3a });
  for(let k = 0; k < 12; k++){ const a = k / 12 * Math.PI * 2, rr = RUINS.r + 40, hgt = 1.5 + rnd() * 4.5, p = new THREE.Mesh(new THREE.CylinderGeometry(.6, .7, hgt, 8), ruinM); place(p, RUINS.x + Math.cos(a) * rr, RUINS.y + Math.sin(a) * rr, hgt / 2); if(rnd() < .6){ const moss = new THREE.Mesh(new THREE.CylinderGeometry(.65, .65, .3, 8), mossM); place(moss, RUINS.x + Math.cos(a) * rr, RUINS.y + Math.sin(a) * rr, hgt); } }
  { const st = new THREE.Group(), base = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 3), ruinM), head = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 0), ruinM); base.position.y = .5; head.position.y = 2.4; head.scale.set(1.2, 1, 1);
    for(const sx of [-.8, .8]){ const ear = new THREE.Mesh(new THREE.ConeGeometry(.45, 1.1, 4), ruinM); ear.position.set(sx, 3.8, 0); st.add(ear); }
    const eye = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMat.map, color: 0xb88aff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); eye.scale.set(1.6, 1.6, 1); eye.position.set(0, 2.6, 1.4);
    st.add(base, head, eye); place(st, RUINS.x, RUINS.y + RUINS.r + 260); }
  // the Overgrown Gate at the north edge: the way onward, still choked with vines
  { const gate = new THREE.Group(); for(const sx of [-3, 3]){ const pil = new THREE.Mesh(new THREE.BoxGeometry(1.6, 9, 1.6), ruinM); pil.position.set(sx, 4.5, 0); gate.add(pil); }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(8.4, 1.6, 1.8), ruinM); lintel.position.y = 9.6; gate.add(lintel);
    const vines = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 8.6), new THREE.MeshLambertMaterial({ color: 0x2f6a2a, side: THREE.DoubleSide })); vines.position.y = 4.4; gate.add(vines);
    place(gate, OLD_GATE.x, OLD_GATE.y); }
  // beams over the vantage points for "Eyes Above the Canopy"
  VANTAGES.forEach((p, i) => { const beam = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, 12, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: .22, depthWrite: false, blending: THREE.AdditiveBlending })); beam.visible = false; place(beam, p.x, p.y, 6); EXPLORE_FX.push({ quest: "vantage", i, beam }); });
  // waystones: one in camp, its twin by Highwatch Outpost in the Peaks
  const stoneM = new THREE.MeshStandardMaterial({ color: 0x6a6e74, flatShading: true });
  const waystone = (p, peaks) => {
    const ws = new THREE.Group(), ob = new THREE.Mesh(new THREE.CylinderGeometry(.35, .6, 3.6, 5), stoneM); ob.position.y = 1.8;
    const rune = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMat.map, color: 0x7fffa0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); rune.scale.set(2, 2, 1); rune.position.y = 2.6;
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x7fffa0, transparent: true, opacity: .7, depthWrite: false })); ring.scale.setScalar(JUNGLE.portalR * ZSC); ring.position.y = .06;
    ws.add(ob, rune, ring); const w = XF(p.x, p.y); ws.position.set(w.x, (peaks ? outside : jh)(p.x, p.y), w.z); (peaks ? g : grp).add(ws);
    const label = { x: p.x, y: p.y, name: p.name, shown: !peaks }; PORTAL_VIS.push(label);
    return { rune, ring, label };
  };
  const wsJungle = waystone(WAYSTONES.jungle, false), wsPeaks = waystone(WAYSTONES.peaks, true);
  // the two portals behind the Saint's altar (they open when he dies)
  const portalSprite = (inner, edge) => { const cv2 = document.createElement("canvas"); cv2.width = cv2.height = 128; const pg = cv2.getContext("2d"), grd = pg.createRadialGradient(64, 64, 2, 64, 64, 62);
    grd.addColorStop(0, inner); grd.addColorStop(.55, inner); grd.addColorStop(.75, edge); grd.addColorStop(1, "rgba(0,0,0,0)"); pg.fillStyle = grd; pg.beginPath(); pg.ellipse(64, 64, 42, 62, 0, 0, Math.PI * 2); pg.fill();
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv2), transparent: true, depthWrite: false })); s.scale.set(2.8, 4.4, 1); return s; };
  const choir = {};
  for(const [side, inner, edge, name] of [["right", "rgba(20,60,30,1)", "rgba(120,255,140,.9)", "To the Thornveil Jungle"], ["left", "rgba(30,20,50,1)", "rgba(170,140,255,.7)", "Sealed Portal"]]){
    const p = CHOIR_PORTALS[side], s = portalSprite(inner, edge), w = XF(p.x, p.y); s.position.set(w.x, 2.3, w.z); g.add(s);
    const label = { x: p.x, y: p.y, name, shown: false }; PORTAL_VIS.push(label); choir[side] = { s, label };
  }
  JUNG = { grp, wsJungle, wsPeaks, choir, tops, hiddenAt: null };

  // picture for the maps
  const MS = 256, pic = document.createElement("canvas"); pic.width = pic.height = MS; const mg = pic.getContext("2d"), img = mg.createImageData(MS, MS);
  for(let py = 0; py < MS; py++) for(let px = 0; px < MS; px++){
    const x = JX + (px + .5) / MS * ZS, y = JY + ZS - (py + .5) / MS * ZS, f = fields(x, y), h = height(x, y, f);
    colorAt(x, y, f, h, c); if(h < -.55){ c.setHSL(.47, .35, .38); } t2.setHSL(.08, .35, .5); c.lerp(t2, f.path * .8);
    const o = (py * MS + px) * 4; img.data[o] = c.r * 255; img.data[o + 1] = c.g * 255; img.data[o + 2] = c.b * 255; img.data[o + 3] = 255;
  }
  mg.putImageData(img, 0, 0);
  const toM = (x, y) => [(x - JX) / ZS * MS, (JY + ZS - y) / ZS * MS];
  mg.fillStyle = "rgba(10,40,12,.55)"; for(const [x, y] of trees){ const [a, b] = toM(x, y); mg.fillRect(a - .7, b - .7, 1.5, 1.5); }
  for(const [p, colr] of [[CANOPY, "#c8a050"], [WAYSTONES.jungle, "#7fffa0"], [OLD_GATE, "#9a988a"]]){ const [a, b] = toM(p.x, p.y); mg.fillStyle = colr; mg.fillRect(a - 2.5, b - 2.5, 5, 5); mg.strokeStyle = "#1b1410"; mg.strokeRect(a - 2.5, b - 2.5, 5, 5); }
  ZONE_PICS.jungle = pic;
}

// per frame: hide the jungle from inside the cathedral, light the portals and waystones
function updateJungle(s, me, t){
  if(!JUNG || !s) return;
  const dg = s.dg || {}, inCath = me && me.y > DZ && me.x <= ZS;
  JUNG.grp.visible = !inCath;
  for(const side of ["right", "left"]){ const p = JUNG.choir[side]; p.s.visible = p.label.shown = !!dg.sd; p.s.material.opacity = side === "right" ? .85 + Math.sin(t * 3) * .15 : .45; p.s.material.rotation = Math.sin(t) * .05; }
  const q = me && me.quests, been = !!(q && ((q.ashensaint && (q.ashensaint.state === "ready" || q.ashensaint.state === "done")) || Object.keys(q).some(id => QUESTS[id] && (QUESTS[id].giver === "tamsin" || QUESTS[id].giver === "ezo"))));
  JUNG.wsPeaks.label.shown = been; JUNG.wsPeaks.rune.material.opacity = been ? .8 + Math.sin(t * 3) * .2 : .15; JUNG.wsPeaks.ring.material.opacity = been ? .7 : .15;
  JUNG.wsJungle.rune.material.opacity = .8 + Math.sin(t * 3) * .2;
  // fade the tree tops between the camera and you (the camera sits to your south, looking north)
  if(me && inJungle(me.x, me.y)){
    const key = Math.round(me.x / 40) + "," + Math.round(me.y / 40) + "," + camDist;
    if(key === JUNG.hiddenAt) return; JUNG.hiddenAt = key;
    const reach = camDist * 17, zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for(const tp of JUNG.tops){
      let dirty = false; tp.hidden = tp.hidden || new Set();
      tp.list.forEach(([x, y], i) => {
        const dy = me.y - y, hide = dy > -120 && dy < reach && Math.abs(x - me.x) < 260 + dy * .25;
        if(hide !== tp.hidden.has(i)){ dirty = true; if(hide){ tp.hidden.add(i); tp.im.setMatrixAt(i, zero); } else { tp.hidden.delete(i); tp.im.setMatrixAt(i, tp.mats[i]); } }
      });
      if(dirty) tp.im.instanceMatrix.needsUpdate = true;
    }
  }
}
// warm, green, humid air in the jungle
const JUNGLE_FOG = window.THREE ? new THREE.Color(0x9fb89a) : null;
function jungleClimate(){ if(scene.fog){ scene.fog.color.copy(JUNGLE_FOG); scene.background.copy(JUNGLE_FOG); } }
