"use strict";
// Phone controls (landscape). On a touch device (or with ?mobile=1 in the address) the game shows:
// - left: a floating joystick: put your thumb down anywhere on the left side and drag;
// - right: a big Attack button with the abilities in an arc round it, plus Potion, Jump, Switch target, and an
//   action button that becomes Talk / Loot / Gather / Use when something is in reach;
// - drag anywhere else to turn the camera, pinch to zoom, tap the world to move, attack, talk or pick up.
// Aiming is automatic: a tapped ability goes at your target (leading it if it moves), heals go to whoever
// needs them most, dashes go toward your target or straight ahead. Drag from an ability to aim it yourself.
// Everything goes through ordinary commands, so the host can't tell a phone from a keyboard.
// The desktop game is untouched: none of this is created unless MOBILE is true.

const MOBILE = (() => {
  try{
    const q = new URLSearchParams(location.search);
    if(q.has("mobile")) return q.get("mobile") !== "0";
    return matchMedia("(pointer: coarse)").matches && !matchMedia("(hover: hover)").matches;
  }catch(e){ return false; }
})();
const MOB = { ui: null, stick: null, cam: null, pinch: null, aim: null, target: null, prev: new Map(), keys: "", vis: null };
// how each ability is aimed: at a direction (full range), at a point, or on yourself / an ally
const AIM_DIR = ["bolt", "hook", "cone", "dash"], AIM_POINT = ["aoe", "field", "summon", "leap", "blink"], AIM_ALLY = ["heal", "shield"];

