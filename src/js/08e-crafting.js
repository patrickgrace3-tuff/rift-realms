"use strict";
// Professions window (O), crafting effects, set tooltips, the Artisan's Forges in the world,
// and the crafted sets' auras: Dawnforged sunfire, Stormwing lightning, Voidweave starfields.

/* ---------- Professions window ---------- */
const profSkillColor = (skill, req) => skill < req ? "#ff5a4a" : skill < req + 25 ? "#ff9a40" : skill < req + 50 ? "#ffd84a" : skill < req + 75 ? "#6be08f" : "#9a9a9a";
function openProf(){ if(!G) return; $("#profWin").hidden = false; G.profKey = ""; G.profTab = G.profTab || "refine"; renderProf(); }
function renderProf(){
  if(!G || $("#profWin").hidden) return;
  const me = G.snap && G.snap.h.find(h => h.side === G.myTeam); if(!me) return;
  const prof = me.prof || {}, inv = (me.gear && me.gear.inv) || [], brenna = NPCS.find(n => n.profs);
  const atTrainer = Math.hypot(me.x - brenna.x, me.y - brenna.y) < 450, atForge = FORGES.some(f => Math.hypot(me.x - f.x, me.y - f.y) < FORGE_RANGE);
  const have = key => inv.filter(x => x.key === key).reduce((a, x) => a + (x.q || 1), 0);
  const key = [JSON.stringify(prof), me.gear && me.gear.ver, G.profTab, atTrainer, atForge].join("|"); if(key === G.profKey) return; G.profKey = key;
  $("#profForge").textContent = atForge ? "At an Artisan's Forge" : "Crafting needs an Artisan's Forge";
  $("#profForge").className = atForge ? "coins" : "lobbymsg";
  $("#profSkills").innerHTML = PROF_KEYS.map(p => {
    const P = PROFS[p], v = prof[p];
    const right = v ? `<div class="pbar"><i style="width:${v / PROF_MAX * 100}%"></i><span>${v} / ${PROF_MAX}</span></div>`
      : `<button class="btn small" data-learn="${p}" ${atTrainer ? "" : "disabled"} title="${atTrainer ? "" : "Learn from Master Artisan Brenna in Sunhollow village"}">Learn</button>`;
    return `<div class="profrow"><div><b>${P.name}</b><span>${esc(P.hint)}</span></div>${right}</div>`;
  }).join("") + (atTrainer ? "" : `<p class="lobbymsg" style="text-align:left">Learn professions from <b>Master Artisan Brenna</b> in Sunhollow village, by the Artisan's Forge.</p>`);
  $("#profTabs").innerHTML = RECIPE_GROUPS.map(([g, label]) => `<button class="chip" data-ptab="${g}" aria-pressed="${G.profTab === g}">${label}</button>`).join("");
  const skill = prof.artisanry || 0, S = SETS[G.profTab];
  let html = S ? `<div class="setinfo" style="--sc:${S.color}"><b>${S.name}</b> · six pieces for ${S.cls} champions${S.bonus.map(([n, t]) => `<div><span>(${n})</span> ${esc(t)}</div>`).join("")}</div>` : "";
  html += Object.values(RECIPES).filter(R => R.group === G.profTab).map(R => {
    const ok = Object.keys(R.need).every(m => have(m) >= R.need[m]), can = !!prof.artisanry && atForge && skill >= R.req && ok;
    const icon = R.out.mat ? makeMat(R.out.mat, 0) : makeSetItem(R.out.set, R.out.slot, 0);
    const mats = Object.keys(R.need).map(m => `<span style="color:${have(m) >= R.need[m] ? "#cfe8c8" : "#ff8a70"}">${esc(MATERIALS[m].n)} ${have(m)}/${R.need[m]}</span>`).join(" · ");
    return `<div class="rrow"><img alt="" src="${itemIconURL(icon)}"><div class="ri"><b style="color:${R.out.set ? RARITY[SET_RARITY].c : "#f3ead2"}">${esc(recipeName(R))}</b>
      <span style="color:${profSkillColor(skill, R.req)}">Artisanry ${R.req}</span><span class="rm">${mats}</span></div>
      <div class="row"><button class="btn${R.out.set ? " primary" : ""}" data-craft="${R.id}" data-n="1" ${can ? "" : "disabled"}>${R.out.set ? "Forge" : "Craft"}</button>${R.out.mat ? `<button class="btn" data-craft="${R.id}" data-n="5" ${can ? "" : "disabled"}>×5</button>` : ""}</div></div>`;
  }).join("");
  $("#profRecipes").innerHTML = html;
}
$("#profWin").addEventListener("click", e => {
  const b = e.target.closest("[data-learn],[data-ptab],[data-craft]"); if(!b || !G) return;
  if(b.dataset.learn) command({ learn: b.dataset.learn });
  else if(b.dataset.ptab){ G.profTab = b.dataset.ptab; }
  else if(b.dataset.craft) command({ craft: b.dataset.craft, n: +b.dataset.n });
  G.profKey = ""; renderProf();
});
$("#profClose").onclick = () => { $("#profWin").hidden = true; };
$("#profBtn").onclick = () => { if($("#profWin").hidden) openProf(); else $("#profWin").hidden = true; };

