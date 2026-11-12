// VEX V5RC "Override" (2026-27) field description.
//
// Units: metres. Field frame: +x = east (blue alliance station side), +y = north, origin at field centre.
// Heading: degrees clockwise from north (VEX convention); 90 deg faces the blue station.
//
// SOURCE STATUS — read before trusting a number:
//   VERIFIED against Game Manual v2.1 (Appendix A text / Section 2):
//     field inside width, wall height, tape width, pin & cup sizes, toggle span, loader opening,
//     element counts and colour splits, point values, 864.8 mm diagonal tape segment.
//   SECONDARY (VEX Forum post quoting the manual drawings): goal heights.
//   ESTIMATED (manual gives these only in drawings/CAD that could not be read here):
//     goal x/y positions, quadrant boundaries, autonomous-line route, loader x/y, every starting
//     pin/cup position. These live in LAYOUT below so a field scan / STEP file can correct them
//     in one place.
export const IN = 0.0254;

export const FIELD = {
  half: (140.4 * IN) / 2, // inside wall-to-wall 140.4 in (portable perimeter)   [verified]
  wallH: 0.293, //                                                                [verified]
  wallT: 0.0508, //                                                               [verified]
  tile: 0.6096,
  tapeW: 0.0635, //                                                               [verified]
  midR: 0.8648 / Math.SQRT2, // Midfield drawn as a diamond whose taped edge is 864.8 mm [edge verified, shape estimated]
};

export const PIN = { r: 0.02, h: 0.165, half: 0.0825 }; //                        [verified]
export const CUP = { r: 0.04, h: 0.1645, half: 0.08225 }; //                      [verified]
export const GOAL_R = 0.038;
export const TOGGLE = { span: 0.6602, paddle: 0.0516 }; //                        [verified]
export const LOADER = { opening: 0.086, height: 0.5835 }; //                      [verified]

export const POINTS = { autoBonus: 12, allianceHalf: 5, yellowHalf: 10, midfieldRobot: 8 }; // [verified]
export const MATCH = { auto: 15, driver: 105, endgame: 10 }; //                   [verified]
export const LIMITS = { startIn: 18, expandIn: 24, heightIn: 50, motorWatts: 88 }; // [verified]

// Quadrants: four triangles made by the field diagonals, one per wall (each holds one Toggle).
const QUADS = {
  W: { d: [-1, 0], alliance: 'red' },
  S: { d: [0, -1], alliance: 'red' },
  E: { d: [1, 0], alliance: 'blue' },
  N: { d: [0, 1], alliance: 'blue' },
};
const tangent = ([dx, dy]) => [dy, -dx]; // 90 deg clockwise

export function quadrantOf(x, y) {
  if (Math.abs(x) + Math.abs(y) < FIELD.midR) return 'M';
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'E' : 'W';
  return y > 0 ? 'N' : 'S';
}
// Autonomous Line runs along the NW-SE diagonal (y = -x), detouring round the Midfield.
export const sideOf = (x, y) => (x + y < 0 ? 'red' : 'blue');
export const quadAlliance = (q) => QUADS[q]?.alliance ?? null;

function buildLayout() {
  const goals = [{ id: 'mid', kind: 'mid', quad: 'M', x: 0, y: 0, h: 0.2227, color: 'neutral' }];
  const toggles = [];
  const objects = [];
  let n = 0;
  const pin = (x, y, bottom, top) => objects.push({ id: 'p' + n++, type: 'pin', x, y, colors: [bottom, top] });
  const cup = (x, y) => {
    // 24 start gray (opaque) side up, 12 clear side up  [verified counts]
    const idx = objects.filter((o) => o.type === 'cup').length;
    objects.push({ id: 'c' + n++, type: 'cup', x, y, opaqueUp: idx % 3 !== 2 });
  };
  const cross = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  for (const [q, { d, alliance }] of Object.entries(QUADS)) {
    const t = tangent(d);
    const at = (a, b) => [d[0] * a + t[0] * b, d[1] * a + t[1] * b];
    const [ax, ay] = at(1.25, -0.42);
    const [nx, ny] = at(0.95, 0.42);
    goals.push({ id: q + '_alliance', kind: 'alliance', quad: q, x: ax, y: ay, h: 0.0825, color: alliance });
    goals.push({ id: q + '_neutral', kind: 'short', quad: q, x: nx, y: ny, h: 0.1465, color: 'neutral' });
    toggles.push({ id: q, quad: q, x: d[0] * (FIELD.half - 0.035), y: d[1] * (FIELD.half - 0.035), d });
    // alliance/yellow pins in a cross round the alliance goal
    for (const [cx, cy] of cross) pin(ax + cx * 0.22, ay + cy * 0.22, 'yellow', alliance);
    // cups in a cross round the short neutral goal, one more by the wall
    for (const [cx, cy] of cross) cup(nx + cx * 0.22, ny + cy * 0.22);
    const [wx, wy] = at(1.5, 0.9);
    cup(...at(1.5, -0.95));
    pin(wx, wy, 'red', 'blue');
  }
  // 28 objects on the Autonomous Line: 14 yellow pins + 14 cups   [count verified, positions estimated]
  for (const u of [0.42, 0.56, 0.7, 0.84, 0.98, 1.12, 1.26]) {
    for (const s of [1, -1]) {
      const k = 0.045;
      pin(-u * s - k, u * s - k, 'yellow', 'yellow');
      cup(-u * s + k, u * s + k);
    }
  }
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3 + 0.5;
    pin(Math.cos(a) * 0.26, Math.sin(a) * 0.26, 'yellow', 'yellow');
  }
  cup(0.33, 0.33);
  cup(-0.33, -0.33);

  const loaders = [
    { id: 'red_n', alliance: 'red', x: -FIELD.half + 0.06, y: 1.45 },
    { id: 'red_s', alliance: 'red', x: -FIELD.half + 0.06, y: -1.45 },
    { id: 'blue_n', alliance: 'blue', x: FIELD.half - 0.06, y: 1.45 },
    { id: 'blue_s', alliance: 'blue', x: FIELD.half - 0.06, y: -1.45 },
  ];
  return { goals, toggles, objects, loaders, start: { x: -1.4, y: 0.04, h: 90 } };
}

export const LAYOUT = buildLayout();

// Red alliance match loads: 10 cups, 10 red/yellow pins, 1 yellow/yellow pin  [verified counts]
export const MATCH_LOADS = [
  ...Array.from({ length: 10 }, () => ({ type: 'pin', colors: ['yellow', 'red'] })),
  ...Array.from({ length: 10 }, (_, i) => ({ type: 'cup', opaqueUp: i % 2 === 0 })),
  { type: 'pin', colors: ['yellow', 'yellow'] },
];

export const COLORS = { red: 0xd8362b, blue: 0x2a6fe0, yellow: 0xf2c230, neutral: 0x9aa3ad };
