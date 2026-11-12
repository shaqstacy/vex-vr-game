// Robot build presets + the physics numbers derived from a build.
import { IN, LIMITS } from './fieldData.js';

export const CARTRIDGES = {
  red: { label: 'Red 36:1', rpm: 100, torque: 2.1 * 2, color: 0xd8362b, blurb: '100 RPM — most torque. Lifts, slow pushy drives.' },
  green: { label: 'Green 18:1', rpm: 200, torque: 2.1, color: 0x35b36b, blurb: '200 RPM — balanced. The default for most mechanisms.' },
  blue: { label: 'Blue 6:1', rpm: 600, torque: 2.1 / 3, color: 0x2a6fe0, blurb: '600 RPM — fastest, least torque. Geared-down fast drives, flywheels.' },
};

export const DRIVETRAINS = {
  tank2: { label: '2-motor tank', motors: 2, holonomic: false, blurb: 'Simple and light. Leaves 6 motors for mechanisms but pushes weakly.' },
  tank4: { label: '4-motor tank', motors: 4, holonomic: false, blurb: 'The competition standard: strong, fast, simple to program.' },
  xdrive4: { label: '4-motor X-drive', motors: 4, holonomic: true, strafe: 1, blurb: 'Omni wheels at 45°. Strafes in any direction; ~41% faster but less pushing force.' },
  mecanum4: { label: '4-motor mecanum', motors: 4, holonomic: true, strafe: 0.85, blurb: 'Strafes sideways with mecanum wheels. Slightly slower sideways.' },
};

export const LIFTS = {
  none: { label: 'No lift', maxH: 0, motors: 0, blurb: 'Cannot raise objects onto goals.' },
  arm: { label: 'Single arm (2-bar)', maxH: 0.42, motors: 1, blurb: 'Light and quick. Reaches alliance and short goals; claw tilts as it rises.' },
  fourbar: { label: 'Four-bar', maxH: 0.62, motors: 2, blurb: 'Keeps the claw level. Reaches every goal with a short stack.' },
  dr4b: { label: 'Double reverse four-bar', maxH: 1.05, motors: 2, blurb: 'Tallest reach for big stacks. Heavy, slower, raises centre of gravity.' },
};

export const CLAWS = {
  none: { label: 'No claw', motors: 0 },
  motor: { label: 'Motor claw', motors: 1, blurb: 'Driven by a Smart Motor. Variable grip, uses 11 W of the budget.' },
  pneumatic: { label: 'Pneumatic claw', motors: 0, blurb: 'Snaps open/closed with a cylinder. No motor budget, but uses air.' },
};

export const CYLINDERS = {
  s25: { label: '25 mm stroke', stroke: 0.025, bore: 0.010 },
  s50: { label: '50 mm stroke', stroke: 0.05, bore: 0.010 },
  s75: { label: '75 mm stroke', stroke: 0.075, bore: 0.010 },
};

export const WHEELS = [2.75, 3.25, 4];
export const GEARINGS = [
  { id: '1', label: 'Direct 1:1', ratio: 1 },
  { id: '0.6', label: '36:60 (slower, stronger)', ratio: 0.6 },
  { id: '0.75', label: '36:48', ratio: 0.75 },
  { id: '1.33', label: '48:36 (faster)', ratio: 4 / 3 },
  { id: '1.67', label: '60:36 (fastest)', ratio: 5 / 3 },
];

export const SENSORS = {
  inertial: { label: 'Inertial Sensor', blurb: 'Accurate heading — makes turns repeatable.' },
  distance: { label: 'Distance Sensor (front)', blurb: 'Range to whatever is ahead, in mm.' },
  optical: { label: 'Optical Sensor (claw)', blurb: 'Sees the colour of the object in the claw.' },
  bumper: { label: 'Bumper Switch (front)', blurb: 'Pressed when the front touches something.' },
  gps: { label: 'GPS Sensor', blurb: 'Field X/Y position and heading.' },
};

const base = {
  drivetrain: { type: 'tank4', cartridge: 'green', wheel: 4, gearing: '1' },
  lift: { type: 'arm', cartridge: 'red' },
  claw: { type: 'motor' },
  flipper: false,
  pneumatics: { tanks: 1, psi: 60, clawCyl: 's25', flipperCyl: 's50', clawActing: 'single', flipperActing: 'double' },
  sensors: { inertial: true, distance: false, optical: false, bumper: false, gps: false },
  stl: null,
};
const mk = (name, blurb, patch) => {
  const c = structuredClone(base);
  for (const [k, v] of Object.entries(patch)) c[k] = typeof v === 'object' && v && !Array.isArray(v) ? { ...c[k], ...v } : v;
  return { name, blurb, ...c };
};

export const PRESETS = [
  mk('Speedbot', 'Bare 2-motor drive. Perfect for learning to drive and turn.', { drivetrain: { type: 'tank2' }, lift: { type: 'none' }, claw: { type: 'none' }, sensors: { inertial: false } }),
  mk('Clawbot', 'Classic trainer: 2-motor drive, single arm and motor claw.', { drivetrain: { type: 'tank2' } }),
  mk('Stacker', '4-motor drive with a four-bar and motor claw. A solid all-rounder.', { lift: { type: 'fourbar' }, sensors: { distance: true } }),
  mk('Air Stacker', '4-motor drive, four-bar, pneumatic claw and toggle flipper.', { lift: { type: 'fourbar' }, claw: { type: 'pneumatic' }, flipper: true, pneumatics: { tanks: 2 }, sensors: { distance: true, optical: true } }),
  mk('Sky Tower', 'Double reverse four-bar for tall stacks on the Midfield Goal.', { drivetrain: { cartridge: 'green', wheel: 3.25 }, lift: { type: 'dr4b' }, claw: { type: 'pneumatic' }, flipper: true, pneumatics: { tanks: 2 }, sensors: { distance: true, gps: true } }),
  mk('X-Runner', 'Holonomic X-drive: strafe to line up on goals without turning.', { drivetrain: { type: 'xdrive4', wheel: 3.25 }, lift: { type: 'fourbar' }, sensors: { gps: true } }),
  mk('Blue Streak', '600 RPM blue cartridges geared 36:60 on 3.25" wheels. Fast!', { drivetrain: { cartridge: 'blue', wheel: 3.25, gearing: '0.6' }, lift: { type: 'arm' }, claw: { type: 'pneumatic' }, flipper: true }),
];

