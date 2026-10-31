"use strict";
// Saved progress in this browser: one record per champion under "rr.save.<champion id>".
// Saves every few seconds while you play, and when you leave the world or close the page.

const SAVE_EVERY = 5; // seconds
const saveKey = id => "rr.save." + id;
function readSave(id){
  try{ const s = JSON.parse(localStorage.getItem(saveKey(id)) || "null"); return s && s.v === SAVE_VERSION && s.champ === id ? s : null; }catch(e){ return null; }
}
function deleteSave(id){ try{ localStorage.removeItem(saveKey(id)); }catch(e){} }
// save your own hero from the latest snapshot (a guest's gear arrives a moment after joining, so wait for it)
function writeSave(){
  if(!G || !G.snap) return false;
  const me = G.snap.h.find(h => h.side === G.myTeam), d = G.details[G.myTeam];
  if(!me || !d || !me.gear || me.gear.ver < 0) return false;
  try{ localStorage.setItem(saveKey(d.id), JSON.stringify(saveRecord(me, d.id))); return true; }catch(e){ return false; }
}
function saveTick(dt){
  if(!G) return;
  G.saveT = (G.saveT ?? SAVE_EVERY) - dt;
  if(G.saveT <= 0){ G.saveT = SAVE_EVERY; writeSave(); }
}
addEventListener("pagehide", () => writeSave());
addEventListener("beforeunload", () => writeSave());
// a short line for the champion select screen
function saveSummary(s){
  const zone = zoneAt(s.y, s.x).name, done = Object.values(s.quests || {}).filter(q => q.state === "done").length;
  return `Level ${s.lvl} · ${zone} · ${done} quest${done === 1 ? "" : "s"} done · ${fmtCoins(s.coins)}`;
}
