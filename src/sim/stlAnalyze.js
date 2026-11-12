// STL import + geometry analysis for VEX V5 robot CAD exports.
// Pure module: no DOM, no three.js. Runs in the browser and in Node.
//
// Frames
//   raw        the STL's own coordinates and units
//   canonical  metres, Y-up, centred on X/Z, sitting on y = 0, front = +Z
//              canonical = scale * R * raw + offset   (R is a signed permutation)
//
// Main entry points: parseSTL(), analyzeSTL() / analyzeSTLAsync(),
// summarizeFeatures(), transformPositions(), buildSampleRobot().

const IN = 0.0254;
export const UNIT_SCALE = { mm: 0.001, cm: 0.01, m: 1, in: IN };
export const UNIT_NAMES = { mm: 'millimetres', cm: 'centimetres', m: 'metres', in: 'inches' };
export const FEATURE_TYPES = ['wheel', 'motor', 'piston', 'lift', 'claw', 'brain', 'tank', 'other'];

// VEX hardware reference sizes
const WHEELS = [
  { dia: 2.75, r: 1.375 * IN },
  { dia: 3.25, r: 1.625 * IN },
  { dia: 4.0, r: 2.0 * IN },
];
const MOTOR_11W = [0.072, 0.057, 0.033]; // V5 Smart Motor 11 W, sorted
const MOTOR_55W = [0.057, 0.032, 0.025]; // V5 Smart Motor 5.5 W (approx.), sorted
const BRAIN = [0.1016, 0.061, 0.033]; // V5 Brain 4 x 2.4 x 1.3 in
const TANK_R = 0.875 * IN; // air reservoir 1.75 in dia
const PISTON_CLASSES = [
  { stroke: 25, len: 0.075 },
  { stroke: 50, len: 0.1 },
  { stroke: 75, len: 0.125 },
];

// ---------------------------------------------------------------------------
// Small matrix helpers (3x3, row-major flat arrays). Rotations used here are
// always signed permutations (multiples of 90 degrees).
// ---------------------------------------------------------------------------
export const ROT = {
  identity: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  x90: [1, 0, 0, 0, 0, -1, 0, 1, 0],
  y90: [0, 0, 1, 0, 1, 0, -1, 0, 0],
  z90: [0, -1, 0, 1, 0, 0, 0, 0, 1],
  y180: [-1, 0, 0, 0, 1, 0, 0, 0, -1],
};
// raw axis that points up -> rotation taking it to canonical +Y
const UP_ROT = {
  '+y': [1, 0, 0, 0, 1, 0, 0, 0, 1],
  '-y': [1, 0, 0, 0, -1, 0, 0, 0, -1],
  '+z': [1, 0, 0, 0, 0, 1, 0, -1, 0],
  '-z': [1, 0, 0, 0, 0, -1, 0, 1, 0],
  '+x': [0, -1, 0, 1, 0, 0, 0, 0, 1],
  '-x': [0, 1, 0, -1, 0, 0, 0, 0, 1],
};
const UP_KEYS = ['+z', '+y', '-z', '-y', '+x', '-x'];

export function matMul3(a, b) {
  const o = new Array(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
    }
  }
  return o;
}
export function rotationForUp(up) {
  const m = UP_ROT[String(up).toLowerCase()];
  if (!m) throw new Error('Unknown up axis: ' + up);
  return m.slice();
}
function upOfRotation(R) {
  // which raw axis maps to canonical +Y (row 1 of R)
  for (let c = 0; c < 3; c++) {
    const v = R[3 + c];
    if (v > 0.5) return '+' + 'xyz'[c];
    if (v < -0.5) return '-' + 'xyz'[c];
  }
  return '+y';
}
function permOf(R) {
  const perm = [0, 0, 0];
  const sgn = [1, 1, 1];
  const used = [false, false, false];
  for (let r = 0; r < 3; r++) {
    let found = -1;
    for (let c = 0; c < 3; c++) {
      const v = R[r * 3 + c];
      if (Math.abs(Math.abs(v) - 1) < 1e-6) {
        if (found >= 0) found = -2;
        else found = c;
      } else if (Math.abs(v) > 1e-6) found = -2;
      if (found === -2) break;
    }
    if (found < 0 || used[found]) throw new Error('rotation must be a signed permutation (multiples of 90 degrees)');
    used[found] = true;
    perm[r] = found;
    sgn[r] = R[r * 3 + found] > 0 ? 1 : -1;
  }
  return { perm, sgn };
}
const rotVec = (P, v) => [P.sgn[0] * v[P.perm[0]], P.sgn[1] * v[P.perm[1]], P.sgn[2] * v[P.perm[2]]];
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const round = (v, d = 4) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};
const r3 = (v) => [round(v[0]), round(v[1]), round(v[2])];
const fmtIn = (m) => (m / IN).toFixed(2);

// ---------------------------------------------------------------------------
// STL parsing
// ---------------------------------------------------------------------------
function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  if (typeof input === 'string') {
    const b = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) b[i] = input.charCodeAt(i) & 255;
    return b;
  }
  throw new Error('parseSTL expects an ArrayBuffer');
}

function dropBadTriangles(arr, n) {
  // n = number of floats filled; removes triangles with non-finite coordinates
  let w = 0;
  for (let i = 0; i + 9 <= n; i += 9) {
    let ok = true;
    for (let k = 0; k < 9; k++) {
      const v = arr[i + k];
      if (!(v === v) || v === Infinity || v === -Infinity) { ok = false; break; }
    }
    if (!ok) continue;
    if (w !== i) for (let k = 0; k < 9; k++) arr[w + k] = arr[i + k];
    w += 9;
  }
  return w === arr.length ? arr : arr.slice(0, w);
}

function readBinarySTL(bytes, n) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Float32Array(n * 9);
  let o = 84 + 12;
  let w = 0;
  for (let i = 0; i < n; i++, o += 50) {
    out[w++] = dv.getFloat32(o, true);
    out[w++] = dv.getFloat32(o + 4, true);
    out[w++] = dv.getFloat32(o + 8, true);
    out[w++] = dv.getFloat32(o + 12, true);
    out[w++] = dv.getFloat32(o + 16, true);
    out[w++] = dv.getFloat32(o + 20, true);
    out[w++] = dv.getFloat32(o + 24, true);
    out[w++] = dv.getFloat32(o + 28, true);
    out[w++] = dv.getFloat32(o + 32, true);
  }
  return dropBadTriangles(out, w);
}

const isWs = (c) => c === 32 || c === 10 || c === 13 || c === 9 || c === 0;

function parseAsciiSTL(b, upper) {
  const len = b.length;
  const V = upper ? 86 : 118;
  const word = upper ? [69, 82, 84, 69, 88] : [101, 114, 116, 101, 120]; // "ertex"
  let cap = 9 * 4096;
  let out = new Float32Array(cap);
  let n = 0;
  let i = 0;
  while (i < len) {
    i = b.indexOf(V, i);
    if (i < 0) break;
    if (
      b[i + 1] === word[0] && b[i + 2] === word[1] && b[i + 3] === word[2] && b[i + 4] === word[3] &&
      b[i + 5] === word[4] && isWs(b[i + 6]) && (i === 0 || isWs(b[i - 1]))
    ) {
      i += 6;
      if (n + 3 > cap) {
        cap *= 2;
        const bigger = new Float32Array(cap);
        bigger.set(out);
        out = bigger;
      }
      for (let k = 0; k < 3; k++) {
        while (i < len && isWs(b[i])) i++;
        const start = i;
        while (i < len && !isWs(b[i])) i++;
        out[n++] = i > start ? parseFloat(String.fromCharCode.apply(null, b.subarray(start, Math.min(i, start + 40)))) : NaN;
      }
    } else {
      i++;
    }
  }
  n -= n % 9;
  return dropBadTriangles(out.subarray(0, n), n).slice();
}

function startsWithSolid(b) {
  let i = 0;
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) i = 3; // UTF-8 BOM
  while (i < b.length && i < 256 && isWs(b[i])) i++;
  const s = String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3], b[i + 4]).toLowerCase();
  return s === 'solid';
}

/**
 * Parse a binary or ASCII STL.
 * @param {ArrayBuffer|Uint8Array} input
 * @returns {Float32Array} triangle soup, 9 floats per triangle (x,y,z per vertex)
 */
export function parseSTL(input) {
  const bytes = toBytes(input);
  const len = bytes.byteLength;
  if (len < 15) throw new Error('This file is too small to be an STL.');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, len);
  const declared = len >= 84 ? dv.getUint32(80, true) : 0;
  // 1. exact binary size match wins, even if the header starts with "solid"
  if (len >= 84 && declared > 0 && 84 + declared * 50 === len) {
    const out = readBinarySTL(bytes, declared);
    if (out.length) return out;
  }
  // 2. ASCII
  if (startsWithSolid(bytes) || len < 84) {
    let out = parseAsciiSTL(bytes, false);
    if (!out.length) out = parseAsciiSTL(bytes, true);
    if (out.length) return out;
  }
  // 3. binary with a wrong count / trailing bytes
  if (len >= 84 + 50 && declared > 0) {
    const n = Math.min(declared, Math.floor((len - 84) / 50));
    if (n > 0) {
      const out = readBinarySTL(bytes, n);
      if (out.length) return out;
    }
  }
  // 4. ASCII without a "solid" line
  const out = parseAsciiSTL(bytes, false);
  if (out.length) return out;
  throw new Error('Could not read any triangles - is this really an STL file?');
}

