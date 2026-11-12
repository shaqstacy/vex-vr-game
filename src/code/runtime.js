// Runs student Python (typed, or generated from blocks) with Skulpt and bridges the `vex`
// library to the simulated robot. One program at a time.
import { VEX_PY } from './vexlib.js';

const Sk = () => window.Sk;
const SIM_JS = `var $builtinmodule = function (name) {
  var mod = {};
  mod.cmd = new Sk.builtin.func(function () {
    var a = [];
    for (var i = 0; i < arguments.length; i++) a.push(Sk.ffi.remapToJs(arguments[i]));
    var r = Sk.global.__vexBridge(a);
    if (r && typeof r.then === 'function') {
      return Sk.misceval.promiseToSuspension(r.then(function (v) {
        Sk.global.__vexCheck();
        return Sk.ffi.remapToPy(v === undefined ? null : v);
      }));
    }
    return Sk.ffi.remapToPy(r === undefined ? null : r);
  });
  return mod;
};`;
const STOP = { __stopped: true };
const PRELUDE = 'from vex import *\n';
const EPILOGUE = '\nvex_run_competition()\n';

export class Runtime {
  constructor(world, hooks = {}) {
    this.world = world;
    this.hooks = hooks; // out(text, cls), screen(rows), state(running), driverStart() -> Promise
    this.running = false;
    this.killed = false;
    this.phaseExpired = false;
    this.mode = 'auton';
    this.timerZero = 0;
    this.screen = { rows: [''], row: 0 };
    this.warned = new Set();
    this.parks = 0; // bumps whenever the program blocks again (lets the sim loop know it has reacted)
    window.__vexBridge = (a) => { const r = this.bridge(a[0], a.slice(1)); if (r && typeof r.then === 'function') this.parks++; return r; };
    window.__vexCheck = () => { Sk().lastYield = Date.now(); if (this.phaseExpired && !this.killed) throw new (Sk().builtin.SystemExit)('phase over'); };
  }

  out(text, cls) { this.hooks.out?.(text, cls); }
  warnOnce(key, msg) { if (!this.warned.has(key)) { this.warned.add(key); this.out(msg + '\n', 'err'); } }

  async run(code, mode = 'auton') {
    if (this.running) await this.stop();
    const S = Sk();
    this.running = true; this.killed = false; this.phaseExpired = false; this.driverStarted = false; this.mode = mode;
    this.timerZero = this.world.time;
    this.warned.clear();
    this.screen = { rows: [''], row: 0 };
    this.hooks.screen?.(this.screen.rows);
    this.hooks.state?.(true);
    S.builtinFiles.files['src/lib/vex.py'] = VEX_PY;
    S.builtinFiles.files['src/lib/_sim.js'] = SIM_JS;
    S.configure({
      output: (t) => this.out(t),
      read: (f) => { if (S.builtinFiles.files[f] === undefined) throw `File not found: '${f}'`; return S.builtinFiles.files[f]; },
      __future__: S.python3,
      killableWhile: true, killableFor: true,
    });
    const frame = () => new Promise((r) => { let done = false; const go = () => { if (!done) { done = true; r(); } }; requestAnimationFrame(go); setTimeout(go, 40); });
    const handlers = {
      'Sk.yield': (susp) => { this.parks++; return this.killed ? Promise.reject(STOP) : frame().then(() => susp.resume()); },
      'Sk.promise': () => (this.killed ? Promise.reject(STOP) : null),
      '*': () => (this.killed ? Promise.reject(STOP) : null),
    };
    let error = null;
    try {
      // Load the vex library first with no time-slicing (Skulpt cannot resume a module import that
      // was suspended half-way), then switch on yielding for the student's code.
      await S.misceval.asyncToPromise(() => S.importMainWithBody('<vexlib>', false, 'import vex\n', true));
      S.yieldLimit = 6; S.lastYield = Date.now();
      await S.misceval.asyncToPromise(() => S.importMainWithBody('<stdin>', false, PRELUDE + code + EPILOGUE, true), handlers);
    } catch (e) {
      if (e !== STOP && !this.killed) {
        if (e instanceof S.builtin.SystemExit) { /* phase ended with no Competition object */ } else {
          error = this.describe(e);
          this.out(error.text + '\n', 'err');
        }
      }
    }
    this.running = false;
    this.world.cancelAll();
    this.hooks.state?.(false);
    this.hooks.done?.(error);
    return error;
  }

