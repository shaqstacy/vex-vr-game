import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { store, bus, h } from './store.js';
import { World } from './sim/world.js';
import { View } from './sim/view.js';
import { FIELD, MATCH } from './sim/fieldData.js';
import { defaultConfig, DRIVETRAINS, CARTRIDGES, LIFTS, CLAWS, SENSORS, WHEELS } from './sim/robotConfig.js';
import { Runtime } from './code/runtime.js';
import { mountIDE } from './code/ide.js';
import { mountBuilder } from './ui/builder.js';
import { mountChallenges, starsFor, starsEl, missingNeeds, CHALLENGES } from './ui/challenges.js';
import { mountJohn } from './ui/john.js';
import { mountNotebook } from './ui/notebook.js';
import { mountRules } from './ui/rules.js';
import { VRUI } from './ui/vrui.js';

const STEP = 1 / 120;
const $ = (id) => document.getElementById(id);

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
$('scene').append(renderer.domElement);
const scene = new THREE.Scene();
const rig = new THREE.Group();
scene.add(rig);
const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 80);
camera.position.set(-0.4, 3.3, 3.6);
rig.add(camera);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.1, 0);
controls.maxPolarAngle = Math.PI / 2 - 0.03;
controls.minDistance = 0.5; controls.maxDistance = 12;
controls.enableDamping = true;

const saved = store.get('robot');
const world = new World();
if (saved) { try { world.setRobot({ ...defaultConfig(), ...saved, stl: null }); } catch { world.setRobot(defaultConfig()); } }
const view = new View(world, scene);

// John's speech bubble in the 3D scene (visible in VR too)
const bubbleCanvas = document.createElement('canvas'); bubbleCanvas.width = 768; bubbleCanvas.height = 256;
const bubbleTex = new THREE.CanvasTexture(bubbleCanvas); bubbleTex.colorSpace = THREE.SRGBColorSpace;
const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTex, transparent: true, depthTest: false }));
bubble.scale.set(1.5, 0.5, 1); bubble.position.copy(view.john.position).setY(2.25); bubble.visible = false; bubble.renderOrder = 10;
scene.add(bubble);
let bubbleT = 0;

