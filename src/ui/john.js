// John VEX — the in-game coach. Context-aware hints, starter code, run reviews and a keyword Q&A.
import { h, store } from '../store.js';
import { searchRules } from './rules.js';
import { starStr } from './challenges.js';

const KB = [
  [/hello|hi\b|hey|who are you/, 'I\'m John VEX, your coach. Ask me about coding, building, the Override rules, or press "Hint" when a challenge has you stuck.'],
  [/drive_for|drive for|distance|how far|mm|inch/, 'drivetrain.drive_for(FORWARD, 600, MM) drives a set distance and waits until it is done. Measure from the CENTRE of the robot: it is 380 mm long, so the front bumper is 190 mm ahead of centre and the claw holds objects 250 mm ahead.'],
  [/turn|heading|inertial|gyro|drift|not straight|inaccurate|accura/, 'turn_for turns relative to where you are; turn_to_heading turns to a compass heading (0 = north/up the field, 90 = toward the blue station). Without an Inertial Sensor the robot counts wheel rotations and wheel scrub makes every turn a few degrees off — add one in Build → Sensors and the error disappears.'],
  [/loop|repeat|forever|while/, 'Use "repeat N" when you know the count, "forever" for driver control, and "while <condition>" (or "wait until") when a sensor decides. Always put a short wait(20, MSEC) inside forever loops so the Brain can breathe.'],
  [/variable|my block|function|def /, 'Variables remember numbers (a target height, a counter). My Blocks / def let you name a chunk of steps — e.g. def place(height): — so your autonomous reads like a plan. Judges love seeing that in a notebook, too.'],
  [/distance sensor|object_distance/, 'The Distance Sensor points forward and returns millimetres to the nearest thing (wall, goal, pin). Loop while it is greater than your target, then stop. Approach slowly at the end — a fast robot overshoots.'],
  [/optical|colou?r/, 'The Optical Sensor looks into the claw: optical.color() returns Color.RED / BLUE / YELLOW for a pin\'s top half, or GRAY / CLEAR for a cup\'s top half. Use it to decide which goal an object belongs on.'],
  [/bumper/, 'bumper.pressing() is True while the front of the robot is against a wall or goal. Handy for squaring up: drive until pressed, then you know exactly where you are.'],
  [/gps/, 'gps.x_position(MM) and gps.y_position(MM) give field coordinates with (0,0) at the centre. +x is toward the blue station, +y is north.'],
  [/claw|grab|pick/, 'claw.open() and claw.close() work for both motor and pneumatic claws. To grab, the lift must be down and the object touching the front of the robot. To place, release with the claw directly over a goal and the object above the rim.'],
  [/lift|height|raise|reach|tall/, 'lift.to_height(mm) raises the claw. Goal rims: Alliance 82.5 mm, short neutral 146.5 mm, Midfield 222.7 mm. Each cup+pin layer adds 165 mm. Add ~20 mm of clearance. If the lift will not reach, try a four-bar or DR4B in Build → Mechanisms.'],
  [/toggle|own|yellow/, 'Each wall has a Toggle: yellow → red → blue with each push. It decides who Owns the yellow Pin Halves on goals in that Quadrant — 10 points each. It only counts when no robot is touching it, so flip it and back away. The Midfield Goal\'s yellows go to whoever has more robots in the Midfield at the end.'],
  [/scor|point/, 'Scoring: visible red/blue Pin Half = 5 for that alliance. Visible yellow half = 10 if you Own it. Robot ending in the Midfield = 8. Autonomous Bonus = 12. A half hidden inside a goal or inside the gray half of a cup scores nothing.'],
  [/cup|stack|hidden|visible|nest/, 'Stacks go pin, cup, pin, cup… A cup covers the top half of the pin below and the bottom half of the pin above. Its gray half hides whatever is inside; its clear half does not. So cup orientation decides which halves score.'],
  [/possess|how many|carry/, 'Rule SG6: a robot may possess one Pin and one Cup at a time. This claw carries one object, so you are always legal.'],
  [/pneumatic|piston|air|psi|tank|cylinder|solenoid/, 'Pneumatics are fast and cost no motor budget, but air is finite. Each stroke drops tank pressure; below the minimum the cylinder will not seat. Lower the regulator for more strokes, use single-acting cylinders, or add the second reservoir. Size it in Build → Pneumatics and watch the air gauge in the HUD.'],
  [/cartridge|gear|ratio|rpm|torque|speed|fast|slow/, 'Speed and torque trade off. Red 100 RPM = strongest, Green 200 = balanced, Blue 600 = fastest. Bigger wheels and speed-up gearing go faster but accelerate slower and push weaker. Change one thing, run the same test, and compare the spec sheet with what really happens.'],
  [/x-?drive|mecanum|strafe|holonomic/, 'X-drive and mecanum bases can strafe: drivetrain.strafe_for(RIGHT, 200, MM). Great for lining up on a goal without turning, but they push weaker than a tank drive.'],
  [/notebook|judg|document|excellence/, 'Great notebooks follow the engineering design process over and over: identify the problem, brainstorm 3+ ideas, choose with a decision matrix, build, program, test with data, reflect. Date and sign every page. After each run here, hit "Log to notebook" and then add your own analysis — the WHY is what judges score.'],
  [/awp|win point/, 'Autonomous Win Point (SC8): at least 6 Pin Halves Scored for your alliance, at least 2 Goals each with 2+ of your Scored halves (your side of the Autonomous Line only), and no robot touching the wall when autonomous ends.'],
  [/midfield|endgame|end game/, 'The Midfield is the diamond in the centre. A robot ending even partly inside it is worth 8 points, and the alliance with more robots there owns the Midfield Goal\'s yellow halves. No placing on the Midfield Goal in the last 10 seconds (SG12).'],
  [/auton|competition template|driver control/, 'A competition program has two functions: autonomous() runs for 15 s with no driver, driver_control() runs for 1:45. In blocks use "when autonomous" and "when driver control". In Python finish with competition = Competition(driver_control, autonomous).'],
  [/nameerror|not defined/, 'NameError means Python does not know that name. Check spelling and capitals: drivetrain, FORWARD, MM, lift, claw. Device names are listed under Devices in the code tab.'],
  [/indent|syntax|unexpected|colon/, 'Syntax and indentation errors: every def, if, while and for line ends with a colon, and the lines inside it are indented by 4 spaces. The error message names the line — the mistake is usually on that line or the one above.'],
  [/stuck|timed out|timeout|not moving|won.?t move/, 'If a drive command times out, the robot was blocked — by a wall, a goal post, or a pile of objects. Check the blue trail on the floor to see where it really went, then adjust the step before.'],
  [/key|control|gamepad|drive it|how do i drive/, 'Driving: W/S or ↑/↓ forward/back, A/D or ←/→ turn, Q/E strafe (holonomic only), R/F lift up/down, Space toggles the claw, T fires the flipper, M feeds a match load. A USB/Bluetooth gamepad works too, and in VR the thumbsticks drive.'],
  [/vr|headset|quest|vive|oculus/, 'Press "Enter VR" (top right) in a WebXR browser — the Meta Quest Browser, or Chrome/Edge with SteamVR for Vive/Index. Left stick drives, right stick turns, triggers work the claw, grips the lift, and the floating panel lets you run programs and pick challenges.'],
  [/stl|cad|import/, 'Build → Import STL loads your CAD export, guesses where the wheels, motors, pistons and lift are, and lets you correct it by clicking the model. "Use this robot" puts your CAD body on the field with the detected drivetrain and mechanisms.'],
];

