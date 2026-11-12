// Robot Build tab: presets, drivetrain, mechanisms, pneumatics workshop, sensors, STL import.
import { h, store } from '../store.js';
import { PRESETS, DRIVETRAINS, CARTRIDGES, LIFTS, CLAWS, CYLINDERS, WHEELS, GEARINGS, SENSORS, deriveSpecs, airModel } from '../sim/robotConfig.js';
import { LIMITS } from '../sim/fieldData.js';
import { mountStlImport } from './stlImport.js';

const ASSEMBLY = [
  ['Plan the circuit', 'Sketch it first: reservoir → shut-off → regulator → solenoid → cylinder. Put it in your notebook before cutting any tubing.'],
  ['Mount the reservoir(s)', 'Strap tanks low and inside the frame so impacts cannot hit the fittings. Keep the fill (Schrader) valve reachable.'],
  ['Cut tubing square', 'Use a tubing cutter or sharp blade, never scissors: a crushed or angled end is the #1 cause of leaks. Cut 10–15 % longer than measured so moving parts do not pull it tight.'],
  ['Push fittings fully home', 'Push each tube in until it stops (about 12 mm), then tug gently. To release, press the collar ring first.'],
  ['Wire the solenoids', 'Each solenoid driver plugs into a Brain 3-Wire port (A–H) and is controlled as a DigitalOut. Label the cable with its port.'],
  ['Set the regulator', 'Lower working pressure = more actuations per fill but less force. Find the lowest pressure that still does the job reliably.'],
  ['Leak test', 'Pump to 100 psi, close everything and time the gauge for 5 minutes. Brush soapy water on fittings: bubbles show the leak.'],
  ['Count your actuations', 'Fire the mechanism until it stops working and count. Compare with the calculator here and record both in your notebook.'],
  ['Safety check', 'Never exceed 100 psi, never modify cylinders or tanks, wear safety glasses, and vent the system before working on it.'],
];

