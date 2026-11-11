// The wanderer's cloak: a sheet of cloth hung from a collar round the shoulders, open at the front, falling to the
// calf. It is a grid of points held together by threads of fixed length, pulled by its own weight and pushed by the
// air it moves through, so running lifts it out behind and a gust takes it sideways. The body under it is a few
// rounded sticks that the cloth can't enter.
import * as THREE from 'three';

const COLS = 19, ROWS = 14;
const DROP = 0.088; // metres of cloth from one row to the next
const STEP = 1 / 120;

export class Cloak {
  constructor(bones) {
    this.bones = bones;
    this.cols = COLS; this.rows = ROWS;
    const n = COLS * ROWS;
    this.p = new Float32Array(n * 3);
    this.prev = new Float32Array(n * 3);
    this.normals = new Float32Array(n * 3);
    this.pins = new Float32Array(COLS * 3);
    this.pinsBefore = new Float32Array(COLS * 3);
    this.hat = null; // the hat, if he wears one: the cloth stays under its brim
    this.hatInverse = new THREE.Matrix4();
    this.started = false;
    this.time = 0;
    this.left = 0;

    // the cloth as it was cut: a cone flaring out from the collar. Thread lengths come from this.
    const rest = new Float32Array(n * 3);
    for (let j = 0; j < ROWS; j++) {
      for (let i = 0; i < COLS; i++) {
        const a = this.angle(i), flare = 1 + 0.06 * j;
        rest.set([Math.sin(a) * 0.225 * flare, -j * DROP * 0.93, -Math.cos(a) * 0.16 * flare], (i + j * COLS) * 3);
      }
    }
    const links = [];
    const link = (a, b, stiff) => {
      const d = Math.hypot(rest[a * 3] - rest[b * 3], rest[a * 3 + 1] - rest[b * 3 + 1], rest[a * 3 + 2] - rest[b * 3 + 2]);
      links.push(a, b, d, stiff);
    };
    for (let j = 0; j < ROWS; j++) {
      for (let i = 0; i < COLS; i++) {
        const k = i + j * COLS;
        if (i + 1 < COLS) link(k, k + 1, 1);
        if (j + 1 < ROWS) link(k, k + COLS, 1);
        if (i + 1 < COLS && j + 1 < ROWS) { link(k, k + COLS + 1, 0.6); link(k + 1, k + COLS, 0.6); }
        if (i + 2 < COLS) link(k, k + 2, 0.25);
        if (j + 2 < ROWS) link(k, k + 2 * COLS, 0.25);
      }
    }
    this.links = new Float32Array(links);

    // the body the cloth lies on: [bone, bone, radius]
    this.sticks = [
      ['pelvis', 'spine_03', 0.165], ['spine_03', 'neck_01', 0.15], ['upperarm_l', 'upperarm_r', 0.115],
      ['upperarm_l', 'lowerarm_l', 0.075], ['lowerarm_l', 'hand_l', 0.06], ['upperarm_r', 'lowerarm_r', 0.075], ['lowerarm_r', 'hand_r', 0.06],
      ['thigh_l', 'calf_l', 0.105], ['calf_l', 'foot_l', 0.075], ['thigh_r', 'calf_r', 0.105], ['calf_r', 'foot_r', 0.075], ['pelvis', 'pelvis', 0.19],
    ];
    this.ends = new Float32Array(this.sticks.length * 6);
    this.endsBefore = new Float32Array(this.sticks.length * 6);
    this.a = new THREE.Vector3(); this.b = new THREE.Vector3(); this.c = new THREE.Vector3();
    this.X = new THREE.Vector3(); this.Y = new THREE.Vector3(); this.Z = new THREE.Vector3(); this.C = new THREE.Vector3();
  }

  /** Where column i sits round the collar: 0 at the middle of the back, most of the way round to the front. */
  angle(i) { return ((i / (COLS - 1)) * 2 - 1) * 2.45; }

