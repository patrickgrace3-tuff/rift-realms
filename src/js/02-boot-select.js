"use strict";
// Loads champions from Data Dragon and runs the champion select screen.

/* ---------- Boot ---------- */
async function boot(){
  $("#spin").hidden = false; $("#loaderr").hidden = true; $("#retry").hidden = true;
  if(!window.THREE){
    $("#spin").hidden = true; $("#loadmsg").textContent = "Couldn't load the 3D engine";
    $("#loaderr").textContent = "The game loads three.js from a CDN. Check your internet connection, then try again.";
    $("#loaderr").hidden = false; $("#retry").hidden = false; return;
  }
  try{
    const versions = await (await fetch(`${DD}/api/versions.json`)).json();
    V = versions[0];
    const cj = await (await fetch(`${DD}/cdn/${V}/data/en_US/champion.json`)).json();
    champs = Object.values(cj.data).sort((a, b) => a.name.localeCompare(b.name));
  }catch(err){
    console.error(err);
    $("#spin").hidden = true;
    $("#loadmsg").textContent = "Couldn't reach Riot's asset server";
    $("#loaderr").innerHTML = "This game loads champion art and abilities live from Riot. If you're viewing it inside the Claude app, download the file and open it in Chrome, Edge, Firefox or Safari. If that still fails, open <b>ddragon.leagueoflegends.com/api/versions.json</b> in a browser tab. If that page doesn't load, your network is blocking Riot's asset server.";
    $("#loaderr").hidden = false; $("#retry").hidden = false;
    return;
  }
  try{ initThree(); buildZone(); buildSelect(); show("select"); }
  catch(err){
    console.error(err);
    $("#spin").hidden = true; $("#loadmsg").textContent = "Couldn't build the world";
    $("#loaderr").textContent = `Something went wrong setting up the 3D scene (${err.message}). Try reloading, or a different browser.`;
    $("#loaderr").hidden = false; $("#retry").hidden = false;
  }
}
$("#retry").onclick = () => location.reload();
function show(id){
  for(const s of ["loading", "select"]) $("#" + s).hidden = s !== id;
  const inGame = id === "game";
  $("#cv").hidden = !inGame; $("#ov").hidden = !inGame; $("#hud").hidden = !inGame;
  if(!inGame) $("#dialog").hidden = true;
  if(inGame) resize();
}

/* ---------- Champion select ---------- */
const TAGS = ["All", "Fighter", "Mage", "Assassin", "Marksman", "Support", "Tank"];
let activeTag = "All";
function buildSelect(){
  $("#patch").textContent = `Patch ${V} · ${champs.length} champions`;
  const grid = $("#grid"); grid.innerHTML = "";
  for(const c of champs){
    const b = document.createElement("button");
    b.className = "champ"; b.dataset.id = c.id; b.dataset.name = c.name.toLowerCase(); b.dataset.tags = c.tags.join(",");
    b.innerHTML = `<img loading="lazy" alt="" src="${champIcon(c.id)}"><span>${esc(c.name)}</span>`;
    b.onclick = () => openPreview(c);
    grid.appendChild(b);
  }
  const chips = $("#chips"); chips.innerHTML = "";
  for(const t of TAGS){
    const b = document.createElement("button");
    b.className = "chip"; b.textContent = t; b.setAttribute("aria-pressed", t === activeTag);
    b.onclick = () => { activeTag = t; chips.querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", x.textContent === t)); filter(); };
    chips.appendChild(b);
  }
  filter();
}
function filter(){
  const q = $("#search").value.trim().toLowerCase(); let n = 0;
  for(const b of $("#grid").children){
    const ok = b.dataset.name.includes(q) && (activeTag === "All" || b.dataset.tags.split(",").includes(activeTag));
    b.hidden = !ok; if(ok) n++;
  }
  $("#count").textContent = `${n} shown`;
}
$("#search").addEventListener("input", filter);

let chosen = null, previewSprite = null;
async function getDetail(id){
  if(detailCache.has(id)) return detailCache.get(id);
  const j = await (await fetch(`${DD}/cdn/${V}/data/en_US/champion/${id}.json`)).json();
  const d = j.data[id]; detailCache.set(id, d); return d;
}
async function openPreview(c){
  $("#pvName").textContent = c.name; $("#pvTitle").textContent = c.title; $("#pvTags").textContent = c.tags.join(" · ");
  $("#pvKit").innerHTML = `<p class="sub">Loading abilities…</p>`;
  $("#pvEnter").disabled = $("#pvJoin").disabled = true;
  $("#preview").hidden = false;
  const pc = $("#pvSprite"), pg = pc.getContext("2d"); pg.clearRect(0, 0, 128, 192);
  try{
    const d = await getDetail(c.id); chosen = d;
    const kit = buildKit(d);
    previewSprite = new CharArt({ style: kit.cls, headUrl: champIcon(d.id), ring: "#c9a55c", initial: d.name[0] });
    previewSprite.onload = () => { pg.clearRect(0, 0, 128, 192); pg.drawImage(previewSprite.canvas, 0, 0); };
    previewSprite.draw(0, false, "idle", true); pg.clearRect(0, 0, 128, 192); pg.drawImage(previewSprite.canvas, 0, 0);
    const rows = [];
    ["Q", "W", "E", "R"].forEach((k, i) => {
      const s = d.spells[i], p = kit[k];
      rows.push(`<div class="ab"><img alt="" src="${spellIcon(s.image.full)}"><div><b><span class="tag">${k}</span>${esc(s.name)}</b><span class="role">${k === "R" ? "Ultimate · " : ""}${ARCH[p.type].label} · ${p.cd}s cooldown${k === "R" ? ` · unlocks at level ${ULT_LEVEL}` : ""}</span><p>${esc(describeAbility(p))}</p></div></div>`);
    });
    rows.push(`<p class="sub" style="font-size:13px">Class: ${kit.cls} · Health ${Math.round(d.stats.hp)} · Attack ${Math.round(d.stats.attackdamage)} · ${d.stats.attackrange > 300 ? "ranged" : "melee"} attacks</p>`);
    $("#pvKit").innerHTML = rows.join("");
    $("#pvEnter").disabled = $("#pvJoin").disabled = false; $("#pvEnter").focus();
  }catch(e){
    console.error(e);
    $("#pvKit").innerHTML = `<p class="sub">Couldn't load this champion's abilities. Check your connection and pick them again.</p>`;
  }
}
$("#pvBack").onclick = () => { $("#preview").hidden = true; };
$("#pvEnter").onclick = () => { $("#preview").hidden = true; startWorld({ role: "host", details: { blue: chosen } }); };
$("#pvJoin").onclick = () => { $("#preview").hidden = true; $("#joinBox").hidden = false; $("#joinMsg").textContent = ""; $("#joinCode").value = ""; $("#joinCode").focus(); };
