"use strict";
// The Amberveil Wastes: rolling dunes, the Glass Flats, rock mesas, Sandglass Oasis (palms, a spring, tents,
// Sefu's awning), the Sun Obelisks, the caravan wrecks, the Sunken Necropolis, Ashkar's gate, Queen Ankhara's
// tomb, Zahrak's Scoured Basin, the waystones, the map picture, and the hot golden haze while you're there.

let DES = null;
const DESERT_PATHS = [
  [[OASIS.x, OASIS.y], [GLASS_FLATS.x - 500, GLASS_FLATS.y - 200], [WRECKS[0].x - 300, WRECKS[0].y], [JACKAL_RIDGE.x - 300, JACKAL_RIDGE.y - 300]],
  [[OASIS.x, OASIS.y], [DX + 1500, DY + 2800], [WHISPER_DUNES.x + 500, WHISPER_DUNES.y + 300], [SUNSCALE_MESA.x + 300, SUNSCALE_MESA.y - 500]],
  [[DX + 1500, DY + 2800], [OBELISKS[0].x, OBELISKS[0].y - 250], [OBELISKS[2].x - 200, OBELISKS[2].y - 250], [NECROPOLIS.x - 200, NECROPOLIS.y - 600]],
  [[NECROPOLIS.x - 200, NECROPOLIS.y + 500], [WARDEN_GATE.x, WARDEN_GATE.y - 200], [SUN_TOMB.x + 500, SUN_TOMB.y - 300]],
  [[JACKAL_RIDGE.x - 300, JACKAL_RIDGE.y + 300], [WRECKS[1].x - 300, WRECKS[1].y], [STINGER_HOLLOW.x - 300, STINGER_HOLLOW.y - 300], [SCOURED_BASIN.x - 200, SCOURED_BASIN.y - 700]],
  [[OBELISKS[1].x, OBELISKS[1].y + 250], [WRECKS[2].x, WRECKS[2].y - 250]],
];