// ---------- app ----------
const app = {
  world, view, renderer, scene,
  session: { challenge: null, mode: 'free', state: 'ready', t0: 0, s: {}, phase: 'free', events: newEvents() },
  lastRun: null, lastJohn: null, speed: 1, trail: true, camMode: 'orbit',
  toast(msg) {
    const d = h('div', msg); $('toast').append(d);
    while ($('toast').childNodes.length > 3) $('toast').firstChild.remove();
    setTimeout(() => d.remove(), 4200);
  },
  openPanel(id) { openPanel(id, true); },
  setRobot(cfg) {
    world.setRobot(cfg);
    store.set('robot', { ...cfg, stl: null });
    view.rebuildRobot(); view.resetObjects(); view.setZones(world.zones);
    app.ide?.renderDevices(); app.challenges?.render();
  },
  getRobotSummary() {
    const c = world.cfg, sp = world.specs;
    const lines = [
      `Drivetrain: ${DRIVETRAINS[c.drivetrain.type].label}, ${CARTRIDGES[c.drivetrain.cartridge].label} cartridges, ${c.drivetrain.wheel}" wheels, gearing ${c.drivetrain.gearing}`,
      `Lift: ${LIFTS[c.lift.type].label}${sp.liftMaxH ? ` (${CARTRIDGES[c.lift.cartridge].label}, reach ${Math.round(sp.liftMaxH * 1000)} mm)` : ''}`,
      `Claw: ${CLAWS[c.claw.type].label}${c.flipper ? ' + pneumatic Toggle flipper' : ''}`,
      sp.usesAir ? `Pneumatics: ${c.pneumatics.tanks} reservoir(s), ${c.pneumatics.psi} psi working pressure` : null,
      `Sensors: ${Object.keys(SENSORS).filter((k) => c.sensors[k]).map((k) => SENSORS[k].label).join(', ') || 'none'}`,
      `Predicted: top speed ${sp.vFree.toFixed(2)} m/s, pushing force ${sp.pushForce.toFixed(0)} N, mass ${sp.mass.toFixed(1)} kg, ${sp.watts} W of 88 W`,
    ].filter(Boolean);
    return { name: c.name ?? 'My Robot', text: lines.map((l) => '- ' + l).join('\n') };
  },
  getCurrentCode: () => app.ide.getSummary(),
  getLastRun: () => (app.lastRun ? { challenge: app.lastRun.challenge?.title ?? 'Free practice', score: Math.round(app.lastRun.score), stars: app.lastRun.stars, time: +app.lastRun.time.toFixed(2), details: app.lastRun.details } : null),
  captureScreenshot() { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/jpeg', 0.85); },
  johnSpeaks(text) {
    app.lastJohn = text;
    const g = bubbleCanvas.getContext('2d');
    g.clearRect(0, 0, 768, 256);
    g.fillStyle = 'rgba(255,255,255,0.96)'; g.beginPath(); g.roundRect(4, 4, 760, 220, 26); g.fill();
    g.beginPath(); g.moveTo(340, 222); g.lineTo(384, 254); g.lineTo(420, 222); g.fill();
    g.fillStyle = '#12161c'; g.font = '30px system-ui'; g.textBaseline = 'top';
    let line = '', y = 22, n = 0;
    for (const word of text.replace(/\n/g, ' ').split(' ')) {
      if (g.measureText(line + word).width > 716 && line) { g.fillText(line, 26, y); y += 38; line = ''; if (++n >= 4) { line = '…'; break; } }
      line += word + ' ';
    }
    g.fillText(line, 26, y);
    bubbleTex.needsUpdate = true; bubble.visible = true; bubbleT = 9; view.john.userData.wave = 1.2;
  },
  showRule(id) { openPanel('rules', true); app.rules?.showRule(id); },
  loadStarter(ch, kind) {
    if (kind === 'blocks' && ch.blocks) app.ide.loadProject({ name: ch.title, mode: 'blocks', blocks: ch.blocks(), python: '' });
    else app.ide.loadProject({ name: ch.title, mode: 'python', python: ch.python });
    openPanel('code', true);
  },
  applyImportedRobot(p) {
    const s = p.summary ?? {}, c = structuredClone(world.cfg);
    c.name = p.name ?? 'Imported robot';
    if (s.drivetrain?.detected !== false && s.drivetrain) {
      c.drivetrain.type = s.drivetrain.type === 'xdrive' ? 'xdrive4' : s.drivetrain.motors <= 2 ? 'tank2' : 'tank4';
      if (s.drivetrain.wheelDiaIn) c.drivetrain.wheel = WHEELS.reduce((a, b) => (Math.abs(b - s.drivetrain.wheelDiaIn) < Math.abs(a - s.drivetrain.wheelDiaIn) ? b : a));
    }
    if (s.lift) c.lift.type = !s.lift.present ? 'none' : s.lift.maxHeightM > 0.8 ? 'dr4b' : s.lift.maxHeightM > 0.5 ? 'fourbar' : 'arm';
    if (s.claw) c.claw.type = s.claw.present ? (s.pistons > 0 ? 'pneumatic' : 'motor') : c.claw.type;
    if (s.pistons > (s.claw?.present ? 1 : 0)) c.flipper = true;
    if (s.tanks) c.pneumatics.tanks = Math.min(2, Math.max(1, s.tanks));
    view.importedGeometry = p.geometry ?? null;
    app.setRobot(c);
    app.builder?.render();
    app.toast(`${c.name} imported: ${DRIVETRAINS[c.drivetrain.type].label}, ${LIFTS[c.lift.type].label.toLowerCase()}, ${CLAWS[c.claw.type].label.toLowerCase()}. Adjust anything in Build.`);
    bus.emit('notebook:log', { phase: 'build', title: `CAD import: ${c.name}`, body: `Imported STL (${p.triangleCount ?? '?'} triangles). Detected features: ${(p.features ?? []).filter((f) => f.accepted !== false).map((f) => f.type).join(', ') || 'none'}.\n` + app.getRobotSummary().text });
  },
  clockText() {
    const ses = app.session, lim = limitOf(ses);
    const el = ses.state === 'running' ? world.time - ses.t0 : ses.state === 'done' ? ses.elapsed ?? 0 : 0;
    const t = Number.isFinite(lim) ? Math.max(0, lim - el) : el;
    return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}.${Math.floor((t * 10) % 10)}`;
  },
  startChallenge, runProgram, stopProgram, resetField, logRun,
};
window.app = app;

function newEvents() { return { dropped: [], timeouts: 0, airLow: false }; }
function limitOf(ses) {
  if (ses.challenge) return ses.challenge.time;
  return { free: Infinity, auton: MATCH.auto, driver: MATCH.driver, match: MATCH.auto + MATCH.driver }[ses.mode];
}

world.on((type, d) => {
  const ev = app.session.events;
  if (type === 'dropped') { ev.dropped.push(d.reason); if (d.reason) app.toast('Dropped: ' + d.reason); }
  else if (type === 'placed') app.toast(`Placed ${d.obj.type} on ${d.goal.kind === 'mid' ? 'the Midfield Goal' : d.goal.kind === 'alliance' ? `a ${d.goal.color} Alliance Goal` : 'a neutral goal'} (level ${d.level + 1}).`);
  else if (type === 'toggle') app.toast(`Toggle → ${d.color.toUpperCase()}`);
  else if (type === 'air-low') { if (!ev.airLow) app.toast(`Out of air: ${Math.round(d.psi)} psi is too low to fire the cylinder.`); ev.airLow = true; }
  else if (type === 'warn') { if (/timed out/.test(d.msg)) ev.timeouts++; app.toast(d.msg); app.ide?.print(d.msg + '\n', 'err'); }
});

const runtime = app.runtime = new Runtime(world, {
  out: (t, cls) => app.ide?.print(t, cls),
  screen: (rows) => app.ide?.setScreen(rows),
  state: (on) => { app.ide?.setRunning(on); refreshTop(); },
  done: (err) => { app.session.programDone = true; app.session.error = err; if (err?.line) app.ide.highlightLine(err.line); if (err) app.toast(err.text); },
});

// ---------- session / match clock ----------
function setupOf(ch) { return ch ? (typeof ch.setup === 'function' ? ch.setup() : ch.setup) : {}; }
async function startChallenge(ch) {
  await runtime.stop();
  app.session = { challenge: ch, mode: ch ? ch.mode : runAs.value, state: 'ready', t0: 0, s: {}, phase: 'ready', events: newEvents(), setup: setupOf(ch) };
  world.reset(app.session.setup);
  view.resetObjects(); view.setZones(world.zones);
  if (app.camMode === 'orbit') { controls.target.set(world.robot.x * 0.4, 0.1, -world.robot.y * 0.4); }
  app.challenges?.render(); refreshTop();
  if (ch) {
    const miss = missingNeeds(ch, world);
    app.john?.say(`${ch.title}: ${ch.brief}` + (miss.length ? `\nHeads up — your robot needs ${miss.join(' and ')} for this one. Open Build to add it.` : '\nPress Start when your code is ready. Ask me for a hint any time.'));
  }
}
function resetField() {
  runtime.stop();
  const ses = app.session;
  if (ses.challenge && typeof ses.challenge.setup === 'function') ses.setup = ses.challenge.setup();
  Object.assign(ses, { state: 'ready', s: {}, phase: 'ready', events: newEvents(), programDone: false });
  world.reset(ses.setup ?? {});
  view.resetObjects(); view.setZones(world.zones); refreshTop();
}
async function runProgram() {
  const ses = app.session;
  await runtime.stop();
  if (!ses.challenge) ses.mode = runAs.value;
  if (ses.challenge || ses.mode !== 'free') resetField();
  Object.assign(ses, { state: 'running', t0: world.time, s: {}, events: newEvents(), programDone: false, error: null, doneAt: null, phase: ses.mode === 'match' ? 'auton' : ses.mode });
  view.clearTrail();
  app.ide.print(`— run: ${ses.challenge?.title ?? 'free practice'} (${ses.mode}) —\n`, 'sys');
  refreshTop();
  runtime.run(app.ide.getPython(), ses.mode === 'free' ? 'auton' : ses.mode);
}
async function stopProgram() {
  await runtime.stop();
  if (app.session.state === 'running') { app.session.state = 'ready'; app.session.phase = 'ready'; app.toast('Stopped — run not scored.'); }
  world.setDrive(0, 0, 0);
  refreshTop();
}
function sessionTick() {
  const ses = app.session;
  if (ses.state !== 'running') return;
  const el = world.time - ses.t0, ch = ses.challenge, lim = limitOf(ses);
  ch?.track?.(world, ses.s);
  if (ses.mode === 'match') {
    if (ses.phase === 'auton' && el >= MATCH.auto) {
      runtime.endPhase();
      const red = world.score().red - (world.robot.inMidfield ? 8 : 0); // robot position is not counted for the Autonomous Bonus (SC7)
      ses.s.autoScore = red; ses.s.autoBonus = red > 0 ? 12 : 6;
      ses.phase = 'driver';
      runtime.startDriver();
      app.toast(`Autonomous over: ${red} pts → Autonomous Bonus +${ses.s.autoBonus}. Driver control!`);
    }
    if (ses.phase === 'driver' && !ses.s.endgame && lim - el <= MATCH.endgame) { ses.s.endgame = true; app.toast('ENDGAME — last 10 seconds. Get into the Midfield! No placing on the Midfield Goal (SG12).'); }
  }
  if (el >= lim) return finish(el);
  if ((ses.mode === 'auton' || ses.mode === 'free') && ses.programDone) {
    ses.doneAt ??= world.time;
    if (world.time - ses.doneAt > 0.5) finish(ses.doneAt - ses.t0);
  }
}
function finish(elapsed) {
  const ses = app.session, ch = ses.challenge;
  runtime.stop();
  world.setDrive(0, 0, 0);
  ses.state = 'done'; ses.elapsed = elapsed; ses.phase = 'done';
  const sc = world.score();
  const score = ch ? ch.score(world, elapsed, ses.s) : sc.red + (ses.s.autoBonus ?? 0);
  const stars = ch ? starsFor(ch, score) : 0;
  const details = `Red ${sc.red} pts (alliance halves ${sc.redHalves}, owned yellow ${sc.yellowOwned.red}, midfield ${sc.midfield}${ses.s.autoBonus ? `, auto bonus ${ses.s.autoBonus}` : ''}). Placed ${world.stats.placed}, dropped ${world.stats.dropped}, toggles ${world.stats.toggles}, wall hits ${world.stats.wallHits}, distance ${world.stats.distance.toFixed(2)} m${world.specs.usesAir ? `, air left ${Math.round(world.robot.psi)} psi` : ''}.`;
  app.lastRun = { challenge: ch, score, stars, time: elapsed, error: ses.error, events: ses.events, details, robot: world.cfg.name };
  let best = false;
  if (ch) {
    const prog = store.get('progress', {});
    if (!prog[ch.id] || score > prog[ch.id].score) { prog[ch.id] = { score, stars: Math.max(stars, prog[ch.id]?.stars ?? 0), time: elapsed }; store.set('progress', prog); best = true; }
    app.challenges?.render();
    showResults(ch, score, stars, elapsed, details, best);
  }
  app.john?.review(app.lastRun);
  refreshTop();
}
function showResults(ch, score, stars, time, details, best) {
  const next = CHALLENGES[CHALLENGES.indexOf(ch) + 1];
  const close = () => back.remove();
  const back = h('div.modal-back', { onclick: (e) => { if (e.target === back) close(); } },
    h('div.modal', { style: { textAlign: 'center', minWidth: '380px' } },
      h('h2', ch.title), h('div', { style: { fontSize: '40px' } }, starsEl(stars)),
      h('p', { style: { fontSize: '20px', margin: '8px 0' } }, h('b', `${Math.round(score)}${ch.unit ? ' ' + ch.unit : ' / 100'}`), `  in ${time.toFixed(1)} s`, best ? h('span.tag.green', { style: { marginLeft: '8px' } }, 'New best') : null),
      h('p.muted.small', 'Stars at ' + ch.stars.join(' / ')), h('p.small', { style: { textAlign: 'left' } }, details),
      h('div.row', { style: { justifyContent: 'center', marginTop: '14px' } },
        h('button.btn', { onclick: () => { close(); resetField(); } }, '↺ Try again'),
        h('button.btn', { onclick: () => { logRun(); close(); } }, '📓 Log to notebook'),
        h('button.btn', { onclick: () => { close(); openPanel('john', true); } }, '🧢 Ask John'),
        next && stars >= 1 ? h('button.btn.primary', { onclick: () => { close(); startChallenge(next); } }, 'Next challenge →') : null)));
  document.body.append(back);
}
function logRun() {
  const r = app.lastRun;
  if (!r) return app.toast('Nothing to log yet — run something first.');
  const code = app.ide.getSummary();
  bus.emit('notebook:log', {
    phase: 'test', title: `Test: ${r.challenge?.title ?? 'Free practice'} — ${r.challenge ? '★'.repeat(r.stars) + '☆'.repeat(5 - r.stars) : Math.round(r.score) + ' pts'}`,
    body: `Robot: ${r.robot}. Program: ${code.name} (${code.mode}).\nResult: ${Math.round(r.score)}${r.challenge?.unit ? ' ' + r.challenge.unit : ''} in ${r.time.toFixed(1)} s.\n${r.details}${r.error ? `\nProgram error: ${r.error.text}` : ''}`,
    code, image: app.captureScreenshot(),
    data: [{ trial: 1, setup: `${r.robot} / ${code.name}`, result: Math.round(r.score), notes: `${r.time.toFixed(1)} s` }],
  });
  app.toast('Logged to your Engineering Notebook as a draft — add your analysis and sign it.');
}

// ---------- chrome: top bar, nav, dock ----------
const runAs = h('select', { title: 'How Run behaves in Free Practice', onchange: () => { if (!app.session.challenge) { app.session.mode = runAs.value; refreshTop(); } } },
  [['free', 'Run program (no clock)'], ['auton', 'Autonomous 0:15'], ['driver', 'Driver 1:45'], ['match', 'Full match']].map(([v, l]) => h('option', { value: v }, l)));
const startBtn = h('button.btn.good', { onclick: runProgram }, '▶ Start');
const titleEl = h('span.muted');
const clockEl = h('span.clock', '0:00.0'), redEl = h('span.score.r', '0'), blueEl = h('span.score.b', '0'), statEl = h('span.muted.small');
const camSel = h('select', { title: 'Camera', onchange: () => setCam(camSel.value) }, [['orbit', 'Orbit cam'], ['top', 'Top-down'], ['chase', 'Chase cam'], ['driver', 'Driver station']].map(([v, l]) => h('option', { value: v }, l)));
const speedSel = h('select', { title: 'Simulation speed', onchange: () => { app.speed = +speedSel.value; } }, [['0.5', '0.5×'], ['1', '1×'], ['2', '2×'], ['4', '4×']].map(([v, l]) => h('option', { value: v, selected: v === '1' }, l)));
const vrBtn = h('button.btn.primary', { disabled: true, title: 'Needs a WebXR browser + headset', onclick: enterVR }, 'VR not found');
$('topbar').append(h('span.brand', 'VEX', h('span', 'VR'), ' Sim'), startBtn, h('button.btn.danger', { onclick: stopProgram }, '■ Stop'), h('button.btn', { onclick: resetField }, '↺ Reset'), runAs, titleEl,
  h('span.spacer'), h('div', { id: 'hud' }, statEl, clockEl, redEl, blueEl), camSel, speedSel,
  h('button.btn.small', { title: 'Show the robot\'s path', onclick: (e) => { app.trail = !app.trail; e.target.classList.toggle('active', app.trail); }, className: 'btn small active' }, 'Trail'), vrBtn);
function refreshTop() {
  const ses = app.session;
  titleEl.textContent = ses.challenge ? `Challenge: ${ses.challenge.title}` : 'Free Practice';
  runAs.style.display = ses.challenge ? 'none' : '';
  startBtn.textContent = ses.state === 'running' ? '● Running' : '▶ Start';
  startBtn.disabled = ses.state === 'running';
}

const PANELS = [['code', '🧩', 'Code'], ['build', '🔧', 'Build'], ['challenges', '🏆', 'Challenges'], ['john', '🧢', 'John VEX'], ['notebook', '📓', 'Notebook'], ['rules', '📖', 'Rules']];
const panelEls = {}, navBtns = {};
let openId = null;
for (const [id, ico, label] of PANELS) {
  panelEls[id] = h('div.panel');
  $('dock').append(panelEls[id]);
  navBtns[id] = h('button', { onclick: () => openPanel(id) }, h('span.ico', ico), label);
  $('nav').append(navBtns[id]);
}
function openPanel(id, force) {
  openId = openId === id && !force ? null : id;
  $('dock').classList.toggle('open', !!openId);
  $('dock').classList.toggle('wide', openId === 'code' || openId === 'notebook');
  for (const [k] of PANELS) { panelEls[k].classList.toggle('active', k === openId); navBtns[k].classList.toggle('active', k === openId); }
  if (openId === 'code') requestAnimationFrame(() => app.ide.resize());
  if (openId === 'challenges') app.challenges.render();
  if (openId === 'build') app.builder.render();
  resize();
}
const ctx = { store, bus, app, toast: app.toast };
// Blockly must measure a visible container, so mount the IDE with its panel shown, then close.
$('dock').classList.add('open', 'wide'); panelEls.code.classList.add('active');
app.ide = mountIDE(panelEls.code, ctx);
panelEls.code.classList.remove('active'); $('dock').classList.remove('open', 'wide');
app.builder = mountBuilder(panelEls.build, ctx);
app.challenges = mountChallenges(panelEls.challenges, ctx);
app.john = mountJohn(panelEls.john, ctx);
app.notebook = mountNotebook(panelEls.notebook, ctx);
app.rules = mountRules(panelEls.rules, ctx);
bus.on('toast', (m) => app.toast(typeof m === 'string' ? m : m?.msg ?? ''));

$('help').innerHTML = '<b>Drive</b> <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> · strafe <kbd>Q</kbd><kbd>E</kbd><br><b>Lift</b> <kbd>R</kbd>/<kbd>F</kbd> · <b>Claw</b> <kbd>Space</kbd> · <b>Flipper</b> <kbd>T</kbd> · <b>Match load</b> <kbd>M</kbd><br>Gamepad and VR controllers also work. Drag to orbit, scroll to zoom.';

// ---------- input ----------
const keys = new Set();
let clawPulse = null;
addEventListener('keydown', (e) => {
  if (e.target.closest?.('#dock, .modal') || e.ctrlKey || e.metaKey) return;
  const k = e.key.toLowerCase();
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  if (e.repeat) return;
  keys.add(k);
  if (k === ' ') clawPulse = { btn: world.robot.clawClosed ? 'R2' : 'R1', frames: 4 };
  if (k === 'm') world.matchLoad();
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
function readInput() {
  const c = world.controller, k = (a, b) => (keys.has(a) || keys.has(b) ? 1 : 0);
  const ax = { 3: (k('w', 'arrowup') - k('s', 'arrowdown')) * 100, 1: (k('d', 'arrowright') - k('a', 'arrowleft')) * 100, 4: (k('e') - k('q')) * 100, 2: 0 };
  const b = { L1: keys.has('r'), L2: keys.has('f'), A: keys.has('t'), R1: keys.has('c'), R2: keys.has('v'), X: false, B: false, Y: false };
  if (clawPulse) { if (clawPulse.frames-- > 0) b[clawPulse.btn] = true; else clawPulse = null; }
  const gp = [...(navigator.getGamepads?.() ?? [])].find((g) => g && g.mapping === 'standard');
  if (gp) {
    const dz = (v) => (Math.abs(v) < 0.1 ? 0 : v * 100);
    ax[4] ||= dz(gp.axes[0]); ax[3] ||= -dz(gp.axes[1]); ax[1] ||= dz(gp.axes[2]); ax[2] ||= -dz(gp.axes[3]);
    const p = (i) => !!gp.buttons[i]?.pressed;
    Object.entries({ L1: 4, R1: 5, L2: 6, R2: 7, A: 0, B: 1, X: 2, Y: 3, Up: 12, Down: 13, Left: 14, Right: 15 }).forEach(([n, i]) => { b[n] ||= p(i); });
  }
  c.axis1 = ax[1]; c.axis2 = ax[2]; c.axis3 = ax[3]; c.axis4 = ax[4]; c.buttons = b;
}
// Built-in driver control (used whenever no student program is driving).
const prevBtn = {};
function builtinDriver() {
  const c = world.controller, sp = world.specs, r = world.robot, b = c.buttons, edge = (n) => b[n] && !prevBtn[n];
  if (!r.task) world.setDrive((c.axis3 / 100) * sp.vFree, (c.axis4 / 100) * sp.vFree * sp.strafeFactor, (c.axis1 / 100) * sp.omegaMax * 0.7);
  if (sp.liftMaxH && r.lift.target == null) world.motorSpin('lift', b.L1 ? 1 : b.L2 ? -1 : 0);
  if (sp.hasClaw) {
    if (sp.clawPneumatic) { if (edge('R1')) world.setPiston('claw', true); if (edge('R2')) world.setPiston('claw', false); }
    else if (edge('R1')) world.motorTo('claw', 70); else if (edge('R2')) world.motorTo('claw', 0);
  }
  if (sp.hasFlipper && edge('A')) world.setPiston('flipper', !r.pistons.flipper);
  if (edge('X')) world.matchLoad();
  Object.assign(prevBtn, b);
}

// ---------- cameras, resize, VR ----------
function setCam(mode) {
  app.camMode = mode; camSel.value = mode;
  controls.enabled = mode === 'orbit';
  if (mode === 'top') { camera.position.set(0, 5.6, 0.001); camera.lookAt(0, 0, 0); }
  if (mode === 'driver') { camera.position.set(-FIELD.half - 1.1, 1.55, 0); camera.lookAt(0, 0.1, 0); }
  if (mode === 'orbit') { camera.position.set(-0.4, 3.3, 3.6); controls.target.set(0, 0.1, 0); }
}
function resize() {
  const w = innerWidth, hh = innerHeight;
  renderer.setSize(w, hh);
  camera.aspect = w / hh;
  const dockW = openId ? $('dock').getBoundingClientRect().right : 64;
  if (dockW < w * 0.9) camera.setViewOffset(w, hh, -dockW / 2, -23, w, hh); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
const vrui = app.vrui = new VRUI(renderer, scene, rig, app);
navigator.xr?.isSessionSupported?.('immersive-vr').then((ok) => { if (ok) { vrBtn.disabled = false; vrBtn.textContent = 'Enter VR'; vrBtn.title = 'Start an immersive session (Quest / SteamVR)'; } }).catch(() => {});
async function enterVR() {
  if (renderer.xr.isPresenting) return renderer.xr.getSession().end();
  try {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
    camera.clearViewOffset(); camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0);
    session.addEventListener('end', () => { vrBtn.textContent = 'Enter VR'; setCam('orbit'); resize(); });
    await renderer.xr.setSession(session);
    vrBtn.textContent = 'Exit VR';
  } catch (e) { app.toast('Could not start VR: ' + e.message); }
}

// ---------- main loop ----------
let last = performance.now(), acc = 0, hudT = 0;
renderer.setAnimationLoop(async () => {
  const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const inVR = vrui.update(dt);
  if (!inVR) readInput();
  const ses = app.session;
  const manual = !runtime.running && (!ses.challenge ? ses.state !== 'running' || ses.phase !== 'auton' : ses.state === 'running' && ses.phase === 'driver');
  acc += dt * app.speed;
  let n = 0;
  while (acc >= STEP && n++ < 60) {
    if (manual) builtinDriver();
    const wake = world.wake;
    world.step(STEP);
    // a wait/move just finished: drain microtasks so the student program reacts in this same sim step
    if (world.wake !== wake && runtime.running) { const parks = runtime.parks; for (let i = 0; i < 200 && runtime.parks === parks && runtime.running; i++) await null; }
    sessionTick();
    acc -= STEP;
  }
  if (n >= 60) acc = 0;
  view.update(dt, app.trail);
  if (bubble.visible && (bubbleT -= dt) <= 0) bubble.visible = false;
  if (!inVR) {
    const r = world.robot;
    if (app.camMode === 'chase') {
      const back = new THREE.Vector3(r.x - Math.sin(r.h) * 1.1, 0.75, -r.y + Math.cos(r.h) * 1.1);
      camera.position.lerp(back, 1 - Math.exp(-6 * dt));
      camera.lookAt(r.x + Math.sin(r.h) * 0.4, 0.15, -r.y - Math.cos(r.h) * 0.4);
    } else if (app.camMode === 'orbit') controls.update();
  }
  if ((hudT += dt) > 0.1) {
    hudT = 0;
    const sc = world.score(), r = world.robot;
    clockEl.textContent = app.clockText();
    redEl.textContent = sc.red + (ses.s.autoBonus ?? 0); blueEl.textContent = sc.blue;
    statEl.textContent = `${ses.phase === 'auton' ? 'AUTON · ' : ses.phase === 'driver' ? 'DRIVER · ' : ''}${world.specs.usesAir ? `air ${Math.round(r.psi)} psi · ` : ''}${world.specs.liftMaxH ? `lift ${Math.round(world.liftHeight() * 1000)} mm` : ''}`;
    app.ide.updateMonitor(`<table><tr><td>Heading</td><td>${world.heading().toFixed(1)}°</td></tr><tr><td>Position</td><td>x ${Math.round(r.x * 1000)}, y ${Math.round(r.y * 1000)} mm</td></tr><tr><td>Speed</td><td>${r.vf.toFixed(2)} m/s</td></tr><tr><td>Lift</td><td>${Math.round(world.liftHeight() * 1000)} mm (${Math.round(r.lift.pos)}°)</td></tr><tr><td>Claw</td><td>${r.held ? 'holding ' + world.obj(r.held).type : r.clawClosed ? 'closed' : 'open'}</td></tr><tr><td>Distance</td><td>${world.cfg.sensors.distance ? world.distanceMM() + ' mm' : '—'}</td></tr><tr><td>Optical</td><td>${world.cfg.sensors.optical ? world.seenColor() : '—'}</td></tr><tr><td>Bumper</td><td>${world.cfg.sensors.bumper ? r.bumper : '—'}</td></tr><tr><td>Air</td><td>${world.specs.usesAir ? r.psi.toFixed(1) + ' psi' : '—'}</td></tr><tr><td>Timer</td><td>${(world.time - runtime.timerZero).toFixed(1)} s</td></tr></table>`);
  }
  renderer.render(scene, camera);
});

resize();
refreshTop();
if (!store.get('seenIntro')) { store.set('seenIntro', true); openPanel('challenges', true); } else openPanel('challenges', true);
