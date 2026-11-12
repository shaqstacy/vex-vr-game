// Progressive challenge ladder with 5-star scoring.
import { h, store } from '../store.js';
import { program } from '../code/blocks.js';

const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const dist = (w, x, y) => Math.hypot(w.robot.x - x, w.robot.y - y);
const timeBonus = (t, best, worst, pts) => clamp(((worst - t) / (worst - best)) * pts, 0, pts);
const still = (w) => Math.abs(w.robot.vf) < 0.02 && Math.abs(w.robot.om) < 0.05;

// score is 0-100 unless `unit` says otherwise; stars = the five thresholds.
export const CHALLENGES = [
  {
    id: 'drive1', tier: 'Rookie', title: 'First Drive', mode: 'auton', time: 10, needs: [],
    brief: 'Drive forward and stop inside the blue circle, 600 mm ahead.',
    learn: 'Sequencing, drive_for, units.',
    setup: { empty: true, preload: false, start: { x: -1.4, y: 0, h: 90 }, zones: [{ x: -0.8, y: 0, r: 0.12 }] },
    score: (w) => (still(w) ? clamp(100 - dist(w, -0.8, 0) * 400) : 0),
    stars: [30, 55, 75, 90, 97],
    hints: ['The circle is exactly 600 mm from where the centre of your robot starts.', 'Use one "drive forward for ___ mm" block under "when started".', 'drivetrain.drive_for(FORWARD, 600, MM) — then check how close you stopped. 3 mm off still earns 5 stars.'],
    blocks: () => program('vex_when_started', [['vex_drive_for', { DIR: 'FORWARD', UNIT: 'MM' }, { N: 300 }]]),
    python: 'drivetrain.drive_for(FORWARD, 300, MM)\n# Hmm, 300 mm is not far enough. How far is the circle?\n',
  },
  {
    id: 'square', tier: 'Rookie', title: 'Square Dance', mode: 'auton', time: 25, needs: [],
    brief: 'Drive a 600 mm square through all four corners and finish back where you started.',
    learn: 'Turns, repeat loops, why an Inertial Sensor matters.',
    setup: { empty: true, preload: false, start: { x: -0.3, y: -0.3, h: 0 }, zones: [[-0.3, 0.3], [0.3, 0.3], [0.3, -0.3], [-0.3, -0.3]].map(([x, y]) => ({ x, y, r: 0.1 })) },
    track: (w, s) => { s.hit ??= new Set(); [[-0.3, 0.3], [0.3, 0.3], [0.3, -0.3]].forEach(([x, y], i) => { if (dist(w, x, y) < 0.1) s.hit.add(i); }); },
    score: (w, t, s) => (s.hit?.size ?? 0) * 20 + (still(w) && (s.hit?.size ?? 0) === 3 ? clamp(40 - dist(w, -0.3, -0.3) * 300, 0, 40) : 0),
    stars: [20, 40, 70, 88, 96],
    hints: ['A square is the same two moves four times: drive 600 mm, turn right 90°.', 'Put the two blocks inside a "repeat 4" loop instead of copying them.', 'Finishing off-target? A robot without an Inertial Sensor turns by counting wheel rotations and slips. Add one in Build → Sensors.'],
    blocks: () => program('vex_when_started', [['controls_repeat_ext', {}, { TIMES: 2 }, { DO: [['vex_drive_for', { DIR: 'FORWARD', UNIT: 'MM' }, { N: 600 }], ['vex_turn_for', { DIR: 'RIGHT' }, { N: 90 }]] }]]),
    python: 'for i in range(2):\n    drivetrain.drive_for(FORWARD, 600, MM)\n    drivetrain.turn_for(RIGHT, 90, DEGREES)\n# Two sides done... how many does a square have?\n',
  },
  {
    id: 'midfield', tier: 'Rookie', title: 'Race to the Midfield', mode: 'auton', time: 12, needs: [],
    brief: 'Start in the corner and finish with your robot touching the Midfield diamond — as fast as you can, without hitting a wall.',
    learn: 'Path planning, velocity, the 8-point Midfield bonus.',
    setup: { empty: true, preload: false, start: { x: -1.45, y: -1.45, h: 0 } },
    score: (w, t) => (w.robot.inMidfield && still(w) ? 60 + timeBonus(t, 3, 9, 40) - w.stats.wallHits * 15 : 0),
    stars: [40, 60, 72, 84, 94],
    hints: ['The Midfield is at the centre of the field: about 1450 mm east and 1450 mm north of you.', 'One diagonal is shorter than two straight lines: turn right 45°, then drive.', 'Raise the speed with "set drive velocity to 100 %" — a robot ending in the Midfield is worth 8 points in a match.'],
    python: 'drivetrain.turn_for(RIGHT, 45, DEGREES)\ndrivetrain.drive_for(FORWARD, 800, MM)\n# Not there yet — how long is the diagonal?\n',
  },
  {
    id: 'grab', tier: 'Builder', title: 'Fetch', mode: 'auton', time: 15, needs: ['claw'],
    brief: 'Pick up the pin 500 mm in front of you and bring it back inside the starting circle.',
    learn: 'Claw control, driving in reverse.',
    setup: { empty: true, preload: false, start: { x: -1.2, y: 0, h: 90 }, zones: [{ x: -1.2, y: 0, r: 0.14 }], objects: [{ type: 'pin', x: -0.7, y: 0, colors: ['yellow', 'red'] }] },
    score: (w, t) => (w.robot.held ? 50 + (dist(w, -1.2, 0) < 0.14 && still(w) ? 30 + timeBonus(t, 4, 10, 20) : 0) : 0),
    stars: [40, 50, 80, 90, 96],
    hints: ['The claw must be open before you arrive, and the pin has to be right at the front of the robot when it closes.', 'Your robot is 380 mm long, so its front starts 190 mm ahead of its centre. Drive about 290 mm, close the claw, then reverse.', 'claw.open() → drive_for(FORWARD, 290, MM) → claw.close() → drive_for(REVERSE, 290, MM)'],
    blocks: () => program('vex_when_started', [['vex_claw', { ACT: 'open' }], ['vex_drive_for', { DIR: 'FORWARD', UNIT: 'MM' }, { N: 200 }], ['vex_claw', { ACT: 'close' }]]),
    python: 'claw.open()\ndrivetrain.drive_for(FORWARD, 200, MM)\nclaw.close()\n# Did it grab? Then bring it home.\n',
  },
  {
    id: 'score1', tier: 'Builder', title: 'First Score', mode: 'auton', time: 15, needs: ['claw', 'lift'],
    brief: 'You start holding a preload pin. Place it on the red Alliance Goal straight ahead.',
    learn: 'Lift heights, releasing over a goal, how a Pin is "Placed".',
    setup: { empty: true, start: { x: -1.25, y: 0.35, h: 180 } },
    score: (w, t) => (w.score().red >= 5 ? 70 + timeBonus(t, 3, 9, 30) : w.stats.dropped ? 15 : 0),
    stars: [15, 70, 80, 90, 96],
    hints: ['The goal is 82.5 mm tall. The pin must be lifted above the rim before you drive over it.', 'The claw holds the pin 250 mm ahead of the robot centre, and the goal is 770 mm away: drive 520 mm.', 'lift.to_height(100) → drive_for(FORWARD, 520, MM) → claw.open() → back away.'],
    blocks: () => program('vex_when_started', [['vex_lift_to', {}, { N: 40 }], ['vex_drive_for', { DIR: 'FORWARD', UNIT: 'MM' }, { N: 520 }], ['vex_claw', { ACT: 'open' }]]),
    python: 'lift.to_height(40)\ndrivetrain.drive_for(FORWARD, 520, MM)\nclaw.open()\n# The pin fell off! Read what John says about lift height.\n',
  },
  {
    id: 'toggle', tier: 'Builder', title: 'Flip the Toggle', mode: 'auton', time: 12, needs: [],
    brief: 'Set the west wall Toggle to RED, then back away — a Toggle only counts while no robot is touching it.',
    learn: 'Toggles and Ownership (rules SC4 / SC5).',
    setup: { empty: true, preload: false, start: { x: -1.1, y: 0, h: 270 } },
    score: (w, t) => (w.toggleColor('W') === 'red' ? 70 + timeBonus(t, 2.5, 8, 30) : w.toggles.find((g) => g.quad === 'W').state === 1 ? 40 : w.stats.toggles ? 20 : 0),
    stars: [20, 40, 70, 85, 95],
    hints: ['Toggles turn yellow → red → blue each time they are pushed. You need exactly one push.', 'Drive into the Toggle at a good speed to flip it (or extend a flipper piston next to it).', 'After the flip, reverse at least 100 mm. While your robot touches the Toggle it counts as yellow.'],
    blocks: () => program('vex_when_started', [['vex_drive_vel', {}, { N: 60 }], ['vex_drive_for', { DIR: 'FORWARD', UNIT: 'MM' }, { N: 600 }]]),
    python: 'drivetrain.set_drive_velocity(60, PERCENT)\ndrivetrain.drive_for(FORWARD, 600, MM)\n# Flipped... but is it "set"? What does rule SC4 say about touching?\n',
  },
  {
    id: 'stack', tier: 'Engineer', title: 'Pin · Cup · Pin', mode: 'auton', time: 40, needs: ['claw', 'lift'],
    brief: 'Build a stack on the red Alliance Goal: your preload pin, then the cup, then the second pin.',
    learn: 'Multi-step autonomous, stack heights, which Pin Halves a Cup hides (SC3).',
    setup: { empty: true, start: { x: -1.25, y: 0.35, h: 180 }, objects: [{ type: 'cup', x: -0.75, y: 0, opaqueUp: true }, { type: 'pin', x: -0.35, y: 0, colors: ['yellow', 'red'] }] },
    score: (w) => clamp(w.stats.placed * 20 + w.score().red * 4),
    stars: [20, 40, 60, 80, 100],
    hints: ['Each layer sits higher: pin on goal ≈ 100 mm, cup ≈ 170 mm, second pin ≈ 250 mm of lift.', 'After placing, reverse 170 mm so you are level with the cup and the second pin (they sit in a line to the east), turn to heading 90, lower the lift, open the claw, drive in and close.', 'The cup starts gray-side-up, so it hides the bottom half of the pin above it. Your red halves stay visible: 10 points.'],
    python: '# Step 1: place the preload (you solved this in "First Score")\nlift.to_height(100)\ndrivetrain.drive_for(FORWARD, 520, MM)\nclaw.open()\ndrivetrain.drive_for(REVERSE, 170, MM)\n\n# Step 2: fetch the cup (now 500 mm east of you; the second pin is 400 mm beyond it)\nlift.to_height(0)\ndrivetrain.turn_to_heading(90, DEGREES)\n# ...your turn!\n',
  },
  {
    id: 'yellow', tier: 'Engineer', title: 'Own the Yellow', mode: 'auton', time: 30, needs: ['claw', 'lift'],
    brief: 'Place your yellow pin on the short neutral goal, then set this Quadrant\'s Toggle to red so its visible yellow half scores for you.',
    learn: 'Yellow Pin Halves are worth 10 — but only if your alliance Owns them.',
    setup: { empty: true, start: { x: -0.95, y: -0.3, h: 0 }, preloadColors: ['yellow', 'yellow'] },
    score: (w, t) => clamp(w.score().red * 7 + (w.score().red >= 10 ? timeBonus(t, 8, 22, 30) : 0) + (w.stats.placed ? 15 : 0), 0, 100),
    stars: [15, 35, 85, 92, 98],
    hints: ['The short neutral goal is 146.5 mm tall — lift to about 170 mm before driving over it.', 'A placed yellow half scores 0 until the Toggle on this Quadrant\'s wall (the west wall) shows your colour.', 'Place the pin, back up, turn to heading 270, ram the Toggle once, then reverse off it.'],
    python: 'lift.to_height(170)\ndrivetrain.drive_for(FORWARD, 470, MM)\nclaw.open()\ndrivetrain.drive_for(REVERSE, 300, MM)\nlift.to_height(0)\n# The pin is placed but scores 0. Who owns yellow in this Quadrant?\n',
  },
  {
    id: 'sensor', tier: 'Engineer', title: 'Sensor Stop', mode: 'auton', time: 15, needs: ['distance'],
    brief: 'Stop with your front exactly 150 mm from the east wall. Your start position changes every run, so distances cannot be hard-coded.',
    learn: 'Feedback loops with the Distance Sensor; overshoot and velocity.',
    setup: () => ({ empty: true, preload: false, start: { x: -1.2 + Math.random() * 0.9, y: 0.68, h: 90 } }),
    score: (w) => (still(w) ? clamp(100 - Math.abs(w.distanceMM() - 150) / 1.5) : 0),
    stars: [30, 55, 75, 88, 96],
    hints: ['Use a loop: keep driving while the Distance Sensor reads more than 150 mm, then stop.', 'Stopping takes time — a fast robot slides past the target. Slow down, or slow down only when close.', 'while distance.object_distance(MM) > 400: drive fast.  Then set velocity to 15% and loop again until 150.'],
    python: 'drivetrain.set_drive_velocity(80, PERCENT)\nwhile distance.object_distance(MM) > 150:\n    drivetrain.drive(FORWARD)\n    wait(10, MSEC)\ndrivetrain.stop()\nbrain.screen.print(distance.object_distance(MM))\n# Too far? Think about how long it takes to stop from 80%.\n',
  },
  {
    id: 'auton15', tier: 'Competitor', title: '15-Second Autonomous', mode: 'auton', time: 15, needs: ['claw', 'lift'], unit: 'pts',
    brief: 'Full Override field. Score as many points for red as you can in the 15-second Autonomous Period. Stay on your side of the Autonomous Line!',
    learn: 'Route planning under a time limit.',
    setup: {},
    score: (w) => w.score().red,
    stars: [5, 15, 25, 35, 50],
    hints: ['Bank the easy points first: your preload on the nearest red Alliance Goal is 5.', 'A Toggle flip turns every visible yellow half in that Quadrant into 10 points each.', 'Finish in the Midfield for 8 more — in a real match robot position is not counted for the Autonomous Bonus, but practise the route anyway.'],
    python: '# Starting pose: x=-1400, y=40, facing east (90).\n# Red Alliance Goal: x=-1250, y=-420.  Short neutral goal: x=-950, y=420.\ndef autonomous():\n    lift.to_height(100)\n    # plan your route here\n\ndef driver_control():\n    pass\n\ncompetition = Competition(driver_control, autonomous)\n',
  },
  {
    id: 'awp', tier: 'Competitor', title: 'Autonomous Win Point', mode: 'auton', time: 15, needs: ['claw', 'lift'],
    brief: 'Earn the AWP: at least 6 Pin Halves Scored for red, at least 2 Goals each holding 2+ of your Scored halves, and do not finish touching the wall.',
    learn: 'Reading a rule (SC8) and designing a routine to satisfy every clause.',
    setup: {},
    score: (w) => { const a = w.score().awp; return a.ok ? 100 : clamp(Math.min(a.halves, 6) * 9 + Math.min(a.goals, 2) * 18 + (a.wall ? 0 : 5), 0, 95); },
    stars: [14, 32, 50, 77, 100],
    hints: ['Yellow halves count toward the 6 only if you Own them — set the Toggle.', 'Two goals need two scored halves each. A yellow/red pin on a neutral goal with your Toggle set gives one visible half; add a clear-side cup and a second pin for more.', 'This one needs a fast, reliable robot. Iterate on the build as well as the code, and record every test in your notebook.'],
    python: 'def autonomous():\n    # SC8: >= 6 halves, >= 2 goals with 2+ halves each, not touching the wall.\n    pass\n\ndef driver_control():\n    pass\n\ncompetition = Competition(driver_control, autonomous)\n',
  },
  {
    id: 'driver', tier: 'Competitor', title: 'Driver Skills', mode: 'driver', time: 60, needs: ['claw', 'lift'], unit: 'pts',
    brief: 'One minute of driver control on the full field. Drive with the keyboard, a gamepad or VR controllers and score everything you can.',
    learn: 'Driver practice, cycle time, match-load strategy.',
    setup: {},
    score: (w) => w.score().red,
    stars: [10, 25, 45, 70, 100],
    hints: ['Cycle time is everything: grab → lift while driving → place → lower while leaving.', 'Flip the Toggles in your Quadrants early; every yellow half you place afterwards is worth 10.', 'Press M to feed a Match Load at your loader. End in the Midfield for 8.'],
    python: '# Write your own driver control, or delete this and use the built-in controls.\ndef driver_control():\n    while True:\n        drivetrain.arcade(controller.axis3.position(), controller.axis1.position())\n        if controller.buttonR1.pressing():\n            claw.close()\n        elif controller.buttonR2.pressing():\n            claw.open()\n        if controller.buttonL1.pressing():\n            lift_motor.spin(FORWARD)\n        elif controller.buttonL2.pressing():\n            lift_motor.spin(REVERSE)\n        else:\n            lift_motor.stop()\n        wait(20, MSEC)\n\ndef autonomous():\n    pass\n\ncompetition = Competition(driver_control, autonomous)\n',
  },
  {
    id: 'match', tier: 'Champion', title: 'Full Match', mode: 'match', time: 120, needs: ['claw', 'lift'], unit: 'pts',
    brief: 'A complete Override match: 15 s autonomous, then 1:45 of driver control. Autonomous Bonus, Endgame Midfield and all.',
    learn: 'Putting it all together.',
    setup: {},
    score: (w, t, s) => w.score().red + (s.autoBonus ?? 0),
    stars: [30, 60, 90, 130, 180],
    hints: ['Your autonomous score is locked in at 0:15 for the 12-point Autonomous Bonus.', 'No placing on the Midfield Goal in the last 10 seconds (SG12) — use the Endgame to get into the Midfield.', 'Review the run afterwards: where did the seconds go? Log it in your notebook and pick ONE thing to improve.'],
    python: 'def autonomous():\n    lift.to_height(100)\n\ndef driver_control():\n    while True:\n        drivetrain.arcade(controller.axis3.position(), controller.axis1.position())\n        wait(20, MSEC)\n\ncompetition = Competition(driver_control, autonomous)\n',
  },
];

