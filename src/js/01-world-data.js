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
const BEACON_TEXT = { quest: "beacons", verb: "Lighting", idle: "A cold signal beacon. Captain Rhea might know what it's for.", done: "This beacon is already burning." };
const BEACONS = [{ name: "West Beacon", x: 1450, y: 4400 }, { name: "North Beacon", x: 5300, y: 6950 }, { name: "South Beacon", x: 6850, y: 1500 }].map(b => ({ ...b, ...BEACON_TEXT }));
const WAVES = [2, 2, 3, 3];
const PASS = { x: 4100, y: ZS, w: 330 };       // Greywind Pass, the gap in the ridge between the zones
const WELL = [4000, 3750], CAMPFIRE = [4380, 3380];
const ARENA = { x: 5500, y: 3700, r: 650 };   // the Champion's Ring, a duelling yard east of the village
const STALL = { x: 4150, y: 4140 };          // Peddler Osric's market stall, just behind him
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
const BRAZIER = [4300, 9250];
const MINE = { x: 1400, y: 12300, r: 600 };       // Hollowdeep Mine (far west), overrun by craglings
const KETIL_CAMP = { x: 2750, y: 12250 };         // Old Ketil's tent outside the mine
const LAKE = { x: 6450, y: 13250, r: 520 };       // Glassmere, a frozen lake (east)
const YETI_DEN = { x: 5500, y: 10300, r: 420 };   // Whitemane's Hollow
const YRSA_CAMP = { x: 3850, y: 12800 };          // Yrsa's Watch, the scouts' camp below the lair
const LAIR = { x: 3000, y: 14100, r: 850 };       // The Wyrm's Crown, Skarnvir's lair (north-west)
const DELVE = [{ name: "the Mine Mouth", x: 1750, y: 12050 }, { name: "the Old Lift", x: 1150, y: 12700 }, { name: "the Deep Shaft", x: 950, y: 12100 }];
const RUNE_TEXT = { quest: "wards", verb: "Awakening", idle: "An old runestone, cold to the touch. Scout Yrsa might know what it's for.", done: "This rune is already glowing." };
const RUNES = [{ name: "Rune of Stillness", x: 3750, y: 13600 }, { name: "Rune of Silence", x: 2150, y: 13350 }, { name: "Rune of Binding", x: 3950, y: 14550 }].map(r => ({ ...r, ...RUNE_TEXT }));
// everything a player can right-click to use for a quest; `use` commands index into this list
const USE_POINTS = [...BEACONS, ...RUNES];
// gathering nodes: each kind grows in a ring around a spot; collect quests name the kind they need
const NODE_INFO = { herb: { name: "Sunpetal", idle: "A pretty flower. Someone might have a use for it." }, ore: { name: "Glimmerstone", idle: "A vein of glittering stone. A miner might want it." }, frostbloom: { name: "Frostbloom", idle: "A pale blue flower, cold as ice. A healer might want it." } };
const PEAK_PATHS = [
  [[PASS.x, ZS - 1], [4150, 8700], [OUTPOST.x, OUTPOST.y]],
  [[OUTPOST.x, OUTPOST.y], [3950, 11000], [4350, 12900], [SUMMIT.x, SUMMIT.y]],
  [[OUTPOST.x, OUTPOST.y], [3300, 10200], [RAM_MEADOW.x, RAM_MEADOW.y]],
  [[3950, 11000], [4900, 11500], [LYNX_RIDGE.x, LYNX_RIDGE.y]],
  [[RAM_MEADOW.x, RAM_MEADOW.y], [1900, 11750], [MINE.x + 250, MINE.y - 150]],
  [[LYNX_RIDGE.x, LYNX_RIDGE.y], [6050, 12300], [LAKE.x, LAKE.y - LAKE.r]],
  [[OUTPOST.x, OUTPOST.y], [4900, 9900], [YETI_DEN.x, YETI_DEN.y]],
  [[4350, 12900], [3700, 13300], [LAIR.x + 300, LAIR.y - 300]],
];
// big rock spires inside the zone (solid, and drawn as peaks)
const CRAGS = [[650, 13950, 520], [6450, 9700, 520], [2600, 9100, 420], [6900, 14650, 580], [5300, 13700, 380], [1600, 15200, 450]];
// the ridge between the zones: a wall of rock everywhere except the pass
const RIDGE = []; for(let x = 500; x <= ZS - 500; x += 300) if(Math.abs(x - PASS.x) > PASS.w + 430) RIDGE.push({ x, y: ZS, r: 430 });
const PEAK_OBSTACLES = [...RIDGE, ...CRAGS.map(([x, y, r]) => ({ x, y, r: r * .8 })),
  { x: PASS.x - PASS.w - 330, y: ZS, r: 330 }, { x: PASS.x + PASS.w + 330, y: ZS, r: 330 },
  { x: BRAZIER[0], y: BRAZIER[1], r: 80 }, { x: OUTPOST.x - 260, y: OUTPOST.y + 230, r: 170 }, { x: OUTPOST.x + 300, y: OUTPOST.y + 180, r: 170 },
  { x: KETIL_CAMP.x + 120, y: KETIL_CAMP.y + 60, r: 150 }, { x: YRSA_CAMP.x - 120, y: YRSA_CAMP.y + 40, r: 150 },
  ...RUNES.map(r => ({ x: r.x, y: r.y, r: 70 }))];
