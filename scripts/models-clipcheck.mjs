// H3a (models pass): the mechanical clip check of design 6.1.5 step 3.
// usage: node scripts/models-clipcheck.mjs <built hero.glb> <shipped hero.glb>
// For each clip of the shipped file, at twelve evenly spaced times, every compared bone's orientation in the
// figure's space in the built file must equal the same pivot's in the shipped file within 0.02 rad (SpinSlash's
// arm and elbow bones excepted: they keep today's numbers as local rotations), and each leg bone's displacement
// from rest in the figure's space must equal the shipped leg pivot's within 0.01. Prints the largest difference
// per clip; exit 0 when every clip passes, 1 when one fails, 3 on unreadable input, a file with no animations
// or a shipped file without all ten clips.
import { readGlb, readAccessor } from './lib/glb.mjs';

const ROT_TOL = 0.02;
const POS_TOL = 0.01;
const SAMPLES = 12;
const COMPARED = [
  'Torso', 'HeadGroup', 'LeftArmPivot', 'RightArmPivot', 'LeftElbowPivot', 'RightElbowPivot',
  'LeftLegPivot', 'RightLegPivot', 'LeftKneePivot', 'RightKneePivot'
];
const LEGS = ['LeftLegPivot', 'RightLegPivot'];
const CLIPS = ['Cast', 'Chop', 'Fish', 'Idle', 'Lunge', 'Mine', 'Ranged', 'Slash', 'SpinSlash', 'Walk'];
const SPIN_EXCEPT = new Set(['LeftArmPivot', 'RightArmPivot', 'LeftElbowPivot', 'RightElbowPivot']);
// The shipped legs' rest: the pivot builder's values (build_hero.py before H3a, LEAN_RIG hipX and hipY). The
// shipped nodes store the last frame of Walk's dip (0.865) instead, so the node cannot serve as rest.
const SHIPPED_LEG_REST = { LeftLegPivot: [-0.11, 0.9, 0], RightLegPivot: [0.11, 0.9, 0] };

const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
];
const qrot = (q, v) => {
  const p = qmul(qmul(q, [...v, 0]), [-q[0], -q[1], -q[2], q[3]]);
  return [p[0], p[1], p[2]];
};
const qangle = (a, b) => {
  const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  return 2 * Math.acos(Math.min(1, d));
};
function slerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const s = d < 0 ? -1 : 1;
  d = Math.abs(d);
  if (d > 0.9995) {
    const r = a.map((v, i) => v + t * (s * b[i] - v));
    const n = Math.hypot(...r);
    return r.map((v) => v / n);
  }
  const th = Math.acos(d);
  const wa = Math.sin((1 - t) * th) / Math.sin(th);
  const wb = (s * Math.sin(t * th)) / Math.sin(th);
  return a.map((v, i) => wa * v + wb * b[i]);
}

/** One file's node tree and its clips as samplers by node name and path. */
function load(file) {
  const doc = readGlb(file);
  const nodes = doc.json.nodes;
  const parent = new Map();
  nodes.forEach((n, i) => (n.children || []).forEach((c) => parent.set(c, i)));
  const byName = new Map(nodes.map((n, i) => [n.name, i]));
  const clips = new Map();
  if (!doc.json.animations?.length) throw new Error(`${file} has no animations`);
  for (const anim of doc.json.animations) {
    const tracks = new Map();
    for (const ch of anim.channels) {
      const smp = anim.samplers[ch.sampler];
      const interpolation = smp.interpolation ?? 'LINEAR';
      if (interpolation !== 'LINEAR' && interpolation !== 'STEP') throw new Error(`${file}: ${anim.name} has ${interpolation} interpolation`);
      tracks.set(`${nodes[ch.target.node].name}.${ch.target.path}`, { times: readAccessor(doc, smp.input), values: readAccessor(doc, smp.output), path: ch.target.path, step: interpolation === 'STEP' });
    }
    const duration = Math.max(...[...tracks.values()].map((t) => t.times[t.times.length - 1]));
    clips.set(anim.name, { tracks, duration });
  }
  return { nodes, parent, byName, clips };
}

function sample(track, t) {
  const { times, values, path, step } = track;
  const n = path === 'rotation' ? 4 : 3;
  const at = (i) => Array.from(values.subarray(i * n, i * n + n));
  if (t <= times[0]) return at(0);
  if (t >= times[times.length - 1]) return at(times.length - 1);
  let i = 1;
  while (times[i] < t) i++;
  if (step) return at(times[i] === t ? i : i - 1);
  const u = (t - times[i - 1]) / (times[i] - times[i - 1]);
  const a = at(i - 1);
  const b = at(i);
  return path === 'rotation' ? slerp(a, b, u) : a.map((v, k) => v + u * (b[k] - v));
}

