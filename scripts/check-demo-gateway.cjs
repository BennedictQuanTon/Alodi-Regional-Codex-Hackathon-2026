// Fake shared backend contracts: no real workflow reset or provider requests.
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const { createGateway } = require('./demo-gateway.cjs');
const servers = []; const sockets = new Set(); const gateways = [];

async function listen(server) {
  servers.push(server);
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}
function wsReply(req, socket, message) {
  const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] +
    '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
  const text = Buffer.from(JSON.stringify(message));
  socket.write(Buffer.concat([Buffer.from([0x81, text.length]), text]));
  socket.on('data', data => { if ((data[0] & 15) === 8) socket.end(Buffer.from([0x88, 0])); });
}
async function request(base, route, payload, origin) {
  const res = await fetch(base + route, { redirect: 'manual',
    ...(payload === undefined ? {} : { method: 'POST', body: JSON.stringify(payload) }),
    headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) } });
  return { status: res.status, headers: res.headers, body: await res.json().catch(() => null) };
}
async function websocket(base, route) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket((base + route).replace(/^http/, 'ws'));
    ws.addEventListener('message', event => resolve({ ws, message: JSON.parse(event.data) }), { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
}
async function rejectedUpgrade(base, route, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(base + route, { headers: { Connection: 'Upgrade', Upgrade: 'websocket',
      'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), 'Sec-WebSocket-Version': '13',
      ...headers } });
    req.on('response', res => { res.resume(); resolve(res.statusCode); });
    req.on('upgrade', (_, socket) => { socket.destroy(); resolve(101); });
    req.on('error', reject); req.end();
  });
}
async function main() {
  const state = { generation: crypto.randomUUID(), version: 3, resets: 0 };
  const upgrades = [];
  const backend = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/demo/workflow-reset') {
      state.resets += 1; state.generation = crypto.randomUUID(); state.version = 3;
    }
    if (req.method === 'POST' && req.url === '/orders/order/events') state.version += 1;
    req.resume();
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'public, max-age=999' });
    res.end(JSON.stringify({ path: req.url, forwardedHost: req.headers['x-forwarded-host'], ...state }));
  });
  backend.on('upgrade', (req, socket) => {
    upgrades.push(req.headers);
    wsReply(req, socket, { path: req.url, generation: state.generation });
  });
  const backendTarget = await listen(backend);
  const frontend = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ page: req.url, host: req.headers.host, origin: req.headers.origin,
      forwardedHost: req.headers['x-forwarded-host'], referer: req.headers.referer }));
  });
  frontend.on('upgrade', (req, socket) => wsReply(req, socket, { frontend: true }));
  const frontendTarget = await listen(frontend);
  async function launch(options = {}) {
    const gateway = createGateway({ backendTarget, frontendTarget, ...options }); gateways.push(gateway);
    gateway.base = await listen(gateway.server); return gateway;
  }
  let gate = await launch();
  for (const page of ['/', '/demo', '/demo/start', '/demo/live?mode=dev&view=phone',
    '/demo/live?mode=official&view=buyer']) {
    const result = await request(gate.base, page);
    assert.equal(result.status, 200); assert.equal(result.body.page, page);
    assert.equal(result.body.host, new URL(frontendTarget).host);
  }
  const first = await request(gate.base, '/api/orders/order');
  const forwardedPost = await request(gate.base, '/live', {}, gate.base);
  assert.equal(forwardedPost.body.origin, frontendTarget);
  assert.equal(forwardedPost.body.forwardedHost, new URL(frontendTarget).host);
  assert.equal(first.headers.get('cache-control'), 'no-store');
  await request(gate.base, '/api/orders/order/events', { button: 'A' });
  const views = await Promise.all(['driver', 'buyer', 'monitor'].map(() => request(gate.base, '/api/orders/order')));
  assert.ok(views.every(item => item.body.generation === first.body.generation && item.body.version === 4));
  assert.equal(state.resets, 0, 'Opening views must never reset the workflow');
  const old = 'OpaqueRetiredToken1234567890123456';
  for (const route of ['/demo-rooms', '/demo-rooms/' + old, '/rooms/' + old + '/api/health',
    '/sessions/1/api/health', '/fixture-api/ai/config']) {
    assert.equal((await request(gate.base, route)).status, 410);
    assert.equal(await rejectedUpgrade(gate.base, route + '/ws/call'), 410);
  }
  assert.equal((await request(gate.base, '/demo-rooms', { client_id: crypto.randomUUID(), mode: 'dev' })).status, 410);
  const redirects = new Map([
    ['/testers', '/demo/start'], ['/testers/2', '/demo/start'], ['/dev/integrated?session=1', '/demo/start'],
    ['/demo/live?room=' + old + '&mode=dev&view=combined', '/demo/live?mode=dev&view=phone'],
    ['/demo/live?room=' + old + '&mode=official&view=process', '/demo/live?mode=official&view=monitor'],
    ['/demo/live?session=3&mode=official&view=logs', '/demo/live?mode=official&view=monitor'],
    ['/demo/live?room=' + old + '&mode=official&view=buyer', '/demo/live?mode=official&view=buyer'],
    ['/demo/live?room=' + old + '&mode=official&view=driver', '/demo/live?mode=official&view=driver'],
  ]);
  for (const [route, destination] of redirects) {
    const result = await request(gate.base, route);
    assert.equal(result.status, 302); assert.equal(result.headers.get('location'), destination);
    assert.ok(!result.headers.get('location').includes(old));
  }
  assert.equal((await request(gate.base, '/api/orders/order/events', {}, 'http://unrelated.invalid')).status, 403);
  assert.equal(await rejectedUpgrade(gate.base, '/api/demo/route-a/ws', {
    origin: 'https://unrelated.invalid', 'x-forwarded-host': new URL(gate.base).host,
  }), 403, 'A forged forwarding header cannot bypass WebSocket origin validation');
  assert.equal(await rejectedUpgrade(gate.base, '/api/demo/route-a/ws', {
    origin: gate.base, 'x-forwarded-host': 'unrelated.invalid', 'x-forwarded-for': '192.0.2.1',
  }), 101);
  assert.equal(upgrades.at(-1)['x-forwarded-host'], new URL(gate.base).host);
  assert.equal(upgrades.at(-1)['x-forwarded-for'], undefined);
  const sanitized = await fetch(gate.base + '/api/health', {
    headers: { 'x-forwarded-host': 'unrelated.invalid' },
  }).then(res => res.json());
  assert.equal(sanitized.forwardedHost, new URL(gate.base).host);
  assert.equal((await request(gate.base, '/api//outside.invalid')).status, 400);
  assert.equal(await rejectedUpgrade(gate.base, '/api//outside.invalid'), 400);
  const live = await websocket(gate.base, '/api/ws/call?session=synthetic');
  assert.deepEqual(live.message, { path: '/ws/call?session=synthetic', generation: state.generation });
  const hmr = await websocket(gate.base, '/_next/webpack-hmr');
  assert.equal(hmr.message.frontend, true);
  const liveClosed = new Promise(resolve => live.ws.addEventListener('close', resolve, { once: true }));
  const hmrClosed = new Promise(resolve => hmr.ws.addEventListener('close', resolve, { once: true }));
  const beforeRestart = { ...state };
  await gate.close(); await Promise.all([liveClosed, hmrClosed]);
  gate = await launch();
  const resumed = await request(gate.base, '/api/orders/order');
  assert.equal(resumed.body.generation, beforeRestart.generation);
  assert.equal(resumed.body.version, beforeRestart.version);
  assert.equal(state.resets, 0, 'Gateway restart must preserve the shared workflow');
  await request(gate.base, '/api/demo/workflow-reset', { generation_id: state.generation });
  const fresh = await request(gate.base, '/api/orders/order');
  assert.notEqual(fresh.body.generation, beforeRestart.generation);
  assert.equal(state.resets, 1, 'Only an explicit user reset changes generation');
  const preview = await launch({ previewRoutes: true });
  for (const [route, destination] of [['/demo', '/live'], ['/demo/start', '/live'],
    ['/demo/live', '/live'], ['/demo/live?view=phone', '/live/shipper'],
    ['/demo/live?view=buyer&room=retired', '/live/shipper']]) {
    const result = await request(preview.base, route);
    assert.equal(result.status, 302); assert.equal(result.headers.get('location'), destination);
  }
  assert.equal((await request(preview.base, '/live')).body.page, '/live');
  assert.equal((await request(preview.base, '/live/shipper')).body.page, '/live/shipper');
  assert.equal((await request(preview.base, '/console')).body.page, '/console');
  // Each session id reaches only its own backend; nothing else reaches any backend.
  const tagged = name => {
    const server = http.createServer((req, res) => {
      req.resume(); res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ name, path: req.url }));
    });
    server.on('upgrade', (req, socket) => wsReply(req, socket, { name, path: req.url }));
    return listen(server);
  };
  const scoped = await launch({ previewRoutes: true, sessions: { 'judge-a-1': await tagged('a'), 'judge-b-2': await tagged('b') } });
  assert.deepEqual((await request(scoped.base, '/api/s/judge-a-1/demo/clock?x=1')).body, { name: 'a', path: '/demo/clock?x=1' });
  assert.deepEqual((await request(scoped.base, '/api/s/judge-b-2/demo/clock')).body, { name: 'b', path: '/demo/clock' });
  const scopedSocket = await websocket(scoped.base, '/api/s/judge-b-2/demo/route-a/ws?role=phone');
  assert.deepEqual(scopedSocket.message, { name: 'b', path: '/demo/route-a/ws?role=phone' }); scopedSocket.ws.close();
  for (const route of ['/api/health', '/api/s/nope/health', '/api/s/']) {
    const denied = await request(scoped.base, route);
    assert.equal(denied.status, 404, route); assert.equal(denied.body.code, 'unknown_session');
  }
  assert.equal(await rejectedUpgrade(scoped.base, '/api/demo/route-a/ws'), 404);
  assert.equal(await rejectedUpgrade(scoped.base, '/api/s/nope/demo/route-a/ws'), 404);
  assert.equal((await request(scoped.base, '/api/s/judge-a-1//outside.invalid')).status, 400);
  for (const page of ['/live', '/live/shipper', '/live?session=nope', '/live/shipper?session=nope']) {
    const blocked = await fetch(scoped.base + page, { redirect: 'manual' });
    assert.equal(blocked.status, 404, page); assert.match(await blocked.text(), /not valid/);
  }
  for (const page of ['/live?session=judge-a-1', '/live/shipper?session=judge-b-2']) {
    assert.equal((await request(scoped.base, page)).body.page, page);
  }
  console.log('Shared gateway checks passed: landing/Watch forwarding, shared views, no implicit reset, HTTP/WS, legacy retirement, origin/path guards and restart preservation.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await Promise.allSettled(gateways.map(gateway => gateway.close()));
  for (const socket of sockets) socket.destroy();
  await Promise.all(servers.filter(server => server.listening).map(server => new Promise(resolve => server.close(resolve))));
});