export const starsFor = (ch, score) => ch.stars.filter((t) => score >= t).length;
export const starStr = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
export const starsEl = (n) => h('span.stars', '★'.repeat(n), h('span.off', '★'.repeat(5 - n)));
const NEED_LABEL = { claw: 'a claw', lift: 'a lift', distance: 'a Distance Sensor', flipper: 'a flipper piston' };
export function missingNeeds(ch, world) {
  const sp = world.specs, c = world.cfg;
  const has = { claw: sp.hasClaw, lift: sp.liftMaxH > 0, distance: c.sensors.distance, flipper: sp.hasFlipper };
  return ch.needs.filter((n) => !has[n]).map((n) => NEED_LABEL[n]);
}

export function mountChallenges(el, ctx) {
  const { app } = ctx;
  const body = h('div.panel-body');
  const unlockAll = h('input', { type: 'checkbox', checked: store.get('unlockAll', false), onchange: () => { store.set('unlockAll', unlockAll.checked); render(); } });
  el.append(h('div.panel-head', h('h2', 'Challenges'), h('span.grow'), h('span.muted.small', { id: 'ch-total' }), h('label', { style: { flexDirection: 'row', alignItems: 'center' } }, unlockAll, 'Teacher: unlock all')), body);

  function render() {
    const prog = store.get('progress', {});
    const total = CHALLENGES.reduce((s, c) => s + (prog[c.id]?.stars ?? 0), 0);
    el.querySelector('#ch-total').textContent = `${total} / ${CHALLENGES.length * 5} ★`;
    body.replaceChildren();
    body.append(h('div.card', { style: { marginBottom: '12px' } },
      h('div.row', h('div.grow', h('h3', 'Free Practice'), h('p.muted', { style: { margin: 0 } }, 'The full Override field with no goal and no clock. Test anything.')),
        h('button.btn', { onclick: () => app.startChallenge(null) }, 'Open field'))));
    let tier = null, unlocked = true;
    CHALLENGES.forEach((ch, i) => {
      if (ch.tier !== tier) { tier = ch.tier; body.append(h('h4', { style: { margin: '14px 0 6px' } }, tier)); }
      const p = prog[ch.id], open = unlocked || unlockAll.checked, miss = missingNeeds(ch, app.world);
      const active = app.session?.challenge?.id === ch.id;
      body.append(h('div.card' + (active ? '.sel' : ''), { style: { marginBottom: '8px', opacity: open ? 1 : 0.5 } },
        h('div.row',
          h('div.grow',
            h('div.row', h('b', `${i + 1}. ${ch.title}`), h('span.tag', ch.mode === 'auton' ? 'Autonomous' : ch.mode === 'driver' ? 'Driver' : 'Match'), h('span.tag', ch.time + ' s'), starsEl(p?.stars ?? 0), p ? h('span.muted.small', `best ${Math.round(p.score)}${ch.unit ? ' ' + ch.unit : ''}`) : null),
            h('p', { style: { margin: '6px 0 2px' } }, ch.brief),
            h('p.muted.small', { style: { margin: 0 } }, 'You will learn: ' + ch.learn + '  ·  Stars at ' + ch.stars.join(' / ') + (ch.unit ? ' ' + ch.unit : '')),
            miss.length ? h('p.small', { style: { color: 'var(--yellow)', margin: '4px 0 0' } }, `Your robot needs ${miss.join(' and ')}. `, h('a', { href: '#', onclick: (e) => { e.preventDefault(); app.openPanel('build'); } }, 'Open Build')) : null),
          open ? h('button.btn.primary', { onclick: () => app.startChallenge(ch) }, active ? 'Restart' : 'Start') : h('span.muted', '🔒 earn a star above'))));
      unlocked = unlocked && (p?.stars ?? 0) >= 1;
    });
  }
  render();
  return { render };
}