function mobileInit(){
  if(!MOBILE || MOB.ui) return;
  document.body.classList.add("mobile");
  const ui = document.createElement("div"); ui.id = "mobUI"; ui.className = "mobui"; ui.hidden = true;
  ui.innerHTML = `
    <div class="mstick" id="mStick"><div class="mknob" id="mKnob"></div></div>
    <div class="mbtns" id="mBtns">
      <button class="mbtn atk" id="mAtk" aria-label="Attack">⚔</button>
      <div id="mAbil"></div>
      <button class="mbtn sm" id="mPot" aria-label="Drink a potion">🧪<b id="mPotN"></b></button>
      <button class="mbtn sm" id="mJump" aria-label="Jump">⤒</button>
      <button class="mbtn sm" id="mTgt" aria-label="Switch target">◎</button>
      <button class="mbtn use" id="mUse" hidden></button>
    </div>
    <button class="mbtn sm mchat" id="mChat" aria-label="Chat">💬</button>
    <button class="mbtn sm mfull" id="mFull" aria-label="Full screen" hidden>⛶</button>`;
  document.body.appendChild(ui);
  const rot = document.createElement("div"); rot.id = "mobRotate"; rot.className = "mrotate"; rot.innerHTML = "<div>⟳</div><p>Turn your phone sideways to play</p>"; document.body.appendChild(rot);
  MOB.ui = ui;
  $("#hud").appendChild($("#tracker"));   // the quest list moves to the top left, out of the buttons' way
  const press = (id, fn) => { const b = document.getElementById(id); b.addEventListener("touchstart", e => { e.preventDefault(); e.stopPropagation(); if(G && G.snap) fn(); }, { passive: false }); b.addEventListener("click", () => { if(G && G.snap) fn(); }); };
  press("mAtk", () => { const t = mobilePickTarget(false); if(t){ MOB.target = t.id; command({ atk: t.id }); } else SIM_TELL("Nothing to attack nearby."); });
  press("mTgt", () => { const t = mobilePickTarget(true); if(t){ MOB.target = t.id; command({ atk: t.id }); } });
  press("mPot", () => command({ potion: 1 }));
  press("mJump", () => command({ jump: 1 }));
  press("mUse", () => { if(MOB.use) command(MOB.use.cmd); });
  press("mChat", () => { const c = $("#chat"); c.classList.toggle("open"); if(c.classList.contains("open")) $("#chatIn").focus(); });
  // the world: joystick on the left, camera drag / pinch / tap everywhere else
  cv.addEventListener("touchstart", mobileTouchStart, { passive: false });
  cv.addEventListener("touchmove", mobileTouchMove, { passive: false });
  cv.addEventListener("touchend", mobileTouchEnd, { passive: false });
  cv.addEventListener("touchcancel", mobileTouchEnd, { passive: false });
  // ability buttons track their own drags
  addEventListener("touchmove", e => { if(!MOB.aim) return; const t = [...e.changedTouches].find(x => x.identifier === MOB.aim.id); if(t){ MOB.aim.cx = t.clientX; MOB.aim.cy = t.clientY; } }, { passive: true });
  addEventListener("touchend", e => { if(MOB.aim && [...e.changedTouches].some(x => x.identifier === MOB.aim.id)) mobileReleaseAim(); });
  addEventListener("touchcancel", () => { MOB.aim = null; });
  // going in: fullscreen, landscape if the phone allows it (and again on your next tap if it said no)
  document.addEventListener("click", e => { if(e.target.closest && e.target.closest("#pvEnter, #joinGo, #pvJoin")) mobileFullscreen(); }, true);
  cv.addEventListener("touchend", () => { if(!MOB.fsAsked && !mobileIsFull()){ MOB.fsAsked = true; mobileFullscreen(); } });
  // (fullscreen has to come from a finished tap, so this one listens for touchend, not touchstart)
  const fb = $("#mFull"); fb.addEventListener("touchend", e => { e.preventDefault(); mobileFullscreen(); }, { passive: false }); fb.addEventListener("click", mobileFullscreen);
  // rotating or going fullscreen: phones report the new size late, so size the game again a moment after
  const again = () => { resize(); mobileLayout(); setTimeout(() => { resize(); mobileLayout(); }, 250); setTimeout(() => { resize(); mobileLayout(); }, 700); };
  addEventListener("orientationchange", again); document.addEventListener("fullscreenchange", again); document.addEventListener("webkitfullscreenchange", again);
  if(window.visualViewport) visualViewport.addEventListener("resize", again);
  mobileHomeScreenHint();
  addEventListener("resize", mobileLayout); mobileLayout();
}
/* ---------- Full screen ---------- */
const mobileIsFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement) || mobileStandalone();
const mobileStandalone = () => { try{ return matchMedia("(display-mode: fullscreen)").matches || matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; }catch(e){ return false; } };
const mobileCanFull = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
function mobileFullscreen(){
  if(mobileIsFull() || !mobileCanFull()) return;
  try{
    const el = document.documentElement, go = el.requestFullscreen ? el.requestFullscreen({ navigationUI: "hide" }) : el.webkitRequestFullscreen ? el.webkitRequestFullscreen() : null;
    const lock = () => { try{ const o = screen.orientation; if(o && o.lock) o.lock("landscape").catch(() => {}); }catch(_){} };
    if(go && go.then) go.then(lock).catch(() => {}); else lock();
  }catch(_){}
}
// iPhones can't make a web page fullscreen: the game opens fullscreen from the home screen instead. Say so, once.
function mobileHomeScreenHint(){
  const iOS = /iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1 && !mobileCanFull());
  if(!iOS || mobileStandalone()) return;
  try{ if(localStorage.getItem("rr.homeHint")) return; }catch(_){}
  const box = document.createElement("div"); box.className = "mhint";
  box.innerHTML = `<p><b>Play full screen:</b> tap <b>Share</b> <span aria-hidden="true">⬆︎</span>, then <b>Add to Home Screen</b>, and open Rift Realms from your home screen.</p><button class="btn small" id="mHintOk">Got it</button>`;
  document.body.appendChild(box);
  $("#mHintOk").onclick = () => { box.remove(); try{ localStorage.setItem("rr.homeHint", "1"); }catch(_){} };
}
const SIM_TELL = text => { if(G) handleFx({ k: "msg", side: G.myTeam, text }); };
// shrink the right-hand cluster on short screens
function mobileLayout(){ if(!MOB.ui) return; const s = Math.max(.6, Math.min(1, (innerHeight - 170) / 225)); MOB.ui.style.setProperty("--ms", s.toFixed(3)); }