const YRSA_FIRE = [YRSA_CAMP.x + 130, YRSA_CAMP.y - 60];
const FIRES = [CAMPFIRE, BRAZIER, YRSA_FIRE];
const NODE_SPOTS = [
  { kind: "herb", x: HERB_AREA.x, y: HERB_AREA.y, rmin: 720, rmax: 1100, n: 10 },
  { kind: "ore", x: MINE.x, y: MINE.y, rmin: 150, rmax: 620, n: 10 },
  { kind: "frostbloom", x: LAKE.x, y: LAKE.y, rmin: LAKE.r + 60, rmax: LAKE.r + 380, n: 10 },
];
/* ---------- The Ashen Cathedral (dungeon, reached through the Rift in the Wyrm's Crown) ---------- */
// It sits in its own zone north of the Peaks (y 16000–24000) and can only be reached by portal.
// Walkable space is a set of rooms (x0, y0, x1, y1) that overlap by 400 so even big units pass between them;
// walls are whatever lies outside them (SIM.bound).
const DZ = WH;                                             // the cathedral zone starts where the Peaks end
const CATHEDRAL = {
  narthex: [3200, 17600, 4800, 19000],                     // the entrance hall
  nave: [3000, 18600, 5000, 21500],                        // the long pillared hall
  transept: [1100, 21100, 6900, 22600],                    // the crossing, with a chapel at each end
  choir: [2900, 22200, 5100, 23350],                       // the sealed choir where the Ashen Saint waits
  arrive: [4000, 18150],                                   // where the Rift sets you down
  exit: { x: 4000, y: 17800 },                             // the way back out, to Yrsa's Watch
  door: 22600,                                             // the seal across the choir (y)
  west: { x: 1700, y: 22000 }, east: { x: 6300, y: 22000 }, altar: { x: 4000, y: 23000 },
  resetAfter: 90,                                          // seconds with nobody inside before everything comes back
};
const CATHEDRAL_ROOMS = ["narthex", "nave", "transept", "choir"];
const PILLARS = []; for(const y of [19000, 19600, 20200, 20800]) for(const x of [3380, 4620]) PILLARS.push({ x, y, r: 90 });
const RIFT = { x: LAIR.x - 150, y: LAIR.y + 620, r: 170 }; // the Rift Skarnvir's death tears open in the Crown
// elite packs (a pack pulls together) and the three bosses
const CATHEDRAL_SPAWNS = [
  ...[["monk", 3820, 19350], ["monk", 4180, 19350], ["acolyte", 4000, 19560]].map(s => [...s, "A"]),
  ...[["monk", 3800, 20500], ["monk", 4200, 20500], ["acolyte", 3880, 20720], ["acolyte", 4120, 20720]].map(s => [...s, "B"]),
  ...[["monk", 2700, 21800], ["monk", 2700, 22200], ["acolyte", 2450, 22000]].map(s => [...s, "C"]),
  ...[["monk", 5300, 21800], ["monk", 5300, 22200], ["acolyte", 5550, 22000]].map(s => [...s, "D"]),
  ...[["monk", 3780, 22050], ["monk", 4220, 22050], ["acolyte", 3900, 22300], ["acolyte", 4100, 22300]].map(s => [...s, "E"]),
  ["deacon", CATHEDRAL.west.x, CATHEDRAL.west.y, ""], ["abbess", CATHEDRAL.east.x, CATHEDRAL.east.y, ""], ["saint", CATHEDRAL.altar.x, CATHEDRAL.altar.y, ""],
].map(([kind, x, y, pack], i) => ({ id: "cs" + i, kind, x, y, pack }));
// Every zone: a key, its name, and its area in world units (x0, y0 is the south-west corner).
// New zones go here; the minimap and world map draw whatever is in this list.
const ZONES = [
  { key: "vale", name: "Sunhollow Vale", x0: 0, y0: 0, w: ZS, h: ZS },
  { key: "peaks", name: "Frostspine Peaks", x0: 0, y0: ZS, w: ZS, h: ZS },
  { key: "cathedral", name: "The Ashen Cathedral", x0: 0, y0: DZ, w: ZS, h: ZS, dungeon: true },
];
const zoneAt = (y, x = ZS / 2) => ZONES.find(z => x >= z.x0 && x < z.x0 + z.w && y >= z.y0 && y < z.y0 + z.h) || ZONES[y >= ZS ? ZONES.length - 1 : 0];
const ZONE_PICS = {}; // each zone's map picture (a canvas), keyed like ZONES; filled in when the scene is built
const NPCS = [
  { id: "bram", name: "Farmer Bram", x: 3720, y: 3480, head: "farmer", style: "farmer", idle: "Fine weather for honest work. Mind the flock on your way out." },
  { id: "kaela", name: "Huntress Kaela", x: 5790, y: 5190, head: "huntress", style: "hunter", idle: "Keep your voice down out here. Sound carries in the Bramblewood." },
  { id: "merrin", name: "Old Merrin", x: 1440, y: 2960, head: "fisher", style: "fisher", idle: "Westwind's blowing. Good day to mend nets and not much else." },
  { id: "rhea", name: "Captain Rhea", x: 4350, y: 3780, head: "guard", style: "guard", idle: "The Vale is quiet. I intend to keep it that way." },
  { id: "osric", name: "Peddler Osric", title: "Potions", x: 4150, y: 4000, head: "merchant", style: "merchant", shop: ["hpot"], idle: "Potions! Fresh potions! Brewed this morning, and only slightly fizzy." },
  { id: "vex", name: "Arenamaster Vex", title: "Practice duels", x: 4730, y: 3640, head: "gladiator", style: "gladiator", arena: true, idle: "Steel sharpens steel. Step into the ring." },
  { id: "halvard", name: "Warden Halvard", x: 4010, y: 9560, head: "warden", style: "warden", idle: "Keep your fire lit and your back to the rock. The mountain forgives nothing." },
  { id: "maren", name: "Sister Maren", x: 3980, y: 9300, head: "healer", style: "healer", idle: "Cold hands, warm heart, my mother used to say. Mostly cold hands, up here." },
  { id: "ketil", name: "Old Ketil", x: KETIL_CAMP.x - 200, y: KETIL_CAMP.y - 150, head: "miner", style: "miner", idle: "Forty years I dug that mine. Forty years, and now a pack of walking pebbles has the run of it." },
  { id: "yrsa", mercs: ["rimewyrm"], name: "Scout Yrsa", x: YRSA_CAMP.x + 150, y: YRSA_CAMP.y - 180, head: "huntress", style: "hunter", idle: "Keep low, keep quiet. He can hear a boot crack the ice from the top of the Crown." },
  { id: "elowen", mercs: ["censer", "silentvow", "ashensaint"], name: "Sister Elowen", x: 3520, y: 18350, head: "healer", style: "healer", idle: "The Choir sang beneath this mountain for three hundred years. Now it only burns." },
];
const OBSTACLES = [
  ...HOUSES.map(h => ({ x: h[0], y: h[1], r: 270 })),
  { x: WELL[0], y: WELL[1], r: 90 }, { x: CAMPFIRE[0], y: CAMPFIRE[1], r: 80 },
  ...NPCS.filter(n => !n.shop).map(n => ({ x: n.x, y: n.y, r: 55 })), // vendors are covered by their stall
  { x: CAMP.x, y: CAMP.y, r: 190 }, { x: CABIN.x, y: CABIN.y, r: 250 }, { x: TOWER.x, y: TOWER.y, r: 220 },
  ...BEACONS.map(b => ({ x: b.x, y: b.y, r: 70 })), ...LOOKOUTS.map(p => ({ x: p.x, y: p.y, r: 55 })),
  ...PEAK_OBSTACLES, ...PILLARS, { x: STALL.x, y: STALL.y - 50, r: 150 }, // one circle around the stall and its vendor, so there's no corner to get stuck in
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
    obj: { type: "defend", at: TOWER, dur: 60, label: "Hold the Old Watchtower", place: "the Old Watchtower", mob: "bandit", waves: WAVES, from: -Math.PI / 2,
      start: ["Bandits approach!", "Hold the Old Watchtower for 60 seconds"], waveText: "bandits coming up the road", win: ["The watchtower holds!", "Return to Captain Rhea"] },
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
    complete: "Eight pelts' worth. The east trail will be safe for the mules again, and the rest will think twice about coming down. Take this, and my thanks. There's plenty more work up here for someone like you. Sister Maren could use a hand, and Old Ketil has been grumbling about his mine for weeks. He camps west, past Ramsfoot Meadow.",
    done: "The ridge has been quiet since. Good work.",
  },
};
Object.assign(QUESTS, {
  rams: {
    id: "rams", lvl: 10, title: "Thinning the Herd", giver: "halvard", turnin: "halvard", prereq: "lynx", xp: 650, coins: 150, where: [RAM_MEADOW.x, RAM_MEADOW.y], whereR: RAM_MEADOW.r,
    obj: { type: "kill", kind: "ram", count: 8, label: "Crag Rams slain" },
    offer: "The crag rams in Ramsfoot Meadow have been charging our supply sledges off the trail. Lost a whole load of flour over the edge last week. Cull the herd. Eight of them. Mind the horns: they'll back off, then come at you like a battering ram.",
    objective: "Slay 8 Crag Rams in Ramsfoot Meadow, west of Highwatch.",
    progress: "Eight rams, out in Ramsfoot Meadow. When one lowers its head, get out of the way.",
    complete: "Ha! The sledges will run in peace. Good meat, too. The cook thanks you, and so do I.",
    done: "The meadow's been quiet. Well, quieter.",
  },
  delve: {
    id: "delve", lvl: 11, title: "Into the Hollowdeep", giver: "ketil", turnin: "ketil", prereq: "lynx", xp: 650,
    obj: { type: "explore", points: DELVE, count: 3, label: "Mine sites scouted" },
    offer: "You! You look like you can swing whatever that is. My mine, the Hollowdeep, is crawling with craglings. Little rock-folk, mean as wasps. I need to know how bad it is. Check the Mine Mouth, the Old Lift and the Deep Shaft, and tell me what you see.",
    objective: "Scout the Mine Mouth, the Old Lift and the Deep Shaft in the Hollowdeep Mine.",
    progress: "The Mine Mouth, the Old Lift, the Deep Shaft. Look, don't touch. Well, touch if they touch you first.",
    complete: "Dozens of them? In my shaft? I knew it. I knew it! Right. We're going to need a plan, and you're the plan.",
    done: "My mine. My beautiful mine.",
  },
  craglings: {
    id: "craglings", lvl: 11, title: "Rock and Ruin", giver: "ketil", turnin: "ketil", prereq: "delve", xp: 750, reward: { item: 1 }, where: [MINE.x, MINE.y], whereR: MINE.r,
    obj: { type: "kill", kind: "cragling", count: 10, label: "Craglings smashed" },
    offer: "Craglings. Rock come to life, they say, wherever the mountain's angry. Don't care why. Care that they're in my mine. Smash ten of them and the rest will scatter deeper.",
    objective: "Slay 10 Craglings in the Hollowdeep Mine.",
    progress: "Ten craglings. Hit them where the glow is. That's where they're soft. Well, softer.",
    complete: "Listen to that. Quiet. Beautiful quiet. Take this. I dug it up years ago and never found a use for it.",
    done: "Still quiet. Long may it last.",
  },
  pick: {
    id: "pick", lvl: 11, title: "Ketil's Old Pick", giver: "ketil", turnin: "ketil", prereq: "delve", xp: 600, where: [MINE.x, MINE.y], whereR: MINE.r,
    obj: { type: "loot", from: "cragling", item: "pick", itemName: "Ketil's Old Pick", count: 1, label: "Ketil's Old Pick" },
    offer: "When they came, I ran. Left my pick behind. My father's pick. One of those little thieves took it, I saw it. Get it back for me, would you? Any of them might be carrying it.",
    objective: "Slay Craglings in the Hollowdeep Mine until one drops Ketil's Old Pick, then bring it to him.",
    progress: "Any luck? It's got a crack in the handle and my father's mark on the head.",
    complete: "That's it. That's the one. Feels right in the hand. Thank you. Truly.",
    done: "My father would've liked you.",
  },
  ore: {
    id: "ore", lvl: 12, title: "Glimmerstone", giver: "ketil", turnin: "ketil", prereq: ["craglings", "pick"], xp: 800, coins: 250, reward: { item: 2 }, where: [MINE.x, MINE.y], whereR: MINE.r,
    obj: { type: "collect", node: "ore", count: 8, label: "Glimmerstone mined" },
    offer: "Now that I've got my pick back, I've got an idea. Glimmerstone. Sparkly blue veins in the mine walls. Halvard's smith can forge it into something special. Chip me out eight chunks.",
    objective: "Mine 8 Glimmerstone veins in the Hollowdeep Mine. Walk over them or right-click them.",
    progress: "Eight chunks of glimmerstone. Blue sparkle, can't miss it.",
    complete: "Look at that shine! Here, take your cut, and this. Never say Ketil doesn't pay his debts.",
    done: "Smith says it's the best stone he's seen in years.",
  },
  frostbloom: {
    id: "frostbloom", lvl: 11, title: "Frostbloom", giver: "maren", turnin: "maren", prereq: "lynx", xp: 700, coins: 150, where: [LAKE.x, LAKE.y], whereR: LAKE.r + 350,
    obj: { type: "collect", node: "frostbloom", count: 6, label: "Frostbloom gathered" },
    offer: "Half the outpost has the shivering cough. Frostbloom tea would break it, but it only grows on the shore of Glassmere, the frozen lake east of Whitefang Ridge. Bring me six blossoms. And be careful of the lights over the ice.",
    objective: "Gather 6 Frostbloom on the shore of Glassmere, east of Whitefang Ridge.",
    progress: "Six frostblooms, from the shore of Glassmere. Pale blue, like a winter sky.",
    complete: "Perfect. Still cold. The tea will be ready by nightfall. You're a godsend.",
    done: "The coughing's stopped. Everyone's sleeping again.",
  },
  wisps: {
    id: "wisps", lvl: 12, title: "Lights on the Water", giver: "maren", turnin: "maren", prereq: "frostbloom", xp: 850, reward: { item: 2 }, where: [LAKE.x, LAKE.y], whereR: LAKE.r + 250,
    obj: { type: "kill", kind: "wisp", count: 8, label: "Frost Wisps dispersed" },
    offer: "Those lights on Glassmere. Frost wisps. The cold given a mind of its own. Since the dragon woke, there are more of them every night, and they've started drifting toward the outpost. Disperse eight of them.",
    objective: "Disperse 8 Frost Wisps over Glassmere.",
    progress: "Eight wisps. They're cold to the touch, so fight them quickly.",
    complete: "The lake's dark again. Thank you. Here, I've been saving this for someone who deserved it.",
    done: "No lights on the water tonight.",
  },
  whitemane: {
    id: "whitemane", lvl: 13, title: "Whitemane", giver: "halvard", turnin: "halvard", prereq: ["rams", "ore", "wisps"], xp: 1200, reward: { item: 3, name: "Whitemane's" }, where: [YETI_DEN.x, YETI_DEN.y], whereR: YETI_DEN.r,
    obj: { type: "kill", kind: "yeti", count: 1, label: "Whitemane slain" },
    offer: "You've done more for Highwatch in a week than most do in a lifetime. One more thing, then. Whitemane. The elder yeti of the hollow east of here. He's been raiding our stores, and last night he tore the gate off its hinges. He's old, and he's huge, and when he roars he charges. Bring a friend if you can.",
    objective: "Slay Whitemane, the elder yeti, in Whitemane's Hollow east of Highwatch. He's an elite: bring friends if you can.",
    progress: "Whitemane, in the hollow to the east. When he roars, move.",
    complete: "Whitemane, dead. I never thought I'd see the day. There's something else, though. Scout Yrsa sent word from her watch below the Wyrm's Crown, to the north. Something big has woken up there. Go and see her.",
    done: "The gate's back on its hinges. Thanks to you.",
  },
  wards: {
    id: "wards", lvl: 13, title: "The Warding Runes", giver: "yrsa", turnin: "yrsa", prereq: "whitemane", xp: 900,
    obj: { type: "interact", points: RUNES, count: 3, label: "Runes awakened" },
    offer: "Halvard sent you? Good. Listen. There's a dragon on the Crown. Skarnvir, the Rimewyrm. He slept for three hundred years and now he's awake and hungry. The old wardens left three runestones around his lair. If we wake them, they'll keep him from leaving. Awaken all three, but don't go into the Crown itself.",
    objective: "Awaken the Runes of Stillness, Silence and Binding around the Wyrm's Crown. Right-click a rune and hold still while it wakes.",
    progress: "Three runes, around the edge of the Crown. Right-click one and hold still. And stay out of the ring.",
    complete: "Can you feel it? The air's gone still. He's trapped up there now. Which means he's angry.",
    done: "The runes are holding. For now.",
  },
  brood: {
    id: "brood", lvl: 13, title: "The Wyrm's Brood", giver: "yrsa", turnin: "yrsa", prereq: "wards", xp: 1100, reward: { item: 3 }, where: [YRSA_CAMP.x, YRSA_CAMP.y], whereR: 550,
    obj: { type: "defend", at: YRSA_CAMP, dur: 60, label: "Hold Yrsa's Watch", place: "Yrsa's Watch", mob: "whelp", waves: [2, 3, 3, 4], from: Math.atan2(LAIR.y - YRSA_CAMP.y, LAIR.x - YRSA_CAMP.x),
      start: ["The brood is coming!", "Hold Yrsa's Watch for 60 seconds"], waveText: "frost whelps diving from the Crown", win: ["The watch holds!", "Speak to Scout Yrsa"] },
    offer: "Here they come. He's sent his whelps to sniff out who woke the runes. If they find the camp, they'll bring him down on us. Stand with me. Hold the watch for one minute and they'll lose heart.",
    objective: "Defend Yrsa's Watch from frost whelps for 60 seconds. Don't leave the camp.",
    progress: "Hold the watch. One minute. Don't let them past.",
    complete: "We held! He knows we're here now, though. There's only one thing left to do.",
    done: "Nothing gets past this watch.",
    fail: "You left the watch. Speak to Scout Yrsa to try again.",
  },
  rimewyrm: {
    id: "rimewyrm", lvl: 15, title: "Skarnvir the Rimewyrm", giver: "yrsa", turnin: "yrsa", prereq: "brood", xp: 3000, coins: 2000, reward: "legendary", raid: true, where: [LAIR.x, LAIR.y], whereR: LAIR.r,
    obj: { type: "kill", kind: "dragon", count: 1, label: "Skarnvir slain" },
    offer: "This is it. Skarnvir. No one can face him alone: his scales turn aside a lone blade like it's straw. You'll need a party of at least three. Someone sturdy to hold his attention, someone to keep them alive, and someone to do the damage. Stay out of his breath, stay away from his tail, and kill his whelps. Bring me his heart.",
    objective: "Raid boss: slay Skarnvir the Rimewyrm in the Wyrm's Crown. Needs a party of at least 3: a tank (melee champions hold his attention best), a healer, and damage dealers.",
    progress: "He's up on the Crown. Gather your party: three at least, five if you can.",
    complete: "You did it. You actually did it. The Rimewyrm is dead! They'll sing about this in Sunhollow for a hundred years. Here. Forged from his own fang. It's yours.",
    done: "Skarnvir is dead. The mountain sleeps easy.",
  },
  censer: {
    id: "censer", lvl: 16, title: "The Censer-Bearer", giver: "elowen", turnin: "elowen", prereq: "rimewyrm", xp: 2600, coins: 800, dungeon: true, where: [CATHEDRAL.west.x, CATHEDRAL.west.y], whereR: 500,
    obj: { type: "kill", kind: "deacon", count: 1, label: "Deacon Varrow slain" },
    offer: "You came through the Rift? Then the Rimewyrm is dead, and the seal he kept is broken. This is the Ashen Cathedral. The Choir that hid down here worships fire, and they mean to wake their Saint. Deacon Varrow keeps the west chapel. His censer rains embers: don't stand in the burning ground.",
    objective: "Dungeon: slay Deacon Varrow in the west chapel of the Ashen Cathedral. Bring a party.",
    progress: "The west chapel. Watch for his censer when he raises it, and get out of the fire.",
    complete: "The censer has gone cold. One of the two seals on the choir is broken.",
    done: "Varrow's embers are out. Good.",
  },
  silentvow: {
    id: "silentvow", lvl: 16, title: "The Silent Vow", giver: "elowen", turnin: "elowen", prereq: "rimewyrm", xp: 2600, coins: 800, dungeon: true, where: [CATHEDRAL.east.x, CATHEDRAL.east.y], whereR: 500,
    obj: { type: "kill", kind: "abbess", count: 1, label: "Abbess Ysolde slain" },
    offer: "Abbess Ysolde trained the Cinderfist monks. She took a vow of silence and forces it on everyone she strikes: her palm will stop you casting. Never stand in front of her, and watch for her flying kick. She keeps the east chapel.",
    objective: "Dungeon: slay Abbess Ysolde in the east chapel of the Ashen Cathedral. Bring a party.",
    progress: "The east chapel. Stay behind her, out of reach of her palm.",
    complete: "Silent at last, and for good. The second seal is broken.",
    done: "The east chapel is quiet now.",
  },
  ashensaint: {
    id: "ashensaint", lvl: 17, title: "The Ashen Saint", giver: "elowen", turnin: "elowen", prereq: ["censer", "silentvow"], xp: 5200, coins: 3000, reward: { item: 3, slot: "chest", name: "Ashen Saint's" }, dungeon: true, where: [CATHEDRAL.altar.x, CATHEDRAL.altar.y], whereR: 600,
    obj: { type: "kill", kind: "saint", count: 1, label: "Archprelate Malchar slain" },
    offer: "With both seals broken, the choir is open. Archprelate Malchar waits at the altar: the Ashen Saint. When he's hurt, his choir will shield him. Kill them and he's exposed. At the end, when he calls the Radiant Nova, get close to him. Only his shadow is safe.",
    objective: "Dungeon boss: slay Archprelate Malchar, the Ashen Saint, in the choir. Bring a full party.",
    progress: "The choir is open. End him.",
    complete: "It's over. The fire under the mountain is just fire again. Take this. It was mine, before I ran.",
    done: "Rest a while. You've earned it.",
  },
});
const QUEST_ORDER = ["sheep", "tusker", "courier", "scout", "wolves", "herbs", "beacons", "defend", "northpass", "lynx",
  "rams", "delve", "craglings", "pick", "ore", "frostbloom", "wisps", "whitemane", "wards", "brood", "rimewyrm", "censer", "silentvow", "ashensaint"];
