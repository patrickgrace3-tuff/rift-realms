"use strict";
// Entering and leaving the world, hero visuals, input, quest dialog.

/* =====================================================================
   WORLD: rendering, input, HUD, quests (host and guest)
   ===================================================================== */
let G = null, last = 0;
function startWorld(opts){
  leaveWorld(true);
  const myTeam = opts.role === "host" ? "blue" : opts.me;
  const root = new THREE.Group(); scene.add(root);
  G = { role: opts.role, myTeam, details: Object.assign({}, opts.details), root, xf: XF,
    W: null, snap: null, fxQueue: [], vis: {}, mobVis: new Map(), lootVis: new Map(), nodeVis: new Map(), sel: null, charKey: "", focusQuest: null, trHtml: "", shotVis: new Map(), zoneVis: new Map(), fieldVis: new Map(), petVis: new Map(), npcVis: [],
    fx: [], nums: [], chatCh: "world", duelVis: new Map(), sendT: 0, holdT: 0, mouse: { x: VW / 2, y: VH / 2 }, smooth: new Map(), dialog: null };
  let loaded = false;
  if(opts.role === "host"){ G.W = SIM.create(); const h = SIM.addHero(G.W, "blue", opts.details.blue); loaded = SIM.loadSave(G.W, h, opts.save); G.snap = SIM.snapshot(G.W); }
  zone.visible = true;
  scene.fog = new THREE.Fog(0x9ccbe8, 40, 95);
  buildNpcs();
  const me = G.details[myTeam];
  $("#hudHead").src = champIcon(me.id); $("#hudName").textContent = me.name;
  const startZone = opts.role === "host" ? zoneAt(G.W.heroes.blue.y, G.W.heroes.blue.x) : ZONES[0];
  $("#inviteBtn").hidden = opts.role !== "host"; $("#mmZone").textContent = startZone.name;
  buildSlots(); resetSocial();
  for(const s of ["#menu", "#notice"]) $(s).hidden = true;
  show("game"); last = performance.now();
  banner(startZone.name, loaded ? `Welcome back · Level ${G.W.heroes.blue.lvl}` : opts.role === "host" ? "Starting zone" : "Joined your friend's world", 3500);
  playMusic(startZone.key); // started by the click that entered the world, so the browser allows it
}
function leaveWorld(keepNet){
  if(!keepNet) netClose();
  if(!G) return;
  writeSave();
  if(!keepNet) stopMusic();
  scene.remove(G.root); zone.visible = false; scene.fog = null; G = null;
  $("#dialog").hidden = true; $("#hud").hidden = true; $("#cv").hidden = true; $("#ov").hidden = true;
  $("#skills").hidden = true; $("#bigmap").hidden = true; $("#charWin").hidden = true; $("#lootFeed").innerHTML = "";
  $("#social").hidden = true;
  const mui = document.getElementById("mobUI"); if(mui) mui.hidden = true;
}
function buildNpcs(){
  for(const n of NPCS){
    const art = new CharArt({ style: n.style, drawHead: HEADS[n.head] }), model = new Humanoid3D(art);
    const marks = { offer: new THREE.SpriteMaterial({ map: markerTexture("!", "#ffd84a"), transparent: true, depthWrite: false }),
      progress: new THREE.SpriteMaterial({ map: markerTexture("?", "#b8b8b8"), transparent: true, depthWrite: false }),
      complete: new THREE.SpriteMaterial({ map: markerTexture("?", "#ffd84a"), transparent: true, depthWrite: false }) };
    const marker = new THREE.Sprite(marks.offer); marker.scale.set(.9, .9, 1);
    const w = XF(n.x, n.y), y = hAt(w.x, w.z);
    model.root.position.set(w.x, y, w.z); marker.position.set(w.x, y + 3.1, w.z);
    const shadow = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .3, depthWrite: false })); shadow.scale.setScalar(.6); shadow.position.set(w.x, y + .02, w.z);
    G.root.add(model.root, marker, shadow);
    G.npcVis.push({ n, model, marker, marks, art, pos: { x: w.x, y, z: w.z } });
  }
}