  readBody() {
    const B = this.bones, { a, b, X, Y, Z, C } = this;
    this.pinsBefore.set(this.pins);
    this.endsBefore.set(this.ends);
    if (this.hat) this.hatInverse.copy(this.hat.matrixWorld).invert();
    B.upperarm_l.getWorldPosition(a); B.upperarm_r.getWorldPosition(b);
    X.subVectors(a, b);
    const half = X.length() / 2;
    X.normalize();
    C.addVectors(a, b).multiplyScalar(0.5);
    B.neck_01.getWorldPosition(a); B.spine_02.getWorldPosition(b);
    Y.subVectors(a, b).normalize();
    Z.crossVectors(X, Y).normalize();
    Y.crossVectors(Z, X);
    C.addScaledVector(Y, 0.075).addScaledVector(Z, -0.01);
    for (let i = 0; i < COLS; i++) {
      const t = this.angle(i);
      // the collar sits on the shoulders and dips a little at the front
      const dip = -0.05 * Math.max(0, Math.abs(t) - 1.5);
      this.pins[i * 3] = C.x + X.x * Math.sin(t) * (half + 0.04) - Z.x * Math.cos(t) * 0.15 + Y.x * dip;
      this.pins[i * 3 + 1] = C.y + X.y * Math.sin(t) * (half + 0.04) - Z.y * Math.cos(t) * 0.15 + Y.y * dip;
      this.pins[i * 3 + 2] = C.z + X.z * Math.sin(t) * (half + 0.04) - Z.z * Math.cos(t) * 0.15 + Y.z * dip;
    }
    this.sticks.forEach(([p, q], k) => {
      B[p].getWorldPosition(a); B[q].getWorldPosition(b);
      this.ends.set([a.x, a.y, a.z, b.x, b.y, b.z], k * 6);
    });
  }

  start() {
    this.readBody();
    const { X, Y, Z } = this;
    for (let j = 0; j < ROWS; j++) {
      for (let i = 0; i < COLS; i++) {
        const k = (i + j * COLS) * 3, t = this.angle(i), out = 0.015 * j;
        this.p[k] = this.pins[i * 3] + (X.x * Math.sin(t) - Z.x * Math.cos(t)) * out;
        this.p[k + 1] = this.pins[i * 3 + 1] - j * DROP * 0.93;
        this.p[k + 2] = this.pins[i * 3 + 2] + (X.z * Math.sin(t) - Z.z * Math.cos(t)) * out;
      }
    }
    this.prev.set(this.p);
    this.pinsBefore.set(this.pins);
    this.endsBefore.set(this.ends);
    this.started = true;
  }

