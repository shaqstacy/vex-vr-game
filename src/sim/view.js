// three.js rendering of the World: field, game elements, robot, John VEX, helpers.
import * as THREE from 'three';
import { FIELD, PIN, CUP, GOAL_R, TOGGLE, LOADER, LAYOUT, COLORS } from './fieldData.js';
import { CARTRIDGES } from './robotConfig.js';

const V = (x, up, y) => new THREE.Vector3(x, up, -y); // field (x, y) + height -> three
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, ...o });
const M = {
  alu: mat(0xb9c0c8, { metalness: 0.6, roughness: 0.35 }),
  dark: mat(0x23272e),
  black: mat(0x111316, { roughness: 0.8 }),
  white: mat(0xf2f2f2),
  green: mat(0x2f8f55),
  wheel: mat(0x2c8a4a, { roughness: 0.9 }),
  omni: mat(0x3a3f47, { roughness: 0.9 }),
  red: mat(COLORS.red), blue: mat(COLORS.blue), yellow: mat(COLORS.yellow),
  cupGray: mat(0x8d949c),
  cupClear: mat(0xcfe6f5, { transparent: true, opacity: 0.28, roughness: 0.1, side: THREE.DoubleSide, depthWrite: false }),
  wall: mat(0xdfeefa, { transparent: true, opacity: 0.13, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false }),
  tank: mat(0x1b3a6b, { metalness: 0.4 }),
  brass: mat(0xc9a24a, { metalness: 0.7, roughness: 0.3 }),
};
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cyl = (r, h, m, seg = 20, open = false) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg, 1, open), m);
function barBetween(mesh, a, b) { // stretch a unit-length box (along Y) between two points
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  mesh.position.copy(a).addScaledVector(d, 0.5);
  mesh.scale.y = Math.max(len, 1e-4);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export class View {
  constructor(world, scene) {
    this.world = world;
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.objMeshes = new Map();
    this.toggleMeshes = [];
    this.goalMeshes = [];
    this.zoneGroup = new THREE.Group();
    this.root.add(this.zoneGroup);
    this.importedGeometry = null;
    this.buildEnvironment();
    this.buildField();
    this.buildTrail();
    this.john = buildJohn();
    this.john.position.copy(V(-1.25, 0, FIELD.half + 0.85));
    this.john.rotation.y = 0.25;
    this.root.add(this.john);
    this.rebuildRobot();
    this.syncObjects(true);
  }

  buildEnvironment() {
    const s = this.scene;
    s.background = new THREE.Color(0x1a2230);
    s.fog = new THREE.Fog(0x1a2230, 14, 40);
    s.add(new THREE.HemisphereLight(0xffffff, 0x55606e, 1.35));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(3, 7, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 16 });
    sun.shadow.bias = -0.0005;
    s.add(sun);
    const gym = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), mat(0x6b5a45, { roughness: 0.85, map: canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#8a7558'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#84704f' : '#917b5c'; g.fillRect(0, i * 16, w, 15); }
    }) }));
    gym.material.map.wrapS = gym.material.map.wrapT = THREE.RepeatWrapping;
    gym.material.map.repeat.set(20, 20);
    gym.rotation.x = -Math.PI / 2;
    gym.position.y = -0.003;
    gym.receiveShadow = true;
    this.root.add(gym);
  }

  buildField() {
    const H = FIELD.half, root = this.root;
    // foam tiles + tape painted into one texture (1 px = 2 mm)
    const px = 2048, sc = px / (2 * H), P = (x, y) => [(x + H) * sc, (H - y) * sc];
    const floorTex = canvasTex(px, px, (g) => {
      g.fillStyle = '#7d848c'; g.fillRect(0, 0, px, px);
      g.strokeStyle = '#6c737b'; g.lineWidth = 3;
      for (let i = 0; i <= 6; i++) { const p = i * FIELD.tile * sc - (FIELD.tile * 3 - H) * sc; g.beginPath(); g.moveTo(p, 0); g.lineTo(p, px); g.moveTo(0, p); g.lineTo(px, p); g.stroke(); }
      const line = (pts, color, w = FIELD.tapeW) => { g.strokeStyle = color; g.lineWidth = w * sc; g.lineJoin = 'miter'; g.beginPath(); pts.forEach(([x, y], i) => { const [a, b] = P(x, y); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke(); };
      const R = FIELD.midR, k = 0.07; // Autonomous Line: two parallel tapes on the NW-SE diagonal, routed round the Midfield
      line([[R, 0], [0, R], [-R, 0], [0, -R], [R, 0], [0, R]], '#f4f4f4');
      for (const s of [1, -1]) for (const o of [k, -k]) line([[-H * s + o, H * s + o], [(-R / 2) * s + o, (R / 2) * s + o]], '#f4f4f4');
      for (const l of LAYOUT.loaders) { // Load Zone tape
        const sx = Math.sign(l.x), sy = Math.sign(l.y), z = 0.42;
        line([[sx * H, sy * (H - z)], [sx * (H - z * 0.55), sy * (H - z)], [sx * (H - z * 0.55), sy * H]], l.alliance === 'red' ? '#d8362b' : '#2a6fe0', 0.05);
      }
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * H, 2 * H), mat(0xffffff, { map: floorTex, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    root.add(floor);
    this.floor = floor;
    // perimeter: 12 sections (3 per side), clear panels in a black frame
    for (let side = 0; side < 4; side++) {
      const g = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const w = (2 * H) / 3, panel = box(w - 0.02, FIELD.wallH - 0.05, 0.006, M.wall);
        panel.position.set(-H + w * (i + 0.5), FIELD.wallH / 2, -H - 0.02);
        panel.renderOrder = 2;
        g.add(panel);
      }
      for (const y of [0.02, FIELD.wallH]) { const rail = box(2 * H + 0.1, 0.035, 0.045, M.black); rail.position.set(0, y, -H - 0.025); g.add(rail); }
      for (let i = 0; i <= 3; i++) { const post = box(0.035, FIELD.wallH, 0.045, M.black); post.position.set(-H + (2 * H / 3) * i, FIELD.wallH / 2, -H - 0.025); g.add(post); }
      g.rotation.y = (side * Math.PI) / 2;
      root.add(g);
    }
    // goals
    for (const gl of LAYOUT.goals) {
      const g = new THREE.Group(), m = gl.color === 'red' ? M.red : gl.color === 'blue' ? M.blue : mat(0x4b5562);
      const basePlate = cyl(gl.kind === 'mid' ? 0.11 : 0.085, 0.012, M.black, 6);
      basePlate.position.y = 0.006;
      const post = cyl(GOAL_R, gl.h, m, 24);
      post.position.y = gl.h / 2;
      const lip = new THREE.Mesh(new THREE.TorusGeometry(GOAL_R - 0.004, 0.005, 8, 24), gl.kind === 'mid' ? M.yellow : M.white);
      lip.rotation.x = Math.PI / 2;
      lip.position.y = gl.h;
      g.add(basePlate, post, lip);
      g.position.copy(V(gl.x, 0, gl.y));
      g.traverse((o) => { o.castShadow = true; });
      root.add(g);
      this.goalMeshes.push(g);
    }
    // toggles: three-faced prism on the wall rail, rotating about the wall axis
    for (const t of LAYOUT.toggles) {
      const holder = new THREE.Group(), prism = new THREE.Group();
      const rIn = 0.03, faceW = 2 * rIn * Math.tan(Math.PI / 3);
      [M.yellow, M.red, M.blue].forEach((m, i) => {
        const f = box(TOGGLE.span, 0.006, faceW, m), a = (i * 2 * Math.PI) / 3;
        f.position.set(0, Math.cos(a) * rIn, Math.sin(a) * rIn);
        f.rotation.x = a;
        prism.add(f);
      });
      for (const sx of [-1, 1]) { const paddle = box(TOGGLE.paddle, 0.09, 0.012, M.dark); paddle.position.set(sx * (TOGGLE.span / 2 - 0.03), -0.02, 0); prism.add(paddle); }
      holder.add(prism);
      holder.position.copy(V(t.x, 0.11, t.y));
      holder.rotation.y = Math.atan2(-t.d[0], t.d[1]); // local +Z faces into the field
      root.add(holder);
      this.toggleMeshes.push(prism);
    }
    // loaders
    for (const l of LAYOUT.loaders) {
      const g = new THREE.Group(), m = l.alliance === 'red' ? M.red : M.blue;
      const tube = cyl(LOADER.opening / 2 + 0.004, LOADER.height - 0.2, M.wall, 20, true);
      tube.position.y = 0.2 + (LOADER.height - 0.2) / 2;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(LOADER.opening / 2 + 0.004, 0.008, 8, 20), m);
      ring.rotation.x = Math.PI / 2; ring.position.y = LOADER.height;
      const ring2 = ring.clone(); ring2.position.y = 0.2;
      const foot = box(0.1, 0.2, 0.1, M.black); foot.position.y = 0.1; foot.scale.set(1, 1, 0.3);
      g.add(tube, ring, ring2, foot);
      g.position.copy(V(l.x, 0, l.y));
      root.add(g);
    }
  }

  buildTrail() {
    this.trailMax = 3000;
    this.trailPos = new Float32Array(this.trailMax * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.trailPos, 3));
    g.setDrawRange(0, 0);
    this.trail = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x35d0ff }));
    this.trail.frustumCulled = false;
    this.trailN = 0;
    this.root.add(this.trail);
  }
  clearTrail() { this.trailN = 0; this.trail.geometry.setDrawRange(0, 0); }

  setZones(zones) {
    this.zoneGroup.clear();
    for (const z of zones) {
      const m = new THREE.MeshBasicMaterial({ color: z.color ?? 0x35d0ff, transparent: true, opacity: 0.32, depthWrite: false });
      const mesh = z.r ? new THREE.Mesh(new THREE.CircleGeometry(z.r, 40), m) : new THREE.Mesh(new THREE.PlaneGeometry(z.w, z.h), m);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.copy(V(z.x, 0.004, z.y));
      this.zoneGroup.add(mesh);
      const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(
        z.r ? Array.from({ length: 40 }, (_, i) => new THREE.Vector3(Math.cos(i / 40 * 6.283) * z.r, Math.sin(i / 40 * 6.283) * z.r, 0))
          : [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => new THREE.Vector3(a * z.w / 2, b * z.h / 2, 0))),
      new THREE.LineBasicMaterial({ color: z.color ?? 0x35d0ff }));
      edge.rotation.x = -Math.PI / 2;
      edge.position.copy(mesh.position).setY(0.006);
      this.zoneGroup.add(edge);
    }
  }

  // ---------- robot ----------
  rebuildRobot() {
    if (this.robot) this.root.remove(this.robot);
    const { cfg, specs } = this.world, g = new THREE.Group(), L = specs.halfL, W = specs.halfW;
    const cart = CARTRIDGES[cfg.drivetrain.cartridge], wheelR = (cfg.drivetrain.wheel * 0.0254) / 2;
    const P = this.parts = {};
    const body = new THREE.Group();
    g.add(body);
    if (this.importedGeometry) {
      const m = new THREE.Mesh(this.importedGeometry, mat(0xaeb6bf, { metalness: 0.4, roughness: 0.45 }));
      m.castShadow = true;
      body.add(m);
    } else {
      for (const sx of [-1, 1]) { // side rails
        const rail = box(0.03, 0.03, 2 * L, M.alu); rail.position.set(sx * (W - 0.015), wheelR + 0.01, 0); body.add(rail);
        const inner = rail.clone(); inner.position.x = sx * (W - 0.075); body.add(inner);
      }
      for (const sz of [-1, 0.3, 1]) { const cross = box(2 * W, 0.03, 0.03, M.alu); cross.position.set(0, wheelR + 0.01, sz * (L - 0.015)); body.add(cross); }
      const type = cfg.drivetrain.type, driven = type === 'tank2' ? [[1, 1], [-1, 1]] : [[1, 1], [-1, 1], [1, -1], [-1, -1]];
      for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const isDriven = driven.some(([a, b]) => a === sx && b === sz);
        const wide = type === 'mecanum4' ? 0.05 : 0.028;
        const wh = cyl(wheelR, wide, isDriven && type.startsWith('tank') ? M.wheel : M.omni, 20);
        wh.rotation.z = Math.PI / 2;
        const holder = new THREE.Group();
        holder.add(wh);
        if (type === 'xdrive4') { holder.position.set(sx * (W - 0.03), wheelR, sz * (L - 0.03)); holder.rotation.y = (sx * sz * Math.PI) / 4; } else holder.position.set(sx * (W - 0.045), wheelR, sz * (L - wheelR - 0.01));
        body.add(holder);
        if (isDriven) { // Smart Motor with its coloured cartridge cap
          const motor = box(0.06, 0.057, 0.072, M.black), cap = box(0.012, 0.045, 0.05, mat(cart.color));
          motor.position.set(sx * (W - 0.115), wheelR + 0.01, sz * (L - wheelR - 0.01));
          cap.position.copy(motor.position).add(new THREE.Vector3(-sx * 0.035, 0, 0));
          if (type === 'xdrive4') { motor.position.set(sx * (W - 0.09), wheelR + 0.045, sz * (L - 0.09)); cap.position.copy(motor.position).setY(wheelR + 0.08); cap.scale.set(4, 0.3, 1); }
          body.add(motor, cap);
        }
      }
      const brain = box(0.1, 0.033, 0.06, M.dark); brain.position.set(0, wheelR + 0.06, L - 0.07);
      const screen = box(0.07, 0.002, 0.04, mat(0x1f6fd0, { emissive: 0x0a2c66 })); screen.position.copy(brain.position).setY(wheelR + 0.078);
      const batt = box(0.045, 0.035, 0.16, M.black); batt.position.set(W - 0.11, wheelR + 0.045, 0.02);
      body.add(brain, screen, batt);
      if (specs.usesAir) for (let i = 0; i < cfg.pneumatics.tanks; i++) {
        const tk = cyl(0.022, 0.19, M.tank, 16); tk.rotation.x = Math.PI / 2; tk.position.set(-W + 0.1 + i * 0.05, wheelR + 0.05, 0.03); body.add(tk);
        const cap1 = cyl(0.008, 0.02, M.brass, 8); cap1.rotation.x = Math.PI / 2; cap1.position.copy(tk.position).setZ(0.03 + 0.1); body.add(cap1);
      }
    }
    // lift: towers + bars from the pivot to the claw carriage
    const liftType = cfg.lift.type;
    P.carriage = new THREE.Group();
    g.add(P.carriage);
    P.bars = [];
    if (liftType !== 'none' && !this.importedGeometry) {
      const towerH = liftType === 'arm' ? 0.3 : liftType === 'fourbar' ? 0.36 : 0.4;
      for (const sx of [-1, 1]) {
        const tower = box(0.03, towerH, 0.03, M.alu); tower.position.set(sx * 0.1, wheelR + towerH / 2, L - 0.13); g.add(tower);
        const lm = box(0.06, 0.057, 0.072, M.black), lc = box(0.012, 0.045, 0.05, mat(CARTRIDGES[cfg.lift.cartridge].color));
        if (sx === 1 || liftType !== 'arm') { lm.position.set(sx * 0.15, wheelR + towerH - 0.05, L - 0.13); lc.position.copy(lm.position).add(new THREE.Vector3(sx * 0.036, 0, 0)); g.add(lm, lc); }
      }
      P.pivot = new THREE.Vector3(0, wheelR + towerH - 0.02, L - 0.13);
      const n = liftType === 'arm' ? 1 : 2;
      for (const sx of [-1, 1]) for (let i = 0; i < n * (liftType === 'dr4b' ? 2 : 1); i++) { const b = box(0.022, 1, 0.022, M.alu); b.userData = { sx, i }; g.add(b); P.bars.push(b); }
    }
    if (specs.hasClaw) {
      const back = box(0.17, 0.035, 0.02, M.alu); back.position.set(0, 0.06, 0.035);
      P.carriage.add(back);
      P.fingers = [-1, 1].map((sx) => {
        const pivot = new THREE.Group(); pivot.position.set(sx * 0.075, 0.06, 0.03);
        const f = box(0.012, 0.045, 0.12, M.green); f.position.z = -0.06;
        const tip = box(0.03, 0.045, 0.012, M.green); tip.position.set(-sx * 0.012, 0, -0.118);
        pivot.add(f, tip); P.carriage.add(pivot);
        return pivot;
      });
      if (specs.clawPneumatic) {
        const cb = cyl(0.008, 0.06, M.alu, 10); cb.rotation.z = Math.PI / 2; cb.position.set(0, 0.085, 0.04);
        P.clawRod = cyl(0.003, 0.05, M.brass, 8); P.clawRod.rotation.z = Math.PI / 2; P.clawRod.position.set(0.05, 0.085, 0.04);
        P.carriage.add(cb, P.clawRod);
      } else {
        const cm = box(0.057, 0.06, 0.072, M.black); cm.position.set(0, 0.105, 0.05); P.carriage.add(cm);
        const cc = box(0.045, 0.012, 0.05, mat(CARTRIDGES.green.color)); cc.position.set(0, 0.14, 0.05); P.carriage.add(cc);
      }
    }
    if (specs.hasFlipper) {
      const fb = cyl(0.009, 0.09, M.alu, 10); fb.rotation.x = Math.PI / 2; fb.position.set(W - 0.03, 0.12, -L + 0.06);
      P.flipRod = new THREE.Group(); P.flipRod.position.set(W - 0.03, 0.12, -L + 0.02);
      const rod = cyl(0.0035, 0.09, M.brass, 8); rod.rotation.x = Math.PI / 2; rod.position.z = -0.01;
      const pad = box(0.05, 0.05, 0.008, M.red); pad.position.z = -0.055;
      P.flipRod.add(rod, pad);
      g.add(fb, P.flipRod);
    }
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.06, 3), mat(0xffffff, { emissive: 0x666666 }));
    arrow.rotation.x = -Math.PI / 2; arrow.position.set(0, 0.2, -L + 0.08); arrow.scale.y = 1; arrow.visible = !this.importedGeometry;
    arrow.position.y = (cfg.drivetrain.wheel * 0.0254) / 2 + 0.035;
    g.add(arrow);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.robot = g;
    this.root.add(g);
  }

  // ---------- per-frame sync ----------
  syncObjects(force) {
    const seen = new Set();
    for (const o of this.world.objects) {
      seen.add(o.id);
      let m = this.objMeshes.get(o.id);
      if (!m) { m = o.type === 'pin' ? makePin(o) : makeCup(o); this.objMeshes.set(o.id, m); this.root.add(m); }
      m.position.set(o.x, o.z, -o.y);
    }
    if (force || seen.size !== this.objMeshes.size) for (const [id, m] of this.objMeshes) if (!seen.has(id)) { this.root.remove(m); this.objMeshes.delete(id); }
  }
  resetObjects() { for (const m of this.objMeshes.values()) this.root.remove(m); this.objMeshes.clear(); this.syncObjects(true); this.clearTrail(); }

  update(dt, showTrail = true) {
    const w = this.world, r = w.robot, P = this.parts, sp = w.specs;
    this.robot.position.set(r.x, 0, -r.y);
    this.robot.rotation.y = -r.h;
    const lh = w.liftHeight();
    P.carriage.position.set(0, lh, -sp.halfL - 0.03);
    if (P.bars.length) {
      const type = w.cfg.lift.type, end = new THREE.Vector3(0, lh + 0.07, -sp.halfL + 0.01), piv = P.pivot;
      for (const b of P.bars) {
        const { sx, i } = b.userData, off = new THREE.Vector3(sx * 0.1, 0, 0);
        if (type === 'dr4b') {
          const elbow = new THREE.Vector3(0, (piv.y + end.y) / 2 + 0.03, piv.z + 0.14 - Math.min(0.1, lh * 0.1));
          const lower = i < 2, dy = (i % 2) * 0.05;
          barBetween(b, (lower ? piv : elbow).clone().add(off).setY((lower ? piv : elbow).y - dy), (lower ? elbow : end).clone().add(off).setY((lower ? elbow : end).y - dy));
        } else barBetween(b, piv.clone().add(off).setY(piv.y - i * 0.06), end.clone().add(off).setY(end.y - i * 0.06));
      }
    }
    if (P.fingers) {
      const open = sp.clawPneumatic ? (r.pistons.claw ? 0 : 1) : 1 - Math.min(1, r.claw.pos / 60);
      this.clawOpen = THREE.MathUtils.damp(this.clawOpen ?? open, open, 18, dt);
      P.fingers[0].rotation.y = this.clawOpen * 0.45; P.fingers[1].rotation.y = -this.clawOpen * 0.45;
      if (P.clawRod) P.clawRod.position.x = 0.03 + this.clawOpen * 0.03;
    }
    if (P.flipRod) { this.flip = THREE.MathUtils.damp(this.flip ?? 0, r.pistons.flipper ? 1 : 0, 25, dt); P.flipRod.position.z = -sp.halfL + 0.02 - this.flip * 0.05; }
    w.toggles.forEach((t, i) => { this.toggleMeshes[i].rotation.x = (t.angle * Math.PI) / 180; });
    this.syncObjects();
    this.trail.visible = showTrail;
    if (showTrail) {
      const n = this.trailN, p = this.trailPos, last = n ? [p[(n - 1) * 3], p[(n - 1) * 3 + 2]] : null;
      if (n < this.trailMax && (!last || Math.hypot(last[0] - r.x, last[1] + r.y) > 0.01)) {
        p.set([r.x, 0.008, -r.y], n * 3); this.trailN++;
        this.trail.geometry.attributes.position.needsUpdate = true;
        this.trail.geometry.setDrawRange(0, this.trailN);
      }
    }
    // John idles: gentle bob + looks toward the robot
    const j = this.john;
    j.userData.t = (j.userData.t ?? 0) + dt;
    j.userData.head.rotation.y = Math.sin(j.userData.t * 0.6) * 0.25;
    j.userData.arm.rotation.z = -0.3 + (j.userData.wave > 0 ? Math.sin(j.userData.t * 9) * 0.5 - 1.6 : 0);
    if (j.userData.wave > 0) j.userData.wave -= dt;
  }
}

