"use strict";
// Frostspine Peaks: the mountain zone north of Greywind Pass. Terrain, props, map picture and snowfall.

let PEAKIMG = null; // north-up picture of the Peaks for the minimap and world map
let SNOW = null;
// Builds the Peaks into group g. T holds helpers from buildZone; valeH is the Vale's height function.
function buildPeaks(g, valeH, T){
  const { ss, noise, polyD, rnd, d, c, t2, stone, beamM } = T;
  const fields = (x, y) => {
    let dP = 1e9; for(const p of PEAK_PATHS) dP = Math.min(dP, polyD(x, y, p));
    const dOut = Math.hypot(x - OUTPOST.x, y - OUTPOST.y), dMead = Math.hypot(x - RAM_MEADOW.x, y - RAM_MEADOW.y), dRidge = Math.hypot(x - LYNX_RIDGE.x, y - LYNX_RIDGE.y), dSum = Math.hypot(x - SUMMIT.x, y - SUMMIT.y);
    let crag = 0; for(const [cx, cy, cr] of CRAGS) crag = Math.max(crag, 1 - ss(cr * .3, cr * 1.25, Math.hypot(x - cx, y - cy)));
    const edge = 1 - ss(300, 1100, Math.min(x, ZS - x, WH - y));
    // the southern ridge, open at the pass
    const south = (1 - ss(150, 900, y - ZS)) * ss(PASS.w + 80, PASS.w + 650, Math.abs(x - PASS.x));
    const dMine = Math.hypot(x - MINE.x, y - MINE.y), dLake = Math.hypot(x - LAKE.x, y - LAKE.y), dLair = Math.hypot(x - LAIR.x, y - LAIR.y), dYeti = Math.hypot(x - YETI_DEN.x, y - YETI_DEN.y);
    const dCamps = Math.min(Math.hypot(x - KETIL_CAMP.x, y - KETIL_CAMP.y), Math.hypot(x - YRSA_CAMP.x, y - YRSA_CAMP.y));
    return { dP, dOut, dMead, dRidge, crag, edge, south, dMine, dLake, dLair, dYeti, dCamps, mine: 1 - ss(MINE.r * .8, MINE.r + 250, dMine), lake: 1 - ss(LAKE.r - 60, LAKE.r + 60, dLake), shore: 1 - ss(LAKE.r, LAKE.r + 450, dLake),
      lair: 1 - ss(LAIR.r * .85, LAIR.r + 200, dLair), yeti: 1 - ss(YETI_DEN.r * .7, YETI_DEN.r + 150, dYeti), camps: 1 - ss(300, 500, dCamps),
      path: 1 - ss(110, 240, dP), out: 1 - ss(OUTPOST.r, OUTPOST.r + 300, dOut),
      mead: 1 - ss(RAM_MEADOW.r - 100, RAM_MEADOW.r + 200, dMead), ridge: 1 - ss(LYNX_RIDGE.r * .5, LYNX_RIDGE.r, dRidge), sum: 1 - ss(250, 450, dSum) };
  };
  const raw = (x, y, f) => {
    let h = noise(x, y) * 1.8 + .7 * noise(x * 2.1 + 300, y * 1.9 - 700) + .6;
    const flat = Math.max(f.path * .75, f.out, f.mead * .8, f.ridge * .45, f.sum, f.mine * .85, f.shore, f.lair, f.yeti * .8, f.camps);
    h = h * (1 - flat) + .3 * flat;
    h -= f.lake * .5;                                       // Glassmere sits a little lower than its shore
    h += Math.pow(Math.max(f.edge, f.south), 1.4) * 16 * (.75 + .5 * noise(x * 2.5, y * 2.5));
    h += Math.pow(f.crag, 1.3) * 18 * (.85 + .3 * noise(x * 3, y * 3));
    return h;
  };
  // blend into the Vale's heights along the seam so the two meshes meet without a crack
  const height = (x, y, f) => { const k = ss(ZS, ZS + 700, y); return k >= 1 ? raw(x, y, f) : valeH(x, ZS) * (1 - k) + raw(x, y, f) * k; };
  const peakH = (x, y) => height(x, y, fields(x, y));
  ZH = (x, y) => y > ZS ? peakH(x, y) : valeH(x, y);
  const snowLine = y => 4.6 - 2.4 * ss(ZS, WH, y);
  const colorAt = (x, y, f, h, out) => {
    const n = noise(x * 3.7, y * 3.3);
    out.setHSL(.22, .22, .42 + .05 * n);                                          // cold tundra grass
    t2.setHSL(.24, .3, .45); out.lerp(t2, f.mead * .5);
    t2.setHSL(.08, .14, .55 + .03 * n); out.lerp(t2, Math.max(f.path * .9, f.out * .7, f.sum * .6));
    t2.setHSL(.07, .07, .44 + .06 * n); out.lerp(t2, ss(1.6, 4, h));            // bare rock
    t2.setHSL(.07, .1, .34 + .05 * n); out.lerp(t2, f.mine * .75);              // the mine's dark spoil heaps
    t2.setHSL(.58, .35, .7 + .05 * n); out.lerp(t2, f.lair * .7);               // frosted stone of the Wyrm's Crown
    t2.setHSL(.6, .25, .94); out.lerp(t2, Math.max(ss(snowLine(y), snowLine(y) + 2, h + n * .8), ss(.5, .85, noise(x * .9 + 77, y * .9 - 31)) * .65 * (1 - f.path)));
    t2.setHSL(.55, .5, .8 + .04 * n); out.lerp(t2, f.lake);                       // Glassmere's ice
    return out;
  };
  // ground
  const geo = new THREE.PlaneGeometry(ZONE_W, ZONE_W, 200, 200); geo.rotateX(-Math.PI / 2);
  const ctr = XF(ZS / 2, ZS * 1.5); geo.translate(ctr.x, 0, ctr.z);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  for(let i = 0; i < pos.count; i++){
    const [x, y] = XF.inv(pos.getX(i), pos.getZ(i)), f = fields(x, y), h = height(x, y, f);
    pos.setY(i, h); colorAt(x, y, f, h, c).convertSRGBToLinear();
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })));
  // snowy pines
  const trees = [];
  for(let k = 0; k < 3600; k++){
    const x = 300 + rnd() * (ZS - 600), y = ZS + 400 + rnd() * (ZS - 700), f = fields(x, y);
    if(f.dP < 280 || f.dOut < OUTPOST.r + 250 || f.dMead < RAM_MEADOW.r - 200 || f.crag > .25 || f.dRidge < LYNX_RIDGE.r * .9 || Math.hypot(x - SUMMIT.x, y - SUMMIT.y) < 500) continue;
    if(f.dMine < MINE.r + 200 || f.dLake < LAKE.r + 450 || f.dLair < LAIR.r + 300 || f.dYeti < YETI_DEN.r + 150 || f.dCamps < 450 || RUNES.some(r => Math.hypot(r.x - x, r.y - y) < 300)) continue;
    const h = height(x, y, f); if(h > 8) continue;
    if(rnd() < .25 + .6 * ss(.1, .9, noise(x * .7 - 200, y * .7 + 400))) trees.push([x, y, h]);
  }
  const trunkG = new THREE.CylinderGeometry(.12, .2, 1, 6); trunkG.translate(0, .5, 0);
  const pineG = new THREE.ConeGeometry(1, 3, 7); pineG.translate(0, 2.2, 0);
  const capG = new THREE.ConeGeometry(.55, 1.1, 7); capG.translate(0, 3.3, 0);
  const trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshLambertMaterial({ color: 0x4a3324 }), trees.length);
  const pines = new THREE.InstancedMesh(pineG, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 }), trees.length);
  const caps = new THREE.InstancedMesh(capG, new THREE.MeshStandardMaterial({ color: 0xf2f6fa, flatShading: true, roughness: 1 }), trees.length);
  trees.forEach(([x, y, h], k) => {
    const w = XF(x, y), sc = .8 + rnd() * .8;
    d.position.set(w.x, h - .05, w.z); d.rotation.set(0, rnd() * 6.28, 0); d.scale.set(sc, sc * (.95 + rnd() * .4), sc); d.updateMatrix();
    trunks.setMatrixAt(k, d.matrix); pines.setMatrixAt(k, d.matrix); caps.setMatrixAt(k, d.matrix);
    pines.setColorAt(k, c.setHSL(.4 + rnd() * .05, .35, .18 + rnd() * .07));
  });
  g.add(trunks, pines, caps);
  // boulders
  const rockM = new THREE.MeshStandardMaterial({ flatShading: true, roughness: .95 });
  const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.6, 0), rockM, 360);
  let nk = 0;
  for(let k = 0; k < 3000 && nk < 360; k++){
    const x = 500 + rnd() * (ZS - 1000), y = ZS + 500 + rnd() * (ZS - 1000), f = fields(x, y);
    if(f.dP < 220 || f.dOut < OUTPOST.r + 120) continue;
    if(f.dLake < LAKE.r || f.dCamps < 300 || (f.dLair < LAIR.r * .8)) continue;
    const ridgeBias = f.ridge > .2 || f.crag > .05 || f.edge > .2 || f.mine > .3 || f.yeti > .5;
    if(!ridgeBias && rnd() < .55) continue;
    const w = XF(x, y), sc = .5 + rnd() * (ridgeBias ? 2.2 : 1.2);
    d.position.set(w.x, height(x, y, f), w.z); d.rotation.set(rnd() * 3, rnd() * 6, rnd() * 3); d.scale.set(sc, sc * (.55 + rnd() * .5), sc); d.updateMatrix();
    rocks.setMatrixAt(nk, d.matrix); rocks.setColorAt(nk++, c.setHSL(.6, .04, .42 + rnd() * .16));
  }
  rocks.count = nk; g.add(rocks);
  const sign = (text, x, y, rot) => {
    const sc = document.createElement("canvas"); sc.width = 320; sc.height = 96; const sg = sc.getContext("2d");
    sg.fillStyle = "#8a6440"; sg.fillRect(0, 0, 320, 96); sg.strokeStyle = "#4a2e1a"; sg.lineWidth = 8; sg.strokeRect(4, 4, 312, 88);
    sg.fillStyle = "#2a1a0e"; sg.font = "700 40px 'Barlow Condensed', sans-serif"; sg.textAlign = "center"; sg.textBaseline = "middle"; sg.fillText(text, 160, 50);
    const st = new THREE.CanvasTexture(sc); st.encoding = THREE.sRGBEncoding;
    const s = new THREE.Group(), post = new THREE.Mesh(new THREE.BoxGeometry(.15, 2, .15), beamM); post.position.y = 1;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2, .6), new THREE.MeshLambertMaterial({ map: st, side: THREE.DoubleSide })); board.position.y = 1.8;
    const w = XF(x, y); s.add(post, board); s.position.set(w.x, ZH(x, y), w.z); s.rotation.y = rot; g.add(s);
  };
  // Greywind Pass: two standing stones and signs on both sides
  for(const sx of [-1, 1]){
    const x = PASS.x + sx * (PASS.w + 40), y = ZS, w = XF(x, y), st = new THREE.Mesh(new THREE.BoxGeometry(1, 5, 1), new THREE.MeshStandardMaterial({ color: 0x8a8680, flatShading: true }));
    st.position.set(w.x, ZH(x, y) + 2.3, w.z); st.rotation.set(.05 * sx, rnd(), .04); g.add(st);
  }
  sign("Greywind Pass ↑", PASS.x + 220, ZS - 700, .3);
  sign("Highwatch ↑", PASS.x + 220, ZS + 500, .3);
  // Highwatch Outpost: log palisade (open north and south), watchtower, tents, brazier
  const logM = new THREE.MeshLambertMaterial({ color: 0x6a4a30 }), posts = [];
  for(let a = 0; a < Math.PI * 2; a += .09){ const s2 = Math.sin(a); if(Math.abs(s2) > .93) continue; posts.push([OUTPOST.x + Math.cos(a) * OUTPOST.r, OUTPOST.y + s2 * OUTPOST.r]); }
  const logG = new THREE.CylinderGeometry(.18, .18, 2.2, 6); logG.translate(0, 1.1, 0);
  const tipG = new THREE.ConeGeometry(.18, .4, 6); tipG.translate(0, 2.4, 0);
  const logs = new THREE.InstancedMesh(logG, logM, posts.length), tips = new THREE.InstancedMesh(tipG, logM, posts.length);
  posts.forEach(([x, y], k) => { const w = XF(x, y); d.position.set(w.x, ZH(x, y), w.z); d.rotation.set(0, 0, 0); d.scale.set(1, .85 + rnd() * .3, 1); d.updateMatrix(); logs.setMatrixAt(k, d.matrix); tips.setMatrixAt(k, d.matrix); });
  g.add(logs, tips);
  const ow = XF(OUTPOST.x, OUTPOST.y), oh = ZH(OUTPOST.x, OUTPOST.y), camp = new THREE.Group();
  const stoneM = new THREE.MeshStandardMaterial({ color: 0x8a847a, flatShading: true, roughness: .95 });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 6, 8), stoneM); tower.position.set(-4.2, 3, -3.2);
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, .3, 8), logM); deck.position.set(-4.2, 6.1, -3.2);
  const troof = new THREE.Mesh(new THREE.ConeGeometry(2.3, 1.8, 8), new THREE.MeshStandardMaterial({ color: 0x3f5f9a, flatShading: true })); troof.position.set(-4.2, 7.6, -3.2);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 2.4, 6), beamM); pole.position.set(-4.2, 9.4, -3.2);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .6), new THREE.MeshLambertMaterial({ color: 0x3f5f9a, side: THREE.DoubleSide })); flag.position.set(-3.6, 10.2, -3.2);
  camp.add(tower, deck, troof, pole, flag);
  for(const [tx, tz, hex] of [[-3.6, 3.1, 0x8a5a3a], [4.1, 2.4, 0x6f7a4a]]){
    const tent = new THREE.Mesh(new THREE.ConeGeometry(1.9, 2.6, 6), new THREE.MeshStandardMaterial({ color: hex, flatShading: true, roughness: .9 })); tent.position.set(tx, 1.3, tz);
    const snowcap = new THREE.Mesh(new THREE.ConeGeometry(.9, 1.1, 6), new THREE.MeshStandardMaterial({ color: 0xf2f6fa, flatShading: true })); snowcap.position.set(tx, 2.25, tz);
    camp.add(tent, snowcap);
  }
  for(let i = 0; i < 4; i++){ const cr = new THREE.Mesh(new THREE.BoxGeometry(.8, .8, .8), logM); cr.position.set(3.6 + (i % 2) * .9, .4 + Math.floor(i / 2) * .8, -2.8); camp.add(cr); }
  camp.position.set(ow.x, oh, ow.z); g.add(camp);
  const bw = XF(...BRAZIER), braz = new THREE.Group();
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.75, .45, .6, 10), new THREE.MeshLambertMaterial({ color: 0x3a3632 })); bowl.position.y = 1.1;
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(.18, .3, .9, 6), stone); leg.position.y = .45;
  braz.add(bowl, leg);
  for(const [s, hex] of [[1, 0xff7a20], [.6, 0xffd040]]){ const fl = new THREE.Mesh(new THREE.ConeGeometry(.45 * s, 1.3 * s, 7), new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: .92 })); fl.position.y = 1.4 + .65 * s; braz.add(fl); fireFlames.push(fl); }
  const bl = new THREE.PointLight(0xffa040, 1.3, 15, 1.6); bl.position.y = 2.2; braz.add(bl);
  braz.position.set(bw.x, ZH(...BRAZIER), bw.z); g.add(braz);
  // Skyreach Overlook: a cairn with a prayer flag at the end of the road
  const sw = XF(SUMMIT.x, SUMMIT.y), cairn = new THREE.Group();
  for(let i = 0; i < 4; i++){ const st = new THREE.Mesh(new THREE.IcosahedronGeometry(.7 - i * .13, 0), stone); st.position.y = .4 + i * .75; st.rotation.set(rnd(), rnd() * 3, rnd()); cairn.add(st); }
  const fp = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 3.6, 5), beamM); fp.position.set(.8, 1.8, 0);
  const pf = new THREE.Mesh(new THREE.PlaneGeometry(1, .5), new THREE.MeshLambertMaterial({ color: 0xc0392b, side: THREE.DoubleSide })); pf.position.set(1.3, 3.3, 0);
  cairn.add(fp, pf); cairn.position.set(sw.x, ZH(SUMMIT.x, SUMMIT.y), sw.z); g.add(cairn);
  const iceM = new THREE.MeshStandardMaterial({ color: 0xcfeaff, flatShading: true, roughness: .4, transparent: true, opacity: .92 });
  const logM2 = new THREE.MeshLambertMaterial({ color: 0x6a4a30 }), darkM = new THREE.MeshBasicMaterial({ color: 0x0a0806 });
  const place = (obj, x, y, lift = 0) => { const w = XF(x, y); obj.position.set(w.x, ZH(x, y) + lift, w.z); g.add(obj); return obj; };
  const tentAt = (x, y, hex, face) => { const tg = new THREE.Group(); const tent = new THREE.Mesh(new THREE.ConeGeometry(2, 2.8, 6), new THREE.MeshStandardMaterial({ color: hex, flatShading: true, roughness: .9 })); tent.position.y = 1.4;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(.9, 1.1, 6), new THREE.MeshStandardMaterial({ color: 0xf2f6fa, flatShading: true })); cap.position.y = 2.4; tg.add(tent, cap); tg.rotation.y = face || 0; return place(tg, x, y); };
  const fireAt = (x, y) => { const fg = new THREE.Group(); for(let k = 0; k < 7; k++){ const a = k / 7 * Math.PI * 2, st = new THREE.Mesh(new THREE.IcosahedronGeometry(.18, 0), stone); st.position.set(Math.cos(a) * .55, .08, Math.sin(a) * .55); fg.add(st); }
    for(const [sc, hex] of [[1, 0xff7a20], [.6, 0xffd040]]){ const fl = new THREE.Mesh(new THREE.ConeGeometry(.3 * sc, .95 * sc, 7), new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: .9 })); fl.position.y = .5 * sc + .1; fg.add(fl); fireFlames.push(fl); }
    const li = new THREE.PointLight(0xffa040, 1.2, 14, 1.6); li.position.y = 1.2; fg.add(li); return place(fg, x, y); };
  // Hollowdeep Mine: a timbered entrance in the rock, rails, a cart, the old lift and the deep shaft
  { const mouth = new THREE.Group(), [mx, my] = [DELVE[0].x, DELVE[0].y];
    const rockFace = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 0), new THREE.MeshStandardMaterial({ color: 0x5e5a54, flatShading: true })); rockFace.scale.set(1.3, 1.1, .9); rockFace.position.set(0, 1.5, -1.8);
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.6), darkM); hole.position.set(0, 1.3, 1.25);
    for(const sx of [-1.15, 1.15]){ const post = new THREE.Mesh(new THREE.BoxGeometry(.3, 3, .3), logM2); post.position.set(sx, 1.5, 1.3); mouth.add(post); }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.8, .35, .35), logM2); lintel.position.set(0, 3, 1.3);
    mouth.add(rockFace, hole, lintel); mouth.rotation.y = 1.9; place(mouth, mx - 120, my + 40); // the entrance faces east, toward the camp
    const railM = new THREE.MeshLambertMaterial({ color: 0x5a5650 });
    for(let k = 0; k < 9; k++){ const x = mx + 40 + k * 70, y = my - 40 - k * 25; const tie = new THREE.Mesh(new THREE.BoxGeometry(1.2, .1, .2), logM2); tie.rotation.y = .35; place(tie, x, y, .05); }
    for(const off of [-.4, .4]){ const rail = new THREE.Mesh(new THREE.BoxGeometry(9, .08, .08), railM), w0 = XF(mx + 320, my - 140); rail.position.set(w0.x + off * .3, ZH(mx + 320, my - 140) + .12, w0.z + off); rail.rotation.y = .34; g.add(rail); }
    const cart = new THREE.Group(), box = new THREE.Mesh(new THREE.BoxGeometry(1.4, .8, 1), logM2); box.position.y = .7; cart.add(box);
    for(let k = 0; k < 4; k++){ const ore = new THREE.Mesh(new THREE.IcosahedronGeometry(.22, 0), new THREE.MeshStandardMaterial({ color: 0x7fd3ff, emissive: 0x204060, flatShading: true })); ore.position.set(-.4 + k * .27, 1.15, (k % 2) * .2 - .1); cart.add(ore); }
    place(cart, mx + 260, my - 120).rotation.y = .34;
    // the Old Lift: a wooden headframe over a pit
    const lift = new THREE.Group();
    for(const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]){ const leg = new THREE.Mesh(new THREE.BoxGeometry(.25, 5, .25), logM2); leg.position.set(sx * 1.2, 2.5, sz * 1.2); leg.rotation.z = -sx * .08; leg.rotation.x = sz * .08; lift.add(leg); }
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.6, .3, 2.6), logM2); top.position.y = 5; const wheel = new THREE.Mesh(new THREE.TorusGeometry(.7, .1, 6, 16), new THREE.MeshLambertMaterial({ color: 0x3a3632 })); wheel.position.y = 5.6;
    const pit = new THREE.Mesh(new THREE.CircleGeometry(1.1, 16), darkM); pit.rotation.x = -Math.PI / 2; pit.position.y = .05; lift.add(top, wheel, pit); place(lift, DELVE[1].x, DELVE[1].y);
    // the Deep Shaft: a black hole ringed with timbers
    const shaft = new THREE.Group(), sh = new THREE.Mesh(new THREE.CircleGeometry(1.6, 20), darkM); sh.rotation.x = -Math.PI / 2; sh.position.y = .06; shaft.add(sh);
    for(let k = 0; k < 4; k++){ const tb = new THREE.Mesh(new THREE.BoxGeometry(3.6, .25, .3), logM2); tb.position.y = .15; tb.rotation.y = k * Math.PI / 4; shaft.add(tb); }
    place(shaft, DELVE[2].x, DELVE[2].y);
  }
  // explore beams over the mine sites
  DELVE.forEach((p, i) => { const beam = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, 9, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: .22, depthWrite: false, blending: THREE.AdditiveBlending })); beam.visible = false; place(beam, p.x, p.y, 4.5); EXPLORE_FX.push({ quest: "delve", i, beam }); });
  // Old Ketil's camp
  tentAt(KETIL_CAMP.x + 120, KETIL_CAMP.y + 60, 0x8a6a4a, .4);
  for(let k = 0; k < 3; k++){ const cr = new THREE.Mesh(new THREE.BoxGeometry(.8, .8, .8), logM2); place(cr, KETIL_CAMP.x - 60 + k * 70, KETIL_CAMP.y + 170, .4); }
  // Glassmere: a sheet of ice with a few cracks of open water
  { const ice = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r * ZSC, 48), new THREE.MeshStandardMaterial({ color: 0xd8f0ff, roughness: .15, metalness: .1, transparent: true, opacity: .85 })); ice.rotation.x = -Math.PI / 2; place(ice, LAKE.x, LAKE.y, .04);
    for(let k = 0; k < 5; k++){ const crack = new THREE.Mesh(new THREE.PlaneGeometry(.12, 2 + rnd() * 3), new THREE.MeshBasicMaterial({ color: 0x4f8ab0, transparent: true, opacity: .7 })); crack.rotation.set(-Math.PI / 2, 0, rnd() * 3); const a = rnd() * 6.28, rr = rnd() * LAKE.r * .7; place(crack, LAKE.x + Math.cos(a) * rr, LAKE.y + Math.sin(a) * rr, .06); } }
  // Whitemane's Hollow: a ring of boulders and old bones
  for(let a = 0; a < Math.PI * 2; a += .35){ if(Math.abs(Math.atan2(Math.sin(a - 3.6), Math.cos(a - 3.6))) < .5) continue; const rr = YETI_DEN.r + 40 + rnd() * 80, b = new THREE.Mesh(new THREE.IcosahedronGeometry(.9, 0), new THREE.MeshStandardMaterial({ color: 0x8a8a92, flatShading: true })); const sc = 1.2 + rnd() * 1.4; b.scale.set(sc, sc * .8, sc); place(b, YETI_DEN.x + Math.cos(a) * rr, YETI_DEN.y + Math.sin(a) * rr, .3); }
  const boneM = new THREE.MeshLambertMaterial({ color: 0xece4d0 });
  for(let k = 0; k < 10; k++){ const a = rnd() * 6.28, rr = rnd() * YETI_DEN.r * .7, bone = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .7 + rnd() * .5, 5), boneM); bone.rotation.set(Math.PI / 2, 0, rnd() * 6); place(bone, YETI_DEN.x + Math.cos(a) * rr, YETI_DEN.y + Math.sin(a) * rr, .07); }
  // Yrsa's Watch: a tent, a fire and a lookout flag; the ring shows while you defend it
  tentAt(YRSA_CAMP.x - 120, YRSA_CAMP.y + 40, 0x4a6a34, -.6); fireAt(...YRSA_FIRE);
  { const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 4, 6), beamM), flag = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .6), new THREE.MeshLambertMaterial({ color: 0x4a6a34, side: THREE.DoubleSide })); flag.position.set(.6, 1.6, 0); flagPole.add(flag); place(flagPole, YRSA_CAMP.x - 260, YRSA_CAMP.y - 120, 2);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd84a, transparent: true, opacity: .7, depthWrite: false })); ring.visible = false; place(ring, YRSA_CAMP.x, YRSA_CAMP.y, .08); DEFEND_FX.brood = ring; }
  // the warding runes: standing stones that glow blue once awakened
  RUNES.forEach(r => {
    const grp = new THREE.Group(), stoneM = new THREE.MeshStandardMaterial({ color: 0x7a7a84, flatShading: true });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(.9, 2.6, .5), stoneM); slab.position.y = 1.3; slab.rotation.y = rnd();
    const flame = new THREE.Group(), glyph = new THREE.Mesh(new THREE.PlaneGeometry(.5, .9), new THREE.MeshBasicMaterial({ color: 0x7fe8ff, transparent: true, opacity: .95, side: THREE.DoubleSide }));
    glyph.position.set(0, 1.5, .27); glyph.rotation.y = slab.rotation.y; const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMat.map, color: 0x7fd3ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.set(3, 3, 1); gl.position.y = 1.6;
    const li = new THREE.PointLight(0x7fd3ff, 1, 12, 1.6); li.position.y = 2; flame.add(glyph, gl, li); flame.visible = false;
    const hint = new THREE.Sprite(glowMat); hint.scale.set(2.4, 2.4, 1); hint.position.y = 1.6; hint.visible = false;
    grp.add(slab, flame, hint); place(grp, r.x, r.y);
    USE_FX[USE_POINTS.indexOf(r)] = { flame, hint };
  });
  // The Wyrm's Crown: a ring of jagged ice spires (open toward Yrsa's Watch), bones and a giant skull
  { const gapA = Math.atan2(YRSA_CAMP.y - LAIR.y, YRSA_CAMP.x - LAIR.x);
    for(let a = 0; a < Math.PI * 2; a += .16){
      if(Math.abs(Math.atan2(Math.sin(a - gapA), Math.cos(a - gapA))) < .35) continue;
      const rr = LAIR.r + 60 + rnd() * 120, hgt = 4 + rnd() * 7, sp = new THREE.Mesh(new THREE.ConeGeometry(.6 + rnd() * .8, hgt, 5), iceM);
      sp.rotation.set((rnd() - .5) * .3, rnd() * 3, (rnd() - .5) * .3); place(sp, LAIR.x + Math.cos(a) * rr, LAIR.y + Math.sin(a) * rr, hgt / 2 - .3);
    }
    const skull = new THREE.Group(), boneW = new THREE.MeshStandardMaterial({ color: 0xece4d0, flatShading: true });
    const cranium = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 0), boneW); cranium.scale.set(1.6, 1, 1.1); cranium.position.y = 1;
    const snout = new THREE.Mesh(new THREE.BoxGeometry(2.6, .8, 1.2), boneW); snout.position.set(2.4, .6, 0);
    const eye = new THREE.Mesh(new THREE.CircleGeometry(.35, 8), darkM); eye.position.set(1.2, 1.3, .95);
    for(const sz of [-.7, .7]){ const horn = new THREE.Mesh(new THREE.ConeGeometry(.3, 2.2, 6), boneW); horn.position.set(-1, 2.2, sz); horn.rotation.z = .8; skull.add(horn); }
    skull.add(cranium, snout, eye); skull.rotation.y = 2.2; place(skull, LAIR.x - 420, LAIR.y + 360);
    for(let k = 0; k < 7; k++){ const rib = new THREE.Mesh(new THREE.TorusGeometry(1.4 - k * .08, .12, 5, 12, Math.PI), boneW); rib.rotation.set(0, .5, 0); place(rib, LAIR.x + 300 + k * 50, LAIR.y + 420 - k * 30, 0); }
  }
  // picture of the Peaks for the maps
  const MS = 256; PEAKIMG = document.createElement("canvas"); PEAKIMG.width = PEAKIMG.height = MS;
  const mg = PEAKIMG.getContext("2d"), img = mg.createImageData(MS, MS);
  for(let py = 0; py < MS; py++) for(let px = 0; px < MS; px++){
    const x = (px + .5) / MS * ZS, y = WH - (py + .5) / MS * ZS, f = fields(x, y), h = height(x, y, f);
    colorAt(x, y, f, h, c);
    t2.setHSL(.08, .3, .6); c.lerp(t2, Math.max(f.path, f.out * .6));
    const o = (py * MS + px) * 4; img.data[o] = c.r * 255; img.data[o + 1] = c.g * 255; img.data[o + 2] = c.b * 255; img.data[o + 3] = 255;
  }
  mg.putImageData(img, 0, 0); ZONE_PICS.peaks = PEAKIMG;
  const toM = (x, y) => [x / ZS * MS, (WH - y) / ZS * MS];
  mg.fillStyle = "rgba(20,48,34,.55)"; for(const [x, y] of trees){ const [a, b] = toM(x, y); mg.fillRect(a - .7, b - .7, 1.5, 1.5); }
  { const [a, b] = toM(OUTPOST.x, OUTPOST.y); mg.strokeStyle = "#5a3a22"; mg.lineWidth = 1.5; mg.beginPath(); mg.arc(a, b, OUTPOST.r / ZS * MS, 0, Math.PI * 2); mg.stroke(); }
  mg.strokeStyle = "#3a2414"; mg.lineWidth = 1;
  for(const [x, y, col] of [[BRAZIER[0], BRAZIER[1], "#ff9a40"], [OUTPOST.x - 230, OUTPOST.y + 180, "#a8a296"], [SUMMIT.x, SUMMIT.y, "#c0392b"]]){ const [a, b] = toM(x, y); mg.fillStyle = col; mg.fillRect(a - 2.5, b - 2.5, 5, 5); mg.strokeRect(a - 2.5, b - 2.5, 5, 5); }
  // snowfall around the camera while you're in the Peaks
  const N = 900, sp = new Float32Array(N * 3);
  for(let i = 0; i < N; i++){ sp[i * 3] = (rnd() - .5) * 60; sp[i * 3 + 1] = rnd() * 30; sp[i * 3 + 2] = (rnd() - .5) * 60; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  const flakes = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: .18, transparent: true, opacity: .85, depthWrite: false }));
  flakes.frustumCulled = false; flakes.visible = false; scene.add(flakes);
  SNOW = { flakes, drift: 0 };
}
// Cold fog, sky and snowfall in the Peaks. k goes from 0 (Vale) to 1 (Peaks) across the pass.
const SKY_VALE = window.THREE ? new THREE.Color(0x9ccbe8) : null, SKY_PEAKS = window.THREE ? new THREE.Color(0xc6d4e2) : null;
function updateClimate(dt, zoneY, look, zoneX = 0){
  const jungle = inJungle(zoneX, zoneY), inside = zoneY > DZ && !jungle; cathedralClimate(inside);
  if(jungle) jungleClimate();
  if(inside || jungle){ if(SNOW) SNOW.flakes.visible = false; return; }
  const k = Math.max(0, Math.min(1, (zoneY - (ZS - 600)) / 1400));
  if(scene.fog){ scene.fog.color.copy(SKY_VALE).lerp(SKY_PEAKS, k); scene.background.copy(scene.fog.color); }
  if(!SNOW) return;
  const f = SNOW.flakes; f.visible = k > .05; f.material.opacity = .85 * k;
  if(!f.visible) return;
  SNOW.drift += dt;
  const p = f.geometry.attributes.position, a = p.array;
  for(let i = 0; i < a.length; i += 3){
    a[i + 1] -= dt * (2.2 + (i % 7) * .25); a[i] += Math.sin(SNOW.drift * .8 + i) * dt * .4;
    if(a[i + 1] < 0) a[i + 1] += 30;
  }
  p.needsUpdate = true; f.position.set(look.x, look.y - 6, look.z);
}