/* ---------- Experience ---------- */
// Each level needs more XP than the last. Creatures and quests well below your level give less.
const MAX_LEVEL = 20;
const ULT_LEVEL = 6; // the ultimate (R) unlocks at this level
const xpForLevel = lvl => Math.round(40 * Math.pow(lvl, 1.6) + 70);
// creatures: +10% per level above you (up to +40%), −20% per level below (nothing at 5 below)
function mobXp(base, mobLvl, heroLvl){ const d = mobLvl - heroLvl; return Math.round(base * (d >= 0 ? 1 + .1 * Math.min(d, 4) : Math.max(0, 1 + .2 * d))); }
// quests: full XP up to 3 levels below you, then −20% per level, never less than 20%
function questXp(Q, heroLvl){ const over = heroLvl - (Q.lvl || heroLvl); return Math.round(Q.xp * (over <= 3 ? 1 : Math.max(.2, 1 - .2 * (over - 3)))); }
/* ---------- Fighting above your level ---------- */
// gap = enemy level − hero level. From a 2-level gap you miss more and deal less damage,
// and the enemy hits you harder. It gets worse with every level.
function levelGap(gap){
  if(gap < 2) return { miss: 0, dealt: 1, taken: 1 };
  const g = gap - 1;
  return { miss: Math.min(.75, .12 * g), dealt: Math.max(.25, 1 - .15 * g), taken: Math.min(2, 1 + .15 * g) };
}
// prereq is a quest id or a list of them; all must be done
function prereqMet(quests, Q){ const ids = !Q.prereq ? [] : Array.isArray(Q.prereq) ? Q.prereq : [Q.prereq]; return ids.every(id => quests[id] && quests[id].state === "done"); }
const RIMEWYRM_WEAPON = { melee: "Rimefang, Edge of the Wyrm", caster: "Skarnvir's Frozen Heart", ranged: "Wingbone Longbow" };
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
  { name: "Champion's Ring", x: ARENA.x + 350, y: ARENA.y - 700 },
  { name: "Howling Pines", x: PINES.x, y: PINES.y - 900 }, { name: "Old Watchtower", x: TOWER.x + 900, y: TOWER.y + 150 },
  { name: "Greywind Pass", x: PASS.x + 1000, y: PASS.y + 250 }, { name: "Highwatch Outpost", x: OUTPOST.x + 1100, y: OUTPOST.y - 150 },
  { name: "Ramsfoot Meadow", x: RAM_MEADOW.x - 200, y: RAM_MEADOW.y - 950 }, { name: "Whitefang Ridge", x: LYNX_RIDGE.x, y: LYNX_RIDGE.y + 950 },
  { name: "Skyreach Overlook", x: SUMMIT.x, y: SUMMIT.y + 450 },
  { name: "Hollowdeep Mine", x: MINE.x, y: MINE.y + 800 }, { name: "Glassmere", x: LAKE.x, y: LAKE.y + 700 },
  { name: "Whitemane's Hollow", x: YETI_DEN.x, y: YETI_DEN.y + 600 }, { name: "Yrsa's Watch", x: YRSA_CAMP.x - 950, y: YRSA_CAMP.y - 50 },
  { name: "The Wyrm's Crown", x: LAIR.x - 400, y: LAIR.y + 1050 },
  { name: "Narthex", x: 4000, y: 17350 }, { name: "The Nave", x: 5600, y: 20000 }, { name: "West Chapel", x: CATHEDRAL.west.x, y: 22900 },
  { name: "East Chapel", x: CATHEDRAL.east.x, y: 22900 }, { name: "The Choir", x: 4000, y: 23700 },
];
const MOBS = {
  sheep: { name: "Sheep", lvl: 1, r: 45, hp: 140, dmg: 6, atkCd: 1.6, ms: 260, wander: 110, xp: 22, respawn: 12, leash: 1500, home: [PASTURE.x, PASTURE.y], roam: PASTURE.r - 180, count: 9 },
  boar: { name: "Old Tusker", lvl: 5, r: 85, hp: 1700, dmg: 34, atkCd: 1.7, ms: 290, wander: 80, xp: 150, respawn: 25, leash: 1500, home: [DEN.x, DEN.y], roam: 300, count: 1, elite: true, charge: true },
  wolf: { name: "Gray Wolf", lvl: 4, r: 52, hp: 360, dmg: 15, atkCd: 1.3, ms: 330, wander: 120, xp: 45, respawn: 16, leash: 1900, home: [PINES.x, PINES.y], roam: PINES.r, count: 7, aggroR: 420, pack: true },
  ram: { name: "Crag Ram", lvl: 10, r: 60, hp: 1050, dmg: 30, atkCd: 1.6, ms: 300, wander: 120, xp: 95, respawn: 18, leash: 1700, home: [RAM_MEADOW.x, RAM_MEADOW.y], roam: RAM_MEADOW.r - 150, count: 9, charge: true },
  lynx: { name: "Snowfang Lynx", lvl: 11, r: 55, hp: 980, dmg: 36, atkCd: 1.2, ms: 360, wander: 130, xp: 115, respawn: 16, leash: 1800, home: [LYNX_RIDGE.x, LYNX_RIDGE.y], roam: LYNX_RIDGE.r, count: 10, aggroR: 460 },
  cragling: { name: "Cragling", lvl: 11, r: 50, hp: 900, dmg: 30, atkCd: 1.3, ms: 320, wander: 110, xp: 100, respawn: 15, leash: 1500, home: [MINE.x, MINE.y], roam: MINE.r - 60, count: 9, aggroR: 330 },
  wisp: { name: "Frost Wisp", lvl: 12, r: 46, hp: 860, dmg: 34, atkCd: 1.5, ms: 300, wander: 150, xp: 110, respawn: 16, leash: 1600, home: [LAKE.x, LAKE.y], roam: LAKE.r + 200, count: 9, aggroR: 420 },
  yeti: { name: "Whitemane", lvl: 13, r: 100, hp: 4400, dmg: 56, atkCd: 1.8, ms: 300, wander: 70, xp: 400, respawn: 60, leash: 1500, home: [YETI_DEN.x, YETI_DEN.y], roam: 220, count: 1, elite: true, charge: true },
  whelp: { name: "Frost Whelp", lvl: 13, r: 50, hp: 650, dmg: 26, atkCd: 1.3, ms: 360, wander: 100, xp: 70, respawn: 0, leash: 99999, home: [LAIR.x, LAIR.y], roam: 300, count: 0, aggroR: 1000 },
  // the first raid boss: needs a party of 3+ (tank, healer, damage). Behaviour is in 05c-raid.js
  dragon: { name: "Skarnvir the Rimewyrm", lvl: 15, r: 340, hp: 140000, dmg: 330, atkCd: 1.9, ms: 230, wander: 0, xp: 1500, respawn: 300, leash: 2300, home: [LAIR.x, LAIR.y], roam: 0, count: 1, elite: true, boss: true, aggroR: 650 },
  // The Ashen Cathedral (05g-dungeon.js): elite packs of priests and monks, two chapel bosses and the Saint.
  // count 0: the dungeon places them itself (CATHEDRAL_SPAWNS), each with its own home
  acolyte: { name: "Ashen Acolyte", lvl: 16, r: 55, hp: 6500, dmg: 130, atkCd: 1.9, ms: 300, wander: 0, xp: 260, respawn: 0, leash: 1900, home: [4000, 19000], roam: 0, count: 0, elite: true, aggroR: 480, ranged: 640, heals: { every: 7, pct: .18, range: 900 } },
  monk: { name: "Cinderfist Monk", lvl: 16, r: 55, hp: 8500, dmg: 110, atkCd: 1.05, ms: 340, wander: 0, xp: 280, respawn: 0, leash: 1900, home: [4000, 19000], roam: 0, count: 0, elite: true, aggroR: 480 },
  deacon: { name: "Deacon Varrow", title: "Dungeon Boss", lvl: 17, r: 90, hp: 190000, dmg: 470, atkCd: 1.7, ms: 290, wander: 0, xp: 1200, respawn: 0, leash: 1500, home: [CATHEDRAL.west.x, CATHEDRAL.west.y], roam: 0, count: 0, elite: true, boss: true, script: "deacon", aggroR: 560 },
  abbess: { name: "Abbess Ysolde", title: "Dungeon Boss", lvl: 17, r: 80, hp: 175000, dmg: 390, atkCd: 1.3, ms: 330, wander: 0, xp: 1200, respawn: 0, leash: 1500, home: [CATHEDRAL.east.x, CATHEDRAL.east.y], roam: 0, count: 0, elite: true, boss: true, script: "abbess", aggroR: 560 },
  saint: { name: "Archprelate Malchar", title: "Final Boss · The Ashen Saint", lvl: 17, r: 120, hp: 420000, dmg: 520, atkCd: 1.8, ms: 270, wander: 0, xp: 2500, respawn: 0, leash: 1700, home: [CATHEDRAL.altar.x, CATHEDRAL.altar.y], roam: 0, count: 0, elite: true, boss: true, script: "saint", aggroR: 600 },
  bandit: { name: "Vale Bandit", lvl: 6, r: 55, hp: 400, dmg: 19, atkCd: 1.4, ms: 300, wander: 100, xp: 60, respawn: 0, leash: 99999, home: [TOWER.x, TOWER.y], roam: 300, count: 0, aggroR: 900 },
};
const clampX = v => Math.max(ZMIN, Math.min(ZMAX, v));
const clampY = v => Math.max(ZMIN, Math.min(ZS * 3 - ZMIN, v)); // (the Peaks' north edge and the cathedral's walls are enforced by SIM.bound)