export function mountBuilder(el, ctx) {
  const { app } = ctx;
  let tab = store.get('build:tab', 'Presets');
  const tabs = ['Presets', 'Drivetrain', 'Mechanisms', 'Pneumatics', 'Sensors', 'Import STL'];
  const tabRow = h('div.row');
  const main = h('div.grow.scroll', { style: { padding: '14px', minHeight: 0 } });
  const stlHost = h('div.grow.scroll', { style: { padding: '14px', minHeight: 0, display: 'none' } });
  const sheet = h('div.scroll', { style: { width: '270px', borderLeft: '1px solid var(--border)', padding: '14px' } });
  const nameIn = h('input', { style: { width: '160px' }, oninput: () => { cfg().name = nameIn.value; commit(false); } });
  el.append(h('div.panel-head', h('h2', 'Build'), nameIn, h('span.grow'), tabRow), h('div', { style: { display: 'flex', flex: 1, minHeight: 0 } }, main, stlHost, sheet));
  let stlMounted = false;

  const cfg = () => app.world.cfg;
  function commit(rerender = true) { app.setRobot(cfg()); if (rerender) render(); else renderSheet(); }
  const set = (path, v) => { const ks = path.split('.'); let o = cfg(); while (ks.length > 1) o = o[ks.shift()]; o[ks[0]] = v; commit(); };
  const choice = (title, value, options, onPick, cols = 2) => h('div', { style: { marginBottom: '14px' } }, h('h4', title),
    h('div', { className: 'grid' + cols }, options.map((o) => h('div.card' + (o.id === value ? '.sel' : ''), { style: { cursor: 'pointer' }, onclick: () => onPick(o.id) },
      h('div.row', o.swatch != null ? h('span', { style: { width: '14px', height: '14px', borderRadius: '50%', background: '#' + o.swatch.toString(16).padStart(6, '0') } }) : null, h('b', o.label)),
      o.blurb ? h('div.muted.small', { style: { marginTop: '4px' } }, o.blurb) : null))));
  const carts = Object.entries(CARTRIDGES).map(([id, c]) => ({ id, label: c.label, blurb: c.blurb, swatch: c.color }));

  function render() {
    nameIn.value = cfg().name ?? 'My Robot';
    tabRow.replaceChildren(...tabs.map((t) => h('button.btn.small' + (t === tab ? '.active' : ''), { onclick: () => { tab = t; store.set('build:tab', t); render(); } }, t)));
    const isStl = tab === 'Import STL';
    main.style.display = isStl ? 'none' : ''; stlHost.style.display = isStl ? '' : 'none'; sheet.style.display = isStl ? 'none' : '';
    document.getElementById('dock').classList.toggle('wide', isStl);
    if (isStl) {
      if (!stlMounted) { stlMounted = true; mountStlImport(stlHost, ctx); }
    } else main.replaceChildren(({ Presets: presets, Drivetrain: drivetrain, Mechanisms: mechanisms, Pneumatics: pneumatics, Sensors: sensors })[tab]());
    renderSheet();
  }

  function presets() {
    return h('div', h('p.muted', 'Pick a starting robot, then customise it in the other tabs. Every change updates the simulated robot immediately.'),
      h('div.grid2', PRESETS.map((p) => {
        const sp = deriveSpecs(p);
        return h('div.card' + (p.name === cfg().name ? '.sel' : ''), h('h3', p.name), h('p.muted.small', p.blurb),
          h('div.row.small', h('span.tag', DRIVETRAINS[p.drivetrain.type].label), h('span.tag', CARTRIDGES[p.drivetrain.cartridge].label), p.lift.type !== 'none' ? h('span.tag', LIFTS[p.lift.type].label) : null, p.claw.type !== 'none' ? h('span.tag', CLAWS[p.claw.type].label) : null, p.flipper ? h('span.tag', 'Flipper piston') : null),
          h('div.row.small.muted', { style: { margin: '6px 0' } }, `${sp.vFree.toFixed(2)} m/s · ${sp.watts} W · reach ${Math.round(sp.liftMaxH * 1000)} mm`),
          h('button.btn.primary.small', { onclick: () => { app.view.importedGeometry = null; app.setRobot(structuredClone(p)); render(); app.toast(`${p.name} is on the field.`); } }, 'Use this robot'));
      })));
  }
  function drivetrain() {
    const d = cfg().drivetrain;
    return h('div',
      choice('Drivetrain', d.type, Object.entries(DRIVETRAINS).map(([id, v]) => ({ id, label: v.label, blurb: v.blurb })), (v) => set('drivetrain.type', v)),
      choice('Motor cartridge', d.cartridge, carts, (v) => set('drivetrain.cartridge', v), 3),
      choice('Wheel diameter', d.wheel, WHEELS.map((w) => ({ id: w, label: w + '"', blurb: w === 4 ? 'Fastest per RPM, least torque.' : w === 2.75 ? 'Slowest per RPM, most torque, lowest chassis.' : 'The popular middle ground.' })), (v) => set('drivetrain.wheel', v), 3),
      choice('External gearing (motor : wheel)', d.gearing, GEARINGS.map((g) => ({ id: g.id, label: g.label })), (v) => set('drivetrain.gearing', v), 3));
  }
  function mechanisms() {
    const c = cfg();
    return h('div',
      choice('Lift', c.lift.type, Object.entries(LIFTS).map(([id, v]) => ({ id, label: v.label, blurb: `${v.blurb}${v.maxH ? ` Reach ${Math.round(v.maxH * 1000)} mm, ${v.motors} motor${v.motors > 1 ? 's' : ''}.` : ''}` })), (v) => set('lift.type', v)),
      c.lift.type !== 'none' ? choice('Lift cartridge', c.lift.cartridge, carts, (v) => set('lift.cartridge', v), 3) : null,
      choice('Claw', c.claw.type, Object.entries(CLAWS).map(([id, v]) => ({ id, label: v.label, blurb: v.blurb })), (v) => set('claw.type', v), 3),
      choice('Toggle flipper (pneumatic piston on the front)', c.flipper ? 'yes' : 'no', [{ id: 'no', label: 'None', blurb: 'Flip Toggles by driving into them.' }, { id: 'yes', label: 'Flipper piston', blurb: 'Extend next to a Toggle to flip it without ramming.' }], (v) => set('flipper', v === 'yes')));
  }
  function sensors() {
    const c = cfg();
    return h('div', h('p.muted', 'Sensors appear in the Devices list and in the Sensing blocks. Programs that read a missing sensor get 0 and a warning.'),
      h('div.grid2', Object.entries(SENSORS).map(([id, s]) => h('div.card' + (c.sensors[id] ? '.sel' : ''), { style: { cursor: 'pointer' }, onclick: () => set('sensors.' + id, !c.sensors[id]) },
        h('div.row', h('input', { type: 'checkbox', checked: !!c.sensors[id] }), h('b', s.label)), h('div.muted.small', { style: { marginTop: '4px' } }, s.blurb)))));
  }

  function pneumatics() {
    const c = cfg(), p = c.pneumatics, sp = deriveSpecs(c), air = airModel(c);
    const users = [];
    if (sp.clawPneumatic) users.push({ key: 'claw', label: 'Claw', cyl: 'clawCyl', acting: 'clawActing', port: 'A' });
    if (sp.hasFlipper) users.push({ key: 'flipper', label: 'Toggle flipper', cyl: 'flipperCyl', acting: 'flipperActing', port: 'B' });
    const done = store.get('pneu:steps', {});
    const sel = (value, opts, on) => h('select', { onchange: (e) => on(e.target.value) }, opts.map(([v, l]) => h('option', { value: v, selected: v === value }, l)));
    return h('div',
      h('p.muted', 'Design, size and assemble the air system. The simulator spends real air: every stroke lowers reservoir pressure, and below the minimum the cylinders stop working.'),
      !users.length ? h('div.card', { style: { marginBottom: '12px' } }, h('b', 'No pneumatic mechanisms yet. '), 'Add a pneumatic claw or a Toggle flipper:',
        h('div.row', { style: { marginTop: '8px' } }, h('button.btn', { onclick: () => set('claw.type', 'pneumatic') }, '+ Pneumatic claw'), h('button.btn', { onclick: () => set('flipper', true) }, '+ Flipper piston'))) : null,
      h('div.grid2', { style: { marginBottom: '12px' } },
        h('div.card', h('h4', 'Supply'),
          h('label', 'Reservoirs (max 2)', sel(String(p.tanks), [['1', '1 × 150 mL'], ['2', '2 × 150 mL']], (v) => set('pneumatics.tanks', +v))),
          h('label', { style: { marginTop: '8px' } }, `Regulator — working pressure: ${p.psi} psi`, h('input', { type: 'range', min: 20, max: 100, step: 5, value: p.psi, onchange: (e) => set('pneumatics.psi', +e.target.value) })),
          h('p.small.muted', { style: { marginTop: '8px' } }, `Fill pressure 100 psi (legal maximum). Cylinders stop seating below ${Math.round(air.minPsi)} psi.`)),
        h('div.card', h('h4', 'Actuators'), users.length ? users.map((u) => h('div', { style: { marginBottom: '8px' } }, h('b', u.label), h('span.muted.small', `  · solenoid on 3-Wire ${u.port}`),
          h('div.row', { style: { marginTop: '4px' } },
            sel(p[u.cyl], Object.entries(CYLINDERS).map(([id, cy]) => [id, cy.label]), (v) => set('pneumatics.' + u.cyl, v)),
            sel(p[u.acting], [['single', 'Single-acting (spring return)'], ['double', 'Double-acting']], (v) => set('pneumatics.' + u.acting, v))))) : h('p.muted', 'None'))),
      users.length ? h('div.card', { style: { marginBottom: '12px' } }, h('h4', 'Air budget'),
        h('table', h('tr', ['Actuator', 'Cylinder', 'Force @ ' + p.psi + ' psi', 'Air per cycle', 'psi lost per stroke', 'Strokes per fill'].map((t) => h('th', t))),
          users.map((u) => h('tr', h('td', u.label), h('td', CYLINDERS[p[u.cyl]].label + ', ' + p[u.acting]), h('td', air.force(p[u.cyl]).toFixed(1) + ' N'), h('td', (air.perCycle(p[u.cyl], p[u.acting]) * 1e6).toFixed(1) + ' mL'), h('td', air.drop(p[u.cyl]).toFixed(2)), h('td', h('b', String(air.strokes(p[u.cyl]))))))),
        h('p.small.muted', { style: { marginTop: '8px' } }, 'Single-acting cylinders only spend air on the extend stroke; double-acting spend it both ways. A 1:45 driver period often needs 30+ cycles — check that your budget covers it, then verify on the field (the air gauge is in the HUD).')) : null,
      h('div.card', { style: { marginBottom: '12px' } }, h('h4', 'Circuit schematic'), schematic(p, users)),
      h('div.card', { style: { marginBottom: '12px' } }, h('h4', 'Cut list'), h('table', h('tr', h('th', 'Tube run'), h('th', 'Length (with 15 % slack)')),
        [['Reservoir → shut-off → regulator', 180], ...(p.tanks > 1 ? [['Reservoir 1 ↔ reservoir 2 (tee)', 120]] : []), ...users.flatMap((u) => [[`Regulator → ${u.label} solenoid`, u.key === 'claw' ? 320 : 260], [`${u.label} solenoid → cylinder${p[u.acting] === 'double' ? ' (×2 ports)' : ''}`, (u.key === 'claw' ? 420 : 200) * (p[u.acting] === 'double' ? 2 : 1)]])]
          .map(([n, mm]) => h('tr', h('td', n), h('td', Math.round(mm * 1.15) + ' mm'))))),
      h('div.card', h('h4', 'Assembly & fabrication checklist'), ASSEMBLY.map(([t, d], i) => h('label', { style: { flexDirection: 'row', gap: '8px', alignItems: 'flex-start', margin: '8px 0', color: 'var(--text)', fontSize: '13px' } },
        h('input', { type: 'checkbox', checked: !!done[i], onchange: (e) => { done[i] = e.target.checked; store.set('pneu:steps', done); } }), h('span', h('b', `${i + 1}. ${t}. `), h('span.muted', d)))),
        h('button.btn.small', { onclick: () => ctx.bus.emit('notebook:log', { phase: 'build', title: 'Pneumatic system design', body: `Reservoirs: ${p.tanks}. Working pressure: ${p.psi} psi.\n` + users.map((u) => `- ${u.label}: ${CYLINDERS[p[u.cyl]].label}, ${p[u.acting]}-acting, ~${air.strokes(p[u.cyl])} strokes per fill`).join('\n') }) }, 'Log this design to notebook')));
  }
  function schematic(p, users) {
    const W = 640, rowH = 56, H = Math.max(150, 60 + users.length * rowH);
    const s = [`<svg viewBox="0 0 ${W} ${H}" style="width:${W}px;max-width:none" font-family="system-ui" font-size="11" fill="#e8edf3" stroke="#93a0b1" stroke-width="1.5">`];
    const boxN = (x, y, w, hh, label, sub, fill = '#242c38') => s.push(`<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="5" fill="${fill}"/><text x="${x + w / 2}" y="${y + hh / 2 - (sub ? 2 : -4)}" text-anchor="middle" stroke="none">${label}</text>${sub ? `<text x="${x + w / 2}" y="${y + hh / 2 + 11}" text-anchor="middle" stroke="none" fill="#93a0b1" font-size="10">${sub}</text>` : ''}`);
    const line = (pts) => s.push(`<polyline points="${pts.map((q) => q.join(',')).join(' ')}" fill="none" stroke="#35d0ff" stroke-width="2.5"/>`);
    const y0 = 30;
    for (let i = 0; i < p.tanks; i++) boxN(10, y0 + i * 46, 86, 36, 'Reservoir', '150 mL · 100 psi', '#1b3a6b');
    if (p.tanks > 1) line([[96, y0 + 64], [106, y0 + 64], [106, y0 + 18]]);
    line([[96, y0 + 18], [120, y0 + 18]]); boxN(120, y0, 60, 36, 'Shut-off', 'valve');
    line([[180, y0 + 18], [200, y0 + 18]]); boxN(200, y0, 76, 36, 'Regulator', p.psi + ' psi');
    line([[276, y0 + 18], [300, y0 + 18]]);
    if (!users.length) s.push(`<text x="310" y="${y0 + 22}" stroke="none" fill="#93a0b1">no actuators connected</text>`);
    users.forEach((u, i) => {
      const y = y0 + i * rowH;
      if (i) line([[300, y0 + 18], [300, y + 18]]);
      line([[300, y + 18], [320, y + 18]]);
      boxN(320, y, 110, 36, p[u.acting] === 'double' ? '5/2 solenoid' : '3/2 solenoid', '3-Wire ' + u.port);
      line([[430, y + 12], [470, y + 12]]);
      if (p[u.acting] === 'double') line([[430, y + 26], [470, y + 26]]);
      boxN(470, y, 150, 36, u.label + ' cylinder', CYLINDERS[p[u.cyl]].label + (p[u.acting] === 'double' ? '' : ' · spring return'), '#3a2c4a');
    });
    s.push('</svg>');
    return h('div', { style: { overflowX: 'auto' }, html: s.join('') });
  }

  function renderSheet() {
    const c = cfg(), sp = deriveSpecs(c), air = airModel(c);
    const row = (k, v, bad) => h('tr', h('td.muted', k), h('td', { style: { textAlign: 'right', color: bad ? 'var(--red)' : '' } }, v));
    const bar = (frac, color) => h('div', { style: { height: '6px', background: 'var(--panel2)', borderRadius: '3px', overflow: 'hidden', margin: '2px 0 8px' } }, h('div', { style: { width: Math.min(100, frac * 100) + '%', height: '100%', background: color } }));
    sheet.replaceChildren(...[h('h3', 'Spec sheet'), app.view.importedGeometry ? h('p.small', h('span.tag.green', 'CAD body'), ' Using your imported STL as the robot body.') : null,
      h('div.small.muted', 'Top speed'), h('b', sp.vFree.toFixed(2) + ' m/s'), bar(sp.vFree / 3, 'var(--accent)'),
      h('div.small.muted', 'Acceleration'), h('b', Math.min(sp.accel, 9.8).toFixed(1) + ' m/s²'), bar(sp.accel / 9.8, 'var(--green)'),
      h('div.small.muted', 'Pushing force'), h('b', sp.pushForce.toFixed(0) + ' N'), bar(sp.pushForce / 70, 'var(--yellow)'),
      h('table.small', { style: { marginTop: '6px' } },
        row('Wheel speed', Math.round(sp.wheelRpm) + ' RPM'), row('Mass', sp.mass.toFixed(1) + ' kg'),
        row('Motors', `${sp.motorCount} × 11 W = ${sp.watts} W`, sp.watts > LIMITS.motorWatts), row('Motor budget', `${LIMITS.motorWatts - sp.watts} W spare`, sp.watts > LIMITS.motorWatts),
        row('Lift reach', sp.liftMaxH ? Math.round(sp.liftMaxH * 1000) + ' mm' : '—'), row('Lift travel time', sp.liftMaxH ? (sp.liftDegMax / sp.liftDegPerSec).toFixed(1) + ' s' : '—'),
        row('Start size', '15 × 15 in ✓'), row('Max height', sp.maxHeightIn.toFixed(0) + ' in', sp.maxHeightIn > LIMITS.heightIn),
        sp.usesAir ? row('Air', `${c.pneumatics.tanks} tank @ ${c.pneumatics.psi} psi`) : null,
        sp.clawPneumatic ? row('Claw strokes / fill', String(air.strokes(c.pneumatics.clawCyl))) : null,
        sp.hasFlipper ? row('Flipper strokes / fill', String(air.strokes(c.pneumatics.flipperCyl))) : null),
      sp.warnings.length ? h('div', { style: { marginTop: '10px' } }, sp.warnings.map((w) => h('p.small', { style: { color: 'var(--yellow)' } }, '⚠ ' + w))) : h('p.small', { style: { color: 'var(--green)', marginTop: '10px' } }, '✓ Legal and well balanced.'),
      h('button.btn.small', { style: { marginTop: '8px' }, onclick: () => ctx.bus.emit('notebook:log', { phase: 'build', title: `Robot build: ${c.name}`, body: app.getRobotSummary().text }) }, 'Log build to notebook')].filter(Boolean));
  }
  render();
  return { render };
}
