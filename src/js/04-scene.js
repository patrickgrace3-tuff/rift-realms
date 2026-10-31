"use strict";
// three.js setup and the procedural Sunhollow Vale terrain, props and map image (the Peaks are in 04b-peaks.js).

/* ---------- Three.js setup ---------- */
let HEMI = null, SUN = null, renderer, scene, camera, glowMat, ringGeo, discGeo, zone, fireLight, fireFlames = [];
const cv = $("#cv"), ov = $("#ov"), octx = ov.getContext("2d");
let VW = innerWidth, VH = innerHeight, dpr = 1, camDist = 22;
const raycaster = window.THREE ? new THREE.Raycaster() : null;
const texCache = new Map();
function iconTexture(url, ring){
  const key = url + ring; if(texCache.has(key)) return texCache.get(key);
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  const draw = im => { g.clearRect(0, 0, 128, 128); g.save(); g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.clip();
    if(im) g.drawImage(im, -10, -10, 148, 148); else { g.fillStyle = "#24304a"; g.fill(); } g.restore();
    g.lineWidth = 8; g.strokeStyle = ring; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.stroke(); };
  draw(null);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  loadCORS(url).then(im => { if(im){ try{ draw(im); t.needsUpdate = true; }catch(e){} } });
  texCache.set(key, t); return t;
}
function spriteMat(url, ring){ return new THREE.SpriteMaterial({ map: iconTexture(url, ring), transparent: true, depthWrite: false }); }
function initThree(){
  renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
  renderer.outputEncoding = THREE.sRGBEncoding;
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x9ccbe8);
  camera = new THREE.PerspectiveCamera(38, 1, 0.5, 600);
  HEMI = new THREE.HemisphereLight(0xdff1ff, 0x5a6a3a, 1.05); scene.add(HEMI);
  const sun = SUN = new THREE.DirectionalLight(0xfff1d6, 1.0); sun.position.set(-20, 30, 12); scene.add(sun);
  const glc = document.createElement("canvas"); glc.width = glc.height = 64; const gg = glc.getContext("2d");
  const grad = gg.createRadialGradient(32, 32, 0, 32, 32, 32); grad.addColorStop(0, "rgba(255,236,180,.9)"); grad.addColorStop(1, "rgba(255,200,90,0)");
  gg.fillStyle = grad; gg.fillRect(0, 0, 64, 64);
  glowMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(glc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  ringGeo = new THREE.RingGeometry(.9, 1, 64); ringGeo.rotateX(-Math.PI / 2);
  discGeo = new THREE.CircleGeometry(1, 48); discGeo.rotateX(-Math.PI / 2);
  resize();
}
function resize(){
  dpr = Math.min(2, devicePixelRatio || 1); VW = innerWidth; VH = innerHeight;
  if(renderer){ renderer.setPixelRatio(dpr); renderer.setSize(VW, VH, false); camera.aspect = VW / VH; camera.updateProjectionMatrix(); }
  ov.width = VW * dpr; ov.height = VH * dpr;
}
addEventListener("resize", resize);

