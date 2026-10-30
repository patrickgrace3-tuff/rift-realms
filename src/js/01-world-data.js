"use strict";
// Zone layout, NPCs, quests, mobs, skill-tree rules, items and loot tables. Pure data and pure functions.

/* =====================================================================
   SUNHOLLOW VALE: zone layout in zone units (0–8000; y is north)
   ===================================================================== */
// The world is two zones stacked north to south, each ZS square: Sunhollow Vale (y 0–8000)
// and Frostspine Peaks (y 8000–16000). A ridge separates them; Greywind Pass is the only way through.
const ZS = 8000, WH = ZS * 2, ZONE_W = 110, ZSC = ZONE_W / ZS;
const ZMIN = 650, ZMAX = ZS - 650;
const XF = (() => {
  const f = (x, y) => ({ x: (x - ZS / 2) * ZSC, z: -(y - ZS / 2) * ZSC });
  f.scale = ZSC; f.inv = (x, z) => [x / ZSC + ZS / 2, -z / ZSC + ZS / 2];
  return f;
})();
const SPAWN = [4000, 3250];
const VILLAGE = { x: 4000, y: 3600, r: 1000 };
const PASTURE = { x: 2400, y: 5600, r: 900 };
const POND = { x: 5700, y: 2300, r: 560 };
const DEN = { x: 6250, y: 5900, r: 620 };      // Bramblewood Hollow, the Old Tusker's den (east)
const CAMP = { x: 5960, y: 5340 };             // Huntress Kaela's camp
const CABIN = { x: 1220, y: 3020 };            // Old Merrin's cabin (far west)
const PINES = { x: 3900, y: 6650, r: 750 };    // Howling Pines, wolf territory (north)
const TOWER = { x: 4250, y: 1250 };            // Old Watchtower on the southern road
const HERB_AREA = { x: 5700, y: 2300, r: 1150 };
const LOOKOUTS = [{ name: "East Overlook", x: 6950, y: 4650 }, { name: "Southwest Bluff", x: 1800, y: 1650 }, { name: "Pinecrest Ridge", x: 2700, y: 7000 }];
const BEACONS = [{ name: "West Beacon", x: 1450, y: 4400 }, { name: "North Beacon", x: 5300, y: 6950 }, { name: "South Beacon", x: 6850, y: 1500 }];
const WAVES = [2, 2, 3, 3];
const PASS = { x: 4100, y: ZS, w: 330 };       // Greywind Pass, the gap in the ridge between the zones
const WELL = [4000, 3750], CAMPFIRE = [4380, 3380];
const HOUSES = [[3350, 4200, .2], [4700, 4250, -.3], [3250, 3150, 1.3], [4850, 3000, -1.2]];
const PATHS = [
  [[4000, 3600], [3300, 4500], [2850, 5000]],
  [[4000, 3600], [4100, 2200], [4300, 700]],
  [[4000, 3600], [5100, 2750]],
  [[4000, 3600], [5600, 4300], [7000, 4700]],
  [[5600, 4300], [5850, 5150], [6250, 5900]],
  [[4000, 3600], [2700, 3250], [1500, 3000]],
  [[3300, 4500], [3700, 5600], [3900, 6400]],
  [[4000, 3600], [2800, 2400], [1900, 1700]],
  [[3900, 6400], [4050, 7300], [PASS.x, ZS + 1]],
];
/* ---------- Frostspine Peaks (north zone) ---------- */
const OUTPOST = { x: 4150, y: 9450, r: 520 };  // Highwatch Outpost, just north of the pass
const RAM_MEADOW = { x: 2500, y: 10900, r: 900 }; // Ramsfoot Meadow (west)
const LYNX_RIDGE = { x: 5700, y: 11700, r: 800 }; // Whitefang Ridge (east)
const SUMMIT = { x: 4200, y: 14700 };             // Skyreach Overlook, where the road ends
const BRAZIER = [4330, 9330];
const PEAK_PATHS = [
  [[PASS.x, ZS - 1], [4150, 8700], [OUTPOST.x, OUTPOST.y]],
  [[OUTPOST.x, OUTPOST.y], [3950, 11000], [4350, 12900], [SUMMIT.x, SUMMIT.y]],
  [[OUTPOST.x, OUTPOST.y], [3300, 10200], [RAM_MEADOW.x, RAM_MEADOW.y]],
  [[3950, 11000], [4900, 11500], [LYNX_RIDGE.x, LYNX_RIDGE.y]],
];
// big rock spires inside the zone (solid, and drawn as peaks)
const CRAGS = [[1700, 12900, 700], [6450, 9700, 520], [2600, 9100, 420], [6100, 14000, 700], [5200, 13400, 380], [2700, 14600, 520]];
// the ridge between the zones: a wall of rock everywhere except the pass
const RIDGE = []; for(let x = 500; x <= ZS - 500; x += 300) if(Math.abs(x - PASS.x) > PASS.w + 430) RIDGE.push({ x, y: ZS, r: 430 });
const PEAK_OBSTACLES = [...RIDGE, ...CRAGS.map(([x, y, r]) => ({ x, y, r: r * .8 })),
  { x: PASS.x - PASS.w - 330, y: ZS, r: 330 }, { x: PASS.x + PASS.w + 330, y: ZS, r: 330 },
  { x: BRAZIER[0], y: BRAZIER[1], r: 80 }, { x: OUTPOST.x - 260, y: OUTPOST.y + 230, r: 170 }, { x: OUTPOST.x + 300, y: OUTPOST.y + 180, r: 170 }];