/** Serialise a triangle soup to a binary STL (ArrayBuffer). */
export function writeBinarySTL(positions, header = 'vex-vr-sim export') {
  const n = Math.floor(positions.length / 9);
  const buf = new ArrayBuffer(84 + n * 50);
  const dv = new DataView(buf);
  for (let i = 0; i < Math.min(80, header.length); i++) dv.setUint8(i, header.charCodeAt(i) & 127);
  dv.setUint32(80, n, true);
  let o = 84;
  for (let t = 0; t < n; t++) {
    const p = t * 9;
    const ux = positions[p + 3] - positions[p], uy = positions[p + 4] - positions[p + 1], uz = positions[p + 5] - positions[p + 2];
    const vx = positions[p + 6] - positions[p], vy = positions[p + 7] - positions[p + 1], vz = positions[p + 8] - positions[p + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    dv.setFloat32(o, nx, true); dv.setFloat32(o + 4, ny, true); dv.setFloat32(o + 8, nz, true);
    for (let k = 0; k < 9; k++) dv.setFloat32(o + 12 + k * 4, positions[p + k], true);
    dv.setUint16(o + 48, 0, true);
    o += 50;
  }
  return buf;
}

/** Serialise a triangle soup to an ASCII STL string. */
export function writeAsciiSTL(positions, name = 'robot') {
  const n = Math.floor(positions.length / 9);
  const parts = ['solid ' + name + '\n'];
  for (let t = 0; t < n; t++) {
    const p = t * 9;
    const ux = positions[p + 3] - positions[p], uy = positions[p + 4] - positions[p + 1], uz = positions[p + 5] - positions[p + 2];
    const vx = positions[p + 6] - positions[p], vy = positions[p + 7] - positions[p + 1], vz = positions[p + 8] - positions[p + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    parts.push(
      ` facet normal ${nx} ${ny} ${nz}\n  outer loop\n` +
      `   vertex ${positions[p]} ${positions[p + 1]} ${positions[p + 2]}\n` +
      `   vertex ${positions[p + 3]} ${positions[p + 4]} ${positions[p + 5]}\n` +
      `   vertex ${positions[p + 6]} ${positions[p + 7]} ${positions[p + 8]}\n` +
      '  endloop\n endfacet\n',
    );
  }
  parts.push('endsolid ' + name + '\n');
  return parts.join('');
}

// ---------------------------------------------------------------------------
// Phase 1: rotation/unit independent preparation (cached per positions array)
// ---------------------------------------------------------------------------
const PREP_CACHE = new WeakMap();

function eigSym3(a00, a01, a02, a11, a12, a22, vals, vecs) {
  // Jacobi eigen-decomposition; writes eigenvalues (desc) and eigenvectors (rows of vecs)
  const A = [a00, a01, a02, a01, a11, a12, a02, a12, a22];
  const V = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const scale = Math.abs(a00) + Math.abs(a11) + Math.abs(a22) + 1e-300;
  for (let sweep = 0; sweep < 32; sweep++) {
    const off = Math.abs(A[1]) + Math.abs(A[2]) + Math.abs(A[5]);
    if (off < 1e-15 * scale) break;
    for (let p = 0; p < 2; p++) {
      for (let q = p + 1; q < 3; q++) {
        const apq = A[p * 3 + q];
        if (Math.abs(apq) < 1e-300) continue;
        const theta = (A[q * 3 + q] - A[p * 3 + p]) / (2 * apq);
        const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < 3; k++) {
          const akp = A[k * 3 + p], akq = A[k * 3 + q];
          A[k * 3 + p] = c * akp - s * akq;
          A[k * 3 + q] = s * akp + c * akq;
        }
        for (let k = 0; k < 3; k++) {
          const apk = A[p * 3 + k], aqk = A[q * 3 + k];
          A[p * 3 + k] = c * apk - s * aqk;
          A[q * 3 + k] = s * apk + c * aqk;
        }
        for (let k = 0; k < 3; k++) {
          const vkp = V[k * 3 + p], vkq = V[k * 3 + q];
          V[k * 3 + p] = c * vkp - s * vkq;
          V[k * 3 + q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const order = [0, 1, 2].sort((i, j) => A[j * 4] - A[i * 4]);
  for (let r = 0; r < 3; r++) {
    const col = order[r];
    vals[r] = A[col * 4];
    vecs[r * 3] = V[col];
    vecs[r * 3 + 1] = V[3 + col];
    vecs[r * 3 + 2] = V[6 + col];
  }
}

function* prepSteps(positions, maxTriangles) {
  const T = Math.floor(positions.length / 9);
  if (T < 1) throw new Error('The mesh has no triangles.');

  // ---- global bounding box
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0, n = T * 9; i < n; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const diag = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ);
  if (!(diag > 0)) throw new Error('The mesh has zero size.');
  const gcx = (minX + maxX) / 2, gcy = (minY + maxY) / 2, gcz = (minZ + maxZ) / 2;

  yield 'Welding vertices';

  // ---- weld vertices (spatial hash) + union-find over triangles
  const stride = T > maxTriangles ? Math.ceil(T / maxTriangles) : 1;
  const M = Math.ceil(T / stride); // triangles used for analysis
  const tol = stride === 1 ? diag * 2e-5 : diag / 600;
  const inv = 1 / tol;
  const nV = M * 3;
  let hsize = 1024;
  while (hsize < nV * 2) hsize *= 2;
  const mask = hsize - 1;
  const table = new Int32Array(hsize).fill(-1);
  const qc = new Int32Array(nV * 3); // quantised coords of unique vertices
  const owner = new Int32Array(nV); // first triangle that used each unique vertex
  const parent = new Int32Array(M);
  for (let i = 0; i < M; i++) parent[i] = i;
  let nUnique = 0;
  for (let s = 0; s < M; s++) {
    const base = s * stride * 9;
    for (let k = 0; k < 3; k++) {
      const o = base + k * 3;
      const qx = Math.round((positions[o] - minX) * inv) | 0;
      const qy = Math.round((positions[o + 1] - minY) * inv) | 0;
      const qz = Math.round((positions[o + 2] - minZ) * inv) | 0;
      let hh = (Math.imul(qx, 73856093) ^ Math.imul(qy, 19349663) ^ Math.imul(qz, 83492791)) & mask;
      let id;
      for (;;) {
        id = table[hh];
        if (id < 0) {
          id = nUnique++;
          table[hh] = id;
          qc[id * 3] = qx; qc[id * 3 + 1] = qy; qc[id * 3 + 2] = qz;
          owner[id] = s;
          break;
        }
        if (qc[id * 3] === qx && qc[id * 3 + 1] === qy && qc[id * 3 + 2] === qz) break;
        hh = (hh + 1) & mask;
      }
      // union(s, owner[id])
      let a = s, b = owner[id];
      if (a !== b) {
        while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; }
        while (parent[b] !== b) { parent[b] = parent[parent[b]]; b = parent[b]; }
        if (a !== b) { if (a < b) parent[b] = a; else parent[a] = b; }
      }
    }
  }
  // ---- label components (ids in order of first appearance)
  const label = new Int32Array(M).fill(-1);
  let nc = 0;
  for (let s = 0; s < M; s++) {
    let a = s;
    while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; }
    if (label[a] < 0) label[a] = nc++;
    label[s] = label[a];
  }
  let triComponent;
  if (stride === 1) triComponent = label;
  else {
    triComponent = new Int32Array(T);
    for (let t = 0; t < T; t++) triComponent[t] = label[(t / stride) | 0];
  }

  yield 'Measuring parts';

  // ---- pass 1: area, centroid, covariance (edge-midpoint quadrature), volume, bbox
  const A1 = 17;
  const acc = new Float64Array(nc * A1); // area, sx,sy,sz, sxx,syy,szz,sxy,sxz,syz, vol, min3, max3
  const triCount = new Int32Array(nc);
  for (let c = 0; c < nc; c++) {
    const b = c * A1;
    acc[b + 11] = acc[b + 12] = acc[b + 13] = Infinity;
    acc[b + 14] = acc[b + 15] = acc[b + 16] = -Infinity;
  }
  let totalArea = 0, gsx = 0, gsy = 0, gsz = 0, totalVol = 0;
  for (let s = 0; s < M; s++) {
    const o = s * stride * 9;
    const b = label[s] * A1;
    const ax = positions[o] - gcx, ay = positions[o + 1] - gcy, az = positions[o + 2] - gcz;
    const bx = positions[o + 3] - gcx, by = positions[o + 4] - gcy, bz = positions[o + 5] - gcz;
    const cx = positions[o + 6] - gcx, cy = positions[o + 7] - gcy, cz = positions[o + 8] - gcz;
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const area = 0.5 * Math.sqrt(nx * nx + ny * ny + nz * nz) * stride;
    const vol = (ax * nx + ay * ny + az * nz) / 6 * stride;
    triCount[label[s]]++;
    acc[b + 10] += vol;
    totalVol += vol;
    if (ax < acc[b + 11]) acc[b + 11] = ax; if (ax > acc[b + 14]) acc[b + 14] = ax;
    if (bx < acc[b + 11]) acc[b + 11] = bx; if (bx > acc[b + 14]) acc[b + 14] = bx;
    if (cx < acc[b + 11]) acc[b + 11] = cx; if (cx > acc[b + 14]) acc[b + 14] = cx;
    if (ay < acc[b + 12]) acc[b + 12] = ay; if (ay > acc[b + 15]) acc[b + 15] = ay;
    if (by < acc[b + 12]) acc[b + 12] = by; if (by > acc[b + 15]) acc[b + 15] = by;
    if (cy < acc[b + 12]) acc[b + 12] = cy; if (cy > acc[b + 15]) acc[b + 15] = cy;
    if (az < acc[b + 13]) acc[b + 13] = az; if (az > acc[b + 16]) acc[b + 16] = az;
    if (bz < acc[b + 13]) acc[b + 13] = bz; if (bz > acc[b + 16]) acc[b + 16] = bz;
    if (cz < acc[b + 13]) acc[b + 13] = cz; if (cz > acc[b + 16]) acc[b + 16] = cz;
    if (!(area > 0)) continue;
    const w = area / 3;
    const m1x = (ax + bx) / 2, m1y = (ay + by) / 2, m1z = (az + bz) / 2;
    const m2x = (bx + cx) / 2, m2y = (by + cy) / 2, m2z = (bz + cz) / 2;
    const m3x = (cx + ax) / 2, m3y = (cy + ay) / 2, m3z = (cz + az) / 2;
    acc[b] += area;
    acc[b + 1] += w * (m1x + m2x + m3x);
    acc[b + 2] += w * (m1y + m2y + m3y);
    acc[b + 3] += w * (m1z + m2z + m3z);
    acc[b + 4] += w * (m1x * m1x + m2x * m2x + m3x * m3x);
    acc[b + 5] += w * (m1y * m1y + m2y * m2y + m3y * m3y);
    acc[b + 6] += w * (m1z * m1z + m2z * m2z + m3z * m3z);
    acc[b + 7] += w * (m1x * m1y + m2x * m2y + m3x * m3y);
    acc[b + 8] += w * (m1x * m1z + m2x * m2z + m3x * m3z);
    acc[b + 9] += w * (m1y * m1z + m2y * m2z + m3y * m3z);
    totalArea += area;
    gsx += w * (m1x + m2x + m3x); gsy += w * (m1y + m2y + m3y); gsz += w * (m1z + m2z + m3z);
  }

  // ---- principal axes per component
  const cen = new Float64Array(nc * 3); // relative to global centre
  const axes = new Float64Array(nc * 9); // rows = e1, e2, e3 (desc. variance)
  const evals = new Float64Array(nc * 3);
  const tv = [0, 0, 0];
  const te = new Array(9);
  for (let c = 0; c < nc; c++) {
    const b = c * A1;
    const a = acc[b];
    let mx, my, mz;
    if (a > 0) {
      mx = acc[b + 1] / a; my = acc[b + 2] / a; mz = acc[b + 3] / a;
      eigSym3(
        acc[b + 4] / a - mx * mx, acc[b + 7] / a - mx * my, acc[b + 8] / a - mx * mz,
        acc[b + 5] / a - my * my, acc[b + 9] / a - my * mz, acc[b + 6] / a - mz * mz, tv, te,
      );
    } else {
      mx = (acc[b + 11] + acc[b + 14]) / 2; my = (acc[b + 12] + acc[b + 15]) / 2; mz = (acc[b + 13] + acc[b + 16]) / 2;
      tv[0] = tv[1] = tv[2] = 0;
      te[0] = 1; te[1] = 0; te[2] = 0; te[3] = 0; te[4] = 1; te[5] = 0; te[6] = 0; te[7] = 0; te[8] = 1;
    }
    cen[c * 3] = mx; cen[c * 3 + 1] = my; cen[c * 3 + 2] = mz;
    for (let k = 0; k < 9; k++) axes[c * 9 + k] = te[k];
    for (let k = 0; k < 3; k++) evals[c * 3 + k] = Math.max(0, tv[k]);
  }

  yield 'Fitting shapes';

  // ---- pass 2: extents in the principal frame + radial hull about 6 candidate axes
  // candidate axes: 0..2 principal axes, 3..5 raw X/Y/Z. For each: max radius^2 in 8 angular bins.
  const ext = new Float64Array(nc * 6).fill(0); // min1,min2,min3,max1,max2,max3
  for (let c = 0; c < nc; c++) {
    ext[c * 6] = ext[c * 6 + 1] = ext[c * 6 + 2] = Infinity;
    ext[c * 6 + 3] = ext[c * 6 + 4] = ext[c * 6 + 5] = -Infinity;
  }
  const hull = new Float32Array(nc * 48);
  const CS = Math.cos(0.2967), SN = Math.sin(0.2967); // 17 deg offset keeps box corners off bin edges
  const sx_ = new Float64Array(6), sy_ = new Float64Array(6), sz_ = new Float64Array(6);
  for (let s = 0; s < M; s++) {
    const o = s * stride * 9;
    const c = label[s];
    const c3 = c * 3, c9 = c * 9, c6 = c * 6, c48 = c * 48;
    const mx = cen[c3] + gcx, my = cen[c3 + 1] + gcy, mz = cen[c3 + 2] + gcz;
    sx_[0] = positions[o] - mx; sy_[0] = positions[o + 1] - my; sz_[0] = positions[o + 2] - mz;
    sx_[1] = positions[o + 3] - mx; sy_[1] = positions[o + 4] - my; sz_[1] = positions[o + 5] - mz;
    sx_[2] = positions[o + 6] - mx; sy_[2] = positions[o + 7] - my; sz_[2] = positions[o + 8] - mz;
    sx_[3] = (sx_[0] + sx_[1]) / 2; sy_[3] = (sy_[0] + sy_[1]) / 2; sz_[3] = (sz_[0] + sz_[1]) / 2;
    sx_[4] = (sx_[1] + sx_[2]) / 2; sy_[4] = (sy_[1] + sy_[2]) / 2; sz_[4] = (sz_[1] + sz_[2]) / 2;
    sx_[5] = (sx_[2] + sx_[0]) / 2; sy_[5] = (sy_[2] + sy_[0]) / 2; sz_[5] = (sz_[2] + sz_[0]) / 2;
    const e0 = axes[c9], e1 = axes[c9 + 1], e2 = axes[c9 + 2];
    const e3 = axes[c9 + 3], e4 = axes[c9 + 4], e5 = axes[c9 + 5];
    const e6 = axes[c9 + 6], e7 = axes[c9 + 7], e8 = axes[c9 + 8];
    for (let k = 0; k < 6; k++) {
      const dx = sx_[k], dy = sy_[k], dz = sz_[k];
      const p1 = dx * e0 + dy * e1 + dz * e2;
      const p2 = dx * e3 + dy * e4 + dz * e5;
      const p3 = dx * e6 + dy * e7 + dz * e8;
      if (k < 3) {
        if (p1 < ext[c6]) ext[c6] = p1; if (p1 > ext[c6 + 3]) ext[c6 + 3] = p1;
        if (p2 < ext[c6 + 1]) ext[c6 + 1] = p2; if (p2 > ext[c6 + 4]) ext[c6 + 4] = p2;
        if (p3 < ext[c6 + 2]) ext[c6 + 2] = p3; if (p3 > ext[c6 + 5]) ext[c6 + 5] = p3;
      }
      let u, v, uu, vv, r2, bin;
      // axis e1: plane (p2,p3)
      u = p2; v = p3; r2 = u * u + v * v; uu = CS * u - SN * v; vv = SN * u + CS * v;
      bin = c48 + (uu > 0 ? 1 : 0) + (vv > 0 ? 2 : 0) + ((uu < 0 ? -uu : uu) > (vv < 0 ? -vv : vv) ? 4 : 0);
      if (r2 > hull[bin]) hull[bin] = r2;
      // axis e2: plane (p3,p1)
      u = p3; v = p1; r2 = u * u + v * v; uu = CS * u - SN * v; vv = SN * u + CS * v;
      bin = c48 + 8 + (uu > 0 ? 1 : 0) + (vv > 0 ? 2 : 0) + ((uu < 0 ? -uu : uu) > (vv < 0 ? -vv : vv) ? 4 : 0);
      if (r2 > hull[bin]) hull[bin] = r2;
      // axis e3: plane (p1,p2)
      u = p1; v = p2; r2 = u * u + v * v; uu = CS * u - SN * v; vv = SN * u + CS * v;
      bin = c48 + 16 + (uu > 0 ? 1 : 0) + (vv > 0 ? 2 : 0) + ((uu < 0 ? -uu : uu) > (vv < 0 ? -vv : vv) ? 4 : 0);
      if (r2 > hull[bin]) hull[bin] = r2;
      // raw X: plane (y,z)
      u = dy; v = dz; r2 = u * u + v * v; uu = CS * u - SN * v; vv = SN * u + CS * v;
      bin = c48 + 24 + (uu > 0 ? 1 : 0) + (vv > 0 ? 2 : 0) + ((uu < 0 ? -uu : uu) > (vv < 0 ? -vv : vv) ? 4 : 0);
      if (r2 > hull[bin]) hull[bin] = r2;
      // raw Y: plane (z,x)
      u = dz; v = dx; r2 = u * u + v * v; uu = CS * u - SN * v; vv = SN * u + CS * v;
      bin = c48 + 32 + (uu > 0 ? 1 : 0) + (vv > 0 ? 2 : 0) + ((uu < 0 ? -uu : uu) > (vv < 0 ? -vv : vv) ? 4 : 0);
      if (r2 > hull[bin]) hull[bin] = r2;
      // raw Z: plane (x,y)
      u = dx; v = dy; r2 = u * u + v * v; uu = CS * u - SN * v; vv = SN * u + CS * v;
      bin = c48 + 40 + (uu > 0 ? 1 : 0) + (vv > 0 ? 2 : 0) + ((uu < 0 ? -uu : uu) > (vv < 0 ? -vv : vv) ? 4 : 0);
      if (r2 > hull[bin]) hull[bin] = r2;
    }
  }

  // ---- per-component raw descriptors
  const comps = new Array(nc);
  const eps = diag * 1e-9;
  for (let c = 0; c < nc; c++) {
    const b = c * A1;
    const min = [acc[b + 11] + gcx, acc[b + 12] + gcy, acc[b + 13] + gcz];
    const max = [acc[b + 14] + gcx, acc[b + 15] + gcy, acc[b + 16] + gcz];
    const aabb = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    const e = Array.from(axes.subarray(c * 9, c * 9 + 9));
    const pe = [ext[c * 6 + 3] - ext[c * 6], ext[c * 6 + 4] - ext[c * 6 + 1], ext[c * 6 + 5] - ext[c * 6 + 2]];
    for (let k = 0; k < 3; k++) if (!(pe[k] >= 0)) pe[k] = 0;
    // radial hull → roundness about each candidate axis
    let best = -1, bestRound = 0, bestR = 0;
    for (let k = 0; k < 6; k++) {
      let lo = Infinity, hi = 0;
      for (let j = 0; j < 8; j++) {
        const v = hull[c * 48 + k * 8 + j];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      const rr = hi > 0 ? Math.sqrt(lo / hi) : 0;
      if (rr > bestRound + (k >= 3 ? 0.02 : 0)) { bestRound = rr; best = k; bestR = Math.sqrt(hi); }
    }
    // oriented box: principal frame vs. axis-aligned frame, whichever is tighter
    const volP = Math.max(pe[0], eps) * Math.max(pe[1], eps) * Math.max(pe[2], eps);
    const volA = Math.max(aabb[0], eps) * Math.max(aabb[1], eps) * Math.max(aabb[2], eps);
    let dims, dirs;
    if (volA <= volP * 1.0001) {
      dims = aabb.slice();
      dirs = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    } else {
      dims = pe.slice();
      dirs = [[e[0], e[1], e[2]], [e[3], e[4], e[5]], [e[6], e[7], e[8]]];
    }
    const ord = [0, 1, 2].sort((i, j) => dims[j] - dims[i]);
    let axis = null, length = 0;
    if (best >= 0) {
      if (best < 3) { axis = [e[best * 3], e[best * 3 + 1], e[best * 3 + 2]]; length = pe[best]; }
      else { axis = [0, 0, 0]; axis[best - 3] = 1; length = aabb[best - 3]; }
    }
    comps[c] = {
      id: c,
      triCount: triCount[c] * stride,
      area: acc[b],
      volume: Math.abs(acc[b + 10]),
      centroid: [cen[c * 3] + gcx, cen[c * 3 + 1] + gcy, cen[c * 3 + 2] + gcz],
      min, max,
      axes: e,
      evals: [evals[c * 3], evals[c * 3 + 1], evals[c * 3 + 2]],
      dims: [dims[ord[0]], dims[ord[1]], dims[ord[2]]],
      dirs: [dirs[ord[0]], dirs[ord[1]], dirs[ord[2]]],
      roundness: bestRound,
      symAxis: axis,
      radius: bestR,
      length,
    };
  }

  return {
    T, M, stride, decimated: stride > 1, weldTol: tol,
    min: [minX, minY, minZ], max: [maxX, maxY, maxZ], diag,
    comps, triComponent, totalArea,
    areaCentroid: totalArea > 0 ? [gsx / totalArea + gcx, gsy / totalArea + gcy, gsz / totalArea + gcz] : [gcx, gcy, gcz],
    flipNormals: totalVol < 0,
  };
}

// ---------------------------------------------------------------------------
// Unit / orientation guessing
// ---------------------------------------------------------------------------
function matchWheel(radiusM) {
  let best = null, err = Infinity;
  for (const w of WHEELS) {
    const e = Math.abs(radiusM - w.r) / w.r;
    if (e < err) { err = e; best = w; }
  }
  return { wheel: best, err };
}

function wheelLike(c, scale, tolFrac) {
  if (!(c.roundness >= 0.85) || !c.symAxis) return null;
  const r = c.radius * scale, len = c.length * scale;
  const m = matchWheel(r);
  if (m.err > tolFrac) return null;
  if (len > r * 1.05 || len < 0.006) return null;
  return m;
}

function guessUnits(prep) {
  const D = Math.max(prep.max[0] - prep.min[0], prep.max[1] - prep.min[1], prep.max[2] - prep.min[2]);
  const prior = { mm: 0.3, in: 0.2, cm: 0.05, m: 0 };
  const rows = [];
  for (const u of ['mm', 'in', 'cm', 'm']) {
    const inches = (D * UNIT_SCALE[u]) / IN;
    let size = 0;
    if (inches >= 8 && inches <= 24) size = 1;
    else if ((inches >= 4 && inches < 8) || (inches > 24 && inches <= 40)) size = 0.4;
    let wheels = 0;
    for (const c of prep.comps) if (wheelLike(c, UNIT_SCALE[u], 0.07)) wheels++;
    const score = size > 0 || wheels > 0 ? size + Math.min(wheels, 6) * 0.5 + prior[u] : 0;
    rows.push({ u, inches, size, wheels, score });
  }
  rows.sort((a, b) => b.score - a.score);
  let pick = rows[0];
  if (pick.score <= 0) {
    // nothing plausible: choose the unit that puts the model closest to a 15 in robot
    rows.sort((a, b) => Math.abs(Math.log(a.inches / 15)) - Math.abs(Math.log(b.inches / 15)));
    pick = rows[0];
  }
  const second = rows.find((r) => r !== pick);
  const margin = pick.score - (second ? second.score : 0);
  const confidence = pick.score <= 0 ? 0.2 : clamp01(0.45 + margin * 0.35);
  const asIn = rows.find((r) => r.u === 'in').inches;
  const asMm = rows.find((r) => r.u === 'mm').inches;
  let reason = `Largest dimension is ${D.toFixed(1)} file units. `;
  if (pick.u === 'mm') {
    reason += `Read as millimetres that is ${asMm.toFixed(1)} in ${asMm <= 18 ? '(inside the 18 in start size)' : '(larger than the 18 in start size)'}; read as inches it would be ${asIn.toFixed(0)} in, far too big for a V5 robot.`;
  } else if (pick.u === 'in') {
    reason += `Read as inches that is ${asIn.toFixed(1)} in ${asIn <= 18 ? '(inside the 18 in start size)' : '(larger than the 18 in start size)'}; read as millimetres it would only be ${asMm.toFixed(2)} in.`;
  } else {
    reason += `Read as ${UNIT_NAMES[pick.u]} that is ${pick.inches.toFixed(1)} in, the only reading close to an 18 in robot (mm gives ${asMm.toFixed(2)} in, inches gives ${asIn.toFixed(1)} in).`;
  }
  if (pick.wheels > 0) reason += ` ${pick.wheels} part${pick.wheels === 1 ? '' : 's'} then match a standard VEX wheel diameter.`;
  if (pick.score <= 0) reason += ' No reading gives a robot-sized model, so check the units manually.';
  return { units: pick.u, confidence: round(confidence, 2), reason };
}

function canonicalFrame(prep, scale, R) {
  const P = permOf(R);
  const a = rotVec(P, prep.min), b = rotVec(P, prep.max);
  const lo = [Math.min(a[0], b[0]) * scale, Math.min(a[1], b[1]) * scale, Math.min(a[2], b[2]) * scale];
  const hi = [Math.max(a[0], b[0]) * scale, Math.max(a[1], b[1]) * scale, Math.max(a[2], b[2]) * scale];
  const offset = [-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2];
  const size = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
  return {
    P, scale, offset, size,
    min: [-size[0] / 2, 0, -size[2] / 2],
    max: [size[0] / 2, size[1], size[2] / 2],
  };
}

function guessUp(prep, positions, scale) {
  const ext = [prep.max[0] - prep.min[0], prep.max[1] - prep.min[1], prep.max[2] - prep.min[2]];
  const mid = [(prep.max[0] + prep.min[0]) / 2, (prep.max[1] + prep.min[1]) / 2, (prep.max[2] + prep.min[2]) / 2];
  const cands = [];
  for (const c of prep.comps) {
    const m = wheelLike(c, scale, 0.12);
    if (m) cands.push({ c, r: c.radius });
  }
  const bias = { '+z': 0.25, '+y': 0.2, '-z': 0, '-y': 0, '+x': 0, '-x': 0 };
  const score = (key, wheels) => {
    const i = 'xyz'.indexOf(key[1]);
    const s = key[0] === '+' ? 1 : -1;
    const low = ext[i] > 0 ? (s * (mid[i] - prep.areaCentroid[i])) / ext[i] : 0;
    return wheels * 10 + low * 2 + bias[key];
  };
  const rows = UP_KEYS.map((key) => {
    const i = 'xyz'.indexOf(key[1]);
    const s = key[0] === '+' ? 1 : -1;
    let wheels = 0;
    for (const w of cands) {
      if (Math.abs(w.c.symAxis[i]) > 0.25) continue;
      const tol = Math.max(0.2 * w.r, 0.004 / scale);
      if (s > 0 ? w.c.min[i] <= prep.min[i] + tol : w.c.max[i] >= prep.max[i] - tol) wheels++;
    }
    return { key, wheels, how: 'parts', score: score(key, wheels) };
  });
  let any = rows.some((r) => r.wheels >= 2);
  if (!any) {
    // no separate wheel parts: look for wheel-shaped surfaces on the floor instead
    for (const row of rows) {
      const frame = canonicalFrame(prep, scale, UP_ROT[row.key]);
      const hw = houghWheels(positions, prep, frame);
      row.wheels = Math.max(hw.x.length, hw.z.length);
      row.how = 'surfaces';
      row.score = score(row.key, row.wheels);
    }
    any = rows.some((r) => r.wheels >= 2);
  }
  rows.sort((a, b) => b.score - a.score);
  const pick = rows[0];
  const margin = pick.score - rows[1].score;
  let reason;
  if (any && pick.wheels >= 2) {
    reason = `${pick.wheels} wheel-shaped ${pick.how === 'parts' ? 'parts' : 'surfaces'} have horizontal axles and rest on the lowest plane when ${pick.key.toUpperCase()} is up.`;
  } else {
    reason = `No wheels found to anchor the floor, so ${pick.key.toUpperCase()} was chosen because most of the surface area sits low along that axis (CAD default Z-up is preferred on ties). Check it and rotate if needed.`;
  }
  const confidence = any && pick.wheels >= 2 ? clamp01(0.6 + Math.min(margin, 20) * 0.02) : clamp01(0.3 + margin * 0.3);
  return { axis: pick.key, confidence: round(confidence, 2), reason };
}

// ---------------------------------------------------------------------------
// Region analysis (used for fused single-shell meshes or when no wheel parts
// are found): circle Hough transform for wheels + occupancy grid for columns.
// ---------------------------------------------------------------------------
function houghWheels(positions, prep, frame) {
  const { P, scale: s, offset: off } = frame;
  const p0 = P.perm[0], p1 = P.perm[1], p2 = P.perm[2];
  const s0 = P.sgn[0] * s, s1 = P.sgn[1] * s, s2 = P.sgn[2] * s;
  const o0 = off[0], o1 = off[1], o2 = off[2];
  const g = 0.01;
  const minX = frame.min[0], minZ = frame.min[2];
  const nx = Math.max(1, Math.ceil(frame.size[0] / g) + 1);
  const nz = Math.max(1, Math.ceil(frame.size[2] / g) + 1);
  if (nx * nz > 4e6) return { x: [], z: [] };
  const ncell = nx * nz;
  const NR = WHEELS.length;
  const accX = [], accZ = [];
  for (let i = 0; i < NR; i++) { accX.push(new Float32Array(ncell * 10)); accZ.push(new Float32Array(ncell * 10)); }
  const yMax = 2 * WHEELS[NR - 1].r + 0.005;
  const tol = 0.003;
  const flip = prep.flipNormals ? -1 : 1;
  const T = prep.T;
  const stride = T > 3e6 ? Math.ceil(T / 3e6) : 1;
  for (let t = 0; t < T; t += stride) {
    const o = t * 9;
    const ay = s1 * positions[o + p1] + o1;
    const by = s1 * positions[o + 3 + p1] + o1;
    const cy = s1 * positions[o + 6 + p1] + o1;
    const my = (ay + by + cy) / 3;
    if (my > yMax) continue;
    const ax = s0 * positions[o + p0] + o0, az = s2 * positions[o + p2] + o2;
    const bx = s0 * positions[o + 3 + p0] + o0, bz = s2 * positions[o + 3 + p2] + o2;
    const cx = s0 * positions[o + 6 + p0] + o0, cz = s2 * positions[o + 6 + p2] + o2;
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nX = uy * vz - uz * vy, nY = uz * vx - ux * vz, nZ = ux * vy - uy * vx;
    const l = Math.sqrt(nX * nX + nY * nY + nZ * nZ);
    if (!(l > 1e-14)) continue;
    const area = 0.5 * l * stride;
    const il = flip / l;
    nX *= il; nY *= il; nZ *= il;
    const mx = (ax + bx + cx) / 3, mz = (az + bz + cz) / 3;
    // axle along X: wheel circle lives in the (y, z) plane
    if (nX < 0.35 && nX > -0.35) {
      const m = Math.sqrt(nY * nY + nZ * nZ);
      const qy = nY / m, qz = nZ / m;
      const sec = (qy > 0 ? 1 : 0) + (qz > 0 ? 2 : 0) + ((qy < 0 ? -qy : qy) > (qz < 0 ? -qz : qz) ? 4 : 0);
      const ix = Math.floor((mx - minX) / g);
      for (let ri = 0; ri < NR; ri++) {
        const r = WHEELS[ri].r;
        const d = my - r * qy - r;
        if (d > tol || d < -tol) continue;
        const wz = mz - r * qz;
        const iz = Math.floor((wz - minZ) / g);
        if (ix < 0 || ix >= nx || iz < 0 || iz >= nz) continue;
        const a = accX[ri], b = (iz * nx + ix) * 10;
        a[b + sec] += area; a[b + 8] += area * mx; a[b + 9] += area * wz;
      }
    }
    // axle along Z: wheel circle lives in the (y, x) plane
    if (nZ < 0.35 && nZ > -0.35) {
      const m = Math.sqrt(nY * nY + nX * nX);
      const qy = nY / m, qx = nX / m;
      const sec = (qy > 0 ? 1 : 0) + (qx > 0 ? 2 : 0) + ((qy < 0 ? -qy : qy) > (qx < 0 ? -qx : qx) ? 4 : 0);
      const iz = Math.floor((mz - minZ) / g);
      for (let ri = 0; ri < NR; ri++) {
        const r = WHEELS[ri].r;
        const d = my - r * qy - r;
        if (d > tol || d < -tol) continue;
        const wx = mx - r * qx;
        const ix = Math.floor((wx - minX) / g);
        if (ix < 0 || ix >= nx || iz < 0 || iz >= nz) continue;
        const a = accZ[ri], b = (iz * nx + ix) * 10;
        a[b + sec] += area; a[b + 8] += area * mz; a[b + 9] += area * wx;
      }
    }
  }
  const peaks = (accs, axleIsX) => {
    const cand = [];
    const sec = new Float64Array(8);
    for (let ri = 0; ri < NR; ri++) {
      const a = accs[ri];
      const r = WHEELS[ri].r;
      const thr = 0.3 * ((2 * Math.PI * r * 0.012) / 8);
      for (let iz = 0; iz < nz; iz++) {
        for (let ix = 0; ix < nx; ix++) {
          const b0 = (iz * nx + ix) * 10;
          if (a[b0 + 8] === 0 && a[b0 + 9] === 0 && a[b0] + a[b0 + 1] + a[b0 + 2] + a[b0 + 3] + a[b0 + 4] + a[b0 + 5] + a[b0 + 6] + a[b0 + 7] === 0) continue;
          sec.fill(0);
          let sa = 0, st = 0, total = 0;
          // window: +-3 cells along the axle, +-1 cell along travel
          const wx = axleIsX ? 3 : 1, wz = axleIsX ? 1 : 3;
          for (let dz = -wz; dz <= wz; dz++) {
            const jz = iz + dz;
            if (jz < 0 || jz >= nz) continue;
            for (let dx = -wx; dx <= wx; dx++) {
              const jx = ix + dx;
              if (jx < 0 || jx >= nx) continue;
              const b = (jz * nx + jx) * 10;
              for (let k = 0; k < 8; k++) { sec[k] += a[b + k]; total += a[b + k]; }
              sa += a[b + 8]; st += a[b + 9];
            }
          }
          let sectors = 0;
          for (let k = 0; k < 8; k++) if (sec[k] >= thr) sectors++;
          if (sectors < 6 || !(total > 0)) continue;
          const axle = sa / total, travel = st / total;
          cand.push({ sectors, area: total, r, dia: WHEELS[ri].dia, pos: axleIsX ? [axle, r, travel] : [travel, r, axle] });
        }
      }
    }
    cand.sort((p, q) => q.sectors - p.sectors || q.area - p.area);
    const out = [];
    for (const c of cand) {
      let clash = false;
      for (const k of out) {
        const dAx = Math.abs(axleIsX ? c.pos[0] - k.pos[0] : c.pos[2] - k.pos[2]);
        const dTr = Math.abs(axleIsX ? c.pos[2] - k.pos[2] : c.pos[0] - k.pos[0]);
        if (dAx < 0.05 && dTr < 0.045) { clash = true; break; }
      }
      if (!clash) out.push(c);
      if (out.length >= 12) break;
    }
    return out;
  };
  return { x: peaks(accX, true), z: peaks(accZ, false) };
}

function occupancyColumns(positions, prep, frame, voxel) {
  const { P, scale: s, offset: off } = frame;
  const p0 = P.perm[0], p1 = P.perm[1], p2 = P.perm[2];
  const s0 = P.sgn[0] * s, s1 = P.sgn[1] * s, s2 = P.sgn[2] * s;
  let v = voxel;
  let nx, ny, nz;
  for (;;) {
    nx = Math.max(1, Math.ceil(frame.size[0] / v));
    ny = Math.max(1, Math.ceil(frame.size[1] / v));
    nz = Math.max(1, Math.ceil(frame.size[2] / v));
    if (nx * ny * nz <= 8e6) break;
    v *= 1.5;
  }
  const grid = new Uint8Array(nx * ny * nz);
  const minX = frame.min[0], minZ = frame.min[2];
  const iv = 1 / v;
  const T = prep.T;
  const stride = T > 3e6 ? Math.ceil(T / 3e6) : 1;
  const step = v * 0.7;
  for (let t = 0; t < T; t += stride) {
    const o = t * 9;
    const ax = s0 * positions[o + p0] + off[0], ay = s1 * positions[o + p1] + off[1], az = s2 * positions[o + p2] + off[2];
    const bx = s0 * positions[o + 3 + p0] + off[0], by = s1 * positions[o + 3 + p1] + off[1], bz = s2 * positions[o + 3 + p2] + off[2];
    const cx = s0 * positions[o + 6 + p0] + off[0], cy = s1 * positions[o + 6 + p1] + off[1], cz = s2 * positions[o + 6 + p2] + off[2];
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nX = uy * vz - uz * vy, nY = uz * vx - ux * vz, nZ = ux * vy - uy * vx;
    if (!(nX * nX + nY * nY + nZ * nZ > 1e-24)) continue; // degenerate
    const e1 = Math.sqrt(ux * ux + uy * uy + uz * uz), e2 = Math.sqrt(vx * vx + vy * vy + vz * vz);
    const e3 = Math.hypot(cx - bx, cy - by, cz - bz);
    const n = Math.min(96, Math.max(1, Math.ceil(Math.max(e1, e2, e3) / step)));
    const inv = 1 / n;
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n - i; j++) {
        const a = i * inv, b = j * inv;
        let gx = ((ax + a * ux + b * vx - minX) * iv) | 0;
        let gy = ((ay + a * uy + b * vy) * iv) | 0;
        let gz = ((az + a * uz + b * vz - minZ) * iv) | 0;
        if (gx >= nx) gx = nx - 1; if (gy >= ny) gy = ny - 1; if (gz >= nz) gz = nz - 1;
        if (gx < 0) gx = 0; if (gy < 0) gy = 0; if (gz < 0) gz = 0;
        grid[(gy * nz + gz) * nx + gx] = 1;
      }
    }
  }
  // height map
  const top = new Int16Array(nx * nz).fill(-1);
  let occupied = 0;
  for (let y = 0; y < ny; y++) {
    for (let z = 0; z < nz; z++) {
      const row = (y * nz + z) * nx;
      for (let x = 0; x < nx; x++) {
        if (grid[row + x]) { occupied++; top[z * nx + x] = y; }
      }
    }
  }
  const heights = [];
  for (let i = 0; i < top.length; i++) if (top[i] >= 0) heights.push(top[i]);
  heights.sort((a, b) => a - b);
  const H = frame.size[1];
  const chassisH = heights.length ? (heights[heights.length >> 1] + 1) * v : 0;
  const thr = Math.max(0.7 * H, chassisH + 0.08);
  let tall = 0, sx = 0, sz = 0;
  for (let z = 0; z < nz; z++) {
    for (let x = 0; x < nx; x++) {
      const h = top[z * nx + x];
      if (h >= 0 && (h + 1) * v >= thr) {
        tall++;
        sx += minX + (x + 0.5) * v;
        sz += minZ + (z + 0.5) * v;
      }
    }
  }
  const info = {
    voxelM: round(v, 4), grid: [nx, ny, nz], occupiedVoxels: occupied,
    columns: heights.length, chassisHeightM: round(chassisH, 3), tallColumns: tall,
  };
  let lift = null;
  if (H >= 0.2 && tall > 0 && heights.length > 0 && tall / heights.length < 0.35) {
    lift = { pos: [sx / tall, H, sz / tall], tall, frac: tall / heights.length, chassisH };
  }
  return { info, lift };
}

// ---------------------------------------------------------------------------
// Component → canonical descriptors and feature classification
// ---------------------------------------------------------------------------
function canonicalComponents(prep, frame) {
  const { P, scale: s, offset: off } = frame;
  const tf = (v) => {
    const r = rotVec(P, v);
    return [r[0] * s + off[0], r[1] * s + off[1], r[2] * s + off[2]];
  };
  const out = new Array(prep.comps.length);
  for (let i = 0; i < prep.comps.length; i++) {
    const c = prep.comps[i];
    const a = tf(c.min), b = tf(c.max);
    const dims = [c.dims[0] * s, c.dims[1] * s, c.dims[2] * s];
    const boxVol = dims[0] * dims[1] * dims[2];
    const volume = c.volume * s * s * s;
    const round_ = c.roundness;
    out[i] = {
      id: c.id,
      triangles: c.triCount,
      areaM2: c.area * s * s,
      volumeM3: volume,
      centroid: tf(c.centroid),
      bbox: {
        min: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])],
        max: [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])],
      },
      axes: [rotVec(P, c.axes.slice(0, 3)), rotVec(P, c.axes.slice(3, 6)), rotVec(P, c.axes.slice(6, 9))],
      dims,
      longAxis: rotVec(P, c.dirs[0]),
      elongation: dims[1] > 1e-9 ? dims[0] / dims[1] : dims[0] > 0 ? 999 : 1,
      flatness: dims[1] > 1e-9 ? dims[2] / dims[1] : 0,
      boxiness: boxVol > 1e-15 ? clamp01(volume / boxVol) : 0,
      roundness: round_,
      cylinderness: clamp01((round_ - 0.75) / 0.2),
      symAxis: c.symAxis ? rotVec(P, c.symAxis) : null,
      radius: c.radius * s,
      length: c.length * s,
    };
  }
  return out;
}