/* ---------- Items: loot tables, armor generation, inventory ---------- */
const BAG_SIZE = 20;
const EQ_SLOTS = ["head", "chest", "hands", "legs", "feet", "weapon"];
const ARMOR_SLOTS = ["head", "chest", "hands", "legs", "feet"];
const SLOT_NAME = { head: "Head", chest: "Chest", hands: "Hands", legs: "Legs", feet: "Feet", weapon: "Weapon" };
const RARITY = [{ n: "Common", c: "#d8d8d8", m: 1 }, { n: "Uncommon", c: "#3fd16a", m: 1.4 }, { n: "Rare", c: "#4d9dff", m: 1.9 }, { n: "Epic", c: "#b45cff", m: 2.6 }, { n: "Legendary", c: "#ff8a1e", m: 3.5 }];
const STAT = {
  hp: { w: 8, line: v => `+${v} Health`, short: "Health" }, ad: { w: 1, line: v => `+${v} Attack Damage`, short: "Attack" },
  ap: { w: .8, line: v => `+${v}% Ability Damage`, short: "% Ability" }, armor: { w: 1.5, line: v => `+${v} Armor`, short: "Armor" },
  haste: { w: .5, line: v => `+${v}% Cooldown Reduction`, short: "% Haste" }, ms: { w: .5, line: v => `+${v}% Movement Speed`, short: "% Speed" },
};
const MATERIAL = {
  cloth: { label: "Cloth", stats: ["ap", "haste", "hp", "ms"], names: ["Frayed", "Woven", "Silken", "Starweave", "Wyrmweave"], color: ["#7c6aa0", "#6a4fb0", "#4f6ad0", "#a04fd0", "#3fb4d8"] },
  leather: { label: "Leather", stats: ["ad", "ms", "hp", "haste"], names: ["Worn", "Tanned", "Hardened", "Shadowhide", "Rimescale"], color: ["#7a5a3a", "#8a6234", "#6a4a2a", "#4a3050", "#2f6a8a"] },
  plate: { label: "Plate", stats: ["armor", "hp", "ad", "haste"], names: ["Dented", "Iron", "Steel", "Valor", "Dragonforged"], color: ["#7d8794", "#9aa6b8", "#c0ccdc", "#d8c27a", "#e8f0ff"] },
};
const BASE_NAMES = { head: { cloth: "Hood", leather: "Cap", plate: "Helm" }, chest: { cloth: "Robe", leather: "Jerkin", plate: "Breastplate" }, hands: { cloth: "Gloves", leather: "Grips", plate: "Gauntlets" }, legs: { cloth: "Trousers", leather: "Leggings", plate: "Legplates" }, feet: { cloth: "Sandals", leather: "Boots", plate: "Sabatons" } };
const WEAPON_NAMES = { melee: { base: ["Shortsword", "Blade", "Longsword"], pre: ["Rusty", "Sturdy", "Fine", "Runed", "Wyrmfang"], wt: "sword" }, caster: { base: ["Rod", "Staff", "Spire"], pre: ["Cracked", "Oak", "Carved", "Runed", "Wyrmfang"], wt: "staff" }, ranged: { base: ["Shortbow", "Bow", "Longbow"], pre: ["Warped", "Ash", "Recurve", "Runed", "Wyrmfang"], wt: "bow" } };
const SUFFIX = { hp: "of the Bear", ad: "of the Tiger", ap: "of the Owl", armor: "of the Turtle", haste: "of Swiftness", ms: "of the Fox" };
const CLASS_MAT = { melee: "plate", caster: "cloth", ranged: "leather" };
const MATERIALS = { wool: { n: "Tuft of Wool", v: 3 }, pelt: { n: "Wolf Pelt", v: 9 }, hide: { n: "Thick Boar Hide", v: 25 }, horn: { n: "Curled Ram Horn", v: 22 }, frostpelt: { n: "Snowfang Pelt", v: 30 },
  shard: { n: "Glimmering Shard", v: 26 }, essence: { n: "Wisp Essence", v: 30 }, yetifur: { n: "Whitemane's Mane", v: 120 }, rimescale: { n: "Rimescale", v: 40 }, ashcloth: { n: "Ash-Stained Vestment", v: 45 } };
