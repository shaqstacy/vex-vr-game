// "Import your robot CAD (STL) and work out where the mechanisms are".
// mountStlImport(el, { store, bus, app }) builds the whole panel, including its
// own small three.js viewport.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { store as defaultStore, bus as defaultBus, h } from '../store.js';
import {
  parseSTL, analyzeSTLAsync, summarizeFeatures, transformPositions, rawToCanonical, canonicalToRaw,
  buildSampleRobot, matMul3, ROT, FEATURE_TYPES, UNIT_NAMES,
} from '../sim/stlAnalyze.js';

const IN = 0.0254;
const START_SIZE = 18 * IN;
const TYPE_COLOR = {
  wheel: '#35b36b', motor: '#e0453a', piston: '#f2c230', lift: '#3d8bff',
  claw: '#c56bff', brain: '#2fd3e0', tank: '#ff9f43', other: '#e8edf3', body: '#7d8898',
};
const TYPE_LABEL = {
  wheel: 'Wheel', motor: 'Motor', piston: 'Piston', lift: 'Lift', claw: 'Claw',
  brain: 'Brain', tank: 'Air tank', other: 'Other',
};

const CSS = `
.stl-wrap { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(300px, 1fr); gap: 12px; align-items: start; }
@media (max-width: 900px) { .stl-wrap { grid-template-columns: minmax(0, 1fr); } }
.stl-drop { border: 2px dashed var(--border); border-radius: var(--radius); padding: 14px; text-align: center; transition: border-color .15s, background .15s; }
.stl-drop.stl-over { border-color: var(--accent); background: #2f9be01a; }
.stl-view { position: relative; height: 430px; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; background: #0e1218; }
.stl-view canvas { display: block; width: 100%; height: 100%; touch-action: none; }
.stl-view.stl-adding canvas { cursor: crosshair; }
.stl-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 8px; background: #0e1218cc; color: var(--text); text-align: center; padding: 16px; pointer-events: none; }
.stl-overlay[hidden] { display: none; }
.stl-spin { width: 26px; height: 26px; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: stl-rot .8s linear infinite; }
@keyframes stl-rot { to { transform: rotate(360deg); } }
.stl-hint { position: absolute; left: 8px; bottom: 6px; font-size: 11px; color: var(--muted); pointer-events: none; }
.stl-legend { display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 12px; }
.stl-sw { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 4px; vertical-align: -1px; }
.stl-list { display: flex; flex-direction: column; gap: 6px; max-height: 340px; overflow: auto; }
.stl-row { border: 1px solid var(--border); border-left-width: 4px; border-radius: 6px; padding: 6px 8px; background: var(--panel); }
.stl-row:hover, .stl-row.stl-hot { border-color: var(--accent); background: var(--panel2); }
.stl-row.stl-ok { box-shadow: inset 0 0 0 1px #35b36b55; }
.stl-row select, .stl-tools select { background: var(--panel); color: var(--text); border: 1px solid var(--border); border-radius: 5px; padding: 2px 4px; font-size: 12px; }
.stl-reason { font-size: 12px; color: var(--muted); margin-top: 4px; line-height: 1.35; }
.stl-pos { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 11px; color: var(--muted); }
.stl-tools { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 8px; }
.stl-kv { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; font-size: 13px; }
.stl-kv b { font-weight: 600; }
.stl-warn { font-size: 12px; color: #f7da7c; background: #f2c2301f; border: 1px solid #f2c23055; border-radius: 6px; padding: 6px 8px; line-height: 1.35; }
.stl-err { font-size: 13px; color: #ff9d95; background: #e0453a22; border: 1px solid #e0453a66; border-radius: 6px; padding: 6px 8px; }
`;

function injectCss() {
  if (document.getElementById('stl-import-css')) return;
  const st = document.createElement('style');
  st.id = 'stl-import-css';
  st.textContent = CSS;
  document.head.append(st);
}

const nextFrame = () => new Promise((res) => {
  let done = false;
  const fin = () => { if (!done) { done = true; res(); } };
  requestAnimationFrame(fin);
  setTimeout(fin, 60); // rAF does not fire in hidden tabs
});
const inch = (m) => (m / IN).toFixed(1);

/**
 * Mount the STL import panel.
 * @param {HTMLElement} el
 * @param {{store?:object, bus?:object, app?:{applyImportedRobot?:Function}}} ctx
 * @returns {{destroy:Function, loadSample:Function, loadFile:Function, loadPositions:Function, getState:Function}}
 */
