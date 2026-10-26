# The 5 Sleeves Online — integration handover

Updated: 26 October 2026

## Completed on working branches

- Documented the existing hosting boundary: keep the Node.js/Express/Socket.IO game on its current Render service.
- Documented safe integration expectations for Sanctuary without moving game-server authority into the browser.
- Added a server smoke test that checks the health endpoint, game shell/client assets and an Engine.IO polling handshake (`EIO=4&transport=polling`).
- Added an isolated GitHub Actions smoke-test job so the multiplayer transport check can be read independently from the broader suite.

## Validation status

- The isolated Socket.IO handshake smoke-test job passed in GitHub Actions.
- The broader existing test suite has four known failures unrelated to the new handshake test: biome expectations, compact HUD bounds, fullscreen-settings assertion and sprite sleeve positioning. Their intended behavior must be checked before altering gameplay or UI.
- The exact canonical Render URL has not yet been verified here. Do not copy an assumed hostname into Sanctuary configuration.
- The branch/PR is still a draft and has not been merged by this work.

## Remaining work

1. Confirm the canonical service URL in Render or the repository's deployment settings; configure Sanctuary's `NEXT_PUBLIC_5_SLEEVES_2D_URL` only after confirmation.
2. Capture full assertion messages and expected behavior for the four broad-suite failures; decide whether tests or implementation are stale before changing anything.
3. Run health and Socket.IO handshake tests against the deployed Render host from an external runner.
4. Review Socket.IO CORS/origin allowlists, authentication, rate limits, reconnect behavior and authoritative server-side state before exposing new integration endpoints.
5. Design and test short-lived launch-token verification only after the Sanctuary account-linking design is approved. Never trust browser-provided identity or balance.
6. Merge only after CI and deployment smoke checks are clean.

## Explicitly not done

- No production server behavior, authentication, origins, persistence or gameplay was changed by the handshake-test change.
- No shared identity, cross-game save, wallet or token bridge is implemented.
- No manual gameplay/device testing is claimed.

## Related PRs

- Hosting/integration contract: https://github.com/platinumsoundz/The-5-Sleeves/pull/2
- Socket.IO transport smoke test: https://github.com/platinumsoundz/The-5-Sleeves/pull/3
- Sanctuary Games Hub: https://github.com/platinumsoundz/Guild-Sanctuary/pull/17
