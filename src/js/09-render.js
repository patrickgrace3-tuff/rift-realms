"use strict";
// Per-frame rendering, overlays and the main loop. Calls boot().

/* ---------- Render ---------- */
const projV = window.THREE ? new THREE.Vector3() : null;
const MARK_UP = window.THREE ? new THREE.Vector3() : null;
function smoothPos(id, x, y, dt){
  let p = G.smooth.get(id);
  if(!p || Math.hypot(p.x - x, p.y - y) > 700 || G.role === "host"){ p = { x, y }; G.smooth.set(id, p); return p; }
  const k = Math.min(1, dt * 14); p.x += (x - p.x) * k; p.y += (y - p.y) * k; return p;
}
// Sound must never break the game: if anything goes wrong playing one (a missing file, an old
// cached audio script, a browser quirk), skip it and carry on.
function playSound(fn){ try{ fn(); }catch(e){ if(!playSound.warned){ playSound.warned = true; console.warn("Sound skipped:", e); } } }
function render(dt){
  const s = G.snap; if(!s) return;
  const t = performance.now() / 1000;
  // heroes
  const present = new Set();
  for(const c of s.h){
    present.add(c.side);
    if(!G.vis[c.side]){
      const d = G.details[c.side];
      if(!d){ if(!G.loadingDetail){ G.loadingDetail = true; getDetail(c.champId).then(dd => { G.details[c.side] = dd; G.loadingDetail = false; }).catch(() => { G.loadingDetail = false; }); } continue; }
      G.vis[c.side] = buildHeroVisual(d, c.side);
    }
    const v = G.vis[c.side], p = smoothPos("c:" + c.side, c.x, c.y, dt), w = XF(p.x, p.y), y = hAt(w.x, w.z);
    v.pos = { x: w.x, y, z: w.z };
    if(c.castSeq !== v.castSeq){ if(v.castSeq >= 0) v.castUntil = t + .35; v.castSeq = c.castSeq; }
    if(c.atkSeq !== v.atkSeq){ const fresh = v.atkSeq >= 0; v.atkSeq = c.atkSeq; if(fresh){ v.atkUntil = t + .22; playSound(() => sfxAt(ATTACK_SFX[v.kit.cls], c.x, c.y)); } }
    const sx = Math.sin(c.face); if(sx < -.15) v.flip = true; else if(sx > .15) v.flip = false;
    const tier = c.wglow ? 1 : 0;
    applyLook(v.art, c.gear && c.gear.equip);
    if((v.art.o.tier || 0) !== tier){ v.art.o.tier = tier; v.art.key = ""; }
    const pose = c.dead ? "dead" : t < v.castUntil ? "cast" : t < v.atkUntil ? "attack" : "idle";
    const frame = c.moving && !c.dead ? Math.floor(t * 9) % 4 : 0;
    if(v.art.draw(frame, v.flip, pose)) v.tex.needsUpdate = true;
    const hidden = !!c.stealth && c.side !== G.myTeam;
    v.hidden = hidden;
    v.spr.visible = !hidden;
    v.spr.material.opacity = c.stealth ? .45 : 1; v.spr.material.transparent = true;
    v.spr.material.rotation = c.dead ? Math.PI / 2 * (v.flip ? 1 : -1) : 0;
    v.spr.center.set(.5, c.dead ? .5 : 0);
    v.spr.position.set(w.x, y + (c.dead ? .5 : (c.moving ? Math.abs(Math.sin(t * 9 * Math.PI / 2)) * .06 : Math.sin(t * 2.5) * .02)), w.z);
    v.shadow.visible = v.ring.visible = !hidden && !c.dead;
    v.wglow.visible = !!c.wglow && !hidden && !c.dead;
    if(v.wglow.visible){ v.wglow.position.set(w.x + (v.flip ? -.6 : .6), y + 1.25, w.z); const gs = 1.1 + Math.sin(t * 4) * .25; v.wglow.scale.set(gs, gs, 1); }
    v.shadow.position.set(w.x, y + .02, w.z); v.ring.position.set(w.x, y + .03, w.z);
    v.bubble.visible = c.shield > 0 && !c.dead && !hidden; v.bubble.position.set(w.x, y + 1.25, w.z);
    v.aura.visible = !!c.buff && !c.dead && !hidden; v.aura.position.set(w.x, y + .06, w.z); v.aura.scale.setScalar(1 + Math.sin(t * 8) * .08);
    v.orbs.forEach((o, i) => {
      const on = c.orbN || 3;
      o.visible = !!c.orbT && !c.dead && !hidden && i < on;
      if(o.visible){ const extra = G.role === "guest" ? Math.min(.2, (performance.now() - NET.lastSnapAt) / 1000) * 3.2 : 0; const a = c.orbA + extra + i * Math.PI * 2 / on, ow = XF(p.x + Math.cos(a) * 230, p.y + Math.sin(a) * 230); o.position.set(ow.x, hAt(ow.x, ow.z) + 1, ow.z); }
    });
  }
  for(const side of Object.keys(G.vis)) if(!present.has(side)){ removeHeroVisual(G.vis[side]); delete G.vis[side]; G.smooth.delete("c:" + side); }
  // NPC markers follow your own quest state
  const meSnap = s.h.find(h => h.side === G.myTeam);
  for(const nv of G.npcVis){
    const qf = meSnap ? questFor(meSnap.quests, nv.n.id) : { state: "idle" };
    const mk = qf.state === "offer" ? "offer" : qf.state === "complete" ? "complete" : qf.state === "waiting" ? "progress" : null;
    nv.marker.visible = !!mk; if(mk) nv.marker.material = nv.marks[mk];
    const up = MARK_UP.setFromMatrixColumn(camera.matrixWorld, 1), mh = 3.65 + Math.sin(t * 3) * .1; // above the name, along the camera's up
    nv.marker.position.set(nv.pos.x + up.x * mh, nv.pos.y + up.y * mh, nv.pos.z + up.z * mh);
    if(meSnap){ const sx = Math.sign(XF(meSnap.x, meSnap.y).x - nv.pos.x); const fl = sx < 0; if(nv.art.draw(Math.floor(t * 1.2) % 2 ? 0 : 0, fl, "idle")) nv.tex.needsUpdate = true; }
  }
  // mobs
  const seenM = new Set();
  for(const m of s.m){
    const [id, kind, x, y, hp, maxHp, face, flags] = m; seenM.add(id);
    let mv = G.mobVis.get(id);
    if(!mv){
      const A = MOB_ART[kind] || MOB_ART.sheep;
      let c, art = null;
      if(A.char){ art = new CharArt({ style: A.style, drawHead: A.head }); c = art.canvas; }
      else { c = document.createElement("canvas"); c.width = A.cw; c.height = A.ch; }
      const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: .1 })); spr.center.set(.5, 0); spr.scale.set(A.sx, A.sy, 1);
      const sh = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .28, depthWrite: false })); sh.scale.setScalar(A.sh);
      mv = { kind, A, art, c, g: c.getContext("2d"), tex, spr, sh, key: "", flip: false, angryT: 0, buttT: 0, roarT: 0 };
      G.root.add(spr, sh); G.mobVis.set(id, mv);
    }
    const p = smoothPos(id, x, y, dt), w = XF(p.x, p.y), gy = hAt(w.x, w.z);
    const sx = Math.sin(face); if(sx < -.15) mv.flip = true; else if(sx > .15) mv.flip = false;
    const moving = flags & 1, angry = (flags & 2) > 0;
    const charging = (flags & 4) > 0, windup = (flags & 8) > 0;
    const frame = moving ? Math.floor(t * (charging ? 18 : angry ? 12 : 7)) % 4 : 0, key = frame + "|" + mv.flip + "|" + angry + "|" + (windup ? Math.floor(t * 30) : 0) + (mv.buttT > 0 ? "a" : "");
    if(key !== mv.key){ mv.key = key; if(mv.art) mv.art.draw(frame, mv.flip, mv.buttT > 0 ? "attack" : "idle", true); else mv.A.draw(mv.g, frame, mv.flip, angry, windup); mv.tex.needsUpdate = true; }
    mv.charging = charging; mv.windup = windup;
    mv.angryT = Math.max(0, mv.angryT - dt); mv.buttT = Math.max(0, mv.buttT - dt);
    const lunge = mv.buttT > 0 ? Math.sin((1 - mv.buttT / .25) * Math.PI) * .35 * (mv.flip ? -1 : 1) : 0;
    mv.spr.position.set(w.x + lunge, gy + (moving ? Math.abs(Math.sin(t * 14)) * .05 : 0), w.z);
    mv.sh.position.set(w.x, gy + .02, w.z);
    mv.hp = hp; mv.maxHp = maxHp; mv.angry = angry; mv.pos = { x: w.x, y: gy, z: w.z };
    if(charging && Math.random() < .5) G.fx.push({ k: "pop", x: p.x, y: p.y, t: 0, dur: .4 });
  }
  for(const [id, mv] of G.mobVis) if(!seenM.has(id)){ G.root.remove(mv.spr, mv.sh); mv.tex.dispose(); mv.spr.material.dispose(); mv.sh.material.dispose(); G.mobVis.delete(id); G.smooth.delete(id); }
  // quest loot (only the owner sees it)
  const seenL = new Set();
  for(const l of (s.l || [])){
    const [id, side, item, x, y, rar] = l; if(side !== G.myTeam) continue; seenL.add(id);
    let lv = G.lootVis.get(id);
    if(!lv){
      const c = document.createElement("canvas"); c.width = c.height = 64; if(item === "bag") drawBag(c.getContext("2d"), rar); else (QUEST_ITEM_ART[item] || drawTooth)(c.getContext("2d"));
      const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
      lv = { spr: new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })), glow: new THREE.Sprite(glowMat), beam: new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 6, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending })) };
      lv.spr.scale.set(.9, .9, 1); lv.glow.scale.set(2.2, 2.2, 1); G.root.add(lv.spr, lv.glow, lv.beam); G.lootVis.set(id, lv);
      if(item === "bag"){ lv.spr.scale.set(.75, .75, 1); lv.beam.visible = rar >= 1; lv.glow.visible = rar >= 1; if(rar >= 1){ lv.beam.material.color.set(RARITY[rar].c); } }
    }
    const w = XF(x, y), gy = hAt(w.x, w.z);
    lv.spr.position.set(w.x, gy + .7 + Math.sin(t * 3) * .12, w.z); lv.spr.material.rotation = Math.sin(t * 2) * .3;
    lv.glow.position.set(w.x, gy + .7, w.z); lv.glow.material.opacity = .6 + Math.sin(t * 5) * .3;
    lv.beam.position.set(w.x, gy + 3, w.z); lv.pos = { x: w.x, y: gy, z: w.z, id };
  }
  for(const [id, lv] of G.lootVis) if(!seenL.has(id)){ G.root.remove(lv.spr, lv.glow, lv.beam); lv.spr.material.map.dispose(); lv.spr.material.dispose(); lv.beam.geometry.dispose(); lv.beam.material.dispose(); G.lootVis.delete(id); }
  // gathering nodes show while you have a collect quest that needs their kind
  const want = wantedNodes(meSnap);
  for(const n of (s.n || [])){
    const [id, x, y, ready, kind] = n;
    let nv = G.nodeVis.get(id);
    if(!nv){
      nv = { spr: new THREE.Sprite(new THREE.SpriteMaterial({ map: nodeTexture(kind), transparent: true, depthWrite: false })), glow: new THREE.Sprite(glowMat) };
      nv.spr.scale.set(.8, .8, 1); nv.glow.scale.set(1.6, 1.6, 1); G.root.add(nv.spr, nv.glow); G.nodeVis.set(id, nv);
    }
    const w = XF(x, y), gy = hAt(w.x, w.z), vis = want.has(kind) && !!ready;
    nv.spr.visible = nv.glow.visible = vis;
    nv.spr.position.set(w.x, gy + .45, w.z); nv.glow.position.set(w.x, gy + .5, w.z); nv.glow.material.opacity = .5 + Math.sin(t * 4 + x) * .3;
  }
  // things to use (beacons, runes): lit once done, a glowing hint while the quest is active
  USE_POINTS.forEach((pt, i) => {
    const fxu = USE_FX[i]; if(!fxu) return;
    const q = meSnap && meSnap.quests[pt.quest], li = QUESTS[pt.quest].obj.points.indexOf(pt);
    const lit = !!(q && (q.state === "ready" || q.state === "done" || (q.flags && q.flags[li])));
    fxu.flame.visible = lit; fxu.hint.visible = !!(q && q.state === "active" && !lit);
    if(fxu.hint.visible){ const sc = 2 + Math.sin(t * 4) * .5; fxu.hint.scale.set(sc, sc, 1); }
  });
  // beams over places still to explore
  for(const ef of EXPLORE_FX){ const q = meSnap && meSnap.quests[ef.quest]; ef.beam.visible = !!(q && q.state === "active" && !(q.flags && q.flags[ef.i])); }
  // the ring around a place you're defending
  for(const qid in DEFEND_FX){
    const ring = DEFEND_FX[qid], q = meSnap && meSnap.quests[qid];
    ring.visible = !!(q && q.state === "active");
    if(ring.visible){ ring.scale.setScalar((q.phase ? 1150 : 550) * ZSC); ring.material.color.set(q.phase ? 0xff5040 : 0xffd84a); ring.material.opacity = .55 + Math.sin(t * 4) * .2; }
  }
  // projectiles
  const seen = new Set();
  for(const sh of s.s){
    const [id, kind, x, y, owner, slot] = sh; seen.add(id);
    let spr = G.shotVis.get(id);
    if(!spr){
      const ov = G.vis[owner.slice(2)], skill = (kind === "sk" || kind === "hook") && ov;
      spr = new THREE.Sprite(skill ? ov.mats[slot] : glowMat); const sc = skill ? (slot === "R" ? 1.1 : .7) : .7; spr.scale.set(sc, sc, 1);
      if(skill){ const gl = new THREE.Sprite(glowMat); gl.scale.set(2.2, 2.2, 1); spr.add(gl); }
      G.root.add(spr); G.shotVis.set(id, spr);
    }
    const p = smoothPos(id, x, y, dt), w = XF(p.x, p.y); spr.position.set(w.x, hAt(w.x, w.z) + 1.2, w.z);
  }
  for(const [id, spr] of G.shotVis) if(!seen.has(id)){ G.root.remove(spr); G.shotVis.delete(id); G.smooth.delete(id); }
  // delayed blasts
  const zs = new Set();
  for(const z of s.z){
    const [id, x, y, r, tl, dur, slot, owner] = z; zs.add(id);
    let zv = G.zoneVis.get(id);
    if(!zv){
      const ov = G.vis[owner.slice(2)];
      zv = { disc: new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: .2, depthWrite: false })),
        edge: new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: .9, depthWrite: false })),
        icon: new THREE.Sprite(ov ? ov.mats[slot] : glowMat) };
      zv.icon.scale.set(1.1, 1.1, 1); G.root.add(zv.disc, zv.edge, zv.icon); G.zoneVis.set(id, zv);
    }
    const w = XF(x, y), hy = hAt(w.x, w.z) + .06, R = r * ZSC, k = 1 - tl / dur;
    zv.disc.position.set(w.x, hy, w.z); zv.disc.scale.setScalar(Math.max(.01, R * k));
    zv.edge.position.set(w.x, hy + .01, w.z); zv.edge.scale.setScalar(R);
    zv.icon.position.set(w.x, hy + 4 - 3 * k, w.z);
  }
  for(const [id, zv] of G.zoneVis) if(!zs.has(id)){ G.root.remove(zv.disc, zv.edge, zv.icon); zv.disc.material.dispose(); zv.edge.material.dispose(); G.zoneVis.delete(id); }
  // lingering zones
  const fs = new Set();
  for(const f of s.f){
    const [id, x, y, r, slot, owner] = f; fs.add(id);
    let fv = G.fieldVis.get(id);
    if(!fv){
      const ov = G.vis[owner.slice(2)];
      fv = { disc: new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: 0x8a6cff, transparent: true, opacity: .22, depthWrite: false })),
        edge: new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xb59cff, transparent: true, opacity: .7, depthWrite: false })),
        icon: new THREE.Sprite(ov ? ov.mats[slot] : glowMat) };
      fv.icon.scale.set(.8, .8, 1); G.root.add(fv.disc, fv.edge, fv.icon); G.fieldVis.set(id, fv);
    }
    const w = XF(x, y), hy = hAt(w.x, w.z) + .05, R = r * ZSC;
    fv.disc.position.set(w.x, hy, w.z); fv.disc.scale.setScalar(R);
    fv.edge.position.set(w.x, hy + .01, w.z); fv.edge.scale.setScalar(R * (1 + Math.sin(t * 4) * .03));
    fv.icon.position.set(w.x, hy + 1.4 + Math.sin(t * 3) * .1, w.z);
  }
  for(const [id, fv] of G.fieldVis) if(!fs.has(id)){ G.root.remove(fv.disc, fv.edge, fv.icon); fv.disc.material.dispose(); fv.edge.material.dispose(); G.fieldVis.delete(id); }
  // summoned allies
  const ps = new Set();
  for(const pt of s.p){
    const [id, x, y, slot, owner] = pt; ps.add(id);
    let pv = G.petVis.get(id);
    if(!pv){
      const ov = G.vis[owner.slice(2)];
      pv = new THREE.Group();
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(.35, .5, .5, 8), new THREE.MeshLambertMaterial({ color: 0x6a5a8a })); ped.position.y = .25;
      const icon = new THREE.Sprite(ov ? ov.mats[slot] : glowMat); icon.scale.set(1.1, 1.1, 1); icon.position.y = 1.3;
      pv.add(ped, icon); G.root.add(pv); G.petVis.set(id, pv);
    }
    const w = XF(x, y); pv.position.set(w.x, hAt(w.x, w.z), w.z); pv.children[1].position.y = 1.3 + Math.sin(t * 3) * .12;
  }
  for(const [id, pv] of G.petVis) if(!ps.has(id)){ G.root.remove(pv); pv.children[0].geometry.dispose(); pv.children[0].material.dispose(); G.petVis.delete(id); }
  // effects
  for(const f of G.fx){
    if(!f.mesh) fxMesh(f);
    const k = f.t / f.dur;
    if(f.k === "lvl" || f.k === "heal"){ const v = G.vis[f.side]; if(v && v.pos){ f.mesh.position.set(v.pos.x, v.pos.y + .1 + k * 2, v.pos.z); f.mesh.scale.setScalar(.9 - .3 * k); f.mesh.material.opacity = 1 - k; } continue; }
    const w = XF(f.x, f.y), fy = hAt(w.x, w.z) + .05, R = (f.r || 60) * ZSC;
    if(f.k === "click"){ f.mesh.position.set(w.x, fy, w.z); f.mesh.scale.setScalar(.45 * (1 - .6 * k)); f.mesh.material.opacity = 1 - k; }
    else if(f.k === "ring"){ f.mesh.position.set(w.x, fy, w.z); f.mesh.scale.setScalar(R * (.55 + .45 * k)); f.mesh.material.opacity = 1 - k; }
    else if(f.k === "hit" || f.k === "pop"){ f.mesh.position.set(w.x, fy + .5, w.z); f.mesh.scale.setScalar(.3 + k * (f.k === "pop" ? 1.2 : .6)); f.mesh.material.opacity = 1 - k; }
    else if(f.k === "cone"){ f.mesh.position.set(w.x, fy + .02, w.z); f.mesh.scale.setScalar(R * (.7 + .3 * k)); f.mesh.material.opacity = .45 * (1 - k); }
    else if(f.k === "warn"){ f.mesh.position.set(w.x, fy + .03, w.z); f.mesh.scale.setScalar(R); f.mesh.material.opacity = .22 + .2 * Math.abs(Math.sin(t * 9)) + .2 * k; }
    else if(f.k === "blink"){ const w2 = XF(f.x2, f.y2); f.mesh.position.set(w.x, fy, w.z); f.mesh.scale.setScalar(.4 + k * .8); f.mesh.material.opacity = 1 - k; f.edge.position.set(w2.x, hAt(w2.x, w2.z) + .05, w2.z); f.edge.scale.setScalar(1.2 - k * .8); f.edge.material.opacity = 1 - k; }
    else if(f.k === "nova"){ const rr = R * (.4 + .6 * k); f.mesh.position.set(w.x, fy, w.z); f.mesh.scale.setScalar(rr); f.mesh.material.opacity = .32 * (1 - k); f.edge.position.set(w.x, fy + .01, w.z); f.edge.scale.setScalar(rr); f.edge.material.opacity = 1 - k; }
  }
  // campfire flicker
  fireLight.intensity = 1.2 + Math.sin(t * 13) * .15 + Math.sin(t * 7.3) * .1;
  fireFlames.forEach((fl, i) => { fl.scale.set(1, 1 + Math.sin(t * (10 + i * 3)) * .15, 1); });

  // camera
  const me = G.vis[G.myTeam] && G.vis[G.myTeam].pos;
  if(me){
    scene.fog.near = camDist * 1.8; scene.fog.far = camDist * 4.2;
    camera.position.set(me.x, me.y + camDist * .8, me.z + camDist * .6); camera.lookAt(me.x, me.y + .8, me.z);
    if(meSnap) updateClimate(dt, meSnap.y, me);
  }
  renderer.render(scene, camera);

  // overlay
  octx.setTransform(dpr, 0, 0, dpr, 0, 0); octx.clearRect(0, 0, VW, VH); octx.textAlign = "center";
  const label = (text, x, y, color, size = 13, weight = 600) => { octx.font = `${weight} ${size}px 'Barlow Condensed', sans-serif`; octx.lineWidth = 3; octx.strokeStyle = "rgba(0,0,0,.75)"; octx.strokeText(text, x, y); octx.fillStyle = color; octx.fillText(text, x, y); };
  // sprites face the camera, so their top is along the camera's up direction, not straight up in the world
  const camUp = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const spriteTop = (p, h) => worldToScreen(p.x + camUp.x * h, p.y + camUp.y * h, p.z + camUp.z * h);
  for(const nv of G.npcVis){ const [sx, sy, sz] = spriteTop(nv.pos, 2.4); if(sz < 1){ label(`<${nv.n.name}>`, sx, sy - (nv.n.title ? 20 : 6), "#ffd84a", 14); if(nv.n.title) label(nv.n.title, sx, sy - 5, "#e8e2d4", 12, 500); } }
  for(const [, mv] of G.mobVis){
    if(!mv.pos) continue;
    const ET = MOBS[mv.kind];
    if(ET.elite){
      const [bx, ty, bz] = spriteTop(mv.pos, mv.A.sy), by = ty - 12, bw = ET.boss ? 160 : 90; if(bz > 1) continue;
      octx.fillStyle = "rgba(0,0,0,.65)"; octx.fillRect(bx - bw / 2, by, bw, 7);
      octx.fillStyle = "#d9545b"; octx.fillRect(bx - bw / 2, by, bw * Math.max(0, mv.hp / mv.maxHp), 7);
      label(`${ET.name}  ·  ${ET.lvl}`, bx, by - 6, "#ffb070", ET.boss ? 18 : 15, 700); label(ET.boss ? "Rare Raid Boss" : "Elite", bx, by - (ET.boss ? 25 : 21), ET.boss ? "#ff8a1e" : "#f0d58e", ET.boss ? 13 : 11, 700);
      if(mv.windup) label("!", bx, by - 36, "#ff5040", 26, 700);
      continue;
    }
    const T = MOBS[mv.kind], [sx, sy, sz] = worldToScreen(mv.pos.x, mv.pos.y + (mv.A ? mv.A.plate : 1.35), mv.pos.z); if(sz > 1) continue;
    if(mv.hp < mv.maxHp || mv.angry || T.aggroR){
      octx.fillStyle = "rgba(0,0,0,.6)"; octx.fillRect(sx - 24, sy, 48, 5);
      octx.fillStyle = T.aggroR ? "#d9545b" : "#d9b23a"; octx.fillRect(sx - 24, sy, 48 * Math.max(0, mv.hp / mv.maxHp), 5);
      // name, then the level coloured by difficulty: grey (no XP), normal, orange (2–3 above you), red (4+ above)
      const name = `${mv.kind === "sheep" && mv.angry ? "Angry Sheep" : T.name}  ·  `, lv = String(T.lvl), gap = meSnap ? T.lvl - meSnap.lvl : 0;
      octx.font = "600 12px 'Barlow Condensed', sans-serif";
      const wn = octx.measureText(name).width, wl = octx.measureText(lv).width, x0 = sx - (wn + wl) / 2;
      label(name, x0 + wn / 2, sy - 4, T.aggroR || mv.angry ? "#ff8a70" : "#f3ead2", 12);
      label(lv, x0 + wn + wl / 2, sy - 4, gap >= 4 ? "#ff4a3a" : gap >= 2 ? "#ffa040" : gap <= -5 ? "#9a9a9a" : "#f3ead2", 12, 700);
    }
  }
  for(const c of s.h){
    const v = G.vis[c.side]; if(!v || !v.pos || v.hidden || c.dead) continue;
    const [sx, ty, sz] = spriteTop(v.pos, 2.55), sy = ty - 12; if(sz > 1) continue; // health bar just above the head
    const mine = c.side === G.myTeam, wdt = 80;
    octx.fillStyle = "rgba(5,8,14,.75)"; octx.fillRect(sx - wdt / 2 - 2, sy - 2, wdt + 4, 10);
    const ally = !mine && inMyParty(c.side);
    octx.fillStyle = mine ? "#3fbf7f" : ally ? "#5fb0ff" : "#a8adb8"; octx.fillRect(sx - wdt / 2, sy, wdt * Math.max(0, c.hp / c.maxHp), 6);
    if(c.shield > 0){ octx.fillStyle = "rgba(230,240,255,.9)"; octx.fillRect(sx - wdt / 2, sy + 5, Math.min(wdt, wdt * c.shield / c.maxHp), 2); }
    label(`${c.name}  ·  ${c.lvl}`, sx, sy - 6, mine ? "#f0d58e" : ally ? "#8fc7ff" : "#e4e4e4", 13);
    if(c.cc) label({ stun: "STUNNED", root: "ROOTED", slow: "SLOWED" }[c.cc], sx, sy - 22, c.cc === "stun" ? "#f0d58e" : c.cc === "root" ? "#b98cff" : "#7fd3ff", 12, 700);
  }
  // objective arrow around your character
  if(meSnap && !meSnap.dead && G.vis[G.myTeam] && G.vis[G.myTeam].pos){
    const ot = objectiveTarget(meSnap);
    if(ot){
      const tgt = [ot.x, ot.y];
      const dist = Math.hypot(tgt[0] - meSnap.x, tgt[1] - meSnap.y);
      if(dist > 900){
        const me2 = G.vis[G.myTeam].pos, [px, py] = worldToScreen(me2.x, me2.y + 1, me2.z), tw = XF(tgt[0], tgt[1]), [tx, ty] = worldToScreen(tw.x, hAt(tw.x, tw.z), tw.z);
        const a = Math.atan2(ty - py, tx - px), R = 92, ax = px + Math.cos(a) * R, ay = py + Math.sin(a) * R;
        octx.save(); octx.translate(ax, ay); octx.rotate(a);
        octx.fillStyle = "#ffd84a"; octx.strokeStyle = "#1b1410"; octx.lineWidth = 3;
        octx.beginPath(); octx.moveTo(16, 0); octx.lineTo(-8, -11); octx.lineTo(-3, 0); octx.lineTo(-8, 11); octx.closePath(); octx.stroke(); octx.fill();
        octx.restore();
        label(`${Math.round(dist / 100)}m`, ax, ay + 24, "#ffe9a8", 12, 700);
      }
    }
  }
  for(const n of G.nums){
    const w = XF(n.x, n.y), [sx, sy, sz] = worldToScreen(w.x, hAt(w.x, w.z) + n.h, w.z); if(sz > 1) continue;
    octx.globalAlpha = Math.min(1, n.t / .3); label(String(n.v), sx, sy, n.color || "#fff", n.big ? 17 : n.hero ? 17 : 14, 700);
  }
  octx.globalAlpha = 1;
}