export function mountStlImport(el, ctx = {}) {
  injectCss();
  const store = ctx.store || defaultStore;
  const bus = ctx.bus || defaultBus;

  const S = {
    name: '', positions: null, result: null, busy: false, token: 0,
    units: null, rotation: null, // null = auto
    overrides: new Map(), // feature key → { type?, accepted?, deleted? }
    manual: [], manualSeq: 1,
    adding: false, addType: 'wheel', hover: null, features: [], summary: null,
  };

  // ------------------------------------------------------------------ DOM
  const fileInput = h('input', { type: 'file', accept: '.stl,model/stl', style: { display: 'none' }, onchange: () => { if (fileInput.files[0]) loadFile(fileInput.files[0]); fileInput.value = ''; } });
  const dropZone = h('div.stl-drop', null,
    h('div', null, h('b', null, 'Drop your robot STL here'), ' or'),
    h('div.row', { style: { justifyContent: 'center', marginTop: '8px' } },
      h('button.btn.primary', { type: 'button', 'data-stl': 'choose', onclick: () => fileInput.click() }, 'Choose STL file…'),
      h('button.btn', { type: 'button', 'data-stl': 'sample', onclick: () => loadSample() }, 'Load sample robot')),
    h('div.muted.small', { style: { marginTop: '8px' } }, 'Export the whole assembly from Fusion, Onshape or Inventor as one STL (binary or ASCII, mm or inches). Keeping parts as separate bodies gives the best detection.'),
    fileInput);
  const fileInfo = h('div.small.muted');
  const errBox = h('div.stl-err', { hidden: true });

  const canvas = h('canvas');
  const overlayText = h('div', null, 'Load an STL to begin');
  const spinner = h('div.stl-spin', { hidden: true });
  const overlay = h('div.stl-overlay', { 'data-stl': 'overlay' }, spinner, overlayText);
  const viewEl = h('div.stl-view', null, canvas, overlay, h('div.stl-hint', null, 'Drag to orbit · scroll to zoom · green box = 18 in start size · arrow = front'));

  const unitSel = h('select', { title: 'Units of the STL file', 'data-stl': 'units', onchange: () => { S.units = unitSel.value === 'auto' ? null : unitSel.value; reanalyze(); } },
    h('option', { value: 'auto' }, 'Units: auto'), h('option', { value: 'mm' }, 'mm'), h('option', { value: 'in' }, 'inches'),
    h('option', { value: 'cm' }, 'cm'), h('option', { value: 'm' }, 'metres'));
  const rotBtn = (label, m, title) => h('button.btn.small', { type: 'button', title, 'data-stl': 'rot-' + label.toLowerCase().replace(/[^a-z0-9]/g, ''), onclick: () => rotate(m) }, label);
  const addBtn = h('button.btn.small', { type: 'button', 'data-stl': 'add', title: 'Then click the model to tag a mechanism', onclick: () => setAdding(!S.adding) }, 'Add marker');
  const addSel = h('select', { title: 'Type for new markers', 'data-stl': 'addtype', onchange: () => { S.addType = addSel.value; } },
    FEATURE_TYPES.map((t) => h('option', { value: t }, TYPE_LABEL[t])));
  const tools = h('div.stl-tools', null,
    unitSel,
    rotBtn('X 90°', ROT.x90, 'Rotate the model 90° about the left-right axis'),
    rotBtn('Y 90°', ROT.y90, 'Rotate the model 90° about the vertical axis'),
    rotBtn('Z 90°', ROT.z90, 'Rotate the model 90° about the front-back axis'),
    rotBtn('Flip front', ROT.y180, 'Turn the model round so the other end is the front'),
    h('button.btn.small', { type: 'button', 'data-stl': 'auto', title: 'Go back to the automatic units and orientation', onclick: () => { S.units = null; S.rotation = null; unitSel.value = 'auto'; reanalyze(); } }, 'Auto-orient'),
    h('span.grow'),
    addBtn, addSel);
  const legend = h('div.stl-legend', { style: { marginTop: '8px' } },
    [...FEATURE_TYPES, 'body'].map((t) => h('span', null, h('span.stl-sw', { style: { background: TYPE_COLOR[t] } }), t === 'body' ? 'Unclassified' : TYPE_LABEL[t])));

  const sizeBox = h('div.col');
  const warnBox = h('div.col');
  const summaryBox = h('div');
  const listBox = h('div.stl-list', { 'data-stl': 'list' });
  const listHead = h('div.row', null,
    h('b.grow', null, 'Detected mechanisms'),
    h('button.btn.small', { type: 'button', 'data-stl': 'acceptall', onclick: () => { for (const f of S.features) setOverride(f, { accepted: true }, true); refresh(); } }, 'Accept all'),
    h('button.btn.small', { type: 'button', title: 'Undo all edits and manual markers', onclick: () => { S.overrides.clear(); S.manual = []; refresh(); } }, 'Reset'));
  const useBtn = h('button.btn.good', { type: 'button', disabled: true, 'data-stl': 'use', onclick: useRobot }, 'Use this robot');
  const useMsg = h('span.small.muted', { 'data-stl': 'usemsg' });
  const lastBox = h('div.small.muted');

  const root = h('div.stl-wrap', null,
    h('div.col', null,
      h('div.card', null, viewEl, tools, legend),
      h('div.card.col', null, dropZone, fileInfo, errBox)),
    h('div.col', null,
      h('div.card.col', null, h('b', null, 'Size check'), sizeBox, warnBox),
      h('div.card.col', null, listHead, listBox),
      h('div.card.col', null, h('b', null, 'What the simulator will use'), summaryBox,
        h('div.row', null, useBtn, useMsg)),
      lastBox));
  el.append(root);

  const onDragOver = (e) => { e.preventDefault(); dropZone.classList.add('stl-over'); };
  const onDragLeave = () => dropZone.classList.remove('stl-over');
  const onDrop = (e) => {
    e.preventDefault();
    dropZone.classList.remove('stl-over');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) loadFile(f);
  };
  for (const t of [dropZone, viewEl]) {
    t.addEventListener('dragover', onDragOver);
    t.addEventListener('dragleave', onDragLeave);
    t.addEventListener('drop', onDrop);
  }

  // ------------------------------------------------------------------ three.js viewport
  const V = { ok: false, mesh: null, markers: [], needs: false, raf: 0 };
  try {
    V.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    V.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    V.scene = new THREE.Scene();
    V.scene.background = new THREE.Color('#0e1218');
    V.camera = new THREE.PerspectiveCamera(40, 1, 0.01, 50);
    V.camera.position.set(0.75, 0.6, 0.85);
    V.controls = new OrbitControls(V.camera, canvas);
    V.controls.target.set(0, 0.18, 0);
    V.controls.addEventListener('change', requestRender);
    V.scene.add(new THREE.HemisphereLight(0xffffff, 0x39424f, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(1.5, 3, 2);
    V.scene.add(sun);
    V.grid = new THREE.GridHelper(1.2192, 8, 0x4a5668, 0x2a323e); // two field tiles, 6 in squares
    V.scene.add(V.grid);
    V.cube = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(START_SIZE, START_SIZE, START_SIZE)),
      new THREE.LineBasicMaterial({ color: 0x35b36b }));
    V.cube.position.y = START_SIZE / 2;
    V.scene.add(V.cube);
    V.arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0.004, 0.25), 0.16, 0xf2c230, 0.05, 0.035);
    V.scene.add(V.arrow);
    // "FRONT" label
    const lc = document.createElement('canvas');
    lc.width = 128; lc.height = 48;
    const g2 = lc.getContext('2d');
    g2.font = 'bold 30px sans-serif'; g2.fillStyle = '#f2c230'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
    g2.fillText('FRONT', 64, 25);
    V.labelTex = new THREE.CanvasTexture(lc);
    V.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: V.labelTex, depthTest: false, transparent: true }));
    V.label.scale.set(0.16, 0.06, 1);
    V.scene.add(V.label);
    V.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.05, side: THREE.DoubleSide });
    V.markerGeo = new THREE.SphereGeometry(0.011, 16, 12);
    V.markerGroup = new THREE.Group();
    V.scene.add(V.markerGroup);
    V.raycaster = new THREE.Raycaster();
    V.ok = true;
  } catch (e) {
    overlayText.textContent = '3D preview is not available in this browser (WebGL failed). Analysis still works - use the list on the right.';
  }

  function requestRender() {
    if (!V.ok || V.needs) return;
    V.needs = true;
    V.raf = requestAnimationFrame(() => {
      V.needs = false;
      resize();
      V.renderer.render(V.scene, V.camera);
    });
  }
  function resize() {
    const w = viewEl.clientWidth, hh = viewEl.clientHeight;
    if (!w || !hh) return;
    const cur = V.renderer.getSize(new THREE.Vector2());
    if (cur.x !== w || cur.y !== hh) {
      V.renderer.setSize(w, hh, false);
      V.camera.aspect = w / hh;
      V.camera.updateProjectionMatrix();
    }
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(requestRender) : null;
  if (ro) ro.observe(viewEl);
  requestRender();

  function disposeModel() {
    if (!V.ok) return;
    if (V.mesh) {
      V.scene.remove(V.mesh);
      V.mesh.geometry.dispose();
      V.mesh = null;
    }
    clearMarkers();
  }
  function clearMarkers() {
    if (!V.ok) return;
    for (const m of V.markers) { V.markerGroup.remove(m); m.material.dispose(); }
    V.markers = [];
  }

  function buildModel(fit) {
    if (!V.ok || !S.result) return;
    const r = S.result;
    const n = S.positions.length - (S.positions.length % 9);
    if (!V.mesh || V.mesh.geometry.getAttribute('position').array.length !== n) {
      disposeModel();
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n), 3));
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n), 3));
      V.mesh = new THREE.Mesh(geo, V.material);
      V.scene.add(V.mesh);
    }
    const geo = V.mesh.geometry;
    transformPositions(S.positions, r, geo.getAttribute('position').array);
    geo.getAttribute('position').needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    V.cube.material.color.set(r.fits18 ? 0x35b36b : 0xe0453a);
    const zf = r.bbox.max[2] + 0.03;
    V.arrow.position.set(0, 0.004, zf);
    V.label.position.set(0, 0.05, zf + 0.2);
    if (fit) {
      const size = Math.max(r.sizeM[0], r.sizeM[1], r.sizeM[2], START_SIZE);
      V.controls.target.set(0, Math.min(r.sizeM[1], 1) / 2, 0);
      V.camera.position.set(size * 1.45, r.sizeM[1] / 2 + size * 1.0, size * 1.9);
      V.camera.near = size / 200;
      V.camera.far = size * 60;
      V.camera.updateProjectionMatrix();
      V.controls.update();
    }
  }

  const tmpColor = V.ok ? new THREE.Color() : null;
  function recolor() {
    if (!V.ok || !V.mesh || !S.result) return;
    const r = S.result;
    const nc = r.components.length;
    const table = new Float32Array((nc + 1) * 3);
    const setC = (i, hex, boost) => {
      tmpColor.set(hex);
      if (boost) tmpColor.lerp(new THREE.Color('#ffffff'), 0.55);
      table[i * 3] = tmpColor.r; table[i * 3 + 1] = tmpColor.g; table[i * 3 + 2] = tmpColor.b;
    };
    for (let i = 0; i < nc; i++) setC(i, TYPE_COLOR.body, false);
    for (const f of S.features) {
      for (const id of f.componentIds || []) if (id >= 0 && id < nc) setC(id, TYPE_COLOR[f.type] || TYPE_COLOR.other, f.id === S.hover);
    }
    const col = V.mesh.geometry.getAttribute('color').array;
    const tc = r.triComponent;
    const T = Math.min(tc.length, col.length / 9);
    for (let t = 0; t < T; t++) {
      const b = tc[t] * 3, o = t * 9;
      const cr = table[b], cg = table[b + 1], cb = table[b + 2];
      col[o] = cr; col[o + 1] = cg; col[o + 2] = cb;
      col[o + 3] = cr; col[o + 4] = cg; col[o + 5] = cb;
      col[o + 6] = cr; col[o + 7] = cg; col[o + 8] = cb;
    }
    V.mesh.geometry.getAttribute('color').needsUpdate = true;
    for (const m of V.markers) m.scale.setScalar(m.userData.fid === S.hover ? 2 : 1);
    requestRender();
  }

  function rebuildMarkers() {
    if (!V.ok) return;
    clearMarkers();
    for (const f of S.features) {
      if (f.source === 'component' && f.componentIds.length) continue; // shown by colour
      const mat = new THREE.MeshBasicMaterial({ color: TYPE_COLOR[f.type] || TYPE_COLOR.other, depthTest: false, transparent: true, opacity: 0.92 });
      const m = new THREE.Mesh(V.markerGeo, mat);
      m.position.set(f.position[0], f.position[1], f.position[2]);
      m.renderOrder = 5;
      m.userData.fid = f.id;
      V.markerGroup.add(m);
      V.markers.push(m);
    }
  }

  // click-to-tag (ignores orbit drags)
  let down = null;
  const onDown = (e) => { down = { x: e.clientX, y: e.clientY, b: e.button }; };
  const onUp = (e) => {
    const d = down;
    down = null;
    if (!d || d.b !== 0 || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
    if (!S.adding || !V.ok || !V.mesh || !S.result || S.busy) return;
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    V.raycaster.setFromCamera(ndc, V.camera);
    const hit = V.raycaster.intersectObject(V.mesh, false)[0];
    if (hit) addMarkerAt([hit.point.x, hit.point.y, hit.point.z], hit.faceIndex);
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);

  function addMarkerAt(point, faceIndex) {
    const r = S.result;
    const cid = faceIndex != null && faceIndex < r.triComponent.length ? r.triComponent[faceIndex] : -1;
    // clicking a part that is already tagged re-types it instead of stacking markers
    const existing = cid >= 0 ? S.features.find((f) => (f.componentIds || []).includes(cid)) : null;
    if (existing) {
      setOverride(existing, { type: S.addType, accepted: true }, true);
      refresh();
      return;
    }
    let ids = [];
    if (cid >= 0 && !r.fused && r.components.length > 1) {
      let total = 0;
      for (const c of r.components) total += c.areaM2;
      if (r.components[cid].areaM2 < 0.5 * total) ids = [cid];
    }
    const comp = ids.length ? r.components[cid] : null;
    const pos = comp ? comp.centroid : point;
    const data = {};
    if (S.addType === 'wheel') {
      // a wheel on the floor: its centre height is its radius
      const rad = comp && comp.symAxis && comp.roundness > 0.8 ? comp.radius : null;
      if (rad) {
        data.radiusM = rad;
        const std = [2.75, 3.25, 4].reduce((a, b) => (Math.abs(b * IN - rad * 2) < Math.abs(a * IN - rad * 2) ? b : a));
        data.diameterIn = std;
      }
    }
    if (S.addType === 'lift') data.maxHeightM = Math.max(r.sizeM[1], point[1]);
    S.manual.push({
      id: 'm' + S.manualSeq++, type: S.addType, raw: canonicalToRaw(pos, r), componentIds: ids, data,
      axisRaw: comp && comp.symAxis ? canonicalToRaw([comp.symAxis[0] * r.scale - 0 + r.offset[0], comp.symAxis[1] * r.scale + r.offset[1], comp.symAxis[2] * r.scale + r.offset[2]], r) : null,
    });
    refresh();
  }

  function setAdding(on) {
    S.adding = !!on;
    addBtn.classList.toggle('active', S.adding);
    addBtn.textContent = S.adding ? 'Adding: click model' : 'Add marker';
    viewEl.classList.toggle('stl-adding', S.adding);
  }

  // ------------------------------------------------------------------ feature list state
  const keyOf = (f) => (f.source === 'manual' ? f.id : f.source === 'component' ? 'c:' + f.componentIds.join(',') : `r:${f.autoType || f.type}:${f.position.map((v) => v.toFixed(2)).join(',')}`);

  function setOverride(f, patch, quiet) {
    if (f.source === 'manual') {
      const m = S.manual.find((x) => x.id === f.id);
      if (!m) return;
      if (patch.deleted) S.manual = S.manual.filter((x) => x !== m);
      if (patch.type) m.type = patch.type;
    } else {
      const k = f.key;
      S.overrides.set(k, { ...(S.overrides.get(k) || {}), ...patch });
    }
    if (!quiet) refresh();
  }

  function computeFeatures() {
    const r = S.result;
    if (!r) { S.features = []; S.summary = null; return; }
    const list = [];
    for (const f of r.features) {
      const base = { ...f, autoType: f.type };
      base.key = keyOf(base);
      const o = S.overrides.get(base.key);
      if (o && o.deleted) continue;
      base.accepted = !!(o && o.accepted);
      if (o && o.type && o.type !== f.type) {
        base.type = o.type;
        base.reason = `Re-typed by you (auto-detected as ${TYPE_LABEL[f.type].toLowerCase()}). ${f.reason}`;
        base.confidence = 1;
        if (o.type === 'lift' && !(base.data && base.data.maxHeightM)) base.data = { ...base.data, maxHeightM: r.sizeM[1] };
      }
      list.push(base);
    }
    for (const m of S.manual) {
      let axis = null;
      if (m.axisRaw) {
        const a = rawToCanonical(m.axisRaw, r);
        const v = [a[0] - r.offset[0], a[1] - r.offset[1], a[2] - r.offset[2]];
        const l = Math.hypot(v[0], v[1], v[2]) || 1;
        axis = [v[0] / l, v[1] / l, v[2] / l];
      }
      list.push({
        id: m.id, key: m.id, type: m.type, autoType: null, confidence: 1, accepted: true, source: 'manual',
        reason: m.componentIds.length ? 'Tagged by you by clicking this part.' : 'Marker placed by you on the model.',
        componentIds: m.componentIds.slice(), position: rawToCanonical(m.raw, r), axis, data: { ...m.data },
      });
    }
    S.features = list;
    S.summary = summarizeFeatures(list, { heightM: r.sizeM[1] });
  }

  function renderList() {
    listBox.textContent = '';
    if (!S.result) { listBox.append(h('div.muted.small', null, 'Nothing loaded yet.')); return; }
    if (!S.features.length) {
      listBox.append(h('div.muted.small', null, 'No mechanisms found. Press "Add marker", pick a type and click the model to tag wheels, lift, claw and pistons by hand.'));
      return;
    }
    for (const f of S.features) {
      const sel = h('select', { title: 'Change the type', onchange: () => setOverride(f, { type: sel.value, accepted: true }) },
        FEATURE_TYPES.map((t) => h('option', { value: t, selected: t === f.type }, TYPE_LABEL[t])));
      const confCls = f.confidence >= 0.7 ? 'green' : f.confidence >= 0.45 ? 'yellow' : 'red';
      const row = h('div.stl-row' + (f.accepted ? '.stl-ok' : ''), {
        'data-fid': f.id, 'data-type': f.type,
        style: { borderLeftColor: TYPE_COLOR[f.type] || TYPE_COLOR.other },
        onmouseenter: () => setHover(f.id), onmouseleave: () => setHover(null),
      },
      h('div.row', { style: { gap: '6px' } },
        sel,
        h('span.tag.' + confCls, { title: 'Confidence' }, Math.round(f.confidence * 100) + '%'),
        f.source === 'region' ? h('span.tag', { title: 'Found by scanning the fused shell, not a separate part' }, 'region') : f.source === 'manual' ? h('span.tag.blue', null, 'manual') : null,
        h('span.grow'),
        h('button.btn.small' + (f.accepted ? '.good' : ''), { type: 'button', title: f.accepted ? 'Accepted' : 'Accept this suggestion', 'data-act': 'accept', onclick: () => setOverride(f, { accepted: !f.accepted }) }, f.accepted ? '✓ Accepted' : 'Accept'),
        h('button.btn.small', { type: 'button', title: 'Remove', 'data-act': 'delete', onclick: () => setOverride(f, { deleted: true }) }, '✕')),
      h('div.stl-reason', null, f.reason),
      h('div.stl-pos', null, `x ${inch(f.position[0])} in · height ${inch(f.position[1])} in · forward ${inch(f.position[2])} in`));
      listBox.append(row);
    }
  }

  function setHover(id) {
    if (S.hover === id) return;
    S.hover = id;
    for (const row of listBox.children) row.classList && row.classList.toggle('stl-hot', row.dataset && row.dataset.fid === id);
    recolor();
  }

  function renderInfo() {
    const r = S.result;
    sizeBox.textContent = '';
    warnBox.textContent = '';
    summaryBox.textContent = '';
    if (!r) {
      sizeBox.append(h('div.muted.small', null, 'Load a model to check it against the size limits.'));
      summaryBox.append(h('div.muted.small', null, 'The drivetrain, lift, claw and pneumatics found in your CAD will be listed here.'));
      return;
    }
    const tag = (ok, yes, no) => h('span.tag.' + (ok ? 'green' : 'red'), null, ok ? yes : no);
    sizeBox.append(
      h('div', null, h('b', null, `${r.sizeIn.width.toFixed(1)} × ${r.sizeIn.length.toFixed(1)} × ${r.sizeIn.height.toFixed(1)} in`), h('span.muted.small', null, '  wide × long × tall')),
      h('div.row', { 'data-stl': 'checks' },
        tag(r.checks.fits18, '✓ fits 18 × 18 × 18 in', '✗ larger than 18 × 18 × 18 in'),
        tag(r.checks.footprint24, '✓ within 24 × 24 in footprint', '✗ footprint over 24 × 24 in'),
        tag(r.checks.height50, '✓ 50 in tall or less', '✗ taller than 50 in')),
      h('div.small.muted', null, `Units: ${UNIT_NAMES[r.units]}${r.unitsSource === 'guess' ? ' (guessed)' : ' (set by you)'}. ${r.unitsSource === 'guess' ? r.unitsGuess.reason : ''}`),
      h('div.small.muted', null, `Up axis in file: ${r.upAxis.toUpperCase()}. ${r.rotationSource === 'guess' ? r.upGuess.reason : 'Orientation set by you.'}`),
      h('div.small.muted', null, `${r.triangleCount.toLocaleString()} triangles, ${r.components.length.toLocaleString()} separate part${r.components.length === 1 ? '' : 's'}.`));
    for (const w of r.warnings) warnBox.append(h('div.stl-warn', null, w));
    const s = S.summary;
    const d = s.drivetrain;
    const kv = (k, v) => [h('span.muted', null, k), h('b', null, v)];
    summaryBox.append(h('div.stl-kv', { 'data-stl': 'summary' },
      kv('Drivetrain', `${d.type === 'xdrive' ? 'X-drive' : 'Tank drive'}, ${d.motors} motors${d.detected ? '' : ' (default)'}`),
      kv('Wheels', `${d.wheels} × ${d.wheelDiaIn} in`),
      kv('Track width', `${inch(d.trackWidthM)} in (${(d.trackWidthM * 1000).toFixed(0)} mm)`),
      kv('Wheelbase', `${inch(d.wheelbaseM)} in (${(d.wheelbaseM * 1000).toFixed(0)} mm)`),
      kv('Lift', s.lift.present ? `${s.lift.kind && s.lift.kind !== 'unknown' ? s.lift.kind + ', ' : ''}reach about ${inch(s.lift.maxHeightM)} in` : 'none'),
      kv('Claw', s.claw.present ? 'yes' : 'none'),
      kv('Pneumatics', `${s.pistons} piston${s.pistons === 1 ? '' : 's'}, ${s.tanks} air tank${s.tanks === 1 ? '' : 's'}`),
      kv('Motors found', String(s.motors))));
    for (const n of s.notes) summaryBox.append(h('div.small.muted', { style: { marginTop: '4px' } }, n));
  }

  function refresh() {
    computeFeatures();
    renderList();
    renderInfo();
    rebuildMarkers();
    recolor();
    useBtn.disabled = !S.result || S.busy;
    useMsg.textContent = '';
  }

  function renderLast() {
    const last = store.get('stl:last');
    lastBox.textContent = '';
    if (!last || !last.summary) return;
    const d = last.summary.drivetrain;
    lastBox.append(`Last import: ${last.name} (${new Date(last.when).toLocaleString()}) - ${d.type === 'xdrive' ? 'X-drive' : 'tank'}, ${d.wheels} × ${d.wheelDiaIn} in wheels${last.summary.lift.present ? ', lift' : ''}${last.summary.claw.present ? ', claw' : ''}${last.summary.pistons ? `, ${last.summary.pistons} piston(s)` : ''}${last.applied ? ' - in use' : ''}.`);
  }

  function persist(applied) {
    const r = S.result;
    if (!r) return;
    store.set('stl:last', {
      name: S.name, when: Date.now(), applied: !!applied, units: r.units, upAxis: r.upAxis,
      sizeIn: r.sizeIn, checks: r.checks, triangleCount: r.triangleCount, componentCount: r.components.length, fused: r.fused,
      summary: S.summary,
      features: S.features.map((f) => ({ type: f.type, confidence: f.confidence, source: f.source, accepted: f.accepted, position: f.position.map((v) => Math.round(v * 1000) / 1000) })),
    });
    renderLast();
  }

  // ------------------------------------------------------------------ loading / analysis
  function setBusy(on, text) {
    S.busy = on;
    spinner.hidden = !on;
    overlay.hidden = !on && !!S.result;
    if (text) overlayText.textContent = text;
    root.dataset.busy = on ? '1' : '0';
    useBtn.disabled = on || !S.result;
    for (const b of tools.querySelectorAll('button, select')) b.disabled = on || !S.result;
  }
  function showError(msg) {
    errBox.hidden = !msg;
    errBox.textContent = msg || '';
  }

  async function runAnalysis(fit) {
    const token = ++S.token;
    setBusy(true, 'Analysing…');
    await nextFrame();
    try {
      const result = await analyzeSTLAsync(S.positions, {
        units: S.units || undefined,
        rotation: S.rotation || undefined,
        yield: async (label) => { if (token === S.token) overlayText.textContent = label + '…'; await nextFrame(); },
      });
      if (token !== S.token) return;
      S.result = result;
      root.dataset.ready = '1';
      buildModel(fit);
      setBusy(false);
      refresh();
      persist(false);
    } catch (e) {
      if (token !== S.token) return;
      console.warn('STL analysis failed', e);
      S.result = null;
      disposeModel();
      setBusy(false, 'Could not analyse this model.');
      overlay.hidden = false;
      showError(e && e.message ? e.message : String(e));
      refresh();
    }
  }

  async function loadPositions(positions, name) {
    showError('');
    disposeModel();
    S.positions = positions;
    S.name = name;
    S.result = null;
    S.units = null;
    S.rotation = null;
    S.overrides.clear();
    S.manual = [];
    S.hover = null;
    unitSel.value = 'auto';
    delete root.dataset.ready;
    fileInfo.textContent = `${name} - ${(positions.length / 9).toLocaleString()} triangles`;
    await runAnalysis(true);
    return S.result;
  }

  async function loadFile(file) {
    if (S.busy) return null;
    showError('');
    setBusy(true, `Reading ${file.name}…`);
    overlay.hidden = false;
    await nextFrame();
    try {
      const buf = await file.arrayBuffer();
      overlayText.textContent = 'Parsing triangles…';
      await nextFrame();
      const positions = parseSTL(buf);
      return await loadPositions(positions, file.name.replace(/\.stl$/i, '') || 'robot');
    } catch (e) {
      console.warn('STL load failed', e);
      setBusy(false, S.result ? '' : 'Load an STL to begin');
      showError(`Could not load "${file.name}": ${e && e.message ? e.message : e}`);
      return null;
    }
  }

  async function loadSample() {
    if (S.busy) return null;
    return loadPositions(buildSampleRobot(), 'Sample robot');
  }

  function reanalyze() {
    if (!S.positions || S.busy) return;
    runAnalysis(false);
  }
  function rotate(m) {
    if (!S.result || S.busy) return;
    S.rotation = matMul3(m, S.result.rotation);
    runAnalysis(false);
  }

  // ------------------------------------------------------------------ export
  function exportFeatures() {
    // canonical (front +Z) → simulator frame (front -Z): turn 180 deg about Y
    const flip = (v) => (v ? [-v[0], v[1], -v[2]] : null);
    return S.features.map((f) => ({
      id: f.id, type: f.type, confidence: f.confidence, accepted: f.accepted, source: f.source, reason: f.reason,
      position: flip(f.position), axis: flip(f.axis), componentIds: f.componentIds.slice(), data: { ...f.data },
    }));
  }

  function useRobot() {
    if (!S.result || S.busy) return;
    const r = S.result;
    computeFeatures();
    const n = S.positions.length - (S.positions.length % 9);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(transformPositions(S.positions, r, new Float32Array(n), { frontNegZ: true }), 3));
    if (V.mesh) geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(V.mesh.geometry.getAttribute('color').array), 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const info = {
      name: S.name, features: exportFeatures(), summary: S.summary,
      units: r.units, scale: r.scale, sizeM: r.sizeM.slice(), sizeIn: { ...r.sizeIn }, checks: { ...r.checks }, fits18: r.fits18,
      fused: r.fused, triangleCount: r.triangleCount,
    };
    let applied = false;
    try {
      if (ctx.app && typeof ctx.app.applyImportedRobot === 'function') {
        ctx.app.applyImportedRobot({ geometry, ...info });
        applied = true;
      }
    } catch (e) {
      console.error('applyImportedRobot failed', e);
      useMsg.textContent = 'The simulator could not use this robot: ' + (e && e.message ? e.message : e);
      geometry.dispose();
      return;
    }
    if (!applied) geometry.dispose();
    bus.emit('stl:imported', info);
    persist(true);
    useMsg.textContent = applied ? `✓ "${S.name}" is now the simulator robot.` : '✓ Import saved (simulator not connected on this page).';
  }

  // ------------------------------------------------------------------ init
  setBusy(false, 'Load an STL to begin');
  overlay.hidden = false;
  refresh();
  renderLast();

  return {
    loadFile, loadSample, loadPositions,
    getState: () => ({ name: S.name, result: S.result, features: S.features, summary: S.summary }),
    destroy() {
      S.token++;
      cancelAnimationFrame(V.raf);
      if (ro) ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      if (V.ok) {
        disposeModel();
        V.controls.dispose();
        V.material.dispose();
        V.markerGeo.dispose();
        V.cube.geometry.dispose(); V.cube.material.dispose();
        V.grid.geometry.dispose(); V.grid.material.dispose();
        V.arrow.dispose();
        V.labelTex.dispose(); V.label.material.dispose();
        V.renderer.dispose();
      }
      root.remove();
    },
  };
}