function matchBox(dims, ref, tolFrac) {
  let err = 0;
  for (let k = 0; k < 3; k++) err = Math.max(err, Math.abs(dims[k] - ref[k]) / ref[k]);
  return err <= tolFrac ? err : -1;
}

function seg2dCross(a0, a1, b0, b1) {
  // intersection parameters of two 2D segments, or null
  const rx = a1[0] - a0[0], ry = a1[1] - a0[1];
  const sx = b1[0] - b0[0], sy = b1[1] - b0[1];
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-12) return null;
  const qx = b0[0] - a0[0], qy = b0[1] - a0[1];
  return { t: (qx * sy - qy * sx) / den, u: (qx * ry - qy * rx) / den };
}

function classifyComponents(comps, frame) {
  const H = frame.size[1];
  const features = [];
  const taken = new Set();
  let nextId = 1;
  const add = (type, confidence, reason, ids, position, axis, data) => {
    for (const id of ids) taken.add(id);
    const f = {
      id: 'f' + nextId++,
      type,
      confidence: round(Math.min(0.98, Math.max(0.05, confidence)), 2),
      reason,
      source: 'component',
      componentIds: ids.slice(),
      position: r3(position),
      axis: axis ? r3(axis) : null,
      data: data || {},
    };
    features.push(f);
    return f;
  };
  const eligible = comps.filter((c) => c.dims[0] >= 0.008 && c.triangles >= 4);

  // ---- wheels
  const wheelFeats = [];
  for (const c of eligible) {
    if (!(c.roundness >= 0.85) || !c.symAxis) continue;
    const m = matchWheel(c.radius);
    if (m.err > 0.12) continue;
    if (c.length > c.radius * 1.05 || c.length < 0.006) continue;
    if (Math.abs(c.symAxis[1]) > 0.25) continue;
    const gap = c.bbox.min[1];
    if (gap > Math.max(0.006, 0.2 * c.radius)) continue;
    let conf = 0.55 + 0.2 * (1 - m.err / 0.12) + 0.15 * clamp01((c.roundness - 0.85) / 0.1) + (gap < 0.002 ? 0.1 : 0);
    if (c.length < 0.015) conf -= 0.15;
    const f = add(
      'wheel', conf,
      `Disc-shaped cylinder, ${fmtIn(c.radius * 2)} in diameter x ${fmtIn(c.length)} in thick (closest VEX wheel: ${m.wheel.dia} in), axle horizontal, ${gap < 0.002 ? 'touching' : 'just above'} the floor.`,
      [c.id], c.centroid, c.symAxis,
      { radiusM: round(c.radius), widthM: round(c.length), diameterIn: m.wheel.dia, measuredDiameterIn: round((c.radius * 2) / IN, 2) },
    );
    wheelFeats.push(f);
  }
  if (wheelFeats.length >= 2) for (const f of wheelFeats) f.confidence = round(Math.min(0.98, f.confidence + 0.03), 2);

  // ---- air tanks
  for (const c of eligible) {
    if (taken.has(c.id) || !(c.roundness >= 0.85) || !c.symAxis) continue;
    const err = Math.abs(c.radius - TANK_R) / TANK_R;
    const lenIn = c.length / IN;
    if (err > 0.2 || lenIn < 4.5 || lenIn > 8.8) continue;
    add(
      'tank', 0.6 + 0.2 * (1 - err / 0.2) + (lenIn >= 5 && lenIn <= 8 ? 0.1 : 0),
      `Cylinder ${fmtIn(c.radius * 2)} in diameter x ${lenIn.toFixed(1)} in long - the size of a VEX air reservoir (1.75 in x 5-8 in).`,
      [c.id], c.centroid, c.symAxis, { radiusM: round(c.radius), lengthM: round(c.length) },
    );
  }

  // ---- pneumatic pistons
  for (const c of eligible) {
    if (taken.has(c.id) || !(c.roundness >= 0.85) || !c.symAxis) continue;
    if (c.radius < 0.004 || c.radius > 0.012) continue;
    const ratio = c.length / (2 * c.radius);
    if (ratio <= 3 || c.length < 0.04 || c.length > 0.25) continue;
    let cls = PISTON_CLASSES[0];
    for (const p of PISTON_CLASSES) if (Math.abs(c.length - p.len) < Math.abs(c.length - cls.len)) cls = p;
    const conf = 0.5 + (c.radius >= 0.005 && c.radius <= 0.008 ? 0.15 : 0) + (Math.abs(c.length - cls.len) < 0.015 ? 0.15 : 0) + (c.roundness > 0.93 ? 0.1 : 0);
    add(
      'piston', conf,
      `Long thin cylinder, ${(c.radius * 2000).toFixed(1)} mm diameter x ${(c.length * 1000).toFixed(0)} mm long (length/diameter ${ratio.toFixed(1)}) - looks like a pneumatic cylinder, about ${cls.stroke} mm stroke.`,
      [c.id], c.centroid, c.symAxis,
      { radiusM: round(c.radius), lengthM: round(c.length), strokeMm: cls.stroke, strokeM: cls.stroke / 1000 },
    );
  }

  // ---- motors and brain (box-like blocks)
  for (const c of eligible) {
    if (taken.has(c.id) || c.roundness >= 0.9) continue;
    const boxBonus = c.boxiness > 0.6 ? 0.1 : 0;
    const dimTxt = `${(c.dims[0] * 1000).toFixed(0)} x ${(c.dims[1] * 1000).toFixed(0)} x ${(c.dims[2] * 1000).toFixed(0)} mm`;
    let e = matchBox(c.dims, MOTOR_11W, 0.15);
    if (e >= 0) {
      add('motor', 0.5 + 0.3 * (1 - e / 0.15) + boxBonus,
        `Block ${dimTxt}, within ${(e * 100).toFixed(0)}% of a V5 Smart Motor (72 x 57 x 33 mm).`,
        [c.id], c.centroid, c.longAxis, { kind: '11W', dimsM: r3(c.dims) });
      continue;
    }
    e = matchBox(c.dims, BRAIN, 0.15);
    if (e >= 0) {
      add('brain', 0.5 + 0.3 * (1 - e / 0.15) + boxBonus,
        `Block ${dimTxt}, within ${(e * 100).toFixed(0)}% of the V5 Brain (102 x 61 x 33 mm).`,
        [c.id], c.centroid, c.longAxis, { dimsM: r3(c.dims) });
      continue;
    }
    e = matchBox(c.dims, MOTOR_55W, 0.15);
    if (e >= 0 && c.boxiness > 0.4) {
      add('motor', 0.35 + 0.25 * (1 - e / 0.15) + boxBonus,
        `Small block ${dimTxt}, within ${(e * 100).toFixed(0)}% of a 5.5 W Smart Motor (about 57 x 32 x 25 mm).`,
        [c.id], c.centroid, c.longAxis, { kind: '5.5W', dimsM: r3(c.dims) });
    }
  }

  // ---- lift: slender members above the chassis that reach the top of the model
  let chassisTop = 0.3 * H;
  if (wheelFeats.length) chassisTop = Math.max(...wheelFeats.map((f) => f.data.radiusM * 2));
  if (H >= 0.2) {
    const members = [];
    for (const c of eligible) {
      if (taken.has(c.id)) continue;
      if (c.dims[0] < 0.12 || c.elongation < 4) continue;
      if (c.bbox.max[1] < 0.8 * H || c.bbox.max[1] < chassisTop + 0.05) continue;
      if (Math.abs(c.longAxis[0]) > 0.9) continue; // left-right cross brace
      let u = c.longAxis.slice();
      if (u[1] < 0) u = [-u[0], -u[1], -u[2]];
      const half = c.dims[0] / 2;
      // centre of the member = centre of its box (robust to uneven tessellation)
      const mid = [(c.bbox.min[0] + c.bbox.max[0]) / 2, (c.bbox.min[1] + c.bbox.max[1]) / 2, (c.bbox.min[2] + c.bbox.max[2]) / 2];
      members.push({
        c, u, len: c.dims[0], vertical: Math.abs(u[1]) > 0.95,
        lo: [mid[0] - u[0] * half, mid[1] - u[1] * half, mid[2] - u[2] * half],
        hi: [mid[0] + u[0] * half, mid[1] + u[1] * half, mid[2] + u[2] * half],
      });
    }
    if (members.length) {
      const arms = members.filter((m) => !m.vertical);
      const towers = members.filter((m) => m.vertical);
      let parallel = 0, crossing = 0;
      for (let i = 0; i < arms.length; i++) {
        for (let j = i + 1; j < arms.length; j++) {
          const a = arms[i], b = arms[j];
          const dot = Math.abs(a.u[0] * b.u[0] + a.u[1] * b.u[1] + a.u[2] * b.u[2]);
          if (dot > 0.97) parallel++;
          else if (dot < 0.9 && Math.abs(a.c.centroid[0] - b.c.centroid[0]) < 0.1) {
            const x = seg2dCross([a.lo[2], a.lo[1]], [a.hi[2], a.hi[1]], [b.lo[2], b.lo[1]], [b.hi[2], b.hi[1]]);
            if (x && x.t > 0.15 && x.t < 0.85 && x.u > 0.15 && x.u < 0.85) crossing++;
          }
        }
      }
      let kind, hint;
      if (crossing > 0) { kind = 'scissor/DR4B'; hint = 'bars cross each other in side view, which suggests a scissor or double-reverse four-bar'; }
      else if (parallel > 0) { kind = 'four-bar'; hint = `${arms.length} parallel bars suggest a four-bar (or two-bar) arm`; }
      else if (arms.length === 1) { kind = 'arm'; hint = 'one angled bar suggests a single swinging arm'; }
      else if (arms.length === 0) { kind = 'tower'; hint = 'only vertical members, which suggests towers for an elevator/cascade lift'; }
      else { kind = 'arm'; hint = 'angled bars that are not parallel'; }
      let reach = H;
      for (const m of towers) reach = Math.max(reach, m.hi[1]);
      for (const m of arms) {
        let pivotY = m.lo[1];
        for (const t of towers) {
          for (const end of [m.lo, m.hi]) {
            if (Math.hypot(end[0] - t.hi[0], end[1] - t.hi[1], end[2] - t.hi[2]) < 0.06) pivotY = Math.max(pivotY, end[1]);
          }
        }
        reach = Math.max(reach, pivotY + m.len * (crossing > 0 ? 1.9 : 1));
      }
      const pos = [0, 0, 0];
      for (const m of members) for (let k = 0; k < 3; k++) pos[k] += m.c.centroid[k] / members.length;
      const conf = 0.5 + (parallel > 0 ? 0.2 : 0) + (crossing > 0 ? 0.1 : 0) + (H >= 0.3 ? 0.1 : 0);
      const lead = arms[0] || towers[0];
      add(
        'lift', conf,
        `${members.length} long slender member${members.length === 1 ? '' : 's'} (up to ${fmtIn(Math.max(...members.map((m) => m.len)))} in) rise above the chassis to the top of the model at ${fmtIn(H)} in; ${hint}. Estimated maximum reach ${fmtIn(reach)} in.`,
        members.map((m) => m.c.id), pos, lead.u,
        { kind, members: members.length, parallelPairs: parallel, crossingPairs: crossing, maxHeightM: round(reach, 3), restHeightM: round(H, 3) },
      );
    }
  }

  // ---- claw: mirrored pair of small parts at the front / back extreme
  {
    const depth = frame.size[2];
    const band = 0.06 * depth + 0.005;
    let cand = eligible.filter((c) => !taken.has(c.id) && c.dims[0] >= 0.03 && c.dims[0] <= 0.2 &&
      (c.bbox.max[2] >= frame.max[2] - band || c.bbox.min[2] <= frame.min[2] + band));
    if (cand.length > 200) cand = cand.sort((a, b) => b.dims[0] - a.dims[0]).slice(0, 200);
    let best = null;
    for (let i = 0; i < cand.length; i++) {
      for (let j = i + 1; j < cand.length; j++) {
        const a = cand[i], b = cand[j];
        let similar = true;
        for (let k = 0; k < 3; k++) {
          const big = Math.max(a.dims[k], b.dims[k]);
          if (big > 1e-6 && Math.abs(a.dims[k] - b.dims[k]) / big > 0.15) { similar = false; break; }
        }
        if (!similar) continue;
        const tolPos = 0.01 + 0.05 * a.dims[0];
        if (Math.abs(a.centroid[1] - b.centroid[1]) > tolPos || Math.abs(a.centroid[2] - b.centroid[2]) > tolPos) continue;
        const dx = Math.abs(a.centroid[0] - b.centroid[0]);
        if (dx < 0.015 || dx > 0.25) continue;
        const front = a.bbox.max[2] >= frame.max[2] - band;
        const centred = Math.abs(a.centroid[0] + b.centroid[0]) < 0.03;
        const score = 0.4 + (centred ? 0.1 : 0) + (front ? 0.1 : 0) + (a.centroid[1] > 0.1 ? 0.05 : 0) + (a.elongation > 2 ? 0.05 : 0);
        if (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) <= 1e-9 && a.dims[0] > best.a.dims[0])) best = { a, b, score, front, centred, dx };
      }
    }
    if (best) {
      const { a, b } = best;
      add(
        'claw', best.score,
        `Mirrored pair of similar parts (${fmtIn(a.dims[0])} in long, ${fmtIn(best.dx)} in apart) at the ${best.front ? 'front' : 'back'} end of the model${best.centred ? ', centred left-to-right' : ''} - likely claw fingers.`,
        [a.id, b.id],
        [(a.centroid[0] + b.centroid[0]) / 2, (a.centroid[1] + b.centroid[1]) / 2, (a.centroid[2] + b.centroid[2]) / 2],
        a.longAxis, { openingM: round(best.dx), fingerLengthM: round(a.dims[0]), end: best.front ? 'front' : 'back' },
      );
    }
  }
  return features;
}

