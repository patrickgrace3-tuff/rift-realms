"use strict";
// Party frames, the Players window, party invites, Need/Greed roll cards and chat.

/* ---------- Party helpers ---------- */
function myParty(){ return G && G.snap && G.snap.pt ? G.snap.pt.find(p => p[2].includes(G.myTeam)) || null : null; }
function inMyParty(side){ const p = myParty(); return !!p && p[2].includes(side); }
const heroBySide = side => G.snap.h.find(h => h.side === side);
function resetSocial(){
  $("#chatLog").innerHTML = ""; $("#chatIn").value = ""; setChatChannel("world");
  $("#party").hidden = true; $("#pInvite").hidden = true; $("#rolls").innerHTML = ""; $("#social").hidden = true;
  G.socialKey = G.partyKey = G.inviteKey = ""; G.rollEls = new Map(); G.rollPicked = {};
  chatLine("sys", "", "Press Enter to chat. Tab switches between World and Party. Press P to see who's here.");
}

/* ---------- Per-tick update (called from updateHud) ---------- */
function updateSocial(me){
  const p = myParty();
  // party frames: everyone in your party except you
  const pkey = p ? JSON.stringify([p[1], p[2].map(s => { const h = heroBySide(s); return h ? [s, h.lvl, Math.round(h.hp / h.maxHp * 50), h.dead ? 1 : 0] : [s]; })]) : "";
  if(pkey !== G.partyKey){
    G.partyKey = pkey; $("#party").hidden = !p;
    if(p){
      $("#partyLead").textContent = p[1] === G.myTeam ? "You lead this party" : `Led by ${(heroBySide(p[1]) || {}).name || "…"}`;
      $("#pList").innerHTML = p[2].filter(s => s !== G.myTeam).map(s => {
        const h = heroBySide(s); if(!h) return "";
        return `<div class="pm${h.dead ? " dead" : ""}"><img alt="" src="${champIcon(h.champId)}" style="border-color:${SIDE_COLOR[s]}">
          <div class="pmb"><div class="pmn">${s === p[1] ? '<span class="crown" title="Party leader">♛</span>' : ""}${esc(h.name)} <small>${h.lvl}</small></div>
          <div class="bar"><i style="width:${Math.max(0, h.hp / h.maxHp * 100)}%"></i></div></div></div>`;
      }).join("");
    }
  }
  // party invite prompt
  const inv = (G.snap.iv || []).find(i => i[1] === G.myTeam), from = inv && heroBySide(inv[0]);
  const ikey = from ? inv[0] : "";
  if(ikey !== G.inviteKey){
    G.inviteKey = ikey; $("#pInvite").hidden = !from;
    if(from){ $("#pInvText").textContent = `${from.name} invites you to join their party.`; }
  }
  updateRolls(me);
  if(!$("#social").hidden) renderSocial();
}

/* ---------- Players window ---------- */
function toggleSocial(force){
  const open = force !== undefined ? force : $("#social").hidden;
  $("#social").hidden = !open;
  if(open){ G.socialKey = ""; renderSocial(); }
}
function renderSocial(){
  const p = myParty(), lead = !p || p[1] === G.myTeam, invited = new Set((G.snap.iv || []).filter(i => i[0] === G.myTeam).map(i => i[1]));
  const key = JSON.stringify([G.snap.h.map(h => [h.side, h.lvl, h.party]), p, [...invited]]);
  if(key === G.socialKey) return;
  G.socialKey = key;
  const rows = G.snap.h.map(h => {
    const me = h.side === G.myTeam, mate = !me && inMyParty(h.side);
    let act = "", status = "";
    if(me) status = p ? (lead ? "You · party leader" : "You") : "You";
    else if(mate){ status = h.side === p[1] ? "In your party · leader" : "In your party"; if(lead) act = `<button class="btn" data-kick="${h.side}">Remove</button>`; }
    else if(h.party) status = "In another party";
    else if(invited.has(h.side)) status = "Invite sent";
    else { status = "Not in a party"; if(lead && (!p || p[2].length < PARTY_MAX)) act = `<button class="btn primary" data-inv="${h.side}">Invite to party</button>`; }
    return `<div class="prow"><img alt="" src="${champIcon(h.champId)}" style="border-color:${SIDE_COLOR[h.side]}"><div class="pinfo"><b>${esc(h.name)}</b><span>Level ${h.lvl} · ${status}</span></div>${act}</div>`;
  });
  $("#socialList").innerHTML = rows.join("");
  $("#socialEmpty").hidden = G.snap.h.length > 1;
  $("#socialLeave").hidden = !p;
  $("#socialInvite").hidden = G.role !== "host";
}
$("#socialBtn").onclick = () => toggleSocial();
$("#socialClose").onclick = () => toggleSocial(false);
$("#socialLeave").onclick = () => command({ pleave: 1 });
$("#socialInvite").onclick = () => { toggleSocial(false); openInvite(); };
$("#pLeave").onclick = () => command({ pleave: 1 });
$("#socialList").addEventListener("click", e => {
  const b = e.target.closest("[data-inv],[data-kick]"); if(!b || !G) return;
  if(b.dataset.inv) command({ pinvite: b.dataset.inv }); else command({ pkick: b.dataset.kick });
});
$("#pInvYes").onclick = () => { if(G && G.inviteKey) command({ paccept: G.inviteKey }); $("#pInvite").hidden = true; };
$("#pInvNo").onclick = () => { if(G && G.inviteKey) command({ pdecline: G.inviteKey }); $("#pInvite").hidden = true; };

