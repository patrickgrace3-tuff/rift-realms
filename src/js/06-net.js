"use strict";
// Co-op networking over PeerJS: host shares a code, guest joins, host streams snapshots.

/* =====================================================================
   NETWORK (co-op: the host's world, a friend joins with a code)
   ===================================================================== */
const NET = { peer: null, conn: null, role: null, code: null, ping: null, lastSnapAt: 0, sentGear: {} };
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const peerId = code => "riftrealms-" + code.toLowerCase();
const makeCode = () => { let s = ""; for(let i = 0; i < 5; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]; return s; };
function netClose(){ try{ if(NET.conn) NET.conn.close(); }catch(e){} try{ if(NET.peer) NET.peer.destroy(); }catch(e){} NET.peer = NET.conn = null; NET.role = null; NET.code = null; }
function send(msg){ try{ if(NET.conn && NET.conn.open) NET.conn.send(msg); }catch(e){ console.warn(e); } }
function openInvite(){
  $("#inviteBox").hidden = false;
  if(NET.peer && NET.code){ $("#inviteCode").textContent = NET.code; return; }
  if(!window.Peer){ $("#inviteMsg").textContent = "The connection library didn't load. Check your internet connection and reload."; $("#inviteMsg").className = "lobbymsg err"; return; }
  NET.role = "host"; NET.code = makeCode(); $("#inviteCode").textContent = "·····";
  $("#inviteMsg").className = "lobbymsg"; $("#inviteMsg").textContent = "Opening your world…";
  const peer = new Peer(peerId(NET.code), { debug: 1 }); NET.peer = peer;
  peer.on("open", () => { $("#inviteCode").textContent = NET.code; $("#inviteMsg").textContent = "Waiting for your friend. You can keep playing."; });
  peer.on("error", err => {
    if(err.type === "unavailable-id"){ netClose(); openInvite(); return; }
    $("#inviteMsg").className = "lobbymsg err"; $("#inviteMsg").textContent = `Connection problem: ${err.type || err.message}.`;
  });
  peer.on("connection", conn => {
    if(NET.conn && NET.conn.open){ conn.on("open", () => { conn.send({ t: "full" }); setTimeout(() => conn.close(), 300); }); return; }
    NET.conn = conn;
    conn.on("data", onHostData);
    conn.on("close", () => { if(G && G.W && G.W.heroes.red){ SIM.removeHero(G.W, "red"); toast("Your friend left the world"); } NET.conn = null; });
  });
}
async function onHostData(msg){
  if(!msg || typeof msg !== "object" || !G || !G.W) return;
  if(msg.t === "hello"){
    NET.sentGear = {};
    try{
      const d = await getDetail(String(msg.champId));
      G.details.red = d; SIM.addHero(G.W, "red", d);
      send({ t: "start", blue: G.details.blue.id, red: d.id });
      $("#inviteMsg").className = "lobbymsg ok"; $("#inviteMsg").textContent = `${d.name} joined your world.`;
      toast(`${d.name} joined your world`);
    }catch(e){ send({ t: "fail" }); }
  }else if(msg.t === "in"){ SIM.input(G.W, "red", msg); }
  else if(msg.t === "ping"){ send({ t: "pong", id: msg.id }); }
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
  if(msg.t === "full"){ $("#joinMsg").className = "lobbymsg err"; $("#joinMsg").textContent = "That world already has two players."; }
  else if(msg.t === "fail"){ $("#joinMsg").className = "lobbymsg err"; $("#joinMsg").textContent = "The host couldn't load your champion. Pick another and try again."; }
  else if(msg.t === "start"){
    try{ const blue = await getDetail(String(msg.blue)), red = await getDetail(String(msg.red)); $("#joinBox").hidden = true; startWorld({ role: "guest", details: { blue, red } }); }
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
