"use strict";
// The Ashen Cathedral: its 3D interior (stone floors, walls, pillars, pews, stained glass, altars, candles),
// the seal on the choir, the way out, the Rift in the Wyrm's Crown, the map picture, and per-frame visuals
// (burning ground, priests' firebolts, the door, dark lighting while you're inside).

let CATH = null;            // meshes the render loop updates
const PORTAL_VIS = [];      // { x, y, name, shown } for the overlay labels

function buildCathedral(g){
  const outside = ZH;
  ZH = (x, y) => y > DZ ? 0 : outside(x, y);   // the cathedral floor is flat
  const grp = new THREE.Group(); g.add(grp);
  const place = (m, x, y, h = 0) => { const w = XF(x, y); m.position.set(w.x, h, w.z); grp.add(m); return m; };
  const S = ZSC, inRoom = (x, y, r) => x > r[0] && x < r[2] && y > r[1] && y < r[3];
  const rooms = CATHEDRAL_ROOMS.map(k => CATHEDRAL[k]);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // the dark beyond the walls
  const voidM = new THREE.Mesh(new THREE.PlaneGeometry(ZONE_W, ZONE_W), new THREE.MeshBasicMaterial({ color: 0x0b0807 }));
  voidM.rotation.x = -Math.PI / 2; place(voidM, ZS / 2, DZ + ZS / 2, -.05);
  // stone floor tiles
  const tile = document.createElement("canvas"); tile.width = tile.height = 128; const tg = tile.getContext("2d");
  for(let i = 0; i < 4; i++) for(let j = 0; j < 4; j++){ const v = 78 + Math.floor(rnd() * 22); tg.fillStyle = `rgb(${v + 6},${v},${v - 6})`; tg.fillRect(i * 32 + 1, j * 32 + 1, 30, 30); }
  tg.fillStyle = "rgba(0,0,0,.35)"; for(let k = 0; k < 40; k++) tg.fillRect(rnd() * 128, rnd() * 128, 2, 2);
  const tileTex = new THREE.CanvasTexture(tile); tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping; tileTex.encoding = THREE.sRGBEncoding;
  rooms.forEach((r, i) => {
    const w = (r[2] - r[0]) * S, h = (r[3] - r[1]) * S, tex = tileTex.clone(); tex.needsUpdate = true; tex.repeat.set(w / 3, h / 3);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex })); f.rotation.x = -Math.PI / 2;
    place(f, (r[0] + r[2]) / 2, (r[1] + r[3]) / 2, i * .003);
  });
  // a crimson runner down the nave to the altar, and across the transept
  const carpetM = new THREE.MeshLambertMaterial({ color: 0x4a0c0c });
  { const c1 = new THREE.Mesh(new THREE.PlaneGeometry(300 * S, (22950 - 17700) * S), carpetM); c1.rotation.x = -Math.PI / 2; place(c1, 4000, (22950 + 17700) / 2, .02);
    const c2 = new THREE.Mesh(new THREE.PlaneGeometry((6600 - 1400) * S, 260 * S), carpetM); c2.rotation.x = -Math.PI / 2; place(c2, 4000, 21850, .018); }

  // walls: every room edge that doesn't open into another room. Walls on a room's south side stay low,
  // so they never hide you from the camera.
  const wallM = new THREE.MeshLambertMaterial({ color: 0x5c534c }), capM = new THREE.MeshLambertMaterial({ color: 0x3a332e });
  const glassCols = [0xff7a2a, 0xc0392b, 0xf0c040, 0x7a4ad0, 0x3f8ad8];
  const windowAt = (x, y, nx, ny, wide) => {   // a stained-glass window on a tall wall, facing into the room
    const c = document.createElement("canvas"); c.width = 64; c.height = 128; const wg = c.getContext("2d");
    wg.fillStyle = "#1b1410"; wg.fillRect(0, 0, 64, 128);
    for(let i = 0; i < 4; i++) for(let j = 0; j < 8; j++){ wg.fillStyle = "#" + glassCols[Math.floor(rnd() * glassCols.length)].toString(16).padStart(6, "0"); wg.fillRect(4 + i * 14, 6 + j * 15, 12, 13); }
    wg.globalCompositeOperation = "destination-in"; wg.beginPath(); wg.moveTo(0, 128); wg.lineTo(0, 32); wg.arc(32, 32, 32, Math.PI, 0); wg.lineTo(64, 128); wg.fill();
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(wide ? 2.6 : 1.5, wide ? 4.4 : 3.2), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
    m.rotation.y = Math.atan2(nx, -ny); place(m, x + nx * 8, y + ny * 8, wide ? 4.2 : 3.8);
  };
  for(const r of rooms){
    const edges = [[r[0], r[1], r[2], r[1], 0, -1, "s"], [r[0], r[3], r[2], r[3], 0, 1, "n"], [r[0], r[1], r[0], r[3], -1, 0, "w"], [r[2], r[1], r[2], r[3], 1, 0, "e"]];
    for(const [ax, ay, bx, by, nx, ny, side] of edges){
      const len = Math.hypot(bx - ax, by - ay), n = Math.round(len / 100), runs = []; let run = null;
      for(let k = 0; k < n; k++){
        const t = (k + .5) / n, mx = ax + (bx - ax) * t, my = ay + (by - ay) * t, px = mx + nx * 60, py = my + ny * 60;
        const open = rooms.some(o => o !== r && inRoom(px, py, o));
        if(!open){ if(!run){ run = [k, k]; runs.push(run); } else run[1] = k; } else run = null;
      }
      for(const [k0, k1] of runs){
        const t0 = k0 / n, t1 = (k1 + 1) / n, x0 = ax + (bx - ax) * t0, y0 = ay + (by - ay) * t0, x1 = ax + (bx - ax) * t1, y1 = ay + (by - ay) * t1;
        const low = side === "s", hgt = low ? 1.1 : 7, L = Math.hypot(x1 - x0, y1 - y0) * S + 80 * S;
        const box = new THREE.Mesh(new THREE.BoxGeometry(nx ? 80 * S : L, hgt, ny ? 80 * S : L), wallM);
        place(box, (x0 + x1) / 2 + nx * 40, (y0 + y1) / 2 + ny * 40, hgt / 2);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(nx ? 100 * S : L, .25, ny ? 100 * S : L), capM); place(cap, (x0 + x1) / 2 + nx * 40, (y0 + y1) / 2 + ny * 40, hgt + .12);
        if(!low){ const span = Math.hypot(x1 - x0, y1 - y0); for(let s = 350; s < span - 250; s += 650){ const k = s / span; windowAt(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, -nx, -ny, false); } }
      }
    }
  }
  // the great rose window behind the altar
  { const c = document.createElement("canvas"); c.width = c.height = 128; const wg = c.getContext("2d");
    for(let i = 0; i < 12; i++){ wg.fillStyle = "#" + glassCols[i % glassCols.length].toString(16).padStart(6, "0"); wg.beginPath(); wg.moveTo(64, 64); wg.arc(64, 64, 60, i / 12 * Math.PI * 2, (i + 1) / 12 * Math.PI * 2); wg.fill(); }
    wg.fillStyle = "#fff0c0"; wg.beginPath(); wg.arc(64, 64, 16, 0, Math.PI * 2); wg.fill(); wg.strokeStyle = "#1b1410"; wg.lineWidth = 4;
    for(let i = 0; i < 12; i++){ wg.beginPath(); wg.moveTo(64, 64); wg.lineTo(64 + Math.cos(i / 12 * Math.PI * 2) * 62, 64 + Math.sin(i / 12 * Math.PI * 2) * 62); wg.stroke(); } wg.beginPath(); wg.arc(64, 64, 61, 0, Math.PI * 2); wg.stroke();
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    const rose = new THREE.Mesh(new THREE.CircleGeometry(3.2, 32), new THREE.MeshBasicMaterial({ map: t })); place(rose, 4000, CATHEDRAL.choir[3] - 2, 4.6); }

  // pillars down the nave
  const stoneM = new THREE.MeshLambertMaterial({ color: 0x6e655c });
  for(const p of PILLARS){
    const col = new THREE.Mesh(new THREE.CylinderGeometry(p.r * S * .9, p.r * S, 8, 10), stoneM); place(col, p.x, p.y, 4);
    const base = new THREE.Mesh(new THREE.BoxGeometry(p.r * S * 2.4, .5, p.r * S * 2.4), capM); place(base, p.x, p.y, .25);
  }
  // pews in the side aisles, facing the altar
  const woodM = new THREE.MeshLambertMaterial({ color: 0x4a2e1a });
  for(const x of [3190, 4810]) for(let y = 18800; y < 21000; y += 230){
    if(PILLARS.some(p => Math.abs(p.y - y) < 130)) continue;
    const pew = new THREE.Mesh(new THREE.BoxGeometry(300 * S, .55, 50 * S), woodM); place(pew, x, y, .28);
    const back = new THREE.Mesh(new THREE.BoxGeometry(300 * S, .8, 14 * S), woodM); place(back, x, y - 30, .7);
  }
  // altars: the high altar behind the Saint, and one at the end of each chapel
  const altarM = new THREE.MeshLambertMaterial({ color: 0xd8d0c0 }), clothM = new THREE.MeshLambertMaterial({ color: 0x8a1a1a });
  const altarAt = (x, y, rot) => {
    const a = new THREE.Group(), top = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.2, 1.4), altarM), cloth = new THREE.Mesh(new THREE.BoxGeometry(3.5, .1, 1.5), clothM);
    top.position.y = .6; cloth.position.y = 1.22; a.add(top, cloth); a.rotation.y = rot; place(a, x, y);
  };
  altarAt(4000, CATHEDRAL.choir[3] + 30, 0); altarAt(CATHEDRAL.transept[0] - 30, 22000, Math.PI / 2); altarAt(CATHEDRAL.transept[2] + 30, 22000, Math.PI / 2);
  // candles and braziers; their warm light only switches on while you're inside
  const lights = new THREE.Group(); lights.visible = false; grp.add(lights);
  const flameSprite = (x, y, h, s) => { const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMat.map, color: 0xffa040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); f.scale.set(s, s, 1); place(f, x, y, h); return f; };
  const flames = [], candleM = new THREE.MeshLambertMaterial({ color: 0xf0e6d0 });
  const candles = (x, y, n) => { for(let k = 0; k < n; k++){ const cx = x + (rnd() - .5) * 220, cy = y + (rnd() - .5) * 120, hh = .4 + rnd() * .5, c = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, hh, 6), candleM); place(c, cx, cy, hh / 2); flames.push(flameSprite(cx, cy, hh + .12, .55)); } };
  candles(4000, CATHEDRAL.choir[3] - 60, 9); candles(CATHEDRAL.transept[0] + 70, 22000, 6); candles(CATHEDRAL.transept[2] - 70, 22000, 6); candles(3600, 18350, 4);
  const bowlM = new THREE.MeshLambertMaterial({ color: 0x3a2e24 });
  for(const [x, y] of [[3150, 19300], [4850, 19300], [3150, 20500], [4850, 20500], [3150, 17900], [4850, 17900], [2950, 22450], [5050, 22450]]){
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(.1, .25, 1.6, 6), bowlM), bowl = new THREE.Mesh(new THREE.CylinderGeometry(.55, .3, .35, 8), bowlM);
    place(stand, x, y, .8); place(bowl, x, y, 1.7); flames.push(flameSprite(x, y, 2.1, 1.6));
  }
  for(const [x, y, i] of [[4000, 18300, 1.2], [4000, 20000, 1.4], [2000, 22000, 1.3], [6000, 22000, 1.3], [4000, 22900, 1.8]]){ const l = new THREE.PointLight(0xff9a50, i, 34, 1.6); place(l, x, y, 5); grp.remove(l); lights.add(l); }
  // the seal across the choir: a wall of burning runes until both chapel bosses are dead
  const ch = CATHEDRAL.choir, sealC = document.createElement("canvas"); sealC.width = 256; sealC.height = 64; const sg = sealC.getContext("2d");
  sg.fillStyle = "rgba(255,110,40,.35)"; sg.fillRect(0, 0, 256, 64); sg.fillStyle = "#ffd27a"; sg.font = "700 34px serif"; sg.textAlign = "center"; sg.fillText("ᚨ ᛟ ᛞ ᛉ ᚹ ᛗ ᛚ", 128, 44);
  const sealTex = new THREE.CanvasTexture(sealC); sealTex.encoding = THREE.sRGBEncoding;
  const seal = new THREE.Mesh(new THREE.PlaneGeometry((ch[2] - ch[0]) * S, 5), new THREE.MeshBasicMaterial({ map: sealTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  place(seal, (ch[0] + ch[2]) / 2, CATHEDRAL.door, 2.5);
  // the way out: a pale portal by the entrance
  const portalMat = col => { const c = document.createElement("canvas"); c.width = c.height = 128; const pg = c.getContext("2d"), grd = pg.createRadialGradient(64, 64, 4, 64, 64, 62); grd.addColorStop(0, "rgba(255,255,255,.95)"); grd.addColorStop(.35, col); grd.addColorStop(1, "rgba(0,0,0,0)"); pg.fillStyle = grd; pg.beginPath(); pg.ellipse(64, 64, 40, 62, 0, 0, Math.PI * 2); pg.fill(); const t = new THREE.CanvasTexture(c); return new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }); };
  const exitP = new THREE.Sprite(portalMat("rgba(140,200,255,.8)")); exitP.scale.set(2.6, 4, 1); place(exitP, CATHEDRAL.exit.x, CATHEDRAL.exit.y, 2);
  const exitRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: .8, depthWrite: false })); exitRing.scale.setScalar(150 * S); place(exitRing, CATHEDRAL.exit.x, CATHEDRAL.exit.y, .06);
  PORTAL_VIS.push({ x: CATHEDRAL.exit.x, y: CATHEDRAL.exit.y, name: "Leave the Cathedral", shown: true });
  // the Rift in the Wyrm's Crown (in the Peaks): dim until Skarnvir has fallen
  const riftTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const pg = c.getContext("2d"), grd = pg.createRadialGradient(64, 64, 2, 64, 64, 62);
    grd.addColorStop(0, "rgba(20,4,12,1)"); grd.addColorStop(.45, "rgba(70,10,30,1)"); grd.addColorStop(.7, "rgba(255,110,40,.95)"); grd.addColorStop(.85, "rgba(255,200,120,.6)"); grd.addColorStop(1, "rgba(255,120,40,0)");
    pg.fillStyle = grd; pg.beginPath(); pg.ellipse(64, 64, 42, 62, 0, 0, Math.PI * 2); pg.fill(); return new THREE.CanvasTexture(c); })();
  const riftG = new THREE.Group(), rift = new THREE.Sprite(new THREE.SpriteMaterial({ map: riftTex, transparent: true, depthWrite: false })); rift.scale.set(3.4, 5.4, 1); rift.position.y = 2.7;
  const riftRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xff8a3a, transparent: true, opacity: .85, depthWrite: false })); riftRing.scale.setScalar(RIFT.r * S); riftRing.position.y = .08;
  riftG.add(rift, riftRing); const rw = XF(RIFT.x, RIFT.y); riftG.position.set(rw.x, outside(RIFT.x, RIFT.y), rw.z); g.add(riftG);
  const riftLabel = { x: RIFT.x, y: RIFT.y, name: "Rift to the Ashen Cathedral", shown: false }; PORTAL_VIS.push(riftLabel);
  CATH = { seal, lights, flames, exitP, rift, riftRing, riftLabel, hz: new Map(), ms: new Map() };

  // picture for the maps
  const MS = 256, pic = document.createElement("canvas"); pic.width = pic.height = MS; const mg = pic.getContext("2d");
  const toM = (x, y) => [x / ZS * MS, (DZ + ZS - y) / ZS * MS];
  mg.fillStyle = "#120d0b"; mg.fillRect(0, 0, MS, MS);
  for(const r of rooms){ const [a, b] = toM(r[0], r[3]), [c, d] = toM(r[2], r[1]); mg.fillStyle = "#6a5f55"; mg.fillRect(a, b, c - a, d - b); }
  for(const r of rooms){ const [a, b] = toM(r[0], r[3]), [c, d] = toM(r[2], r[1]); mg.fillStyle = "#857a6e"; mg.fillRect(a + 1.5, b + 1.5, c - a - 3, d - b - 3); }
  { const [a, b] = toM(3850, 22950), [c, d] = toM(4150, 17700); mg.fillStyle = "#8a2a2a"; mg.fillRect(a, b, c - a, d - b); }
  mg.fillStyle = "#3a332e"; for(const p of PILLARS){ const [a, b] = toM(p.x, p.y); mg.beginPath(); mg.arc(a, b, 2.2, 0, Math.PI * 2); mg.fill(); }
  { const [a, b] = toM(4000, CATHEDRAL.choir[3]); mg.fillStyle = "#f0c040"; mg.fillRect(a - 5, b - 3, 10, 4); }
  { const [a, b] = toM(CATHEDRAL.exit.x, CATHEDRAL.exit.y); mg.fillStyle = "#9fd8ff"; mg.beginPath(); mg.arc(a, b, 3, 0, Math.PI * 2); mg.fill(); }
  ZONE_PICS.cathedral = pic;
}

