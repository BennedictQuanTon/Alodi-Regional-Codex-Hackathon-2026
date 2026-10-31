// Without sessions, one shared workflow. With sessions, each id reaches only its own backend,
// under /api/s/<id>. This proxy never allocates or resets demo data.
const http = require('node:http');
const path = require('node:path');

function createGateway(options = {}) {
  const { ProxyServer } = options.proxyModule || require(path.join(__dirname,
    '../web/node_modules/next/dist/compiled/httpxy/index.js'));
  const backendTarget = options.backendTarget || 'http://127.0.0.1:8011';
  const frontendTarget = options.frontendTarget || 'http://127.0.0.1:3000';
  const frontendOrigin = new URL(frontendTarget).origin;
  const frontendHost = new URL(frontendTarget).host;
  const sessionTargets = Object.entries(options.sessions || {});
  for (const value of [backendTarget, frontendTarget, ...sessionTargets.map(([, target]) => target)]) {
    const target = new URL(value);
    if (target.protocol !== 'http:' || target.hostname !== '127.0.0.1' || target.username ||
        target.password || target.pathname !== '/' || target.search || target.hash) {
      throw new Error('Gateway targets must be fixed loopback HTTP origins');
    }
  }
  function backendProxy(target) {
    const proxy = new ProxyServer({ target, changeOrigin: true, ws: true, proxyTimeout: 120000 });
    proxy.on('proxyRes', response => { response.headers['cache-control'] = 'no-store'; });
    return proxy;
  }
  const backend = backendProxy(backendTarget);
  const sessions = new Map(sessionTargets.map(([id, target]) => [id, backendProxy(target)]));
  const frontend = new ProxyServer({ target: frontendTarget, changeOrigin: true, ws: true,
    proxyTimeout: 120000 });
  const upgraded = new Set();

  function parsed(req) {
    if (!req.url.startsWith('/') || req.url.startsWith('//') || req.url.includes('\\')) {
      throw Object.assign(new Error('Invalid path'), { status: 400 });
    }
    return new URL(req.url, 'http://gateway.invalid');
  }
  function retired(url) { return /^\/(?:demo-rooms|rooms|sessions|fixture-api)(?:\/|$)/.test(url.pathname); }
  function isApi(url) { return url.pathname === '/api' || url.pathname.startsWith('/api/'); }
  function apiRoute(url) {
    let proxy = backend, pathname = url.pathname.slice(4) || '/';
    if (sessions.size) {
      const match = /^\/s\/([^/]+)(\/.*)?$/.exec(pathname);
      proxy = match && sessions.get(match[1]);
      if (!proxy) throw Object.assign(new Error('Unknown session'), { status: 404 });
      pathname = match[2] || '/';
    }
    if (pathname.startsWith('//')) throw Object.assign(new Error('Invalid API path'), { status: 400 });
    return { proxy, path: pathname + url.search };
  }
  function lockedPage(url) {
    return sessions.size && ['/live', '/live/shipper'].includes(url.pathname) &&
      !sessions.has(url.searchParams.get('session'));
  }
  function invalidLink(res) {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store',
      'x-content-type-options': 'nosniff' });
    res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Link not valid · Alodi</title><body style="font-family:system-ui;max-width:32rem;margin:20vh auto;padding:0 1rem;color:#1f2a44">' +
      '<h1 style="font-weight:500">This demo link is not valid.</h1><p>The live demo only opens from a session link. ' +
      'Ask the Alodi team for yours.</p></body>');
  }
  function frontendHeaders(req) {
    req.headers.host = frontendHost;
    if (req.headers.origin) req.headers.origin = frontendOrigin;
    if (req.headers.referer) req.headers.referer = frontendOrigin + '/';
    req.headers['x-forwarded-host'] = frontendHost;
    req.headers['x-forwarded-proto'] = 'http';
  }
  function sameOrigin(req) {
    if (!req.headers.origin) return true;
    try {
      const origin = new URL(req.headers.origin);
      return ['http:', 'https:'].includes(origin.protocol) && origin.host === req.headers.host;
    } catch { return false; }
  }
  function backendHeaders(req) {
    // Never trust an incoming forwarding header from the public browser.
    req.headers['x-forwarded-host'] = req.headers.host;
    delete req.headers['x-forwarded-for'];
    delete req.headers['x-forwarded-proto'];
  }
  function json(res, status, code, message) {
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store',
      'x-content-type-options': 'nosniff' });
    res.end(JSON.stringify({ code, message }));
  }
  function legacyView(url) {
    const mode = url.searchParams.get('mode') === 'official' ? 'official' : 'dev';
    const previous = url.searchParams.get('view') || '';
    const view = mode === 'dev' ? 'phone' : ['driver', 'buyer'].includes(previous) ? previous : 'monitor';
    return `/demo/live?${new URLSearchParams({ mode, view })}`;
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = parsed(req);
      if (retired(url)) return json(res, 410, 'legacy_workflow_retired',
        'Tester rooms were retired. Open /demo/start for the shared demo.');
      if (req.method === 'POST' && req.headers.origin) {
        if (!sameOrigin(req)) return json(res, 403, 'origin_rejected', 'Use this demo origin.');
      }
      if (isApi(url)) {
        const route = apiRoute(url);
        backendHeaders(req); req.url = route.path; await route.proxy.web(req, res); return;
      }
      if (lockedPage(url)) return invalidLink(res);
      let redirect;
      if (options.previewRoutes === true && ['/demo', '/demo/start', '/demo/live', '/dev/integrated',
          '/testers'].includes(url.pathname)) {
        const phone = ['phone', 'buyer', 'driver'].includes(url.searchParams.get('view'));
        redirect = phone ? '/live/shipper' : '/live';
      }
      if (url.pathname === '/testers' || url.pathname.startsWith('/testers/') ||
          url.pathname === '/dev/integrated') redirect = options.previewRoutes === true ? '/live' : '/demo/start';
      if (url.pathname === '/demo/live' &&
          (url.searchParams.has('room') || url.searchParams.has('session')) &&
          options.previewRoutes !== true) redirect = legacyView(url);
      if (redirect) {
        res.writeHead(302, { location: redirect, 'cache-control': 'no-store' }); res.end(); return;
      }
      frontendHeaders(req); await frontend.web(req, res);
    } catch (error) {
      if (error.status === 404 && !res.headersSent) json(res, 404, 'unknown_session', 'This session link is not valid.');
      else if (!res.headersSent) json(res, error.status === 400 ? 400 : 503,
        error.status === 400 ? 'invalid_path' : 'gateway_unavailable',
        error.status === 400 ? 'Invalid request path.' : 'The local demo service is unavailable.');
      else res.destroy();
    }
  });
  server.on('upgrade', (req, socket, head) => {
    upgraded.add(socket); socket.on('close', () => upgraded.delete(socket));
    try {
      const url = parsed(req);
      if (retired(url)) throw Object.assign(new Error('Retired route'), { status: 410 });
      if (!sameOrigin(req)) throw Object.assign(new Error('Origin rejected'), { status: 403 });
      if (isApi(url)) {
        const route = apiRoute(url);
        backendHeaders(req); req.url = route.path;
        void route.proxy.ws(req, socket, head).catch(() => socket.destroy());
      } else if (url.pathname.startsWith('/_next/')) {
        frontendHeaders(req); void frontend.ws(req, socket, head).catch(() => socket.destroy());
      } else throw Object.assign(new Error('Unknown socket'), { status: 404 });
    } catch (error) {
      socket.end(`HTTP/1.1 ${error.status || 503} Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    }
  });
  async function close() {
    for (const socket of upgraded) socket.destroy();
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
  return { server, close };
}
module.exports = { createGateway };
if (require.main === module) {
  const frontendPort = process.env.DEMO_FRONTEND_PORT || '3000';
  if (!/^\d{1,5}$/.test(frontendPort) || Number(frontendPort) < 1 || Number(frontendPort) > 65535) {
    throw new Error('DEMO_FRONTEND_PORT must be a valid local port');
  }
  // DEMO_SESSIONS is {"<session id>": <backend port>}.
  const sessions = Object.fromEntries(Object.entries(JSON.parse(process.env.DEMO_SESSIONS || '{}'))
    .map(([id, port]) => [id, `http://127.0.0.1:${port}`]));
  const gateway = createGateway({ frontendTarget: `http://127.0.0.1:${frontendPort}`,
    previewRoutes: process.env.DEMO_PREVIEW_ROUTES === 'true', sessions });
  gateway.server.listen(Number(process.env.DEMO_GATEWAY_PORT || 3002), '127.0.0.1',
    () => console.log('Shared demo gateway ready on loopback.'));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal,
    () => void gateway.close().then(() => process.exit(0)));
}