// ---------------------------------------------------------------------------
// Summary (also used by the UI after the student edits the feature list)
// ---------------------------------------------------------------------------
/**
 * Build the simulator config from a feature list.
 * @param {Array} features  features in the canonical frame
 * @param {{heightM?:number}} [info]
 */
export function summarizeFeatures(features, info = {}) {
  const of = (t) => features.filter((f) => f.type === t);
  const wheels = of('wheel');
  const motors = of('motor');
  const lifts = of('lift');
  const notes = [];
  const drivetrain = {
    type: 'tank', motors: 4, wheelDiaIn: 3.25, trackWidthM: 0.3, wheelbaseM: 0.25,
    wheels: wheels.length, detected: wheels.length >= 2, axesParallel: true,
  };
  if (wheels.length) {
    // wheel diameter: most common standard size
    const count = new Map();
    for (const w of wheels) {
      const d = w.data && w.data.diameterIn;
      if (d) count.set(d, (count.get(d) || 0) + 1);
    }
    let bestD = 0, bestN = 0;
    for (const [d, n] of count) if (n > bestN || (n === bestN && d > bestD)) { bestD = d; bestN = n; }
    if (bestD) drivetrain.wheelDiaIn = bestD;
    else notes.push('Wheel diameter was not measured (manual markers) - using 3.25 in.');
  }
  if (wheels.length >= 2) {
    // axle directions in the floor plane (angle mod 180 deg)
    let C2 = 0, S2 = 0, C4 = 0;
    for (const w of wheels) {
      const a = w.axis || [1, 0, 0];
      const th = Math.atan2(a[2], a[0]);
      C2 += Math.cos(2 * th); S2 += Math.sin(2 * th); C4 += Math.cos(4 * th);
    }
    const n = wheels.length;
    const R = Math.hypot(C2, S2) / n;
    let axle = [1, 0];
    if (R > 0.9) {
      const th = Math.atan2(S2, C2) / 2;
      axle = [Math.cos(th), Math.sin(th)];
      drivetrain.type = 'tank';
    } else if (C4 / n < -0.5) {
      drivetrain.type = 'xdrive';
      drivetrain.axesParallel = false;
    } else {
      drivetrain.type = 'tank';
      drivetrain.axesParallel = false;
      notes.push('Wheel axles point in mixed directions (H-drive or holonomic?) - treated as a tank drive.');
    }
    let aMin = Infinity, aMax = -Infinity, pMin = Infinity, pMax = -Infinity;
    for (const w of wheels) {
      const a = w.position[0] * axle[0] + w.position[2] * axle[1];
      const p = -w.position[0] * axle[1] + w.position[2] * axle[0];
      if (a < aMin) aMin = a; if (a > aMax) aMax = a;
      if (p < pMin) pMin = p; if (p > pMax) pMax = p;
    }
    drivetrain.trackWidthM = round(aMax - aMin, 3);
    drivetrain.wheelbaseM = round(pMax - pMin, 3);
    if (drivetrain.type === 'tank' && drivetrain.axesParallel && Math.abs(axle[1]) > 0.7) {
      notes.push('Wheel axles run front-to-back - rotate the model 90 degrees about the vertical axis so the front arrow points forward.');
    }
  } else if (wheels.length === 1) {
    notes.push('Only one wheel is tagged - add the others so the track width can be measured.');
  } else {
    notes.push('No wheels tagged yet - using default drivetrain dimensions.');
  }
  // drive motors: motors sitting low, next to the drivetrain
  const lowLimit = drivetrain.wheelDiaIn * IN * 1.6;
  const lowMotors = motors.filter((m) => m.position[1] <= lowLimit).length;
  if (drivetrain.type === 'xdrive') drivetrain.motors = 4;
  else if (lowMotors >= 2) drivetrain.motors = lowMotors >= 6 ? 6 : lowMotors >= 4 ? 4 : 2;
  else drivetrain.motors = wheels.length >= 6 ? 6 : wheels.length >= 4 ? 4 : 2;

  let maxH = 0;
  let liftKind = null;
  for (const l of lifts) {
    const hgt = (l.data && l.data.maxHeightM) || Math.max(info.heightM || 0, l.position[1]);
    if (hgt > maxH) { maxH = hgt; liftKind = (l.data && l.data.kind) || null; }
  }
  return {
    drivetrain,
    lift: { present: lifts.length > 0, maxHeightM: round(maxH, 3), kind: liftKind },
    claw: { present: of('claw').length > 0 },
    pistons: of('piston').length,
    tanks: of('tank').length,
    motors: motors.length,
    brain: of('brain').length > 0,
    notes,
  };
}

