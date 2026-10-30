"use strict";
// Quest tracker, loot feed, character window, skill tree, minimap, world map, HUD, effects.

/* ---------- Quest tracker lines ---------- */
function questLine(id, me){
  const Q = QUESTS[id], qs = me.quests[id], o = Q.obj, nm = nid => NPCS.find(n => n.id === nid).name;
  if(qs.state === "ready") return [`Return to ${nm(Q.turnin)}`, "done"];
  if(qs.state === "failed") return [`Failed. Return to ${nm(Q.giver)}`, "warn"];
  const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  if(o.type === "deliver"){ if(!Q.timeLimit) return [o.label, ""]; const left = qs.left || 0; return [`${o.label} · ${clock(left)} left`, left < 60 ? "warn" : ""]; }
  if(o.type === "loot") return [G.snap.l.some(l => l[1] === G.myTeam && l[2] === o.item) ? `Pick up ${o.itemName}` : `${o.label}: ${qs.count}/${o.count}`, ""];
  if(o.type === "defend") return qs.phase ? [`Survive ${clock(qs.left || 0)} · stay near ${o.place}`, "warn"] : [`Go to ${o.place}`, ""];
  return [`${o.label}: ${qs.count}/${o.count}`, ""];
}
$("#trList").addEventListener("click", e => { const q = e.target.closest("[data-q]"); if(q && G){ G.focusQuest = q.dataset.q; G.trHtml = ""; } });

/* ---------- Loot feed ---------- */
function lootLine(text, color){
  const el = $("#lootFeed"), d = document.createElement("div"); d.textContent = text; d.style.color = color || "#f3ead2";
  el.appendChild(d); while(el.children.length > 7) el.firstChild.remove();
  setTimeout(() => d.remove(), 7000);
}

/* ---------- Character window ---------- */
function openChar(){ $("#charWin").hidden = false; G.charKey = ""; G.salvArm = null; renderChar(); }
function slotBtn(it, attrs, label, sel){
  const border = it ? RARITY[it.r].c : "var(--line)";
  return `<button class="islot${sel ? " sel" : ""}" ${attrs} style="border-color:${border}" aria-label="${it ? esc(it.n) : label}">${it ? `<img alt="" src="${itemIconURL(it)}">${(it.q || 1) > 1 ? `<span class="qty">${it.q}</span>` : ""}` : `<span class="ph">${label}</span>`}</button>`;
}
function itemMeta(it){
  if(it.s === "mat") return "Trade good · salvage for coin";
  if(it.s === "use") return `Use: ${SHOP_ITEMS[it.key] ? SHOP_ITEMS[it.key].desc : ""}`;
  const kind = it.s === "weapon" ? ({ sword: "Sword", staff: "Staff", bow: "Bow" }[it.wt] || "Weapon") : `${MATERIAL[it.m].label} ${SLOT_NAME[it.s]}`;
  return `${RARITY[it.r].n} ${kind} · Item level ${it.il}`;
}
function renderChar(){
  const me = G.snap && G.snap.h.find(h => h.side === G.myTeam); if(!me) return;
  const gear = me.gear || { inv: [], equip: {} }, d = G.details[G.myTeam];
  let sel = null;
  if(G.sel){ sel = G.sel.from === "bag" ? gear.inv.find(x => x.id === G.sel.id) : gear.equip[G.sel.slot]; if(!sel) G.sel = null; }
  const key = [gear.ver, JSON.stringify(G.sel), G.salvArm, me.lvl, me.coins, me.maxHp, me.ad].join("|");
  if(key === G.charKey) return;
  G.charKey = key;
  $("#chName").textContent = d.name; $("#chSub").textContent = `Level ${me.lvl} ${G.myKit.cls}`; $("#chCoins").textContent = fmtCoins(me.coins);
  const eqBtn = sl => slotBtn(gear.equip[sl], `data-eq="${sl}"`, SLOT_NAME[sl], G.sel && G.sel.from === "eq" && G.sel.slot === sl);
  $("#eqLeft").innerHTML = ["head", "chest", "hands"].map(eqBtn).join("");
  $("#eqRight").innerHTML = ["legs", "feet", "weapon"].map(eqBtn).join("");
  let bags = "";
  for(let i = 0; i < BAG_SIZE; i++){ const it = gear.inv[i]; bags += it ? slotBtn(it, `data-bag="${it.id}"`, "", G.sel && G.sel.from === "bag" && G.sel.id === it.id) : `<button class="islot" disabled aria-label="Empty bag slot"></button>`; }
  $("#bags").innerHTML = bags; $("#bagCount").textContent = `${gear.inv.length}/${BAG_SIZE}`;
  const red = Math.round(me.armor / (me.armor + 300) * 100);
  $("#chStats").innerHTML = [["Health", me.maxHp], ["Attack damage", me.ad], ["Ability damage", `+${me.ap}%`], ["Armor", `${me.armor} (${red}% less damage)`], ["Cooldown reduction", `${me.haste}%`], ["Movement speed", `+${me.msPct}%`]].map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join("");
  const det = $("#idetail");
  if(!sel) det.innerHTML = `<p class="lobbymsg" style="text-align:left">Select an item to see its stats. Double-click a bag item to equip it.</p>`;
  else {
    const fromBag = G.sel.from === "bag", cmp = fromBag && isGear(sel) ? gear.equip[sel.s] : null;
    const stats = Object.keys(sel.st || {}).map(k => STAT[k].line(sel.st[k])).join("<br>");
    let cmpHtml = "";
    if(fromBag && isGear(sel)){
      if(!cmp) cmpHtml = `<div class="cmp">Your ${SLOT_NAME[sel.s].toLowerCase()} slot is empty.</div>`;
      else {
        const keys = [...new Set([...Object.keys(sel.st), ...Object.keys(cmp.st)])];
        const diffs = keys.map(k => { const dv = (sel.st[k] || 0) - (cmp.st[k] || 0); return dv ? `<span class="${dv > 0 ? "up" : "down"}">${dv > 0 ? "+" : ""}${dv} ${STAT[k].short}</span>` : ""; }).filter(Boolean).join(" · ");
        cmpHtml = `<div class="cmp">Compared with <span style="color:${RARITY[cmp.r].c}">${esc(cmp.n)}</span>: ${diffs || "no change"}</div>`;
      }
    }
    const val = fmtCoins(sel.v * (sel.q || 1)), armed = G.salvArm === sel.id;
    const btns = fromBag
      ? `${isGear(sel) ? `<button class="btn primary" data-act="equip">Equip</button>` : sel.key === "hpot" ? `<button class="btn primary" data-act="drink">Drink (F)</button>` : ""}<button class="btn" data-act="salvage">${armed ? "Click again to salvage" : `Salvage for ${val}`}</button>`
      : `<button class="btn" data-act="unequip">Unequip</button>`;
    det.innerHTML = `<div class="in" style="color:${RARITY[sel.r].c}">${esc(sel.n)}${(sel.q || 1) > 1 ? ` ×${sel.q}` : ""}</div><div class="im">${itemMeta(sel)}</div>${stats ? `<div class="ist">${stats}</div>` : ""}${cmpHtml}<div class="row">${btns}</div>`;
  }
  // paper doll
  if(!G.dollArt){ G.dollArt = new CharArt({ style: G.myKit.cls, headUrl: champIcon(d.id), ring: "#c9a55c", initial: d.name[0] }); G.dollArt.onload = () => { G.charKey = ""; }; }
  applyLook(G.dollArt, gear.equip);
  if((G.dollArt.o.tier || 0) !== (me.wglow ? 1 : 0)){ G.dollArt.o.tier = me.wglow ? 1 : 0; }
  G.dollArt.draw(0, false, "idle", true);
  const dg = $("#dollCv").getContext("2d"); dg.clearRect(0, 0, 128, 192); dg.drawImage(G.dollArt.canvas, 0, 0);
}
$("#charBtn").onclick = () => { if($("#charWin").hidden) openChar(); else $("#charWin").hidden = true; };
$("#chClose").onclick = () => { $("#charWin").hidden = true; };
$("#charWin").addEventListener("click", e => {
  if(!G) return;
  const b = e.target.closest("[data-eq],[data-bag],[data-act]"); if(!b) return;
  if(b.dataset.eq){ G.sel = { from: "eq", slot: b.dataset.eq }; G.salvArm = null; }
  else if(b.dataset.bag){ G.sel = { from: "bag", id: b.dataset.bag }; G.salvArm = null; }
  else if(b.dataset.act && G.sel){
    const a = b.dataset.act;
    if(a === "equip"){ command({ equip: G.sel.id }); G.sel = null; }
    else if(a === "drink") command({ potion: 1 });
    else if(a === "unequip"){ command({ unequip: G.sel.slot }); G.sel = null; }
    else if(a === "salvage"){
      const me = G.snap.h.find(h => h.side === G.myTeam), it = me.gear.inv.find(x => x.id === G.sel.id);
      if(it && it.r >= 2 && G.salvArm !== it.id){ G.salvArm = it.id; }
      else { command({ salvage: G.sel.id }); G.sel = null; G.salvArm = null; }
    }
  }
  G.charKey = ""; renderChar();
});
$("#charWin").addEventListener("dblclick", e => { const b = e.target.closest("[data-bag]"); if(!b || !G) return; const me = G.snap.h.find(h => h.side === G.myTeam), it = me.gear.inv.find(x => x.id === b.dataset.bag); if(isGear(it)){ command({ equip: it.id }); G.sel = null; G.charKey = ""; } });