const FIRES = [CAMPFIRE, BRAZIER];
// Every zone: a key, its name, and its area in world units (x0, y0 is the south-west corner).
// New zones go here; the minimap and world map draw whatever is in this list.
const ZONES = [
  { key: "vale", name: "Sunhollow Vale", x0: 0, y0: 0, w: ZS, h: ZS },
  { key: "peaks", name: "Frostspine Peaks", x0: 0, y0: ZS, w: ZS, h: ZS },
];
const zoneAt = (y, x = ZS / 2) => ZONES.find(z => x >= z.x0 && x < z.x0 + z.w && y >= z.y0 && y < z.y0 + z.h) || ZONES[y >= ZS ? ZONES.length - 1 : 0];
const ZONE_PICS = {}; // each zone's map picture (a canvas), keyed like ZONES; filled in when the scene is built
const NPCS = [
  { id: "bram", name: "Farmer Bram", x: 3720, y: 3480, head: "farmer", style: "farmer", idle: "Fine weather for honest work. Mind the flock on your way out." },
  { id: "kaela", name: "Huntress Kaela", x: 5790, y: 5190, head: "huntress", style: "hunter", idle: "Keep your voice down out here. Sound carries in the Bramblewood." },
  { id: "merrin", name: "Old Merrin", x: 1440, y: 2960, head: "fisher", style: "fisher", idle: "Westwind's blowing. Good day to mend nets and not much else." },
  { id: "rhea", name: "Captain Rhea", x: 4300, y: 3820, head: "guard", style: "guard", idle: "The Vale is quiet. I intend to keep it that way." },
  { id: "halvard", name: "Warden Halvard", x: 4010, y: 9560, head: "warden", style: "warden", idle: "Keep your fire lit and your back to the rock. The mountain forgives nothing." },
];
const OBSTACLES = [
  ...HOUSES.map(h => ({ x: h[0], y: h[1], r: 270 })),
  { x: WELL[0], y: WELL[1], r: 90 }, { x: CAMPFIRE[0], y: CAMPFIRE[1], r: 80 },
  ...NPCS.map(n => ({ x: n.x, y: n.y, r: 55 })),
  { x: CAMP.x, y: CAMP.y, r: 190 }, { x: CABIN.x, y: CABIN.y, r: 250 }, { x: TOWER.x, y: TOWER.y, r: 220 },
  ...BEACONS.map(b => ({ x: b.x, y: b.y, r: 70 })), ...LOOKOUTS.map(p => ({ x: p.x, y: p.y, r: 55 })),
  ...PEAK_OBSTACLES,
];
const QUESTS = {
  sheep: {
    id: "sheep", lvl: 1, title: "Woolly Menace", giver: "bram", turnin: "bram", prereq: null, xp: 250, where: [PASTURE.x, PASTURE.y], whereR: PASTURE.r,
    obj: { type: "kill", kind: "sheep", count: 5, label: "Sheep slain" },
    offer: "Ah, an adventurer! Fresh off the road, by the look of you. My flock's gone wild since that strange storm rolled over the Vale. Rams butting the fences, ewes chasing the children. Thin the herd for me, would you? Five of them should calm the rest.",
    objective: "Slay 5 Sheep in the pasture northwest of the village.",
    progress: "Still bleating out there, aren't they? Five, friend. I'll be right here.",
    complete: "Five? Ha! The rest have gone quiet as lambs. You've a strong arm. Talk to me again when you're ready for real work.",
    done: "The flock's been calm ever since. Thank you, friend.",
  },
  tusker: {
    id: "tusker", lvl: 3, title: "The Old Tusker", giver: "bram", turnin: "kaela", prereq: "sheep", xp: 300, reward: "weapon", where: [DEN.x, DEN.y], whereR: DEN.r,
    obj: { type: "loot", from: "boar", item: "tooth", itemName: "Old Tusker's Tooth", count: 1, label: "Old Tusker's Tooth" },
    offer: "There's a boar out in the Bramblewood big as a hay cart. Folk call him the Old Tusker. He gored two of my best rams last spring. Huntress Kaela has been tracking him for weeks. Head east past the woods, find his den, and bring Kaela his tooth. She'll see you're paid properly.",
    objective: "Slay the Old Tusker in his den in the Bramblewood, east of the village. Bring his tooth to Huntress Kaela at her camp.",
    progress: "Kaela's camp is east along the road, past the woods. The Old Tusker's den is just beyond it. Watch for his charge.",
    waiting: "The Old Tusker beds down in the hollow just past my camp. Watch him: when he paws the ground, he's about to charge. Bring me that tooth.",
    complete: "By the Vale... that's his tooth, all right. You've done what I couldn't in a month of trying. I carved this from his other tusk while you were out there. Take it. It'll bite harder than anything you've swung before.",
    done: "That weapon suits you. Wear it well.",
  },
  courier: {
    id: "courier", lvl: 4, title: "Against the Clock", giver: "kaela", turnin: "merrin", prereq: "tusker", xp: 200, timeLimit: 600, where: [CABIN.x, CABIN.y],
    obj: { type: "deliver", itemName: "Kaela's Healing Draught", label: "Deliver the draught to Old Merrin" },
    offer: "One more thing, while you've got the legs for it. Old Merrin, the fisherman on the far western shore, took a fever three days back. This draught will break it, but it spoils fast. Ten minutes, no more, before it turns to swamp water. Will you run it to him?",
    objective: "Deliver Kaela's Healing Draught to Old Merrin on the far west side of the Vale within 10 minutes.",
    progress: "What are you still doing here? Run! Merrin's cabin is on the far western shore, past the village.",
    waiting: "Hm? Kaela sent someone? I don't see any draught yet.",
    complete: "Kaela's draught? Bless her, and bless you. Still warm, too. I can feel the fever lifting already. Here, take what an old fisherman can spare.",
    done: "Feeling right as rain, thanks to you and Kaela.",
    fail: "The draught spoiled before it reached Merrin. Return to Huntress Kaela for a fresh one.",
  },
  scout: {
    id: "scout", lvl: 3, title: "Eyes on the Vale", giver: "rhea", turnin: "rhea", prereq: "sheep", xp: 250, reward: { item: 1 },
    obj: { type: "explore", points: LOOKOUTS, count: 3, label: "Lookouts scouted" },
    offer: "You're the one who settled Bram's flock. Good. I need a scout. Something has been moving along the edges of the Vale at night. Visit the three lookouts, the East Overlook, the Southwest Bluff and Pinecrest Ridge, and tell me what you see.",
    objective: "Visit the East Overlook, the Southwest Bluff and Pinecrest Ridge.",
    progress: "Three lookouts. Take a good look from each, then report back to me.",
    complete: "Campfires along the southern road? Bandits, then. I was afraid of that. Take this. You've earned it.",
    done: "Keep your eyes open out there.",
  },
  wolves: {
    id: "wolves", lvl: 5, title: "The Hungry Pack", giver: "kaela", turnin: "kaela", prereq: "tusker", xp: 350, reward: { item: 2 }, where: [PINES.x, PINES.y], whereR: PINES.r,
    obj: { type: "kill", kind: "wolf", count: 6, label: "Gray Wolves slain" },
    offer: "With the Old Tusker gone, the wolves of the Howling Pines have grown bold. They took a calf from Bram's field last night. Thin the pack, six of them. They hunt together, so if one sees you, expect the rest.",
    objective: "Slay 6 Gray Wolves in the Howling Pines, north of the village.",
    progress: "Six wolves. The Howling Pines are north, up the road past the pasture.",
    complete: "That'll teach them to stay off the farms. Here, this was part of my old kit. It'll serve you better than it serves my trunk.",
    done: "The pines are quieter now. Good hunting.",
  },
  herbs: {
    id: "herbs", lvl: 5, title: "Sunpetal Tea", giver: "merrin", turnin: "merrin", prereq: "courier", xp: 300, coins: 150, reward: { item: 1 }, where: [HERB_AREA.x, HERB_AREA.y], whereR: HERB_AREA.r,
    obj: { type: "collect", node: "herb", count: 6, label: "Sunpetals gathered" },
    offer: "Kaela's draught broke the fever, but I'm weak as a newborn lamb. Sunpetal grows in the grass around Stillwater Pond, east of the village. Little yellow flowers that catch the light. Bring me six and I'll brew myself back to health.",
    objective: "Gather 6 Sunpetals around Stillwater Pond. Walk over them or right-click to pick them.",
    progress: "Six sunpetals, from around Stillwater Pond. They glitter in the grass.",
    complete: "Ah, that smell! Sunpetal tea, just like my mother made. Here, some coin and something I pulled out of my nets.",
    done: "Feeling stronger every day, thanks to you.",
  },
  beacons: {
    id: "beacons", lvl: 6, title: "Light the Beacons", giver: "rhea", turnin: "rhea", prereq: "scout", xp: 350, reward: { item: 2 },
    obj: { type: "interact", points: BEACONS, count: 3, label: "Beacons lit" },
    offer: "If bandits are gathering, every farm in the Vale needs warning. There are three old signal beacons on the hills: west, north and south-east. Light them all. Stand at each one for a moment while the fire catches.",
    objective: "Light the West, North and South Beacons. Right-click a beacon and stand still while it lights.",
    progress: "Three beacons. Right-click one and hold still while the fire catches.",
    complete: "I saw them from the wall, all three burning! Every family in the Vale will bar their doors tonight. Here's your pay.",
    done: "The beacons will burn for days yet.",
  },
  defend: {
    id: "defend", lvl: 7, title: "Hold the Watchtower", giver: "rhea", turnin: "rhea", prereq: "beacons", xp: 500, reward: { item: 3, slot: "chest", name: "Watch Captain's" }, where: [TOWER.x, TOWER.y], whereR: 550,
    obj: { type: "defend", at: TOWER, dur: 60, label: "Hold the Old Watchtower" },
    offer: "The bandits are coming up the southern road, and the Old Watchtower is all that stands between them and the village. Get down there and hold it. One minute is all I need to rally the farmers. Whatever happens, don't leave the tower.",
    objective: "Go to the Old Watchtower on the southern road. When the bandits attack, survive for 60 seconds without leaving the tower.",
    progress: "The Old Watchtower, south down the road. Hold it for one minute.",
    complete: "You held it, alone! The bandits are scattering into the hills. The Vale owes you, champion. This was forged for the captain of the watch. I think it belongs to you now. When you've seen to the rest of the Vale's troubles, come and find me. There's word from the north.",
    done: "Thanks to you, Sunhollow sleeps safe tonight.",
    fail: "You abandoned the watchtower. Speak to Captain Rhea to try again.",
  },
  northpass: {
    id: "northpass", lvl: 9, title: "The Road North", giver: "rhea", turnin: "halvard", prereq: ["sheep", "tusker", "courier", "scout", "wolves", "herbs", "beacons", "defend"], xp: 400, coins: 120,
    where: [OUTPOST.x, OUTPOST.y],
    obj: { type: "deliver", itemName: "Captain Rhea's Letter", label: "Bring Rhea's letter to Warden Halvard" },
    offer: "Every farm in the Vale owes you something now, and so do I. But the Vale is small, and you've outgrown it. North of the Howling Pines the road climbs to Greywind Pass and into the Frostspine Peaks. My old friend Halvard keeps the outpost at Highwatch. He's been asking for help all winter. Take him this letter. It says you're the best I've seen.",
    objective: "Follow the road north past the Howling Pines, through Greywind Pass, to Highwatch Outpost. Give Captain Rhea's letter to Warden Halvard.",
    progress: "North past the pines, through the pass, then follow the road to Highwatch. Dress warm.",
    waiting: "Rhea sent you? Let's see that letter.",
    complete: "\"The best I've seen.\" Rhea doesn't hand those out. Welcome to Highwatch, champion. Warm your hands by the brazier. You'll need them steady for what I have in mind.",
    done: "Any friend of Rhea's has a place by our fire.",
  },
  lynx: {
    id: "lynx", lvl: 10, title: "Claws on the Ridge", giver: "halvard", turnin: "halvard", prereq: "northpass", xp: 700, coins: 200, reward: { item: 2 }, where: [LYNX_RIDGE.x, LYNX_RIDGE.y], whereR: LYNX_RIDGE.r,
    obj: { type: "kill", kind: "lynx", count: 8, label: "Snowfang Lynxes slain" },
    offer: "The snowfang lynxes have come down off Whitefang Ridge. Hungry winter, too many cubs. They've taken two of our pack mules and they stalk anyone who walks the east trail. They hunt alone, but they'll spring on you from the snow before you see them. Thin them out. Eight should do it.",
    objective: "Slay 8 Snowfang Lynxes on Whitefang Ridge, east of Highwatch Outpost.",
    progress: "Eight lynxes, up on Whitefang Ridge to the east. Watch the snowdrifts.",
    complete: "Eight pelts' worth. The east trail will be safe for the mules again, and the rest will think twice about coming down. Take this, and my thanks. There's plenty more work up here for someone like you.",
    done: "The ridge has been quiet since. Good work.",
  },
};
const QUEST_ORDER = ["sheep", "tusker", "courier", "scout", "wolves", "herbs", "beacons", "defend", "northpass", "lynx"];
/* ---------- Experience ---------- */
// Each level needs more XP than the last. Creatures and quests well below your level give less.
const MAX_LEVEL = 20;
const ULT_LEVEL = 6; // the ultimate (R) unlocks at this level
const xpForLevel = lvl => Math.round(40 * Math.pow(lvl, 1.6) + 70);
// creatures: +10% per level above you (up to +40%), −20% per level below (nothing at 5 below)
function mobXp(base, mobLvl, heroLvl){ const d = mobLvl - heroLvl; return Math.round(base * (d >= 0 ? 1 + .1 * Math.min(d, 4) : Math.max(0, 1 + .2 * d))); }
// quests: full XP up to 3 levels below you, then −20% per level, never less than 20%
function questXp(Q, heroLvl){ const over = heroLvl - (Q.lvl || heroLvl); return Math.round(Q.xp * (over <= 3 ? 1 : Math.max(.2, 1 - .2 * (over - 3)))); }
// prereq is a quest id or a list of them; all must be done
function prereqMet(quests, Q){ const ids = !Q.prereq ? [] : Array.isArray(Q.prereq) ? Q.prereq : [Q.prereq]; return ids.every(id => quests[id] && quests[id].state === "done"); }
const WEAPON_REWARD = { melee: "Tuskbreaker Blade", caster: "Tuskwood Staff", ranged: "Tuskbone Bow", ad: 32, abil: .18 };
// Which quest an NPC should talk about, given a hero's quest log (used by the host and for markers)
function questFor(quests, npcId){
  const prereqOk = Q => prereqMet(quests, Q);
  for(const id of QUEST_ORDER){ const Q = QUESTS[id], qs = quests[id]; if(Q.turnin === npcId && qs && (qs.state === "ready" || (qs.state === "active" && Q.obj.type === "deliver"))) return { quest: id, state: "complete" }; }
  for(const id of QUEST_ORDER){ const Q = QUESTS[id], qs = quests[id]; if(Q.giver === npcId && (!qs || qs.state === "failed") && prereqOk(Q)) return { quest: id, state: "offer" }; }
  for(const id of QUEST_ORDER){ const Q = QUESTS[id], qs = quests[id]; if(qs && qs.state === "active" && Q.giver === npcId) return { quest: id, state: "progress" }; }
  for(const id of QUEST_ORDER){ const Q = QUESTS[id], qs = quests[id]; if(qs && qs.state === "active" && Q.turnin === npcId) return { quest: id, state: "waiting" }; }
  for(const id of [...QUEST_ORDER].reverse()){ const Q = QUESTS[id], qs = quests[id]; if(qs && qs.state === "done" && (Q.turnin === npcId || Q.giver === npcId)) return { quest: id, state: "done" }; }
  return { quest: null, state: "idle" };
}
/* ---------- Skill tree: shared by the host simulation and the HUD ---------- */
const TALENT = { power: { max: 3, per: .12 }, haste: { max: 3, per: .08 }, mastery: { max: 1 }, vit: { max: 3, per: .08 }, might: { max: 3, per: .06 } };
const MASTERY = {
  bolt: "Fires two extra bolts in a spread", hook: "Stuns twice as long", dash: "50% more range and 30% more damage", leap: "Landing area is 40% larger",
  blink: "Also blasts the spot you leave and where you land", aoe: "35% larger and lands 30% faster", cone: "40° wider and slows everything hit", spin: "Spins two extra times",
  shield: "60% stronger and breaks stuns, roots and slows", heal: "Heals 50% more", steroid: "Lasts 50% longer", field: "25% larger and lasts 50% longer",
  summon: "Summons two allies instead of one", stealth: "Your first attack out of stealth deals 150% bonus damage", orbit: "Adds a fourth orb",
};
const SLOTS = ["Q", "W", "E", "R"];
function newTalents(){ const t = { core: { vit: 0, might: 0 } }; for(const k of SLOTS) t[k] = { power: 0, haste: 0, mastery: 0 }; return t; }
function talentsSpent(t){ let n = t.core.vit + t.core.might; for(const k of SLOTS) n += t[k].power + t[k].haste + t[k].mastery; return n; }
function talentPoints(lvl, t){ return (lvl - 1) - talentsSpent(t); }
function canTalent(lvl, t, slot, node){
  if(talentPoints(lvl, t) <= 0) return false;
  if(slot === "core") return (node === "vit" || node === "might") && t.core[node] < TALENT[node].max;
  if(!SLOTS.includes(slot) || !t[slot] || !(node in t[slot])) return false;
  if(t[slot][node] >= TALENT[node].max) return false;
  if(node === "mastery" && t[slot].power + t[slot].haste < 3) return false;
  return true;
}
function applyTalents(base, tal){
  const p = Object.assign({}, base, { cc: Object.assign({}, base.cc) });
  if(!tal) return p;
  const pw = 1 + TALENT.power.per * tal.power;
  if(p.dmg) p.dmg *= pw; if(p.amount) p.amount *= pw; if(p.onHit) p.onHit *= pw; if(p.as) p.as *= pw;
  p.cd = Math.round(base.cd * (1 - TALENT.haste.per * tal.haste) * 10) / 10;
  if(tal.mastery){
    switch(p.type){
      case "bolt": p.extra = 2; break;
      case "hook": p.cc.stun = (p.cc.stun || .5) * 2; break;
      case "dash": p.range *= 1.5; p.dmg *= 1.3; break;
      case "leap": p.radius *= 1.4; break;
      case "blink": p.origin = true; if(!p.dmg) p.dmg = 60 * pw; p.radius = p.radius || 250; break;
      case "aoe": p.radius *= 1.35; p.delay *= .7; break;
      case "cone": p.angle += 40; p.cc.slow = Math.max(p.cc.slow || 0, .4); break;
      case "spin": p.ticks += 2; p.dur *= 1.4; break;
      case "shield": p.amount *= 1.6; p.cleanse = true; break;
      case "heal": p.amount *= 1.5; break;
      case "steroid": p.dur *= 1.5; break;
      case "field": p.radius *= 1.25; p.dur *= 1.5; break;
      case "summon": p.count = 2; break;
      case "stealth": p.ambush = true; break;
      case "orbit": p.orbs = 4; break;
    }
  }
  return p;
}
const POIS = [
  { name: "Sunhollow Village", x: VILLAGE.x, y: VILLAGE.y - 650 }, { name: "Pasture", x: PASTURE.x, y: PASTURE.y + 1050 },
  { name: "Bramblewood Hollow", x: DEN.x, y: DEN.y + 800 }, { name: "Kaela's Camp", x: CAMP.x - 650, y: CAMP.y - 120 },
  { name: "Merrin's Cabin", x: CABIN.x + 150, y: CABIN.y - 450 }, { name: "Stillwater Pond", x: POND.x, y: POND.y - 780 },
  { name: "Howling Pines", x: PINES.x, y: PINES.y - 900 }, { name: "Old Watchtower", x: TOWER.x + 900, y: TOWER.y + 150 },
  { name: "Greywind Pass", x: PASS.x + 1000, y: PASS.y + 250 }, { name: "Highwatch Outpost", x: OUTPOST.x + 1100, y: OUTPOST.y - 150 },
  { name: "Ramsfoot Meadow", x: RAM_MEADOW.x, y: RAM_MEADOW.y + 1050 }, { name: "Whitefang Ridge", x: LYNX_RIDGE.x, y: LYNX_RIDGE.y + 950 },
  { name: "Skyreach Overlook", x: SUMMIT.x, y: SUMMIT.y + 450 },
];
const MOBS = {
  sheep: { name: "Sheep", lvl: 1, r: 45, hp: 140, dmg: 6, atkCd: 1.6, ms: 260, wander: 110, xp: 22, respawn: 12, leash: 1500, home: [PASTURE.x, PASTURE.y], roam: PASTURE.r - 180, count: 9 },
  boar: { name: "Old Tusker", lvl: 5, r: 85, hp: 1700, dmg: 34, atkCd: 1.7, ms: 290, wander: 80, xp: 150, respawn: 25, leash: 1500, home: [DEN.x, DEN.y], roam: 300, count: 1, elite: true, charge: true },
  wolf: { name: "Gray Wolf", lvl: 4, r: 52, hp: 360, dmg: 15, atkCd: 1.3, ms: 330, wander: 120, xp: 45, respawn: 16, leash: 1900, home: [PINES.x, PINES.y], roam: PINES.r, count: 7, aggroR: 420, pack: true },
  ram: { name: "Crag Ram", lvl: 10, r: 60, hp: 1050, dmg: 30, atkCd: 1.6, ms: 300, wander: 120, xp: 95, respawn: 18, leash: 1700, home: [RAM_MEADOW.x, RAM_MEADOW.y], roam: RAM_MEADOW.r - 150, count: 9, charge: true },
  lynx: { name: "Snowfang Lynx", lvl: 12, r: 55, hp: 980, dmg: 36, atkCd: 1.2, ms: 360, wander: 130, xp: 115, respawn: 16, leash: 1800, home: [LYNX_RIDGE.x, LYNX_RIDGE.y], roam: LYNX_RIDGE.r, count: 10, aggroR: 460 },
  bandit: { name: "Vale Bandit", lvl: 6, r: 55, hp: 400, dmg: 19, atkCd: 1.4, ms: 300, wander: 100, xp: 60, respawn: 0, leash: 99999, home: [TOWER.x, TOWER.y], roam: 300, count: 0, aggroR: 900 },
};
const clampX = v => Math.max(ZMIN, Math.min(ZMAX, v));
const clampY = v => Math.max(ZMIN, Math.min(WH - ZMIN, v));

