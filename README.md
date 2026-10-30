# Rift Realms

League of Legends champions in a small World of Warcraft–style world. Pick any champion, step into Sunhollow Vale, and quest with up to four friends.

- Every champion is playable. Abilities are matched from each champion's real kit (skillshots, hooks, leaps, shields, summons and more).
- Pixel-art bodies with your champion's portrait as the head; armor changes the look.
- Two zones. Sunhollow Vale has eight quests: hunting, a boss with a quest drop, a timed delivery, exploring, gathering, lighting beacons and defending a watchtower. Finish them all and Captain Rhea sends you north through Greywind Pass to Frostspine Peaks, a snowy mountain zone with eleven more quests: the Hollowdeep Mine, the frozen lake of Glassmere, the elite yeti Whitemane, and more.
- The first raid boss: Skarnvir the Rimewyrm, a huge frost dragon in the Wyrm's Crown. Bring a party of three or more (a tank, a healer and damage). Dodge his breath and tail, kill his whelps, and win Legendary loot.
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

| Key | Action |
|---|---|
| Right-click | Move, attack, talk, pick up, use |
| Q W E R | Cast at the cursor (R unlocks at level 6). Hover an ability to see what it does |
| F | Drink a Health Potion (buy them from Peddler Osric in the village) |
| T | Talk to the nearest NPC |
| C | Character window |
| K | Skill tree |
| M | World map |
| P | Players and party |
| Enter | Chat (Tab or `/p` for party chat) |
| S | Stop |
| Scroll | Zoom |

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

## Legal

Rift Realms was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project. It is free and non-commercial. No Riot assets are stored in this repository; they are loaded from Riot's Data Dragon at runtime.
