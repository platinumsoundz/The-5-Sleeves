# The 5 Sleeves 2D — Cloudflare and Guild hosting

## Target architecture

- Cloudflare Pages serves the existing browser client from `public/`.
- A Pages catch-all Function forwards only `/socket.io/*`, `/api/*`, and `/health` to the existing Node/Socket.IO backend.
- The upstream backend origin is stored as the Pages secret `GAME_SERVER_ORIGIN`; it is not included in the client bundle or public source.
- Guild embeds the Pages URL in its console player. The 2D client implements the same `guild.5-sleeves` version 1 pause/resume and acknowledgement contract as the 3D game.
- Standalone mode remains supported when the game is opened outside Guild.

## Cloudflare Pages project

Create a Git-connected Pages project named `the-5-sleeves-2d`:

- Repository: `platinumsoundz/The-5-Sleeves`
- Production branch: `main` (keep production deployments gated until upstream configuration and end-to-end checks pass)
- Root directory: `/public`
- Build command: empty
- Build output directory: `.`
- Preview deployments: all branches
- Pages Function: `functions/[[path]].js`
- Required secret in both Preview and Production environments: `GAME_SERVER_ORIGIN`, set to the existing Node service's HTTPS origin (origin only, no path or credentials).

The existing Node service remains responsible for accounts, Socket.IO sessions, game simulation and player-profile persistence. Do not migrate or overwrite its profile store as part of this hosting change.

## Required verification before switching Guild production

1. Configure the real HTTPS upstream origin as a Cloudflare Pages secret. Do not commit it.
2. Confirm `/health` is proxied and returns the backend health response.
3. Confirm `/socket.io/socket.io.js` is proxied and the browser connects over same-origin Socket.IO.
4. Confirm WebSocket upgrade and polling fallback, authentication, join, multiplayer movement, profile persistence, reconnect and module manifest.
5. Confirm PWA service worker does not cache backend endpoints.
6. Confirm Guild pause/resume acknowledgements, visibility pause, fullscreen, exit-to-library and exit-to-Guild.
7. Keep the existing Render service running until these checks pass and the profile data backup/rollback plan is recorded.

## Important boundary

The Render origin is used only as a private upstream service target. Players and Guild use the Cloudflare Pages origin. This is a hosting/proxy transition, not a backend migration; the existing backend and its persistent data remain authoritative until a separately planned migration is approved.
