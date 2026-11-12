// VEXcode-style block palette (built on Blockly) and its Python generator.
import * as Blockly from 'blockly';
import { pythonGenerator, Order } from 'blockly/python';

export { Blockly, pythonGenerator };

const C = { drive: '#2E8EFF', motion: '#4C97FF', air: '#D65CD6', looks: '#9966FF', events: '#FFBF00', control: '#FFAB19', sensing: '#5CB1D6', operators: '#59C059', variables: '#FF8C1A', myblocks: '#FF6680', comment: '#8a8f98' };
const dd = (name, opts) => ({ type: 'field_dropdown', name, options: opts });
const num = (name) => ({ type: 'input_value', name, check: 'Number' });
const val = (name) => ({ type: 'input_value', name });
const DIR = dd('DIR', [['forward', 'FORWARD'], ['reverse', 'REVERSE']]);
const TURN = dd('DIR', [['right', 'RIGHT'], ['left', 'LEFT']]);
const UNIT = dd('UNIT', [['mm', 'MM'], ['inches', 'INCHES']]);
const MOTOR = dd('MOTOR', [['lift_motor', 'lift_motor'], ['claw_motor', 'claw_motor']]);
const MDIR = dd('DIR', [['up / close', 'FORWARD'], ['down / open', 'REVERSE']]);
const PISTON = dd('PISTON', [['flipper', 'flipper'], ['claw_piston', 'claw_piston']]);
const BTN = dd('BTN', ['L1', 'L2', 'R1', 'R2', 'A', 'B', 'X', 'Y', 'Up', 'Down', 'Left', 'Right'].map((b) => [b, b]));