export const defaultConfig = () => structuredClone(PRESETS[2]);

// Everything the physics needs, derived from the parts chosen.
export function deriveSpecs(cfg) {
  const dt = DRIVETRAINS[cfg.drivetrain.type];
  const cart = CARTRIDGES[cfg.drivetrain.cartridge];
  const ratio = GEARINGS.find((g) => g.id === cfg.drivetrain.gearing)?.ratio ?? 1;
  const wheelR = (cfg.drivetrain.wheel * IN) / 2;
  const lift = LIFTS[cfg.lift.type];
  const claw = CLAWS[cfg.claw.type];
  const usesAir = cfg.claw.type === 'pneumatic' || cfg.flipper;

  const xFactor = cfg.drivetrain.type === 'xdrive4' ? Math.SQRT2 : 1;
  const wheelRpm = cart.rpm * ratio;
  const vFree = (wheelRpm / 60) * 2 * Math.PI * wheelR * xFactor;
  const mass = 3.2 + dt.motors * 0.16 + lift.motors * 0.16 + claw.motors * 0.16 + (lift.maxH ? 0.6 + lift.maxH * 2.2 : 0) + (usesAir ? 0.25 * cfg.pneumatics.tanks + 0.2 : 0);
  const stallForce = (dt.motors * cart.torque) / ratio / wheelR / xFactor;
  const traction = mass * 9.81 * (dt.holonomic ? 0.75 : 1.0);
  const pushForce = Math.min(stallForce, traction);
  const track = 0.3;
  const motorCount = dt.motors + lift.motors + claw.motors;
  const watts = motorCount * 11;
  const liftCart = CARTRIDGES[cfg.lift.cartridge];
  // lift is geared 1:7 from the motor; heavier/taller lifts on fast cartridges stall
  const liftLoad = lift.maxH ? (0.5 + lift.maxH * 1.4) / (lift.motors * liftCart.torque * 7 * 0.12) : 0;
  const warnings = [];
  if (watts > LIMITS.motorWatts) warnings.push(`Motor budget exceeded: ${watts} W of ${LIMITS.motorWatts} W.`);
  if (vFree > 2.4) warnings.push('Drive is geared very fast — expect slow acceleration and hard-to-control turns.');
  if (stallForce < mass * 9.81 * 0.35) warnings.push('Low drive torque: the robot will accelerate slowly and stall when pushing.');
  if (liftLoad > 1) warnings.push('Lift is under-powered for this cartridge: it will stall before reaching full height.');
  if (lift.maxH > 0.9 && cfg.drivetrain.type === 'tank2') warnings.push('Tall lift on a 2-motor base: tippy and slow to reposition.');
  if (usesAir && cfg.pneumatics.tanks < 1) warnings.push('Pneumatic parts need at least one air reservoir.');
  if (cfg.claw.type === 'none' && lift.maxH > 0) warnings.push('A lift without a claw cannot hold scoring objects.');

  return {
    holonomic: dt.holonomic,
    strafeFactor: dt.strafe ?? 0,
    vFree,
    wheelRpm,
    mass,
    stallForce,
    pushForce,
    accel: pushForce / mass,
    track,
    omegaMax: (2 * vFree) / track / (dt.holonomic ? 1.6 : 1.25),
    halfL: 0.19,
    halfW: 0.19,
    liftMaxH: lift.maxH * Math.min(1, 1 / Math.max(liftLoad, 0.001)),
    liftDegMax: 700,
    liftDegPerSec: liftCart.rpm * 6 * Math.min(1, 1.15 - Math.min(liftLoad, 1) * 0.5),
    liftLoad,
    hasClaw: cfg.claw.type !== 'none',
    clawPneumatic: cfg.claw.type === 'pneumatic',
    hasFlipper: !!cfg.flipper,
    usesAir,
    motorCount,
    watts,
    warnings,
    heightIn: Math.max(12, 9 + (lift.maxH ? 6 : 0)),
    maxHeightIn: 9 + lift.maxH / IN,
  };
}

// Pneumatic air model: each stroke spends (working pressure x cylinder volume) from the reservoir.
export function airModel(cfg) {
  const tankVol = 150e-6 * cfg.pneumatics.tanks; // 150 mL per legal reservoir
  const vol = (id) => Math.PI * (CYLINDERS[id].bore / 2) ** 2 * CYLINDERS[id].stroke;
  const perCycle = (id, acting) => vol(id) * (acting === 'double' ? 2 : 1);
  const psi = cfg.pneumatics.psi;
  const drop = (id) => (psi * vol(id)) / tankVol; // psi lost per stroke
  const minPsi = Math.max(20, psi * 0.5); // below this the cylinder is too weak to seat
  const usable = Math.max(0, 100 - minPsi);
  const strokes = (id) => Math.floor(usable / drop(id));
  const force = (id) => psi * 6894.76 * Math.PI * (CYLINDERS[id].bore / 2) ** 2; // newtons
  return { tankVol, vol, perCycle, drop, minPsi, strokes, force };
}
