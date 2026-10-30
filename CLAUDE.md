# Rift Realms

A browser MMO-style fan game: League of Legends champions questing in two original zones (Sunhollow Vale, and Frostspine Peaks to the north), with co-op for up to five players, parties and chat. Plain JavaScript, no build step. three.js and PeerJS load from CDNs; champion art and ability text load at runtime from Riot's Data Dragon.

## Run and test

- Play: open `index.html` in a browser, or `npm start` and visit the printed URL.
- Test: `npm test` (Node 20+, no dependencies). Run it after every change to game logic. Tests load the scripts in `index.html` order into one shared scope with a fake DOM, then play through every quest headless.

## Layout

Scripts are classic `<script>` files (not modules) loaded in order by `index.html`. They share one global scope, so a file can use anything declared in an earlier file. Top-level code may only call things from earlier files; inside functions, anything goes.

| File | What it holds |
|---|---|
| `src/js/00-core.js` | Helpers, Data Dragon URLs, the ability bank (`ARCH`, `RULES`, `buildKit`) |
| `src/js/01-world-data.js` | Zone layout, NPCs, `QUESTS`, `MOBS`, skill-tree rules, items and `LOOT` tables |
| `src/js/02-boot-select.js` | Boot and the champion select screen |
| `src/js/03-art.js` | `CharArt` pixel bodies (portrait heads), NPC heads, creature sprites |
| `src/js/04-scene.js` | three.js setup, Sunhollow Vale's procedural terrain, props and map image |
| `src/js/04b-peaks.js` | Frostspine Peaks' terrain, props and map image; snowfall and cold fog (`updateClimate`) |
| `src/js/05-sim.js` | `SIM`: the authoritative simulation. No DOM, no three.js |
| `src/js/05b-party.js` | Adds parties, Need/Greed loot rolls and chat to `SIM`; player slots (`SIDES`) |
| `src/js/05c-raid.js` | Raid bosses (`RAID` tuning, `SIM.bossTick`, threat, telegraphs, raid loot) |
| `src/js/06-net.js` | PeerJS co-op (host shares a 5-letter code; up to 4 guests) |
| `src/js/07-world.js` | Entering the world, hero visuals, input, quest dialog |
| `src/js/08-ui.js` | Tracker, loot feed, character window, skill tree, maps, HUD, effects |
| `src/js/08b-social.js` | Party frames, Players window, invite prompt, roll cards, chat box |
| `src/js/09-render.js` | Per-frame render and the main loop; calls `boot()` last |

## How the game works

