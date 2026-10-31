// Component contracts for the preserved Bennedict stage and read-only dashboard.
// Browser/provider boundaries are controlled doubles; no audio, network mutation or paid calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read = (file) => fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
const compile = (file) => ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const jsx = (type, props) => ({ type, props });
const flatten = (node) => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children, node.props?.right].flat(Infinity).flatMap(flatten)];
const text = (node) => !node || typeof node !== 'object' ? String(node ?? '') : [node.props?.children].flat(Infinity).map(text).join(' ');
const fakeMotion = new Proxy({}, { get: (_obj, key) => `motion.${String(key)}` });
function hooks() {
  const slots = [], effects = []; let cursor = 0;
  return { slots, effects, reset() { cursor = 0; effects.length = 0; }, react: {
    useState(initial) { const id = cursor++; if (!(id in slots)) slots[id] = typeof initial === 'function' ? initial() : initial; return [slots[id], (next) => { slots[id] = typeof next === 'function' ? next(slots[id]) : next; }]; },
    useRef(initial) { const id = cursor++; return slots[id] ||= { current: initial }; },
    useEffect(effect) { effects.push(effect); },
    useMemo(fn) { return fn(); }, useSyncExternalStore(_subscribe, snapshot) { return snapshot(); },
  } };
}
const initial = () => ({ connected: true, shipperOnline: false, role: 'phone', generation: 'g1', dataSource: 'synthetic', mode: 'live', resetting: false, started: false, finishing: false, callLog: [], phase: 'idle', hasSavedOutcome: false, messages: [], call: { status: 'idle', caption: '' }, steps: {}, card: null, order: { id: 'actual-order', buyer: 'Actual buyer', item: 'Actual item', cod: '250 VND', address: 'Actual address' }, connection: { status: 'disconnected', paired: false, soundReady: false, microphone: 'off', canInitiate: false, canAnswer: false } });
{
  const h = hooks(), output = {}, calls = []; let state = initial();
  vm.runInNewContext(compile('components/live/shipper.tsx'), { exports: output, require: (name) => name === 'react/jsx-runtime' ? { jsx, jsxs: jsx } : name === '@/lib/live/state' ? { useLiveState: (role) => { assert.equal(role, 'phone'); return { state, connect: () => calls.push('connect'), sendOutcome: (outcome) => calls.push(outcome), answer: () => calls.push('answer'), end: () => calls.push('end'), setMuted: (muted) => calls.push(['muted', muted]) }; } } : {} });
  const render = () => { h.reset(); return flatten(output.LiveShipper()); };
  let tree = render(), buttons = tree.filter((node) => node.type === 'button');
  assert.deepEqual(buttons.map(text), ['CONNECT', 'Restart demo']); buttons[0].props.onClick(); assert.deepEqual(calls, ['connect'], 'CONNECT only pairs, never initiates route');
  state = { ...state, connection: { ...state.connection, status: 'paired', canInitiate: true } }; tree = render();
  const initiate = tree.find((node) => node.type === 'button'); assert.match(text(initiate), /Initiate route A/); assert.equal(initiate.props.disabled, false); initiate.props.onClick(); assert.equal(calls.at(-1), 'A');
  assert.equal(text(tree[0]).includes('Refused'), false); assert.equal(text(tree[0]).includes('Rescheduled'), false, 'Route B/C actions are absent');
  state = { ...state, connection: { ...state.connection, status: 'ringing', canAnswer: true } }; tree = render();
  const answer = tree.find((node) => node.type === 'button' && text(node) === 'Accept call'); answer.props.onClick(); assert.deepEqual(tree.filter((node) => node.type === 'button' && flatten(tree.find((item) => item.props?.role === 'alertdialog')).includes(node)).map(text), ['Accept call'], 'the incoming call offers exactly one action'); assert.equal(calls.at(-1), 'answer');
  state = { ...state, finishing: true, connection: { ...state.connection, status: 'ended', canAnswer: false } }; tree = render();
  assert.deepEqual(tree.filter((node) => node.type === 'button').map(text), ['Restart demo'], 'finishing offers only the way out, not another call action or Request Help');
  assert.ok(text(tree[0]).includes('Please wait for the saved result'));
  state = { ...state, finishing: false, connection: { ...state.connection, status: 'connected', voice: { activity: 'listening', muted: false } } }; tree = render();
  const mute = tree.find((node) => node.type === 'button' && text(node) === 'Mute'); assert.equal(mute.props['aria-pressed'], false); mute.props.onClick(); assert.deepEqual(calls.at(-1), ['muted', true]);
  state = { ...state, connection: { ...state.connection, voice: { activity: 'listening', muted: true } } }; tree = render();
  const unmute = tree.find((node) => node.type === 'button' && text(node) === 'Unmute'); assert.equal(unmute.props['aria-pressed'], true); assert.ok(text(tree[0]).includes('Alodi can’t hear you'), 'muted overrides the listening prompt'); unmute.props.onClick(); assert.deepEqual(calls.at(-1), ['muted', false]);

}
{
  const h = hooks(), output = {}, calls = []; let confirm = false;
  const state = { ...initial(), role: 'display', started: true, messages: [{ from: 'agent', kind: 'chat', text: 'Actual workflow chat' }, { from: 'agent', kind: 'voice', text: 'Actual assistant utterance' }, { from: 'buyer', kind: 'voice', text: 'Actual buyer speech' }], card: { when: 'Actual saved slot', where: 'Actual saved place', who: 'Actual receiver' }, result: { status: 'applied' }, hasSavedOutcome: true };
  vm.runInNewContext(compile('components/live/stage.tsx') + '\nexports.CustomerPhone=CustomerPhone; exports.AgentRun=AgentRun;', { exports: output, Date, window: { confirm: () => confirm, location: { search: '?session=judge-a', origin: 'https://demo.example' } }, require: (name) => name === 'react' ? h.react : name === 'react/jsx-runtime' ? { jsx, jsxs: jsx } : name === '@/components/demo/stage' ? { useFit: () => ({ ref: {}, scale: 1 }) } : name === '@/lib/live/session' ? { liveSessionId: (search) => new URLSearchParams(search).get('session') } : name === '@/lib/live/state' ? { AGENT_STEPS: [], useLiveState: (role) => { assert.equal(role, 'display'); return { state, reset: () => calls.push('reset'), refresh() {}, setDashboardSound: (on) => calls.push(['sound', on]) }; } } : {} });
  const tree = flatten(output.LiveStage()), frame = tree.find((node) => node.type === 'iframe');
  assert.equal(frame.props.src, '/console?session=judge-a', 'the dashboard stays on this session'); assert.deepEqual(JSON.parse(JSON.stringify(frame.props.style)), { width: 1440, height: 1052, transform: 'scale(0.669)' });
  const stage = tree.find((node) => node.props?.style?.width === 1760); assert.equal(stage.props.style.height, 770, 'original stage geometry remains unchanged');
  const sound = tree.find((node) => node.type === 'button' && /Dashboard sound/.test(text(node))); assert.match(text(sound), /Off/, 'dashboard sound starts off'); assert.equal(sound.props['aria-pressed'], false); sound.props.onClick(); assert.deepEqual(calls.at(-1), ['sound', true]);
  assert.equal(text(tree[0]).includes('judge-a'), false, 'the dashboard does not display its session');
  const reset = tree.find((node) => node.type === 'button' && text(node) === 'Restart demo'); reset.props.onClick(); assert.equal(calls.includes('reset'), false); confirm = true; reset.props.onClick(); assert.equal(calls.at(-1), 'reset', 'reset requires explicit global confirmation');
  h.reset(); const phone = output.CustomerPhone({ state, clock: 600 }); assert.ok(text(phone).includes('Actual workflow chat')); assert.ok(text(phone).includes('Actual assistant utterance')); assert.ok(text(phone).includes('Actual buyer speech'));
  const viewport = { scrollTop: 0, scrollHeight: 400 }; h.slots[0].current = viewport; h.effects[0](); assert.equal(viewport.scrollTop, 400, 'only transcript viewport scrolls');
  const agent = output.AgentRun({ state }); assert.ok(text(agent).includes('Actual saved slot')); assert.ok(text(agent).includes('Actual saved place'));
  const beforeA = output.CustomerPhone({ state: { ...state, started: false, call: { status: 'ringing', caption: 'Prior call caption' }, callLog: [{ id: 'old', at: '2026-10-31T10:00:00+07:00', status: 'missed', text: 'Prior missed call' }] }, clock: 600 });
  assert.ok(text(beforeA).includes('Delivery Assistant'), 'phone frame and header are preserved');
  for (const hidden of ['Actual workflow chat', 'Actual assistant utterance', 'Prior missed call', 'Prior call caption', 'No messages yet']) assert.equal(text(beforeA).includes(hidden), false, 'customer content is completely blank before actual Route A initiation');
  const missed = output.CustomerPhone({ state: { ...state, callLog: [{ id: 'missed-actual', at: '2026-10-31T10:00:02+07:00', status: 'missed', text: 'Actual missed call' }] }, clock: 600 });
  const missedText = text(missed);
  assert.ok(missedText.indexOf('Actual workflow chat') < missedText.indexOf('Actual missed call'));
  assert.ok(missedText.indexOf('Actual missed call') < missedText.indexOf('Actual assistant utterance'), 'actual missed call log stays between rescue chat and voice conversation');
  const log = flatten(missed).find((node) => node.type === 'time'); assert.equal(log.props.dateTime, '2026-10-31T10:00:02+07:00');
  const finishing = output.CustomerPhone({ state: { ...state, finishing: true, connection: { ...state.connection, status: 'ended' } }, clock: 600 });
  assert.ok(text(finishing).includes('Saving delivery details'));
  assert.equal(text(finishing).includes('Conversation completed'), false, 'finish request never implies completion before backend result settles');
  assert.ok(text(output.AgentRun({ state: { ...state, finishing: true } })).includes('Saving delivery details · please wait'));

}
{
  const h = hooks(), adapter = {}, calls = [], timers = new Map(); let timer = 0;
  class Monitor { constructor(base, order, observe) { calls.push({ base, order, observe }); } subscribe() { return () => calls.push('unsubscribe'); } start() { calls.push('observe'); } stop() { calls.push('stop'); } }
  vm.runInNewContext(compile('lib/dash/live-dashboard.ts'), { exports: adapter, AbortController, window: { location: { origin: 'https://gateway.example:8443', search: '?session=judge-a' } }, setTimeout: (fn) => { timers.set(++timer, fn); return timer; }, clearTimeout: (id) => timers.delete(id), require: (name) => name === 'react' ? h.react : name === '../live/session' ? { liveApiBase: (location) => `${location.origin}/api/s/judge-a` } : name === '../ai/live-demo' ? { DEMO_ORDER: 'actual-order', LiveOrderMonitor: Monitor } : name === '../ai/protocol' ? { request: async (path, _options, base) => { calls.push({ path, base }); return { ...adapter.EMPTY_DASHBOARD, generation_id: 'g1' }; }, errorMessage: (error) => error.message } : (() => { throw new Error(`Unexpected dashboard dependency ${name}`); })() });
  adapter.useDashboard(); const cleanup = h.effects[0](); for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.ok(calls.some((call) => call.path === '/demo/dashboard' && call.base === 'https://gateway.example:8443/api/s/judge-a'));
  assert.ok(calls.some((call) => call.observe === true)); assert.equal(calls.some((call) => call.role), false, 'iframe never claims display/phone pairing');
  cleanup(); assert.equal(timers.size, 0); assert.ok(calls.includes('stop'));
  assert.equal(adapter.caseStage({ state: 'rescheduled', status: 'out_for_delivery' }), 'ready');
  assert.equal(adapter.caseStage({ state: 'needs_review', status: 'with_cs' }), 'review');
  assert.equal(adapter.EMPTY_DASHBOARD.day.memo_seconds, null, 'unmeasured audio duration never claims zero measured minutes');
  const h2 = hooks(), overview = {}; let current = adapter.EMPTY_DASHBOARD, observed = { records: [] };
  vm.runInNewContext(compile('components/dash/overview.tsx'), { exports: overview, require: (name) => name === 'react' ? h2.react : name === 'react/jsx-runtime' ? { jsx, jsxs: jsx } : name === 'motion/react' ? { motion: fakeMotion } : name === '@/lib/dash/live-dashboard' ? { useDashboard: () => ({ data: current, observed, error: '' }), caseStage: adapter.caseStage } : name === './case-detail' ? { stageProgress: () => 0, stageChip: () => '' } : {} });
  let tree = flatten(overview.Overview()); const json = tree.find((node) => node.type === 'details' && text(node).includes('Selected order JSON')); const details = { open: false }; json.props.ref.current = details; h2.effects[0](); assert.equal(details.open, false);
  current = { ...adapter.EMPTY_DASHBOARD, generation_id: 'g1', selected_order: { tracking_id: 'actual-order', context_card: { window: 'Actual confirmed window' } } };
  h2.reset(); tree = flatten(overview.Overview()); h2.effects[0](); assert.equal(details.open, true, 'actual saved result auto-opens existing JSON detail');
  details.open = false; h2.reset(); overview.Overview(); h2.effects[0](); assert.equal(details.open, false, 'manual collapse is respected after first auto-open in same generation');
}
console.log('PASS: preserved stage/iframe geometry, actual chat/voice/card binding, explicit phone CONNECT→A→Answer, global reset confirmation, local transcript scrolling, read-only dashboard polling and once-per-generation saved JSON opening (controlled component boundaries).');
