# The 5 Sleeves 2D

**A browser-based multiplayer action RPG set after *The 5 Sleeves*.** Play a new operative in the comic’s aftermath, explore a chain of settlements and dangerous roads, fight hostile Rust Warden drones, develop your operative, and clear regional towers to open the way east.

## The aim

The immediate game goal is to travel from the First Village through the five regional roads, cities, and towers. Survive each region, gather XP and credits, improve your skills and gear, and restore the tower network one tower at a time. Reaching new cities unlocks safer respawn points and the next part of the route.

This game is a post-comic continuation, not a retelling of the comic. The comic’s events are history; a new operative explores the connected-world ruins and restores the tower network. The allied Cipher AI first appears after the operative clears a tower, then offers help with the journey ahead. Restoring towers improves local conditions without magically repairing the whole planet.

## What you can do

- **Choose a faction:** play as one of five Sleeves—Wind, Water, Earth, Fire, or Dark—with a faction-specific aura and signature ability. Cipher is an allied AI, not a playable faction. Customize your suit palette.
- **Fight and grow:** use server-resolved combat, dash and shield actions, and a unique ability for your domain. Earn XP, level up, unlock skill-tree nodes, and equip gear.
- **Explore the world:** travel between six safe cities, five wilderness roads, five tower rooms, and private arena modes. City roads open as their regional tower is cleared; fast-travel is available to unlocked cities.
- **Take on PvE and PvP:** battle patrolling Rust Wardens, clear tower waves, collect Archive Echoes, or enter cooperative and competitive arenas with domination, team deathmatch, and tower-capture modes.
- **Trade and socialize:** buy and sell with city merchants, form parties, chat, add friends, send gifts, and claim inbox attachments.
- **Discover the setting:** read Archive terminals and explore regional environments. Cities and towers use distinct biome art; wilderness roads share a weathered wasteland look.

## Game systems

The game is built around a **server-authoritative multiplayer simulation**: the server owns combat outcomes, progression, rewards, and persistent profiles; browser clients send input and render synchronized state.

- **Server:** Node.js, Express, and Socket.IO; per-zone simulations; fixed-timestep combat and AI; profile persistence; progression, economy, parties, chat, arenas, and tower services.
- **Client:** HTML, CSS, JavaScript modules, Canvas rendering, keyboard/touch/gamepad input, interpolation, audio, HUD, and menus.
- **World and combat:** five playable Sleeve abilities, Rust Warden AI, projectiles and status effects, relay objectives, environmental hazards, safe havens, and tower wave encounters.
- **Progression and economy:** XP and levels, skill points and a branching skill tree, gear and equipment bonuses, credits, loot, and merchant trading.
- **Social and persistence:** guest play and optional username/password accounts, friends, parties, chat, inbox, gifting, and saved operative profiles.
- **Modularity:** server and client features are discovered from module folders at startup, keeping systems separable from the game hosts.
- **Visuals:** baked pixel-art operative and Warden sprites with procedural fallbacks; biome-specific procedural backgrounds, animated effects, tower landmarks, and a tactical minimap.

## Run locally

Requirements: Node.js 18 or later.

```sh
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). To run the automated test suite, use:

```sh
npm test
```

To regenerate the baked pixel-art sprites:

```sh
npm run sprites
```

## Project notes

- `ROADMAP.md` tracks the original expansion roadmap; `ROADMAP-FUTURE.md` contains proposals and owner-directed follow-up work.
- The universe canon and contributor guidance live in `lore/` and `memory/`. Read `memory/00-index.md` and `memory/01-session-protocol.md` before changing game systems or story content.
