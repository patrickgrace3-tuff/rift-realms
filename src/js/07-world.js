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
  if(opts.role === "host"){ G.W = SIM.create(); SIM.addHero(G.W, "blue", opts.details.blue); G.snap = SIM.snapshot(G.W); }
  zone.visible = true;
  scene.fog = new THREE.Fog(0x9ccbe8, 40, 95);
  buildNpcs();
  const me = G.details[myTeam];
  $("#hudHead").src = champIcon(me.id); $("#hudName").textContent = me.name;
  $("#inviteBtn").hidden = opts.role !== "host"; $("#mmZone").textContent = "Sunhollow Vale";
  buildSlots(); resetSocial();
  for(const s of ["#menu", "#notice"]) $(s).hidden = true;
  show("game"); last = performance.now();
  banner("Sunhollow Vale", opts.role === "host" ? "Starting zone" : "Joined your friend's world", 3500);
  playMusic("vale"); // started by the click that entered the world, so the browser allows it
}
function leaveWorld(keepNet){
  if(!keepNet) netClose();
  if(!G) return;
  if(!keepNet) stopMusic();
  scene.remove(G.root); zone.visible = false; scene.fog = null; G = null;
  $("#dialog").hidden = true; $("#hud").hidden = true; $("#cv").hidden = true; $("#ov").hidden = true;
  $("#skills").hidden = true; $("#bigmap").hidden = true; $("#charWin").hidden = true; $("#lootFeed").innerHTML = "";
  $("#social").hidden = true;
}
function buildNpcs(){
  for(const n of NPCS){
    const art = new CharArt({ style: n.style, drawHead: HEADS[n.head] });
    const tex = new THREE.CanvasTexture(art.canvas); tex.encoding = THREE.sRGBEncoding;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: .1 })); spr.center.set(.5, 0); spr.scale.set(1.6, 2.4, 1);
    art.draw(0, false, "idle", true); tex.needsUpdate = true;
    const marks = { offer: new THREE.SpriteMaterial({ map: markerTexture("!", "#ffd84a"), transparent: true, depthWrite: false }),
      progress: new THREE.SpriteMaterial({ map: markerTexture("?", "#b8b8b8"), transparent: true, depthWrite: false }),
      complete: new THREE.SpriteMaterial({ map: markerTexture("?", "#ffd84a"), transparent: true, depthWrite: false }) };
    const marker = new THREE.Sprite(marks.offer); marker.scale.set(.9, .9, 1);
    const w = XF(n.x, n.y), y = hAt(w.x, w.z);
    spr.position.set(w.x, y, w.z); marker.position.set(w.x, y + 3.1, w.z);
    const shadow = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .3, depthWrite: false })); shadow.scale.setScalar(.6); shadow.position.set(w.x, y + .02, w.z);
    G.root.add(spr, marker, shadow);
    G.npcVis.push({ n, spr, marker, marks, art, tex, pos: { x: w.x, y, z: w.z } });
  }
}

/* ---------- Hero visuals ---------- */
function buildHeroVisual(d, side){
  const kit = buildKit(d), sideCol = SIDE_COLOR[side] || "#7fd3ff", ringCol = side === "blue" ? "#c9a55c" : sideCol;
  const art = new CharArt({ style: kit.cls, headUrl: champIcon(d.id), ring: ringCol, initial: d.name[0] });
  const tex = new THREE.CanvasTexture(art.canvas); tex.encoding = THREE.sRGBEncoding;
  art.onload = () => { tex.needsUpdate = true; };
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: .1 })); spr.center.set(.5, 0); spr.scale.set(1.7, 2.55, 1);
  const v = { side, d, kit, art, tex, spr, flip: false, castUntil: 0, atkUntil: 0, castSeq: -1, atkSeq: -1, pos: null };
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
  G.root.add(spr, v.shadow, v.ring, v.bubble, v.aura, ...v.orbs);
  return v;
}
function removeHeroVisual(v){ G.root.remove(v.spr, v.shadow, v.ring, v.bubble, v.aura, v.wglow, ...v.orbs); v.tex.dispose(); }