/* ---------- Hero visuals ---------- */
function buildHeroVisual(d, side){
  const kit = buildKit(d), sideCol = SIDE_COLOR[side] || "#7fd3ff", ringCol = side === "blue" ? "#c9a55c" : sideCol;
  const art = new CharArt({ style: kit.cls, headUrl: champIcon(d.id), ring: ringCol, initial: d.name[0] });
  const model = new Humanoid3D(art);
  art.onload = () => { model.headKey = null; };   // the portrait arrived: redraw the head
  const v = { side, d, kit, art, model, castUntil: 0, atkUntil: 0, castSeq: -1, atkSeq: -1, pos: null, jumpAt: 0 };
  v.shadow = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .32, depthWrite: false })); v.shadow.scale.setScalar(.65);
  v.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: sideCol, transparent: true, opacity: .7, depthWrite: false })); v.ring.scale.setScalar(.75);
  v.mats = {}; ["Q", "W", "E", "R"].forEach((k, i) => { v.mats[k] = spriteMat(spellIcon(d.spells[i].image.full), "#f0d58e"); });
  const orbKey = ["Q", "W", "E", "R"].find(k => kit[k].type === "orbit") || "W";
  v.bubble = new THREE.Mesh(new THREE.SphereGeometry(1.25, 20, 14), new THREE.MeshBasicMaterial({ color: 0x9fe6ff, transparent: true, opacity: .22, depthWrite: false }));
  v.aura = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xf0d58e, transparent: true, opacity: .85, depthWrite: false }));
  v.bubble.visible = v.aura.visible = false;
  const glowCol = { melee: 0xffb347, caster: 0xc98cff, ranged: 0x8cff9a }[kit.cls];
  v.wglow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMat.map, color: glowCol, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); v.wglow.visible = false; G.root.add(v.wglow);
  v.orbs = [0, 1, 2, 3].map(() => { const o = new THREE.Sprite(v.mats[orbKey]); o.scale.set(.7, .7, 1); const gl = new THREE.Sprite(glowMat); gl.scale.set(1.8, 1.8, 1); o.add(gl); o.visible = false; return o; });
  G.root.add(model.root, v.shadow, v.ring, v.bubble, v.aura, ...v.orbs);
  return v;
}
function removeHeroVisual(v){ G.root.remove(v.model.root, v.shadow, v.ring, v.bubble, v.aura, v.wglow, ...v.orbs); if(v.setFx) G.root.remove(v.setFx.grp); v.model.dispose(); }

/* ---------- Input ---------- */
function screenToZone(cx, cy){
  const me = G.vis[G.myTeam], h = me && me.pos ? me.pos.y : 0;
  raycaster.setFromCamera(new THREE.Vector2(cx / VW * 2 - 1, -(cy / VH) * 2 + 1), camera);
  // walk along the ray until it meets the ground, so clicks on hills land where you clicked
  const o = raycaster.ray.origin, d = raycaster.ray.direction;
  // (if the camera itself is inside a hill, skip ahead to where the ray comes out into the open first)
  let prev = 0, open = false;
  for(let t = .3; t < 260; t += t < 90 ? .3 : .9){
    const under = o.y + d.y * t <= hAt(o.x + d.x * t, o.z + d.z * t);
    if(!open){ open = !under; prev = t; continue; }
    if(under){
      let a = prev, b = t;
      for(let i = 0; i < 8; i++){ const m = (a + b) / 2; if(o.y + d.y * m <= hAt(o.x + d.x * m, o.z + d.z * m)) b = m; else a = m; }
      return XF.inv(o.x + d.x * b, o.z + d.z * b);
    }
    prev = t;
  }
  const hit = new THREE.Vector3();   // nothing hit (the sky, or past the haze): fall back to the level of your feet
  if(!raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -h), hit)) return null;
  return XF.inv(hit.x, hit.z);
}
// z > 1 means "don't draw": behind the camera, or lost in the haze (so far-off name plates don't show through the horizon)
function worldToScreen(x, y, z){ const far = scene && scene.fog && camera.position.distanceToSquared(projV.set(x, y, z)) > scene.fog.far * scene.fog.far;
  projV.project(camera); return [(projV.x + 1) / 2 * VW, (1 - projV.y) / 2 * VH, far ? 2 : projV.z]; }