  describe(e) {
    let text;
    try { text = e.toString(); } catch { text = String(e); }
    let line = null;
    text = text.replace(/ on line (\d+)/, (_, n) => { line = Math.max(1, +n - 1); return ` on line ${line}`; });
    if (line == null && e.traceback?.length) line = Math.max(1, e.traceback[e.traceback.length - 1].lineno - 1);
    return { text, line };
  }

  async stop() {
    if (!this.running) return;
    this.killed = true;
    this.driverGate?.();
    this.world.cancelAll();
    for (let i = 0; i < 100 && this.running; i++) await new Promise((r) => setTimeout(r, 10));
  }

  // Called by the match clock when the autonomous period ends: unwinds autonomous() with SystemExit.
  endPhase() {
    if (!this.running) return;
    this.phaseExpired = true;
    this.world.cancelAll();
  }
  // Called by the match clock when driver control begins.
  startDriver() { this.driverStarted = true; this.driverGate?.(); this.driverGate = null; }

  // ---------- the bridge: op + args -> value or Promise ----------
  bridge(op, a) {
    if (this.killed) return undefined;
    if (this.phaseExpired && op !== 'phase_done' && op !== 'mode') throw new (Sk().builtin.SystemExit)('phase over');
    const w = this.world, r = w.robot, sp = w.specs, cfg = w.cfg;
    const pct = (v, units, free) => Math.max(0, Math.min(1, units === 'rpm' ? v / free : v / 100));
    const maybe = (promise, wait) => (wait === false ? undefined : promise);
    const need = (sensor) => { if (cfg.sensors[sensor]) return true; this.warnOnce('s:' + sensor, `No ${sensor} sensor on this robot — add one in the Build tab. Returning 0.`); return false; };
    switch (op) {
      case 'wait': return w.after(a[0]);
      case 'mode': return this.mode;
      case 'phase_done':
        this.phaseExpired = false;
        w.cancelAll();
        if (this.mode !== 'match' || this.driverStarted) return undefined;
        return new Promise((res) => { this.driverGate = res; this.hooks.autonFinished?.(); });
      // drivetrain
      case 'drive': r.task = null; w.setDrive(a[0] * r.driveVel * sp.vFree, 0, 0); return;
      case 'strafe':
        if (!sp.holonomic) { this.warnOnce('strafe', 'This drivetrain cannot strafe — choose an X-drive or mecanum base.'); return; }
        r.task = null; w.setDrive(0, a[0] * r.driveVel * sp.vFree * sp.strafeFactor, 0); return;
      case 'turn': r.task = null; w.setDrive(0, 0, a[0] * r.turnVel * sp.omegaMax); return;
      case 'arcade': r.task = null; w.setDrive((a[0] / 100) * sp.vFree, ((a[2] ?? 0) / 100) * sp.vFree * sp.strafeFactor, (a[1] / 100) * sp.omegaMax); return;
      case 'tank': r.task = null; w.setDrive(((a[0] + a[1]) / 200) * sp.vFree, 0, ((a[0] - a[1]) / 200) * sp.omegaMax); return;
      case 'stop': r.task?.resolve?.(); r.task = null; w.setDrive(0, 0, 0); return;
      case 'drive_for': w.setDrive(0, 0, 0); return maybe(w.driveFor(a[0]), a[1]);
      case 'strafe_for': w.setDrive(0, 0, 0); return maybe(w.driveFor(a[0], true), a[1]);
      case 'turn_for': w.setDrive(0, 0, 0); return maybe(w.turnFor(a[0]), a[1]);
      case 'turn_to':
        if (!cfg.sensors.inertial) this.warnOnce('tth', 'turn_to_heading works best with an Inertial Sensor — without one the heading drifts.');
        w.setDrive(0, 0, 0); return maybe(w.turnTo(a[0]), a[1]);
      case 'set_drive_vel': r.driveVel = pct(a[0], a[1], sp.wheelRpm); return;
      case 'set_turn_vel': r.turnVel = pct(a[0], a[1], sp.wheelRpm); return;
      case 'heading': return round(w.heading(), 2);
      case 'rotation': return round((r.h * 180) / Math.PI - r.headingZero, 2);
      case 'set_heading': r.headingZero = (r.h * 180) / Math.PI - a[0]; return;
      case 'drive_done': return !r.task;
      case 'drive_velocity': return round((r.vf / sp.vFree) * (a[0] === 'rpm' ? sp.wheelRpm : 100), 1);
      // motors
      case 'motor_spin': if (this.motorOk(a[0])) w.motorSpin(a[0], Math.sign(a[1])); return;
      case 'motor_for': if (!this.motorOk(a[0])) return; return maybe(w.motorTo(a[0], w.motor(a[0]).pos + a[1]), a[2]);
      case 'motor_to': if (!this.motorOk(a[0])) return; return maybe(w.motorTo(a[0], a[1]), a[2]);
      case 'lift_to': {
        if (!this.motorOk('lift')) return;
        if (a[0] > sp.liftMaxH + 0.001) this.warnOnce('lifth', `This lift only reaches ${Math.round(sp.liftMaxH * 1000)} mm.`);
        return maybe(w.motorTo('lift', (Math.min(a[0], sp.liftMaxH) / sp.liftMaxH) * sp.liftDegMax), a[1]);
      }
      case 'lift_height': return Math.round(w.liftHeight() * 1000);
      case 'motor_vel': w.motor(a[0]).vel = pct(a[1], a[2], 200); return;
      case 'motor_setpos': return; // encoder re-zero is not modelled; positions are absolute
      case 'motor_pos': return round(w.motor(a[0]).pos, 1);
      case 'motor_rate': return round(((w.motor(a[0]).rate ?? 0) / w.motorSpeed(a[0])) * 100, 1);
      case 'motor_done': return w.motor(a[0]).target == null;
      // claw + pneumatics
      case 'claw':
        if (!sp.hasClaw) { this.warnOnce('claw', 'This robot has no claw — add one in the Build tab.'); return; }
        if (sp.clawPneumatic) { w.setPiston('claw', a[0]); return w.after(0.12); }
        return w.motorTo('claw', a[0] ? 70 : 0);
      case 'holding': return !!r.held;
      case 'piston': { const ok = w.setPiston(a[0], a[1]); return w.after(0.1).then(() => ok); }
      case 'piston_val': return !!r.pistons[a[0]];
      case 'psi': return round(r.psi, 1);
      // brain
      case 'print': this.screen.rows[this.screen.row] = (this.screen.rows[this.screen.row] ?? '') + a[0]; this.hooks.screen?.(this.screen.rows); this.out(a[0] + '\n', 'brain'); return;
      case 'newline': this.screen.row++; if (this.screen.row > 11) { this.screen.rows.shift(); this.screen.row = 11; } this.screen.rows[this.screen.row] ??= ''; return;
      case 'clear': this.screen = { rows: [''], row: 0 }; this.hooks.screen?.(this.screen.rows); return;
      case 'clear_row': this.screen.rows[a[0] != null ? a[0] - 1 : this.screen.row] = ''; this.hooks.screen?.(this.screen.rows); return;
      case 'cursor': this.screen.row = Math.max(0, Math.min(11, (a[0] | 0) - 1)); for (let i = 0; i <= this.screen.row; i++) this.screen.rows[i] ??= ''; this.screen.rows[this.screen.row] = ''; return;
      case 'timer': return round(w.time - this.timerZero, 3);
      case 'timer_clear': this.timerZero = w.time; return;
      // controller
      case 'axis': return Math.round(w.controller['axis' + a[0]] ?? 0);
      case 'button': return !!w.controller.buttons[a[0]];
      // sensors
      case 'sensor': {
        const [s, q] = a;
        if (!need(s)) return q === 'color' ? 'none' : q === 'pressing' || q === 'near' ? false : 0;
        if (s === 'inertial') return q === 'heading' ? round(w.heading(), 2) : round((r.h * 180) / Math.PI - r.headingZero, 2);
        if (s === 'distance') return w.distanceMM();
        if (s === 'bumper') return r.bumper;
        if (s === 'gps') return q === 'x' ? Math.round(r.x * 1000) : q === 'y' ? Math.round(r.y * 1000) : round(((((r.h * 180) / Math.PI) % 360) + 360) % 360, 1);
        if (s === 'optical') {
          const c = w.seenColor();
          if (q === 'near') return c !== 'none';
          if (q === 'hue') return { red: 5, yellow: 55, blue: 220, gray: 0, clear: 0, none: 0 }[c];
          return c;
        }
        return 0;
      }
      default: this.warnOnce('op:' + op, `Unknown robot command: ${op}`);
    }
  }
  motorOk(name) {
    const sp = this.world.specs;
    if (name === 'lift' && !sp.liftMaxH) { this.warnOnce('nolift', 'This robot has no lift — add one in the Build tab.'); return false; }
    if (name === 'claw' && (!sp.hasClaw || sp.clawPneumatic)) { this.warnOnce('noclawm', sp.hasClaw ? 'This claw is pneumatic — use claw.open() / claw.close() or claw_piston.set(True).' : 'This robot has no claw.'); return false; }
    return true;
  }
}
const round = (v, n) => { const k = 10 ** n; return Math.round(v * k) / k; };