export function mountJohn(el, ctx) {
  const { app } = ctx;
  const chat = h('div.chat');
  const body = h('div.panel-body', chat);
  const input = h('input.grow', { placeholder: 'Ask John anything…  e.g. "why is my turn inaccurate?"', onkeydown: (e) => { if (e.key === 'Enter') ask(); } });
  const speak = h('input', { type: 'checkbox', checked: store.get('john:speak', false), onchange: () => store.set('john:speak', speak.checked) });
  const quick = h('div.row', { style: { padding: '8px 14px', borderTop: '1px solid var(--border)' } });
  el.append(
    h('div.panel-head', h('h2', 'John VEX'), h('span.tag.red', 'Coach'), h('span.grow'), h('label', { style: { flexDirection: 'row', alignItems: 'center' } }, speak, 'Read aloud')),
    body, quick,
    h('div.row', { style: { padding: '10px 14px', borderTop: '1px solid var(--border)' } }, input, h('button.btn.primary', { onclick: ask }, 'Ask')));
  let hintIdx = {};

  function say(text, opts = {}) {
    const m = h('div.msg.john');
    text.split('\n').forEach((line, i) => { if (i) m.append(h('br')); m.append(line); });
    if (opts.code) m.append(h('pre', opts.code));
    if (opts.actions) m.append(h('div.row', { style: { marginTop: '8px' } }, opts.actions.map(([label, fn]) => h('button.btn.small', { onclick: fn }, label))));
    chat.append(m);
    body.scrollTop = body.scrollHeight;
    app.johnSpeaks?.(text);
    if (speak.checked && window.speechSynthesis && !opts.quiet) {
      try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text.slice(0, 400)); u.rate = 1.05; speechSynthesis.speak(u); } catch { /* speech not available */ }
    }
  }
  function me(text) { chat.append(h('div.msg.me', text)); body.scrollTop = body.scrollHeight; }

  function hint() {
    const ch = app.session?.challenge;
    if (!ch) return say('You are in Free Practice — no target here. Pick a challenge and I\'ll coach you through it, or ask me a question.');
    const i = hintIdx[ch.id] ?? 0;
    say(`Hint ${Math.min(i + 1, ch.hints.length)} of ${ch.hints.length} for "${ch.title}":\n${ch.hints[Math.min(i, ch.hints.length - 1)]}`, i >= ch.hints.length - 1 ? { actions: [['Show starter code', starter]] } : {});
    hintIdx[ch.id] = Math.min(i + 1, ch.hints.length - 1);
  }
  function starter() {
    const ch = app.session?.challenge;
    if (!ch) return say('Starter code belongs to a challenge. Start one from the Challenges tab first.');
    const actions = [['Load as Python', () => { app.loadStarter(ch, 'python'); say('Loaded into the Python editor. Read it line by line before you press Run — it is a start, not the answer.', { quiet: true }); }]];
    if (ch.blocks) actions.unshift(['Load as Blocks', () => { app.loadStarter(ch, 'blocks'); say('Loaded into your Blocks workspace. It will not earn 5 stars as-is: find what is missing.', { quiet: true }); }]);
    say(`Here is a starting point for "${ch.title}". It is deliberately unfinished — your job is to fix and finish it.`, { code: ch.python, actions });
  }
  function explain() {
    const ch = app.session?.challenge;
    if (!ch) return say('Free Practice: full Override field, no clock. Try placing your preload on the red Alliance Goal at x = -1250, y = -420.');
    say(`"${ch.title}" (${ch.tier}).\n${ch.brief}\nYou will practise: ${ch.learn}\nStars at ${ch.stars.join(' / ')}${ch.unit ? ' ' + ch.unit : ' points'}. Time limit ${ch.time} s.`);
  }
  function review(res) {
    if (!res) return say('Run a program or finish a challenge first and I\'ll go through it with you.');
    const w = app.world, tips = [];
    if (res.error) tips.push(`Your program stopped with an error${res.error.line ? ' on line ' + res.error.line : ''}: ${res.error.text}. ${answer(res.error.text.toLowerCase()) ?? ''}`);
    if (res.events.dropped.length) tips.push('Dropped object: ' + (res.events.dropped.at(-1) ?? 'released away from any goal.'));
    if (res.events.timeouts) tips.push('A drive command timed out — the robot was blocked. Look at the trail to see where.');
    if (res.events.airLow) tips.push(`You ran out of air (${Math.round(w.robot.psi)} psi left). Lower the regulator pressure, switch to single-acting, or add a reservoir.`);
    if (w.stats.wallHits > 1) tips.push(`You hit the wall ${w.stats.wallHits} times. Slow down near the perimeter or use the Distance Sensor to stop short.`);
    if (!w.cfg.sensors.inertial && w.stats.distance > 1.5 && res.stars < 5) tips.push('No Inertial Sensor: your turns drift a few degrees each. That adds up over a long routine.');
    const sc = w.score();
    if (sc.yellowUnowned) tips.push(`${sc.yellowUnowned} placed yellow half${sc.yellowUnowned > 1 ? 's are' : ' is'} scoring 0 because nobody Owns that Quadrant. Set its Toggle to red and back off it.`);
    if (sc.hidden > 1) tips.push(`${sc.hidden} Pin Halves are hidden (inside a goal or a cup's gray half) and score nothing. Check which way up your cups are.`);
    if (res.challenge && res.stars < 5 && !tips.length) tips.push(res.stars >= 3 ? 'Solid run. To squeeze out more stars: raise velocity on long moves, remove unnecessary waits, and overlap lift moves with driving (wait=False in Python).' : 'Go one step at a time: run, watch the trail, and change just one number before the next run.');
    const head = res.challenge ? `${res.challenge.title}: ${starStr(res.stars)}  (${Math.round(res.score)}${res.challenge.unit ? ' ' + res.challenge.unit : ''} in ${res.time.toFixed(1)} s)` : `Run finished in ${res.time.toFixed(1)} s — red ${sc.red} pts.`;
    say(head + '\n' + (tips.length ? tips.map((t) => '• ' + t).join('\n') : (res.stars === 5 ? 'Five stars! Log it in your notebook with what you changed to get here, then take on the next challenge.' : 'Nothing went wrong that I can see. Nice and clean.')),
      { actions: [['Log run to notebook', () => app.logRun()], ...(res.challenge && res.stars < 5 ? [['Hint', hint]] : [])] });
  }
  function answer(q) {
    for (const [re, a] of KB) if (re.test(q)) return a;
    return null;
  }
  function ask() {
    const q = input.value.trim();
    if (!q) return;
    input.value = '';
    me(q);
    const lower = q.toLowerCase();
    if (/hint|stuck|help me|what do i do/.test(lower)) return hint();
    if (/starter|example|sample code|show me code/.test(lower)) return starter();
    if (/how did i|review|feedback|what went wrong/.test(lower)) return review(app.lastRun);
    const a = answer(lower);
    let rules = [];
    try { rules = searchRules(q, { limit: 3 }) ?? []; } catch { /* rule search unavailable */ }
    const ruleActions = rules.slice(0, 3).map((r) => [`${r.id}: ${r.title}`.slice(0, 40), () => app.showRule(r.id)]);
    if (a) return say(a, ruleActions.length && /rule|legal|allowed|can i|toggle|scor|possess|midfield|awp/.test(lower) ? { actions: ruleActions } : {});
    if (rules.length) return say(`Here is what the rule book says about that:\n• ${rules[0].id} — ${rules[0].title}: ${rules[0].snippet}`, { actions: ruleActions });
    say('I don\'t have a ready answer for that one. Try asking about: driving, turning, sensors, claw, lift heights, toggles, scoring, cups, pneumatics, gearing, the notebook, AWP — or press Hint for the current challenge.');
  }

  quick.append(...[['💡 Hint', hint], ['📋 Explain task', explain], ['🧩 Starter code', starter], ['🔍 Review my run', () => review(app.lastRun)]].map(([l, f]) => h('button.btn.small', { onclick: f }, l)));
  say('Hi, I\'m John VEX! Start with Challenge 1 in the Challenges tab. I can give hints, starter code, and go through each run with you.', { quiet: true });
  return { say, hint, starter, review, explain, answer };
}