// [type, colour, shape, message, args, generator(block, v) -> code]   shape: s=statement, n=number, b=boolean, v=any value, h=hat
const DEFS = [
  // Drivetrain
  ['vex_drive', C.drive, 's', 'drive %1', [DIR], (b) => `drivetrain.drive(${b.f('DIR')})`],
  ['vex_drive_for', C.drive, 's', 'drive %1 for %2 %3', [DIR, num('N'), UNIT], (b) => `drivetrain.drive_for(${b.f('DIR')}, ${b.v('N')}, ${b.f('UNIT')})`],
  ['vex_turn', C.drive, 's', 'turn %1', [TURN], (b) => `drivetrain.turn(${b.f('DIR')})`],
  ['vex_turn_for', C.drive, 's', 'turn %1 for %2 degrees', [TURN, num('N')], (b) => `drivetrain.turn_for(${b.f('DIR')}, ${b.v('N')}, DEGREES)`],
  ['vex_turn_to', C.drive, 's', 'turn to heading %1 degrees', [num('N')], (b) => `drivetrain.turn_to_heading(${b.v('N')}, DEGREES)`],
  ['vex_strafe_for', C.drive, 's', 'strafe %1 for %2 %3', [TURN, num('N'), UNIT], (b) => `drivetrain.strafe_for(${b.f('DIR')}, ${b.v('N')}, ${b.f('UNIT')})`],
  ['vex_stop', C.drive, 's', 'stop driving', [], () => 'drivetrain.stop()'],
  ['vex_drive_vel', C.drive, 's', 'set drive velocity to %1 %', [num('N')], (b) => `drivetrain.set_drive_velocity(${b.v('N')}, PERCENT)`],
  ['vex_turn_vel', C.drive, 's', 'set turn velocity to %1 %', [num('N')], (b) => `drivetrain.set_turn_velocity(${b.v('N')}, PERCENT)`],
  ['vex_set_heading', C.drive, 's', 'set drive heading to %1 degrees', [num('N')], (b) => `drivetrain.set_heading(${b.v('N')}, DEGREES)`],
  ['vex_arcade', C.drive, 's', 'arcade drive: forward %1 turn %2 %', [num('F'), num('T')], (b) => `drivetrain.arcade(${b.v('F')}, ${b.v('T')})`],
  ['vex_tank', C.drive, 's', 'tank drive: left %1 right %2 %', [num('L'), num('R')], (b) => `drivetrain.tank(${b.v('L')}, ${b.v('R')})`],
  // Motion
  ['vex_spin', C.motion, 's', 'spin %1 %2', [MOTOR, MDIR], (b) => `${b.f('MOTOR')}.spin(${b.f('DIR')})`],
  ['vex_spin_for', C.motion, 's', 'spin %1 %2 for %3 degrees', [MOTOR, MDIR, num('N')], (b) => `${b.f('MOTOR')}.spin_for(${b.f('DIR')}, ${b.v('N')}, DEGREES)`],
  ['vex_spin_to', C.motion, 's', 'spin %1 to position %2 degrees', [MOTOR, num('N')], (b) => `${b.f('MOTOR')}.spin_to_position(${b.v('N')}, DEGREES)`],
  ['vex_motor_stop', C.motion, 's', 'stop %1', [MOTOR], (b) => `${b.f('MOTOR')}.stop()`],
  ['vex_motor_vel', C.motion, 's', 'set %1 velocity to %2 %', [MOTOR, num('N')], (b) => `${b.f('MOTOR')}.set_velocity(${b.v('N')}, PERCENT)`],
  ['vex_lift_to', C.motion, 's', 'raise lift to %1 mm', [num('N')], (b) => `lift.to_height(${b.v('N')})`],
  ['vex_claw', C.motion, 's', '%1 claw', [dd('ACT', [['close', 'close'], ['open', 'open']])], (b) => `claw.${b.f('ACT')}()`],
  // Pneumatics
  ['vex_piston', C.air, 's', 'set %1 to %2', [PISTON, dd('V', [['extend', 'True'], ['retract', 'False']])], (b) => `${b.f('PISTON')}.set(${b.f('V')})`],
  ['vex_piston_val', C.air, 'b', '%1 is extended?', [PISTON], (b) => `${b.f('PISTON')}.value()`],
  ['vex_psi', C.air, 'n', 'air tank pressure in psi', [], () => 'air_tank.pressure()'],
  // Looks
  ['vex_print', C.looks, 's', 'print %1 on Brain', [val('V')], (b) => `brain.screen.print(${b.v('V', "''")})`],
  ['vex_newline', C.looks, 's', 'set cursor to next row on Brain', [], () => 'brain.screen.next_row()'],
  ['vex_clear', C.looks, 's', 'clear all rows on Brain', [], () => 'brain.screen.clear_screen()'],
  // Events
  ['vex_when_started', C.events, 'h', 'when started %1 %2', [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }], 'when_started'],
  ['vex_when_auton', C.events, 'h', 'when autonomous %1 %2', [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }], 'autonomous'],
  ['vex_when_driver', C.events, 'h', 'when driver control %1 %2', [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }], 'driver_control'],
  // Control
  ['vex_wait', C.control, 's', 'wait %1 seconds', [num('N')], (b) => `wait(${b.v('N')}, SECONDS)`],
  ['vex_wait_until', C.control, 's', 'wait until %1', [{ type: 'input_value', name: 'B', check: 'Boolean' }], (b) => `while not (${b.v('B', 'True')}):\n  wait(20, MSEC)`],
  ['vex_forever', C.control, 'c', 'forever %1 %2', [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }], null],
  // Sensing
  ['vex_heading', C.sensing, 'n', 'drive heading in degrees', [], () => 'drivetrain.heading(DEGREES)'],
  ['vex_drive_done', C.sensing, 'b', 'drive is done?', [], () => 'drivetrain.is_done()'],
  ['vex_distance', C.sensing, 'n', 'Distance: object distance in %1', [UNIT], (b) => `distance.object_distance(${b.f('UNIT')})`],
  ['vex_color_is', C.sensing, 'b', 'Optical detects %1 ?', [dd('COL', [['red', 'RED'], ['blue', 'BLUE'], ['yellow', 'YELLOW'], ['gray cup', 'GRAY'], ['clear cup', 'CLEAR']])], (b) => `optical.color() == Color.${b.f('COL')}`, Order.RELATIONAL],
  ['vex_near', C.sensing, 'b', 'Optical found an object?', [], () => 'optical.is_near_object()'],
  ['vex_bumper', C.sensing, 'b', 'Bumper pressing?', [], () => 'bumper.pressing()'],
  ['vex_gps', C.sensing, 'n', 'GPS %1 in mm', [dd('AX', [['x position', 'x_position'], ['y position', 'y_position']])], (b) => `gps.${b.f('AX')}(MM)`],
  ['vex_holding', C.sensing, 'b', 'claw is holding an object?', [], () => 'claw.is_holding()'],
  ['vex_motor_pos', C.sensing, 'n', '%1 position in degrees', [MOTOR], (b) => `${b.f('MOTOR')}.position(DEGREES)`],
  ['vex_lift_height', C.sensing, 'n', 'lift height in mm', [], () => 'lift.height()'],
  ['vex_timer', C.sensing, 'n', 'timer in seconds', [], () => 'brain.timer.time(SECONDS)'],
  ['vex_timer_reset', C.sensing, 's', 'reset timer', [], () => 'brain.timer.clear()'],
  ['vex_axis', C.sensing, 'n', 'Controller axis %1 position', [dd('AX', [['3 (left Y)', '3'], ['4 (left X)', '4'], ['2 (right Y)', '2'], ['1 (right X)', '1']])], (b) => `controller.axis${b.f('AX')}.position()`],
  ['vex_button', C.sensing, 'b', 'Controller %1 pressed?', [BTN], (b) => `controller.button${b.f('BTN')}.pressing()`],
  // Comment
  ['vex_comment', C.comment, 's', 'comment %1', [{ type: 'field_input', name: 'T', text: 'explain this step' }], (b) => `# ${b.f('T')}`],
];