/* ---------- Skill tree panel ---------- */
function openSkills(){ $("#skills").hidden = false; G.skillKey = ""; const me = G.snap && G.snap.h.find(h => h.side === G.myTeam); if(me) renderSkills(me); }
function fmtNum(v){ return Math.round(v); }
function abilityStat(p){
  const bits = [];
  if(p.dmg) bits.push(`Damage ${fmtNum(p.dmg)}`);
  if(p.amount) bits.push(`${p.type === "heal" ? "Heal" : "Shield"} ${fmtNum(p.amount)}`);
  if(p.type === "steroid") bits.push(`+${Math.round(p.as * 100)}% attack speed`);
  if(p.dur && ["stealth", "steroid", "field", "summon", "orbit"].includes(p.type)) bits.push(`${(Math.round(p.dur * 10) / 10)}s`);
  bits.push(`Cooldown ${p.cd}s`);
  return bits.join(" · ");
}
function renderSkills(me){
  const t = me.talents, pts = me.points, d = G.details[G.myTeam], kit = G.myKit;
  G.skillKey = JSON.stringify(t) + pts + me.lvl;
  $("#skPoints").innerHTML = `${pts} skill point${pts === 1 ? "" : "s"} to spend<small>Earn one every level · Level ${me.lvl}</small>`;
  const node = (slot, key, name, desc, rank, max, extraCls) => {
    const ok = canTalent(me.lvl, t, slot, key), locked = key === "mastery" && t[slot].power + t[slot].haste < 3;
    const pips = Array.from({ length: max }, (_, i) => `<i class="${i < rank ? "on" : ""}"></i>`).join("");
    return `<div class="node ${extraCls || ""} ${rank >= max ? "maxed" : ""} ${locked && rank === 0 ? "locked" : ""}">
      <div class="nm">${name}</div><button data-t="${slot}.${key}" ${ok ? "" : "disabled"} aria-label="Add a point to ${name}">+</button>
      <div class="ds">${desc}</div><div class="pips">${pips}</div></div>`;
  };
  const cols = SLOTS.map((k, i) => {
    const base = kit[k], cur = applyTalents(base, t[k]), tal = t[k];
    return `<section class="tree"><header><img alt="" src="${spellIcon(d.spells[i].image.full)}"><div><span>${k} · ${ARCH[base.type].label}</span><b>${esc(d.spells[i].name)}</b></div></header>
      <div class="stat">${abilityStat(cur)}</div>
      ${node(k, "power", "Power", `+${Math.round(TALENT.power.per * 100)}% ${base.dmg ? "damage" : base.amount ? "strength" : "effect"} per point`, tal.power, TALENT.power.max)}
      ${node(k, "haste", "Haste", `−${Math.round(TALENT.haste.per * 100)}% cooldown per point`, tal.haste, TALENT.haste.max)}
      ${node(k, "mastery", "Mastery", `${MASTERY[base.type]}.${tal.mastery ? "" : " Needs 3 points in Power or Haste."}`, tal.mastery, 1, "mastery")}
    </section>`;
  });
  cols.push(`<section class="tree"><header><div class="core">✦</div><div><span>Core</span><b>${esc(d.name)}</b></div></header>
    <div class="stat">Health ${me.maxHp} · Attack ${me.ad}</div>
    ${node("core", "vit", "Vitality", `+${Math.round(TALENT.vit.per * 100)}% max health per point`, t.core.vit, TALENT.vit.max)}
    ${node("core", "might", "Might", `+${Math.round(TALENT.might.per * 100)}% attack damage per point`, t.core.might, TALENT.might.max)}
  </section>`);
  $("#skTrees").innerHTML = cols.join("");
  $("#skTrees").querySelectorAll("button[data-t]").forEach(b => b.onclick = () => command({ talent: b.dataset.t }));
  $("#skReset").disabled = talentsSpent(t) === 0; $("#skReset").textContent = "Reset points"; G.resetArmed = false;
}
$("#skillsBtn").onclick = openSkills;
$("#skClose").onclick = () => { $("#skills").hidden = true; };
$("#skReset").onclick = () => {
  if(!G.resetArmed){ G.resetArmed = true; $("#skReset").textContent = "Click again to reset"; return; }
  G.resetArmed = false; command({ respec: 1 });
};