function command(cmd){ if(!G) return; if(G.role === "host") SIM.input(G.W, G.myTeam, cmd); else send(Object.assign({ t: "in" }, cmd)); }
// Where a point shows on screen, or null when it's behind the camera or lost in the haze. With the orbiting camera,
// things behind you would otherwise be mirrored onto the screen and could be clicked by mistake.
function screenSpot(x, y, z){ const [sx, sy, sz] = worldToScreen(x, y, z); return sz < 1 && sz > -1 ? [sx, sy] : null; }
function thingUnderCursor(cx, cy){
  for(let i = 0; i < USE_POINTS.length; i++){ const b = USE_POINTS[i], w = XF(b.x, b.y), s = screenSpot(w.x, hAt(w.x, w.z) + 1.3, w.z); if(s && Math.abs(s[0] - cx) < 40 && Math.abs(s[1] - cy) < 60) return { use: i }; }
  for(const [id, nv] of G.nodeVis){ if(!nv.clickable || !nv.at) continue; const s = screenSpot(nv.at.x, nv.at.y, nv.at.z); if(s && Math.hypot(s[0] - cx, s[1] - cy) < 44) return { gather: id }; }
  for(const [, lv] of G.lootVis){ if(!lv.pos) continue; const s = screenSpot(lv.pos.x, lv.pos.y + .7, lv.pos.z); if(s && Math.hypot(s[0] - cx, s[1] - cy) < 40) return { pickup: lv.pos.id }; }
  for(const nv of G.npcVis){ const s = screenSpot(nv.pos.x, nv.pos.y + 1.4, nv.pos.z); if(s && Math.abs(s[0] - cx) < 40 && Math.abs(s[1] - cy) < 70) return { npc: nv.n.id }; }
  // your duel opponent can be attacked like a creature
  for(const h of G.snap.h){ if(!duelFoe(h.side) || h.dead) continue; const v = G.vis[h.side]; if(!v || !v.pos) continue; const s = screenSpot(v.pos.x, v.pos.y + 1.2, v.pos.z); if(s && Math.abs(s[0] - cx) < 40 && Math.abs(s[1] - cy) < 70) return { atk: "c:" + h.side }; }
  let best = null, bd = 1e9;
  for(const m of G.snap.m){
    if(m[7] & 16) continue; // hidden
    // click anywhere on the creature's body; big ones (the dragon) have a big target
    const A = MOB_ART[m[1]] || MOB_ART.sheep, p = G.smooth.get(m[0]) || { x: m[2], y: m[3] }, w = XF(p.x, p.y), gy = hAt(w.x, w.z);
    const s = screenSpot(w.x, gy + A.sy * .4, w.z); if(!s) continue;
    const e = screenSpot(w.x + A.sx * .45, gy + A.sy * .4, w.z), reach = Math.min(260, Math.max(46, e ? Math.abs(e[0] - s[0]) : 46));
    const d = Math.hypot(s[0] - cx, s[1] - cy); if(d < reach && d / reach < bd){ bd = d / reach; best = { atk: m[0] }; }
  }
  return best;
}
function rightClick(cx, cy, held){
  if(!G || !G.snap) return;
  if(held && G.lastRC !== "move") return;
  const t = held ? null : thingUnderCursor(cx, cy);
  if(t && t.npc){ G.lastRC = "talk"; command({ talk: t.npc }); return; }
  if(t && t.atk){ G.lastRC = "atk"; command({ atk: t.atk }); return; }
  if(t && t.pickup){ G.lastRC = "pickup"; command({ pickup: t.pickup }); return; }
  if(t && t.use !== undefined){ G.lastRC = "use"; command({ use: t.use }); return; }
  if(t && t.gather){ G.lastRC = "gather"; command({ gather: t.gather }); return; }
  G.lastRC = "move";
  const p = screenToZone(cx, cy); if(!p) return;
  command({ move: [Math.round(p[0]), Math.round(p[1])] });
  if(!held) G.fx.push({ k: "click", x: p[0], y: p[1], t: 0, dur: .35 });
}
let rmb = false;
cv.addEventListener("contextmenu", e => e.preventDefault());
cv.addEventListener("pointerdown", e => { if(!G || e.pointerType !== "mouse") return; if(e.button === 2){ rmb = true; rightClick(e.clientX, e.clientY, false); G.holdT = .2; } });
addEventListener("pointermove", e => {
  if(G){ G.mouse.x = e.clientX; G.mouse.y = e.clientY; }
  // trust what the mouse says is held right now: a button let go outside the window never sends its "up",
  // and a stuck button used to keep you running (both buttons) or steering toward the cursor (right button)
  if(e.pointerType === "mouse"){ if(!(e.buttons & 2)) rmb = false; bothMouse = (e.buttons & 3) === 3; if(!(e.buttons & 5)) camDrag = null; }
});
addEventListener("pointerup", e => { if(e.button === 2) rmb = false; });
cv.addEventListener("wheel", e => { e.preventDefault(); camDist = Math.max(12, Math.min(36, camDist + Math.sign(e.deltaY) * 2)); }, { passive: false });
// hold the left (or middle) mouse button and drag to turn the camera around you; double-click puts it back behind.
// Holding both buttons runs forward while the mouse steers. (Mouse events, not pointer events: a second button pressed
// while one is held gives no pointerdown.)
let camDrag = null, bothMouse = false;
cv.addEventListener("mousedown", e => {
  if(!G) return; bothMouse = (e.buttons & 3) === 3;
  if(e.button === 0 || e.button === 1 || bothMouse){ e.preventDefault(); if(!camDrag) camDrag = { x: e.clientX, y: e.clientY }; }
});
addEventListener("mouseup", e => { bothMouse = (e.buttons & 3) === 3; if(!(e.buttons & 5) && !bothMouse) camDrag = null; });
addEventListener("pointermove", e => {
  if(!camDrag) return;
  const dx = e.clientX - camDrag.x, dy = e.clientY - camDrag.y; camDrag.x = e.clientX; camDrag.y = e.clientY;
  camYaw -= dx * .006; const b = camBasePitch(); camTilt = Math.max(CAM_PITCH[0] - b, Math.min(CAM_PITCH[1] - b, camTilt + dy * .004));
});
cv.addEventListener("dblclick", () => { camYaw = 0; camTilt = 0; });

