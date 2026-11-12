// VEXcode-style coding environment: Blocks <-> Python, project slots, devices, code viewer, monitor.
import { EditorView, basicSetup } from 'codemirror';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { Blockly, TOOLBOX, STARTER, workspaceToPython } from './blocks.js';
import { h, store } from '../store.js';
import { DRIVETRAINS, LIFTS, CARTRIDGES, SENSORS } from '../sim/robotConfig.js';

const PY_STARTER = `# VEXcode-style Python. The robot from the Build tab is already configured:
# drivetrain, lift, claw, flipper, brain, controller and your sensors.

def autonomous():
    brain.screen.print("Autonomous!")
    drivetrain.drive_for(FORWARD, 300, MM)

def driver_control():
    while True:
        drivetrain.arcade(controller.axis3.position(), controller.axis1.position())
        wait(20, MSEC)

competition = Competition(driver_control, autonomous)
`;

export function mountIDE(el, ctx) {
  const { app } = ctx;
  let project = null, slot = store.get('slot', 1), cm = null, dirty = false;
  const slots = () => store.get('projects', {});

  const nameIn = h('input', { value: '', title: 'Project name', style: { width: '120px' }, oninput: () => { project.name = nameIn.value; save(); } });
  const slotSel = h('select', { title: 'Brain slot', onchange: () => { save(); slot = +slotSel.value; store.set('slot', slot); load(slots()[slot] ?? blank()); } },
    Array.from({ length: 8 }, (_, i) => h('option', { value: i + 1 }, `Slot ${i + 1}`)));
  const btnBlocks = h('button.btn', { onclick: () => setMode('blocks') }, 'Blocks');
  const btnPy = h('button.btn', { onclick: () => setMode('python') }, 'Python');
  const runBtn = h('button.btn.run', { onclick: () => app.runProgram() }, '▶ Run');
  const stopBtn = h('button.btn.stop', { onclick: () => app.stopProgram() }, '■ Stop');
  const fileIn = h('input', { type: 'file', accept: '.json,.v5sim,.py', style: { display: 'none' }, onchange: openFile });
  const bar = h('div.ide-bar',
    slotSel, nameIn, btnBlocks, btnPy,
    h('button.btn', { onclick: newProject, title: 'New project' }, 'New'),
    h('button.btn', { onclick: () => fileIn.click(), title: 'Open a saved project file' }, 'Open'),
    h('button.btn', { onclick: exportFile, title: 'Download this project' }, 'Save'),
    h('button.btn', { onclick: () => { ws.undo(false); } , title: 'Undo' }, '↶'),
    h('button.btn', { onclick: () => { ws.undo(true); }, title: 'Redo' }, '↷'),
    h('span', { style: { flex: 1 } }), runBtn, stopBtn, fileIn);

  const blocksDiv = h('div'), pyDiv = h('div', { style: { display: 'none' } });
  const wsWrap = h('div.ide-ws', blocksDiv, pyDiv);
  const codeView = h('pre', { style: { margin: 0, whiteSpace: 'pre', overflowX: 'auto' } });
  const consoleEl = h('div.console'), screenEl = h('div.brain-screen'), sensorsEl = h('div.small');
  const devicesEl = h('div.col');
  const panes = {
    Code: h('div.pane.active', h('p.muted.small', 'Code Viewer — the Python your blocks generate.'), codeView),
    Monitor: h('div.pane', h('h4', 'Brain screen'), screenEl, h('h4', 'Sensors'), sensorsEl, h('div.row', h('h4.grow', { style: { margin: '10px 0 4px' } }, 'Console'), h('button.btn.small', { onclick: () => { consoleEl.textContent = ''; } }, 'Clear')), consoleEl),
    Devices: h('div.pane', devicesEl),
  };
  const tabBtns = Object.keys(panes).map((n) => h('button', { className: n === 'Code' ? 'active' : '', onclick: () => showPane(n) }, n));
  const side = h('div.ide-side', h('div.tabs', tabBtns), Object.values(panes));
  function showPane(n) { tabBtns.forEach((b) => b.classList.toggle('active', b.textContent === n)); Object.entries(panes).forEach(([k, p]) => p.classList.toggle('active', k === n)); }
  el.append(h('div.ide', bar, h('div.ide-main', wsWrap, side)));

  const ws = Blockly.inject(blocksDiv, {
    toolbox: TOOLBOX, renderer: 'zelos', trashcan: true, sounds: false,
    zoom: { controls: true, wheel: true, startScale: 0.75, maxScale: 1.6, minScale: 0.35 },
    grid: { spacing: 24, length: 2, colour: '#d8dde4', snap: false },
    move: { scrollbars: true, drag: true, wheel: false },
  });
  ws.addChangeListener((e) => {
    if (e.isUiEvent || !project || project.mode !== 'blocks') return;
    project.blocks = Blockly.serialization.workspaces.save(ws);
    refreshCode();
    save();
  });
  function ensureCM() {
    if (cm) return cm;
    cm = new EditorView({
      doc: project.python ?? '', parent: pyDiv,
      extensions: [basicSetup, python(), oneDark, EditorView.updateListener.of((u) => { if (u.docChanged && project?.mode === 'python') { project.python = cm.state.doc.toString(); save(); } })],
    });
    return cm;
  }

  const blank = () => ({ name: 'MyProject', mode: 'blocks', blocks: structuredClone(STARTER), python: '' });
  function save() { if (!project) return; const all = slots(); all[slot] = project; store.set('projects', all); dirty = true; }
  function refreshCode() { try { codeView.textContent = project.mode === 'blocks' ? workspaceToPython(ws) : project.python; } catch (e) { codeView.textContent = '# ' + e.message; } }
  function load(p) {
    project = structuredClone(p);
    nameIn.value = project.name; slotSel.value = slot;
    Blockly.Events.disable();
    try { ws.clear(); if (project.blocks) Blockly.serialization.workspaces.load(project.blocks, ws); } finally { Blockly.Events.enable(); }
    if (cm) cm.dispatch({ changes: { from: 0, to: cm.state.doc.length, insert: project.python ?? '' } });
    applyMode();
    save();
  }
  function applyMode() {
    const py = project.mode === 'python';
    blocksDiv.style.display = py ? 'none' : ''; pyDiv.style.display = py ? '' : 'none';
    btnBlocks.classList.toggle('active', !py); btnPy.classList.toggle('active', py);
    if (py) { ensureCM(); if (cm.state.doc.toString() !== (project.python ?? '')) cm.dispatch({ changes: { from: 0, to: cm.state.doc.length, insert: project.python ?? '' } }); }
    else requestAnimationFrame(() => Blockly.svgResize(ws));
    refreshCode();
  }
  function setMode(mode) {
    if (!project || project.mode === mode) return;
    if (mode === 'python') {
      const generated = workspaceToPython(ws);
      project.python = generated.trim() ? '# Converted from blocks\n' + generated : PY_STARTER;
    } else if (!confirm('Switching back to Blocks keeps your earlier blocks but does NOT convert Python text into blocks. Continue?')) return;
    project.mode = mode;
    applyMode(); save();
  }
  function newProject() {
    if (!confirm('Start a new project in this slot? The current one will be replaced (use Save first to keep a copy).')) return;
    load(blank());
  }
  function exportFile() {
    const blob = new Blob([JSON.stringify({ format: 'vexvr-project', version: 1, ...project }, null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: (project.name || 'project').replace(/[^\w-]+/g, '_') + '.v5sim.json' });
    a.click(); URL.revokeObjectURL(a.href);
  }
  async function openFile() {
    const f = fileIn.files[0]; fileIn.value = '';
    if (!f) return;
    const text = await f.text();
    try {
      if (f.name.endsWith('.py')) load({ name: f.name.replace(/\.py$/, ''), mode: 'python', blocks: structuredClone(STARTER), python: text });
      else { const p = JSON.parse(text); if (p.format !== 'vexvr-project') throw new Error('Not a VEX VR Sim project file'); load(p); }
    } catch (e) { app.toast('Could not open file: ' + e.message); }
  }

  function renderDevices() {
    const c = app.world.cfg, sp = app.world.specs, rows = [];
    const dt = DRIVETRAINS[c.drivetrain.type];
    let port = 1;
    rows.push(['Brain', 'brain', '—']);
    rows.push(['Controller', 'controller', 'Radio']);
    rows.push([`${dt.label} (${CARTRIDGES[c.drivetrain.cartridge].label}, ${c.drivetrain.wheel}" wheels)`, 'drivetrain', Array.from({ length: dt.motors }, () => port++).join(', ')]);
    if (sp.liftMaxH) rows.push([`${LIFTS[c.lift.type].label} (${CARTRIDGES[c.lift.cartridge].label})`, 'lift / lift_motor', Array.from({ length: LIFTS[c.lift.type].motors }, () => port++).join(', ')]);
    if (sp.hasClaw && !sp.clawPneumatic) rows.push(['Motor claw', 'claw / claw_motor', port++]);
    if (sp.clawPneumatic) rows.push(['Pneumatic claw', 'claw / claw_piston', '3-Wire A']);
    if (sp.hasFlipper) rows.push(['Toggle flipper piston', 'flipper', '3-Wire B']);
    if (sp.usesAir) rows.push(['Air reservoir gauge', 'air_tank', '—']);
    for (const [k, s] of Object.entries(SENSORS)) if (c.sensors[k]) rows.push([s.label, k, k === 'bumper' ? '3-Wire C' : port++]);
    devicesEl.replaceChildren(
      h('p.muted.small', 'Devices are configured automatically from the Build tab. Use these names in Python.'),
      h('table', h('tr', h('th', 'Device'), h('th', 'Name'), h('th', 'Port')), rows.map((r) => h('tr', h('td', r[0]), h('td', h('code', r[1])), h('td', String(r[2]))))),
      h('button.btn', { onclick: () => app.openPanel('build') }, 'Change robot…'));
  }

  load(slots()[slot] ?? blank());
  renderDevices();

  return {
    getPython: () => (project.mode === 'blocks' ? workspaceToPython(ws) : project.python),
    getProject: () => structuredClone(project),
    getSummary: () => ({ name: project.name, mode: project.mode, python: project.mode === 'blocks' ? workspaceToPython(ws) : project.python }),
    loadProject: (p) => load({ ...blank(), ...p }),
    resize: () => { if (project.mode === 'blocks') Blockly.svgResize(ws); },
    renderDevices,
    print(text, cls) {
      const s = h('span', { className: cls === 'err' ? 'err' : cls === 'sys' ? 'sys' : '' }, text);
      consoleEl.append(s);
      while (consoleEl.childNodes.length > 400) consoleEl.firstChild.remove();
      consoleEl.parentElement.scrollTop = consoleEl.parentElement.scrollHeight;
      if (cls === 'err') showPane('Monitor');
    },
    setScreen(rows) { screenEl.textContent = rows.join('\n'); },
    setRunning(on) { runBtn.disabled = on; runBtn.textContent = on ? '● Running' : '▶ Run'; },
    highlightLine(line) {
      if (project.mode !== 'python' || !cm || !line) return;
      const l = cm.state.doc.line(Math.min(line, cm.state.doc.lines));
      cm.dispatch({ selection: { anchor: l.from, head: l.to }, scrollIntoView: true });
    },
    updateMonitor(html) { if (panes.Monitor.classList.contains('active')) sensorsEl.innerHTML = html; },
  };
}
