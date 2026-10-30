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
    return { dP, dOut, dMead, dRidge, crag, edge, south, path: 1 - ss(110, 240, dP), out: 1 - ss(OUTPOST.r, OUTPOST.r + 300, dOut),
      mead: 1 - ss(RAM_MEADOW.r - 100, RAM_MEADOW.r + 200, dMead), ridge: 1 - ss(LYNX_RIDGE.r * .5, LYNX_RIDGE.r, dRidge), sum: 1 - ss(250, 450, dSum) };
  };
  const raw = (x, y, f) => {
    let h = noise(x, y) * 1.8 + .7 * noise(x * 2.1 + 300, y * 1.9 - 700) + .6;
    const flat = Math.max(f.path * .75, f.out, f.mead * .8, f.ridge * .45, f.sum);
    h = h * (1 - flat) + .3 * flat;
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
    t2.setHSL(.6, .25, .94); out.lerp(t2, Math.max(ss(snowLine(y), snowLine(y) + 2, h + n * .8), ss(.5, .85, noise(x * .9 + 77, y * .9 - 31)) * .65 * (1 - f.path)));
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
    const ridgeBias = f.ridge > .2 || f.crag > .05 || f.edge > .2;
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
function updateClimate(dt, zoneY, look){
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