Blockly.defineBlocksWithJsonArray(DEFS.map(([type, colour, shape, message0, args0]) => ({
  type, colour, message0, args0, inputsInline: true,
  ...(shape === 's' || shape === 'c' ? { previousStatement: null, nextStatement: null } : {}),
  ...(shape === 'n' ? { output: 'Number' } : shape === 'b' ? { output: 'Boolean' } : shape === 'v' ? { output: null } : {}),
})));

const globalsLine = (block, g) => {
  const names = block.workspace.getVariableMap().getAllVariables().map((v) => g.getVariableName(v.getId()));
  return names.length ? g.INDENT + 'global ' + names.join(', ') + '\n' : '';
};
for (const [type, , shape, , , gen, order] of DEFS) {
  pythonGenerator.forBlock[type] = (block, g) => {
    const b = {
      f: (n) => block.getFieldValue(n),
      v: (n, dflt = '0') => g.valueToCode(block, n, Order.NONE) || dflt,
    };
    if (shape === 'h') return `def ${gen}():\n${globalsLine(block, g)}${g.statementToCode(block, 'DO') || g.PASS}\n`;
    if (shape === 'c') return `while True:\n${g.statementToCode(block, 'DO') || g.PASS}${g.INDENT}wait(5, MSEC)\n`;
    const code = gen(b);
    return shape === 's' ? code + '\n' : [code, order ?? Order.FUNCTION_CALL];
  };
}

const shadowNum = (n) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
const blk = (type, inputs) => ({ kind: 'block', type, ...(inputs ? { inputs } : {}) });
const N = (name, n) => ({ [name]: shadowNum(n) });
const cat = (name, colour, contents) => ({ kind: 'category', name, colour, contents });