// ---------------------------------------------------------------------------
// analyzeSTL
// ---------------------------------------------------------------------------
/**
 * Generator form of the analysis: yields a phase label between heavy steps and
 * returns the result. Use analyzeSTL (sync) or analyzeSTLAsync (yields to the UI).
 *
 * opts: {
 *   units?: 'mm'|'in'|'cm'|'m'   force units (default: guessed)
 *   upAxis?: '+z'|'-z'|'+y'|'-y'|'+x'|'-x'   raw axis that points up (default: guessed)
 *   rotation?: number[9]   full raw→canonical rotation (signed permutation); overrides upAxis
 *   maxTriangles?: number  analysis budget before decimation (default 1.5e6)
 *   voxel?: number         occupancy voxel in metres (default 0.01)
 * }
 */
export function* analyzeSteps(positions, opts = {}) {
  if (!(positions instanceof Float32Array)) positions = new Float32Array(positions);
  const maxTriangles = Math.max(1000, opts.maxTriangles || 1.5e6);
  let prep = PREP_CACHE.get(positions);
  if (!prep || prep.maxTriangles !== maxTriangles) {
    prep = yield* prepSteps(positions, maxTriangles);
    prep.maxTriangles = maxTriangles;
    PREP_CACHE.set(positions, prep);
  }

  yield 'Working out units and orientation';

  const unitsGuess = guessUnits(prep);
  const units = opts.units && UNIT_SCALE[opts.units] ? opts.units : unitsGuess.units;
  const scale = UNIT_SCALE[units];
  const warnings = [];

  let R, upGuess = null, rotationSource;
  if (opts.rotation) {
    R = Array.from(opts.rotation);
    permOf(R);
    rotationSource = 'user';
  } else if (opts.upAxis) {
    R = rotationForUp(opts.upAxis);
    rotationSource = 'user-up';
  } else {
    upGuess = guessUp(prep, positions, scale);
    R = rotationForUp(upGuess.axis);
    rotationSource = 'guess';
  }
  let frame = canonicalFrame(prep, scale, R);
  let comps = canonicalComponents(prep, frame);
  let features = classifyComponents(comps, frame);

  const totalArea = prep.totalArea * scale * scale;
  let largest = 0;
  for (const c of comps) if (c.areaM2 > largest) largest = c.areaM2;
  const fused = comps.length === 1 || (totalArea > 0 && largest / totalArea > 0.97);
  let compWheels = features.filter((f) => f.type === 'wheel');

  // yaw: put tank-drive axles along X so that front/back is the Z axis
  if (rotationSource !== 'user') {
    let turn = false;
    if (compWheels.length >= 2) {
      let alongZ = 0;
      for (const w of compWheels) if (Math.abs(w.axis[2]) > 0.9) alongZ++;
      turn = alongZ === compWheels.length;
    } else {
      const hw = houghWheels(positions, prep, frame);
      turn = hw.z.length >= 2 && hw.z.length > hw.x.length;
    }
    if (turn) {
      R = matMul3(ROT.y90, R);
      frame = canonicalFrame(prep, scale, R);
      comps = canonicalComponents(prep, frame);
      features = classifyComponents(comps, frame);
      compWheels = features.filter((f) => f.type === 'wheel');
    }
    // front/back: a claw, or failing that the lift, normally overhangs the front
    const claw = features.find((f) => f.type === 'claw');
    const lift = features.find((f) => f.type === 'lift');
    const flip = claw ? claw.data.end === 'back' : !!lift && lift.position[2] < -0.02;
    if (flip) {
      R = matMul3(ROT.y180, R);
      frame = canonicalFrame(prep, scale, R);
      comps = canonicalComponents(prep, frame);
      features = classifyComponents(comps, frame);
      compWheels = features.filter((f) => f.type === 'wheel');
    }
  }

  yield 'Scanning regions';

  // ---- region analysis for fused shells / models without separate wheel parts
  let regions = null;
  if (fused || compWheels.length === 0 || !features.some((f) => f.type === 'lift')) {
    const occ = occupancyColumns(positions, prep, frame, opts.voxel || 0.01);
    regions = { ...occ.info, wheels: 0, used: false };
    let n = features.length + 1;
    if (fused || compWheels.length === 0) {
      const hw = houghWheels(positions, prep, frame);
      const useX = hw.x.length >= hw.z.length;
      const list = useX ? hw.x : hw.z;
      for (const w of list) {
        if (compWheels.some((f) => Math.hypot(f.position[0] - w.pos[0], f.position[2] - w.pos[2]) < 0.04)) continue;
        regions.wheels++;
        features.push({
          id: 'f' + n++,
          type: 'wheel',
          confidence: round(Math.min(0.5, 0.3 + 0.05 * (w.sectors - 6) + (list.length >= 4 ? 0.05 : 0)), 2),
          reason: `Region scan: a ${w.dia} in circle of surface touching the floor (${w.sectors}/8 of the rim found) in the side view. Not a separate part, so please check it.`,
          source: 'region',
          componentIds: [],
          position: r3(w.pos),
          axis: useX ? [1, 0, 0] : [0, 0, 1],
          data: { radiusM: round(w.r), diameterIn: w.dia },
        });
      }
    }
    if (occ.lift && !features.some((f) => f.type === 'lift') && (fused || comps.length < 4)) {
      features.push({
        id: 'f' + n++,
        type: 'lift',
        confidence: 0.3,
        reason: `Region scan: a narrow column (${(occ.lift.frac * 100).toFixed(0)}% of the footprint) rises to ${fmtIn(frame.size[1])} in, well above the ${fmtIn(occ.lift.chassisH)} in chassis - probably a lift or arm. Mechanism type unknown.`,
        source: 'region',
        componentIds: [],
        position: r3(occ.lift.pos),
        axis: [0, 1, 0],
        data: { kind: 'unknown', maxHeightM: round(frame.size[1], 3), restHeightM: round(frame.size[1], 3) },
      });
    }
    regions.used = features.some((f) => f.source === 'region');
  }

  if (fused) {
    warnings.push('The STL is a single fused shell, so individual parts cannot be separated. Detections come from a coarse region scan with low confidence - manual tagging is recommended (click the model to add markers). Exporting the assembly with separate bodies gives much better results.');
  }
  if (prep.decimated) {
    warnings.push(`Large mesh (${prep.T.toLocaleString('en-US')} triangles): the analysis used every ${prep.stride}${prep.stride === 2 ? 'nd' : prep.stride === 3 ? 'rd' : 'th'} triangle with coarse welding, so touching parts may be merged.`);
  }
  if (!features.some((f) => f.type === 'wheel')) {
    warnings.push('No wheels were found. Check the units and which way is up, or tag the wheels by hand.');
  }

  features.sort((a, b) => FEATURE_TYPES.indexOf(a.type) - FEATURE_TYPES.indexOf(b.type) || b.confidence - a.confidence);

  const sizeIn = { width: round(frame.size[0] / IN, 2), height: round(frame.size[1] / IN, 2), length: round(frame.size[2] / IN, 2) };
  const eps = 0.02;
  const checks = {
    fits18: sizeIn.width <= 18 + eps && sizeIn.height <= 18 + eps && sizeIn.length <= 18 + eps,
    footprint24: sizeIn.width <= 24 + eps && sizeIn.length <= 24 + eps,
    height50: sizeIn.height <= 50 + eps,
  };
  if (!upGuess) {
    upGuess = { axis: upOfRotation(R), confidence: 1, reason: 'Orientation set by the user.' };
  }
  const summary = summarizeFeatures(features, { heightM: frame.size[1] });

  return {
    triangleCount: prep.T,
    analyzedTriangles: prep.M,
    decimated: prep.decimated,
    units,
    unitsSource: opts.units && UNIT_SCALE[opts.units] ? 'user' : 'guess',
    unitsGuess,
    scale,
    upAxis: upOfRotation(R),
    upGuess,
    rotationSource,
    rotation: R,
    offset: frame.offset.slice(),
    bbox: { min: frame.min.slice(), max: frame.max.slice() },
    sizeM: frame.size.slice(),
    sizeIn,
    fits18: checks.fits18,
    checks,
    fused,
    components: comps,
    triComponent: prep.triComponent,
    features,
    regions,
    summary,
    warnings,
  };
}

