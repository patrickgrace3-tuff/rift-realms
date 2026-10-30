"use strict";
// Pixel-art bodies with champion-portrait heads, NPC heads, creature sprites.

/* =====================================================================
   PIXEL CHARACTERS: drawn bodies with the champion portrait as the head
   ===================================================================== */
const imgCache = new Map();
function loadCORS(url){
  if(imgCache.has(url)) return imgCache.get(url);
  const p = new Promise(res => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = () => res(null); i.src = url; });
  imgCache.set(url, p); return p;
}
const BODY = {
  melee:  { tunic: "#7d8a9c", dark: "#4d5868", trim: "#c9a55c", pants: "#3a3f4a", boots: "#2a2220", weapon: "sword" },
  caster: { tunic: "#6a4fa3", dark: "#42306e", trim: "#e0c56e", pants: "#2f2a44", boots: "#241d30", weapon: "staff", robe: true },
  ranged: { tunic: "#5a7d3a", dark: "#3b5426", trim: "#8a5a32", pants: "#4a3a2a", boots: "#2a2018", weapon: "bow" },
  farmer: { tunic: "#3f68a8", dark: "#284a7c", trim: "#b8432f", pants: "#3f68a8", boots: "#3a2a1a", weapon: "none", shirt: "#b8432f" },
  hunter: { tunic: "#4a6a34", dark: "#2f4622", trim: "#8a5a32", pants: "#5a4430", boots: "#2a2018", weapon: "bow" },
  fisher: { tunic: "#c9b98a", dark: "#8a7a52", trim: "#3f6a9a", pants: "#4a5a6a", boots: "#2a2a2a", weapon: "none", shirt: "#3f6a9a" },
  guard: { tunic: "#3f5f9a", dark: "#2a3f6a", trim: "#c9a55c", pants: "#5a6270", boots: "#2a2a30", weapon: "sword" },
  bandit: { tunic: "#5a4a3a", dark: "#3a2e24", trim: "#8a2a22", pants: "#2e2a26", boots: "#1e1a16", weapon: "sword" },
  miner: { tunic: "#6a5a4a", dark: "#4a3e32", trim: "#c9a55c", pants: "#3e3a34", boots: "#2a2018", weapon: "none", shirt: "#8a3a2a" },
  healer: { tunic: "#e8e2d4", dark: "#b8b0a0", trim: "#5fb0c8", pants: "#8a8478", boots: "#4a4038", weapon: "staff", robe: true },
  merchant: { tunic: "#8a3a5a", dark: "#5a2440", trim: "#e0c56e", pants: "#4a3a2a", boots: "#2a2018", weapon: "none", shirt: "#e0c56e" },
  warden: { tunic: "#6a5040", dark: "#46342a", trim: "#e8e2d4", pants: "#3e3a44", boots: "#2a2220", weapon: "sword" },
};
class CharArt {
  constructor(o){
    this.o = o; this.canvas = document.createElement("canvas"); this.canvas.width = 128; this.canvas.height = 192;
    this.g = this.canvas.getContext("2d"); this.key = ""; this.head = null; this.onload = null;
    if(o.headUrl) loadCORS(o.headUrl).then(im => { this.head = im; this.key = ""; if(this.onload) this.onload(); });
  }
  draw(frame, flip, pose, force){
    const key = frame + "|" + flip + "|" + pose + "|" + (this.head ? 1 : 0) + "|" + (this.o.gearSig || "");
    if(key === this.key && !force) return false;
    this.key = key;
    const g = this.g, b = Object.assign({}, BODY[this.o.style] || BODY.melee, this.o.gear || {});
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 128, 192); g.imageSmoothingEnabled = false;
    if(flip){ g.translate(128, 0); g.scale(-1, 1); }
    const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x / 4) * 4, Math.round(y / 4) * 4, Math.round(w / 4) * 4, Math.round(h / 4) * 4); };
    const step = [0, 1, 0, -1][frame % 4], down = pose === "dead";
    // legs
    const lOff = step * 6, rOff = -step * 6;
    R(48 + lOff * .4, 148 - Math.max(0, lOff) * .5, 12, 32, b.pants); R(46 + lOff * .4, 176 - Math.max(0, lOff) * .5, 16, 8, b.boots);
    R(68 + rOff * .4, 148 - Math.max(0, rOff) * .5, 12, 32, b.pants); R(66 + rOff * .4, 176 - Math.max(0, rOff) * .5, 16, 8, b.boots);
    // torso
    if(b.robe){ R(40, 104, 48, 60, b.tunic); R(36, 152, 56, 16, b.tunic); R(36, 164, 56, 4, b.dark); R(60, 104, 8, 60, b.trim); }
    else { R(40, 104, 48, 48, b.tunic); R(40, 148, 48, 4, b.dark); }
    if(b.shirt){ R(48, 104, 32, 12, b.shirt); R(48, 116, 8, 30, b.tunic); R(72, 116, 8, 30, b.tunic); }
    if(this.o.style === "melee" || this.o.style === "guard"){ R(36, 104, 16, 12, "#aab6c6"); R(76, 104, 16, 12, "#aab6c6"); }
    if(this.o.style === "ranged"){ for(let i = 0; i < 6; i++) R(44 + i * 7, 108 + i * 7, 6, 6, b.trim); }
    R(40, 136, 48, 6, b.dark); R(60, 136, 8, 6, b.trim);
    // arms and weapon
    const armSwing = -step * 5;
    const arm = (x, y, w, h) => { R(x, y, w, h, b.dark); R(x, y + h - 8, w, 8, b.gloves || "#e8b88a"); };
    if(pose === "cast"){
      arm(28, 80, 12, 32); arm(88, 80, 12, 32);
      g.fillStyle = "rgba(255,230,140,.85)"; g.beginPath(); g.arc(34, 76, 7, 0, 7); g.arc(94, 76, 7, 0, 7); g.fill();
    }else if(pose === "attack"){
      arm(28, 108 + armSwing, 12, 32); R(88, 112, 28, 10, b.dark); R(112, 112, 8, 10, b.gloves || "#e8b88a");
      this.weapon(R, b, 116, 104, true);
    }else{
      arm(28, 108 + armSwing, 12, 32); arm(88, 108 - armSwing, 12, 32);
      this.weapon(R, b, 96, 120 - armSwing, false);
    }
    // head (never mirrored, so the portrait reads correctly)
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = true;
    const hx = 64, hy = 56, hr = 46;
    if(this.o.drawHead) this.o.drawHead(g, hx, hy, hr);
    else {
      g.save(); g.beginPath(); g.arc(hx, hy, hr, 0, Math.PI * 2); g.clip();
      if(this.head){ try{ g.drawImage(this.head, hx - hr - 6, hy - hr - 6, (hr + 6) * 2, (hr + 6) * 2); }catch(e){} }
      else { g.fillStyle = "#3a4a66"; g.fill(); g.fillStyle = "#f0d58e"; g.font = "700 40px 'Barlow Condensed', sans-serif"; g.textAlign = "center"; g.fillText(this.o.initial || "?", hx, hy + 14); }
      g.restore();
      g.lineWidth = 5; g.strokeStyle = "#1b1410"; g.beginPath(); g.arc(hx, hy, hr, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 2.5; g.strokeStyle = this.o.ring || "#c9a55c"; g.beginPath(); g.arc(hx, hy, hr - 3, 0, Math.PI * 2); g.stroke();
    }
    if(this.o.helm && !this.o.drawHead){
      g.save(); g.lineCap = "round";
      g.lineWidth = 15; g.strokeStyle = "#1b1410"; g.beginPath(); g.arc(hx, hy, hr + 3, Math.PI * 1.06, Math.PI * 1.94); g.stroke();
      g.lineWidth = 11; g.strokeStyle = this.o.helm; g.beginPath(); g.arc(hx, hy, hr + 3, Math.PI * 1.06, Math.PI * 1.94); g.stroke();
      g.lineWidth = 3; g.strokeStyle = shade(this.o.helm, 1.35); g.beginPath(); g.arc(hx, hy, hr + 6, Math.PI * 1.2, Math.PI * 1.5); g.stroke();
      g.restore();
    }
    if(down){ g.globalCompositeOperation = "source-atop"; g.fillStyle = "rgba(60,60,70,.55)"; g.fillRect(0, 0, 128, 192); g.globalCompositeOperation = "source-over"; }
    return true;
  }
  weapon(R, b, x, y, swing){
    if(this.o.tier){
      const g = this.g, glow = { sword: "#ffb347", staff: "#c98cff", bow: "#8cff9a" }[b.weapon] || "#ffd27a";
      g.save(); g.shadowColor = glow; g.shadowBlur = 16;
      if(b.weapon === "sword"){ R(x - 2, y - 46, 10, 50, "#ffe2a8"); R(x, y - 42, 6, 42, "#fff3d6"); R(x - 8, y + 2, 22, 6, "#e0a040"); R(x, y + 8, 6, 10, "#5a3a22"); }
      else if(b.weapon === "staff"){ R(x, y - 52, 6, 80, "#e8dcc0"); R(x - 6, y - 66, 18, 18, glow); R(x - 2, y - 62, 10, 10, "#ffffff"); }
      else if(b.weapon === "bow"){ R(x, y - 34, 6, 68, "#efe4c8"); R(x - 6, y - 38, 6, 8, "#efe4c8"); R(x - 6, y + 30, 6, 8, "#efe4c8"); R(x - 10, y - 30, 2, 60, glow); }
      g.restore(); return;
    }
    if(b.weapon === "sword"){ R(x, y - 36, 6, 40, "#d7dde6"); R(x - 6, y + 2, 18, 4, b.trim); R(x, y + 6, 6, 10, "#5a3a22"); }
    else if(b.weapon === "staff"){ R(x, y - 48, 6, 76, "#7a5232"); R(x - 4, y - 58, 14, 14, "#9fe6ff"); }
    else if(b.weapon === "bow"){ R(x, y - 30, 4, 60, "#7a5232"); R(x - 4, y - 34, 4, 6, "#7a5232"); R(x - 4, y + 28, 4, 6, "#7a5232"); R(x - 8, y - 28, 2, 56, "#e8e2d0"); }
  }
}
function drawFarmerHead(g, x, y, r){
  g.fillStyle = "#e8b88a"; g.beginPath(); g.arc(x, y + 6, r * .78, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#7a4a26"; g.beginPath(); g.arc(x, y + 24, r * .62, 0, Math.PI); g.fill();
  g.fillStyle = "#2a1a10"; g.fillRect(x - 16, y, 8, 8); g.fillRect(x + 8, y, 8, 8);
  g.fillStyle = "#c97a5a"; g.beginPath(); g.arc(x, y + 14, 6, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#e3c25a"; g.beginPath(); g.ellipse(x, y - 18, r * 1.05, 12, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#d4ae3e"; g.beginPath(); g.ellipse(x, y - 30, r * .55, 20, 0, Math.PI, 0); g.fill();
  g.fillStyle = "#b8432f"; g.fillRect(x - r * .55, y - 24, r * 1.1, 6);
  g.lineWidth = 4; g.strokeStyle = "#1b1410"; g.beginPath(); g.arc(x, y + 6, r * .78, 0, Math.PI * 2); g.stroke();
}
function drawHuntressHead(g, x, y, r){
  g.fillStyle = "#3e5a2a"; g.beginPath(); g.arc(x, y, r * .95, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#8a3a1e"; g.beginPath(); g.arc(x, y + 10, r * .66, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#e9b98e"; g.beginPath(); g.arc(x, y + 8, r * .55, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#1b1410"; g.fillRect(x - 13, y + 2, 7, 7); g.fillRect(x + 6, y + 2, 7, 7);
  g.strokeStyle = "#5a7a3a"; g.lineWidth = 4; g.beginPath(); g.moveTo(x - 16, y + 18); g.lineTo(x - 4, y + 14); g.stroke();
  g.fillStyle = "#b8604a"; g.fillRect(x - 6, y + 20, 12, 3);
  g.fillStyle = "#2f4622"; g.beginPath(); g.moveTo(x - r * .9, y - 6); g.quadraticCurveTo(x, y - r * 1.25, x + r * .9, y - 6); g.lineTo(x + r * .55, y - 14); g.quadraticCurveTo(x, y - r * .7, x - r * .55, y - 14); g.fill();
  g.lineWidth = 4; g.strokeStyle = "#1b1410"; g.beginPath(); g.arc(x, y, r * .95, 0, Math.PI * 2); g.stroke();
}
function drawFisherHead(g, x, y, r){
  g.fillStyle = "#e3b48c"; g.beginPath(); g.arc(x, y + 4, r * .74, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#f2efe6"; g.beginPath(); g.arc(x, y + 22, r * .62, 0, Math.PI); g.fill();
  g.beginPath(); g.ellipse(x, y + 16, r * .5, 10, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#1b1410"; g.fillRect(x - 15, y - 2, 7, 5); g.fillRect(x + 8, y - 2, 7, 5);
  g.fillStyle = "#c98a6a"; g.beginPath(); g.arc(x, y + 8, 6, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#3f6a9a"; g.beginPath(); g.ellipse(x, y - 22, r * .78, 18, 0, Math.PI, 0); g.fill(); g.fillRect(x - r * .8, y - 24, r * 1.6, 8);
  g.fillStyle = "#c9b98a"; g.beginPath(); g.arc(x, y - 38, 6, 0, Math.PI * 2); g.fill();
  g.lineWidth = 4; g.strokeStyle = "#1b1410"; g.beginPath(); g.arc(x, y + 4, r * .74, 0, Math.PI * 2); g.stroke();
}
function drawGuardHead(g, x, y, r){
  g.fillStyle = "#6a3a1e"; g.beginPath(); g.ellipse(x + r * .62, y + 20, 9, 24, .2, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#eab48e"; g.beginPath(); g.arc(x, y + 8, r * .62, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#1b1410"; g.fillRect(x - 14, y + 4, 7, 6); g.fillRect(x + 7, y + 4, 7, 6);
  g.fillStyle = "#b8604a"; g.fillRect(x - 6, y + 22, 12, 3);
  g.fillStyle = "#aab6c6"; g.beginPath(); g.arc(x, y + 2, r * .72, Math.PI, 0); g.lineTo(x + r * .72, y + 6); g.lineTo(x - r * .72, y + 6); g.closePath(); g.fill();
  g.fillStyle = "#7d8794"; g.fillRect(x - 3, y - 2, 6, 18); g.fillRect(x - r * .74, y + 2, r * 1.48, 5);
  g.fillStyle = "#c0392b"; g.beginPath(); g.moveTo(x - 4, y - r * .7); g.quadraticCurveTo(x + 22, y - r * 1.25, x + 34, y - r * .5); g.quadraticCurveTo(x + 14, y - r * .75, x + 4, y - r * .6); g.fill();
  g.lineWidth = 4; g.strokeStyle = "#1b1410"; g.beginPath(); g.arc(x, y + 8, r * .62, 0, Math.PI * 2); g.stroke();
}
function drawMinerHead(g, x, y, r){
  g.fillStyle = "#e0aa82"; g.beginPath(); g.arc(x, y + 8, r * .7, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#d8d4cc"; g.beginPath(); g.moveTo(x - r * .62, y + 10); g.quadraticCurveTo(x, y + r * 1.25, x + r * .62, y + 10); g.lineTo(x + r * .4, y + 18); g.lineTo(x - r * .4, y + 18); g.fill(); // white beard
  g.fillStyle = "#1b1410"; g.fillRect(x - 14, y + 2, 7, 6); g.fillRect(x + 7, y + 2, 7, 6);
  g.fillStyle = "#c97a5a"; g.beginPath(); g.arc(x, y + 12, 6, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#c9a55c"; g.beginPath(); g.arc(x, y - 4, r * .76, Math.PI, 0); g.fill(); g.fillRect(x - r * .9, y - 6, r * 1.8, 7); // brass helmet
  g.fillStyle = "#fff3b0"; g.beginPath(); g.arc(x, y - 22, 7, 0, Math.PI * 2); g.fill(); g.fillStyle = "rgba(255,240,170,.35)"; g.beginPath(); g.arc(x, y - 22, 13, 0, Math.PI * 2); g.fill(); // lamp
  g.lineWidth = 4; g.strokeStyle = "#1b1410"; g.beginPath(); g.arc(x, y + 8, r * .7, 0, Math.PI * 2); g.stroke();
}
function drawHealerHead(g, x, y, r){
  g.fillStyle = "#e8e2d4"; g.beginPath(); g.arc(x, y, r * .96, 0, Math.PI * 2); g.fill();               // white hood
  g.fillStyle = "#5fb0c8"; g.fillRect(x - r * .96, y - 6, r * 1.92, 5);                                    // blue band
  g.fillStyle = "#f0c8a4"; g.beginPath(); g.arc(x, y + 8, r * .58, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#6a4a2a"; g.beginPath(); g.ellipse(x, y - 4, r * .55, 9, 0, Math.PI, 0); g.fill();       // hair
  g.fillStyle = "#1b1410"; g.fillRect(x - 13, y + 4, 6, 6); g.fillRect(x + 7, y + 4, 6, 6);
  g.fillStyle = "#d87a6a"; g.fillRect(x - 5, y + 20, 10, 3);
  g.lineWidth = 4; g.strokeStyle = "#1b1410"; g.beginPath(); g.arc(x, y, r * .96, 0, Math.PI * 2); g.stroke();
}
function drawMerchantHead(g, x, y, r){
  g.fillStyle = "#e6b28a"; g.beginPath(); g.arc(x, y + 6, r * .72, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#3a2618"; g.beginPath(); g.moveTo(x - 20, y + 16); g.quadraticCurveTo(x - 6, y + 10, x, y + 16); g.quadraticCurveTo(x + 6, y + 10, x + 20, y + 16); g.lineTo(x + 14, y + 20); g.quadraticCurveTo(x, y + 15, x - 14, y + 20); g.fill(); // curled moustache
  g.fillStyle = "#1b1410"; g.fillRect(x - 14, y, 7, 6); g.fillRect(x + 7, y, 7, 6);
  g.fillStyle = "#c97a5a"; g.beginPath(); g.arc(x, y + 9, 5, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#8a3a5a"; g.beginPath(); g.ellipse(x, y - 16, r * .9, 16, 0, Math.PI, 0); g.fill();                 // floppy hat
  g.fillStyle = "#6a2a46"; g.fillRect(x - r * .95, y - 18, r * 1.9, 7);
  g.fillStyle = "#e0c56e"; g.beginPath(); g.moveTo(x + 10, y - 30); g.quadraticCurveTo(x + 34, y - 52, x + 40, y - 30); g.quadraticCurveTo(x + 30, y - 38, x + 14, y - 26); g.fill(); // feather
  g.lineWidth = 4; g.strokeStyle = "#1b1410"; g.beginPath(); g.arc(x, y + 6, r * .72, 0, Math.PI * 2); g.stroke();
}
function drawWardenHead(g, x, y, r){
  g.fillStyle = "#e8e2d4"; g.beginPath(); g.arc(x, y, r * .98, 0, Math.PI * 2); g.fill();          // fur hood
  g.fillStyle = "#d8cfbe"; for(let i = 0; i < 9; i++){ const a = Math.PI + i / 8 * Math.PI; g.fillRect(x + Math.cos(a) * r * .9 - 4, y + Math.sin(a) * r * .9 - 4, 8, 8); }
  g.fillStyle = "#e2ad86"; g.beginPath(); g.arc(x, y + 6, r * .6, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#9a9a9e"; g.beginPath(); g.moveTo(x - r * .55, y + 10); g.quadraticCurveTo(x, y + r * 1.05, x + r * .55, y + 10); g.lineTo(x + r * .3, y + 16); g.lineTo(x - r * .3, y + 16); g.fill(); // grey beard
  g.fillStyle = "#1b1410"; g.fillRect(x - 13, y - 2, 7, 6); g.fillRect(x + 6, y - 2, 7, 6);
  g.fillStyle = "#6a6a70"; g.fillRect(x - 15, y - 9, 10, 3); g.fillRect(x + 5, y - 9, 10, 3);
  g.fillStyle = "#c97a5a"; g.fillRect(x - 3, y + 4, 6, 7);
  g.lineWidth = 4; g.strokeStyle = "#1b1410"; g.beginPath(); g.arc(x, y, r * .98, 0, Math.PI * 2); g.stroke();
}
function drawBanditHead(g, x, y, r){
  g.fillStyle = "#3a2e24"; g.beginPath(); g.arc(x, y, r * .92, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#1e1813"; g.beginPath(); g.ellipse(x, y + 8, r * .58, r * .5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#ffcf40"; g.fillRect(x - 15, y, 8, 5); g.fillRect(x + 7, y, 8, 5);
  g.fillStyle = "#8a2a22"; g.beginPath(); g.moveTo(x - r * .62, y + 10); g.lineTo(x + r * .62, y + 10); g.lineTo(x + r * .4, y + 30); g.lineTo(x - r * .4, y + 30); g.closePath(); g.fill();
  g.strokeStyle = "#5a1a14"; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 20, y + 18); g.lineTo(x + 20, y + 18); g.stroke();
  g.lineWidth = 4; g.strokeStyle = "#1b1410"; g.beginPath(); g.arc(x, y, r * .92, 0, Math.PI * 2); g.stroke();
}
function drawWolf(g, frame, flip, angry){
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 112, 80);
  if(flip){ g.translate(112, 0); g.scale(-1, 1); }
  const step = [0, 1, 0, -1][frame % 4];
  g.fillStyle = "#3e3a38";
  [[30, step], [40, -step], [68, -step], [78, step]].forEach(([x, s]) => g.fillRect(x + s * 3, 50 - Math.max(0, s) * 3, 7, 24));
  g.fillStyle = "#6e6a66"; g.beginPath(); g.moveTo(22, 40); g.quadraticCurveTo(4, 30, 8, 18); g.quadraticCurveTo(14, 32, 26, 34); g.fill();
  g.beginPath(); g.ellipse(54, 42, 32, 15, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#8e8a84"; g.beginPath(); g.ellipse(70, 46, 14, 10, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#6e6a66"; g.beginPath(); g.ellipse(88, 34, 13, 11, -.2, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(94, 30); g.lineTo(110, 36); g.lineTo(108, 42); g.lineTo(94, 42); g.fill();
  g.fillStyle = "#1b1410"; g.fillRect(106, 35, 4, 4);
  g.fillStyle = "#5a5652"; g.beginPath(); g.moveTo(80, 26); g.lineTo(82, 12); g.lineTo(88, 24); g.fill(); g.beginPath(); g.moveTo(87, 24); g.lineTo(91, 11); g.lineTo(95, 25); g.fill();
  g.fillStyle = angry ? "#ff4030" : "#e8d040"; g.fillRect(92, 30, 5, 4);
  if(angry){ g.fillStyle = "#ffffff"; g.fillRect(100, 41, 3, 4); g.fillRect(105, 41, 3, 4); }
}
function drawBag(g, rar){
  g.clearRect(0, 0, 64, 64);
  g.fillStyle = "#7a5232"; g.strokeStyle = "#2a1a0e"; g.lineWidth = 3;
  g.beginPath(); g.moveTo(22, 22); g.quadraticCurveTo(6, 40, 14, 54); g.lineTo(50, 54); g.quadraticCurveTo(58, 40, 42, 22); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = "#8a6440"; g.beginPath(); g.moveTo(22, 22); g.lineTo(18, 10); g.lineTo(32, 16); g.lineTo(46, 10); g.lineTo(42, 22); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = "#c9a55c"; g.fillRect(20, 20, 24, 5);
  if(rar >= 1){ g.fillStyle = RARITY[rar].c; g.beginPath(); for(let i = 0; i < 8; i++){ const a = i * Math.PI / 4, rr = i % 2 ? 4 : 10; g.lineTo(46 + Math.cos(a) * rr, 34 + Math.sin(a) * rr); } g.closePath(); g.fill(); }
}
function drawFlower(g){
  g.clearRect(0, 0, 64, 64);
  g.strokeStyle = "#3f7a2a"; g.lineWidth = 4; g.beginPath(); g.moveTo(32, 62); g.quadraticCurveTo(28, 44, 32, 30); g.stroke();
  g.fillStyle = "#4f8a3a"; g.beginPath(); g.ellipse(24, 48, 8, 4, -.5, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#ffe066"; for(let i = 0; i < 6; i++){ const a = i / 6 * Math.PI * 2; g.beginPath(); g.ellipse(32 + Math.cos(a) * 9, 24 + Math.sin(a) * 9, 7, 5, a, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = "#ff9a30"; g.beginPath(); g.arc(32, 24, 6, 0, Math.PI * 2); g.fill();
}
const HEADS = { farmer: drawFarmerHead, huntress: drawHuntressHead, fisher: drawFisherHead, guard: drawGuardHead, warden: drawWardenHead, merchant: drawMerchantHead, miner: drawMinerHead, healer: drawHealerHead };
const MOB_ART = {
  sheep: { cw: 96, ch: 80, sx: 1.35, sy: 1.12, sh: .6, plate: 1.35, draw: (g, f, fl, an) => drawSheep(g, f, fl, an, false) },
  boar: { cw: 128, ch: 96, sx: 2.8, sy: 2.1, sh: 1.15, plate: 2.4, draw: (g, f, fl, an, wu) => drawBoar(g, f, fl, an, wu) },
  wolf: { cw: 112, ch: 80, sx: 1.7, sy: 1.2, sh: .7, plate: 1.45, draw: (g, f, fl, an) => drawWolf(g, f, fl, an) },
  bandit: { char: true, style: "bandit", head: drawBanditHead, sx: 1.6, sy: 2.4, sh: .6, plate: 2.75 },
  ram: { cw: 112, ch: 88, sx: 1.9, sy: 1.5, sh: .75, plate: 1.7, draw: (g, f, fl, an, wu) => drawRam(g, f, fl, an, wu) },
  lynx: { cw: 112, ch: 80, sx: 1.75, sy: 1.25, sh: .7, plate: 1.5, draw: (g, f, fl, an) => drawLynx(g, f, fl, an) },
  cragling: { cw: 96, ch: 80, sx: 1.5, sy: 1.25, sh: .65, plate: 1.45, draw: (g, f, fl, an) => drawCragling(g, f, fl, an) },
  wisp: { cw: 80, ch: 80, sx: 1.3, sy: 1.3, sh: .4, plate: 1.6, draw: (g, f, fl, an) => drawWisp(g, f, fl, an) },
  yeti: { cw: 128, ch: 128, sx: 3, sy: 3, sh: 1.2, plate: 3.2, draw: (g, f, fl, an, wu) => drawYeti(g, f, fl, an, wu) },
  whelp: { cw: 160, ch: 110, sx: 2.2, sy: 1.5, sh: .8, plate: 1.7, draw: (g, f, fl, an) => drawDragon(g, f, fl, an, false, 160, 110) },
  dragon: { cw: 320, ch: 220, sx: 14.5, sy: 10, sh: 5.4, plate: 10.2, draw: (g, f, fl, an, wu) => drawDragon(g, f, fl, an, wu, 320, 220) },
};
// Cragling: a hunched little creature of rock with a glowing crystal in its back
function drawCragling(g, frame, flip, angry){
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 96, 80);
  if(flip){ g.translate(96, 0); g.scale(-1, 1); }
  const step = [0, 1, 0, -1][frame % 4];
  g.fillStyle = "#4a4640"; [[30, step], [56, -step]].forEach(([x, s]) => g.fillRect(x + s * 3, 56 - Math.max(0, s) * 3, 10, 18));
  g.fillStyle = "#6e6a62"; g.beginPath(); g.moveTo(20, 58); g.lineTo(16, 36); g.lineTo(30, 20); g.lineTo(56, 16); g.lineTo(74, 28); g.lineTo(78, 52); g.lineTo(64, 60); g.closePath(); g.fill();
  g.fillStyle = "#8a857c"; g.beginPath(); g.moveTo(30, 22); g.lineTo(56, 18); g.lineTo(64, 30); g.lineTo(36, 34); g.closePath(); g.fill();
  g.fillStyle = "#5a5650"; g.fillRect(70, 40, 14, 10); g.fillRect(12, 42, 12, 10);                           // stubby arms
  g.fillStyle = "#7fd3ff"; g.beginPath(); g.moveTo(40, 22); g.lineTo(46, 4); g.lineTo(52, 20); g.closePath(); g.fill(); // crystal
  g.fillStyle = "#c9f0ff"; g.fillRect(45, 10, 3, 8);
  g.fillStyle = angry ? "#ff6a40" : "#9fe6ff"; g.fillRect(64, 32, 6, 5); g.fillRect(56, 33, 5, 4);
}
// Frost Wisp: a floating ball of cold light with a trailing tail
function drawWisp(g, frame, flip, angry){
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 80, 80);
  if(flip){ g.translate(80, 0); g.scale(-1, 1); }
  const bob = [0, -2, -3, -2][frame % 4];
  const grd = g.createRadialGradient(40, 34 + bob, 2, 40, 34 + bob, 30); grd.addColorStop(0, "rgba(220,250,255,.95)"); grd.addColorStop(.5, "rgba(127,211,255,.55)"); grd.addColorStop(1, "rgba(127,211,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 80, 80);
  g.fillStyle = "rgba(160,230,255,.7)"; g.beginPath(); g.moveTo(26, 44 + bob); g.quadraticCurveTo(14, 64, 4, 70); g.quadraticCurveTo(22, 62, 34, 50 + bob); g.fill();
  g.fillStyle = "#eaffff"; g.beginPath(); g.arc(40, 34 + bob, 12, 0, Math.PI * 2); g.fill();
  g.fillStyle = angry ? "#2a5aa0" : "#3a7ab0"; g.fillRect(42, 30 + bob, 4, 5); g.fillRect(49, 30 + bob, 4, 5);
}
// Whitemane: an enormous white yeti with a blue-grey face and long arms
function drawYeti(g, frame, flip, angry, windup){
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 128, 128);
  if(flip){ g.translate(128, 0); g.scale(-1, 1); }
  const step = [0, 1, 0, -1][frame % 4]; g.translate(windup ? Math.sin(performance.now() / 30) * 2 : 0, 0);
  g.fillStyle = "#c8ccd4"; [[40, step], [72, -step]].forEach(([x, s]) => g.fillRect(x + s * 3, 92 - Math.max(0, s) * 3, 18, 30));
  g.fillStyle = "#6a7a8a"; [[40, step], [72, -step]].forEach(([x, s]) => g.fillRect(x + s * 3 - 2, 116 - Math.max(0, s) * 3, 22, 8));
  g.fillStyle = "#e8ecf2"; g.beginPath(); g.ellipse(62, 70, 36, 34, 0, 0, Math.PI * 2); g.fill();               // body
  g.fillStyle = "#f6f8fc"; for(const [x, y] of [[40, 50], [56, 42], [74, 46], [86, 60], [44, 80], [80, 84]]) g.fillRect(x - 5, y - 5, 10, 10);
  g.fillStyle = "#dde2ea"; g.save(); g.translate(96, 66); g.rotate(windup ? -.9 : -.2 + step * .1); g.fillRect(-8, 0, 16, 44); g.restore(); // arms
  g.save(); g.translate(30, 66); g.rotate(.25 - step * .1); g.fillRect(-8, 0, 16, 42); g.restore();
  g.fillStyle = "#e8ecf2"; g.beginPath(); g.arc(78, 34, 20, 0, Math.PI * 2); g.fill();                         // head
  g.fillStyle = "#7a8ca0"; g.beginPath(); g.ellipse(86, 38, 12, 11, 0, 0, Math.PI * 2); g.fill();              // face
  g.fillStyle = angry ? "#ff4030" : "#1b1410"; g.fillRect(84, 32, 5, 5); g.fillRect(92, 32, 5, 5);
  g.fillStyle = "#2a2a34"; g.fillRect(86, 44, 12, 4); if(angry || windup){ g.fillStyle = "#ffffff"; g.fillRect(87, 44, 3, 4); g.fillRect(94, 44, 3, 4); }
}
// A frost dragon in profile, facing right. Drawn at 320x220 and scaled to the canvas
// (the raid boss uses the full size; frost whelps reuse it small)
function drawDragon(g, frame, flip, angry, windup, W, H){
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
  if(flip){ g.translate(W, 0); g.scale(-1, 1); }
  g.scale(W / 320, H / 220);
  const step = [0, 1, 0, -1][frame % 4], flap = [0, -10, -16, -8][frame % 4], scale = "#bcd8ea", belly = "#e8f4fa", dark = "#5a8ab0", spine = "#2f5a80";
  if(windup) g.translate(Math.sin(performance.now() / 25) * 2, 0);
  // far wing
  g.fillStyle = "#7aa6c8"; g.beginPath(); g.moveTo(150, 92); g.lineTo(118, 18 + flap); g.lineTo(96, 30 + flap); g.lineTo(80, 70); g.closePath(); g.fill();
  // tail
  g.fillStyle = scale; g.beginPath(); g.moveTo(96, 128); g.quadraticCurveTo(40, 120, 14, 150); g.quadraticCurveTo(30, 132, 98, 146); g.closePath(); g.fill();
  g.fillStyle = spine; for(let i = 0; i < 5; i++){ const x = 24 + i * 16, y = 142 - i * 4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 5, y - 12); g.lineTo(x + 10, y); g.fill(); }
  g.fillStyle = "#e8f6ff"; g.beginPath(); g.moveTo(14, 150); g.lineTo(2, 158); g.lineTo(18, 146); g.fill();
  // legs (back pair darker)
  g.fillStyle = dark; [[104, -step], [182, step]].forEach(([x, s]) => { g.fillRect(x + s * 4, 150, 20, 44); g.fillRect(x + s * 4 - 4, 190, 28, 10); });
  g.fillStyle = scale; [[124, step], [200, -step]].forEach(([x, s]) => { g.fillRect(x + s * 4, 150, 22, 48); g.fillStyle = "#e8f6ff"; for(let c = 0; c < 3; c++) g.fillRect(x + s * 4 + c * 8, 196, 5, 8); g.fillStyle = scale; });
  // body and belly
  g.fillStyle = scale; g.beginPath(); g.ellipse(160, 130, 78, 40, -.05, 0, Math.PI * 2); g.fill();
  g.fillStyle = belly; g.beginPath(); g.ellipse(168, 148, 60, 20, -.05, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#a6c6dc"; for(let i = 0; i < 6; i++) g.fillRect(118 + i * 16, 112 + (i % 2) * 6, 10, 8);
  // back spines
  g.fillStyle = spine; for(let i = 0; i < 7; i++){ const x = 100 + i * 18, y = 96 - Math.sin(i / 6 * Math.PI) * 6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6, y - 18); g.lineTo(x + 12, y); g.fill(); }
  // neck and head
  g.fillStyle = scale; g.beginPath(); g.moveTo(210, 120); g.quadraticCurveTo(236, 70, 252, 58); g.lineTo(272, 70); g.quadraticCurveTo(250, 96, 236, 136); g.closePath(); g.fill();
  g.fillStyle = belly; g.beginPath(); g.moveTo(232, 128); g.quadraticCurveTo(246, 96, 266, 74); g.lineTo(272, 80); g.quadraticCurveTo(254, 104, 240, 136); g.closePath(); g.fill();
  g.fillStyle = scale; g.beginPath(); g.moveTo(246, 46); g.lineTo(300, 54); g.lineTo(314, 66); g.lineTo(300, 72); g.lineTo(266, 76); g.lineTo(244, 66); g.closePath(); g.fill(); // head
  g.fillStyle = belly; g.beginPath(); g.moveTo(264, 70); g.lineTo(312, 68); g.lineTo(300, 80 + (angry || windup ? 8 : 0)); g.lineTo(266, 80); g.closePath(); g.fill(); // jaw
  if(angry || windup){ g.fillStyle = "#ffffff"; for(let i = 0; i < 4; i++) g.fillRect(274 + i * 9, 70, 3, 6); }
  if(windup){ const grd = g.createRadialGradient(316, 72, 2, 316, 72, 26); grd.addColorStop(0, "rgba(230,255,255,.95)"); grd.addColorStop(1, "rgba(127,211,255,0)"); g.fillStyle = grd; g.fillRect(286, 44, 34, 56); }
  g.fillStyle = "#e8f6ff"; g.beginPath(); g.moveTo(252, 50); g.lineTo(226, 22); g.lineTo(258, 44); g.fill(); g.beginPath(); g.moveTo(262, 48); g.lineTo(246, 18); g.lineTo(270, 46); g.fill(); // horns
  g.fillStyle = angry ? "#ff5a40" : "#5ff0ff"; g.fillRect(278, 56, 9, 6);
  g.fillStyle = spine; for(let i = 0; i < 4; i++){ const x = 228 + i * 6, y = 108 - i * 14; g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x - 14, y - 8); g.lineTo(x - 2, y - 6); g.fill(); }
  // near wing (in front)
  g.fillStyle = "#9cc4e0"; g.beginPath(); g.moveTo(178, 100); g.lineTo(150, 6 + flap); g.lineTo(122, 10 + flap); g.lineTo(98, 40 + flap / 2); g.lineTo(110, 96); g.closePath(); g.fill();
  g.strokeStyle = dark; g.lineWidth = 3; g.beginPath(); g.moveTo(178, 100); g.lineTo(150, 6 + flap); g.moveTo(150, 6 + flap); g.lineTo(134, 98); g.moveTo(150, 6 + flap); g.lineTo(112, 92); g.stroke();
  g.fillStyle = "#e8f6ff"; for(let i = 0; i < 4; i++) g.fillRect(112 + i * 16, 96, 4, 10 + (i % 2) * 6); // icicles
}
// quest items and gathering nodes
function drawPick(g){
  g.clearRect(0, 0, 64, 64);
  g.save(); g.translate(32, 34); g.rotate(-.6);
  g.fillStyle = "#8a6440"; g.fillRect(-3, -6, 6, 30); g.strokeStyle = "#2a1a0e"; g.lineWidth = 2; g.strokeRect(-3, -6, 6, 30);
  g.fillStyle = "#9aa6b8"; g.beginPath(); g.moveTo(-22, -4); g.quadraticCurveTo(0, -18, 22, -4); g.lineTo(18, -1); g.quadraticCurveTo(0, -12, -18, -1); g.closePath(); g.fill(); g.stroke();
  g.restore();
}
function drawOre(g){
  g.clearRect(0, 0, 64, 64);
  g.fillStyle = "#6e6a62"; g.beginPath(); g.moveTo(8, 56); g.lineTo(12, 34); g.lineTo(30, 24); g.lineTo(52, 30); g.lineTo(58, 56); g.closePath(); g.fill();
  for(const [x, h] of [[22, 22], [34, 30], [46, 18]]){ g.fillStyle = "#7fd3ff"; g.beginPath(); g.moveTo(x - 6, 44); g.lineTo(x, 44 - h); g.lineTo(x + 6, 44); g.closePath(); g.fill(); g.fillStyle = "#e0f8ff"; g.fillRect(x - 1, 44 - h + 6, 2, h - 10); }
}
function drawFrostbloom(g){
  g.clearRect(0, 0, 64, 64);
  g.strokeStyle = "#5a8aa0"; g.lineWidth = 4; g.beginPath(); g.moveTo(32, 62); g.quadraticCurveTo(28, 44, 32, 30); g.stroke();
  g.fillStyle = "#c9e8ff"; for(let i = 0; i < 6; i++){ const a = i / 6 * Math.PI * 2; g.beginPath(); g.ellipse(32 + Math.cos(a) * 9, 24 + Math.sin(a) * 9, 8, 4, a, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = "#5fb0e8"; g.beginPath(); g.arc(32, 24, 6, 0, Math.PI * 2); g.fill();
}
const NODE_ART = { herb: drawFlower, ore: drawOre, frostbloom: drawFrostbloom };
const QUEST_ITEM_ART = { tooth: (g) => drawTooth(g), pick: drawPick };
// Crag Ram: shaggy mountain sheep with heavy curled horns; shakes before it charges
function drawRam(g, frame, flip, angry, windup){
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 112, 88);
  if(flip){ g.translate(112, 0); g.scale(-1, 1); }
  const step = [0, 1, 0, -1][frame % 4]; g.translate(windup ? Math.sin(performance.now() / 30) * 2 : 0, 0);
  g.fillStyle = "#3a2e26";
  [[26, step], [38, -step], [66, -step], [78, step]].forEach(([x, s]) => g.fillRect(x + s * 3, 58 - Math.max(0, s) * 3, 8, 22));
  g.fillStyle = "#1e1814"; [[26, step], [38, -step], [66, -step], [78, step]].forEach(([x, s]) => g.fillRect(x + s * 3, 76 - Math.max(0, s) * 3, 8, 5));
  g.fillStyle = "#8a7a66"; g.beginPath(); g.ellipse(52, 46, 34, 18, 0, 0, Math.PI * 2); g.fill();          // coat
  g.fillStyle = "#a8987e"; for(const [x, y] of [[30, 38], [42, 34], [56, 33], [70, 36], [36, 52], [62, 54]]){ g.fillRect(x - 4, y - 4, 8, 8); }
  g.fillStyle = "#d4c8b0"; g.beginPath(); g.ellipse(56, 58, 22, 7, 0, 0, Math.PI * 2); g.fill();         // pale belly
  g.fillStyle = "#6e6050"; g.beginPath(); g.ellipse(90, 38, 12, 13, .3, 0, Math.PI * 2); g.fill();        // head
  g.fillStyle = "#4e4438"; g.beginPath(); g.ellipse(100, 44, 7, 6, .2, 0, Math.PI * 2); g.fill();
  g.lineWidth = 7; g.strokeStyle = "#d8ccb0"; g.beginPath(); g.arc(84, 34, 11, -2.6, 1.9); g.stroke();      // curled horn
  g.lineWidth = 2; g.strokeStyle = "#9a8a6a"; for(let i = 0; i < 4; i++){ const a = -2.2 + i * .9; g.beginPath(); g.moveTo(84 + Math.cos(a) * 8, 34 + Math.sin(a) * 8); g.lineTo(84 + Math.cos(a) * 14, 34 + Math.sin(a) * 14); g.stroke(); }
  g.fillStyle = angry ? "#ff4030" : "#e8c040"; g.fillRect(94, 34, 5, 4);
  g.fillStyle = "#6e6050"; g.beginPath(); g.moveTo(18, 40); g.lineTo(10, 46); g.lineTo(20, 48); g.fill();  // tail
}
// Snowfang Lynx: pale spotted mountain cat with tufted ears and a short tail
function drawLynx(g, frame, flip, angry){
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 112, 80);
  if(flip){ g.translate(112, 0); g.scale(-1, 1); }
  const step = [0, 1, 0, -1][frame % 4];
  g.fillStyle = "#b8b4ac";
  [[30, step], [40, -step], [68, -step], [78, step]].forEach(([x, s]) => g.fillRect(x + s * 3, 50 - Math.max(0, s) * 3, 8, 24));
  g.fillStyle = "#e8e4dc"; [[30, step], [40, -step], [68, -step], [78, step]].forEach(([x, s]) => g.fillRect(x + s * 3 - 1, 70 - Math.max(0, s) * 3, 10, 5));
  g.fillStyle = "#d8d4ca"; g.beginPath(); g.ellipse(54, 42, 31, 14, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#f2efe8"; g.beginPath(); g.ellipse(58, 50, 20, 6, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#6a665e"; for(const [x, y] of [[34, 36], [46, 32], [58, 34], [70, 38], [40, 46], [64, 44], [52, 40]]) g.fillRect(x - 2, y - 2, 4, 4);
  g.fillStyle = "#d8d4ca"; g.beginPath(); g.moveTo(24, 36); g.lineTo(14, 30); g.lineTo(16, 38); g.lineTo(24, 42); g.fill();  // short tail
  g.fillStyle = "#2a2622"; g.fillRect(12, 29, 5, 5);
  g.fillStyle = "#d8d4ca"; g.beginPath(); g.ellipse(88, 34, 13, 12, 0, 0, Math.PI * 2); g.fill();             // head
  g.fillStyle = "#e8e4dc"; g.beginPath(); g.ellipse(84, 42, 9, 6, 0, 0, Math.PI * 2); g.fill();               // ruff
  g.fillStyle = "#c8c4ba"; g.beginPath(); g.moveTo(80, 26); g.lineTo(82, 12); g.lineTo(88, 24); g.fill(); g.beginPath(); g.moveTo(90, 24); g.lineTo(95, 11); g.lineTo(98, 26); g.fill();
  g.fillStyle = "#1b1410"; g.fillRect(81, 9, 3, 5); g.fillRect(94, 8, 3, 5);                               // ear tufts
  g.fillStyle = angry ? "#ff4030" : "#7fd0c0"; g.fillRect(92, 31, 5, 4);
  g.fillStyle = "#3a3632"; g.fillRect(99, 37, 4, 3);
  if(angry){ g.fillStyle = "#ffffff"; g.fillRect(94, 42, 3, 4); g.fillRect(99, 42, 3, 4); }
}
function drawBoar(g, frame, flip, angry, windup){
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 128, 96);
  if(flip){ g.translate(128, 0); g.scale(-1, 1); }
  const step = [0, 1, 0, -1][frame % 4], shake = windup ? Math.sin(performance.now() / 30) * 2 : 0;
  g.translate(shake, 0);
  g.fillStyle = "#2a1c14";
  [[28, step], [42, -step], [76, -step], [90, step]].forEach(([x, s]) => g.fillRect(x + s * 3, 66 - Math.max(0, s) * 3, 10, 24));
  g.fillStyle = "#4a3222"; g.beginPath(); g.ellipse(60, 54, 44, 26, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#5c3e2a"; g.beginPath(); g.ellipse(56, 48, 36, 18, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#2a1c14"; for(let i = 0; i < 9; i++){ g.beginPath(); g.moveTo(30 + i * 7, 32); g.lineTo(34 + i * 7, 18 - (i % 2) * 5); g.lineTo(38 + i * 7, 32); g.fill(); }
  g.fillStyle = "#4a3222"; g.beginPath(); g.ellipse(102, 54, 20, 18, .2, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#7a5a46"; g.beginPath(); g.ellipse(118, 60, 8, 9, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#1b1410"; g.fillRect(116, 57, 2, 3); g.fillRect(120, 57, 2, 3);
  g.fillStyle = "#f2ead6"; g.beginPath(); g.moveTo(108, 66); g.quadraticCurveTo(124, 64, 122, 46); g.quadraticCurveTo(118, 60, 106, 61); g.fill();
  g.beginPath(); g.moveTo(98, 66); g.quadraticCurveTo(108, 70, 110, 54); g.quadraticCurveTo(104, 64, 96, 62); g.fill();
  g.fillStyle = angry ? "#ff4030" : "#e8c040"; g.fillRect(104, 44, 6, 5);
  g.fillStyle = "#3a2618"; g.beginPath(); g.moveTo(92, 40); g.lineTo(96, 26); g.lineTo(102, 40); g.fill();
}
function drawTooth(g){
  g.clearRect(0, 0, 64, 64);
  g.fillStyle = "#f6efd8"; g.strokeStyle = "#5a4a30"; g.lineWidth = 3;
  g.beginPath(); g.moveTo(22, 54); g.quadraticCurveTo(10, 20, 40, 8); g.quadraticCurveTo(30, 28, 38, 54); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = "#c9b98a"; g.fillRect(20, 50, 20, 6);
}
function drawSheep(g, frame, flip, angry, dead){
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 96, 80);
  if(flip){ g.translate(96, 0); g.scale(-1, 1); }
  const step = [0, 1, 0, -1][frame % 4];
  g.fillStyle = "#2b2420";
  [[24, step], [36, -step], [56, -step], [68, step]].forEach(([x, s]) => g.fillRect(x + s * 2, 56 - Math.max(0, s) * 3, 7, 18));
  const wool = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
  [[30, 42, 16], [48, 36, 18], [64, 42, 15], [40, 52, 14], [58, 52, 14], [22, 50, 11], [72, 50, 11]].forEach(([x, y, r]) => wool(x, y, r + 2, "#9c9890"));
  [[30, 40, 16], [48, 34, 18], [64, 40, 15], [40, 50, 14], [58, 50, 14], [22, 48, 11], [72, 48, 11]].forEach(([x, y, r]) => wool(x, y, r, dead ? "#cfcac0" : "#f4f1ea"));
  g.fillStyle = "#2b2420"; g.beginPath(); g.ellipse(82, 40, 11, 14, .3, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(74, 28, 6, 3, -.6, 0, Math.PI * 2); g.fill();
  g.fillStyle = angry ? "#ff5040" : "#ffffff"; g.fillRect(84, 35, 5, 5);
  if(angry){ g.fillStyle = "#1b1410"; g.save(); g.translate(86, 31); g.rotate(-.5); g.fillRect(-5, -1, 10, 3); g.restore(); }
}
function markerTexture(char, color){
  const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
  g.font = "700 56px 'Barlow Condensed', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.lineWidth = 8; g.strokeStyle = "#1b1410"; g.strokeText(char, 32, 34); g.fillStyle = color; g.fillText(char, 32, 34);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}