/* ---------- Touches on the world ---------- */
const STICK_R = 56;
function mobileTouchStart(e){
  if(!G) return; e.preventDefault();
  for(const t of e.changedTouches){
    const x = t.clientX, y = t.clientY, info = { id: t.identifier, x, y, sx: x, sy: y, t0: performance.now(), moved: false };
    if(!MOB.stick && x < innerWidth * .45 && y > innerHeight * .3){ MOB.stick = info; mobileStickShow(x, y); continue; }
    if(!MOB.cam){ MOB.cam = info; continue; }
    if(!MOB.pinch){ MOB.pinch = { id: t.identifier, d0: Math.hypot(x - MOB.cam.x, y - MOB.cam.y), z0: camDist, x, y }; MOB.cam.moved = true; }
  }
}
function mobileTouchMove(e){
  if(!G) return; e.preventDefault();
  for(const t of e.changedTouches){
    const x = t.clientX, y = t.clientY;
    if(MOB.stick && t.identifier === MOB.stick.id){
      const S = MOB.stick, dx = x - S.sx, dy = y - S.sy, d = Math.hypot(dx, dy), k = d > STICK_R ? STICK_R / d : 1;
      if(d > 12) S.moved = true;
      MOB_STICK.on = S.moved; MOB_STICK.x = dx * k / STICK_R; MOB_STICK.y = dy * k / STICK_R;
      $("#mKnob").style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    }else if(MOB.cam && t.identifier === MOB.cam.id){
      const C = MOB.cam, dx = x - C.x, dy = y - C.y; C.x = x; C.y = y;
      if(Math.hypot(x - C.sx, y - C.sy) > 12) C.moved = true;
      if(C.moved && !MOB.pinch){ camYaw -= dx * .008; const b = camBasePitch(); camTilt = Math.max(CAM_PITCH[0] - b, Math.min(CAM_PITCH[1] - b, camTilt + dy * .005)); }
      if(MOB.pinch){ const P = MOB.pinch; camDist = Math.max(12, Math.min(36, P.z0 * P.d0 / Math.max(20, Math.hypot(P.x - C.x, P.y - C.y)))); }
    }else if(MOB.pinch && t.identifier === MOB.pinch.id){
      const P = MOB.pinch, C = MOB.cam; P.x = x; P.y = y;
      if(C) camDist = Math.max(12, Math.min(36, P.z0 * P.d0 / Math.max(20, Math.hypot(P.x - C.x, P.y - C.y))));
    }
  }
}
function mobileTouchEnd(e){
  if(!G) return; e.preventDefault();
  for(const t of e.changedTouches){
    const tap = s => !s.moved && performance.now() - s.t0 < 350;
    if(MOB.stick && t.identifier === MOB.stick.id){ if(tap(MOB.stick)) mobileTap(MOB.stick.sx, MOB.stick.sy); MOB.stick = null; MOB_STICK.on = false; MOB_STICK.x = MOB_STICK.y = 0; mobileStickHide(); }
    else if(MOB.cam && t.identifier === MOB.cam.id){ if(tap(MOB.cam) && !MOB.pinch) mobileTap(MOB.cam.sx, MOB.cam.sy); MOB.cam = null; MOB.pinch = null; }
    else if(MOB.pinch && t.identifier === MOB.pinch.id) MOB.pinch = null;
  }
}
// a tap is a right-click: attack, talk, pick up, use, gather, or walk there
function mobileTap(x, y){ const t = thingUnderCursor(x, y); if(t && t.atk) MOB.target = t.atk; rightClick(x, y, false); }
function mobileStickShow(x, y){ const s = $("#mStick"); s.classList.add("on"); s.style.left = (x - 70) + "px"; s.style.top = (y - 70) + "px"; s.style.bottom = "auto"; $("#mKnob").style.transform = ""; }
function mobileStickHide(){ const s = $("#mStick"); s.classList.remove("on"); s.style.left = ""; s.style.top = ""; s.style.bottom = ""; $("#mKnob").style.transform = ""; }

/* ---------- Targets ---------- */
function mobileMe(){ return G && G.snap && G.snap.h.find(h => h.side === G.myTeam); }
// every enemy you could aim at: creatures (not hidden ones), and your duel opponent
function mobileFoes(){
  const out = [];
  for(const m of G.snap.m){ if(m[7] & 16) continue; out.push({ id: m[0], x: m[2], y: m[3], kind: m[1] }); }
  for(const h of G.snap.h) if(!h.dead && duelFoe(h.side)) out.push({ id: "c:" + h.side, x: h.x, y: h.y });
  return out;
}
// keep your current target while it lasts; otherwise the nearest enemy, favouring what's in front of the camera.
// `next` switches to the next one instead.
function mobilePickTarget(next){
  const me = mobileMe(); if(!me) return null;
  const foes = mobileFoes().filter(f => Math.hypot(f.x - me.x, f.y - me.y) < 1800);
  const cur = foes.find(f => f.id === MOB.target);
  if(cur && !next) return cur;
  const fx = -Math.sin(camYaw), fy = Math.cos(camYaw);
  const score = f => { const dx = f.x - me.x, dy = f.y - me.y, d = Math.hypot(dx, dy); return d + ((dx * fx + dy * fy) < 0 ? 500 : 0); };
  const list = foes.filter(f => Math.hypot(f.x - me.x, f.y - me.y) < 1500).sort((a, b) => score(a) - score(b));
  if(!list.length) return null;
  if(next && cur){ const i = list.findIndex(f => f.id === cur.id); return list[(i + 1) % list.length]; }
  return list[0];
}
// where a moving target will be after `secs`
function mobileLead(f, secs){ const v = MOB.prev.get(f.id); return v ? [f.x + v.vx * Math.min(secs, 1.2), f.y + v.vy * Math.min(secs, 1.2)] : [f.x, f.y]; }
// the friend who needs a heal most (yourself if nobody does)
function mobileAlly(me, range){
  let best = me, bw = me.hp / me.maxHp;
  for(const h of G.snap.h){ if(h === me || h.dead || duelFoe(h.side) || Math.hypot(h.x - me.x, h.y - me.y) > range) continue; const w = h.hp / h.maxHp; if(w < bw - .05){ best = h; bw = w; } }
  return best;
}