/** Synchronous analysis. `opts.onProgress(label)` is called between phases. */
export function analyzeSTL(positions, opts = {}) {
  const it = analyzeSteps(positions, opts);
  for (;;) {
    const r = it.next();
    if (r.done) return r.value;
    if (opts.onProgress) opts.onProgress(r.value);
  }
}

/** Same as analyzeSTL but awaits `opts.yield(label)` between phases so a UI can repaint. */
export async function analyzeSTLAsync(positions, opts = {}) {
  const it = analyzeSteps(positions, opts);
  for (;;) {
    const r = it.next();
    if (r.done) return r.value;
    if (opts.onProgress) opts.onProgress(r.value);
    if (opts.yield) await opts.yield(r.value);
    else await Promise.resolve();
  }
}

// ---------------------------------------------------------------------------
// Geometry helpers for consumers
// ---------------------------------------------------------------------------
/**
 * Transform raw STL positions into the canonical frame of an analysis result.
 * @param {Float32Array} positions raw triangle soup
 * @param {{rotation:number[], scale:number, offset:number[]}} result
 * @param {Float32Array} [out]
 * @param {{frontNegZ?:boolean}} [o] frontNegZ: turn 180 deg about Y so front = -Z
 */
export function transformPositions(positions, result, out, o = {}) {
  const P = permOf(result.rotation);
  const s = result.scale;
  const f = o.frontNegZ ? -1 : 1;
  const p0 = P.perm[0], p1 = P.perm[1], p2 = P.perm[2];
  const s0 = P.sgn[0] * s * f, s1 = P.sgn[1] * s, s2 = P.sgn[2] * s * f;
  const o0 = result.offset[0] * f, o1 = result.offset[1], o2 = result.offset[2] * f;
  const n = positions.length - (positions.length % 3);
  const dst = out && out.length >= n ? out : new Float32Array(n);
  for (let i = 0; i < n; i += 3) {
    const x = positions[i + p0], y = positions[i + p1], z = positions[i + p2];
    dst[i] = s0 * x + o0;
    dst[i + 1] = s1 * y + o1;
    dst[i + 2] = s2 * z + o2;
  }
  return dst;
}