function buildDesert(g){
  const outside = ZH, grp = new THREE.Group(); g.add(grp);
  let seed = 53; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const segD = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))); return Math.hypot(px - ax - t * dx, py - ay - t * dy); };
  const polyD = (px, py, pl) => { let m = 1e9; for(let i = 0; i < pl.length - 1; i++) m = Math.min(m, segD(px, py, pl[i][0], pl[i][1], pl[i + 1][0], pl[i + 1][1])); return m; };
  const noise = (x, y) => Math.sin(x * .0012 + 1.1) * Math.cos(y * .0010 + 2.4) + .5 * Math.sin(x * .0029 - y * .0024 + .3) + .25 * Math.sin(x * .0068 + y * .0059);
  const D = (x, y, p) => Math.hypot(x - p.x, y - p.y);
  const fields = (x, y) => {
    const lx = x - DX, ly = y - DY; let dP = 1e9; for(const p of DESERT_PATHS) dP = Math.min(dP, polyD(x, y, p));
    let mesa = 0; for(const m of MESAS) mesa = Math.max(mesa, 1 - ss(m.r * .75, m.r + 60, D(x, y, m)));
    return { camp: 1 - ss(OASIS.r, OASIS.r + 260, D(x, y, OASIS)), pool: 1 - ss(OASIS_POOL.r * .7, OASIS_POOL.r + 40, D(x, y, OASIS_POOL)), path: 1 - ss(90, 220, dP), mesa,
      flats: 1 - ss(GLASS_FLATS.r * .6, GLASS_FLATS.r + 100, D(x, y, GLASS_FLATS)), necro: 1 - ss(NECROPOLIS.r * .7, NECROPOLIS.r + 120, D(x, y, NECROPOLIS)),
      tomb: 1 - ss(SUN_TOMB.r * .7, SUN_TOMB.r + 150, D(x, y, SUN_TOMB)), basin: 1 - ss(SCOURED_BASIN.r * .5, SCOURED_BASIN.r + 200, D(x, y, SCOURED_BASIN)),
      dunes: 1 - ss(WHISPER_DUNES.r * .4, WHISPER_DUNES.r + 300, D(x, y, WHISPER_DUNES)),
      edge: 1 - ss(300, 1100, Math.min(lx, ZS - lx, ZS - ly, ly + 250)) };   // cliffs all round (the camera turns, so the south needs them too)
  };
  const height = (x, y, f) => {
    // long dune ridges running north-east, steeper in the Whispering Dunes, over a slow swell
    const ridge = Math.pow(Math.abs(Math.sin((x * .7 + y) * .0016 + noise(x * .4, y * .4) * 1.4)), 1.6);
    let h = ridge * (1.3 + 1.6 * f.dunes) + noise(x, y) * .9 + .5;
    const flat = Math.max(f.camp, f.path * .75, f.flats * .85, f.necro * .8, f.tomb * .85);
    h = h * (1 - flat) + .3 * flat;
    h -= f.pool * 1.6 + f.basin * 1.8;
    h += f.mesa * 7;
    h += Math.pow(f.edge, 1.5) * 14 * (.8 + .4 * noise(x * 2.4, y * 2.4));
    return h;
  };
  const dh = (x, y) => height(x, y, fields(x, y));
  ZH = (x, y) => inDesert(x, y) ? dh(x, y) : outside(x, y);
  const place = (m, x, y, lift = 0) => { const w = XF(x, y); m.position.set(w.x, dh(x, y) + lift, w.z); grp.add(m); return m; };
  const c = new THREE.Color(), t2 = new THREE.Color();
  const colorAt = (x, y, f, h, out) => {
    const n = noise(x * 3.1, y * 2.9);
    out.setHSL(.1 + .01 * n, .55, .62 + .05 * n);                                  // golden sand
    t2.setHSL(.09, .45, .5 + .04 * n); out.lerp(t2, ss(.4, 2.2, h) * .35);          // shaded dune crests
    t2.setHSL(.11, .25, .78 + .03 * n); out.lerp(t2, f.flats * .55);                // the pale, glazed flats
    t2.setHSL(.06, .35, .42 + .04 * n); out.lerp(t2, Math.max(f.path * .6, f.camp * .3));
    t2.setHSL(.27, .45, .34 + .04 * n); out.lerp(t2, (1 - ss(OASIS_POOL.r + 40, OASIS_POOL.r + 320, D(x, y, OASIS_POOL))) * .8);   // green round the spring
    t2.setHSL(.08, .2, .58 + .03 * n); out.lerp(t2, Math.max(f.necro * .55, f.tomb * .6));   // old paving
    t2.setHSL(.05, .45, .4 + .04 * n); out.lerp(t2, f.mesa * .85);                 // red rock
    t2.setHSL(.07, .5, .5 + .03 * n); out.lerp(t2, f.basin * .45);
    t2.setHSL(.05, .4, .45 + .05 * n); out.lerp(t2, ss(3, 8, h) * f.edge);         // cliffs round the edge
    return out;
  };
  // ground
  const geo = new THREE.PlaneGeometry(ZONE_W, ZONE_W, 200, 200); geo.rotateX(-Math.PI / 2);
  const ctr = XF(DX + ZS / 2, DY + ZS / 2); geo.translate(ctr.x, 0, ctr.z);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  for(let i = 0; i < pos.count; i++){
    const [x, y] = XF.inv(pos.getX(i), pos.getZ(i)), f = fields(x, y), h = height(x, y, f);
    pos.setY(i, h); colorAt(x, y, f, h, c).convertSRGBToLinear(); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  grp.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })));
  // the oasis spring
  { const w = XF(OASIS_POOL.x, OASIS_POOL.y), water = new THREE.Mesh(new THREE.CircleGeometry(OASIS_POOL.r * ZSC * 1.15, 40), new THREE.MeshStandardMaterial({ color: 0x3fa8b8, roughness: .2, metalness: .1, transparent: true, opacity: .85 }));
    water.rotation.x = -Math.PI / 2; water.position.set(w.x, -.6, w.z); grp.add(water); }
  // cacti, dry shrubs and bleached rocks (instanced), kept off paths, camp, mesas and fighting grounds
  const free = (x, y) => { const f = fields(x, y); return f.path < .2 && f.camp < .1 && f.mesa < .05 && f.necro < .3 && f.tomb < .2 && f.basin < .1 && f.flats < .5 && f.edge < .9
    && D(x, y, WAYSTONES.desert) > 300 && !OBELISKS.some(o => D(x, y, o) < 260) && !WRECKS.some(o => D(x, y, o) < 300) && clearOfOre(x, y); };
  const pick = (n) => { const out = []; for(let k = 0; k < n * 6 && out.length < n; k++){ const x = DX + 500 + rnd() * (ZS - 1000), y = DY + 500 + rnd() * (ZS - 1000); if(free(x, y)) out.push([x, y]); } return out; };
  const inst = (geom, mat, list, setup) => { const im = new THREE.InstancedMesh(geom, mat, list.length), d = new THREE.Object3D(); list.forEach((p, i) => { setup(d, p, i); d.updateMatrix(); im.setMatrixAt(i, d.matrix); }); grp.add(im); return im; };
  const at = (d, [x, y], lift) => { const w = XF(x, y); d.position.set(w.x, dh(x, y) + lift, w.z); };
  const cacti = pick(170), shrubs = pick(420), stones = pick(160);
  const cactM = new THREE.MeshLambertMaterial({ color: 0x4f8a4a, flatShading: true }), sizes = cacti.map(() => .7 + rnd() * .6);
  inst(new THREE.CylinderGeometry(.28, .32, 2.6, 7), cactM, cacti, (d, p, i) => { at(d, p, 1.3 * sizes[i]); d.scale.setScalar(sizes[i]); d.rotation.set(0, rnd() * 3, 0); });
  for(const side of [-1, 1]){   // two arms each, bent upward
    inst(new THREE.CylinderGeometry(.18, .2, .9, 6), cactM, cacti, (d, p, i) => { const w = XF(p[0] + side * 30 * sizes[i], p[1]); d.position.set(w.x, dh(p[0], p[1]) + (1.2 + (side > 0 ? .3 : 0)) * sizes[i], w.z); d.rotation.set(0, 0, side * 1.1); d.scale.setScalar(sizes[i]); });
    inst(new THREE.CylinderGeometry(.16, .18, .9, 6), cactM, cacti, (d, p, i) => { const w = XF(p[0] + side * 52 * sizes[i], p[1]); d.position.set(w.x, dh(p[0], p[1]) + (1.75 + (side > 0 ? .3 : 0)) * sizes[i], w.z); d.rotation.set(0, 0, 0); d.scale.setScalar(sizes[i]); });
  }
  inst(new THREE.IcosahedronGeometry(.45, 0), new THREE.MeshLambertMaterial({ color: 0x9a8a4a, flatShading: true }), shrubs, (d, p) => { at(d, p, .2); d.scale.set(1 + rnd(), .5 + rnd() * .4, 1 + rnd()); d.rotation.set(0, rnd() * 3, 0); });
  inst(new THREE.IcosahedronGeometry(.6, 0), new THREE.MeshStandardMaterial({ color: 0xc8a888, flatShading: true }), stones, (d, p) => { at(d, p, .2); const sc = .5 + rnd() * 1.2; d.scale.set(sc, sc * .6, sc); d.rotation.set(rnd(), rnd() * 3, 0); });
  // the mesas: layered red rock
  const rockM = [0xa8583a, 0xc87a4a, 0x8a4a30].map(h => new THREE.MeshStandardMaterial({ color: h, flatShading: true, roughness: 1 }));
  for(const m of MESAS){ const mg = new THREE.Group(), R = m.r * ZSC; for(let k = 0; k < 3; k++){ const sl = new THREE.Mesh(new THREE.CylinderGeometry(R * (1 - k * .12), R * (1.08 - k * .12), 2.6, 9), rockM[k]); sl.position.y = 1.3 + k * 2.4; mg.add(sl); } mg.rotation.y = rnd() * 3; const w = XF(m.x, m.y); mg.position.set(w.x, -.5, w.z); grp.add(mg); }
  // Sandglass Oasis: palms round the spring, striped tents, Sefu's awning, a fire, camels' water troughs
  const trunkM = new THREE.MeshLambertMaterial({ color: 0x8a6a4a }), frondM = [0x4f9a3a, 0x3a8030].map(h => new THREE.MeshLambertMaterial({ color: h, flatShading: true }));
  for(let k = 0; k < 11; k++){ const a = k / 11 * Math.PI * 2 + rnd() * .3, rr = OASIS_POOL.r + 90 + rnd() * 140, palm = new THREE.Group(), tr = new THREE.Mesh(new THREE.CylinderGeometry(.12, .2, 4.2, 5), trunkM); tr.position.y = 2.1; tr.rotation.z = (rnd() - .5) * .3; palm.add(tr);
    for(let l = 0; l < 6; l++){ const fr = new THREE.Mesh(new THREE.ConeGeometry(.35, 2.6, 4), frondM[l % 2]); fr.position.y = 4.2; fr.scale.set(1, 1, .4); fr.rotation.set(Math.PI / 2 - .5, l / 6 * Math.PI * 2, 0, "YXZ"); palm.add(fr); }
    place(palm, OASIS_POOL.x + Math.cos(a) * rr, OASIS_POOL.y + Math.sin(a) * rr); }
  const tentM = hex => new THREE.MeshStandardMaterial({ color: hex, flatShading: true, roughness: .9 });
  for(const [dx, dy, hex, rot] of [[-420, -160, 0xd8b070, .2], [-120, 400, 0xb84a3a, -.4], [380, -400, 0xe8dcc0, .7], [-470, 260, 0x3a6a9a, .4]]){ const tent = new THREE.Mesh(new THREE.ConeGeometry(2.1, 2.4, 4), tentM(hex)); tent.rotation.y = rot; place(tent, OASIS.x + dx, OASIS.y + dy, 1.2); }
  const crateM = new THREE.MeshLambertMaterial({ color: 0x8a6a40 });
  { const awn = new THREE.Mesh(new THREE.BoxGeometry(3.2, .1, 2), new THREE.MeshLambertMaterial({ color: 0xc84a3a })); place(awn, DESERT_STALL.x, DESERT_STALL.y, 2.4);
    for(const sx of [-1, 1]) for(const sy of [-1, 1]){ const post = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 2.4, 5), crateM); place(post, DESERT_STALL.x + sx * 105, DESERT_STALL.y + sy * 65, 1.2); }
    for(let k = 0; k < 3; k++){ const jar = new THREE.Mesh(new THREE.CylinderGeometry(.25, .32, .8, 7), new THREE.MeshLambertMaterial({ color: 0xb8683a })); place(jar, DESERT_STALL.x - 90 + k * 90, DESERT_STALL.y + 90, .4); } }
  { const fg = new THREE.Group(); for(const [sc, hex] of [[1, 0xff7a20], [.6, 0xffd040]]){ const fl = new THREE.Mesh(new THREE.ConeGeometry(.3 * sc, .95 * sc, 7), new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: .9 })); fl.position.y = .5 * sc + .1; fg.add(fl); fireFlames.push(fl); }
    const li = new THREE.PointLight(0xffa040, 1.1, 14, 1.6); li.position.y = 1.2; fg.add(li); place(fg, ...DESERT_FIRE); }
  // the Sun Obelisks: tall sandstone needles that light gold once read (for "Glyphs of the Sun")
  const sandM = new THREE.MeshStandardMaterial({ color: 0xd8b880, flatShading: true });
  OBELISKS.forEach(o => {
    const ob = new THREE.Group(), shaft = new THREE.Mesh(new THREE.CylinderGeometry(.35, .6, 5.5, 4), sandM); shaft.position.y = 2.75; shaft.rotation.y = Math.PI / 4;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(.42, .9, 4), new THREE.MeshStandardMaterial({ color: 0xe0b040, flatShading: true, metalness: .5, roughness: .4 })); cap.position.y = 5.95; cap.rotation.y = Math.PI / 4;
    const flame = new THREE.Group(), gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMat.map, color: 0xffd36a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.set(3.4, 3.4, 1); gl.position.y = 5.9;
    const li = new THREE.PointLight(0xffc040, 1, 12, 1.6); li.position.y = 5; flame.add(gl, li); flame.visible = false;
    const hint = new THREE.Sprite(glowMat); hint.scale.set(2.4, 2.4, 1); hint.position.y = 2; hint.visible = false;
    ob.add(shaft, cap, flame, hint); place(ob, o.x, o.y);
    USE_FX[USE_POINTS.indexOf(o)] = { flame, hint };
  });
  // the caravan wrecks (explore points for "The Lost Caravan"): broken wagons, scattered crates, a ribcage
  const woodM = new THREE.MeshLambertMaterial({ color: 0x7a5232 }), boneM = new THREE.MeshLambertMaterial({ color: 0xece2c8 });
  WRECKS.forEach((p, i) => {
    const wr = new THREE.Group(), bed = new THREE.Mesh(new THREE.BoxGeometry(2.6, .4, 1.4), woodM); bed.position.y = .5; bed.rotation.z = .25;
    for(const [wx, wz, tilt] of [[-.9, .8, 1.2], [.9, -.8, 0]]){ const wh = new THREE.Mesh(new THREE.TorusGeometry(.45, .07, 4, 10), woodM); wh.position.set(wx, .45, wz); wh.rotation.set(tilt, 0, 0); wr.add(wh); }
    for(let k = 0; k < 3; k++){ const cr = new THREE.Mesh(new THREE.BoxGeometry(.6, .6, .6), crateM); cr.position.set(-1.6 + k * 1.3, .3, 1.2 + (k % 2) * .4); cr.rotation.y = rnd(); wr.add(cr); }
    if(i === 1) for(let k = 0; k < 6; k++){ const rib = new THREE.Mesh(new THREE.TorusGeometry(1.1, .08, 4, 10, Math.PI), boneM); rib.position.set(-1.5 + k * .55, 0, -1.6); rib.rotation.y = Math.PI / 2; wr.add(rib); }
    wr.rotation.y = rnd() * 3; place(wr, p.x, p.y);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, 12, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: .22, depthWrite: false, blending: THREE.AdditiveBlending })); beam.visible = false; place(beam, p.x, p.y, 6); EXPLORE_FX.push({ quest: "caravan", i, beam });
  });
  // the Sunken Necropolis: half-buried tombs and toppled columns
  const tombM = new THREE.MeshStandardMaterial({ color: 0xc8a878, flatShading: true });
  for(let k = 0; k < 14; k++){ const a = rnd() * 6.28, rr = NECROPOLIS.r * (.35 + rnd() * .7), b = new THREE.Mesh(new THREE.BoxGeometry(1.6 + rnd() * 1.5, 1 + rnd() * 1.6, 1.4 + rnd()), tombM); b.rotation.set(rnd() * .3, rnd() * 3, rnd() * .3); place(b, NECROPOLIS.x + Math.cos(a) * rr, NECROPOLIS.y + Math.sin(a) * rr, .4); }
  for(let k = 0; k < 9; k++){ const a = k / 9 * Math.PI * 2, hgt = 1.5 + rnd() * 3.5, col2 = new THREE.Mesh(new THREE.CylinderGeometry(.5, .55, hgt, 8), tombM); place(col2, NECROPOLIS.x + Math.cos(a) * (NECROPOLIS.r + 60), NECROPOLIS.y + Math.sin(a) * (NECROPOLIS.r + 60), hgt / 2); }
  // Ashkar's gate, and the Sunken Tomb: a stepped pyramid sunk in the sand, with a great sarcophagus
  { const gate = new THREE.Group(); for(const sx of [-3, 3]){ const pil = new THREE.Mesh(new THREE.BoxGeometry(1.4, 7, 1.4), tombM); pil.position.set(sx, 3.5, 0); gate.add(pil);
      const jackal = new THREE.Mesh(new THREE.ConeGeometry(.6, 1.6, 4), new THREE.MeshStandardMaterial({ color: 0x22343e, flatShading: true })); jackal.position.set(sx, 7.8, 0); gate.add(jackal); }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(7.6, 1.2, 1.6), tombM); lintel.position.y = 7.3; gate.add(lintel); place(gate, WARDEN_GATE.x, WARDEN_GATE.y + 300); }
  { const pyr = new THREE.Group(); for(let k = 0; k < 4; k++){ const st = new THREE.Mesh(new THREE.BoxGeometry(14 - k * 3.2, 1.6, 14 - k * 3.2), tombM); st.position.y = .8 + k * 1.6; pyr.add(st); }
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2, 4), new THREE.MeshStandardMaterial({ color: 0xe0b040, metalness: .5, roughness: .4, flatShading: true })); cap.position.y = 7.4; cap.rotation.y = Math.PI / 4; pyr.add(cap);
    place(pyr, SUN_TOMB.x, SUN_TOMB.y + SUN_TOMB.r + 450);
    const sarc = new THREE.Mesh(new THREE.BoxGeometry(1.4, .9, 3), new THREE.MeshStandardMaterial({ color: 0xe0b040, metalness: .4, roughness: .5 })); place(sarc, SUN_TOMB.x, SUN_TOMB.y + 420, .45);
    for(let k = 0; k < 8; k++){ const a = k / 8 * Math.PI * 2, hgt = 2 + rnd() * 3, col2 = new THREE.Mesh(new THREE.CylinderGeometry(.55, .6, hgt, 8), tombM); place(col2, SUN_TOMB.x + Math.cos(a) * (SUN_TOMB.r + 40), SUN_TOMB.y + Math.sin(a) * (SUN_TOMB.r + 40), hgt / 2); } }
  // the Scoured Basin: bleached bones of things the wyrm swallowed
  for(let k = 0; k < 7; k++){ const a = rnd() * 6.28, rr = SCOURED_BASIN.r * (.85 + rnd() * .3), ribs = new THREE.Group();
    for(let r = 0; r < 4; r++){ const rib = new THREE.Mesh(new THREE.TorusGeometry(.9 + rnd() * .5, .08, 4, 10, Math.PI), boneM); rib.position.x = r * .5; rib.rotation.y = Math.PI / 2; ribs.add(rib); }
    ribs.rotation.y = rnd() * 3; place(ribs, SCOURED_BASIN.x + Math.cos(a) * rr, SCOURED_BASIN.y + Math.sin(a) * rr); }
  // Rattlespine's hollow: a ring of jagged rocks
  for(let k = 0; k < 9; k++){ const a = k / 9 * Math.PI * 2, b = new THREE.Mesh(new THREE.ConeGeometry(.8, 2.4 + rnd() * 2, 5), rockM[k % 3]); place(b, STINGER_HOLLOW.x + Math.cos(a) * 560, STINGER_HOLLOW.y + Math.sin(a) * 560, 1); }
  // waystones: one at the oasis, its twin by Highwatch Outpost in the Peaks
  const stoneM = new THREE.MeshStandardMaterial({ color: 0x8a7a64, flatShading: true });
  const waystone = (p, peaks) => {
    const ws = new THREE.Group(), ob = new THREE.Mesh(new THREE.CylinderGeometry(.35, .6, 3.6, 5), stoneM); ob.position.y = 1.8;
    const rune = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMat.map, color: 0xffc860, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); rune.scale.set(2, 2, 1); rune.position.y = 2.6;
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: .7, depthWrite: false })); ring.scale.setScalar(JUNGLE.portalR * ZSC); ring.position.y = .06;
    ws.add(ob, rune, ring); const w = XF(p.x, p.y); ws.position.set(w.x, (peaks ? outside : dh)(p.x, p.y), w.z); (peaks ? g : grp).add(ws);
    const label = { x: p.x, y: p.y, name: p.name, shown: !peaks }; PORTAL_VIS.push(label);
    return { rune, ring, label };
  };
  const wsDesert = waystone(WAYSTONES.desert, false), wsPeaks = waystone(WAYSTONES.peaksDesert, true);
  DES = { grp, wsDesert, wsPeaks };

  // picture for the maps
  const MS = 256, pic = document.createElement("canvas"); pic.width = pic.height = MS; const mg = pic.getContext("2d"), img = mg.createImageData(MS, MS);
  for(let py = 0; py < MS; py++) for(let px = 0; px < MS; px++){
    const x = DX + (px + .5) / MS * ZS, y = DY + ZS - (py + .5) / MS * ZS, f = fields(x, y), h = height(x, y, f);
    colorAt(x, y, f, h, c); if(f.pool > .5) c.setHSL(.52, .45, .45); t2.setHSL(.07, .4, .4); c.lerp(t2, f.path * .7);
    const o = (py * MS + px) * 4; img.data[o] = c.r * 255; img.data[o + 1] = c.g * 255; img.data[o + 2] = c.b * 255; img.data[o + 3] = 255;
  }
  mg.putImageData(img, 0, 0);
  const toM = (x, y) => [(x - DX) / ZS * MS, (DY + ZS - y) / ZS * MS];
  mg.fillStyle = "rgba(40,90,40,.7)"; for(const [x, y] of cacti){ const [a, b] = toM(x, y); mg.fillRect(a - .6, b - .6, 1.3, 1.3); }
  for(const [p, colr] of [[OASIS, "#3fa8b8"], [WAYSTONES.desert, "#ffc860"], [SUN_TOMB, "#e0b040"]]){ const [a, b] = toM(p.x, p.y); mg.fillStyle = colr; mg.fillRect(a - 2.5, b - 2.5, 5, 5); mg.strokeStyle = "#1b1410"; mg.strokeRect(a - 2.5, b - 2.5, 5, 5); }
  ZONE_PICS.desert = pic;
}

// per frame: light the waystones (the Highwatch one stays dark until you've been)
function updateDesert(s, me, t){
  if(!DES || !s) return;
  const q = me && me.quests, been = !!(q && ((q.ashensaint && (q.ashensaint.state === "ready" || q.ashensaint.state === "done")) || Object.keys(q).some(id => QUESTS[id] && (QUESTS[id].giver === "daro" || QUESTS[id].giver === "nadira"))));
  DES.wsPeaks.label.shown = been; DES.wsPeaks.rune.material.opacity = been ? .8 + Math.sin(t * 3) * .2 : .15; DES.wsPeaks.ring.material.opacity = been ? .7 : .15;
  DES.wsDesert.rune.material.opacity = .8 + Math.sin(t * 3) * .2;
}
// hot, golden, dusty air in the desert
const DESERT_FOG = window.THREE ? new THREE.Color(0xe6c890) : null;
function desertClimate(){ if(scene.fog){ scene.fog.color.copy(DESERT_FOG); scene.background.copy(DESERT_FOG); } }
