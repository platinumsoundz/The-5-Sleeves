'use strict';

const RENDER_HOST = 'the-5-sleeves.onrender.com';

function firstHeader(value) {
  return typeof value === 'string' ? value.split(',')[0].trim() : '';
}

// Render terminates TLS before Socket.IO. Trust its forwarded scheme only for
// our deployed host; other reverse proxies require explicit opt-in.
function secureTransport(socket) {
  if (process.env.NODE_ENV === 'development') return true;
  const request = socket?.request;
  if (socket?.handshake?.secure === true || request?.secure === true || request?.connection?.encrypted === true) return true;

  const headers = socket?.handshake?.headers || request?.headers || {};
  const protocol = firstHeader(headers['x-forwarded-proto']).toLowerCase();
  if (protocol !== 'https') return false;
  const forwardedHost = firstHeader(headers['x-forwarded-host']);
  const host = (forwardedHost || firstHeader(headers.host)).split(':')[0].toLowerCase();
  return host === RENDER_HOST || process.env.TRUSTED_PROXY_TLS === 'true';
}

module.exports = secureTransport;