/* ---------- Input ---------- */
function screenToZone(cx, cy){
  const me = G.vis[G.myTeam], h = me && me.pos ? me.pos.y : 0;
  raycaster.setFromCamera(new THREE.Vector2(cx / VW * 2 - 1, -(cy / VH) * 2 + 1), camera);
  const hit = new THREE.Vector3();
  if(!raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -h), hit)) return null;
  return XF.inv(hit.x, hit.z);
}
function worldToScreen(x, y, z){ projV.set(x, y, z).project(camera); return [(projV.x + 1) / 2 * VW, (1 - projV.y) / 2 * VH, projV.z]; }
function command(cmd){ if(!G) return; if(G.role === "host") SIM.input(G.W, G.myTeam, cmd); else send(Object.assign({ t: "in" }, cmd)); }
function thingUnderCursor(cx, cy){
  for(let i = 0; i < USE_POINTS.length; i++){ const b = USE_POINTS[i], w = XF(b.x, b.y), [sx, sy] = worldToScreen(w.x, hAt(w.x, w.z) + 1.3, w.z); if(Math.abs(sx - cx) < 40 && Math.abs(sy - cy) < 60) return { use: i }; }
  for(const [id, nv] of G.nodeVis){ if(!nv.spr.visible) continue; const [sx, sy] = worldToScreen(nv.spr.position.x, nv.spr.position.y, nv.spr.position.z); if(Math.hypot(sx - cx, sy - cy) < 36) return { gather: id }; }
  for(const [, lv] of G.lootVis){ if(!lv.pos) continue; const [sx, sy] = worldToScreen(lv.pos.x, lv.pos.y + .7, lv.pos.z); if(Math.hypot(sx - cx, sy - cy) < 40) return { pickup: lv.pos.id }; }
  for(const nv of G.npcVis){ const [sx, sy] = worldToScreen(nv.pos.x, nv.pos.y + 1.4, nv.pos.z); if(Math.abs(sx - cx) < 40 && Math.abs(sy - cy) < 70) return { npc: nv.n.id }; }
  // your duel opponent can be attacked like a creature
  for(const h of G.snap.h){ if(!duelFoe(h.side) || h.dead) continue; const v = G.vis[h.side]; if(!v || !v.pos) continue; const [sx, sy] = worldToScreen(v.pos.x, v.pos.y + 1.2, v.pos.z); if(Math.abs(sx - cx) < 40 && Math.abs(sy - cy) < 70) return { atk: "c:" + h.side }; }
  let best = null, bd = 1e9;
  for(const m of G.snap.m){
    // click anywhere on the creature's body; big ones (the dragon) have a big target
    const A = MOB_ART[m[1]] || MOB_ART.sheep, p = G.smooth.get(m[0]) || { x: m[2], y: m[3] }, w = XF(p.x, p.y), gy = hAt(w.x, w.z);
    const [sx, sy] = worldToScreen(w.x, gy + A.sy * .4, w.z), [ex] = worldToScreen(w.x + A.sx * .45, gy + A.sy * .4, w.z), reach = Math.max(46, Math.abs(ex - sx));
    const d = Math.hypot(sx - cx, sy - cy); if(d < reach && d / reach < bd){ bd = d / reach; best = { atk: m[0] }; }
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
addEventListener("pointermove", e => { if(G){ G.mouse.x = e.clientX; G.mouse.y = e.clientY; } });
addEventListener("pointerup", e => { if(e.button === 2) rmb = false; });
cv.addEventListener("wheel", e => { e.preventDefault(); camDist = Math.max(12, Math.min(36, camDist + Math.sign(e.deltaY) * 2)); }, { passive: false });
addEventListener("keydown", e => {
  if(!G || e.repeat) return;
  if(e.target.tagName === "INPUT") return;
  const k = e.key.toUpperCase();
  if(["Q", "W", "E", "R"].includes(k)){ e.preventDefault(); const p = screenToZone(G.mouse.x, G.mouse.y); if(p) command({ cast: k, at: [Math.round(p[0]), Math.round(p[1])] }); }
  else if(k === "S") command({ stop: 1 });
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
    else $("#menu").hidden = !$("#menu").hidden;
  }
});
addEventListener("blur", () => { rmb = false; });
$("#menuBtn").onclick = () => { $("#menu").hidden = false; };
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
  $("#dialog").hidden = false; (act.hidden ? $("#dlgClose") : act).focus();
}
/* ---------- Arena (Arenamaster Vex) ---------- */
function openArena(f){
  const npc = NPCS.find(n => n.id === f.npc); if(!npc) return;
  G.arenaNpc = npc.id; G.arenaLvl = f.lvl || 1; $("#arenaName").textContent = npc.name;
  $("#arenaWins").textContent = f.wins ? `Your wins in the ring: ${f.wins} · best: difficulty ${f.best}` : "You haven't won in the ring yet.";
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
  G.shop = npc.id; G.shopKey = ""; $("#shopName").textContent = npc.name; renderShop(); $("#shop").hidden = false;
}
function renderShop(){
  const npc = G && NPCS.find(n => n.id === G.shop), me = G && G.snap && G.snap.h.find(h => h.side === G.myTeam); if(!npc || !me) return;
  const have = ((me.gear && me.gear.inv) || []).filter(x => x.key === "hpot").reduce((a, x) => a + (x.q || 1), 0);
  const key = `${npc.id}|${me.coins}|${have}`; if(key === G.shopKey) return; G.shopKey = key; // only rebuild when something changed, so clicks aren't lost
  $("#shopCoins").textContent = fmtCoins(me.coins);
  $("#shopList").innerHTML = npc.shop.map(key => { const it = SHOP_ITEMS[key];
    return `<div class="shoprow"><img alt="" src="${itemIconURL(makePotion(0))}"><div class="si"><b>${esc(it.n)}</b><span>${esc(it.desc)}</span><span>You have ${have}</span></div>
      <div class="sb"><span class="coins">${fmtCoins(it.price)}</span><div class="row"><button class="btn" data-buy="${key}" data-n="1" ${me.coins < it.price ? "disabled" : ""}>Buy 1</button><button class="btn primary" data-buy="${key}" data-n="5" ${me.coins < it.price * 5 ? "disabled" : ""}>Buy 5</button></div></div></div>`; }).join("");
}
function closeShop(){ $("#shop").hidden = true; if(G) G.shop = null; }
$("#shopClose").onclick = closeShop;
$("#shopList").addEventListener("click", e => { const b = e.target.closest("[data-buy]"); if(b) command({ buy: b.dataset.buy, n: +b.dataset.n }); });
function closeDialog(){ $("#dialog").hidden = true; if(G) G.dialog = null; }
$("#dlgClose").onclick = closeDialog;
$("#dlgAction").onclick = () => {
  const f = G && G.dialog; if(!f) return;
  if(f.state === "offer") command({ accept: f.quest }); else if(f.state === "complete") command({ turnin: f.quest });
  closeDialog();
};
