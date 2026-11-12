// WebXR layer: controllers, ray-pointer menu panel, viewpoints, and mapping VR gamepads onto the
// simulated V5 controller. Works with any xr-standard controller (Quest Touch, Vive wands, Index).
import * as THREE from 'three';
import { PRESETS } from '../sim/robotConfig.js';
import { CHALLENGES, starStr } from './challenges.js';
import { RULES } from './rulesData.js';
import { store } from '../store.js';
import { FIELD } from '../sim/fieldData.js';

const PW = 1024, PH = 720;
const VIEWPOINTS = [
  { name: 'Red driver station', pos: [-FIELD.half - 0.9, 0, 0], yaw: -Math.PI / 2 },
  { name: 'South sideline', pos: [0, 0, FIELD.half + 1.0], yaw: 0 },
  { name: 'Blue driver station', pos: [FIELD.half + 0.9, 0, 0], yaw: Math.PI / 2 },
  { name: 'Referee tower (overhead)', pos: [0, 1.9, FIELD.half + 0.4], yaw: 0 },
];

export class VRUI {
  constructor(renderer, scene, rig, app) {
    Object.assign(this, { renderer, scene, rig, app });
    this.page = 'home'; this.scroll = 0; this.buttons = []; this.hover = null; this.rule = null; this.view = 0;
    this.canvas = document.createElement('canvas');
    this.canvas.width = PW; this.canvas.height = PH;
    this.g = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.panel = new THREE.Mesh(new THREE.PlaneGeometry(1.0, (1.0 * PH) / PW), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true }));
    this.panel.visible = false;
    rig.add(this.panel);
    this.raycaster = new THREE.Raycaster();
    this.controllers = [0, 1].map((i) => {
      const c = renderer.xr.getController(i);
      const ray = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0x35d0ff }));
      ray.scale.z = 2; ray.visible = false;
      const wand = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.12, 10), new THREE.MeshStandardMaterial({ color: i ? 0x2a6fe0 : 0xd8362b }));
      wand.rotation.x = Math.PI / 2; wand.position.z = 0.04;
      c.add(ray, wand);
      c.userData = { ray, hand: null, prev: [] };
      c.addEventListener('connected', (e) => { c.userData.hand = e.data.handedness; c.userData.source = e.data; });
      c.addEventListener('disconnected', () => { c.userData.source = null; });
      c.addEventListener('selectstart', () => { if (c.userData.hit) this.click(c.userData.hit); });
      rig.add(c);
      return c;
    });
    renderer.xr.addEventListener('sessionstart', () => { this.panel.visible = true; this.setView(0); this.draw(); });
    renderer.xr.addEventListener('sessionend', () => { this.panel.visible = false; rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0); });
    this.redrawT = 0;
  }

  setView(i) {
    this.view = (i + VIEWPOINTS.length) % VIEWPOINTS.length;
    const v = VIEWPOINTS[this.view];
    this.rig.position.set(...v.pos);
    this.rig.rotation.set(0, v.yaw, 0);
    // panel floats to the lower-left of the user's forward view, in rig space
    this.panel.position.set(-0.75, 1.25, -0.9);
    this.panel.rotation.set(-0.15, 0.6, 0);
    this.app.toast?.('Viewpoint: ' + v.name);
  }

  // ---------- drawing ----------
  btn(x, y, w, h, label, fn, o = {}) {
    const g = this.g, hot = this.hover && this.hover.x === x && this.hover.y === y;
    g.fillStyle = o.color ?? (hot ? '#2f9be0' : '#2a3442');
    g.strokeStyle = hot ? '#fff' : '#4a586b'; g.lineWidth = 3;
    g.beginPath(); g.roundRect(x, y, w, h, 12); g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.font = `${o.size ?? 26}px system-ui`; g.textAlign = o.align ?? 'center'; g.textBaseline = 'middle';
    g.fillText(label, o.align === 'left' ? x + 16 : x + w / 2, y + h / 2, w - 24);
    this.buttons.push({ x, y, w, h, fn });
  }
  text(str, x, y, maxW, size = 24, color = '#e8edf3', lineH = size * 1.35, maxLines = 99) {
    const g = this.g;
    g.font = `${size}px system-ui`; g.fillStyle = color; g.textAlign = 'left'; g.textBaseline = 'top';
    let lines = 0;
    for (const para of String(str).split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        if (g.measureText(line + word).width > maxW && line) { g.fillText(line, x, y); y += lineH; line = ''; if (++lines >= maxLines) return y; }
        line += word + ' ';
      }
      g.fillText(line, x, y); y += lineH; if (++lines >= maxLines) return y;
    }
    return y;
  }
  draw() {
    const g = this.g, app = this.app, w = app.world;
    this.buttons = [];
    g.clearRect(0, 0, PW, PH);
    g.fillStyle = 'rgba(14,18,23,0.94)'; g.beginPath(); g.roundRect(0, 0, PW, PH, 28); g.fill();
    const tabs = [['home', 'Home'], ['challenges', 'Challenges'], ['robots', 'Robots'], ['john', 'John VEX'], ['rules', 'Rules']];
    tabs.forEach(([id, label], i) => this.btn(20 + i * 198, 16, 188, 56, label, () => { this.page = id; this.scroll = 0; this.rule = null; }, { color: this.page === id ? '#2f9be0' : undefined, size: 24 }));
    const top = 96;
    if (this.page === 'home') {
      const sc = w.score(), ses = app.session, ch = ses?.challenge;
      this.text(ch ? `${ch.title}  ·  ${ch.mode}` : 'Free Practice', 30, top, 960, 34);
      this.text(ch ? ch.brief : 'Full Override field. Drive with the thumbsticks.', 30, top + 50, 960, 22, '#93a0b1', 30, 3);
      g.font = 'bold 64px system-ui'; g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText(app.clockText(), 30, top + 150);
      g.fillStyle = '#e0453a'; g.fillText(String(sc.red + (ses?.s?.autoBonus ?? 0)), 300, top + 150);
      g.fillStyle = '#3478e6'; g.fillText(String(sc.blue), 440, top + 150);
      this.text(`Air ${Math.round(w.robot.psi)} psi   Lift ${Math.round(w.liftHeight() * 1000)} mm   ${w.robot.held ? 'Holding ' + w.obj(w.robot.held).type : 'Claw empty'}`, 560, top + 170, 440, 22, '#93a0b1');
      this.btn(30, 350, 300, 90, app.runtime.running || ses?.state === 'running' ? '● Running' : '▶ Start / Run', () => app.runProgram(), { color: '#35b36b', size: 32 });
      this.btn(350, 350, 300, 90, '■ Stop', () => app.stopProgram(), { color: '#e0453a', size: 32 });
      this.btn(670, 350, 324, 90, '↺ Reset field', () => app.resetField(), { size: 32 });
      this.btn(30, 460, 300, 76, 'Next viewpoint', () => this.setView(this.view + 1));
      this.btn(350, 460, 300, 76, 'Match load', () => w.matchLoad());
      this.btn(670, 460, 324, 76, 'Hide panel (Y / B)', () => { this.panel.visible = false; });
      this.text('Left stick: drive · Right stick: turn · Triggers: claw close/open · Grips: lift up/down · A/X: flipper · Stick click: viewpoint', 30, 570, 960, 21, '#93a0b1', 28);
    } else if (this.page === 'challenges') {
      const prog = store.get('progress', {});
      CHALLENGES.slice(this.scroll, this.scroll + 6).forEach((ch, i) => {
        this.btn(30, top + i * 86, 800, 76, `${this.scroll + i + 1}. ${ch.title}   ${starStr(prog[ch.id]?.stars ?? 0)}   (${ch.mode}, ${ch.time}s)`, () => { app.startChallenge(ch); this.page = 'home'; }, { align: 'left' });
      });
      this.btn(850, top, 144, 76, '▲', () => { this.scroll = Math.max(0, this.scroll - 6); });
      this.btn(850, top + 86, 144, 76, '▼', () => { if (this.scroll + 6 < CHALLENGES.length) this.scroll += 6; });
      this.btn(850, top + 430, 144, 76, 'Free', () => { app.startChallenge(null); this.page = 'home'; });
    } else if (this.page === 'robots') {
      PRESETS.forEach((p, i) => this.btn(30 + (i % 2) * 490, top + Math.floor(i / 2) * 96, 474, 84, p.name, () => { app.view.importedGeometry = null; app.setRobot(structuredClone(p)); }, { color: w.cfg.name === p.name ? '#2f9be0' : undefined }));
      this.text('Customise parts, pneumatics and sensors in desktop mode (Build tab).', 30, 640, 960, 22, '#93a0b1');
    } else if (this.page === 'john') {
      this.text(app.lastJohn ?? 'Hi, I\'m John VEX!', 30, top, 964, 26, '#e8edf3', 36, 12);
      this.btn(30, 610, 230, 80, '💡 Hint', () => app.john.hint());
      this.btn(275, 610, 230, 80, 'Explain task', () => app.john.explain());
      this.btn(520, 610, 230, 80, 'Review run', () => app.john.review(app.lastRun));
      this.btn(765, 610, 230, 80, 'Wave', () => { app.view.john.userData.wave = 2; });
    } else if (this.page === 'rules') {
      const list = RULES.filter((r) => /^(SC|SG|S)\d/.test(r.id) || r.section === 'quick');
      if (this.rule) {
        this.text(`${this.rule.id} — ${this.rule.title}`, 30, top, 820, 30);
        const r = this.rule;
        const full = [r.summary, ...(r.table ? r.table.rows.map((row) => '• ' + row.join('  —  ')) : []), ...(r.points ?? []).map((pt) => '• ' + pt), r.example ? 'Example: ' + r.example : ''].filter(Boolean).join('\n');
        this.text(full, 30, top + 56, 964, 21, '#cfd6de', 28, 19);
        this.btn(850, top - 8, 144, 60, 'Back', () => { this.rule = null; });
      } else {
        list.slice(this.scroll, this.scroll + 12).forEach((r, i) => this.btn(30 + (i % 2) * 412, top + Math.floor(i / 2) * 84, 400, 74, `${r.id}: ${r.title}`, () => { this.rule = r; }, { align: 'left', size: 21 }));
        this.btn(860, top, 134, 74, '▲', () => { this.scroll = Math.max(0, this.scroll - 12); });
        this.btn(860, top + 84, 134, 74, '▼', () => { if (this.scroll + 12 < list.length) this.scroll += 12; });
        this.text('Paraphrased study summary of manual v2.1 — the official VEX Game Manual is the only authority.', 30, 660, 960, 19, '#93a0b1');
      }
    }
    this.tex.needsUpdate = true;
  }
  click(hit) { const b = this.buttons.find((q) => hit.x >= q.x && hit.x <= q.x + q.w && hit.y >= q.y && hit.y <= q.y + q.h); if (b) { b.fn(); this.draw(); } }

  // ---------- per frame (only while presenting) ----------
  update(dt) {
    const app = this.app, ctl = app.world.controller, xr = this.renderer.xr;
    if (!xr.isPresenting) return false;
    const btn = {}; let ax = [0, 0, 0, 0], hover = null, overPanel = false;
    for (const c of this.controllers) {
      const src = c.userData.source, gp = src?.gamepad;
      c.userData.hit = null; c.userData.ray.visible = false;
      if (this.panel.visible) {
        const m = new THREE.Matrix4().extractRotation(c.matrixWorld);
        this.raycaster.ray.origin.setFromMatrixPosition(c.matrixWorld);
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(m);
        const hit = this.raycaster.intersectObject(this.panel)[0];
        if (hit) {
          c.userData.hit = { x: hit.uv.x * PW, y: (1 - hit.uv.y) * PH };
          c.userData.ray.visible = true; c.userData.ray.scale.z = hit.distance;
          const b = this.buttons.find((q) => c.userData.hit.x >= q.x && c.userData.hit.x <= q.x + q.w && c.userData.hit.y >= q.y && c.userData.hit.y <= q.y + q.h);
          if (b) hover = b;
          overPanel = true;
        }
      }
      if (!gp) continue;
      const left = c.userData.hand === 'left', b = gp.buttons, p = c.userData.prev;
      const sx = gp.axes[2] ?? gp.axes[0] ?? 0, sy = gp.axes[3] ?? gp.axes[1] ?? 0;
      const dz = (v) => (Math.abs(v) < 0.12 ? 0 : v);
      if (left) { ax[3] = dz(sx) * 100; ax[2] = -dz(sy) * 100; } else { ax[0] = dz(sx) * 100; ax[1] = -dz(sy) * 100; }
      const down = (i) => !!b[i]?.pressed, edge = (i) => down(i) && !p[i];
      if (!c.userData.hit) { if (down(0)) btn[left ? 'R2' : 'R1'] = true; }
      if (down(1)) btn[left ? 'L2' : 'L1'] = true;
      if (down(4)) btn[left ? 'X' : 'A'] = true;
      if (edge(5)) { this.panel.visible = !this.panel.visible; if (this.panel.visible) this.draw(); }
      if (edge(3)) this.setView(this.view + 1);
      c.userData.prev = b.map((q) => q.pressed);
    }
    ctl.axis1 = ax[0]; ctl.axis2 = ax[1]; ctl.axis3 = ax[2]; ctl.axis4 = ax[3];
    ctl.buttons = btn;
    const changed = hover !== this.hover;
    this.hover = hover;
    this.redrawT += dt;
    if (this.panel.visible && (changed || this.redrawT > 0.33)) { this.redrawT = 0; this.draw(); }
    return true;
  }
}