/* ---------- Items: loot tables, armor generation, inventory ---------- */
const BAG_SIZE = 20;
const EQ_SLOTS = ["head", "chest", "hands", "legs", "feet", "weapon"];
const ARMOR_SLOTS = ["head", "chest", "hands", "legs", "feet"];
const SLOT_NAME = { head: "Head", chest: "Chest", hands: "Hands", legs: "Legs", feet: "Feet", weapon: "Weapon" };
const RARITY = [{ n: "Common", c: "#d8d8d8", m: 1 }, { n: "Uncommon", c: "#3fd16a", m: 1.4 }, { n: "Rare", c: "#4d9dff", m: 1.9 }, { n: "Epic", c: "#b45cff", m: 2.6 }];
const STAT = {
  hp: { w: 8, line: v => `+${v} Health`, short: "Health" }, ad: { w: 1, line: v => `+${v} Attack Damage`, short: "Attack" },
  ap: { w: .8, line: v => `+${v}% Ability Damage`, short: "% Ability" }, armor: { w: 1.5, line: v => `+${v} Armor`, short: "Armor" },
  haste: { w: .5, line: v => `+${v}% Cooldown Reduction`, short: "% Haste" }, ms: { w: .5, line: v => `+${v}% Movement Speed`, short: "% Speed" },
};
const MATERIAL = {
  cloth: { label: "Cloth", stats: ["ap", "haste", "hp", "ms"], names: ["Frayed", "Woven", "Silken", "Starweave"], color: ["#7c6aa0", "#6a4fb0", "#4f6ad0", "#a04fd0"] },
  leather: { label: "Leather", stats: ["ad", "ms", "hp", "haste"], names: ["Worn", "Tanned", "Hardened", "Shadowhide"], color: ["#7a5a3a", "#8a6234", "#6a4a2a", "#4a3050"] },
  plate: { label: "Plate", stats: ["armor", "hp", "ad", "haste"], names: ["Dented", "Iron", "Steel", "Valor"], color: ["#7d8794", "#9aa6b8", "#c0ccdc", "#d8c27a"] },
};
const BASE_NAMES = { head: { cloth: "Hood", leather: "Cap", plate: "Helm" }, chest: { cloth: "Robe", leather: "Jerkin", plate: "Breastplate" }, hands: { cloth: "Gloves", leather: "Grips", plate: "Gauntlets" }, legs: { cloth: "Trousers", leather: "Leggings", plate: "Legplates" }, feet: { cloth: "Sandals", leather: "Boots", plate: "Sabatons" } };
const WEAPON_NAMES = { melee: { base: ["Shortsword", "Blade", "Longsword"], pre: ["Rusty", "Sturdy", "Fine", "Runed"], wt: "sword" }, caster: { base: ["Rod", "Staff", "Spire"], pre: ["Cracked", "Oak", "Carved", "Runed"], wt: "staff" }, ranged: { base: ["Shortbow", "Bow", "Longbow"], pre: ["Warped", "Ash", "Recurve", "Runed"], wt: "bow" } };
const SUFFIX = { hp: "of the Bear", ad: "of the Tiger", ap: "of the Owl", armor: "of the Turtle", haste: "of Swiftness", ms: "of the Fox" };
const CLASS_MAT = { melee: "plate", caster: "cloth", ranged: "leather" };
const MATERIALS = { wool: { n: "Tuft of Wool", v: 3 }, pelt: { n: "Wolf Pelt", v: 9 }, hide: { n: "Thick Boar Hide", v: 25 }, horn: { n: "Curled Ram Horn", v: 22 }, frostpelt: { n: "Snowfang Pelt", v: 30 } };
const LOOT = {
  sheep: { coins: [1, 4], mat: ["wool", .7], gear: .12, ilvl: 2 },
  wolf: { coins: [4, 10], mat: ["pelt", .6], gear: .22, ilvl: 4 },
  bandit: { coins: [10, 24], mat: null, gear: .32, ilvl: 6 },
  ram: { coins: [18, 34], mat: ["horn", .6], gear: .25, ilvl: 11 },
  lynx: { coins: [20, 40], mat: ["frostpelt", .55], gear: .28, ilvl: 12 },
  boar: { coins: [40, 70], mat: ["hide", 1], gear: 1, minRarity: 2, epic: .15, ilvl: 5 },
};
function rollRarity(min, epic){ const r = Math.random(); const v = r < .01 + (epic || 0) ? 3 : r < .12 ? 2 : r < .45 ? 1 : 0; return Math.max(min || 0, v); }
function genItem(o){
  const r = Math.max(0, Math.min(3, o.rarity)), cls = o.cls || "melee", slot = o.slot || EQ_SLOTS[Math.floor(Math.random() * EQ_SLOTS.length)];
  const mat = slot === "weapon" ? CLASS_MAT[cls] : (Math.random() < .55 ? CLASS_MAT[cls] : ["cloth", "leather", "plate"][Math.floor(Math.random() * 3)]);
  const M = MATERIAL[mat], nStats = Math.min(4, r + 1);
  const budget = (5 + o.ilvl * 2.2) * RARITY[r].m * (slot === "weapon" ? 1.3 : slot === "chest" || slot === "legs" ? 1.15 : 1);
  const pool = slot === "weapon" ? (cls === "caster" ? ["ap", "haste", "hp", "ms"] : ["ad", "haste", "hp", "ms"]) : M.stats;
  const keys = [pool[0]], rest = pool.slice(1).sort(() => Math.random() - .5);
  while(keys.length < nStats) keys.push(rest.shift());
  const shares = keys.map((k, i) => i === 0 ? 1.6 : .7 + Math.random() * .6), tot = shares.reduce((a, b) => a + b, 0), st = {};
  keys.forEach((k, i) => { st[k] = Math.max(1, Math.round(budget * shares[i] / tot * STAT[k].w)); });
  let n;
  if(slot === "weapon"){ const WN = WEAPON_NAMES[cls]; n = `${WN.pre[r]} ${WN.base[Math.min(2, Math.floor(o.ilvl / 3))]}`; }
  else n = `${M.names[r]} ${BASE_NAMES[slot][mat]}`;
  if(r >= 2 && keys[1]) n += ` ${SUFFIX[keys[1]]}`;
  return { id: "i" + o.nid, n, s: slot, r, m: mat, st, il: o.ilvl, v: Math.round((o.ilvl * 3 + 5) * Math.pow(r + 1, 1.6)), color: M.color[r], wt: slot === "weapon" ? WEAPON_NAMES[cls].wt : null };
}
function makeMat(key, nid){ const M = MATERIALS[key]; return { id: "i" + nid, n: M.n, s: "mat", key, r: 0, q: 1, v: M.v, stack: true }; }
function fmtCoins(c){
  c = Math.max(0, Math.round(c || 0));
  const g = Math.floor(c / 10000), si = Math.floor(c % 10000 / 100), co = c % 100, out = [];
  if(g) out.push(g + "g"); if(si) out.push(si + "s"); if(co || !out.length) out.push(co + "c");
  return out.join(" ");
}
function shade(hex, f){
  const n = parseInt(hex.slice(1), 16), r = Math.min(255, Math.round((n >> 16 & 255) * f)), g = Math.min(255, Math.round((n >> 8 & 255) * f)), b = Math.min(255, Math.round((n & 255) * f));
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
function gearLook(equip){
  const e = equip || {}, gear = {};
  if(e.chest){ gear.tunic = e.chest.color; gear.dark = shade(e.chest.color, .62); }
  if(e.legs) gear.pants = shade(e.legs.color, .78);
  if(e.feet) gear.boots = shade(e.feet.color, .55);
  if(e.hands) gear.gloves = e.hands.color;
  return { gear, helm: e.head ? e.head.color : null, sig: EQ_SLOTS.map(sl => e[sl] ? e[sl].id : "").join(",") };
}
function applyLook(art, equip){
  const L = gearLook(equip);
  if(art.o.gearSig === L.sig) return false;
  art.o.gear = L.gear; art.o.helm = L.helm; art.o.gearSig = L.sig; art.key = ""; return true;
}
const iconCache = new Map();
function itemIconURL(it){
  const key = `${it.s}|${it.m || ""}|${it.r}|${it.key || ""}|${it.wt || ""}|${it.color || ""}|${it.glow ? 1 : 0}`;
  if(iconCache.has(key)) return iconCache.get(key);
  const c = document.createElement("canvas"); c.width = c.height = 48; const g = c.getContext("2d");
  const grd = g.createRadialGradient(24, 20, 4, 24, 24, 30); grd.addColorStop(0, "#26324a"); grd.addColorStop(1, "#0b0f17");
  g.fillStyle = grd; g.fillRect(0, 0, 48, 48);
  const col = it.color || "#b8a68a", dk = shade(col, .55), lt = shade(col, 1.3);
  g.lineWidth = 2; g.strokeStyle = "#0b0f17"; g.lineJoin = "round";
  const P = (pts, fill) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fillStyle = fill; g.fill(); g.stroke(); };
  if(it.s === "head"){ g.beginPath(); g.arc(24, 27, 14, Math.PI, 0); g.lineTo(38, 32); g.lineTo(10, 32); g.closePath(); g.fillStyle = col; g.fill(); g.stroke(); P([[8, 32], [40, 32], [40, 36], [8, 36]], dk); g.fillStyle = lt; g.fillRect(17, 18, 4, 8); }
  else if(it.s === "chest"){ P([[12, 10], [20, 8], [24, 12], [28, 8], [36, 10], [42, 20], [36, 22], [35, 40], [13, 40], [12, 22], [6, 20]], col); P([[22, 14], [26, 14], [26, 38], [22, 38]], dk); }
  else if(it.s === "hands"){ P([[14, 18], [30, 18], [32, 40], [12, 40]], col); for(let i = 0; i < 4; i++) P([[13 + i * 5, 8], [17 + i * 5, 8], [17 + i * 5, 19], [13 + i * 5, 19]], col); P([[30, 22], [38, 18], [40, 22], [32, 30]], col); P([[12, 34], [32, 34], [32, 40], [12, 40]], dk); }
  else if(it.s === "legs"){ P([[12, 8], [36, 8], [37, 42], [27, 42], [24, 20], [21, 42], [11, 42]], col); P([[12, 8], [36, 8], [36, 13], [12, 13]], dk); }
  else if(it.s === "feet"){ P([[14, 8], [26, 8], [26, 30], [40, 32], [40, 40], [12, 40]], col); P([[12, 36], [40, 36], [40, 40], [12, 40]], dk); }
  else if(it.s === "weapon"){
    const glow = it.glow ? (it.wt === "staff" ? "#c98cff" : it.wt === "bow" ? "#8cff9a" : "#ffb347") : null;
    if(glow){ g.shadowColor = glow; g.shadowBlur = 10; }
    if(it.wt === "staff"){ P([[22, 12], [26, 12], [26, 44], [22, 44]], "#8a6440"); g.beginPath(); g.arc(24, 9, 6, 0, Math.PI * 2); g.fillStyle = glow || "#9fe6ff"; g.fill(); g.stroke(); }
    else if(it.wt === "bow"){ g.beginPath(); g.arc(14, 24, 18, -1.2, 1.2); g.lineWidth = 5; g.strokeStyle = "#0b0f17"; g.stroke(); g.lineWidth = 3; g.strokeStyle = glow || "#a87a4a"; g.stroke(); g.lineWidth = 1; g.strokeStyle = "#e8e2d0"; g.beginPath(); g.moveTo(20.5, 7); g.lineTo(20.5, 41); g.stroke(); }
    else { P([[30, 6], [36, 6], [36, 12], [16, 32], [12, 28]], glow ? "#fff3d6" : "#d7dde6"); P([[10, 30], [18, 38], [15, 41], [7, 33]], "#c9a55c"); P([[10, 38], [14, 42], [9, 46], [5, 42]], "#5a3a22"); }
    g.shadowBlur = 0;
  }
  else if(it.key === "wool"){ g.fillStyle = "#f4f1ea"; [[18, 26, 9], [28, 22, 10], [32, 30, 8], [22, 32, 8]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }); }
  else if(it.key === "horn"){ g.lineWidth = 9; g.strokeStyle = "#0b0f17"; g.beginPath(); g.arc(24, 24, 12, -2.4, 2.2); g.stroke(); g.lineWidth = 6; g.strokeStyle = "#d8ccb0"; g.stroke(); }
  else { const pc = { pelt: ["#8a8580", "#a8a29a"], frostpelt: ["#d8d4ca", "#f2efe8"] }[it.key] || ["#6a4428", "#8a5a32"]; P([[10, 14], [20, 10], [28, 12], [38, 10], [40, 22], [36, 36], [26, 40], [14, 38], [8, 26]], pc[0]); P([[16, 18], [32, 18], [30, 32], [18, 32]], pc[1]); }
  g.lineWidth = 3; g.strokeStyle = RARITY[it.r].c; g.strokeRect(1.5, 1.5, 45, 45);
  const url = c.toDataURL(); iconCache.set(key, url); return url;
}
