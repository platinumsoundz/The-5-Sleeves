# The 5 Sleeves 2D — hosting and integration contract

Status: integration plan; preserve the working Render deployment.

## Canonical hosting roles

- Keep Render as the current runtime for the 2D online game because the app uses Node.js, Express and Socket.IO.
- Keep the Git repository as the source of truth and retain the existing Render service configuration and environment variables.
- Do not move the server to Cloudflare Pages: Pages is static hosting and is not a replacement for this game's long-lived Node.js/Socket.IO runtime.
- Cloudflare Workers may be used later for specific edge endpoints or routing, but only if a measured need exists and WebSocket/session behaviour is explicitly tested.

## Runtime boundaries

- Express serves the web client and application routes.
- Socket.IO is the authoritative real-time transport for multiplayer. Any host or proxy change must preserve WebSocket upgrade behaviour, sticky/session assumptions if introduced, timeouts and CORS/origin policy.
- Server-side state and validation remain authoritative. Never trust client-provided XP, currency, inventory, combat results or user identity.
- Do not put server secrets in client bundles or public `NEXT_PUBLIC_*`-style variables.

## Sanctuary integration contract

Sanctuary may provide a launch link to the existing Render URL. This is a link-out, not shared authentication. Do not claim Sanctuary login, wallet, user profile or entitlements carry over unless a real server-verified integration is implemented.

A future launch flow should use a versioned HTTPS API contract and short-lived scoped tokens verified server-side. Require exact origin allowlists, token expiry, replay protection and explicit account-linking consent. Never put durable credentials or private keys in URL query parameters. Keep the game independently playable if Sanctuary is unavailable.

## Compatibility requirements

1. Preserve the existing Render URL and current production behaviour.
2. Configure the canonical public URL through server environment/config, not hard-coded across client code.
3. Keep Socket.IO CORS/origin allowlists explicit; do not use wildcard origins with credentialed requests.
4. Ensure health/readiness endpoints disclose no secrets or personal data.
5. Keep account sync, cross-game progression and purchases disabled until end-to-end tests and a threat review exist.

## Automated release checklist

- [ ] `npm test` passes against the exact commit.
- [ ] Render install/start command and Node engine remain compatible.
- [ ] HTTP health check and Socket.IO handshake smoke tests pass against a preview/staging service.
- [ ] Reconnection, disconnect cleanup, room membership and server-authoritative progression tests pass.
- [ ] CORS and origin rejection tests pass.
- [ ] Sanctuary link opens the 2D game without implying shared identity or cloud-save support.

## Explicit non-goals

No migration off Render, no shared database or user identity, and no change to game economy is authorized by this contract.