function makePin(o) {
  const g = new THREE.Group();
  o.colors.forEach((c, i) => {
    const half = cyl(PIN.r, PIN.half - 0.003, M[c], 16);
    half.position.y = PIN.half / 2 + i * PIN.half;
    half.castShadow = true;
    g.add(half);
  });
  const collar = cyl(PIN.r + 0.002, 0.006, M.black, 16);
  collar.position.y = PIN.half;
  g.add(collar);
  return g;
}
function makeCup(o) {
  const g = new THREE.Group();
  [0, 1].forEach((i) => {
    const opaque = (i === 1) === !!o.opaqueUp;
    const half = cyl(CUP.r, CUP.half - 0.002, opaque ? M.cupGray : M.cupClear, 24, true);
    half.material = opaque ? M.cupGray : M.cupClear;
    if (opaque) { half.material = M.cupGray.clone(); half.material.side = THREE.DoubleSide; half.castShadow = true; } else half.renderOrder = 3;
    half.position.y = CUP.half / 2 + i * CUP.half;
    g.add(half);
  });
  const band = new THREE.Mesh(new THREE.TorusGeometry(CUP.r, 0.003, 6, 24), M.black);
  band.rotation.x = Math.PI / 2; band.position.y = CUP.half;
  g.add(band);
  return g;
}