/* ---------- Building Sunhollow Vale ---------- */
let ZH = null;  // height sampler
let MAPIMG = null; // north-up picture of the zone for the minimap and world map
// quest visuals the render loop switches on and off: USE_FX lines up with USE_POINTS,
// EXPLORE_FX holds { quest, i, beam } for places to explore, DEFEND_FX maps a defend quest to its ring
let USE_FX = [], EXPLORE_FX = [], DEFEND_FX = {};
const NODE_TEX = {};
function nodeTexture(kind){
  if(!NODE_TEX[kind]){ const c = document.createElement("canvas"); c.width = c.height = 64; (NODE_ART[kind] || drawFlower)(c.getContext("2d")); NODE_TEX[kind] = new THREE.CanvasTexture(c); NODE_TEX[kind].encoding = THREE.sRGBEncoding; }
  return NODE_TEX[kind];
}
function buildZone(){
  const segD = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))); return Math.hypot(px - ax - t * dx, py - ay - t * dy); };
  const polyD = (px, py, pl) => { let m = 1e9; for(let i = 0; i < pl.length - 1; i++) m = Math.min(m, segD(px, py, pl[i][0], pl[i][1], pl[i + 1][0], pl[i + 1][1])); return m; };
  const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const noise = (x, y) => Math.sin(x * .0013 + 1.3) * Math.cos(y * .0011 + .7) + .5 * Math.sin(x * .0029 - y * .0031 + 2.1) + .25 * Math.sin(x * .0067 + y * .0053);
  const fields = (x, y) => {
    let dP = 1e9; for(const p of PATHS) dP = Math.min(dP, polyD(x, y, p));
    const dV = Math.hypot(x - VILLAGE.x, y - VILLAGE.y), dPa = Math.hypot(x - PASTURE.x, y - PASTURE.y), dPo = Math.hypot(x - POND.x, y - POND.y);
    const dDen = Math.hypot(x - DEN.x, y - DEN.y), dCamp = Math.min(Math.hypot(x - CAMP.x, y - CAMP.y), Math.hypot(x - CABIN.x, y - CABIN.y)), dTower = Math.hypot(x - TOWER.x, y - TOWER.y);
    const dE = Math.min(x, y, ZS - x, ZS - y);
    const gap = (1 - ss(PASS.w, PASS.w + 600, Math.abs(x - PASS.x))) * ss(ZS - 1800, ZS - 700, y); // Greywind Pass cuts the north ridge
    const dAr = Math.hypot(x - ARENA.x, y - ARENA.y);
    return { dP, dV, dPa, dPo, dE, dDen, dCamp, den: 1 - ss(DEN.r * .6, DEN.r + 80, dDen), camp: 1 - ss(260, 460, dCamp), dTower, tow: 1 - ss(500, 760, dTower), path: 1 - ss(110, 230, dP), vil: 1 - ss(VILLAGE.r * .7, VILLAGE.r, dV), past: 1 - ss(PASTURE.r - 50, PASTURE.r + 150, dPa),
      pond: 1 - ss(POND.r * .5, POND.r, dPo), edge: (1 - ss(250, 900, dE)) * (1 - gap), dAr, arena: 1 - ss(ARENA.r * .75, ARENA.r + 120, dAr) };
  };
  const height = (x, y, f) => {
    let h = noise(x, y) * 1.1 + .4 * noise(x * 2.3 + 900, y * 2.1 - 400);
    const flat = Math.max(f.vil, f.past * .8, f.path * .6, f.den * .9, f.camp, f.tow, f.arena);
    h = h * (1 - flat) + .15 * flat;
    h -= f.pond * 1.6;
    h += Math.pow(f.edge, 1.6) * 11 * (.8 + .4 * noise(x * 3, y * 3));
    return h;
  };
  ZH = (x, y) => height(x, y, fields(x, y));
  const g = new THREE.Group();
  // ground
  const geo = new THREE.PlaneGeometry(ZONE_W, ZONE_W, 200, 200); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color(), t2 = new THREE.Color();
  for(let i = 0; i < pos.count; i++){
    const [x, y] = XF.inv(pos.getX(i), pos.getZ(i)), f = fields(x, y), h = height(x, y, f), n = noise(x * 3.7, y * 3.3);
    pos.setY(i, h);
    c.setHSL(.26 + .025 * n, .52, .36 + .05 * n);
    t2.setHSL(.24, .5, .45 + .03 * n); c.lerp(t2, f.past * .6);
    t2.setHSL(.09, .3, .46 + .03 * n); c.lerp(t2, Math.max(f.path * .95, f.vil * .55, f.tow * .6));
    t2.setHSL(.07, .35, .27 + .04 * n); c.lerp(t2, f.den * .85);
    t2.setHSL(.11, .45, .62 + .04 * n); c.lerp(t2, f.arena * .85);
    t2.setHSL(.13, .35, .3); c.lerp(t2, f.pond);
    t2.setHSL(.08, .12, .38 + .05 * n); c.lerp(t2, ss(1.8, 4, h) * f.edge);
    t2.setHSL(.6, .15, .93); c.lerp(t2, ss(7.5, 9.5, h));
    c.convertSRGBToLinear(); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })));
  // pond water
  const pw = XF(POND.x, POND.y), water = new THREE.Mesh(new THREE.CircleGeometry(POND.r * ZSC * 1.02, 48), new THREE.MeshBasicMaterial({ color: 0x4fa3c8, transparent: true, opacity: .78 }));
  water.rotation.x = -Math.PI / 2; water.position.set(pw.x, -.55, pw.z); g.add(water);
  const lily = new THREE.InstancedMesh(new THREE.CircleGeometry(.35, 10), new THREE.MeshLambertMaterial({ color: 0x4f8a3a, side: THREE.DoubleSide }), 14);
  let seed = 4242; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const d = new THREE.Object3D();
  for(let i = 0; i < 14; i++){ const a = rnd() * 6.28, r = rnd() * POND.r * .75, w = XF(POND.x + Math.cos(a) * r, POND.y + Math.sin(a) * r); d.position.set(w.x, -.53, w.z); d.rotation.set(-Math.PI / 2, 0, rnd() * 6); d.scale.setScalar(.7 + rnd() * .6); d.updateMatrix(); lily.setMatrixAt(i, d.matrix); }
  g.add(lily);
  const clearings = [...LOOKOUTS, ...BEACONS].map(p => [p.x, p.y, 320]).concat([[TOWER.x, TOWER.y, 850], [PINES.x, PINES.y, 330]]);
  const inClear = (x, y) => clearings.some(([a, b, r]) => Math.hypot(x - a, y - b) < r);
  // trees, denser toward the edges and in the woods east and south
  const trees = [];
  for(let k = 0; k < 4200; k++){
    const x = 300 + rnd() * (ZS - 600), y = 300 + rnd() * (ZS - 600), f = fields(x, y);
    if(f.dAr < ARENA.r + 250 || f.dP < 260 || f.dV < VILLAGE.r + 250 || f.dPa < PASTURE.r + 260 || f.dPo < POND.r + 220 || f.dDen < DEN.r + 120 || f.dCamp < 420 || inClear(x, y)) continue;
    const h = height(x, y, f); if(h > 7.5) continue;
    const dens = .12 + .75 * Math.max(f.edge, ss(.2, 1, noise(x * .8 + 500, y * .8 - 300))) + (Math.hypot(x - PINES.x, y - PINES.y) < PINES.r + 450 ? .45 : 0);
    if(rnd() < dens) trees.push([x, y, h]);
  }
  const trunkG = new THREE.CylinderGeometry(.14, .22, 1, 6); trunkG.translate(0, .5, 0);
  const crownG = new THREE.ConeGeometry(1.05, 2.6, 7); crownG.translate(0, 2.1, 0);
  const roundG = new THREE.IcosahedronGeometry(1.15, 0); roundG.translate(0, 2.1, 0);
  const trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshLambertMaterial({ color: 0x5a3c26 }), trees.length);
  const cones = new THREE.InstancedMesh(crownG, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 }), trees.length);
  const rounds = new THREE.InstancedMesh(roundG, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 }), trees.length);
  let nc = 0, nr = 0;
  trees.forEach(([x, y, h], k) => {
    const w = XF(x, y), sc = .85 + rnd() * .8;
    d.position.set(w.x, h - .05, w.z); d.rotation.set(0, rnd() * 6.28, 0); d.scale.set(sc, sc * (.9 + rnd() * .35), sc); d.updateMatrix();
    trunks.setMatrixAt(k, d.matrix);
    if(rnd() < .55){ cones.setMatrixAt(nc, d.matrix); cones.setColorAt(nc++, c.setHSL(.36 + rnd() * .06, .45, .24 + rnd() * .08)); }
    else { rounds.setMatrixAt(nr, d.matrix); rounds.setColorAt(nr++, c.setHSL(.25 + rnd() * .07, .5, .32 + rnd() * .1)); }
  });
  cones.count = nc; rounds.count = nr; g.add(trunks, cones, rounds);
  // flowers and rocks
  const flowers = new THREE.InstancedMesh(new THREE.OctahedronGeometry(.11), new THREE.MeshBasicMaterial(), 900);
  let nf = 0;
  for(let k = 0; k < 5000 && nf < 900; k++){
    const x = 700 + rnd() * (ZS - 1400), y = 700 + rnd() * (ZS - 1400), f = fields(x, y);
    if(f.dAr < ARENA.r + 100 || f.dP < 160 || f.dV < 700 || f.pond > .1 || f.edge > .3 || f.dDen < DEN.r + 50 || f.dCamp < 300) continue;
    const w = XF(x, y); d.position.set(w.x, height(x, y, f) + .1, w.z); d.rotation.set(0, 0, 0); d.scale.setScalar(.8 + rnd() * .6); d.updateMatrix();
    flowers.setMatrixAt(nf, d.matrix); flowers.setColorAt(nf++, c.set([0xffe066, 0xff8fb0, 0xffffff, 0xb59cff][Math.floor(rnd() * 4)]));
  }
  flowers.count = nf; g.add(flowers);
  const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.5, 0), new THREE.MeshStandardMaterial({ flatShading: true, roughness: .9 }), 220);
  let nk = 0;
  for(let k = 0; k < 2000 && nk < 220; k++){
    const x = 400 + rnd() * (ZS - 800), y = 400 + rnd() * (ZS - 800), f = fields(x, y);
    if(f.dAr < ARENA.r + 100 || f.dP < 200 || f.dV < VILLAGE.r || f.dPa < PASTURE.r + 100 || f.pond > .2 || f.dDen < DEN.r + 60 || f.dCamp < 350) continue;
    const w = XF(x, y), sc = .4 + rnd() * 1.3; d.position.set(w.x, height(x, y, f), w.z); d.rotation.set(rnd() * 3, rnd() * 6, rnd() * 3); d.scale.set(sc, sc * (.5 + rnd() * .5), sc); d.updateMatrix();
    rocks.setMatrixAt(nk, d.matrix); rocks.setColorAt(nk++, c.setHSL(.08, .06, .45 + rnd() * .15));
  }
  rocks.count = nk; g.add(rocks);
  // pasture fence with a gate facing the village
  const gateA = Math.atan2(VILLAGE.y - PASTURE.y, VILLAGE.x - PASTURE.x), posts = [];
  for(let a = 0; a < Math.PI * 2; a += .1){ let da = Math.abs(Math.atan2(Math.sin(a - gateA), Math.cos(a - gateA))); if(da < .14) continue; posts.push([PASTURE.x + Math.cos(a) * PASTURE.r, PASTURE.y + Math.sin(a) * PASTURE.r]); }
  const wood = new THREE.MeshLambertMaterial({ color: 0x8a6440 });
  const postM = new THREE.InstancedMesh(new THREE.BoxGeometry(.16, 1, .16).translate(0, .5, 0), wood, posts.length);
  const railM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, .1, .07), wood, posts.length * 2);
  let ri = 0;
  posts.forEach(([x, y], k) => {
    const w = XF(x, y), h = ZH(x, y); d.position.set(w.x, h, w.z); d.rotation.set(0, 0, 0); d.scale.setScalar(1); d.updateMatrix(); postM.setMatrixAt(k, d.matrix);
    const nx = posts[(k + 1) % posts.length], wn = XF(nx[0], nx[1]), len = Math.hypot(wn.x - w.x, wn.z - w.z);
    if(len > 2) return;
    for(const ry of [.45, .8]){ d.position.set((w.x + wn.x) / 2, h + ry, (w.z + wn.z) / 2); d.rotation.set(0, -Math.atan2(wn.z - w.z, wn.x - w.x), 0); d.scale.set(len, 1, 1); d.updateMatrix(); railM.setMatrixAt(ri++, d.matrix); }
  });
  railM.count = ri; g.add(postM, railM);
  // houses
  const wallM = new THREE.MeshLambertMaterial({ color: 0xe8dcc0 }), beamM = new THREE.MeshLambertMaterial({ color: 0x6a4428 }), doorM = new THREE.MeshLambertMaterial({ color: 0x4a2e1a }), winM = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const roofCols = [0xb4472f, 0x7a5a9a, 0x3f7a8a, 0xb4472f];
  HOUSES.forEach(([x, y, rot], k) => {
    const h = new THREE.Group(), w = XF(x, y);
    const walls = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 4), wallM); walls.position.y = 1.5;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.3, 2.6, 4), new THREE.MeshStandardMaterial({ color: roofCols[k % 4], flatShading: true, roughness: .8 })); roof.position.y = 4.3; roof.rotation.y = Math.PI / 4; roof.scale.set(1.15, 1, .95);
    const door = new THREE.Mesh(new THREE.BoxGeometry(.9, 1.7, .1), doorM); door.position.set(0, .85, 2.02);
    const w1 = new THREE.Mesh(new THREE.BoxGeometry(.8, .7, .08), winM); w1.position.set(-1.6, 1.8, 2.02);
    const w2 = w1.clone(); w2.position.x = 1.6;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(5.1, .2, 4.1), beamM); beam.position.y = 3;
    const chim = new THREE.Mesh(new THREE.BoxGeometry(.6, 1.6, .6), new THREE.MeshLambertMaterial({ color: 0x8a8580 })); chim.position.set(1.4, 4.6, -.6);
    h.add(walls, roof, door, w1, w2, beam, chim);
    h.position.set(w.x, ZH(x, y), w.z);
    h.rotation.y = Math.atan2(XF(VILLAGE.x, VILLAGE.y).x - w.x, XF(VILLAGE.x, VILLAGE.y).z - w.z) + rot * .2;
    g.add(h);
  });
  // well
  const ww = XF(...WELL), well = new THREE.Group();
  const stone = new THREE.MeshLambertMaterial({ color: 0x9a948a });
  const wbase = new THREE.Mesh(new THREE.CylinderGeometry(.9, 1, .9, 12, 1, true), stone); wbase.position.y = .45; well.add(wbase);
  const wtop = new THREE.Mesh(new THREE.CircleGeometry(.85, 16), new THREE.MeshBasicMaterial({ color: 0x1d3a4a })); wtop.rotation.x = -Math.PI / 2; wtop.position.y = .6; well.add(wtop);
  for(const sx of [-.85, .85]){ const p = new THREE.Mesh(new THREE.BoxGeometry(.15, 2, .15), beamM); p.position.set(sx, 1.4, 0); well.add(p); }
  const wroof = new THREE.Mesh(new THREE.ConeGeometry(1.4, .9, 4), new THREE.MeshStandardMaterial({ color: 0xb4472f, flatShading: true })); wroof.position.y = 2.75; wroof.rotation.y = Math.PI / 4; well.add(wroof);
  well.position.set(ww.x, ZH(...WELL), ww.z); g.add(well);
  // Peddler Osric's market stall: a counter with potion bottles under a striped awning
  { const sw = XF(STALL.x, STALL.y), stall = new THREE.Group(), npc = NPCS.find(n => n.shop);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1, 1.1), beamM); counter.position.set(0, .5, 0);
    for(const sx of [-1.5, 1.5]) for(const sz of [-.5, .5]){ const p = new THREE.Mesh(new THREE.BoxGeometry(.12, 2.6, .12), beamM); p.position.set(sx, 1.3, sz); stall.add(p); }
    const sc2 = document.createElement("canvas"); sc2.width = 64; sc2.height = 16; const sg2 = sc2.getContext("2d");
    for(let i = 0; i < 8; i++){ sg2.fillStyle = i % 2 ? "#f2e8d0" : "#8a3a5a"; sg2.fillRect(i * 8, 0, 8, 16); }
    const awnTex = new THREE.CanvasTexture(sc2); awnTex.encoding = THREE.sRGBEncoding;
    const awning = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.6), new THREE.MeshLambertMaterial({ map: awnTex, side: THREE.DoubleSide })); awning.position.set(0, 2.7, .1); awning.rotation.x = -Math.PI / 2 + .35;
    stall.add(counter, awning);
    const bottle = new THREE.SphereGeometry(.13, 8, 6), red = new THREE.MeshLambertMaterial({ color: 0xc0392b, emissive: 0x401010 });
    for(let i = 0; i < 7; i++){ const b2 = new THREE.Mesh(bottle, red); b2.position.set(-1.2 + i * .4, 1.12, (i % 2 ? .2 : -.15)); stall.add(b2); }
    for(let i = 0; i < 2; i++){ const cr = new THREE.Mesh(new THREE.BoxGeometry(.7, .7, .7), beamM); cr.position.set(2.1, .35 + i * .7, -.4); stall.add(cr); }
    stall.position.set(sw.x, ZH(STALL.x, STALL.y), sw.z);
    const nw = XF(npc.x, npc.y); stall.rotation.y = Math.atan2(nw.x - sw.x, nw.z - sw.z);
    g.add(stall); }
  // the Champion's Ring: a sandy yard with a rope fence, banners and a weapon rack
  { const postM = new THREE.MeshLambertMaterial({ color: 0x6a4428 }), ropeM = new THREE.MeshLambertMaterial({ color: 0xc8b48a }), bannerM = new THREE.MeshLambertMaterial({ color: 0xb8322a, side: THREE.DoubleSide });
    const n = 28, gapA = Math.atan2(NPCS.find(p => p.arena).y - ARENA.y, NPCS.find(p => p.arena).x - ARENA.x);
    const pts = []; for(let i = 0; i < n; i++){ const a = i / n * Math.PI * 2; if(Math.abs(Math.atan2(Math.sin(a - gapA), Math.cos(a - gapA))) < .25) { pts.push(null); continue; } pts.push([ARENA.x + Math.cos(a) * (ARENA.r + 40), ARENA.y + Math.sin(a) * (ARENA.r + 40)]); }
    pts.forEach((p, i) => {
      if(!p) return; const w = XF(...p), h = ZH(...p);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.12, .14, 1.4, 6), postM); post.position.set(w.x, h + .7, w.z); g.add(post);
      if(i % 7 === 0){ const ban = new THREE.Mesh(new THREE.PlaneGeometry(.7, 1.1), bannerM); ban.position.set(w.x, h + 1.9, w.z); ban.rotation.y = -Math.atan2(p[1] - ARENA.y, p[0] - ARENA.x); const pole = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 2.6, 5), postM); pole.position.set(w.x, h + 1.3, w.z); g.add(ban, pole); }
      const q = pts[(i + 1) % n]; if(!q) return; const wq = XF(...q), len = Math.hypot(wq.x - w.x, wq.z - w.z);
      const rope = new THREE.Mesh(new THREE.BoxGeometry(len, .06, .06), ropeM); rope.position.set((w.x + wq.x) / 2, h + 1.15, (w.z + wq.z) / 2); rope.rotation.y = -Math.atan2(wq.z - w.z, wq.x - w.x); g.add(rope);
    });
    const rack = new THREE.Group(), rw = XF(ARENA.x - ARENA.r + 140, ARENA.y + 420);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(2, .12, .12), postM); bar2.position.y = 1.3; rack.add(bar2);
    for(const sx of [-.9, .9]){ const leg = new THREE.Mesh(new THREE.BoxGeometry(.12, 1.4, .12), postM); leg.position.set(sx, .7, 0); rack.add(leg); }
    for(let k = 0; k < 4; k++){ const blade = new THREE.Mesh(new THREE.BoxGeometry(.08, 1.4, .02), new THREE.MeshStandardMaterial({ color: 0xc0ccdc, metalness: .6, roughness: .4 })); blade.position.set(-.6 + k * .4, .9, .1); blade.rotation.z = .08; rack.add(blade); }
    rack.position.set(rw.x, ZH(ARENA.x - ARENA.r + 140, ARENA.y + 420), rw.z); rack.rotation.y = .6; g.add(rack); }
  // campfire
  const cw = XF(...CAMPFIRE), fire = new THREE.Group();
  for(let i = 0; i < 8; i++){ const a = i / 8 * Math.PI * 2, s = new THREE.Mesh(new THREE.IcosahedronGeometry(.2, 0), stone); s.position.set(Math.cos(a) * .6, .1, Math.sin(a) * .6); fire.add(s); }
  for(let i = 0; i < 3; i++){ const l = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 1, 6), beamM); l.rotation.z = Math.PI / 2; l.rotation.y = i * 1.05; l.position.y = .15; fire.add(l); }
  for(const [s, cHex] of [[1, 0xff7a20], [.6, 0xffd040]]){ const fl = new THREE.Mesh(new THREE.ConeGeometry(.32 * s, 1 * s, 7), new THREE.MeshBasicMaterial({ color: cHex, transparent: true, opacity: .9 })); fl.position.y = .5 * s + .15; fire.add(fl); fireFlames.push(fl); }
  fireLight = new THREE.PointLight(0xffa040, 1.4, 16, 1.6); fireLight.position.y = 1.2; fire.add(fireLight);
  const bench = new THREE.Mesh(new THREE.BoxGeometry(1.8, .3, .5), beamM); bench.position.set(0, .2, -1.4); fire.add(bench);
  fire.position.set(cw.x, ZH(...CAMPFIRE), cw.z); g.add(fire);
  // signpost toward the pasture
  const sc = document.createElement("canvas"); sc.width = 256; sc.height = 96; const sg = sc.getContext("2d");
  sg.fillStyle = "#8a6440"; sg.fillRect(0, 0, 256, 96); sg.strokeStyle = "#4a2e1a"; sg.lineWidth = 8; sg.strokeRect(4, 4, 248, 88);
  sg.fillStyle = "#2a1a0e"; sg.font = "700 44px 'Barlow Condensed', sans-serif"; sg.textAlign = "center"; sg.textBaseline = "middle"; sg.fillText("Pasture", 128, 50);
  const st = new THREE.CanvasTexture(sc); st.encoding = THREE.sRGBEncoding;
  const sp = [3420, 4380], sw = XF(...sp), sign = new THREE.Group();
  const spost = new THREE.Mesh(new THREE.BoxGeometry(.15, 2, .15), beamM); spost.position.y = 1;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.6, .6), new THREE.MeshLambertMaterial({ map: st, side: THREE.DoubleSide })); board.position.y = 1.8;
  sign.add(spost, board); sign.position.set(sw.x, ZH(...sp), sw.z); sign.rotation.y = .5; g.add(sign);
  // hay bales in the pasture
  const hay = new THREE.MeshLambertMaterial({ color: 0xd9b75a });
  for(let i = 0; i < 5; i++){ const a = rnd() * 6.28, r = rnd() * PASTURE.r * .6, x = PASTURE.x + Math.cos(a) * r, y = PASTURE.y + Math.sin(a) * r, w = XF(x, y);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .8, 12), hay); b.rotation.z = Math.PI / 2; b.rotation.y = rnd() * 3; b.position.set(w.x, ZH(x, y) + .5, w.z); g.add(b); }
  // Bramblewood Hollow: boulder rim (open toward the camp), bones and a mud wallow
  const boulderM = new THREE.MeshStandardMaterial({ color: 0x7a7468, flatShading: true, roughness: .95 });
  const entrance = Math.atan2(CAMP.y - DEN.y, CAMP.x - DEN.x);
  for(let a = 0; a < Math.PI * 2; a += .22){
    if(Math.abs(Math.atan2(Math.sin(a - entrance), Math.cos(a - entrance))) < .45) continue;
    const rr = DEN.r + 40 + rnd() * 90, x = DEN.x + Math.cos(a) * rr, y = DEN.y + Math.sin(a) * rr, w = XF(x, y), sc = 1.3 + rnd() * 1.4;
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(.8, 0), boulderM); b.position.set(w.x, ZH(x, y) + .2, w.z); b.scale.set(sc, sc * (.7 + rnd() * .5), sc); b.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); g.add(b);
  }
  const mudW = XF(DEN.x + 120, DEN.y + 160), mud = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24), new THREE.MeshLambertMaterial({ color: 0x3e2a1a }));
  mud.rotation.x = -Math.PI / 2; mud.position.set(mudW.x, ZH(DEN.x + 120, DEN.y + 160) + .04, mudW.z); g.add(mud);
  const boneM = new THREE.MeshLambertMaterial({ color: 0xece4d0 });
  for(let i = 0; i < 14; i++){
    const a = rnd() * 6.28, rr = rnd() * DEN.r * .8, x = DEN.x + Math.cos(a) * rr, y = DEN.y + Math.sin(a) * rr, w = XF(x, y);
    const bone = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .6 + rnd() * .5, 5), boneM); bone.rotation.set(Math.PI / 2, 0, rnd() * 6); bone.position.set(w.x, ZH(x, y) + .06, w.z); g.add(bone);
  }
  // Huntress Kaela's camp: tent, drying rack, campfire
  const cw2 = XF(CAMP.x, CAMP.y), camp = new THREE.Group();
  const tent = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3, 6), new THREE.MeshStandardMaterial({ color: 0x6f7a4a, flatShading: true, roughness: .9 })); tent.position.y = 1.5;
  const flap = new THREE.Mesh(new THREE.PlaneGeometry(.9, 1.4), new THREE.MeshBasicMaterial({ color: 0x2a2416, side: THREE.DoubleSide })); flap.position.set(0, .7, 1.85); flap.rotation.x = -.35;
  camp.add(tent, flap);
  for(const sx of [-1.2, 1.2]){ const p = new THREE.Mesh(new THREE.BoxGeometry(.12, 1.8, .12), beamM); p.position.set(sx + 3.2, .9, .2); camp.add(p); }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(2.5, .1, .1), beamM); bar.position.set(3.2, 1.75, .2); camp.add(bar);
  const pelt = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1), new THREE.MeshLambertMaterial({ color: 0x7a5232, side: THREE.DoubleSide })); pelt.position.set(3.2, 1.2, .2); camp.add(pelt);
  for(let i = 0; i < 6; i++){ const a = i / 6 * Math.PI * 2, st2 = new THREE.Mesh(new THREE.IcosahedronGeometry(.16, 0), stone); st2.position.set(-2.6 + Math.cos(a) * .45, .08, 2.2 + Math.sin(a) * .45); camp.add(st2); }
  const ember = new THREE.Mesh(new THREE.ConeGeometry(.22, .6, 6), new THREE.MeshBasicMaterial({ color: 0xff8a30 })); ember.position.set(-2.6, .35, 2.2); camp.add(ember); fireFlames.push(ember);
  camp.position.set(cw2.x, ZH(CAMP.x, CAMP.y), cw2.z); camp.rotation.y = -.6; g.add(camp);
  // Old Merrin's cabin on the western shore
  const cab = new THREE.Group(), cbw = XF(CABIN.x, CABIN.y);
  const cwall = new THREE.Mesh(new THREE.BoxGeometry(4, 2.6, 3.4), new THREE.MeshLambertMaterial({ color: 0x8a6a4a })); cwall.position.y = 1.3;
  const croof = new THREE.Mesh(new THREE.ConeGeometry(3.5, 2.2, 4), new THREE.MeshStandardMaterial({ color: 0x3f6a9a, flatShading: true })); croof.position.y = 3.6; croof.rotation.y = Math.PI / 4; croof.scale.set(1.1, 1, .95);
  const cdoor = new THREE.Mesh(new THREE.BoxGeometry(.8, 1.6, .1), doorM); cdoor.position.set(0, .8, 1.72);
  const net = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), new THREE.MeshBasicMaterial({ color: 0xd8d0b0, wireframe: true })); net.position.set(-2.1, 1.3, .5); net.rotation.y = Math.PI / 2;
  cab.add(cwall, croof, cdoor, net);
  for(let i = 0; i < 3; i++){ const bar2 = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, .8, 10), new THREE.MeshLambertMaterial({ color: 0x6a4428 })); bar2.position.set(2.4 + (i % 2) * .5, .4, 1 - i * .7); cab.add(bar2); }
  cab.position.set(cbw.x, ZH(CABIN.x, CABIN.y), cbw.z); cab.rotation.y = Math.atan2(XF(VILLAGE.x, VILLAGE.y).x - cbw.x, XF(VILLAGE.x, VILLAGE.y).z - cbw.z);
  g.add(cab);
  // Old Watchtower ruins
  const stoneM2 = new THREE.MeshStandardMaterial({ color: 0x8a847a, flatShading: true, roughness: .95, side: THREE.DoubleSide });
  const tw = XF(TOWER.x, TOWER.y), tower = new THREE.Group();
  const wall1 = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3, 4.5, 10, 1, true, 0, 4.6), stoneM2); wall1.position.y = 2.25;
  const wall2 = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 2.4, 10, 1, true, 1.1, 2.6), stoneM2); wall2.position.y = 5.7;
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, .2, 10), new THREE.MeshLambertMaterial({ color: 0x6a5a48 })); floor.position.y = .1;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 3, 6), beamM); pole.position.set(1.2, 7.3, -1.2);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, .7), new THREE.MeshLambertMaterial({ color: 0x3f5f9a, side: THREE.DoubleSide })); flag.position.set(1.8, 8.3, -1.2);
  tower.add(wall1, wall2, floor, pole, flag);
  for(let i = 0; i < 12; i++){ const a = rnd() * 6.28, rr = 3.2 + rnd() * 2.5, bl = new THREE.Mesh(new THREE.BoxGeometry(.6 + rnd() * .6, .4 + rnd() * .4, .5 + rnd() * .5), stoneM2); bl.position.set(Math.cos(a) * rr, .2, Math.sin(a) * rr); bl.rotation.set(rnd(), rnd() * 3, rnd()); tower.add(bl); }
  tower.position.set(tw.x, ZH(TOWER.x, TOWER.y), tw.z); g.add(tower);
  const towerRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd84a, transparent: true, opacity: .7, depthWrite: false }));
  towerRing.position.set(tw.x, ZH(TOWER.x, TOWER.y) + .08, tw.z); towerRing.visible = false; g.add(towerRing); DEFEND_FX.defend = towerRing;
  // signal beacons
  BEACONS.forEach(b => { USE_FX[USE_POINTS.indexOf(b)] = (() => {
    const grp = new THREE.Group(), w = XF(b.x, b.y);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(.45, .6, 1.6, 8), stone); pillar.position.y = .8;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.85, .5, .5, 10), new THREE.MeshLambertMaterial({ color: 0x3a3632 })); bowl.position.y = 1.85;
    for(let i = 0; i < 3; i++){ const lg = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .9, 5), beamM); lg.rotation.z = Math.PI / 2; lg.rotation.y = i * 1.05; lg.position.y = 2.1; grp.add(lg); }
    const flame = new THREE.Group();
    for(const [sc, hex] of [[1, 0xff7a20], [.6, 0xffd040]]){ const fl = new THREE.Mesh(new THREE.ConeGeometry(.5 * sc, 1.5 * sc, 7), new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: .92 })); fl.position.y = 2.2 + .75 * sc; flame.add(fl); fireFlames.push(fl); }
    const light = new THREE.PointLight(0xffa040, 1.2, 14, 1.6); light.position.y = 3; flame.add(light); flame.visible = false;
    const hint = new THREE.Sprite(glowMat); hint.scale.set(2.4, 2.4, 1); hint.position.y = 2.4; hint.visible = false;
    grp.add(pillar, bowl, flame, hint); grp.position.set(w.x, ZH(b.x, b.y), w.z); g.add(grp);
    return { flame, hint };
  })(); });
  // lookout cairns with a beam while they're unexplored
  LOOKOUTS.forEach((p, li) => { EXPLORE_FX.push((() => {
    const grp = new THREE.Group(), w = XF(p.x, p.y);
    for(let i = 0; i < 3; i++){ const st = new THREE.Mesh(new THREE.IcosahedronGeometry(.45 - i * .1, 0), stone); st.position.y = .3 + i * .55; st.rotation.set(rnd(), rnd() * 3, rnd()); grp.add(st); }
    const lp = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 2.4, 5), beamM); lp.position.set(.5, 1.2, 0);
    const pen = new THREE.Mesh(new THREE.PlaneGeometry(.7, .4), new THREE.MeshLambertMaterial({ color: 0xe0b040, side: THREE.DoubleSide })); pen.position.set(.85, 2.2, 0);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, 9, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: .22, depthWrite: false, blending: THREE.AdditiveBlending })); beam.position.y = 4.5; beam.visible = false;
    grp.add(lp, pen, beam); grp.position.set(w.x, ZH(p.x, p.y), w.z); g.add(grp);
    return { quest: "scout", i: li, beam };
  })()); });
  // picture of the zone for the maps
  const MS = 256; MAPIMG = document.createElement("canvas"); MAPIMG.width = MAPIMG.height = MS;
  const mg = MAPIMG.getContext("2d"), img = mg.createImageData(MS, MS);
  for(let py = 0; py < MS; py++) for(let px = 0; px < MS; px++){
    const x = (px + .5) / MS * ZS, y = ZS - (py + .5) / MS * ZS, f = fields(x, y), h = height(x, y, f), n = noise(x * 3.7, y * 3.3);
    c.setHSL(.26 + .025 * n, .42, .33 + .04 * n);
    t2.setHSL(.24, .45, .42); c.lerp(t2, f.past * .6);
    t2.setHSL(.09, .35, .56); c.lerp(t2, Math.max(f.path, f.vil * .6, f.camp * .5, f.tow * .5));
    t2.setHSL(.07, .35, .3); c.lerp(t2, f.den * .85);
    t2.setHSL(.11, .45, .62); c.lerp(t2, f.arena * .85);
    t2.setHSL(.55, .55, .52); c.lerp(t2, f.pond > .35 ? 1 : 0);
    t2.setHSL(.08, .1, .44); c.lerp(t2, ss(1.8, 4, h) * f.edge);
    t2.setHSL(.6, .15, .9); c.lerp(t2, ss(7.5, 9.5, h));
    const o = (py * MS + px) * 4; img.data[o] = c.r * 255; img.data[o + 1] = c.g * 255; img.data[o + 2] = c.b * 255; img.data[o + 3] = 255;
  }
  mg.putImageData(img, 0, 0); ZONE_PICS.vale = MAPIMG;
  const toM = (x, y) => [x / ZS * MS, (ZS - y) / ZS * MS];
  mg.fillStyle = "rgba(24,60,26,.5)"; for(const [x, y] of trees){ const [a, b] = toM(x, y); mg.fillRect(a - .7, b - .7, 1.5, 1.5); }
  { const [a, b] = toM(PASTURE.x, PASTURE.y); mg.strokeStyle = "#7a5a34"; mg.lineWidth = 1; mg.beginPath(); mg.arc(a, b, PASTURE.r / ZS * MS, 0, Math.PI * 2); mg.stroke(); }
  mg.strokeStyle = "#3a2414"; mg.lineWidth = 1;
  for(const [x, y] of HOUSES){ const [a, b] = toM(x, y); mg.fillStyle = "#e8dcc0"; mg.fillRect(a - 3, b - 3, 6, 6); mg.strokeRect(a - 3, b - 3, 6, 6); }
  for(const [x, y, col] of [[TOWER.x, TOWER.y, "#a8a296"], [CABIN.x, CABIN.y, "#b08a5a"], [CAMP.x, CAMP.y, "#8a9a5a"], [WELL[0], WELL[1], "#b0aaa0"], [CAMPFIRE[0], CAMPFIRE[1], "#ff9a40"]]){ const [a, b] = toM(x, y); mg.fillStyle = col; mg.fillRect(a - 2.5, b - 2.5, 5, 5); mg.strokeRect(a - 2.5, b - 2.5, 5, 5); }
  buildPeaks(g, ZH, { ss, noise, polyD, rnd, d, c, t2, stone, beamM });
  buildCathedral(g);
  buildJungle(g);
  zone = g; zone.visible = false; scene.add(zone);
}
function hAt(x, z){ const [zx, zy] = XF.inv(x, z); return ZH ? ZH(zx, zy) : 0; }
