"use strict";
// Parties, Need/Greed loot rolls and chat. Adds to SIM (host only). No DOM or three.js.

/* =====================================================================
   PLAYERS AND PARTIES
   ===================================================================== */
const SIDES = ["blue", "red", "green", "violet", "amber"]; // player slots; the host is always blue
const SIDE_COLOR = { blue: "#f0d58e", red: "#7fd3ff", green: "#7fe0a0", violet: "#c9a0ff", amber: "#ffb070" };
const MAX_PLAYERS = SIDES.length;
const PARTY_MAX = 5;
const SHARE_RANGE = 1600;  // party members this close to a kill share its XP, quest credit and rolls
const ROLL_MIN = 2;        // Rare and better drops are rolled on
const ROLL_TIME = 30;      // seconds to pick Need, Greed or Pass
const INVITE_TIME = 60;
const CHAT_MAX = 160;
const ROLL_PICKS = ["need", "greed", "pass"];

Object.assign(SIM, {
  hero(W, side){ return SIDES.includes(side) ? W.heroes[side] || null : null; },
  party(W, c){ return c && c.party ? W.parties[c.party] || null : null; },
  partyMembers(W, c){ const p = SIM.party(W, c); return p ? p.members.map(s => W.heroes[s]).filter(Boolean) : [c]; },
  // who shares a kill: the killer plus party members who are alive and nearby
  creditGroup(W, c, u){ return SIM.partyMembers(W, c).filter(h => h === c || (!h.dead && Math.hypot(h.x - u.x, h.y - u.y) < SHARE_RANGE)); },
  // a system line in chat; sides = null tells everyone in the world
  note(W, sides, text){ SIM.fx(W, sides ? { k: "sys", to: sides.slice(), text } : { k: "sys", text }); },
  tell(W, c, text){ SIM.fx(W, { k: "msg", side: c.side, text }); },

  // Party, roll and chat commands. Returns true if the command was one of these.
  socialInput(W, c, cmd){
    if(cmd.chat !== undefined){ SIM.chat(W, c, cmd.chat, cmd.ch); return true; }
    if(cmd.pinvite !== undefined){ SIM.partyInvite(W, c, String(cmd.pinvite)); return true; }
    if(cmd.paccept !== undefined){ SIM.partyAccept(W, c, String(cmd.paccept)); return true; }
    if(cmd.pdecline !== undefined){ SIM.partyDecline(W, c, String(cmd.pdecline)); return true; }
    if(cmd.pkick !== undefined){ SIM.partyKick(W, c, String(cmd.pkick)); return true; }
    if(cmd.pleave){ SIM.partyLeave(W, c); return true; }
    if(cmd.roll !== undefined){ SIM.rollPick(W, c, String(cmd.roll), String(cmd.pick)); return true; }
    return false;
  },

  partyInvite(W, c, side){
    const t = SIM.hero(W, side); if(!t || t === c) return;
    const p = SIM.party(W, c);
    if(p && p.leader !== c.side){ SIM.tell(W, c, "Only the party leader can invite."); return; }
    if(p && p.members.length >= PARTY_MAX){ SIM.tell(W, c, "Your party is full."); return; }
    if(t.party){ SIM.tell(W, c, `${t.name} is already in a party.`); return; }
    if(W.invites.some(i => i.from === c.side && i.to === side)) return;
    W.invites = W.invites.filter(i => i.to !== side); // one pending invite per player: the newest
    W.invites.push({ from: c.side, to: side, until: W.t + INVITE_TIME });
    SIM.note(W, [c.side], `You invited ${t.name} to your party.`);
    SIM.fx(W, { k: "pinvite", to: [side], from: c.side, name: c.name });
  },
  partyAccept(W, c, from){
    const inv = W.invites.find(i => i.from === from && i.to === c.side); if(!inv) return;
    W.invites = W.invites.filter(i => i.to !== c.side);
    const lead = SIM.hero(W, from);
    if(!lead || c.party) return;
    let p = SIM.party(W, lead);
    if(p && p.leader !== from){ SIM.tell(W, c, "That invite is no longer valid."); return; }
    if(p && p.members.length >= PARTY_MAX){ SIM.tell(W, c, "That party is full."); return; }
    if(!p){ p = { id: "P" + W.nid++, leader: from, members: [from] }; W.parties[p.id] = p; lead.party = p.id; }
    p.members.push(c.side); c.party = p.id;
    SIM.note(W, p.members, `${c.name} joined the party.`);
  },
  partyDecline(W, c, from){
    const had = W.invites.some(i => i.from === from && i.to === c.side);
    W.invites = W.invites.filter(i => !(i.from === from && i.to === c.side));
    if(had && SIM.hero(W, from)) SIM.note(W, [from], `${c.name} declined your party invite.`);
  },
  partyKick(W, c, side){
    const p = SIM.party(W, c);
    if(!p || p.leader !== c.side || side === c.side || !p.members.includes(side)) return;
    SIM.partyLeave(W, W.heroes[side], "kick");
  },
  partyLeave(W, c, why){
    const p = SIM.party(W, c); if(!p) return;
    p.members = p.members.filter(s => s !== c.side); c.party = null;
    W.invites = W.invites.filter(i => i.from !== c.side);
    for(const r of W.rolls) if(r.members.includes(c.side) && !r.choices[c.side]) r.choices[c.side] = "pass";
    const quiet = c.bot; // hired champions come and go without party chatter
    if(why !== "gone" && !quiet) SIM.note(W, [c.side], why === "kick" ? "You were removed from the party." : "You left the party.");
    if(p.members.length < 2){
      for(const s of p.members){ const h = W.heroes[s]; if(h) h.party = null; }
      W.invites = W.invites.filter(i => i.from !== p.leader);
      delete W.parties[p.id];
      if(!quiet) SIM.note(W, p.members, `${c.name} ${why === "kick" ? "was removed" : "left"}. Your party has disbanded.`);
      return;
    }
    let text = `${c.name} ${why === "kick" ? "was removed from" : "left"} the party.`;
    if(p.leader === c.side){ p.leader = p.members.find(s => W.heroes[s] && !W.heroes[s].bot) || p.members[0]; text += ` ${W.heroes[p.leader].name} is now the leader.`; }
    if(!quiet) SIM.note(W, p.members, text);
  },
  // called when a player disconnects
  forgetHero(W, c){
    SIM.partyLeave(W, c, "gone");
    W.invites = W.invites.filter(i => i.from !== c.side && i.to !== c.side);
  },

  /* ---------- Need / Greed / Pass ---------- */
  startRoll(W, item, heroes, looter){
    const r = { id: "r" + W.nid++, item, members: heroes.map(h => h.side), looter: looter.side, choices: {}, until: W.t + ROLL_TIME };
    W.rolls.push(r);
    SIM.fx(W, { k: "rollstart", to: r.members, id: r.id, item: item.n, r: item.r });
    return r;
  },
  rollPick(W, c, id, pick){
    const r = W.rolls.find(x => x.id === id);
    if(!r || !r.members.includes(c.side) || r.choices[c.side] || !ROLL_PICKS.includes(pick)) return;
    r.choices[c.side] = pick;
  },
  rollEnd(W, r){
    r.done = true;
    const rank = { need: 2, greed: 1 }, rolls = [];
    let best = null;
    for(const s of r.members){
      const h = W.heroes[s]; if(!h) continue;
      const pick = r.choices[s] || "pass";
      if(pick === "pass"){ rolls.push([h.name, "pass", 0]); continue; }
      const num = 1 + Math.floor(Math.random() * 100);
      rolls.push([h.name, pick, num]);
      if(!best || rank[pick] > rank[best.pick] || (rank[pick] === rank[best.pick] && num > best.num)) best = { h, pick, num };
    }
    // if everyone passes, the player who made the kill keeps it
    const winner = best ? best.h : W.heroes[r.looter];
    if(!winner) return;
    if(!SIM.addItem(winner, r.item)) SIM.dropItems(W, winner, [r.item]);
    SIM.fx(W, { k: "rollwin", to: r.members, side: winner.side, name: winner.name, item: r.item.n, r: r.item.r, pick: best ? best.pick : "pass", num: best ? best.num : 0, rolls });
  },

  /* ---------- Chat ---------- */
  chat(W, c, text, ch){
    if(typeof text !== "string") return;
    text = text.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, CHAT_MAX);
    if(!text) return;
    if(W.t - c.chatT > 5){ c.chatT = W.t; c.chatN = 0; }
    if(++c.chatN > 5){ SIM.tell(W, c, "You're sending messages too quickly."); return; }
    if(ch === "party"){
      const p = SIM.party(W, c);
      if(!p){ SIM.note(W, [c.side], "You're not in a party. Press P to invite players."); return; }
      SIM.fx(W, { k: "chat", ch: "party", to: p.members.slice(), from: c.side, name: c.name, text });
    }else SIM.fx(W, { k: "chat", ch: "world", from: c.side, name: c.name, text });
  },

  socialTick(W){
    if(W.invites.length) W.invites = W.invites.filter(i => i.until > W.t);
    if(!W.rolls.length) return;
    for(const r of W.rolls) if(W.t >= r.until || r.members.every(s => r.choices[s] || !W.heroes[s])) SIM.rollEnd(W, r);
    W.rolls = W.rolls.filter(r => !r.done);
  },
  socialSnapshot(W){
    return {
      pt: Object.values(W.parties).map(p => [p.id, p.leader, p.members.slice()]),
      iv: W.invites.map(i => [i.from, i.to]),
      r: W.rolls.map(r => [r.id, r.item, Math.max(0, Math.ceil(r.until - W.t)), r.members, Object.keys(r.choices)]),
    };
  },
});