export const TOOLBOX = {
  kind: 'categoryToolbox',
  contents: [
    cat('Drivetrain', C.drive, [
      blk('vex_drive'), blk('vex_drive_for', N('N', 200)), blk('vex_turn'), blk('vex_turn_for', N('N', 90)), blk('vex_turn_to', N('N', 90)),
      blk('vex_strafe_for', N('N', 200)), blk('vex_stop'), blk('vex_drive_vel', N('N', 50)), blk('vex_turn_vel', N('N', 50)), blk('vex_set_heading', N('N', 0)),
      blk('vex_arcade', { ...N('F', 0), ...N('T', 0) }), blk('vex_tank', { ...N('L', 0), ...N('R', 0) }),
    ]),
    cat('Motion', C.motion, [blk('vex_claw'), blk('vex_lift_to', N('N', 150)), blk('vex_spin'), blk('vex_spin_for', N('N', 90)), blk('vex_spin_to', N('N', 300)), blk('vex_motor_stop'), blk('vex_motor_vel', N('N', 50))]),
    cat('Pneumatics', C.air, [blk('vex_piston'), blk('vex_piston_val'), blk('vex_psi')]),
    cat('Looks', C.looks, [blk('vex_print', { V: { shadow: { type: 'text', fields: { TEXT: 'VEXcode' } } } }), blk('vex_newline'), blk('vex_clear')]),
    cat('Events', C.events, [blk('vex_when_started'), blk('vex_when_auton'), blk('vex_when_driver')]),
    cat('Control', C.control, [
      blk('vex_wait', N('N', 1)), blk('controls_repeat_ext', N('TIMES', 10)), blk('vex_forever'), blk('controls_if'),
      { kind: 'block', type: 'controls_if', extraState: { hasElse: true } }, blk('vex_wait_until'), blk('controls_whileUntil'), blk('controls_flow_statements'),
    ]),
    cat('Sensing', C.sensing, [
      blk('vex_timer'), blk('vex_timer_reset'), blk('vex_heading'), blk('vex_drive_done'), blk('vex_distance'), blk('vex_color_is'), blk('vex_near'), blk('vex_bumper'),
      blk('vex_gps'), blk('vex_holding'), blk('vex_lift_height'), blk('vex_motor_pos'), blk('vex_axis'), blk('vex_button'),
    ]),
    cat('Operators', C.operators, [
      blk('math_number'), blk('math_arithmetic', { ...N('A', 1), ...N('B', 1) }), blk('logic_compare', { ...N('A', 0), ...N('B', 0) }), blk('logic_operation'), blk('logic_negate'),
      blk('logic_boolean'), blk('math_random_int', { ...N('FROM', 1), ...N('TO', 10) }), blk('math_single', N('NUM', 9)), blk('math_round', N('NUM', 3.1)), blk('math_modulo', { ...N('DIVIDEND', 64), ...N('DIVISOR', 10) }), blk('text'), blk('text_join'),
    ]),
    { kind: 'category', name: 'Variables', colour: C.variables, custom: 'VARIABLE' },
    { kind: 'category', name: 'My Blocks', colour: C.myblocks, custom: 'PROCEDURE' },
    cat('Comments', C.comment, [blk('vex_comment')]),
  ],
};

export const STARTER = { blocks: { languageVersion: 0, blocks: [{ type: 'vex_when_started', x: 40, y: 40 }] } };

// Workspace -> runnable Python (also what the Code Viewer shows).
export function workspaceToPython(ws) {
  pythonGenerator.INDENT = '    ';
  let code = pythonGenerator.workspaceToCode(ws).replace(/\n{3,}/g, '\n\n').trim();
  const has = (n) => new RegExp(`^def ${n}\\(`, 'm').test(code);
  const tail = [];
  if (has('autonomous') || has('driver_control')) {
    if (!has('autonomous')) code += '\n\ndef autonomous():\n    pass';
    if (!has('driver_control')) code += '\n\ndef driver_control():\n    pass';
    tail.push('competition = Competition(driver_control, autonomous)');
  }
  if (has('when_started')) tail.push('when_started()');
  return (code ? code + '\n\n' : '') + tail.join('\n') + (tail.length ? '\n' : '');
}

// Convenience for starter programs: a linear list of block specs -> workspace JSON.
// spec: ['type', {FIELD: value}, {INPUT: number | spec}, {STATEMENT: [specs]}]
export function chain(specs) {
  const build = ([type, fields, inputs, stmts]) => {
    const b = { type };
    if (fields && Object.keys(fields).length) b.fields = fields;
    const ins = {};
    for (const [k, v] of Object.entries(inputs ?? {})) ins[k] = typeof v === 'number' ? shadowNum(v) : typeof v === 'string' ? { shadow: { type: 'text', fields: { TEXT: v } } } : { block: build(v) };
    for (const [k, list] of Object.entries(stmts ?? {})) ins[k] = { block: link(list) };
    if (Object.keys(ins).length) b.inputs = ins;
    return b;
  };
  const link = (list) => {
    let head = null, prev = null;
    for (const s of list) { const b = build(s); if (prev) prev.next = { block: b }; else head = b; prev = b; }
    return head;
  };
  return link(specs);
}
export const program = (hat, specs) => ({ blocks: { languageVersion: 0, blocks: [{ type: hat, x: 40, y: 40, inputs: specs.length ? { DO: { block: chain(specs) } } : undefined }] } });