/* ---------- Abilities ---------- */
function mobileAbilityButtons(){
  const host = $("#mAbil"); host.innerHTML = "";
  G.slotKeys.forEach((k, i) => {
    const b = document.createElement("button"), img = G.slotEls[i] && G.slotEls[i].querySelector("img");
    b.className = "mbtn ab ab" + k; b.dataset.k = k; b.setAttribute("aria-label", `${keyLabel(k)}: ${k === "G" ? G.myKit.G.name : G.details[G.myTeam].spells[i].name}`);
    b.innerHTML = `<img alt="" src="${img ? img.src : ""}"><i class="cd"></i>`;
    b.addEventListener("touchstart", e => { e.preventDefault(); e.stopPropagation(); const t = e.changedTouches[0]; MOB.aim = { k, id: t.identifier, sx: t.clientX, sy: t.clientY, cx: t.clientX, cy: t.clientY }; }, { passive: false });
    b.addEventListener("click", () => { if(!MOB.aim) mobileCast(k, null); });   // a mouse click (testing on a desktop)
    host.appendChild(b);
  });
}
// the aim from a drag: a direction (and how far, for point abilities), turned into the world by the camera
function mobileDragAim(A){
  const dx = A.cx - A.sx, dy = A.cy - A.sy, len = Math.hypot(dx, dy);
  if(len < 18) return null;
  const rx = Math.cos(camYaw), ry = Math.sin(camYaw), fx = -Math.sin(camYaw), fy = Math.cos(camYaw);
  let wx = rx * dx + fx * -dy, wy = ry * dx + fy * -dy; const n = Math.hypot(wx, wy) || 1; wx /= n; wy /= n;
  return { wx, wy, frac: Math.min(1, len / 90) };
}
function mobileAimPoint(k, drag){
  const me = mobileMe(), p = applyTalents(G.myKit[k], me.talents && me.talents[k]), range = p.range || 600, type = p.type;
  if(AIM_ALLY.includes(type)){ const a = mobileAlly(me, (p.range || 900) + 200); return [a.x, a.y]; }
  if(drag){ const r = AIM_DIR.includes(type) ? range : AIM_POINT.includes(type) ? range * Math.max(.15, drag.frac) : 200; return [me.x + drag.wx * r, me.y + drag.wy * r]; }
  const t = mobilePickTarget(false);
  if(["spin", "orbit", "steroid", "stealth"].includes(type)) return t ? [t.x, t.y] : [me.x, me.y];
  if(t){ MOB.target = t.id; const d = Math.hypot(t.x - me.x, t.y - me.y); return mobileLead(t, p.speed ? d / p.speed : (p.delay || .3)); }
  const fx = -Math.sin(camYaw), fy = Math.cos(camYaw);   // nothing to aim at: straight ahead
  return [me.x + fx * range * .8, me.y + fy * range * .8];
}
function mobileCast(k, drag){
  const me = mobileMe(); if(!me || me.dead) return;
  const at = mobileAimPoint(k, drag);
  command({ cast: k, at: [Math.round(at[0]), Math.round(at[1])] });
  if(MOB.target && !AIM_ALLY.includes(G.myKit[k].type)) command({ atk: MOB.target });   // and keep fighting
}
function mobileReleaseAim(){ const A = MOB.aim; MOB.aim = null; if(G && G.snap) mobileCast(A.k, mobileDragAim(A)); }

