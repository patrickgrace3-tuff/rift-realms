# Rift Realms

League of Legends champions in a small World of Warcraft–style world. Pick any champion, step into Sunhollow Vale, and quest with up to four friends.

- Every champion is playable. Abilities are matched from each champion's real kit (skillshots, hooks, leaps, shields, summons and more).
- Chunky low-poly 3D bodies with your champion's portrait as the head; armor changes the look. A sky with a day and night cycle, and a camera you can turn and zoom.
- Sunhollow Vale (eight quests) leads north through Greywind Pass to Frostspine Peaks (eleven more), where Skarnvir the Rimewyrm waits as the first raid boss.
- The Ashen Cathedral, a five-player dungeon with three bosses, opens behind Skarnvir. Behind its last boss, two portals: the right one to the Thornveil Jungle (levels 16–19), the left one to the Amberveil Wastes, a desert (levels 20–23) with eleven quests, scorpions, vipers, jackals, basilisks and risen tomb husks, two elites, and two raid bosses: Zahrak, the Dune Wyrm, who burrows and erupts under the party, and Queen Ankhara, the Sun-Bound, shielded by her tomb guard.
- Hire a raid party of computer champions (tank, healer, damage) for the raids and the dungeon.
- PvP in the Proving Grounds, a stand-alone arena: two gated starting rooms, broad floors split by a chasm with one bridge across, and four great pillars that block shots. Duel a party member, or ask Arenamaster Vex for a computer opponent (difficulty 1–10).
- Loot from every creature, four armor rarities, a character window, a skill tree, a minimap and a world map.
- Co-op for up to five players: share a 5-letter code, no server needed.
- Parties: invite players to your group to share XP, quest kills and quest items. Rare and Epic drops are rolled on with Need, Greed or Pass.
- Chat with everyone in the world, or just your party.

## Play

Open `index.html` in Chrome, Edge, Firefox or Safari. It needs an internet connection: champion art and abilities load live from Riot's Data Dragon.

Or run a local server:

```
npm start
```

## Controls

Two control schemes; switch in the Menu (Esc). WASD is the default.

| Key | Action |
|---|---|
| W S / ↑ ↓ | Run forward and back (away from or toward the camera) |
| Q E / ← → | Turn (Q E with WASD controls) |
| A D | Step sideways (WASD controls) |
| Space | Jump |
| Both mouse buttons | Run forward; move the mouse to steer |
| 1 2 3 4 | Cast at the cursor (WASD controls; Q W E R with Classic controls). The ultimate unlocks at level 6. Hover an ability to see what it does |
| G | Support heal (Support champions) |
| Drag (left mouse) | Turn the camera around you; double-click puts it back behind |
| Scroll | Zoom. Zoomed in, the camera drops low enough to see the sky; zoomed out it looks down from above |
| Right-click | Move, attack, talk, pick up, use |
| F | Drink a Health Potion (buy them from Peddler Osric in the village) |
| T | Talk to the nearest NPC |
| C | Character window |
| K | Skill tree |
| O | Professions |
| M | World map |
| P | Players and party |
| Enter | Chat (Tab or `/p` for party chat) |
| S | Stop (Classic controls) |

## Develop

```
npm test
```

The tests play through every quest headless. See `CLAUDE.md` for how the code is organized; it's written so a Claude Code session can pick up the project.

## Deploy

`npm run build` runs the tests and writes the site to `_site/`, with a version code on every script and stylesheet link so players always get fresh files after an update. On Render, set the build command to `npm run build` and the publish directory to `_site`.

Every push to `main` runs the tests and publishes the game to GitHub Pages (`.github/workflows/pages.yml`). To turn it on: in the repository's Settings > Pages, set Source to **GitHub Actions**.

## Credits

- Music: "Calm Ambient Dreamscape" by Morgan Ambient, from [Pixabay](https://pixabay.com/) (Pixabay Content License).
- Sound effects in `src/audio/sfx/` (attacks, hits, misses, death, respawn, level up, heal and shield) were supplied by the project owner.

## Legal

Rift Realms was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project. It is free and non-commercial. No Riot assets are stored in this repository; they are loaded from Riot's Data Dragon at runtime.