// John VEX — the friendly low-poly coach standing by the field.
function buildJohn() {
  const g = new THREE.Group();
  const skin = mat(0xe7b58f), shirt = mat(0xd8362b), pants = mat(0x2a3140), cap = mat(0x1d1f24);
  const torso = box(0.42, 0.55, 0.24, shirt); torso.position.y = 1.12;
  const logo = box(0.16, 0.08, 0.005, M.white); logo.position.set(0, 1.22, 0.123);
  for (const sx of [-1, 1]) {
    const leg = box(0.16, 0.82, 0.18, pants); leg.position.set(sx * 0.11, 0.43, 0); g.add(leg);
    const shoe = box(0.17, 0.07, 0.27, M.black); shoe.position.set(sx * 0.11, 0.035, 0.04); g.add(shoe);
  }
  const head = new THREE.Group(); head.position.y = 1.56;
  const skull = box(0.26, 0.28, 0.25, skin); skull.position.y = 0.05;
  const brim = box(0.27, 0.025, 0.16, cap); brim.position.set(0, 0.17, 0.19);
  const crown = box(0.275, 0.1, 0.265, cap); crown.position.y = 0.215;
  const badge = box(0.08, 0.05, 0.005, shirt); badge.position.set(0, 0.215, 0.135);
  for (const sx of [-1, 1]) { const eye = box(0.035, 0.035, 0.01, M.black); eye.position.set(sx * 0.06, 0.08, 0.126); head.add(eye); const lens = box(0.085, 0.07, 0.008, mat(0x222831, { transparent: true, opacity: 0.35 })); lens.position.set(sx * 0.062, 0.08, 0.132); head.add(lens); }
  const smile = box(0.1, 0.018, 0.01, mat(0x8a3b2e)); smile.position.set(0, -0.02, 0.126);
  head.add(skull, brim, crown, badge, smile);
  const armL = box(0.11, 0.5, 0.13, shirt); armL.position.set(-0.27, 1.12, 0);
  const arm = new THREE.Group(); arm.position.set(0.27, 1.36, 0);
  const armR = box(0.11, 0.5, 0.13, shirt); armR.position.y = -0.24;
  const hand = box(0.1, 0.1, 0.1, skin); hand.position.y = -0.53;
  arm.add(armR, hand);
  const clip = box(0.2, 0.26, 0.02, mat(0x8b5a2b)); clip.position.set(-0.27, 0.92, 0.1); clip.rotation.x = -0.3;
  g.add(torso, logo, head, armL, arm, clip);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData = { head, arm, wave: 2 };
  return g;
}