  /** Advance by dt. `air(x, y, z, out)` gives the wind there (m/s); `ground(x, z)` the height of the floor. */
  update(dt, air, ground) {
    if (!this.started) return this.start();
    this.readBody();
    // a jump of more than a couple of metres is a teleport: hang the cloth afresh
    if (Math.hypot(this.pins[0] - this.pinsBefore[0], this.pins[1] - this.pinsBefore[1], this.pins[2] - this.pinsBefore[2]) > 2) { this.started = false; return this.start(); }
    this.left += Math.min(dt, 0.05);
    const steps = Math.min(6, Math.floor(this.left / STEP));
    if (steps <= 0) return;
    this.left -= steps * STEP;
    const { p, prev, normals, links, pins, pinsBefore, ends, endsBefore } = this;
    const wind = this.c;
    for (let s = 0; s < steps; s++) {
      const u = (s + 1) / steps;
      this.time += STEP;
      this.computeNormals();
      for (let j = 1; j < ROWS; j++) {
        for (let i = 0; i < COLS; i++) {
          const k = (i + j * COLS) * 3;
          let vx = (p[k] - prev[k]) * 0.992, vy = (p[k + 1] - prev[k + 1]) * 0.992, vz = (p[k + 2] - prev[k + 2]) * 0.992;
          air(p[k], p[k + 1], p[k + 2], wind);
          // the air it meets: the wind less its own speed, felt across the face of the cloth
          const rx = wind.x - vx / STEP, ry = wind.y - vy / STEP, rz = wind.z - vz / STEP;
          const nx = normals[k], ny = normals[k + 1], nz = normals[k + 2];
          const speed = Math.hypot(rx, ry, rz);
          // the air drags the cloth along with it, and sends ripples down it that grow toward the hem
          const flutter = Math.sin(this.time * 11 - j * 0.85 + i * 0.7) * 0.45 * speed * (j / ROWS);
          const ax = nx * flutter + rx * 1.45, ay = -9.8 + ny * flutter + ry * 0.5, az = nz * flutter + rz * 1.45;
          prev[k] = p[k]; prev[k + 1] = p[k + 1]; prev[k + 2] = p[k + 2];
          p[k] += vx + ax * STEP * STEP; p[k + 1] += vy + ay * STEP * STEP; p[k + 2] += vz + az * STEP * STEP;
        }
      }
      for (let i = 0; i < COLS * 3; i++) p[i] = pinsBefore[i] + (pins[i] - pinsBefore[i]) * u;
      for (let it = 0; it < 7; it++) {
        for (let l = 0; l < links.length; l += 4) {
          const a = links[l] * 3, b = links[l + 1] * 3, rest = links[l + 2], stiff = links[l + 3];
          const dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2];
          const d = Math.hypot(dx, dy, dz) || 1e-6;
          // threads pull when stretched and barely push when slack: cloth folds, it doesn't spring
          let k = ((d - rest) / d) * (d > rest ? stiff : stiff * 0.12);
          const pa = a < COLS * 3, pb = b < COLS * 3;
          if (pa && pb) continue;
          const wa = pa ? 0 : pb ? 1 : 0.5, wb = pb ? 0 : pa ? 1 : 0.5;
          p[a] += dx * k * wa; p[a + 1] += dy * k * wa; p[a + 2] += dz * k * wa;
          p[b] -= dx * k * wb; p[b + 1] -= dy * k * wb; p[b + 2] -= dz * k * wb;
        }
        if (it % 2 === 0) this.collide(u, ground);
      }
      this.collide(u, ground);
    }
    this.computeNormals();
  }

  collide(u, ground) {
    const { p, ends, endsBefore, sticks } = this;
    for (let k = COLS * 3; k < p.length; k += 3) {
      for (let s = 0; s < sticks.length; s++) {
        const e = s * 6, r = sticks[s][2] + 0.022;
        const ax = endsBefore[e] + (ends[e] - endsBefore[e]) * u, ay = endsBefore[e + 1] + (ends[e + 1] - endsBefore[e + 1]) * u, az = endsBefore[e + 2] + (ends[e + 2] - endsBefore[e + 2]) * u;
        const bx = endsBefore[e + 3] + (ends[e + 3] - endsBefore[e + 3]) * u, by = endsBefore[e + 4] + (ends[e + 4] - endsBefore[e + 4]) * u, bz = endsBefore[e + 5] + (ends[e + 5] - endsBefore[e + 5]) * u;
        const ex = bx - ax, ey = by - ay, ez = bz - az;
        const len2 = ex * ex + ey * ey + ez * ez;
        const t = len2 > 1e-8 ? Math.max(0, Math.min(1, ((p[k] - ax) * ex + (p[k + 1] - ay) * ey + (p[k + 2] - az) * ez) / len2)) : 0;
        const dx = p[k] - ax - ex * t, dy = p[k + 1] - ay - ey * t, dz = p[k + 2] - az - ez * t;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < r * r && d2 > 1e-10) {
          const d = Math.sqrt(d2), f = (r - d) / d;
          p[k] += dx * f; p[k + 1] += dy * f; p[k + 2] += dz * f;
        }
      }
      if (this.hat) {
        // in the hat's own space the brim is a shallow cone: anything of the cloak that rises into it is put back under
        const e = this.hatInverse.elements, m = this.hat.matrixWorld.elements;
        const x = p[k], y = p[k + 1], z = p[k + 2];
        const lx = e[0] * x + e[4] * y + e[8] * z + e[12], ly = e[1] * x + e[5] * y + e[9] * z + e[13], lz = e[2] * x + e[6] * y + e[10] * z + e[14];
        const r = Math.hypot(lx, lz);
        if (r < 0.43) {
          const under = (r < 0.125 ? 0 : -(r - 0.125) * 0.42) - 0.05;
          if (ly > under && ly < under + 0.35) {
            const dy = under - ly;
            p[k] += m[4] * dy; p[k + 1] += m[5] * dy; p[k + 2] += m[6] * dy;
          }
        }
      }
      const g = ground(p[k], p[k + 2]) + 0.04;
      if (p[k + 1] < g) p[k + 1] = g;
    }
  }

  computeNormals() {
    const { p, normals } = this;
    for (let j = 0; j < ROWS; j++) {
      for (let i = 0; i < COLS; i++) {
        const k = (i + j * COLS) * 3;
        const l = (Math.max(i - 1, 0) + j * COLS) * 3, r = (Math.min(i + 1, COLS - 1) + j * COLS) * 3;
        const up = (i + Math.max(j - 1, 0) * COLS) * 3, dn = (i + Math.min(j + 1, ROWS - 1) * COLS) * 3;
        const ax = p[r] - p[l], ay = p[r + 1] - p[l + 1], az = p[r + 2] - p[l + 2];
        const bx = p[dn] - p[up], by = p[dn + 1] - p[up + 1], bz = p[dn + 2] - p[up + 2];
        // across x down points out of the back of the cloak
        let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
        const len = Math.hypot(nx, ny, nz) || 1;
        normals[k] = nx / len; normals[k + 1] = ny / len; normals[k + 2] = nz / len;
      }
    }
  }
}