/* ---------- Movement keys ----------
   Arrow keys always run (up/down) and turn (left/right). With WASD controls (the default), W/S run, A/D step
   sideways, Q/E turn, and the abilities move to 1 2 3 4. Space jumps in either scheme. Classic controls keep Q W E R for abilities and S to stop.
   Keyboard running sends ordinary "move" commands a short way ahead, so the host needs nothing new. */
let CONTROLS = (() => { try { return localStorage.getItem("rr.controls") === "classic" ? "classic" : "wasd"; } catch { return "wasd"; } })();
const ABILITY_DIGITS = { "1": "Q", "2": "W", "3": "E", "4": "R" };
const keyLabel = k => CONTROLS === "wasd" ? ({ Q: "1", W: "2", E: "3", R: "4" }[k] || k) : k;
const MOVE_KEYS = () => CONTROLS === "wasd"
  ? { fwd: ["ARROWUP", "W"], back: ["ARROWDOWN", "S"], left: ["ARROWLEFT", "Q"], right: ["ARROWRIGHT", "E"], sl: ["A"], sr: ["D"] }
  : { fwd: ["ARROWUP"], back: ["ARROWDOWN"], left: ["ARROWLEFT"], right: ["ARROWRIGHT"], sl: [], sr: [] };
const keysDown = new Set();
const TURN_RATE = 2.2;     // radians a second
function setControls(mode){
  CONTROLS = mode === "classic" ? "classic" : "wasd"; keysDown.clear();
  try { localStorage.setItem("rr.controls", CONTROLS); } catch {}
  if(G && G.slotKeys) buildSlots();
  updateControlsText();
}
function updateControlsText(){
  const b = $("#ctrlBtn"); if(b){ b.textContent = CONTROLS === "wasd" ? "WASD" : "Classic"; b.setAttribute("aria-pressed", String(CONTROLS === "wasd")); }
  const h = $("#helpline"); if(h) h.textContent = CONTROLS === "wasd"
    ? "W S run · A D step aside · Q E turn · Space jump · 1 2 3 4 abilities · drag to look · both buttons run · right-click to move, attack, talk or pick up · F potion · T talk · C character · K skills · M map · P players · Enter chat"
    : "Right-click to move, attack, talk or pick up · Q W E R abilities · arrow keys run and turn · Space jump · drag to look · both buttons run · F potion · T talk · C character · K skills · M map · P players · Enter chat · S stop";
}
// called every frame from the render loop
const MOB_STICK = { on: false, x: 0, y: 0 };   // the phone joystick (08f-mobile.js): x right, y down, each −1…1
function keyMove(dt){
  if(!G || !G.snap) return;
  const K = MOVE_KEYS(), on = list => list.some(k => keysDown.has(k));
  const turn = (on(K.right) ? 1 : 0) - (on(K.left) ? 1 : 0);
  if(turn) camYaw -= turn * TURN_RATE * dt;
  let f = (on(K.fwd) || bothMouse ? 1 : 0) - (on(K.back) ? 1 : 0), s = (on(K.sr) ? 1 : 0) - (on(K.sl) ? 1 : 0);
  if(MOB_STICK.on && Math.hypot(MOB_STICK.x, MOB_STICK.y) > .2){ f = -MOB_STICK.y; s = MOB_STICK.x; }
  G.keyMoveT = (G.keyMoveT || 0) - dt;
  if(!f && !s){ if(G.keyMoving){ G.keyMoving = false; command({ stop: 1 }); } return; }
  const dirKey = Math.round(f * 6) + "," + Math.round(s * 6);
  if(G.keyMoveT > 0 && G.keyMoveDir === dirKey) return;   // resend a few times a second (and at once when the direction changes)
  const me = G.snap.h.find(h => h.side === G.myTeam); if(!me || me.dead) return;
  // forward is away from the camera; sideways is screen-right
  const fx = -Math.sin(camYaw), fy = Math.cos(camYaw), rx = Math.cos(camYaw), ry = Math.sin(camYaw);
  let dx = fx * f + rx * s, dy = fy * f + ry * s; const n = Math.hypot(dx, dy); dx /= n; dy /= n;
  G.keyMoveT = .12; G.keyMoving = true; G.keyMoveDir = dirKey;
  command({ move: [Math.round(clampX(me.x + dx * 380)), Math.round(clampY(me.y + dy * 380))] });
}
addEventListener("keyup", e => { keysDown.delete(e.key.toUpperCase()); });
addEventListener("blur", () => { keysDown.clear(); camDrag = null; bothMouse = false; });
addEventListener("keydown", e => {
  if(!G || e.repeat) return;
  if(e.target.tagName === "INPUT") return;
  const k = e.key.toUpperCase(), K = MOVE_KEYS();
  if([K.fwd, K.back, K.left, K.right, K.sl, K.sr].some(l => l.includes(k))){ e.preventDefault(); keysDown.add(k); return; }
  if(e.key === " "){ e.preventDefault(); command({ jump: 1 }); return; }
  const ab = CONTROLS === "wasd" ? (ABILITY_DIGITS[k] || (k === "G" ? "G" : null)) : k;
  if(ab && kitKeys(G.myKit).includes(ab)){ e.preventDefault(); const p = screenToZone(G.mouse.x, G.mouse.y); if(p) command({ cast: ab, at: [Math.round(p[0]), Math.round(p[1])] }); }
  else if(k === "S" && CONTROLS === "classic") command({ stop: 1 });
  else if(k === "O"){ if($("#profWin").hidden) openProf(); else $("#profWin").hidden = true; }
  else if(k === "K"){ if($("#skills").hidden) openSkills(); else $("#skills").hidden = true; }
  else if(k === "M") toggleBigMap();
  else if(k === "C"){ if($("#charWin").hidden) openChar(); else $("#charWin").hidden = true; }
  else if(k === "P") toggleSocial();
  else if(e.key === "Enter"){ e.preventDefault(); $("#chatIn").focus(); }
  else if(k === "F") command({ potion: 1 });
  else if(k === "T"){
    const me = G.snap && G.snap.h.find(h => h.side === G.myTeam); if(!me) return;
    let best = null, bd = 900; for(const n of NPCS){ const d = Math.hypot(n.x - me.x, n.y - me.y); if(d < bd){ bd = d; best = n; } }
    if(best) command({ talk: best.id });
  }else if(e.key === "Escape"){
    if(!$("#arena").hidden) closeArena();
    else if(!$("#shop").hidden) closeShop();
    else if(!$("#social").hidden) $("#social").hidden = true;
    else if(!$("#charWin").hidden) $("#charWin").hidden = true;
    else if(!$("#skills").hidden) $("#skills").hidden = true;
    else if(!$("#bigmap").hidden) toggleBigMap(false);
    else if(!$("#dialog").hidden) closeDialog();
    else if(!$("#menu").hidden) $("#menu").hidden = true;
    else menuDrop($("#menuDrop").hidden);
  }
});
addEventListener("blur", () => { rmb = false; });
addEventListener("mouseout", e => { if(!e.relatedTarget){ rmb = false; bothMouse = false; camDrag = null; } });   // the mouse left the window
// the Menu button opens a short list of every window; picking one (or clicking anywhere else) closes the list
function menuDrop(open){ const d = $("#menuDrop"); d.hidden = !open; $("#menuBtn").setAttribute("aria-expanded", String(open)); }
$("#menuBtn").onclick = e => { e.stopPropagation(); menuDrop($("#menuDrop").hidden); };
$("#menuDrop").addEventListener("click", () => menuDrop(false));
addEventListener("pointerdown", e => { if(!$("#menuDrop").hidden && !(e.target.closest && e.target.closest(".menuwrap"))) menuDrop(false); });
$("#settingsBtn").onclick = () => { $("#menu").hidden = false; };
$("#ctrlBtn").onclick = () => setControls(CONTROLS === "wasd" ? "classic" : "wasd");
updateControlsText();
$("#resumeBtn").onclick = () => { $("#menu").hidden = true; };
$("#leaveBtn").onclick = () => { $("#menu").hidden = true; leaveWorld(); show("select"); };