- **Players.** Each player has a side from `SIDES` (`blue` is always the host; guests get `red`, `green`, `violet`, `amber`). The host keeps one PeerJS connection per guest in `NET.guests`.
- **Host-authoritative.** Only the host runs `SIM.step`. Every player action is a command object passed to `SIM.input(W, side, cmd)` (the guest sends the same objects over PeerJS). Never change game state from UI code; add a command and handle it in `SIM.input`.
- **Validate every command** in `SIM.input`: guest input is untrusted. Look items up by id, check slot names against fixed lists, check distances to NPCs.
- **Snapshots.** `SIM.snapshot(W)` is the only thing clients render from. Keep it small: arrays for mobs, loot and shots. Gear is sent only when `c.gearVer` changes.
- **Units and zones.** The simulation uses world units: x 0 to 8000, y 0 to 16000 (y is north). Sunhollow Vale is y < 8000 and Frostspine Peaks is y ≥ 8000. Each zone is an entry in `ZONES` (key, name, and its area as `x0, y0, w, h`); `zoneAt` finds the zone at a point. To add a zone: add it to `ZONES`, build its scene and set `ZONE_PICS[key]` to its map picture (a canvas); the minimap and the world map (right-click the map) then show it automatically. A ridge of `OBSTACLES` along y = 8000 blocks the way except at Greywind Pass (`PASS`). Clamp positions with `clampX` and `clampY`. `XF(x, y)` converts to three.js world space; `ZH(x, y)` is the ground height in either zone.
- **Effects.** The simulation reports events with `SIM.fx(W, { k: ..., side })`; `handleFx` in `08-ui.js` turns them into banners, numbers and visuals. Add `to: [sides]` to send an effect only to those players (party chat, invites, rolls); the host filters these per guest in `netBroadcast`.
- **Parties.** `W.parties`, `W.invites` and `W.rolls` live in the simulation; commands are `pinvite`, `paccept`, `pdecline`, `pkick`, `pleave`, `roll` and `chat`, handled by `SIM.socialInput`. A kill's XP, quest credit and quest drops go to `SIM.creditGroup` (the killer plus party members within `SHARE_RANGE`). Rare and better gear from a party kill goes to a Need/Greed/Pass roll instead of the bag.
- **Quests** are data in `QUESTS` plus `QUEST_ORDER`. Objective types: `kill`, `loot`, `deliver`, `explore`, `collect`, `interact`, `defend`. They're data-driven: `collect` names a node kind (`obj.node`; nodes come from `NODE_SPOTS`, text from `NODE_INFO`, art from `NODE_ART`); `interact` points are entries in `USE_POINTS` with their `quest`, `verb`, `idle` and `done` text (`use` commands index `USE_POINTS`); `defend` sets `place`, `mob`, `waves`, `from` (attack direction) and its `start`/`waveText`/`win` banners; `loot` items are drawn by `QUEST_ITEM_ART`. Scenes register quest visuals in `USE_FX` (lined up with `USE_POINTS`), `EXPLORE_FX` and `DEFEND_FX`. `prereq` can be one quest id or a list (`prereqMet`). `questFor(quests, npcId)` decides what an NPC offers. A new quest of an existing type needs only data; a new type needs a branch in `SIM.questTick` or `SIM.damage`, a line in `questLine`, and a case in `objectiveTarget`.
- **Experience.** `xpForLevel` sets the XP each level needs; it grows faster than linearly. Kill XP goes through `mobXp` (bonus for creatures above you, nothing for creatures 5+ levels below) and quest XP through `questXp` (less for quests 4+ levels below you, using each quest's `lvl`). Give every new quest and creature a level. The quest chain reaches about level 8 at the end of the Vale and 10 after the first Peaks quest.
- **Level gap in combat.** `levelGap(enemyLevel − heroLevel)` gives the miss chance, the share of damage heroes deal, and how much harder the enemy hits. It starts at a 2-level gap and gets worse each level (up to 75% misses, 25% damage dealt, double damage taken). `SIM.damage` applies it to every hero-versus-creature hit; a miss returns −1 and skips crowd control. Creature name plates colour the level: orange 2–3 above you, red 4+, grey when it gives no XP.
- **Abilities.** Each champion's Q/W/E/R is matched to one of 15 archetypes from its Data Dragon text (`buildKit`). Talents modify the base numbers through `applyTalents`, used by both the simulation and the HUD. Heal and shield abilities go to the living player nearest the cursor (within `ALLY_PICK` of it and `ALLY_RANGE` of the caster), otherwise to the caster (`SIM.supportTarget`).
- **Vendors and items.** An NPC with `shop: [itemKeys]` opens a shop instead of a quest dialog; `SHOP_ITEMS` holds prices and text. Commands: `buy` (checked against distance and coins) and `potion` (F; `POTION` sets the heal and cooldown). Only gear can be equipped: use `isGear(item)` rather than checking for a particular non-gear type. F drinks a potion; T talks to the nearest NPC.
- **Raid bosses** (`boss: true` in `MOBS`, e.g. Skarnvir in the Wyrm's Crown) skip the normal mob AI and run `SIM.bossTick`: threat (melee champions ×3, healing ×0.5), telegraphed attacks (a `warn` effect before they land), adds, a raid-wide storm, enrage, and a reset if everyone leaves. Heroes without a party of `RAID.party` nearby deal 10% damage. Bosses ignore crowd control. Kill credit and `raidLoot` go to every party member who fought. Rarity 4 is Legendary. The test `raid: a party of three…` plays a scripted tank/healer/damage party through the fight; use it to retune numbers in `RAID` and `MOBS.dragon`.
- **Obstacles** are circles in `OBSTACLES`. Moving units slide around them; avoid placing two circles so they touch and form a corner (merge them into one, like Osric's stall). A test fails if any two obstacles leave a gap narrower than a player.

## Rules for this project

- It is a free fan project under Riot's "Legal Jibber Jabber" policy. Keep it free: no ads, payments or sponsorships. Keep the disclaimer on the select screen. Never commit Riot assets (images, models, game files) to the repo; load them from Data Dragon at runtime.
- Characters, NPCs, creatures, the zone and all quest text are original. Keep new content original too; don't recreate Riot's maps or other games' characters.
- Art: pixel bodies drawn on 128x192 canvases in 4px blocks, with the champion portrait as the head. Creatures are drawn in code in the same style.
- Keep it dependency-free unless there's a strong reason. If adding a library, pin an exact version.