export function rawToCanonical(p, result) {
  const P = permOf(result.rotation);
  const r = rotVec(P, p);
  return [r[0] * result.scale + result.offset[0], r[1] * result.scale + result.offset[1], r[2] * result.scale + result.offset[2]];
}

export function canonicalToRaw(p, result) {
  const P = permOf(result.rotation);
  const q = [(p[0] - result.offset[0]) / result.scale, (p[1] - result.offset[1]) / result.scale, (p[2] - result.offset[2]) / result.scale];
  const raw = [0, 0, 0];
  for (let k = 0; k < 3; k++) raw[P.perm[k]] = P.sgn[k] * q[k];
  return raw;
}

// ---------------------------------------------------------------------------
// Procedural sample robot (also used by the tests)
// ---------------------------------------------------------------------------
/**
 * Build a demo multi-part robot as a triangle soup.
 * Native frame: millimetres, CAD-style Z-up, X = right, Y = forward.
 * opts: { units:'mm'|'in'|'cm'|'m', up:'z'|'y', fused:boolean, segments:number, xdrive:boolean }
 */
export function buildSampleRobot(opts = {}) {
  const seg = opts.segments || 24;
  const out = [];
  const parts = []; // start offset (in floats) of each part
  const tri = (a, b, c) => { out.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); };
  const quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };

  // box centred at (cx,cy,cz), size (sx,sy,sz), optionally pitched about X and yawed about Z (degrees)
  const box = (cx, cy, cz, sx, sy, sz, pitch = 0, yaw = 0) => {
    parts.push(out.length);
    const cp = Math.cos((pitch * Math.PI) / 180), sp = Math.sin((pitch * Math.PI) / 180);
    const cw = Math.cos((yaw * Math.PI) / 180), sw = Math.sin((yaw * Math.PI) / 180);
    const v = [];
    for (let i = 0; i < 8; i++) {
      const x = ((i & 1) ? 0.5 : -0.5) * sx, y = ((i & 2) ? 0.5 : -0.5) * sy, z = ((i & 4) ? 0.5 : -0.5) * sz;
      const y1 = y * cp - z * sp, z1 = y * sp + z * cp;
      const x2 = x * cw - y1 * sw, y2 = x * sw + y1 * cw;
      v.push([cx + x2, cy + y2, cz + z1]);
    }
    quad(v[0], v[2], v[3], v[1]); // -z
    quad(v[4], v[5], v[7], v[6]); // +z
    quad(v[0], v[1], v[5], v[4]); // -y
    quad(v[2], v[6], v[7], v[3]); // +y
    quad(v[0], v[4], v[6], v[2]); // -x
    quad(v[1], v[3], v[7], v[5]); // +x
  };

  // cylinder centred at c with unit axis a, radius r, length len
  const cyl = (c, a, r, len) => {
    parts.push(out.length);
    const al = Math.hypot(a[0], a[1], a[2]);
    const ax = [a[0] / al, a[1] / al, a[2] / al];
    const ref = Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    let u = [ax[1] * ref[2] - ax[2] * ref[1], ax[2] * ref[0] - ax[0] * ref[2], ax[0] * ref[1] - ax[1] * ref[0]];
    const ul = Math.hypot(u[0], u[1], u[2]);
    u = [u[0] / ul, u[1] / ul, u[2] / ul];
    const w = [ax[1] * u[2] - ax[2] * u[1], ax[2] * u[0] - ax[0] * u[2], ax[0] * u[1] - ax[1] * u[0]];
    const h = len / 2;
    const c0 = [c[0] - ax[0] * h, c[1] - ax[1] * h, c[2] - ax[2] * h];
    const c1 = [c[0] + ax[0] * h, c[1] + ax[1] * h, c[2] + ax[2] * h];
    const ring = (cc, i) => {
      const t = (i / seg) * Math.PI * 2;
      const co = Math.cos(t) * r, si = Math.sin(t) * r;
      return [cc[0] + u[0] * co + w[0] * si, cc[1] + u[1] * co + w[1] * si, cc[2] + u[2] * co + w[2] * si];
    };
    for (let i = 0; i < seg; i++) {
      const a0 = ring(c0, i), a1 = ring(c0, (i + 1) % seg), b0 = ring(c1, i), b1 = ring(c1, (i + 1) % seg);
      quad(a0, a1, b1, b0); // side (outward)
      tri(c0, a1, a0); // bottom cap
      tri(c1, b0, b1); // top cap
    }
  };

  // chassis plate
  box(0, 0, 51, 300, 340, 26);
  // 4 in wheels
  const wr = 50.8, ww = 25;
  if (opts.xdrive) {
    for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
      cyl([sx * 185, sy * 195, wr], [sx, sy, 0], wr, ww);
    }
  } else {
    for (const sx of [1, -1]) for (const sy of [1, -1]) cyl([sx * 168.5, sy * 120, wr], [1, 0, 0], wr, ww);
  }
  // drive motors (V5 Smart Motor 57 x 72 x 33 mm) on top of the chassis
  for (const sx of [1, -1]) for (const sy of [1, -1]) box(sx * 112, sy * 120, 64.5 + 16.5, 57, 72, 33);
  // brain 101.6 x 61 x 33
  box(0, -45, 64.5 + 16.5, 101.6, 61, 33);
  // air reservoir 1.75 in dia x 150 mm, lying across the back
  cyl([0, -138, 64.5 + 22.4], [1, 0, 0], 22.225, 150);
  // pneumatic piston: 14 mm dia x 102 mm (50 mm stroke class)
  cyl([0, 40, 112], [0, 1, 0], 7, 102);
  // two parallel lift bars rising toward the front
  {
    const y0 = -110, z0 = 78, y1 = 150, z1 = 400;
    const len = Math.hypot(y1 - y0, z1 - z0);
    const pitch = (Math.atan2(z1 - z0, y1 - y0) * 180) / Math.PI;
    for (const sx of [1, -1]) box(sx * 92, (y0 + y1) / 2, (z0 + z1) / 2, 13, len, 25, pitch);
    // cross bar joining the bar tips
    box(0, 150, 400, 160, 14, 14);
  }
  // claw fingers reaching out past the front of the robot
  for (const sx of [1, -1]) box(sx * 34, 196, 398, 10, 78, 22);

  let pos = new Float32Array(out);

  if (opts.fused) {
    // zero-area bridge triangles that share vertices between every part and the
    // chassis, so the whole mesh welds into one connected shell
    const extra = [];
    for (let i = 1; i < parts.length; i++) {
      const p = parts[i];
      extra.push(pos[p], pos[p + 1], pos[p + 2], pos[0], pos[1], pos[2], pos[0], pos[1], pos[2]);
    }
    const merged = new Float32Array(pos.length + extra.length);
    merged.set(pos);
    merged.set(extra, pos.length);
    pos = merged;
  }
  const k = 0.001 / (UNIT_SCALE[opts.units] || 0.001); // mm → requested unit
  if (k !== 1) for (let i = 0; i < pos.length; i++) pos[i] *= k;
  if (opts.up === 'y') {
    // (x, y, z) Z-up → (x, z, -y) Y-up
    for (let i = 0; i < pos.length; i += 3) {
      const y = pos[i + 1], z = pos[i + 2];
      pos[i + 1] = z;
      pos[i + 2] = -y;
    }
  }
  return pos;
}
