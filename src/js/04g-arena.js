"use strict";
// The Proving Grounds: the duelling arena east of the Vale. Two gate rooms, two broad stone floors split by a
// glowing chasm, one arched bridge across it, four great pillars (they stop shots), walls, spectator stands,
// braziers and banners; the gates that hold you during the countdown; and the map picture.

let PGV = null, PGV_LAVA = null;
const PG_FLOOR_Y = .25;
// the floor's height: flat stone, the bridge arching over the chasm, and the chasm itself far below
function pgHeight(x, y){
  const inRoom = PG_ROOM_LIST.some(r => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]);
  const B = PG_ROOMS.bridge;
  if(x > B[0] && x < B[2] && y > B[1] && y < B[3]){ const k = (x - B[0]) / (B[2] - B[0]); return PG_FLOOR_Y + Math.sin(k * Math.PI) * 1.1; }
  if(inRoom) return PG_FLOOR_Y;
  if(x > PG_ROOMS.westFloor[2] && x < PG_ROOMS.eastFloor[0] && y > PG_ROOMS.westFloor[1] && y < PG_ROOMS.westFloor[3]) return -7;   // the chasm
  return PG_FLOOR_Y;
}

function buildArena(g){
  const outside = ZH, grp = new THREE.Group(); g.add(grp);
  ZH = (x, y) => inArena(x, y) ? pgHeight(x, y) : outside(x, y);
  let seed = 71; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const W3 = (x, y) => XF(x, y), S = ZSC;
  const box = (w, h, d, mat, x, y, z, parent = grp) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; };
  const at = (x, y) => { const w = W3(x, y); return [w.x, w.z]; };
  const stoneM = new THREE.MeshStandardMaterial({ color: 0x8a7860, flatShading: true, roughness: .95 }), darkM = new THREE.MeshStandardMaterial({ color: 0x584a3c, flatShading: true, roughness: .95 });
  const wallM = new THREE.MeshStandardMaterial({ color: 0x74644e, flatShading: true, roughness: 1 }), goldM = new THREE.MeshStandardMaterial({ color: 0xe0b040, metalness: .5, roughness: .4 });
  const woodM = new THREE.MeshLambertMaterial({ color: 0x6a4a2e });
  // a dusty plain all round, so the arena doesn't float in the void
  // (in four pieces round the chasm, which stays open)
  { const plainM = new THREE.MeshLambertMaterial({ color: 0x8a7a5a }), cx0 = PG_ROOMS.westFloor[2], cx1 = PG_ROOMS.eastFloor[0], cy0 = PG_ROOMS.westFloor[1], cy1 = PG_ROOMS.westFloor[3];
    for(const r of [[ZS, 0, cx0, ZS], [cx1, 0, 2 * ZS, ZS], [cx0, 0, cx1, cy0], [cx0, cy1, cx1, ZS]]){ const [x0, z0] = at(r[0], r[3]), [x1, z1] = at(r[2], r[1]), pl = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), plainM); pl.rotation.x = -Math.PI / 2; pl.position.set((x0 + x1) / 2, -.05, (z0 + z1) / 2); grp.add(pl); } }
  // floors: one slab per room (the gate rooms darker), with a chequer of lighter flagstones
  for(const [key, r] of Object.entries(PG_ROOMS)){
    if(key === "bridge") continue;
    const [x0, z0] = at(r[0], r[3]), [x1, z1] = at(r[2], r[1]), w = x1 - x0, d = z1 - z0;
    box(w, .5, d, key === "west" || key === "east" ? darkM : stoneM, x0 + w / 2, PG_FLOOR_Y - .25, z0 + d / 2);
  }
  { const tileM = new THREE.MeshStandardMaterial({ color: 0xa08c6e, flatShading: true, roughness: .9 }), tiles = [];
    for(const key of ["westFloor", "eastFloor"]){ const r = PG_ROOMS[key]; for(let x = r[0] + 150; x < r[2] - 100; x += 300) for(let y = r[1] + 150; y < r[3] - 100; y += 300) if((Math.round((x - r[0]) / 300) + Math.round((y - r[1]) / 300)) % 2 === 0) tiles.push([x, y]); }
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(300 * S * .96, .04, 300 * S * .96), tileM, tiles.length), dm = new THREE.Object3D();
    tiles.forEach(([x, y], i) => { const [wx, wz] = at(x, y); dm.position.set(wx, PG_FLOOR_Y + .02, wz); dm.updateMatrix(); im.setMatrixAt(i, dm.matrix); }); grp.add(im); }
  // a great emblem in the middle of each floor
  for(const key of ["westFloor", "eastFloor"]){ const r = PG_ROOMS[key], [cx, cz] = at((r[0] + r[2]) / 2, (r[1] + r[3]) / 2), ring = new THREE.Mesh(new THREE.RingGeometry(5.5, 6.2, 40), new THREE.MeshBasicMaterial({ color: key === "westFloor" ? 0x4a7ac8 : 0xc84a4a, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.set(cx, PG_FLOOR_Y + .05, cz); grp.add(ring); }
  // the chasm: dark walls falling to a river of embers
  { const r = [PG_ROOMS.westFloor[2], PG_ROOMS.westFloor[1], PG_ROOMS.eastFloor[0], PG_ROOMS.westFloor[3]], [x0, z0] = at(r[0], r[3]), [x1, z1] = at(r[2], r[1]), w = x1 - x0, d = z1 - z0;
    const lava = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: 0xff6a1a })); lava.rotation.x = -Math.PI / 2; lava.position.set(x0 + w / 2, -7, z0 + d / 2); grp.add(lava); PGV_LAVA = lava;
    const li = new THREE.PointLight(0xff7a2a, 1.4, 40, 1.5); li.position.set(x0 + w / 2, -3, z0 + d / 2); grp.add(li);
    for(const sx of [x0 - .25, x1 + .25]) box(.5, 7.3, d, darkM, sx, -3.4, z0 + d / 2);
    for(const sz of [z0, z1]) box(w, 7.3, .5, darkM, x0 + w / 2, -3.4, sz); }
  // the bridge: arched stone with low railings
  { const B = PG_ROOMS.bridge, n = 14, [, zc] = at(PG.x, (B[1] + B[3]) / 2), wid = (B[3] - B[1]) * S;
    for(let i = 0; i < n; i++){ const x = B[0] + (i + .5) / n * (B[2] - B[0]), h = pgHeight(x, (B[1] + B[3]) / 2), [wx] = at(x, 0), len = (B[2] - B[0]) / n * S * 1.04;
      box(len, .5, wid, stoneM, wx, h - .25, zc); for(const s of [-1, 1]) box(len, .7, .3, goldM, wx, h + .35, zc + s * (wid / 2 - .15)); }
    for(const s of [-1, 1]) box(.6, 6.5, .6, darkM, at(PG.x, 0)[0], -3.5, zc + s * (wid / 2 - .5)); }   // a pier under the arch
  // walls: wherever a room's edge doesn't open into another room; low parapets along the chasm
  const inside = (x, y) => PG_ROOM_LIST.some(r => x > r[0] && x < r[2] && y > r[1] && y < r[3]);
  const overChasm = (x, y) => x > PG_ROOMS.westFloor[2] - 1 && x < PG_ROOMS.eastFloor[0] + 1 && y > PG_ROOMS.westFloor[1] && y < PG_ROOMS.westFloor[3];
  const seg = 100, walls = [], parapets = [];
  for(const r of PG_ROOM_LIST){
    for(let x = r[0]; x < r[2]; x += seg) for(const [y, oy] of [[r[1], -30], [r[3], 30]]){ const mx = x + seg / 2; if(!inside(mx, y + oy)) (overChasm(mx, y + oy) ? parapets : walls).push([mx, y, 0]); }
    for(let y = r[1]; y < r[3]; y += seg) for(const [x, ox] of [[r[0], -30], [r[2], 30]]){ const my = y + seg / 2; if(!inside(x + ox, my)) (overChasm(x + ox, my) ? parapets : walls).push([x, my, 1]); }
  }
  const inst = (list, geo, mat, h) => { const im = new THREE.InstancedMesh(geo, mat, list.length), dm = new THREE.Object3D(); list.forEach(([x, y, vert], i) => { const [wx, wz] = at(x, y); dm.position.set(wx, h, wz); dm.rotation.set(0, vert ? Math.PI / 2 : 0, 0); dm.updateMatrix(); im.setMatrixAt(i, dm.matrix); }); grp.add(im); return im; };
  inst(walls, new THREE.BoxGeometry(seg * S * 1.02, 5, .9), wallM, 2.5);
  inst(walls.filter((_, i) => i % 2 === 0), new THREE.BoxGeometry(seg * S * .6, .8, 1.1), wallM, 5.4);   // crenellations
  inst(parapets, new THREE.BoxGeometry(seg * S * 1.02, 1, .5), darkM, PG_FLOOR_Y + .5);
  // the four great pillars: they block movement and shots alike
  for(const p of PG_PILLARS){
    const pil = new THREE.Group(), R = p.r * S, [wx, wz] = at(p.x, p.y);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.15, R * 1.25, 1, 10), darkM); base.position.y = .5;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(R * .92, R, 10, 10), stoneM); shaft.position.y = 6;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.2, R * .95, 1.2, 10), darkM); cap.position.y = 11.6;
    for(const yb of [3, 8.5]){ const band = new THREE.Mesh(new THREE.CylinderGeometry(R * .97, R * .97, .5, 10), goldM); band.position.y = yb; pil.add(band); }
    pil.add(base, shaft, cap); pil.position.set(wx, PG_FLOOR_Y, wz); grp.add(pil);
  }
  // the gates: iron portcullises that drop during the countdown
  const gates = {};
  for(const side of ["a", "b"]){
    const G0 = PG_GATES[side], room = side === "a" ? PG_ROOMS.west : PG_ROOMS.east, [gx, gz] = at(G0.x, G0.y), wid = (room[3] - room[1]) * S, gate = new THREE.Group(), barM = new THREE.MeshStandardMaterial({ color: 0x3a3a40, metalness: .6, roughness: .5 });
    for(let k = 0; k <= 10; k++){ const bar = new THREE.Mesh(new THREE.BoxGeometry(.18, 4.6, .18), barM); bar.position.set(0, 2.3, -wid / 2 + k * wid / 10); gate.add(bar); }
    for(const yb of [1, 3.6]){ const rail = new THREE.Mesh(new THREE.BoxGeometry(.22, .22, wid), barM); rail.position.y = yb; gate.add(rail); }
    for(const s of [-1, 1]){ const post = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6.5, 1.2), wallM); post.position.set(0, 3.25, s * (wid / 2 + .6)); gate.add(post); }
    const arch = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, wid + 2.4), wallM); arch.position.y = 6.3; gate.add(arch);
    gate.position.set(gx, PG_FLOOR_Y, gz); grp.add(gate); gates[side] = gate.children.slice(0, 13);   // the bars and rails move; the posts stay
  }
  // spectator stands along the long sides, with banners and braziers
  const standM = [0x6a5a46, 0x5e503e, 0x524636].map(h => new THREE.MeshStandardMaterial({ color: h, flatShading: true, roughness: 1 }));
  for(const [y0, dir] of [[PG_ROOMS.westFloor[1], -1], [PG_ROOMS.westFloor[3], 1]]) for(const [xa, xb] of [[PG_ROOMS.westFloor[0], PG_ROOMS.westFloor[2]], [PG_ROOMS.eastFloor[0], PG_ROOMS.eastFloor[2]]]){
    for(let k = 0; k < 3; k++){ const [x0, z0] = at(xa, y0 + dir * (120 + k * 160)), [x1] = at(xb, 0); box(x1 - x0, 1.6 + k * 1.6, 160 * S, standM[k], (x0 + x1) / 2, (1.6 + k * 1.6) / 2, z0); }
  }
  const crowdM = [0xc84a4a, 0x4a7ac8, 0xe0b040, 0x5a9a4a, 0xd8d0c0].map(h => new THREE.MeshLambertMaterial({ color: h })), crowd = [];
  for(const [y0, dir] of [[PG_ROOMS.westFloor[1], -1], [PG_ROOMS.westFloor[3], 1]]) for(let x = PG_ROOMS.westFloor[0] + 80; x < PG_ROOMS.eastFloor[2] - 80; x += 95){ if(x > PG_ROOMS.westFloor[2] && x < PG_ROOMS.eastFloor[0]) continue; const k = Math.floor(rnd() * 3); if(rnd() < .55) crowd.push([x + rnd() * 40, y0 + dir * (120 + k * 160), 1.6 + k * 1.6, Math.floor(rnd() * crowdM.length)]); }
  for(let c = 0; c < crowdM.length; c++){ const list = crowd.filter(p => p[3] === c), im = new THREE.InstancedMesh(new THREE.BoxGeometry(.5, .9, .4), crowdM[c], list.length), dm = new THREE.Object3D();
    list.forEach(([x, y, h], i) => { const [wx, wz] = at(x, y); dm.position.set(wx, h + .45, wz); dm.updateMatrix(); im.setMatrixAt(i, dm.matrix); }); grp.add(im); }
  const banM = [0x4a7ac8, 0xc84a4a].map(h => new THREE.MeshLambertMaterial({ color: h, side: THREE.DoubleSide }));
  for(const [key, m] of [["westFloor", banM[0]], ["eastFloor", banM[1]]]){ const r = PG_ROOMS[key]; for(let x = r[0] + 300; x < r[2]; x += 500) for(const y of [r[1], r[3]]){ const [wx, wz] = at(x, y), ban = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.6), m); ban.position.set(wx, 3.4, wz + (y === r[1] ? -.5 : .5)); grp.add(ban); } }
  const braziers = [];
  for(const [x, y] of [[PG_ROOMS.westFloor[0] + 120, PG_ROOMS.westFloor[1] + 120], [PG_ROOMS.westFloor[0] + 120, PG_ROOMS.westFloor[3] - 120], [PG_ROOMS.eastFloor[2] - 120, PG_ROOMS.eastFloor[1] + 120], [PG_ROOMS.eastFloor[2] - 120, PG_ROOMS.eastFloor[3] - 120]]){
    const bz = new THREE.Group(), bowl = new THREE.Mesh(new THREE.CylinderGeometry(.7, .4, .6, 8), goldM), stem = new THREE.Mesh(new THREE.CylinderGeometry(.15, .25, 1.6, 6), darkM); stem.position.y = .8; bowl.position.y = 1.8;
    const fl = new THREE.Mesh(new THREE.ConeGeometry(.45, 1.2, 7), new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: .9 })); fl.position.y = 2.6; fireFlames.push(fl);
    const li = new THREE.PointLight(0xffa040, 1, 18, 1.6); li.position.y = 3; bz.add(stem, bowl, fl, li); const [wx, wz] = at(x, y); bz.position.set(wx, PG_FLOOR_Y, wz); grp.add(bz); braziers.push(bz);
  }
  // colours above are written as you'd pick them on screen; the renderer works in linear light
  const seen = new Set(); grp.traverse(o => { const m = o.material; if(m && !seen.has(m) && m.color){ seen.add(m); m.color.convertSRGBToLinear(); } });
  PGV = { grp, gates, lava: PGV_LAVA };

  // picture for the maps
  const MS = 256, pic = document.createElement("canvas"); pic.width = pic.height = MS; const mg = pic.getContext("2d");
  const toM = (x, y) => [(x - ZS) / ZS * MS, (ZS - y) / ZS * MS];
  mg.fillStyle = "#a89470"; mg.fillRect(0, 0, MS, MS);
  const rect = (r, col) => { const [a, b] = toM(r[0], r[3]), [c2, d2] = toM(r[2], r[1]); mg.fillStyle = col; mg.fillRect(a, b, c2 - a, d2 - b); };
  rect([PG_ROOMS.westFloor[2], PG_ROOMS.westFloor[1], PG_ROOMS.eastFloor[0], PG_ROOMS.westFloor[3]], "#c8501a");
  for(const [key, r] of Object.entries(PG_ROOMS)) rect(r, key === "west" || key === "east" ? "#7a6a58" : key === "bridge" ? "#d0c0a0" : "#b8a88c");
  mg.fillStyle = "#5a4a3a"; for(const p of PG_PILLARS){ const [a, b] = toM(p.x, p.y); mg.beginPath(); mg.arc(a, b, p.r / ZS * MS, 0, 7); mg.fill(); }
  for(const [side, col] of [["a", "#4a7ac8"], ["b", "#c84a4a"]]){ const [a, b] = toM(PG_START[side][0], PG_START[side][1]); mg.fillStyle = col; mg.fillRect(a - 3, b - 3, 6, 6); }
  ZONE_PICS.arena = pic;
}

// per frame: the gates are down while your duel counts down, up once it's on; the embers flicker
function updateArena(s, me, t){
  if(!PGV || !s) return;
  const mine = me && (s.du || []).find(d => d[0] === me.side || d[1] === me.side), closed = !!(mine && inArena(mine[2], mine[3]) && !mine[4]);
  for(const side of ["a", "b"]) for(const m of PGV.gates[side]){ m.userData.y0 = m.userData.y0 ?? m.position.y; const want = m.userData.y0 + (closed ? 0 : 4.8); m.position.y += (want - m.position.y) * .15; }
  if(PGV.lava) PGV.lava.material.color.setHSL(.06, 1, .5 + Math.sin(t * 2) * .05).convertSRGBToLinear();
}