/* ---------- Need / Greed / Pass ---------- */
function updateRolls(me){
  const mine = (G.snap.r || []).filter(r => r[3].includes(G.myTeam)), seen = new Set();
  for(const [id, it, left, , chosen] of mine){
    seen.add(id);
    let el = G.rollEls.get(id);
    if(!el){
      el = document.createElement("div"); el.className = "rollcard"; el.style.borderColor = RARITY[it.r].c;
      const cur = isGear(it) && me.gear && me.gear.equip ? me.gear.equip[it.s] : null;
      const stats = Object.keys(it.st || {}).map(k => STAT[k].line(it.st[k])).join("<br>");
      el.innerHTML = `<div class="in" style="color:${RARITY[it.r].c}">${esc(it.n)}</div><div class="im">${itemMeta(it)}</div>
        ${stats ? `<div class="ist">${stats}</div>` : ""}<div class="cmp">${cur ? `You have <span style="color:${RARITY[cur.r].c}">${esc(cur.n)}</span>` : `Your ${SLOT_NAME[it.s].toLowerCase()} slot is empty`}</div>
        <div class="rt"><i></i></div>
        <div class="row rb"><button class="btn primary" data-pick="need">Need</button><button class="btn" data-pick="greed">Greed</button><button class="btn" data-pick="pass">Pass</button></div>
        <div class="rwait" hidden></div>`;
      el.addEventListener("click", e => { const b = e.target.closest("[data-pick]"); if(!b) return; command({ roll: id, pick: b.dataset.pick }); G.rollPicked[id] = b.dataset.pick; });
      $("#rolls").appendChild(el); G.rollEls.set(id, el);
    }
    el.querySelector(".rt i").style.width = `${left / ROLL_TIME * 100}%`;
    const picked = chosen.includes(G.myTeam) || G.rollPicked[id];
    el.querySelector(".rb").hidden = !!picked;
    const w = el.querySelector(".rwait"); w.hidden = !picked;
    if(picked) w.textContent = `${G.rollPicked[id] ? `You chose ${G.rollPicked[id]}. ` : ""}Waiting for the party… ${left}s`;
  }
  for(const [id, el] of G.rollEls) if(!seen.has(id)){ el.remove(); G.rollEls.delete(id); delete G.rollPicked[id]; }
}

/* ---------- Chat ---------- */
function setChatChannel(ch){
  if(G) G.chatCh = ch;
  const b = $("#chatCh"); b.textContent = ch === "party" ? "Party" : "World"; b.className = `chatch ${ch}`;
}
function chatLine(kind, name, text, color){
  const log = $("#chatLog"), atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 30;
  const d = document.createElement("div"); d.className = `cl ${kind}`;
  if(kind === "world" || kind === "party"){
    const tag = document.createElement("span"); tag.className = "ctag"; tag.textContent = kind === "party" ? "[Party] " : "[World] ";
    const who = document.createElement("b"); who.textContent = `${name}: `; who.style.color = color || "";
    d.append(tag, who, document.createTextNode(text));
  }else d.textContent = text;
  log.appendChild(d);
  while(log.children.length > 80) log.firstChild.remove();
  if(atBottom) log.scrollTop = log.scrollHeight;
}
$("#chatForm").addEventListener("submit", e => {
  e.preventDefault();
  if(!G) return;
  let text = $("#chatIn").value.trim(), ch = G.chatCh;
  const m = text.match(/^\/(p|party|w|world|s|say)\b\s*/i);
  if(m){ ch = /^p/i.test(m[1]) ? "party" : "world"; text = text.slice(m[0].length); setChatChannel(ch); }
  if(text) command({ chat: text, ch });
  $("#chatIn").value = ""; $("#chatIn").blur();
});
$("#chatIn").addEventListener("keydown", e => {
  if(e.key === "Escape"){ $("#chatIn").value = ""; $("#chatIn").blur(); }
  else if(e.key === "Tab"){ e.preventDefault(); setChatChannel(G && G.chatCh === "party" ? "world" : "party"); }
});
$("#chatCh").onclick = () => setChatChannel(G && G.chatCh === "party" ? "world" : "party");

/* ---------- Effects from the simulation ---------- */
function socialFx(f, mine){
  if(f.k === "chat") chatLine(f.ch, f.name, f.text, SIDE_COLOR[f.from]);
  else if(f.k === "sys") chatLine("sys", "", f.text);
  else if(f.k === "pinvite"){ chatLine("sys", "", `${f.name} invited you to their party.`); toast(`${f.name} invited you to their party`); }
  else if(f.k === "rollstart") chatLine("sys", "", `Rolling for ${f.item}: choose Need, Greed or Pass.`);
  else if(f.k === "rollwin"){
    const how = f.pick === "pass" ? "everyone passed" : `${f.pick} ${f.num}`;
    chatLine("loot", "", `${f.name} won ${f.item} (${how}). ${f.rolls.filter(r => r[1] !== "pass").map(r => `${r[0]} ${r[1]} ${r[2]}`).join(", ")}`.trim());
    if(mine) lootLine(`+ ${f.item}`, RARITY[f.r].c);
  }
}