/* ---------- Main loop ---------- */
let hudTick = 0, pingTick = 0;
function frame(now){
  requestAnimationFrame(frame);
  if(!G) return;
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if(G.role === "host"){
    let rest = dt; while(rest > 0){ const st = Math.min(1 / 60, rest); SIM.step(G.W, st); rest -= st; }
    G.snap = SIM.snapshot(G.W);
    for(const f of G.W.fxLocal) G.fxQueue.push(f); G.W.fxLocal.length = 0;
    G.sendT -= dt;
    if(!NET.guests.size) G.W.fxNet.length = 0;
    else if(G.sendT <= 0){ G.sendT = .05; netBroadcast(G.snap, G.W.fxNet); G.W.fxNet = []; }
  }else{
    pingTick -= dt;
    if(pingTick <= 0){ pingTick = 2; NET.pingId = Math.random(); NET.pingSent = performance.now(); send({ t: "ping", id: NET.pingId }); }
  }
  if(rmb){ G.holdT -= dt; if(G.holdT <= 0){ G.holdT = .15; rightClick(G.mouse.x, G.mouse.y, true); } }
  while(G.fxQueue.length) handleFx(G.fxQueue.shift());
  for(const f of G.fx){ f.t += dt; if(f.t >= f.dur) removeFxMesh(f); } G.fx = G.fx.filter(f => f.t < f.dur);
  for(const n of G.nums){ n.t -= dt; n.h += .9 * dt; } G.nums = G.nums.filter(n => n.t > 0);
  render(dt);
  if((hudTick = (hudTick + 1) % 3) === 0) updateHud();
  // close the dialog if you walk away from the NPC
  if(G.shop){ const me = G.snap.h.find(h => h.side === G.myTeam), npc = NPCS.find(n => n.id === G.shop); if(!me || Math.hypot(me.x - npc.x, me.y - npc.y) > 700) closeShop(); }
  if(G.dialog){ const me = G.snap.h.find(h => h.side === G.myTeam), npc = NPCS.find(n => n.id === G.dialog.npc); if(!me || Math.hypot(me.x - npc.x, me.y - npc.y) > 700) closeDialog(); }
}
requestAnimationFrame(frame);
boot();
