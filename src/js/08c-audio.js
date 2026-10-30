"use strict";
// Music and sound effects. Files live in src/audio/; add new ones to MUSIC or SFX below.
// Browsers only allow sound after the player clicks something, so music starts on "Enter world".

/* ---------- Tracks and effects ---------- */
// Music for each zone (keys match ZONES). Zones can share a track.
const MUSIC = {
  vale: "src/audio/music/dreamscape.mp3",   // "Calm Ambient Dreamscape" by Morgan Ambient (Pixabay)
  peaks: "src/audio/music/dreamscape.mp3",
};
// Short sound effects by name; play with sfx("name") or sfxAt("name", x, y). Names match the checklist's file names.
const SFX = {
  "attack-melee": "src/audio/sfx/attack-melee.mp3",
};
// basic-attack sound for each champion class (a missing file just stays silent)
const ATTACK_SFX = { melee: "attack-melee", ranged: "attack-ranged", caster: "attack-caster" };

/* ---------- Settings (remembered in this browser) ---------- */
const SOUND = { music: null, src: "", musicVol: .45, sfxVol: .7, muted: false, fade: null };
try{
  const saved = JSON.parse(localStorage.getItem("rr.sound") || "{}");
  if(typeof saved.musicVol === "number") SOUND.musicVol = Math.max(0, Math.min(1, saved.musicVol));
  if(typeof saved.sfxVol === "number") SOUND.sfxVol = Math.max(0, Math.min(1, saved.sfxVol));
  SOUND.muted = !!saved.muted;
}catch(e){}
function saveSound(){ try{ localStorage.setItem("rr.sound", JSON.stringify({ musicVol: SOUND.musicVol, sfxVol: SOUND.sfxVol, muted: SOUND.muted })); }catch(e){} }
const canPlay = () => typeof Audio !== "undefined";
const musicLevel = () => SOUND.muted ? 0 : SOUND.musicVol;

/* ---------- Music ---------- */
// Fade the current track's volume to `to` over `secs`, then call `done`
function fadeMusic(to, secs, done){
  const a = SOUND.music; if(!a) return;
  clearInterval(SOUND.fade);
  const from = a.volume, t0 = performance.now();
  SOUND.fade = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / (secs * 1000));
    a.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if(k >= 1){ clearInterval(SOUND.fade); SOUND.fade = null; if(done) done(); }
  }, 50);
}
// Play a zone's track on a loop, fading in. Does nothing if it's already playing.
function playMusic(zoneKey){
  const src = MUSIC[zoneKey]; if(!canPlay() || !src) return;
  if(SOUND.music && SOUND.src === src){ if(SOUND.music.paused) SOUND.music.play().catch(() => {}); return; }
  const start = () => {
    const a = new Audio(src); a.loop = true; a.volume = 0; a.preload = "auto";
    SOUND.music = a; SOUND.src = src;
    a.play().then(() => fadeMusic(musicLevel(), 3)).catch(() => {}); // blocked until the player clicks; tryResumeMusic retries
  };
  if(SOUND.music) fadeMusic(0, 1.5, () => { SOUND.music.pause(); SOUND.music = null; start(); }); else start();
}
function stopMusic(){ if(SOUND.music) fadeMusic(0, 1.2, () => { if(SOUND.music){ SOUND.music.pause(); SOUND.music = null; SOUND.src = ""; } }); }
// if the browser blocked playback, start it on the next click or key press
function tryResumeMusic(){ if(SOUND.music && SOUND.music.paused && G) SOUND.music.play().then(() => fadeMusic(musicLevel(), 2)).catch(() => {}); }
addEventListener("pointerdown", tryResumeMusic); addEventListener("keydown", tryResumeMusic);

/* ---------- Sound effects ---------- */
let sfxPlaying = 0; // cap overlapping effects so a big fight doesn't become noise
function sfx(name, vol = 1){
  const src = SFX[name]; if(!canPlay() || !src || SOUND.muted || !SOUND.sfxVol || vol <= 0 || sfxPlaying >= 12) return;
  try{
    const a = new Audio(src); a.volume = Math.min(1, SOUND.sfxVol * vol);
    sfxPlaying++; const done = () => { sfxPlaying--; a.onended = a.onerror = null; }; a.onended = a.onerror = done;
    a.play().catch(done);
  }catch(e){}
}
// a sound from a spot in the world (zone units): full volume near you, fading out by 2000 units away
function sfxAt(name, x, y){
  const me = G && G.snap && G.snap.h.find(h => h.side === G.myTeam); if(!me) return;
  const d = Math.hypot(x - me.x, y - me.y); if(d > 2000) return;
  sfx(name, d < 400 ? 1 : 1 - (d - 400) / 1600);
}

/* ---------- Menu controls ---------- */
function renderSoundControls(){
  $("#musicVol").value = Math.round(SOUND.musicVol * 100); $("#musicVolOut").textContent = `${Math.round(SOUND.musicVol * 100)}%`;
  $("#muteBtn").textContent = SOUND.muted ? "Unmute" : "Mute"; $("#muteBtn").setAttribute("aria-pressed", SOUND.muted ? "true" : "false");
}
$("#musicVol").addEventListener("input", e => {
  SOUND.musicVol = (+e.target.value || 0) / 100; if(SOUND.musicVol > 0) SOUND.muted = false;
  if(SOUND.music){ clearInterval(SOUND.fade); SOUND.music.volume = musicLevel(); }
  saveSound(); renderSoundControls();
});
$("#muteBtn").onclick = () => { SOUND.muted = !SOUND.muted; if(SOUND.music){ clearInterval(SOUND.fade); SOUND.music.volume = musicLevel(); } saveSound(); renderSoundControls(); };
renderSoundControls();