/* ---------- Per frame (from the render loop) ---------- */
function updateMobile(dt, t){
  if(!MOBILE || !MOB.ui || !G || !G.snap) return;
  MOB.ui.hidden = false;
  const fb = $("#mFull"), wantFull = mobileCanFull() && !mobileIsFull(); if(fb.hidden === wantFull) fb.hidden = !wantFull;
  const me = mobileMe(); if(!me) return;
  if(G.slotKeys && G.slotKeys.join() + "|" + (G.slotEls || []).length !== MOB.keys){ MOB.keys = G.slotKeys.join() + "|" + (G.slotEls || []).length; mobileAbilityButtons(); }
  // track enemy movement for leading shots
  for(const f of mobileFoes()){ const p = MOB.prev.get(f.id); if(p && dt > 0){ p.vx = p.vx * .7 + (f.x - p.x) / dt * .3; p.vy = p.vy * .7 + (f.y - p.y) / dt * .3; p.x = f.x; p.y = f.y; } else MOB.prev.set(f.id, { x: f.x, y: f.y, vx: 0, vy: 0 }); }
  if(MOB.prev.size > 400) MOB.prev.clear();
  // cooldowns on the ability buttons
  for(const b of document.querySelectorAll("#mAbil .mbtn")){
    const k = b.dataset.k, cd = me.cds[k] || 0, locked = ultLocked(G.myKit, me.lvl, k), c = b.querySelector(".cd");
    b.classList.toggle("locked", locked || !!me.dead);
    c.textContent = locked ? `Lv${ULT_LEVEL}` : cd > 0 ? (cd >= 1 ? Math.ceil(cd) : cd.toFixed(1)) : "";
  }
  $("#mPotN").textContent = potCount(me) || "";
  // the action button: whatever is in reach (an NPC, your loot, a node, a quest object)
  MOB.use = mobileUseNearby(me);
  const ub = $("#mUse"); ub.hidden = !MOB.use; if(MOB.use) ub.textContent = MOB.use.label;
  // a red ring under your target, and the aim marker while you drag an ability
  if(!MOB.vis){
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xff4a3a, transparent: true, opacity: .85, depthWrite: false })); ring.renderOrder = 3;
    const aim = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x9fe6ff, transparent: true, opacity: .9, depthWrite: false })); aim.renderOrder = 3;
    const line = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x9fe6ff, transparent: true, opacity: .35, depthWrite: false, side: THREE.DoubleSide })); line.rotation.x = -Math.PI / 2;
    MOB.vis = { ring, aim, line }; G.root.add(ring, aim, line);
  }
  if(!G.root.children.includes(MOB.vis.ring)) G.root.add(MOB.vis.ring, MOB.vis.aim, MOB.vis.line);
  const tgt = MOB.target && mobileFoes().find(f => f.id === MOB.target);
  if(MOB.target && !tgt) MOB.target = null;
  MOB.vis.ring.visible = !!tgt;
  if(tgt){ const w = XF(tgt.x, tgt.y); MOB.vis.ring.position.set(w.x, hAt(w.x, w.z) + .08, w.z); MOB.vis.ring.scale.setScalar(1 + Math.sin(t * 6) * .08); }
  const A = MOB.aim, drag = A && mobileDragAim(A);
  MOB.vis.aim.visible = MOB.vis.line.visible = !!drag;
  if(drag){
    const at = mobileAimPoint(A.k, drag), w = XF(at[0], at[1]), m = XF(me.x, me.y), p = G.myKit[A.k];
    MOB.vis.aim.position.set(w.x, hAt(w.x, w.z) + .1, w.z); MOB.vis.aim.scale.setScalar(Math.max(.6, (p.radius || 120) * ZSC));
    const len = Math.hypot(w.x - m.x, w.z - m.z); MOB.vis.line.scale.set(.5, len, 1); MOB.vis.line.position.set((w.x + m.x) / 2, hAt(m.x, m.z) + .12, (w.z + m.z) / 2); MOB.vis.line.rotation.z = Math.atan2(w.x - m.x, w.z - m.z);
  }
}
function mobileUseNearby(me){
  const d = (x, y) => Math.hypot(x - me.x, y - me.y);
  for(const l of (G.snap.l || [])) if(l[1] === G.myTeam && d(l[3], l[4]) < 380) return { label: "Loot", cmd: { pickup: l[0] } };
  for(let i = 0; i < USE_POINTS.length; i++){ const p = USE_POINTS[i], q = me.quests[p.quest]; if(q && q.state === "active" && d(p.x, p.y) < 380) return { label: p.verb === "Reading" ? "Read" : "Use", cmd: { use: i } }; }
  const want = wantedNodes(me); for(const n of (G.snap.n || [])){ const [id, x, y, ready, kind] = n; if(ready && want.has(kind) && d(x, y) < 340) return { label: "Gather", cmd: { gather: id } }; }
  let best = null, bd = 520; for(const n of NPCS){ const dd = d(n.x, n.y); if(dd < bd){ bd = dd; best = n; } }
  if(best) return { label: best.shop ? "Shop" : "Talk", cmd: { talk: best.id } };
  return null;
}
mobileInit();