// per frame: the seal, the Rift, burning ground and firebolts, and the darkness inside
const CATH_FOG = window.THREE ? new THREE.Color(0x140e0b) : null;
function updateCathedral(s, me, t){
  if(!CATH || !s) return;
  const dg = s.dg || { s: 1, ro: 0, hz: [], ms: [] }, inside = me && me.y > DZ && me.x <= ZS;
  CATH.seal.visible = !!dg.s; CATH.seal.material.opacity = .65 + Math.sin(t * 3) * .25;
  CATH.lights.visible = inside;
  for(const [i, f] of CATH.flames.entries()) f.material.opacity = .75 + Math.sin(t * 9 + i * 1.7) * .2;
  CATH.exitP.material.opacity = .7 + Math.sin(t * 2.5) * .2;
  // the Rift: open for you once Skarnvir is dead (or while it's freshly torn open)
  const q = me && me.quests && me.quests.rimewyrm, open = !!dg.ro || !!(q && (q.state === "ready" || q.state === "done"));
  CATH.rift.material.opacity = open ? .8 + Math.sin(t * 3) * .15 : .12; CATH.rift.material.rotation = t * .4;
  CATH.riftRing.material.opacity = open ? .85 : .2; CATH.riftLabel.shown = open;
  // burning ground
  const seen = new Set();
  for(const [id, x, y, r] of dg.hz){
    seen.add(id); let v = CATH.hz.get(id);
    if(!v){ v = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: 0xff5a1a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); v.scale.setScalar(r * ZSC); const w = XF(x, y); v.position.set(w.x, hAt(w.x, w.z) + .04, w.z); G.root.add(v); CATH.hz.set(id, v); }
    v.material.opacity = .4 + Math.sin(t * 11 + x) * .12;
  }
  for(const [id, v] of CATH.hz) if(!seen.has(id)){ G.root.remove(v); v.material.dispose(); CATH.hz.delete(id); }
  // priests' firebolts
  const seenS = new Set();
  for(const [id, x, y] of dg.ms){
    seenS.add(id); let v = CATH.ms.get(id);
    if(!v){ v = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMat.map, color: 0xff7a2a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); v.scale.set(1.1, 1.1, 1); G.root.add(v); CATH.ms.set(id, v); }
    const w = XF(x, y); v.position.set(w.x, hAt(w.x, w.z) + 1.3, w.z);
  }
  for(const [id, v] of CATH.ms) if(!seenS.has(id)){ G.root.remove(v); v.material.dispose(); CATH.ms.delete(id); }
}
// darker light and fog inside the cathedral (called from updateClimate)
function cathedralClimate(inside){
  if(HEMI){ HEMI.intensity = inside ? .55 : 1.05; SUN.intensity = inside ? .3 : 1; }
  if(inside && scene.fog){ scene.fog.color.copy(CATH_FOG); scene.background.copy(CATH_FOG); }
}