/* ---------- Effects ---------- */
function craftFx(f, mine){
  switch(f.k){
    case "profs": if(mine) openProf(); break;
    case "learned": if(mine){ banner(`${PROFS[f.prof].name} learned`, PROFS[f.prof].hint, 3600); G.profKey = ""; } break;
    case "skillup": if(mine) lootLine(`${PROFS[f.prof].name} skill ${f.v}`, "#7fd3ff"); break;
    case "gathered": if(mine) lootLine(`${PROFS[f.prof].verb}: ${f.n}${f.q > 1 ? ` ×${f.q}` : ""}`, "#cfe8c8"); break;
    case "crafted":
      if(mine){ lootLine(`Crafted: ${f.n}${f.q > 1 ? ` ×${f.q}` : ""}`, f.set ? RARITY[SET_RARITY].c : "#f0d58e"); G.profKey = ""; }
      if(f.set){ G.fx.push({ k: "nova", x: f.x, y: f.y, r: 600, t: 0, dur: 1.1, setc: SETS[f.set].fx }); if(mine){ banner(`Forged: ${f.n}`, `${SETS[f.set].name} set piece`, 3600); playSound(() => sfx("level-up")); } }
      break;
    case "zap": G.fx.push(Object.assign({ t: 0, dur: .3 }, f)); break;
    case "voidecho": G.fx.push({ k: "nova", x: f.x, y: f.y, r: 320, t: 0, dur: .6, setc: SETS.void.fx }); if(mine) G.nums.push({ x: f.x, y: f.y, v: "Void Echo!", t: 1.1, h: 3.2, color: "#d070ff", big: true }); break;
  }
}
// a crackling line of lightning between two points (Stormwing's Chain Lightning)
function zapMesh(f){
  const a = XF(f.x, f.y), b = XF(f.x2, f.y2), pts = [], n = 7;
  for(let i = 0; i <= n; i++){ const k = i / n, j = i === 0 || i === n ? 0 : .35; pts.push(new THREE.Vector3(a.x + (b.x - a.x) * k + (Math.random() - .5) * j, 1.2 + (Math.random() - .5) * j, a.z + (b.z - a.z) * k + (Math.random() - .5) * j)); }
  f.mesh = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xbff6ff, transparent: true })); f.ownGeo = true;
  f.mesh.position.y = hAt(a.x, a.z);
}

/* ---------- Set tooltips ---------- */
function setTooltip(it, equip){
  const S = SETS[it.set]; if(!S) return "";
  const worn = setCount(equip).all[it.set] || 0;
  return `<div class="setinfo" style="--sc:${S.color}"><b>${S.name}</b> (${worn}/6)${S.bonus.map(([n, t]) => `<div class="${worn >= n ? "on" : ""}"><span>(${n})</span> ${esc(t)}</div>`).join("")}</div>`;
}

/* ---------- Artisan's Forges ---------- */
function buildForges(g){
  const stoneM = new THREE.MeshStandardMaterial({ color: 0x5a5650, flatShading: true }), ironM = new THREE.MeshStandardMaterial({ color: 0x3a3a40, metalness: .6, roughness: .4 });
  for(const f of FORGES){
    const grp = new THREE.Group();
    const hearth = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 1.4), stoneM); hearth.position.set(-1.1, .6, 0);
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(.7, 2.6, .7), stoneM); chimney.position.set(-1.5, 2.2, -.2);
    const coals = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMat.map, color: 0xff6a20, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); coals.scale.set(1.8, 1.8, 1); coals.position.set(-1.1, 1.3, .3);
    const anvil = new THREE.Group(), base = new THREE.Mesh(new THREE.BoxGeometry(.5, .6, .5), ironM), top = new THREE.Mesh(new THREE.BoxGeometry(1.2, .3, .5), ironM), horn = new THREE.Mesh(new THREE.ConeGeometry(.15, .5, 6), ironM);
    base.position.y = .3; top.position.y = .75; horn.rotation.z = -Math.PI / 2; horn.position.set(.8, .75, 0); anvil.add(base, top, horn); anvil.position.set(1, 0, .2);
    grp.add(hearth, chimney, coals, anvil);
    const w = XF(f.x, f.y); grp.position.set(w.x, ZH(f.x, f.y), w.z); g.add(grp);
    FORGE_FX.push(coals); PORTAL_VIS.push({ x: f.x, y: f.y, name: f.name, shown: true });
  }
}
const FORGE_FX = [];