/**
 * The node's rotation and position in the figure's space (the space of the file's root) at time t of a clip,
 * or rotation null when `needTrack` and the node or an ancestor has no rotation track in that clip (the shipped
 * exporter dropped every channel that held one value through a clip, so the file does not say that value).
 */
function figure(file, clip, name, t, needTrack, restOnly = false) {
  const chain = [];
  for (let i = file.byName.get(name); i !== undefined; i = file.parent.get(i)) chain.unshift(i);
  let q = [0, 0, 0, 1];
  let p = [0, 0, 0];
  let known = true;
  for (const i of chain) {
    const node = file.nodes[i];
    const rt = restOnly ? undefined : clip.tracks.get(`${node.name}.rotation`);
    const tt = restOnly ? undefined : clip.tracks.get(`${node.name}.translation`);
    if (!rt && needTrack && COMPARED.includes(node.name)) known = false;
    const lt = tt ? sample(tt, t) : node.translation ?? [0, 0, 0];
    const lq = rt ? sample(rt, t) : node.rotation ?? [0, 0, 0, 1];
    const off = qrot(q, lt);
    p = [p[0] + off[0], p[1] + off[1], p[2] + off[2]];
    q = qmul(q, lq);
  }
  return { q: known ? q : null, p };
}

function run() {
  const [builtPath, shippedPath] = process.argv.slice(2);
  if (!builtPath || !shippedPath) {
    console.error('usage: node scripts/models-clipcheck.mjs <built hero.glb> <shipped hero.glb>');
    process.exit(3);
  }
  const built = load(builtPath);
  const shipped = load(shippedPath);
  const absent = CLIPS.filter((c) => !shipped.clips.has(c));
  if (absent.length) throw new Error(`${shippedPath} lacks the clips ${absent.join(', ')}`);
  let failed = false;
  console.log(`clip | largest orientation difference (rad) | at | largest leg displacement difference | comparisons | skipped`);
  for (const [name, sClip] of shipped.clips) {
    const bClip = built.clips.get(name);
    if (!bClip) {
      console.log(`${name} | MISSING in the built file`);
      failed = true;
      continue;
    }
    if (Math.abs(bClip.duration - sClip.duration) > 1e-4) {
      console.log(`${name} | length ${bClip.duration} s against shipped ${sClip.duration} s`);
      failed = true;
    }
    let worst = 0;
    let worstAt = '-';
    let worstLeg = 0;
    let compared = 0;
    const skipped = new Set();
    for (let k = 0; k < SAMPLES; k++) {
      const t = (k * sClip.duration) / (SAMPLES - 1);
      for (const bone of COMPARED) {
        if (name === 'SpinSlash' && SPIN_EXCEPT.has(bone)) continue;
        const s = figure(shipped, sClip, bone, t, true);
        if (!s.q) {
          skipped.add(bone);
          continue;
        }
        const d = qangle(figure(built, bClip, bone, t, false).q, s.q);
        compared++;
        if (d > worst) {
          worst = d;
          worstAt = `${bone} ${t.toFixed(3)} s`;
        }
      }
      for (const leg of LEGS) {
        const bRest = figure(built, bClip, leg, t, false, true).p;
        const b = figure(built, bClip, leg, t, false).p;
        const track = sClip.tracks.get(`${leg}.translation`);
        const sDisp = track ? sample(track, t).map((v, i) => v - SHIPPED_LEG_REST[leg][i]) : [0, 0, 0];
        const d = Math.hypot(b[0] - bRest[0] - sDisp[0], b[1] - bRest[1] - sDisp[1], b[2] - bRest[2] - sDisp[2]);
        worstLeg = Math.max(worstLeg, d);
      }
    }
    const pass = worst <= ROT_TOL && worstLeg <= POS_TOL;
    if (!pass) failed = true;
    console.log(`${name} | ${worst.toFixed(4)} | ${worstAt} | ${worstLeg.toFixed(4)} | ${compared} | ${[...skipped].sort().join(', ') || 'none'} | ${pass ? 'pass' : 'FAIL'}`);
  }
  console.log(failed ? 'clip check FAILED' : 'clip check passed');
  process.exit(failed ? 1 : 0);
}

try {
  run();
} catch (err) {
  console.error(`Refused: ${err.message}`);
  process.exit(3);
}
