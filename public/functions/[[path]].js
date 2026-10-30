/**
 * Cloudflare Pages catch-all.
 *
 * Static game assets are served directly from Pages. Only the live game
 * backend endpoints are forwarded to the existing Node/Socket.IO server.
 * Set GAME_SERVER_ORIGIN as a Pages secret (HTTPS origin only); never place
 * the upstream hostname in client code or a public config file.
 */
const BACKEND_PATHS = ['/socket.io/', '/api/', '/health'];

export async function onRequest(context) {
  const { request, env, next } = context;
  const incoming = new URL(request.url);
  const isBackend = BACKEND_PATHS.some((prefix) =>
    prefix === '/health'
      ? incoming.pathname === prefix
      : incoming.pathname.startsWith(prefix)
  );

  if (!isBackend) return next();

  const configuredOrigin = env.GAME_SERVER_ORIGIN;
  if (!configuredOrigin) {
    return new Response('The 2D game backend is not configured yet.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
    });
  }

  let upstream;
  try {
    upstream = new URL(configuredOrigin);
  } catch {
    return new Response('The 2D game backend configuration is invalid.', { status: 503 });
  }

  if (upstream.protocol !== 'https:' || upstream.username || upstream.password ||
      upstream.pathname !== '/' || upstream.search || upstream.hash ||
      upstream.origin === incoming.origin) {
    return new Response('The 2D game backend must be a separate HTTPS origin.', { status: 503 });
  }

  upstream.pathname = incoming.pathname;
  upstream.search = incoming.search;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.set('x-forwarded-host', incoming.host);
  headers.set('x-forwarded-proto', 'https');

  const forwarded = new Request(upstream.toString(), request);
  const proxyRequest = new Request(forwarded, { headers, redirect: 'manual' });

  try {
    // Cloudflare Workers can forward the upstream 101 WebSocket response;
    // Socket.IO polling and upgrade requests share this same-origin route.
    return await fetch(proxyRequest);
  } catch {
    return new Response('The 2D game server is temporarily unavailable.', {
      status: 502,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
    });
  }
}
