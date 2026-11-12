// Simulation core: robot dynamics, mechanisms, pneumatics, loose-object physics, toggles and
// Override scoring. No rendering in here — runs headless (Node) for tests.
import { FIELD, PIN, CUP, GOAL_R, TOGGLE, POINTS, LAYOUT, MATCH_LOADS, quadrantOf, sideOf } from './fieldData.js';
import { deriveSpecs, airModel, defaultConfig } from './robotConfig.js';

const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const approach = (v, target, maxStep) => v + clamp(target - v, -maxStep, maxStep);
export const wrap180 = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const TOGGLE_COLORS = ['yellow', 'red', 'blue'];

export class World {
  constructor() {
    this.handlers = new Set();
    this.seed = 12345;
    this.controller = { axis1: 0, axis2: 0, axis3: 0, axis4: 0, buttons: {} };
    this.setRobot(defaultConfig());
    this.reset();
  }

  on(fn) { this.handlers.add(fn); return () => this.handlers.delete(fn); }
  emit(type, data = {}) { this.handlers.forEach((fn) => fn(type, data)); }
  rand() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }

  setRobot(cfg) {
    this.cfg = cfg;
    this.specs = deriveSpecs(cfg);
    this.air = airModel(cfg);
    if (this.robot) this.reset(this.lastResetOpts);
  }

  reset(opts = {}) {
    this.lastResetOpts = opts;
    this.cancelAll();
    this.time = 0;
    this.wake = 0;
    this.seed = 12345;
    this.stats = { placed: 0, dropped: 0, toggles: 0, wallHits: 0, distance: 0, airUsed: 0 };
    this.goals = LAYOUT.goals.map((g) => ({ ...g, stack: [] }));
    this.toggles = LAYOUT.toggles.map((t) => ({ ...t, state: 0, touching: false, angle: 0 }));
    const src = opts.objects ?? (opts.empty ? [] : LAYOUT.objects);
    this.objects = src.map((o, i) => ({ id: o.id ?? 'o' + i, ...structuredClone(o), z: 0, vx: 0, vy: 0, state: 'loose', goal: null }));
    this.loads = structuredClone(MATCH_LOADS);
    this.zones = opts.zones ?? [];
    const s = opts.start ?? LAYOUT.start;
    this.robot = {
      x: s.x, y: s.y, h: s.h * D2R, vf: 0, vs: 0, om: 0,
      odo: 0, odoS: 0, headingZero: 0,
      cmd: { vf: 0, vs: 0, om: 0 }, task: null,
      driveVel: 0.5, turnVel: 0.5,
      lift: { pos: 0, spin: 0, target: null, vel: 0.5, waiters: [] },
      claw: { pos: 0, spin: 0, target: null, vel: 0.6, waiters: [] },
      clawClosed: false,
      pistons: { claw: false, flipper: false },
      psi: 100,
      held: null, bumper: false, inMidfield: false, wallContact: false,
    };
    if (this.specs.hasClaw && opts.preload !== false) {
      const p = { id: 'preload', type: 'pin', colors: opts.preloadColors ?? ['yellow', 'red'], x: 0, y: 0, z: 0, vx: 0, vy: 0, state: 'held', goal: null };
      this.objects.push(p);
      this.robot.held = p.id;
      this.robot.clawClosed = true;
      this.robot.claw.pos = 60;
      this.robot.pistons.claw = this.specs.clawPneumatic;
    }
    this.emit('reset');
  }

  // ---------- promises the code runtime waits on ----------
  after(seconds) {
    return new Promise((resolve) => this.waiters.push({ t: this.time + Math.max(0, seconds), resolve }));
  }
  cancelAll() {
    (this.waiters ?? []).forEach((w) => w.resolve());
    this.waiters = [];
    const r = this.robot;
    if (!r) return;
    r.task?.resolve?.();
    r.task = null;
    for (const m of [r.lift, r.claw]) { m.waiters.forEach((f) => f()); m.waiters = []; m.target = null; m.spin = 0; }
    r.cmd = { vf: 0, vs: 0, om: 0 };
  }

  // ---------- geometry helpers ----------
  fwd() { const { h } = this.robot; return [Math.sin(h), Math.cos(h)]; }
  right() { const { h } = this.robot; return [Math.cos(h), -Math.sin(h)]; }
  clawPoint() {
    const r = this.robot, [fx, fy] = this.fwd();
    const d = this.specs.halfL + 0.06;
    return [r.x + fx * d, r.y + fy * d];
  }
  liftHeight() { return (this.robot.lift.pos / this.specs.liftDegMax) * this.specs.liftMaxH; }
  heading() { return ((((this.robot.h / D2R - this.robot.headingZero) % 360) + 360) % 360); }
  corners() {
    const r = this.robot, [fx, fy] = this.fwd(), [rx, ry] = this.right(), { halfL: L, halfW: W } = this.specs;
    return [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => [r.x + fx * L * a + rx * W * b, r.y + fy * L * a + ry * W * b]);
  }
  obj(id) { return this.objects.find((o) => o.id === id); }

  // ---------- drivetrain commands ----------
  setDrive(vf, vs, om) { this.robot.cmd = { vf, vs, om }; }
  startTask(task) {
    const r = this.robot;
    r.task?.resolve?.();
    return new Promise((resolve) => { r.task = { ...task, t0: this.time, resolve }; });
  }
  driveFor(dist, strafe = false) {
    const r = this.robot;
    if (strafe && !this.specs.holonomic) { this.emit('warn', { msg: 'This drivetrain cannot strafe — use an X-drive or mecanum base.' }); return Promise.resolve(); }
    const vmax = Math.max(0.03, r.driveVel * this.specs.vFree * (strafe ? this.specs.strafeFactor : 1));
    const drift = this.cfg.sensors.inertial ? 0 : (this.rand() - 0.5) * 0.06; // rad per metre without a gyro
    return this.startTask({ type: strafe ? 'strafe' : 'drive', start: strafe ? r.odoS : r.odo, dist, vmax, drift, timeout: Math.abs(dist) / vmax * 2 + 2.5 });
  }
  turnFor(deg) {
    const r = this.robot;
    const slip = this.cfg.sensors.inertial ? 0 : -0.07 + this.rand() * 0.1; // encoder-only turns scrub
    const target = r.h + deg * D2R * (1 + slip);
    const ommax = Math.max(0.3, r.turnVel * this.specs.omegaMax);
    return this.startTask({ type: 'turn', target, ommax, timeout: Math.abs(deg * D2R) / ommax * 2 + 2.5 });
  }
  turnTo(hdg) { return this.turnFor(wrap180(hdg - this.heading())); }

  // ---------- mechanisms ----------
  motor(name) { return name === 'claw' ? this.robot.claw : this.robot.lift; }
  motorLimit(name) { return name === 'claw' ? 90 : this.specs.liftDegMax; }
  motorSpeed(name) { return name === 'claw' ? 400 : this.specs.liftDegPerSec; }
  motorSpin(name, dir) { const m = this.motor(name); m.target = null; m.spin = dir; }
  motorTo(name, deg) {
    const m = this.motor(name);
    m.spin = 0;
    m.target = deg;
    return new Promise((resolve) => m.waiters.push(resolve));
  }
  setPiston(name, on) {
    const r = this.robot, p = this.cfg.pneumatics;
    if (r.pistons[name] === on) return true;
    const exists = name === 'claw' ? this.specs.clawPneumatic : this.specs.hasFlipper;
    if (!exists) { this.emit('warn', { msg: `No ${name} piston on this robot.` }); return false; }
    const cyl = name === 'claw' ? p.clawCyl : p.flipperCyl;
    const acting = name === 'claw' ? p.clawActing : p.flipperActing;
    const costs = on || acting === 'double';
    if (costs) {
      if (r.psi < this.air.minPsi) { this.emit('air-low', { psi: r.psi }); return false; }
      const d = this.air.drop(cyl);
      r.psi = Math.max(0, r.psi - d);
      this.stats.airUsed += d;
    }
    r.pistons[name] = on;
    if (name === 'claw') this.setClaw(on);
    if (name === 'flipper' && on) this.flipNearestToggle(0.3);
    return true;
  }
  setClaw(closed) {
    const r = this.robot;
    if (r.clawClosed === closed) return;
    r.clawClosed = closed;
    if (closed) this.tryGrab(); else this.release();
  }
  tryGrab() {
    const r = this.robot;
    if (r.held || !this.specs.hasClaw) return;
    if (this.liftHeight() > 0.06) return;
    const [fx, fy] = this.fwd(), [rx, ry] = this.right();
    let best = null, bd = 1e9;
    for (const o of this.objects) {
      if (o.state !== 'loose') continue;
      const dx = o.x - r.x, dy = o.y - r.y;
      const ahead = dx * fx + dy * fy - this.specs.halfL, side = dx * rx + dy * ry;
      const rad = o.type === 'pin' ? PIN.r : CUP.r;
      if (ahead > -0.02 && ahead < 0.1 + rad && Math.abs(side) < 0.085) {
        const d = Math.abs(side) + ahead;
        if (d < bd) { bd = d; best = o; }
      }
    }
    if (best) { best.state = 'held'; best.vx = best.vy = 0; r.held = best.id; this.emit('grab', { obj: best }); }
  }
  release() {
    const r = this.robot;
    if (!r.held) return;
    const o = this.obj(r.held);
    r.held = null;
    const [cx, cy] = this.clawPoint();
    const lift = this.liftHeight();
    const tol = o.type === 'pin' ? 0.05 : 0.06;
    const goal = this.goals.find((g) => Math.hypot(g.x - cx, g.y - cy) < tol + 0.01);
    if (goal) {
      const level = Math.floor(goal.stack.length / 2);
      const wants = goal.stack.length % 2 === 0 ? 'pin' : 'cup';
      const need = goal.h + level * (PIN.half * 2) + (wants === 'cup' ? PIN.half : 0) - 0.03;
      let reason = null;
      if (o.type !== wants) reason = `This goal needs a ${wants} next (stacks go pin, cup, pin, cup...).`;
      else if (lift < need) reason = `Lift too low: object was at ${(lift * 1000) | 0} mm but needs to clear ${((need + 0.03) * 1000) | 0} mm.`;
      if (!reason) {
        o.state = 'placed'; o.goal = goal.id; o.x = goal.x; o.y = goal.y;
        o.z = o.type === 'pin' ? goal.h - PIN.half + level * PIN.half * 2 : goal.h + level * PIN.half * 2;
        goal.stack.push(o.id);
        this.stats.placed++;
        this.emit('placed', { obj: o, goal, level });
        return;
      }
      this.emit('dropped', { obj: o, reason, goal });
    } else if (lift > 0.05) {
      const near = this.goals.map((g) => Math.hypot(g.x - cx, g.y - cy)).sort((a, b) => a - b)[0];
      this.emit('dropped', { obj: o, reason: near < 0.2 ? `Missed the goal by ${(near * 1000) | 0} mm — line up closer before releasing.` : null });
    }
    this.stats.dropped++;
    o.state = 'loose'; o.x = cx; o.y = cy; o.z = 0; o.vx = o.vy = 0;
    for (const g of this.goals) { // never leave an object inside a goal post
      const d = Math.hypot(o.x - g.x, o.y - g.y), min = GOAL_R + (o.type === 'pin' ? PIN.r : CUP.r);
      if (d < min) { const [fx, fy] = this.fwd(); o.x = g.x - fx * min; o.y = g.y - fy * min; }
    }
  }
  toggleDist(t, px, py) {
    const tx = -t.d[1], ty = t.d[0];
    const s = clamp((px - t.x) * tx + (py - t.y) * ty, -TOGGLE.span / 2, TOGGLE.span / 2);
    return Math.hypot(px - (t.x + tx * s), py - (t.y + ty * s));
  }
  flipNearestToggle(range, dir = 1) {
    const r = this.robot, [fx, fy] = this.fwd();
    const px = r.x + fx * this.specs.halfL, py = r.y + fy * this.specs.halfL;
    const t = this.toggles.find((tg) => this.toggleDist(tg, px, py) < range);
    if (!t) return false;
    t.state = (t.state + dir + 3) % 3;
    this.stats.toggles++;
    this.emit('toggle', { toggle: t, color: TOGGLE_COLORS[t.state] });
    return true;
  }
  matchLoad(kind) {
    const i = this.loads.findIndex((l) => !kind || l.type === kind);
    if (i < 0) { this.emit('warn', { msg: 'No match loads of that type left.' }); return false; }
    const ld = LAYOUT.loaders.find((l) => l.id === (this.robot.y > 0 ? 'red_n' : 'red_s'));
    const x = ld.x + 0.12, y = ld.y - Math.sign(ld.y) * 0.12;
    if (this.objects.some((o) => o.state === 'loose' && Math.hypot(o.x - x, o.y - y) < 0.09)) { this.emit('warn', { msg: 'Loader exit is blocked — collect the last object first.' }); return false; }
    const [l] = this.loads.splice(i, 1);
    this.objects.push({ id: 'ml' + this.objects.length, ...l, x, y, z: 0, vx: 0, vy: 0, state: 'loose', goal: null });
    this.emit('matchload', { left: this.loads.length });
    return true;
  }

  // ---------- sensors ----------
  distanceMM() {
    const r = this.robot, [fx, fy] = this.fwd();
    const ox = r.x + fx * this.specs.halfL, oy = r.y + fy * this.specs.halfL;
    let best = Infinity;
    const H = FIELD.half;
    if (fx > 1e-6) best = Math.min(best, (H - ox) / fx);
    if (fx < -1e-6) best = Math.min(best, (-H - ox) / fx);
    if (fy > 1e-6) best = Math.min(best, (H - oy) / fy);
    if (fy < -1e-6) best = Math.min(best, (-H - oy) / fy);
    const ray = (cx, cy, rad) => {
      const dx = cx - ox, dy = cy - oy, along = dx * fx + dy * fy;
      if (along < 0) return;
      const perp2 = dx * dx + dy * dy - along * along;
      if (perp2 > rad * rad) return;
      best = Math.min(best, along - Math.sqrt(rad * rad - perp2));
    };
    for (const g of this.goals) ray(g.x, g.y, GOAL_R);
    for (const o of this.objects) if (o.state === 'loose') ray(o.x, o.y, o.type === 'pin' ? PIN.r : CUP.r);
    return best > 2 ? 9999 : Math.max(20, Math.round(best * 1000));
  }
  seenObject() {
    const r = this.robot;
    if (r.held) return this.obj(r.held);
    const [fx, fy] = this.fwd(), [rx, ry] = this.right();
    return this.objects.find((o) => {
      if (o.state !== 'loose') return false;
      const dx = o.x - r.x, dy = o.y - r.y, ahead = dx * fx + dy * fy - this.specs.halfL;
      return ahead > -0.02 && ahead < 0.14 && Math.abs(dx * rx + dy * ry) < 0.085;
    }) ?? null;
  }
  seenColor() {
    const o = this.seenObject();
    if (!o) return 'none';
    return o.type === 'pin' ? o.colors[1] : (o.opaqueUp ? 'gray' : 'clear');
  }

  // ---------- main step ----------
  step(dt) {
    const r = this.robot, sp = this.specs;
    this.time += dt;

    // 1. targets from blocking task or continuous command
    let tvf = r.cmd.vf, tvs = sp.holonomic ? r.cmd.vs : 0, tom = r.cmd.om;
    const t = r.task;
    if (t) {
      tvf = tvs = tom = 0;
      let done = false;
      if (t.type === 'drive' || t.type === 'strafe') {
        const rem = t.dist - ((t.type === 'drive' ? r.odo : r.odoS) - t.start);
        const v = Math.sign(rem) * Math.min(t.vmax, Math.sqrt(2 * Math.min(sp.accel, 4) * Math.abs(rem)) * 0.85 + 0.03);
        if (t.type === 'drive') { tvf = v; tom = t.drift * v; } else tvs = v;
        done = Math.abs(rem) < 0.004;
      } else if (t.type === 'turn') {
        const err = t.target - r.h;
        tom = clamp(err * 7, -t.ommax, t.ommax);
        if (Math.abs(tom) < 0.25 && Math.abs(err) > 0.002) tom = Math.sign(err) * 0.25;
        done = Math.abs(err) < 0.003;
      }
      if (!done && this.time - t.t0 > t.timeout) { done = true; this.emit('warn', { msg: 'A drive command timed out — is the robot stuck against something?' }); }
      if (done) {
        if (t.type === 'turn') r.om = 0; else { r.vf = 0; r.vs = 0; }
        r.task = null;
        tvf = tvs = tom = 0;
        this.wake++;
        t.resolve();
      }
    }

    // 2. accelerate (torque falls off with speed) and integrate
    const speedFrac = Math.min(1, Math.abs(r.vf) / Math.max(sp.vFree, 0.01));
    const aUp = Math.min(sp.accel, 7) * (1 - 0.8 * speedFrac), aDown = Math.max(Math.min(sp.accel, 7), 3.5);
    const stepLin = (v, target) => approach(v, target, (Math.abs(target) > Math.abs(v) && Math.sign(target) === Math.sign(v || target) ? aUp : aDown) * dt);
    r.vf = stepLin(r.vf, clamp(tvf, -sp.vFree, sp.vFree));
    r.vs = stepLin(r.vs, clamp(tvs, -sp.vFree, sp.vFree));
    r.om = approach(r.om, clamp(tom, -sp.omegaMax, sp.omegaMax), Math.max(aDown / (sp.track / 2) * 0.45, 8) * dt);

    const [fx, fy] = this.fwd(), [rx, ry] = this.right();
    const x0 = r.x, y0 = r.y;
    r.x += (fx * r.vf + rx * r.vs) * dt;
    r.y += (fy * r.vf + ry * r.vs) * dt;
    r.h += r.om * dt;

    // 3. robot vs walls and goal posts
    let hitWall = false;
    const H = FIELD.half;
    for (let pass = 0; pass < 2; pass++) {
      for (const [cx, cy] of this.corners()) {
        if (cx > H) { r.x -= cx - H; hitWall = true; } else if (cx < -H) { r.x -= cx + H; hitWall = true; }
        if (cy > H) { r.y -= cy - H; hitWall = true; } else if (cy < -H) { r.y -= cy + H; hitWall = true; }
      }
    }
    let hitGoal = false;
    for (const g of this.goals) {
      const n = this.boxCircle(g.x, g.y, GOAL_R);
      if (n) { r.x -= n[0] * n[2]; r.y -= n[1] * n[2]; hitGoal = true; }
    }
    if (hitWall && !r.wallContact && Math.hypot(r.vf, r.vs) > 0.3) this.stats.wallHits++;
    r.wallContact = hitWall;
    // actual motion feeds the encoders and kills velocity into obstacles
    const mx = r.x - x0, my = r.y - y0;
    const af = (mx * fx + my * fy) / dt, as = (mx * rx + my * ry) / dt;
    if (hitWall || hitGoal) { r.vf = Math.abs(af) < Math.abs(r.vf) ? af : r.vf; r.vs = Math.abs(as) < Math.abs(r.vs) ? as : r.vs; }
    r.odo += af * dt;
    r.odoS += as * dt;
    this.stats.distance += Math.hypot(mx, my);
    // front bumper: something solid just ahead of the front face
    const bx = r.x + fx * (sp.halfL + 0.012), by = r.y + fy * (sp.halfL + 0.012);
    r.bumper = Math.abs(bx) > H || Math.abs(by) > H || this.goals.some((g) => Math.hypot(g.x - bx, g.y - by) < GOAL_R + 0.02);
    r.inMidfield = [[r.x, r.y], ...this.corners()].some(([cx, cy]) => quadrantOf(cx, cy) === 'M');

    // 4. mechanisms
    for (const name of ['lift', 'claw']) {
      const m = this.motor(name), lim = this.motorLimit(name), speed = this.motorSpeed(name) * Math.max(0.05, m.vel);
      if (name === 'lift' && !sp.liftMaxH) { m.pos = 0; m.target = null; m.waiters.splice(0).forEach((f) => f()); continue; }
      const before = m.pos;
      if (m.target != null) {
        const tgt = clamp(m.target, 0, lim);
        m.pos = approach(m.pos, tgt, speed * dt);
        if (Math.abs(m.pos - tgt) < 0.01) { m.target = null; this.wake++; m.waiters.splice(0).forEach((f) => f()); }
      } else if (m.spin) {
        m.pos = clamp(m.pos + m.spin * speed * dt, 0, lim);
      }
      m.rate = (m.pos - before) / dt;
    }
    if (sp.hasClaw && !sp.clawPneumatic) {
      if (r.claw.pos >= 55 && !r.clawClosed) this.setClaw(true);
      else if (r.claw.pos <= 35 && r.clawClosed) this.setClaw(false);
    }
    if (r.held) {
      const o = this.obj(r.held), [cx, cy] = this.clawPoint();
      o.x = cx; o.y = cy; o.z = this.liftHeight();
    }

    // 5. loose objects
    const loose = this.objects.filter((o) => o.state === 'loose');
    const damp = Math.exp(-6 * dt);
    for (const o of loose) {
      const rad = o.type === 'pin' ? PIN.r : CUP.r;
      o.x += o.vx * dt; o.y += o.vy * dt;
      o.vx *= damp; o.vy *= damp;
      const n = this.boxCircle(o.x, o.y, rad);
      if (n) {
        o.x += n[0] * n[2]; o.y += n[1] * n[2];
        // velocity of the robot surface at the contact, along the normal
        const px = o.x - r.x, py = o.y - r.y;
        const svx = fx * r.vf + rx * r.vs + r.om * py, svy = fy * r.vf + ry * r.vs - r.om * px;
        const vn = svx * n[0] + svy * n[1], on = o.vx * n[0] + o.vy * n[1];
        if (vn > on) { o.vx += (vn - on) * n[0]; o.vy += (vn - on) * n[1]; }
      }
      for (const g of this.goals) {
        const dx = o.x - g.x, dy = o.y - g.y, d = Math.hypot(dx, dy), min = rad + GOAL_R;
        if (d < min && d > 1e-6) { o.x = g.x + (dx / d) * min; o.y = g.y + (dy / d) * min; const vn = (o.vx * dx + o.vy * dy) / d; if (vn < 0) { o.vx -= 1.4 * vn * dx / d; o.vy -= 1.4 * vn * dy / d; } }
      }
      const lim = H - rad;
      if (o.x > lim) { o.x = lim; o.vx = -0.3 * Math.abs(o.vx); } else if (o.x < -lim) { o.x = -lim; o.vx = 0.3 * Math.abs(o.vx); }
      if (o.y > lim) { o.y = lim; o.vy = -0.3 * Math.abs(o.vy); } else if (o.y < -lim) { o.y = -lim; o.vy = 0.3 * Math.abs(o.vy); }
    }
    for (let i = 0; i < loose.length; i++) {
      const a = loose[i], ra = a.type === 'pin' ? PIN.r : CUP.r;
      for (let j = i + 1; j < loose.length; j++) {
        const b = loose[j], dx = b.x - a.x;
        if (dx > 0.09 || dx < -0.09) continue;
        const dy = b.y - a.y, min = ra + (b.type === 'pin' ? PIN.r : CUP.r), d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 < 1e-10) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, push = (min - d) / 2;
        a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel < 0) { a.vx += rel * nx * 0.6; a.vy += rel * ny * 0.6; b.vx -= rel * nx * 0.6; b.vy -= rel * ny * 0.6; }
      }
    }

    // 6. toggles: ram to flip, and "touching" (a touched toggle is not set — SC4)
    const fpx = r.x + fx * sp.halfL, fpy = r.y + fy * sp.halfL;
    for (const tg of this.toggles) {
      const pts = [[fpx, fpy], ...this.corners()];
      const touching = pts.some(([px, py]) => this.toggleDist(tg, px, py) < 0.075);
      if (touching && !tg.touching && this.toggleDist(tg, fpx, fpy) < 0.075 && r.vf > 0.25) {
        tg.state = (tg.state + 1) % 3;
        this.stats.toggles++;
        this.emit('toggle', { toggle: tg, color: TOGGLE_COLORS[tg.state] });
      }
      tg.touching = touching;
      tg.angle = approach(tg.angle, tg.state * 120, 600 * dt);
    }

    // 7. timers
    if (this.waiters.length) {
      const due = this.waiters.filter((w) => w.t <= this.time);
      if (due.length) { this.waiters = this.waiters.filter((w) => w.t > this.time); this.wake++; due.forEach((w) => w.resolve()); }
    }
  }

  // Robot box vs circle. Returns [nx, ny, depth] with the normal pointing from robot to circle, or null.
  boxCircle(cx, cy, rad) {
    const r = this.robot, { halfL: L, halfW: W } = this.specs;
    const dx = cx - r.x, dy = cy - r.y;
    if (dx * dx + dy * dy > (L + W + rad) * (L + W + rad)) return null;
    const [fx, fy] = this.fwd(), [rx, ry] = this.right();
    const lf = dx * fx + dy * fy, ls = dx * rx + dy * ry;
    const qf = clamp(lf, -L, L), qs = clamp(ls, -W, W);
    let nf = lf - qf, ns = ls - qs, d = Math.hypot(nf, ns), depth;
    if (d > rad) return null;
    if (d < 1e-9) { // centre inside the box: leave by the nearest face
      const pf = L - Math.abs(lf), ps = W - Math.abs(ls);
      if (pf < ps) { nf = Math.sign(lf) || 1; ns = 0; depth = pf + rad; } else { nf = 0; ns = Math.sign(ls) || 1; depth = ps + rad; }
    } else { nf /= d; ns /= d; depth = rad - d; }
    return [fx * nf + rx * ns, fy * nf + ry * ns, depth];
  }

  // ---------- scoring (Game Manual v2.1, SC2-SC8) ----------
  toggleColor(quad) {
    const t = this.toggles.find((tg) => tg.quad === quad);
    return !t || t.touching ? 'yellow' : TOGGLE_COLORS[t.state];
  }
  score() {
    const out = { red: 0, blue: 0, redHalves: 0, blueHalves: 0, yellowOwned: { red: 0, blue: 0 }, yellowUnowned: 0, hidden: 0, midfield: 0, goals: [] };
    const robotsIn = { red: this.robot.inMidfield ? 1 : 0, blue: 0 };
    const midOwner = robotsIn.red > robotsIn.blue ? 'red' : robotsIn.blue > robotsIn.red ? 'blue' : null;
    for (const g of this.goals) {
      const owner = g.quad === 'M' ? midOwner : (this.toggleColor(g.quad) === 'yellow' ? null : this.toggleColor(g.quad));
      const info = { id: g.id, quad: g.quad, owner, red: 0, blue: 0, redHalvesOwn: 0, halves: [] };
      g.stack.forEach((id, i) => {
        const o = this.obj(id);
        if (o.type !== 'pin') return;
        const below = i > 0 ? this.obj(g.stack[i - 1]) : null, above = this.obj(g.stack[i + 1]);
        const vis = [
          i === 0 ? false : !below.opaqueUp, // bottom half: inside the goal, or inside the cup's upper half
          above ? above.opaqueUp : true, //     top half: inside the lower half of the cup above
        ];
        o.colors.forEach((c, k) => {
          if (!vis[k]) { out.hidden++; info.halves.push({ c, scored: false, why: 'hidden' }); return; }
          if (c === 'yellow') {
            if (owner) { out[owner] += POINTS.yellowHalf; info[owner] += POINTS.yellowHalf; out.yellowOwned[owner]++; if (owner === 'red') info.redHalvesOwn++; info.halves.push({ c, scored: true, for: owner }); }
            else { out.yellowUnowned++; info.halves.push({ c, scored: false, why: 'unowned' }); }
          } else {
            out[c] += POINTS.allianceHalf; info[c] += POINTS.allianceHalf; out[c + 'Halves']++;
            if (c === 'red') info.redHalvesOwn++;
            info.halves.push({ c, scored: true, for: c });
          }
        });
      });
      out.goals.push(info);
    }
    if (robotsIn.red) { out.red += POINTS.midfieldRobot; out.midfield = POINTS.midfieldRobot; }
    // Autonomous Win Point check for red (SC8), excluding Quadrants on the blue side of the Autonomous Line
    const mine = out.goals.filter((g) => g.quad === 'M' || sideOf(...this.goalXY(g.id)) === 'red');
    const halves = mine.reduce((s, g) => s + g.redHalvesOwn, 0), goals2 = mine.filter((g) => g.redHalvesOwn >= 2).length;
    out.awp = { halves, goals: goals2, wall: this.robot.wallContact, ok: halves >= 6 && goals2 >= 2 && !this.robot.wallContact };
    return out;
  }
  goalXY(id) { const g = this.goals.find((q) => q.id === id); return [g.x, g.y]; }
}
