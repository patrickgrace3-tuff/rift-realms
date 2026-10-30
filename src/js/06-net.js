"use strict";
// Co-op networking over PeerJS: the host shares a code, up to four friends join, the host streams snapshots.

/* =====================================================================
   NETWORK (co-op: the host's world, friends join with a code)
   The host keeps one connection per guest in NET.guests; a guest keeps NET.conn to the host.
   ===================================================================== */
const NET = { peer: null, conn: null, guests: new Map(), role: null, code: null, ping: null, lastSnapAt: 0 };
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const peerId = code => "riftrealms-" + code.toLowerCase();
const makeCode = () => { let s = ""; for(let i = 0; i < 5; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]; return s; };
function netClose(){
  for(const g of NET.guests.values()) try{ g.conn.close(); }catch(e){}
  NET.guests.clear();
  try{ if(NET.conn) NET.conn.close(); }catch(e){} try{ if(NET.peer) NET.peer.destroy(); }catch(e){}
  NET.peer = NET.conn = null; NET.role = null; NET.code = null;
}
function sendTo(conn, msg){ try{ if(conn && conn.open) conn.send(msg); }catch(e){ console.warn(e); } }
function send(msg){ sendTo(NET.conn, msg); }
// Host: send each guest the snapshot, with gear only when it changed and only the effects meant for them.
function netBroadcast(snap, fx){
  for(const g of NET.guests.values()){
    if(!g.side || !g.ready || !g.conn.open) continue;
    const hs = snap.h.map(h => { if(g.sentGear[h.side] === h.gear.ver){ const o = Object.assign({}, h); delete o.gear; return o; } g.sentGear[h.side] = h.gear.ver; return h; });
    sendTo(g.conn, { t: "snap", s: Object.assign({}, snap, { h: hs, fx: fx.filter(f => !f.to || f.to.includes(g.side)) }) });
  }
}
const playerCount = () => G && G.snap ? G.snap.h.length : 1;
function openInvite(){
  $("#inviteBox").hidden = false;
  if(NET.peer && NET.code){ $("#inviteCode").textContent = NET.code; return; }
  if(!window.Peer){ $("#inviteMsg").textContent = "The connection library didn't load. Check your internet connection and reload."; $("#inviteMsg").className = "lobbymsg err"; return; }
  NET.role = "host"; NET.code = makeCode(); $("#inviteCode").textContent = "·····";
  $("#inviteMsg").className = "lobbymsg"; $("#inviteMsg").textContent = "Opening your world…";
  const peer = new Peer(peerId(NET.code), { debug: 1 }); NET.peer = peer;
  peer.on("open", () => { $("#inviteCode").textContent = NET.code; $("#inviteMsg").textContent = `Up to ${MAX_PLAYERS - 1} friends can join. You can keep playing.`; });
  peer.on("error", err => {
    if(err.type === "unavailable-id"){ netClose(); openInvite(); return; }
    $("#inviteMsg").className = "lobbymsg err"; $("#inviteMsg").textContent = `Connection problem: ${err.type || err.message}.`;
  });
  peer.on("connection", conn => {
    const g = { conn, side: null, ready: false, sentGear: {} };
    conn.on("open", () => {
      if(NET.guests.size >= MAX_PLAYERS - 1){ conn.send({ t: "full" }); setTimeout(() => conn.close(), 300); return; }
      NET.guests.set(conn, g);
    });
    conn.on("data", msg => onHostData(g, msg));
    conn.on("close", () => {
      NET.guests.delete(conn);
      const c = G && G.W && g.side ? G.W.heroes[g.side] : null;
      if(c){ SIM.removeHero(G.W, g.side); SIM.note(G.W, null, `${c.name} left the world.`); toast(`${c.name} left the world`); }
      if(g.side) for(const o of NET.guests.values()) delete o.sentGear[g.side];
    });
  });
}
async function onHostData(g, msg){
  if(!msg || typeof msg !== "object" || !G || !G.W || !NET.guests.has(g.conn)) return;
  if(msg.t === "hello"){
    if(g.side) return;
    const taken = new Set([...Object.keys(G.W.heroes), ...[...NET.guests.values()].map(o => o.side)]);
    const side = SIDES.find(s => !taken.has(s));
    if(!side){ sendTo(g.conn, { t: "full" }); return; }
    g.side = side; // reserve the slot while the champion loads
    try{
      const d = await getDetail(String(msg.champId));
      if(!g.conn.open || !G || !G.W) return;
      G.details[side] = d; SIM.addHero(G.W, side, d); g.ready = true;
      sendTo(g.conn, { t: "start", me: side, champ: d.id });
      SIM.note(G.W, null, `${d.name} joined the world.`);
      $("#inviteMsg").className = "lobbymsg ok"; $("#inviteMsg").textContent = `${d.name} joined your world.`;
      toast(`${d.name} joined your world`);
    }catch(e){ g.side = null; sendTo(g.conn, { t: "fail" }); }
  }else if(msg.t === "in"){ if(g.ready) SIM.input(G.W, g.side, msg); }
  else if(msg.t === "ping"){ sendTo(g.conn, { t: "pong", id: msg.id }); }
}
$("#joinGo").onclick = () => {
  const code = $("#joinCode").value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const msg = $("#joinMsg");
  if(code.length !== 5){ msg.className = "lobbymsg err"; msg.textContent = "Codes are 5 characters."; return; }
  if(!window.Peer){ msg.className = "lobbymsg err"; msg.textContent = "The connection library didn't load. Reload the page."; return; }
  netClose(); NET.role = "guest"; NET.code = code; msg.className = "lobbymsg"; msg.textContent = "Connecting…";
  const peer = new Peer({ debug: 1 }); NET.peer = peer;
  peer.on("open", () => {
    const conn = peer.connect(peerId(code), { reliable: true }); NET.conn = conn;
    conn.on("open", () => { send({ t: "hello", champId: chosen.id }); msg.className = "lobbymsg ok"; msg.textContent = "Connected. Entering your friend's world…"; });
    conn.on("data", onGuestData);
    conn.on("close", () => { if(G && G.role === "guest"){ leaveWorld(); showNotice("Disconnected", "The connection to your friend's world was lost."); } });
  });
  peer.on("error", err => { msg.className = "lobbymsg err"; msg.textContent = err.type === "peer-unavailable" ? "No world found with that code. Check it and try again." : `Connection problem: ${err.type || err.message}.`; });
};
$("#joinCode").addEventListener("keydown", e => { if(e.key === "Enter") $("#joinGo").click(); });
$("#joinCancel").onclick = () => { netClose(); $("#joinBox").hidden = true; };
async function onGuestData(msg){
  if(!msg || typeof msg !== "object") return;
  if(msg.t === "full"){ $("#joinMsg").className = "lobbymsg err"; $("#joinMsg").textContent = `That world is full (${MAX_PLAYERS} players).`; }
  else if(msg.t === "fail"){ $("#joinMsg").className = "lobbymsg err"; $("#joinMsg").textContent = "The host couldn't load your champion. Pick another and try again."; }
  else if(msg.t === "start"){
    if(!SIDES.includes(msg.me)) return;
    try{ const d = await getDetail(String(msg.champ)); $("#joinBox").hidden = true; startWorld({ role: "guest", me: msg.me, details: { [msg.me]: d } }); }
    catch(e){ $("#joinMsg").className = "lobbymsg err"; $("#joinMsg").textContent = "Couldn't load the champions for this world."; }
  }else if(msg.t === "snap" && G && G.role === "guest"){
    const prev = G.snap; G.snap = msg.s; NET.lastSnapAt = performance.now();
    for(const h of G.snap.h) if(!h.gear){ const p = prev && prev.h.find(x => x.side === h.side); h.gear = p && p.gear ? p.gear : { ver: -1, inv: [], equip: {} }; }
    if(msg.s.fx) for(const f of msg.s.fx) G.fxQueue.push(f);
  }else if(msg.t === "pong" && msg.id === NET.pingId){ NET.ping = Math.round(performance.now() - NET.pingSent); }
}
$("#inviteBtn").onclick = openInvite;
$("#inviteClose").onclick = () => { $("#inviteBox").hidden = true; };
$("#inviteCopy").onclick = async () => {
  if(!NET.code) return;
  try{ await navigator.clipboard.writeText(NET.code); $("#inviteCopy").textContent = "Copied"; setTimeout(() => $("#inviteCopy").textContent = "Copy code", 1500); }
  catch(e){ const r = document.createRange(); r.selectNodeContents($("#inviteCode")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
};
function showNotice(title, msg){ $("#noticeTitle").textContent = title; $("#noticeMsg").textContent = msg; $("#notice").hidden = false; }
$("#noticeOk").onclick = () => { $("#notice").hidden = true; show("select"); };