/* ---------- Set auras ---------- */
// 2 pieces: a glowing rune circle; 4: rising sparks; 6: the full show (sunrays, lightning, or orbiting stars)
const RUNE_TEX = {};
function runeTexture(key){
  if(RUNE_TEX[key]) return RUNE_TEX[key];
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"), S = SETS[key];
  g.strokeStyle = S.glow; g.lineWidth = 4; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.stroke(); g.lineWidth = 2; g.beginPath(); g.arc(64, 64, 46, 0, Math.PI * 2); g.stroke();
  g.fillStyle = S.trim; for(let i = 0; i < 12; i++){ const a = i / 12 * Math.PI * 2; g.save(); g.translate(64 + Math.cos(a) * 52, 64 + Math.sin(a) * 52); g.rotate(a); g.fillRect(-2, -5, 4, 10); g.restore(); }
  if(key === "dawn"){ g.strokeStyle = S.color; for(let i = 0; i < 8; i++){ const a = i / 8 * Math.PI * 2; g.beginPath(); g.moveTo(64 + Math.cos(a) * 20, 64 + Math.sin(a) * 20); g.lineTo(64 + Math.cos(a) * 44, 64 + Math.sin(a) * 44); g.stroke(); } }
  if(key === "storm"){ g.strokeStyle = S.trim; g.lineWidth = 3; g.beginPath(); g.moveTo(70, 26); g.lineTo(52, 66); g.lineTo(70, 62); g.lineTo(56, 102); g.stroke(); }
  if(key === "void"){ g.fillStyle = S.trim; for(let i = 0; i < 5; i++){ const a = i / 5 * Math.PI * 2 - Math.PI / 2; g.beginPath(); g.arc(64 + Math.cos(a) * 30, 64 + Math.sin(a) * 30, 4, 0, Math.PI * 2); g.fill(); } }
  return RUNE_TEX[key] = new THREE.CanvasTexture(c);
}
function buildSetFx(key){
  const S = SETS[key], fx = { key, grp: new THREE.Group(), extras: [] }, add = m => { fx.grp.add(m); return m; };
  const additive = (col, op = 1) => ({ color: col, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending });
  const rg = new THREE.PlaneGeometry(2.6, 2.6); rg.rotateX(-Math.PI / 2);
  fx.rune = add(new THREE.Mesh(rg, new THREE.MeshBasicMaterial(Object.assign({ map: runeTexture(key) }, additive(0xffffff))))); fx.rune.position.y = .05;
  fx.glow = add(new THREE.Sprite(new THREE.SpriteMaterial(Object.assign({ map: glowMat.map }, additive(S.fx, .55))))); fx.glow.position.y = 1.3;
  const N = 36, pos = new Float32Array(N * 3); fx.seeds = Array.from({ length: N }, () => [Math.random() * 6.28, .35 + Math.random() * .6, Math.random(), .6 + Math.random()]);
  const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  fx.pts = add(new THREE.Points(pg, new THREE.PointsMaterial(Object.assign({ size: .16 }, additive(S.fx))))); fx.pts.frustumCulled = false;
  if(key === "dawn") for(let i = 0; i < 8; i++){ const ray = add(new THREE.Mesh(new THREE.PlaneGeometry(.12, 3.6), new THREE.MeshBasicMaterial(Object.assign({ side: THREE.DoubleSide }, additive(0xffd25a, .5))))); ray.userData.a = i / 8 * Math.PI * 2; fx.extras.push(ray); }
  if(key === "storm"){ const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(16 * 3), 3)); fx.bolt = add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial(additive(0xbff6ff)))); fx.bolt.frustumCulled = false; fx.extras.push(fx.bolt); fx.boltT = 0;
    for(const sx of [-1, 1]){ const wing = add(new THREE.Mesh(new THREE.PlaneGeometry(1.4, .9), new THREE.MeshBasicMaterial(Object.assign({ side: THREE.DoubleSide }, additive(0x5fe0ff, .45))))); wing.userData.sx = sx; fx.extras.push(wing); } }
  if(key === "void"){ for(let i = 0; i < 5; i++){ const st = add(new THREE.Sprite(new THREE.SpriteMaterial(Object.assign({ map: glowMat.map }, additive(i % 2 ? 0xf0d0ff : 0xb050ff))))); st.scale.set(.5, .5, 1); st.userData.a = i / 5 * Math.PI * 2; fx.extras.push(st); }
    const disc = add(new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: 0x1a0830, transparent: true, opacity: .45, depthWrite: false }))); disc.scale.setScalar(1.4); disc.position.y = .04; fx.extras.push(disc); disc.userData.disc = true; }
  G.root.add(fx.grp); return fx;
}
function updateSetAura(v, c, w, y, t, hidden){
  const want = c.sk && c.sn >= 2 && !c.dead && !hidden ? c.sk : null;
  if(v.setFx && (!want || v.setFx.key !== want)){ G.root.remove(v.setFx.grp); v.setFx = null; }
  if(!want) return;
  if(!v.setFx) v.setFx = buildSetFx(want);
  const fx = v.setFx, n = c.sn, full = n >= 6, k = n >= 6 ? 1 : n >= 4 ? .7 : .45;
  fx.grp.position.set(w.x, y, w.z);
  fx.rune.rotation.y = t * (full ? 1.2 : .5); fx.rune.material.opacity = k * (.75 + Math.sin(t * 3) * .25); fx.rune.scale.setScalar(full ? 1.25 : 1);
  fx.glow.material.opacity = k * .28; const gs = (full ? 2.8 : 2.1) + Math.sin(t * 4) * .25; fx.glow.scale.set(gs, gs, 1); fx.glow.position.y = .9;
  fx.pts.visible = n >= 4;
  if(fx.pts.visible){
    const a = fx.pts.geometry.attributes.position.array;
    fx.seeds.forEach(([ang, r, off, sp], i) => {
      const life = (t * sp * .5 + off) % 1, aa = ang + (fx.key === "void" ? t * 1.5 : t * .4);
      a[i * 3] = Math.cos(aa) * r * (fx.key === "storm" ? 1 + life : 1); a[i * 3 + 1] = fx.key === "void" ? 1.2 + Math.sin(t * 2 + i) * .9 : life * (full ? 3.4 : 2.4); a[i * 3 + 2] = Math.sin(aa) * r;
    });
    fx.pts.geometry.attributes.position.needsUpdate = true; fx.pts.material.size = full ? .22 : .15;
  }
  for(const e of fx.extras) e.visible = full;
  if(!full) return;
  if(fx.key === "dawn") for(const ray of fx.extras){ const a = ray.userData.a + t * .8; ray.position.set(Math.cos(a) * .9, 1.8, Math.sin(a) * .9); ray.rotation.y = -a; ray.material.opacity = .3 + Math.sin(t * 5 + a * 3) * .2; }
  if(fx.key === "storm"){
    fx.boltT -= 1 / 60;
    if(fx.boltT <= 0){ fx.boltT = .08; const p = fx.bolt.geometry.attributes.position.array; let px = (Math.random() - .5) * 1.2, py = Math.random() * 2.6, pz = (Math.random() - .5) * 1.2;
      for(let i = 0; i < 16; i += 2){ p[i * 3] = px; p[i * 3 + 1] = py; p[i * 3 + 2] = pz; px += (Math.random() - .5) * .7; py += (Math.random() - .5) * .7; pz += (Math.random() - .5) * .7; p[i * 3 + 3] = px; p[i * 3 + 4] = py; p[i * 3 + 5] = pz; }
      fx.bolt.geometry.attributes.position.needsUpdate = true; }
    for(const e of fx.extras) if(e.userData.sx){ e.position.set(e.userData.sx * .9, 1.7, -.15); e.rotation.set(0, 0, e.userData.sx * (.3 + Math.sin(t * 6) * .25)); }
  }
  if(fx.key === "void") for(const e of fx.extras){ if(e.userData.disc){ e.scale.setScalar(1.4 + Math.sin(t * 2) * .15); continue; } const a = e.userData.a + t * 1.8; e.position.set(Math.cos(a) * 1.1, 1.4 + Math.sin(t * 3 + a) * .4, Math.sin(a) * 1.1); }
}