const LOOT = {
  sheep: { coins: [1, 4], mat: ["wool", .7], gear: .12, ilvl: 2 },
  wolf: { coins: [4, 10], mat: ["pelt", .6], gear: .22, ilvl: 4 },
  bandit: { coins: [10, 24], mat: null, gear: .32, ilvl: 6 },
  ram: { coins: [18, 34], mat: ["horn", .6], gear: .25, ilvl: 11 },
  lynx: { coins: [20, 40], mat: ["frostpelt", .55], gear: .28, ilvl: 12 },
  cragling: { coins: [22, 40], mat: ["shard", .55], gear: .26, ilvl: 12 },
  wisp: { coins: [24, 44], mat: ["essence", .5], gear: .28, ilvl: 12 },
  whelp: { coins: [10, 20], mat: ["rimescale", .4], gear: .15, ilvl: 13 },
  yeti: { coins: [90, 140], mat: ["yetifur", 1], gear: 1, minRarity: 2, epic: .3, ilvl: 14 },
  dragon: { raid: true, coins: [600, 900], ilvl: 16 },  // see SIM.raidLoot
  acolyte: { coins: [40, 70], mat: ["ashcloth", .5], gear: .35, minRarity: 1, epic: .05, ilvl: 16 },
  monk: { coins: [40, 70], mat: ["ashcloth", .5], gear: .35, minRarity: 1, epic: .05, ilvl: 16 },
  deacon: { dungeon: "mini", coins: [400, 600], ilvl: 17 },   // see SIM.dungeonLoot
  abbess: { dungeon: "mini", coins: [400, 600], ilvl: 17 },
  saint: { dungeon: "final", coins: [900, 1300], ilvl: 18 },
  boar: { coins: [40, 70], mat: ["hide", 1], gear: 1, minRarity: 2, epic: .15, ilvl: 5 },
};
function rollRarity(min, epic){ const r = Math.random(); const v = r < .01 + (epic || 0) ? 3 : r < .12 ? 2 : r < .45 ? 1 : 0; return Math.max(min || 0, v); }
function genItem(o){
  const r = Math.max(0, Math.min(4, o.rarity)), cls = o.cls || "melee", slot = o.slot || EQ_SLOTS[Math.floor(Math.random() * EQ_SLOTS.length)];
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
// Usable items (bought from vendors). Only gear can be equipped.
const isGear = it => !!it && EQ_SLOTS.includes(it.s);
const ALLY_PICK = 300, ALLY_RANGE = 1100; // how close to the cursor, and to you, an ally must be for heals and shields
const POTION = { heal: .4, cd: 60 }; // a Health Potion restores 40% of max health; 60 second cooldown
const SHOP_ITEMS = { hpot: { n: "Health Potion", price: 25, desc: `Restores ${POTION.heal * 100}% of your health. Usable in combat. ${POTION.cd} second cooldown. Press F to drink.` } };
function makePotion(nid, q){ return { id: "i" + nid, n: SHOP_ITEMS.hpot.n, s: "use", key: "hpot", r: 0, q: q || 1, v: 6, stack: true }; }
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
  else if(it.key === "hpot"){ P([[20, 8], [28, 8], [28, 16], [20, 16]], "#c9a55c"); g.beginPath(); g.arc(24, 30, 13, 0, Math.PI * 2); g.fillStyle = "#c0392b"; g.fill(); g.stroke(); P([[20, 14], [28, 14], [28, 20], [20, 20]], "#e8e2d4"); g.fillStyle = "rgba(255,255,255,.55)"; g.fillRect(17, 25, 4, 7); }
  else if(it.key === "horn"){ g.lineWidth = 9; g.strokeStyle = "#0b0f17"; g.beginPath(); g.arc(24, 24, 12, -2.4, 2.2); g.stroke(); g.lineWidth = 6; g.strokeStyle = "#d8ccb0"; g.stroke(); }
  else { const pc = { pelt: ["#8a8580", "#a8a29a"], frostpelt: ["#d8d4ca", "#f2efe8"] }[it.key] || ["#6a4428", "#8a5a32"]; P([[10, 14], [20, 10], [28, 12], [38, 10], [40, 22], [36, 36], [26, 40], [14, 38], [8, 26]], pc[0]); P([[16, 18], [32, 18], [30, 32], [18, 32]], pc[1]); }
  g.lineWidth = 3; g.strokeStyle = RARITY[it.r].c; g.strokeRect(1.5, 1.5, 45, 45);
  const url = c.toDataURL(); iconCache.set(key, url); return url;
}