/* ---------- Quest dialog ---------- */
const dlgFace = $("#dlgFace").getContext("2d");
function rewardText(Q){
  const me = G.snap && G.snap.h.find(h => h.side === G.myTeam), xp = me ? questXp(Q, me.lvl) : Q.xp;
  let t = `Reward: ${xp} experience${xp < Q.xp ? " (less, because this quest is below your level)" : ""}`;
  if(Q.reward === "weapon") t += ` and a glowing new weapon, ${WEAPON_REWARD[G.myKit.cls]} (+${WEAPON_REWARD.ad} attack damage, +${Math.round(WEAPON_REWARD.abil * 100)}% ability damage)`;
  if(Q.reward && Q.reward.item !== undefined){ const R = RARITY[Q.reward.item].n; t += `, and ${/^[AEIOU]/.test(R) ? "an" : "a"} ${R} ${Q.reward.slot ? SLOT_NAME[Q.reward.slot].toLowerCase() : "armor"} piece`; }
  if(Q.coins) t += ` · ${fmtCoins(Q.coins)}`;
  if(Q.timeLimit) t += ` · Time limit: ${Math.round(Q.timeLimit / 60)} minutes`;
  return t;
}
function openDialog(f){
  const npc = NPCS.find(n => n.id === f.npc), Q = f.quest ? QUESTS[f.quest] : null;
  G.dialog = f;
  dlgFace.clearRect(0, 0, 64, 64); dlgFace.save(); dlgFace.translate(32, 36); dlgFace.scale(.62, .62); HEADS[npc.head](dlgFace, 0, 0, 46); dlgFace.restore();
  $("#dlgName").textContent = npc.name;
  const act = $("#dlgAction");
  if(!Q || f.state === "idle"){
    $("#dlgQuest").textContent = ""; $("#dlgText").textContent = npc.idle;
    $("#dlgObj").hidden = $("#dlgReward").hidden = act.hidden = true; $("#dlgClose").textContent = "Goodbye";
  }else{
    const label = { offer: "New quest", progress: "In progress", waiting: "In progress", complete: "Ready to turn in", done: "Completed" }[f.state];
    $("#dlgQuest").textContent = `${Q.title} · ${label}`;
    $("#dlgText").textContent = Q[f.state];
    $("#dlgObj").hidden = !["offer", "progress", "waiting"].includes(f.state); $("#dlgObj").textContent = Q.objective;
    $("#dlgReward").hidden = !(f.state === "offer" || f.state === "complete"); $("#dlgReward").textContent = rewardText(Q);
    act.hidden = !(f.state === "offer" || f.state === "complete");
    act.textContent = f.state === "offer" ? "Accept" : "Complete quest";
    $("#dlgClose").textContent = f.state === "offer" ? "Decline" : "Goodbye";
  }
  // Scout Yrsa rents out a raid party while you hunt Skarnvir
  const me = G.snap && G.snap.h.find(h => h.side === G.myTeam), p = myParty();
  const hired = p && p[2].some(s => { const h = heroBySide(s); return h && h.merc; });
  const hire = $("#dlgHire"), onQuest = npc.mercs && me && npc.mercs.some(q => me.quests[q] && me.quests[q].state !== "failed");
  hire.hidden = !(onQuest && !hired && (!p || p[1] === G.myTeam));
  if(!hire.hidden){
    const free = PARTY_MAX - (p ? p[2].length : 1), price = MERCS.price * ((me && me.lvl) || 1);
    hire.textContent = `Hire a ${npc.id === "yrsa" ? "raid " : ""}party (${fmtCoins(price)} each)`;
    hire.title = `Fills your party to ${PARTY_MAX} with a tank, a healer and damage dealers : ${free} champion${free === 1 ? "" : "s"}, ${fmtCoins(price * free)}. They stay through the Ashen Cathedral and leave when its last boss falls.`;
    hire.disabled = free <= 0;
  }
  $("#dialog").hidden = false; (act.hidden ? $("#dlgClose") : act).focus();
}
/* ---------- Arena (Arenamaster Vex) ---------- */
function openArena(f){
  const npc = NPCS.find(n => n.id === f.npc); if(!npc) return;
  G.arenaNpc = npc.id; G.arenaLvl = f.lvl || 1; $("#arenaName").textContent = npc.name;
  $("#arenaWins").textContent = f.wins ? `Your arena wins: ${f.wins} · best: difficulty ${f.best}` : "You haven't won in the arena yet.";
  // the difficulty buttons, remembering your last pick
  let pick = ARENA_RULES.defaultDiff; try{ pick = +localStorage.getItem("rr.arenaDiff") || pick; }catch(e){}
  $("#arenaDiffs").innerHTML = Array.from({ length: 10 }, (_, i) => `<button class="dbtn" data-diff="${i + 1}" aria-pressed="false" aria-label="Difficulty ${i + 1}, ${ARENA_DIFF_NAMES[i + 1]}">${i + 1}</button>`).join("");
  setArenaDiff(pick);
  $("#arena").hidden = false; $("#arenaGo").focus();
}
function closeArena(){ $("#arena").hidden = true; if(G) G.arenaNpc = null; }
function setArenaDiff(n){
  n = arenaSkill(n).diff; G.arenaDiff = n; try{ localStorage.setItem("rr.arenaDiff", n); }catch(e){}
  for(const b of document.querySelectorAll("#arenaDiffs .dbtn")){ const on = +b.dataset.diff === n; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); }
  const s = arenaSkill(n);
  $("#arenaDiffName").textContent = `Difficulty ${n} · ${ARENA_DIFF_NAMES[n]}`;
  $("#arenaDiffInfo").textContent = `Dodges ${Math.round(s.dodge * 100)}% of skillshots · ${Math.round(s.dmg * 100)}% damage · ${Math.round(s.hp * 100)}% health · ${s.potions} potion${s.potions === 1 ? "" : "s"} · win ${fmtCoins(Math.round(ARENA_RULES.reward * n * (G.arenaLvl || 1)))}`;
}
$("#arenaDiffs").addEventListener("click", e => { const b = e.target.closest("[data-diff]"); if(b) setArenaDiff(+b.dataset.diff); });
$("#arenaGo").onclick = () => { command({ arena: 1, diff: G.arenaDiff || ARENA_RULES.defaultDiff }); closeArena(); };
$("#arenaClose").onclick = closeArena;
// host only: the simulation asks for an opponent; pick a random champion (not your own) and load its abilities
function serviceArena(){
  if(G.role !== "host" || !G.W.arenaReqs.length) return;
  const req = G.W.arenaReqs.shift(), me = G.W.heroes[req.side];
  const pool = champs.filter(c => !me || c.id !== me.champId);
  if(!pool.length){ SIM.arenaFail(G.W, req.side); return; }
  const pick = pool[Math.floor(Math.random() * pool.length)];
  getDetail(pick.id).then(d => { if(G && G.W) SIM.arenaStart(G.W, req.side, d, req.diff); }).catch(() => { if(G && G.W) SIM.arenaFail(G.W, req.side); });
}
/* ---------- Vendor ---------- */
function openShop(npcId){
  const npc = NPCS.find(n => n.id === npcId); if(!npc) return;
  G.shop = npc.id; G.shopKey = ""; G.shopSel = new Set(); G.shopArm = false; $("#shopName").textContent = npc.name; renderShop(); $("#shop").hidden = false;
}
function renderShop(){
  const npc = G && NPCS.find(n => n.id === G.shop), me = G && G.snap && G.snap.h.find(h => h.side === G.myTeam); if(!npc || !me) return;
  const have = ((me.gear && me.gear.inv) || []).filter(x => x.key === "hpot").reduce((a, x) => a + (x.q || 1), 0);
  const inv = (me.gear && me.gear.inv) || []; prunePicks(G.shopSel, inv);
  const key = `${npc.id}|${me.coins}|${have}|${me.gear && me.gear.ver}|${[...G.shopSel].join()}|${G.shopArm}`; if(key === G.shopKey) return; G.shopKey = key; // only rebuild when something changed, so clicks aren't lost
  $("#shopCoins").textContent = fmtCoins(me.coins);
  $("#shopList").innerHTML = npc.shop.map(key => { const it = SHOP_ITEMS[key];
    return `<div class="shoprow"><img alt="" src="${itemIconURL(makePotion(0))}"><div class="si"><b>${esc(it.n)}</b><span>${esc(it.desc)}</span><span>You have ${have}</span></div>
      <div class="sb"><span class="coins">${fmtCoins(it.price)}</span><div class="row"><button class="btn" data-buy="${key}" data-n="1" ${me.coins < it.price ? "disabled" : ""}>Buy 1</button><button class="btn primary" data-buy="${key}" data-n="5" ${me.coins < it.price * 5 ? "disabled" : ""}>Buy 5</button></div></div></div>`; }).join("");
  // sell from your bags: click items to pick them, then sell them all at once
  const list = pickedItems(inv, G.shopSel), val = pickedValue(list);
  $("#shopSell").innerHTML = `<div class="eyebrow">Sell from your bags</div>
    ${inv.length ? `<div class="sellgrid">${inv.map(it => slotBtn(it, `data-sell="${it.id}"`, "", false).replace('class="islot', G.shopSel.has(it.id) ? 'class="islot pick' : 'class="islot')).join("")}</div>` : `<p class="lobbymsg" style="text-align:left">Your bags are empty.</p>`}
    <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:6px"><div class="row"><button class="btn small" data-sact="junk">Select junk</button><button class="btn small" data-sact="clear">Clear</button></div>
    <button class="btn primary" data-sact="sell" ${list.length ? "" : "disabled"}>${G.shopArm ? "Includes Rare or better: click again" : list.length ? `Sell ${list.length} for ${fmtCoins(val)}` : "Pick items to sell"}</button></div>`;
}
$("#shopSell").addEventListener("click", e => {
  const me = G && G.snap && G.snap.h.find(h => h.side === G.myTeam); if(!me) return;
  const inv = (me.gear && me.gear.inv) || [], b = e.target.closest("[data-sell],[data-sact]"); if(!b) return;
  if(b.dataset.sell){ G.shopArm = false; if(G.shopSel.has(b.dataset.sell)) G.shopSel.delete(b.dataset.sell); else G.shopSel.add(b.dataset.sell); }
  else if(b.dataset.sact === "junk"){ G.shopArm = false; for(const it of inv) if(isJunk(it)) G.shopSel.add(it.id); }
  else if(b.dataset.sact === "clear"){ G.shopArm = false; G.shopSel.clear(); }
  else if(b.dataset.sact === "sell"){
    const list = pickedItems(inv, G.shopSel);
    if(list.some(it => it.r >= 2) && !G.shopArm) G.shopArm = true;
    else if(list.length){ command({ sell: list.map(it => it.id) }); G.shopSel.clear(); G.shopArm = false; }
  }
  G.shopKey = ""; renderShop();
});
function closeShop(){ $("#shop").hidden = true; if(G) G.shop = null; }
$("#shopClose").onclick = closeShop;
$("#shopList").addEventListener("click", e => { const b = e.target.closest("[data-buy]"); if(b) command({ buy: b.dataset.buy, n: +b.dataset.n }); });
$("#dlgHire").onclick = () => { command({ hire: 1 }); closeDialog(); };
// host only: the simulation asks for hired champions; pick one that fits each role and load its abilities
function mercPick(role, taken){
  const fits = { tank: c => c.tags.includes("Tank"), healer: c => c.tags.includes("Support"), dps: c => !c.tags.includes("Tank") && !c.tags.includes("Support") }[role];
  const free = champs.filter(c => !taken.includes(c.id)), pool = free.filter(fits);
  const from = pool.length ? pool : free;
  return from.length ? from[Math.floor(Math.random() * from.length)] : null;
}
function serviceMercs(){
  if(G.role !== "host" || !G.W.mercReqs.length) return;
  const req = G.W.mercReqs.shift(), taken = req.taken.slice();
  const picks = req.roles.map(role => { const c = mercPick(role, taken); if(c) taken.push(c.id); return [role, c]; });
  Promise.all(picks.map(([role, c]) => c ? getDetail(c.id).then(d => [role, d], () => null) : null))
    .then(list => { if(G && G.W) SIM.mercDone(G.W, req.side, list.filter(Boolean)); })
    .catch(() => { if(G && G.W) SIM.mercDone(G.W, req.side, []); });
}
function closeDialog(){ $("#dialog").hidden = true; if(G) G.dialog = null; }
$("#dlgClose").onclick = closeDialog;
$("#dlgAction").onclick = () => {
  const f = G && G.dialog; if(!f) return;
  if(f.state === "offer") command({ accept: f.quest }); else if(f.state === "complete") command({ turnin: f.quest });
  closeDialog();
};