/* ---------- Minimap and world map ---------- */
const mmCv = $("#minimap"), mmG = mmCv.getContext("2d"), bmCv = $("#bigmapCv"), bmG = bmCv.getContext("2d"), MM = { view: 1700 };
function currentQuest(me){
  const live = id => me.quests[id] && me.quests[id].state !== "done";
  return G.focusQuest && live(G.focusQuest) ? G.focusQuest : QUEST_ORDER.find(live);
}
function objectiveTarget(me){
  const qid = currentQuest(me);
  if(!qid) return null;
  const Q = QUESTS[qid], qs = me.quests[qid], o = Q.obj, npcAt = id => { const n = NPCS.find(x => x.id === id); return { x: n.x, y: n.y, r: 0 }; };
  if(qs.state === "ready" || o.type === "deliver") return npcAt(Q.turnin);
  if(qs.state === "failed") return npcAt(Q.giver);
  const near = pts => { let best = null, bd = 1e9; pts.forEach((p, i) => { if(qs.flags && qs.flags[i]) return; const d = Math.hypot(p.x - me.x, p.y - me.y); if(d < bd){ bd = d; best = p; } }); return best; };
  if(o.type === "explore" || o.type === "interact"){ const p = near(o.points); return p ? { x: p.x, y: p.y, r: 0 } : null; }
  if(o.type === "defend") return { x: o.at.x, y: o.at.y, r: qs.phase ? 1150 : 550 };
  const loot = G.snap.l && G.snap.l.find(l => l[1] === G.myTeam && l[2] === o.item);
  if(loot) return { x: loot[3], y: loot[4], r: 0 };
  return { x: Q.where[0], y: Q.where[1], r: Q.whereR || 0 };
}
function markerFor(me, npcId){
  const qf = questFor(me.quests, npcId);
  return qf.state === "offer" ? ["!", "#ffd84a"] : qf.state === "complete" ? ["?", "#ffd84a"] : qf.state === "waiting" ? ["?", "#b8b8b8"] : null;
}
function mapArrow(g, x, y, face, size, color){
  g.save(); g.translate(x, y); g.rotate(face);
  g.beginPath(); g.moveTo(0, -size); g.lineTo(size * .7, size * .8); g.lineTo(0, size * .4); g.lineTo(-size * .7, size * .8); g.closePath();
  g.fillStyle = color; g.strokeStyle = "#1b1410"; g.lineWidth = 2; g.fill(); g.stroke(); g.restore();
}
function mapText(g, text, x, y, color, size){
  g.font = `700 ${size}px 'Barlow Condensed', sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
  g.lineWidth = 3.5; g.strokeStyle = "#1b1410"; g.strokeText(text, x, y); g.fillStyle = color; g.fillText(text, x, y);
}
function drawMapIcons(g, toS, me, o){
  const clamp = (x, y) => {
    if(!o.clampR) return [x, y, false];
    const dx = x - o.cx, dy = y - o.cy, d = Math.hypot(dx, dy);
    return d > o.clampR ? [o.cx + dx / d * o.clampR, o.cy + dy / d * o.clampR, true] : [x, y, false];
  };
  const obj = objectiveTarget(me);
  if(obj){
    const [ox, oy] = toS(obj.x, obj.y);
    if(obj.r){ g.save(); g.setLineDash([5, 4]); g.strokeStyle = "rgba(255,216,74,.9)"; g.lineWidth = 2; g.beginPath(); g.arc(ox, oy, obj.r * o.scale, 0, Math.PI * 2); g.stroke(); g.restore(); }
    const [cx, cy, edge] = clamp(ox, oy);
    if(edge || !obj.r){ g.beginPath(); g.arc(cx, cy, 6, 0, Math.PI * 2); g.strokeStyle = "#ffd84a"; g.lineWidth = 2.5; g.stroke(); g.beginPath(); g.arc(cx, cy, 2, 0, Math.PI * 2); g.fillStyle = "#ffd84a"; g.fill(); }
  }
  for(const m of G.snap.m){
    const MT = MOBS[m[1]];
    if(o.world && !MT.elite) continue; // the world map only marks elites
    const [sx, sy] = toS(m[2], m[3]);
    if(MT.boss) mapText(g, "◆", sx, sy, "#ff8a1e", o.big ? 24 : 18);
    else if(MT.elite){ g.beginPath(); g.arc(sx, sy, 5, 0, Math.PI * 2); g.fillStyle = "#ff6a50"; g.fill(); g.strokeStyle = "#1b1410"; g.lineWidth = 1.5; g.stroke(); }
    else if(m[1] === "bandit"){ g.beginPath(); g.arc(sx, sy, 3, 0, Math.PI * 2); g.fillStyle = "#ff5040"; g.fill(); }
    else if(m[1] === "wolf"){ g.beginPath(); g.arc(sx, sy, 2.4, 0, Math.PI * 2); g.fillStyle = (m[7] & 2) ? "#ff9a80" : "#c8b8a0"; g.fill(); }
    else { g.beginPath(); g.arc(sx, sy, 2, 0, Math.PI * 2); g.fillStyle = (m[7] & 2) ? "#ff9a80" : "#f4f1ea"; g.fill(); }
  }
  for(const l of (G.snap.l || [])){ if(l[1] !== G.myTeam) continue; const [sx, sy] = toS(l[3], l[4]); const bag = l[2] === "bag"; g.fillStyle = bag ? (l[5] ? RARITY[l[5]].c : "#b08a5a") : "#ffe08a"; const z = bag ? 2.5 : 3; g.fillRect(sx - z, sy - z, z * 2, z * 2); }
  for(const h of G.snap.h){
    if(h.side === G.myTeam || h.dead) continue;
    const ally = inMyParty(h.side), [sx, sy, edge] = clamp(...toS(h.x, h.y));
    if(edge && !ally) continue; // only party members stick to the minimap's edge
    g.beginPath(); g.arc(sx, sy, edge ? 3 : 4, 0, Math.PI * 2); g.fillStyle = duelFoe(h.side) ? "#ff5040" : ally ? "#7fd3ff" : "#d8d8d8"; g.fill(); g.strokeStyle = "#1b1410"; g.lineWidth = 1.5; g.stroke(); }
  const qh = me.quests, want = wantedNodes(me);
  for(const n of (G.snap.n || [])) if(n[3] && want.has(n[4])){ const [sx, sy] = toS(n[1], n[2]); g.beginPath(); g.arc(sx, sy, o.big ? 3.2 : 2.3, 0, Math.PI * 2); g.fillStyle = n[4] === "ore" ? "#7fd3ff" : n[4] === "frostbloom" ? "#c9e8ff" : "#ffe066"; g.fill(); g.strokeStyle = "#1b1410"; g.lineWidth = 1; g.stroke(); }
  // places to use (▲, lit once done) and to explore (◉) for quests in your log
  for(const qid in qh){
    const Q = QUESTS[qid], q = qh[qid];
    if(Q.obj.type === "interact") Q.obj.points.forEach((b, i) => { const lit = q.state === "ready" || q.state === "done" || (q.flags && q.flags[i]); const [sx, sy, edge] = clamp(...toS(b.x, b.y)); if(edge && lit) return; mapText(g, "▲", sx, sy, lit ? (qid === "beacons" ? "#ff9a40" : "#7fd3ff") : "#d8d8d8", o.big ? 15 : 11); if(o.big) mapText(g, b.name, sx, sy + 14, "#ffe9a8", 12); });
    else if(Q.obj.type === "explore" && q.state === "active") Q.obj.points.forEach((p, i) => { if(q.flags && q.flags[i]) return; const [sx, sy] = clamp(...toS(p.x, p.y)); mapText(g, "◉", sx, sy, "#ffd84a", o.big ? 15 : 11); if(o.big) mapText(g, p.name, sx, sy + 14, "#ffe9a8", 12); });
  }
  for(const n of NPCS){
    const mk = markerFor(me, n.id), [rx, ry] = toS(n.x, n.y);
    if(mk){ const [sx, sy] = clamp(rx, ry); mapText(g, mk[0], sx, sy, mk[1], o.big ? 22 : 17); }
    else { g.beginPath(); g.arc(rx, ry, 2.6, 0, Math.PI * 2); g.fillStyle = "#ffd84a"; g.fill(); }
    if(o.big) mapText(g, n.name, rx, ry + 16, "#ffe9a8", 13);
  }
  const [px, py] = toS(me.x, me.y);
  mapArrow(g, px, py, me.face, o.big ? 9 : 7, "#ffd27a");
}
function drawMinimap(me){
  const S = 180, R = 86;
  if(mmCv.width !== S * dpr){ mmCv.width = mmCv.height = S * dpr; }
  const g = mmG; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, S, S);
  g.save(); g.beginPath(); g.arc(S / 2, S / 2, R, 0, Math.PI * 2); g.clip();
  g.fillStyle = "#2a3226"; g.fillRect(0, 0, S, S);
  const k = R / MM.view, toS = (x, y) => [S / 2 + (x - me.x) * k, S / 2 - (y - me.y) * k];
  g.imageSmoothingEnabled = true;
  for(const z of ZONES){ const pic = ZONE_PICS[z.key]; if(!pic) continue; const [x0, y0] = toS(z.x0, z.y0 + z.h); g.drawImage(pic, x0, y0, z.w * k, z.h * k); }
  drawMapIcons(g, toS, me, { clampR: R - 9, cx: S / 2, cy: S / 2, scale: k });
  g.restore();
  g.lineWidth = 4; g.strokeStyle = "#8a6a3a"; g.beginPath(); g.arc(S / 2, S / 2, R, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 1.5; g.strokeStyle = "#f0d58e"; g.beginPath(); g.arc(S / 2, S / 2, R + 2, 0, Math.PI * 2); g.stroke();
  mapText(g, "N", S / 2, S / 2 - R + 1, "#f0d58e", 13);
}
// The map (M) opens on your zone. Right-click (or the World map button) zooms out to every zone; click a zone to zoom in.
const MAPVIEW = { world: false, zone: null, hover: null, fit: null };
function drawBigMap(me){
  const S = Math.round(bmCv.getBoundingClientRect().width) || 640;
  if(bmCv.width !== S * dpr){ bmCv.width = bmCv.height = S * dpr; }
  const g = bmG; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, S, S);
  bmCv.classList.toggle("world", MAPVIEW.world);
  $("#bigWorld").textContent = MAPVIEW.world ? "Your zone" : "World map";
  if(MAPVIEW.world) return drawWorldMap(g, S, me);
  const Z = (MAPVIEW.zone && ZONES.find(z => z.key === MAPVIEW.zone)) || zoneAt(me.y, me.x), top = Z.y0 + Z.h, k = S / Z.w;
  const toS = (x, y) => [(x - Z.x0) * k, (top - y) * k], pic = ZONE_PICS[Z.key];
  $("#bigTitle").textContent = Z.name; $("#bigHint").textContent = "Right-click the map to see the whole world.";
  if(pic){ g.imageSmoothingEnabled = true; g.drawImage(pic, 0, 0, S, S); }
  for(const p of POIS){
    if(p.y < Z.y0 || p.y > top || p.x < Z.x0 || p.x > Z.x0 + Z.w) continue; const [x, y] = toS(p.x, p.y); g.font = "400 16px 'Marcellus SC', Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.lineWidth = 4; g.strokeStyle = "rgba(20,14,8,.85)"; g.strokeText(p.name, x, y); g.fillStyle = "#f3ead2"; g.fillText(p.name, x, y); }
  drawMapIcons(g, toS, me, { scale: k, big: true });
}
function worldBounds(){
  const x0 = Math.min(...ZONES.map(z => z.x0)), y0 = Math.min(...ZONES.map(z => z.y0));
  const x1 = Math.max(...ZONES.map(z => z.x0 + z.w)), y1 = Math.max(...ZONES.map(z => z.y0 + z.h));
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}
function drawWorldMap(g, S, me){
  const b = worldBounds(), pad = S * .05, k = (S - pad * 2) / Math.max(b.w, b.h), ox = (S - b.w * k) / 2, oy = (S - b.h * k) / 2;
  const toS = (x, y) => [ox + (x - b.x0) * k, oy + (b.y1 - y) * k];
  MAPVIEW.fit = { b, k, ox, oy };
  $("#bigTitle").textContent = "World map"; $("#bigHint").textContent = "Click a zone to zoom in. Right-click to go back to your zone.";
  g.strokeStyle = "rgba(240,213,142,.06)"; g.lineWidth = 1;
  for(let v = 0; v <= S; v += 32){ g.beginPath(); g.moveTo(v, 0); g.lineTo(v, S); g.moveTo(0, v); g.lineTo(S, v); g.stroke(); }
  g.imageSmoothingEnabled = true;
  const here = zoneAt(me.y, me.x);
  for(const z of ZONES){
    const [x, y] = toS(z.x0, z.y0 + z.h), w = z.w * k, h = z.h * k, pic = ZONE_PICS[z.key];
    if(pic) g.drawImage(pic, x, y, w, h);
    if(z !== here && z.key !== MAPVIEW.hover){ g.fillStyle = "rgba(10,14,20,.28)"; g.fillRect(x, y, w, h); }
    g.lineWidth = z.key === MAPVIEW.hover ? 3 : 1.5; g.strokeStyle = z.key === MAPVIEW.hover ? "#f0d58e" : "rgba(20,14,8,.9)"; g.strokeRect(x, y, w, h);
  }
  drawMapIcons(g, toS, me, { scale: k, world: true });
  // place names show for the zone under the mouse; the other zones show just their name
  const hov = ZONES.find(z => z.key === MAPVIEW.hover);
  if(hov) for(const p of POIS){ if(zoneAt(p.y, p.x) !== hov) continue; const [x, y] = toS(p.x, p.y); mapText(g, p.name, x, y, "#f3ead2", 12); }
  for(const z of ZONES){
    if(z === hov) continue;
    const [x, y] = toS(z.x0 + z.w / 2, z.y0 + z.h / 2);
    g.font = "400 22px 'Marcellus SC', Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.lineWidth = 5; g.strokeStyle = "rgba(20,14,8,.9)"; g.strokeText(z.name, x, y); g.fillStyle = z === here ? "#f0d58e" : "#f3ead2"; g.fillText(z.name, x, y);
    if(z === here){ g.font = "600 12px 'Barlow Condensed', sans-serif"; g.lineWidth = 3; g.strokeText("YOU ARE HERE", x, y + 20); g.fillStyle = "#ffd27a"; g.fillText("YOU ARE HERE", x, y + 20); }
  }
}
// which zone is under a point on the world map canvas
function worldMapZoneAt(e){
  const f = MAPVIEW.fit; if(!MAPVIEW.world || !f) return null;
  const r = bmCv.getBoundingClientRect(), S = r.width, sx = (e.clientX - r.left) * (Math.round(S) / S), sy = (e.clientY - r.top) * (Math.round(S) / S);
  const x = f.b.x0 + (sx - f.ox) / f.k, y = f.b.y1 - (sy - f.oy) / f.k;
  return ZONES.find(z => x >= z.x0 && x < z.x0 + z.w && y >= z.y0 && y < z.y0 + z.h) || null;
}
function setMapView(world, zone){
  Object.assign(MAPVIEW, { world, zone: zone || null, hover: null });
  bmCv.style.cursor = "";
  const me = G && G.snap && G.snap.h.find(h => h.side === G.myTeam); if(me) drawBigMap(me);
}
bmCv.addEventListener("contextmenu", e => { e.preventDefault(); setMapView(!MAPVIEW.world); });
bmCv.addEventListener("click", e => { const z = worldMapZoneAt(e); if(z) setMapView(false, z.key); });
bmCv.addEventListener("pointermove", e => {
  const z = worldMapZoneAt(e), key = z ? z.key : null;
  bmCv.style.cursor = key ? "pointer" : "";
  if(key !== MAPVIEW.hover){ MAPVIEW.hover = key; const me = G && G.snap && G.snap.h.find(h => h.side === G.myTeam); if(me && MAPVIEW.world) drawBigMap(me); }
});
bmCv.addEventListener("pointerleave", () => { if(MAPVIEW.hover){ MAPVIEW.hover = null; bmCv.style.cursor = ""; } });
$("#bigWorld").onclick = () => setMapView(!MAPVIEW.world);
function toggleBigMap(force){
  const el = $("#bigmap"), open = force !== undefined ? force : el.hidden;
  el.hidden = !open;
  if(open) Object.assign(MAPVIEW, { world: false, zone: null, hover: null });
  if(open){ const me = G.snap && G.snap.h.find(h => h.side === G.myTeam); if(me) drawBigMap(me); }
}
$("#mmIn").onclick = () => { MM.view = Math.max(900, MM.view - 400); };
$("#mmOut").onclick = () => { MM.view = Math.min(3300, MM.view + 400); };
$("#mmBig").onclick = () => toggleBigMap(true);
$("#bigClose").onclick = () => toggleBigMap(false);

/* ---------- HUD ---------- */
function buildSlots(){
  const el = $("#slots"); el.innerHTML = ""; const d = G.details[G.myTeam];
  G.slotEls = ["Q", "W", "E", "R"].map((k, i) => {
    const s = document.createElement("div"); s.className = "slot"; s.tabIndex = 0;
    s.style.pointerEvents = "auto"; // the HUD ignores the mouse; the ability buttons need it for their tooltips
    s.setAttribute("aria-label", `${k}: ${d.spells[i].name}`); s.setAttribute("aria-describedby", "abTip");
    s.innerHTML = `<img alt="" src="${spellIcon(d.spells[i].image.full)}"><div class="cd"></div><span class="key">${k}</span>`;
    const show = () => { G.tipKey = k; renderAbilityTip(); }, hide = () => { if(G) G.tipKey = null; $("#abTip").hidden = true; };
    s.addEventListener("pointerenter", show); s.addEventListener("focus", show);
    s.addEventListener("pointerleave", hide); s.addEventListener("blur", hide);
    el.appendChild(s); return s;
  });
  // the potion button (F) sits after the abilities
  const pot = document.createElement("div"); pot.className = "slot potslot"; pot.tabIndex = 0; pot.style.pointerEvents = "auto";
  pot.setAttribute("aria-label", "F: Health Potion"); pot.setAttribute("aria-describedby", "abTip");
  pot.innerHTML = `<img alt="" src="${itemIconURL(makePotion(0))}"><div class="cd"></div><span class="key">F</span><span class="qty"></span>`;
  pot.addEventListener("click", () => command({ potion: 1 }));
  const showP = () => { G.tipKey = "F"; renderAbilityTip(); }, hideP = () => { if(G) G.tipKey = null; $("#abTip").hidden = true; };
  pot.addEventListener("pointerenter", showP); pot.addEventListener("focus", showP); pot.addEventListener("pointerleave", hideP); pot.addEventListener("blur", hideP);
  el.appendChild(pot); G.potEl = pot;
  G.myKit = buildKit(d); G.tipKey = null; $("#abTip").hidden = true;
}
// node kinds the player has an active collect quest for
function wantedNodes(me){ const s = new Set(); if(me) for(const id in me.quests){ const Q = QUESTS[id]; if(Q.obj.type === "collect" && me.quests[id].state === "active") s.add(Q.obj.node); } return s; }
const potCount = me => ((me.gear && me.gear.inv) || []).filter(x => x.key === "hpot").reduce((a, x) => a + (x.q || 1), 0);
// Tooltip for an ability button: what it does, with numbers at your current level, gear and talents
function renderAbilityTip(){
  const k = G && G.tipKey, me = G && G.snap && G.snap.h.find(h => h.side === G.myTeam); if(!k || !me) return;
  if(k === "F"){
    const n = potCount(me), key = `F|${n}|${me.pot}`; if(key === G.tipRendered && !$("#abTip").hidden) return; G.tipRendered = key;
    $("#abTip").innerHTML = `<div class="tk"><span class="tag">F</span>Health Potion</div><div class="tr">${n} in your bags</div><p>${esc(SHOP_ITEMS.hpot.desc)}</p>
      ${n ? (me.pot ? `<div class="tl">Ready in ${me.pot}s</div>` : "") : `<div class="tl">Buy more from Peddler Osric in Sunhollow Village</div>`}`;
    $("#abTip").hidden = false; return;
  }
  const i = SLOTS.indexOf(k), sp = G.details[G.myTeam].spells[i], base = G.myKit[k], p = applyTalents(base, me.talents && me.talents[k]);
  const lvlScale = 1 + .1 * (me.lvl - 1), cdNow = Math.round(p.cd * (1 - (me.haste || 0) / 100) * 10) / 10, bits = [];
  if(p.dmg) bits.push(`${Math.round(p.dmg * SIM.dmgScale({ lvl: me.lvl, ap: me.ap }))} damage`);
  if(p.amount) bits.push(`${p.type === "heal" ? "Heals" : "Shields for"} ${Math.round(SIM.supportAmount({ lvl: me.lvl, ap: me.ap }, p))}`);
  if(p.type === "steroid") bits.push(`+${Math.round(p.as * 100)}% attack speed`);
  if(p.dur && ["stealth", "steroid", "field", "summon", "orbit", "shield"].includes(p.type)) bits.push(`lasts ${Math.round(p.dur * 10) / 10}s`);
  if(p.range && !["shield", "heal", "steroid", "stealth", "spin", "orbit"].includes(p.type)) bits.push(`range ${Math.round(p.range)}`);
  const locked = k === "R" && me.lvl < ULT_LEVEL, cd = me.cds[k];
  const key = [k, me.lvl, me.ap, me.haste, JSON.stringify(me.talents && me.talents[k]), locked, cd > 0 ? Math.ceil(cd) : 0].join("|");
  if(key === G.tipRendered && !$("#abTip").hidden) return;
  G.tipRendered = key;
  $("#abTip").innerHTML = `<div class="tk"><span class="tag">${k}</span>${esc(sp.name)}</div>
    <div class="tr">${k === "R" ? "Ultimate · " : ""}${ARCH[base.type].label} · ${cdNow}s cooldown</div>
    <p>${esc(describeAbility(p))}</p>
    ${bits.length ? `<div class="tn">${bits.join(" · ")}</div>` : ""}
    ${(me.talents && me.talents[k] && me.talents[k].mastery) ? `<div class="tm">Mastery: ${MASTERY[base.type]}</div>` : ""}
    ${locked ? `<div class="tl">Unlocks at level ${ULT_LEVEL}</div>` : cd > 0 ? `<div class="tl">Ready in ${Math.ceil(cd)}s</div>` : ""}`;
  $("#abTip").hidden = false;
}
let bannerTimer = null;
function banner(big, small, ms){
  $("#bannerBig").textContent = big; $("#bannerSmall").textContent = small || "";
  const b = $("#banner"); b.classList.add("show"); clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.classList.remove("show"), ms || 2500);
}
function toast(text){ banner("", text, 2500); }
function updateHud(){
  const me = G.snap && G.snap.h.find(h => h.side === G.myTeam); if(!me) return;
  $("#hpfill").style.width = Math.max(0, me.hp / me.maxHp * 100) + "%";
  $("#hptext").textContent = `${Math.max(0, me.hp)} / ${me.maxHp}`;
  $("#lvl").textContent = me.lvl; $("#xpfill").style.width = Math.min(100, me.xp / me.xpNext * 100) + "%";
  ["Q", "W", "E", "R"].forEach((k, i) => {
    const el = G.slotEls[i], cd = me.cds[k], locked = k === "R" && me.lvl < ULT_LEVEL;
    el.classList.toggle("locked", locked || !!me.dead);
    const cdEl = el.querySelector(".cd");
    cdEl.textContent = locked ? `Lv${ULT_LEVEL}` : cd > 0 ? (cd >= 1 ? Math.ceil(cd) : cd.toFixed(1)) : "";
    cdEl.style.background = cd > 0 && !locked ? `conic-gradient(rgba(5,8,14,.72) ${Math.min(1, cd / (applyTalents(G.myKit[k], me.talents && me.talents[k]).cd * (1 - (me.haste || 0) / 100))) * 360}deg, transparent 0)` : "none";
  });
  if(G.potEl){ const n = potCount(me); G.potEl.classList.toggle("locked", !n || !!me.dead); G.potEl.querySelector(".qty").textContent = n || "";
    const pcd = G.potEl.querySelector(".cd"); pcd.textContent = me.pot ? me.pot : ""; pcd.style.background = me.pot ? `conic-gradient(rgba(5,8,14,.72) ${me.pot / POTION.cd * 360}deg, transparent 0)` : "none"; }
  if(G.shop) renderShop();
  if(G.tipKey) renderAbilityTip();
  // raid boss health bar while one is nearby
  // (when you're close, or while he's fighting someone nearby)
  const boss = G.snap.m.find(m => { const d = Math.hypot(m[2] - me.x, m[3] - me.y); return MOBS[m[1]].boss && (d < 1700 || ((m[7] & 2) && d < 3000)); });
  $("#bossBar").hidden = !boss;
  if(boss){ const T = MOBS[boss[1]], pct = Math.max(0, boss[4] / boss[5] * 100); $("#bossName").textContent = T.name; $("#bossFill").style.width = pct + "%"; $("#bossPct").textContent = `${Math.ceil(pct)}%`; }
  const badge = $("#skillBadge"); badge.hidden = !(me.points > 0); badge.textContent = me.points;
  const tkey = JSON.stringify(me.talents) + me.points + me.lvl;
  if(!$("#skills").hidden && tkey !== G.skillKey) renderSkills(me);
  drawMinimap(me);
  const zn = zoneAt(me.y).name; if($("#mmZone").textContent !== zn){ $("#mmZone").textContent = zn; playMusic(zoneAt(me.y).key); banner(zn, me.y >= ZS ? "Highwatch Outpost lies north along the road" : "", 3000); }
  if(!$("#bigmap").hidden) drawBigMap(me);
  $("#respawn").hidden = !me.dead; if(me.dead) $("#respawn").textContent = `You were defeated. Returning to ${me.y >= ZS ? "Highwatch Outpost" : "the village"} in ${me.dead}…`;
  // quest tracker lists every active quest; click one to point the arrow at it
  const active = QUEST_ORDER.filter(id => me.quests[id] && me.quests[id].state !== "done");
  $("#tracker").hidden = !active.length;
  if(active.length){
    if(!active.includes(G.focusQuest)) G.focusQuest = active[0];
    const html = active.map(id => { const [txt, cls] = questLine(id, me); return `<div class="trq${id === G.focusQuest ? " focus" : ""}" data-q="${id}"><div class="qn">${esc(QUESTS[id].title)}</div><div class="qo ${cls}">${esc(txt)}</div></div>`; }).join("");
    if(html !== G.trHtml){ $("#trList").innerHTML = html; G.trHtml = html; }
  }
  const chn = $("#chan"); chn.hidden = !me.chan; if(me.chan){ $("#chanFill").style.width = Math.min(100, me.chan.p * 100) + "%"; $("#chanText").textContent = me.chan.n; }
  if(!$("#charWin").hidden) renderChar();
  updateSocial(me);
  const wpn = $("#hudWeapon"); wpn.hidden = !me.weapon; if(me.weapon) wpn.textContent = `⚔ ${me.weapon}`;
  const n = G.snap.h.length;
  let net = G.role === "host" ? (NET.code ? `World code ${NET.code}` : "") : "Co-op";
  if(n > 1) net += `${net ? " · " : ""}${n} players`;
  if(G.role === "guest" && NET.ping != null) net += ` · ${NET.ping} ms`;
  $("#netinfo").textContent = net;
}

/* ---------- Effects ---------- */
function handleFx(f){
  if(f.to && !f.to.includes(G.myTeam)) return; // party chat, invites and rolls are only for some players
  const mine = f.side === G.myTeam;
  switch(f.k){
    case "chat": case "sys": case "pinvite": case "rollstart": case "rollwin": socialFx(f, mine); break;
    case "duelreq": case "duelcount": case "duelend": duelFx(f); break;
    case "num": G.nums.push({ x: f.x, y: f.y, v: f.v, t: .8, h: f.hero ? 2.9 : 1.4, hero: f.hero, mine: f.src === G.myTeam, color: f.hero ? "#ff6b62" : f.src === G.myTeam ? "#f0d58e" : "#ffffff" }); 
      // hit sounds: your hits on creatures, your misses, and you getting hurt
      playSound(() => { if(f.v === "Miss"){ if(f.src === G.myTeam) sfx("miss"); } else if(f.hero){ if(f.tgt === G.myTeam && typeof f.v === "number") sfx("hit-player", .8); } else if(f.src === G.myTeam) sfx("hit-flesh", .7); });
      break;
    case "xp": if(mine) G.nums.push({ x: f.x, y: f.y, v: `+${f.v} XP`, t: 1.2, h: 3.4, color: "#c39bff", big: true }); break;
    case "lvl": G.fx.push(Object.assign({ t: 0, dur: 1 }, f)); if(mine) playSound(() => { if(performance.now() / 1000 - (sfxLast["level-up"] || -9) >= SFX_GAP["level-up"]) duckMusic(3.8); sfx("level-up"); }); if(mine) banner(`Level ${f.lvl}`, f.lvl === ULT_LEVEL ? "Ultimate (R) unlocked · skill point earned, press K" : "Skill point earned · press K to spend it", 2800); break;
    case "talent": if(mine && G.skillKey) G.skillKey = ""; break;
    case "dialog": if(mine) openDialog(f); break;
    case "qaccept": if(mine) banner("Quest accepted", QUESTS[f.quest].title, 2200); break;
    case "qprog": if(mine) toast(`${QUESTS[f.quest].obj.label}: ${f.count}/${QUESTS[f.quest].obj.count}`); break;
    case "qready": if(mine) banner("Objective complete", `Return to ${NPCS.find(n => n.id === QUESTS[f.quest].turnin).name}`, 3000); break;
    case "qdone": if(mine && f.item) lootLine(`+ ${f.item}`, RARITY[f.itemR || 0].c); if(mine && f.coins) lootLine(`+ ${fmtCoins(f.coins)}`, "#f0d58e");
      if(mine) banner("Quest complete!", `${QUESTS[f.quest].title} · +${f.xp} XP${f.item ? ` · Received ${f.item}` : ""}`, 3800); break;
    case "qfail": if(mine) banner("Quest failed", QUESTS[f.quest].fail, 4200); break;
    case "loot": if(mine){ if(f.coins) lootLine(`+ ${fmtCoins(f.coins)}`, "#f0d58e"); for(const it of f.items) lootLine(`+ ${it.n}${it.q > 1 ? ` ×${it.q}` : ""}`, RARITY[it.r].c); if(f.full) lootLine("Your bags are full", "#ff8a70"); } break;
    case "salvage": if(mine) lootLine(`Salvaged ${f.n} for ${fmtCoins(f.coins)}`, "#f0d58e"); break;
    case "explored": if(mine) banner(`Discovered: ${f.name}`, `${QUESTS[f.quest].obj.label}: ${f.count}/${QUESTS[f.quest].obj.count}`, 2600); break;
    case "msg": if(mine) toast(f.text); break;
    case "defstart": if(mine){ const o = QUESTS[f.quest || "defend"].obj; banner(o.start[0], o.start[1], 3000); } break;
    case "wave": if(mine) toast(`Wave ${f.n} of ${f.of}: ${QUESTS[f.quest || "defend"].obj.waveText}`); break;
    case "defwin": if(mine){ const o = QUESTS[f.quest || "defend"].obj; banner(o.win[0], o.win[1], 3200); } break;
    case "bossmsg": if(f.big) banner(f.big, f.small, 3000); else toast(f.small); chatLine("sys", "", [f.big, f.small].filter(Boolean).join(" · ")); break;
    case "warn": G.fx.push(Object.assign({ t: 0 }, f)); break;
    case "pick": G.fx.push({ k: "pop", x: f.x, y: f.y, t: 0, dur: .45 }); break;
    case "drop": if(mine) toast(`${QUESTS[f.quest].obj.itemName} dropped. Walk over it or right-click to pick it up`); break;
    case "looted": if(mine) toast(`Picked up ${QUESTS[f.quest].obj.itemName}`); break;
    case "roar": { const mv = G.mobVis.get(f.id); if(mv) mv.roarT = .9; break; }
    case "died": if(mine){ closeDialog(); playSound(() => sfx("player-death")); } break;
    case "spawn": if(mine) playSound(() => sfx("respawn")); break;
    case "angry": { const mv = G.mobVis.get(f.id); if(mv) mv.angryT = 1.2; break; }
    case "butt": { const mv = G.mobVis.get(f.id); if(mv) mv.buttT = .25; break; }
    case "pop": G.fx.push(Object.assign({ t: 0, dur: .45 }, f)); break;
    case "ring": case "nova": case "hit": case "cone": case "blink": G.fx.push(Object.assign({ t: 0, dur: f.k === "nova" ? .75 : f.frost ? .7 : .4 }, f)); break;
    case "heal": case "shielded": {
      if(f.k === "heal") G.fx.push(Object.assign({ t: 0, dur: .4 }, f));
      const hs = G.snap && G.snap.h.find(h => h.side === f.side);
      if(hs && f.v) G.nums.push({ x: hs.x, y: hs.y, v: f.k === "heal" ? `+${f.v}` : `+${f.v} shield`, t: 1.1, h: 3.1, color: f.k === "heal" ? "#6be08f" : "#9fe6ff", big: true });
      if(mine && f.from && f.from !== G.myTeam) toast(`${f.name} ${f.k === "heal" ? "healed" : "shielded"} you`);
      break;
    }
    case "shop": if(mine) openShop(f.npc); break;
    case "bought": if(mine) lootLine(`Bought ${f.n}${f.q > 1 ? ` ×${f.q}` : ""} for ${fmtCoins(f.coins)}`, "#f0d58e"); break;
  }
}
function fxMesh(f){
  if(f.k === "cone" || f.k === "warn"){
    const a = XF(f.x, f.y), b = XF(f.x + f.dx * 100, f.y + f.dy * 100), dirW = Math.atan2(-(b.z - a.z), b.x - a.x), half = f.ang / 2 * Math.PI / 180;
    const geo = new THREE.CircleGeometry(1, 32, dirW - half, half * 2); geo.rotateX(-Math.PI / 2);
    // warn: a red marker on the ground before a boss attack lands; frost: the dragon's breath and tail
    f.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: f.k === "warn" ? 0xff3020 : f.frost ? 0x9fe6ff : 0xffe08a, transparent: true, depthWrite: false, side: THREE.DoubleSide })); f.ownGeo = true;
  }else if(f.k === "nova"){
    f.mesh = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: f.frost ? 0xbfefff : 0xf0d58e, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    f.edge = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: f.frost ? 0x7fd3ff : 0xffb347, transparent: true, depthWrite: false })); G.root.add(f.edge);
  }else{
    const color = { click: 0x7fe0a0, hit: 0xf0d58e, lvl: 0xf0d58e, pop: 0xffffff, heal: 0x6be08f, blink: 0xb98cff, ring: 0xffe08a }[f.k] || 0xffffff;
    f.mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }));
    if(f.k === "blink"){ f.edge = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false })); G.root.add(f.edge); }
  }
  G.root.add(f.mesh);
}
function removeFxMesh(f){ for(const k of ["mesh", "edge"]) if(f[k]){ G.root.remove(f[k]); f[k].material.dispose(); if(k === "mesh" && f.ownGeo) f[k].geometry.dispose(); } }
