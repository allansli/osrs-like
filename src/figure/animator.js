// The starter man's animation: phase-synced blend spaces by speed and direction, start, stop,
// turn and jump clips that carry their own root motion, idle variations, a lean into turns,
// and foot placement on the ground under each foot.
//
// Every looping clip is measured once at load (feet relative to the root, 30 samples a second)
// so that (1) all loops share one gait phase, with 0 at the left foot's heel strike, and the
// blend advances that phase by distance travelled over the blended stride: feet don't slide
// whatever the mix of clips and the speed; (2) a clip entered from another starts at the moment
// whose feet best match the pose he's in: no snap.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const TAU = Math.PI * 2;
const wrap = (a) => ((a % 1) + 1) % 1;
const angleWrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const damp = (a, b, rate, dt) => b + (a - b) * Math.exp(-rate * dt);
const clamp = THREE.MathUtils.clamp;

// Clip choices, blendi's picks across two pages (tools/make_clips.mjs copies them unchanged). Free
// movement turns him to face where he goes; strafe faces the camera.
export const SETUP = {
  idle: 'Idle',
  // standing still: UAL's idle (weight on one leg, breathing) calmed by anymove's upright one
  idleMix: [['Idle', 0.4], ['AM_Idle', 0.6]],
  walk: 'Walk', // UAL; 'AM_Walk' is anymove's
  run: 'Run', // anymove page's, as is, not the starter page's baked AM_Run
  sprint: 'Sprint', // anymove page's, as is
  // strafe sets: [angle (deg, + = his left), walk clip, jog clip]
  strafe: [[0, 'Walk', 'Jog'], [45, 'Walk_Fwd_L', 'Jog_Fwd_L'], [90, 'Walk_L', 'Jog_L'], [135, 'Walk_Bwd_L', 'Walk_Bwd_L'], [180, 'Walk_Bwd', 'Walk_Bwd'], [-135, 'Walk_Bwd_R', 'Walk_Bwd_R'], [-90, 'Walk_R', 'Jog_R'], [-45, 'Walk_Fwd_R', 'Jog_Fwd_R']],
  // game speeds (m/s) the blend anchors sit at
  speeds: { walk: 1.45, run: 5.3, sprint: 7.0, strafeWalk: 1.45, strafeJog: 3.6 },
};

// the clips that came from the anymove page: their hands come with them
const ANYMOVE_HANDS = /^(Run|Sprint|Idle_Tired|Idle_To_Run|Idle_To_Sprint|Run_To_Idle|Sprint_To_Idle)$/;

export class Animator {
  constructor(man, setup = SETUP) {
    this.man = man;
    this.setup = setup;
    this.object = man.object;
    this.bones = man.bones;
    this.mixer = new THREE.AnimationMixer(this.object);
    this.info = {};
    this.analyze();
    // two actions per clip: the current layer and the one fading out may both use a clip
    this.actions = [{}, {}, {}];
    for (const [name, clip] of Object.entries(man.clips)) {
      for (let k = 0; k < 3; k++) {
        const a = this.mixer.clipAction(k ? clip.clone() : clip);
        a.play(); a.setEffectiveWeight(0); a.timeScale = 0;
        this.actions[k][name] = a;
      }
    }
    this.layers = []; // [{ state, weight, fade, slot }]
    this.phase = 0;
    this.freeSpeed = 0;
    this.lean = 0;
    this.idleTime = 0;
    this.tired = 0;
    this.sprintTime = 0;
    this.ik = { l: 0, r: 0, pelvis: 0, on: true };
    this.debug = {};
    this.idleClip = setup.idle;
    this.spineRest = ['spine_01', 'spine_02', 'spine_03'].map((n) => this.bones[n].quaternion.clone()); // bind pose
    this.object.updateMatrixWorld(true);
    this.restShoulderX = Math.abs(this.bones.upperarm_l.getWorldPosition(new THREE.Vector3()).x - this.object.position.x); // T-pose, before any clip
    this.enter(this.locoState({ strafe: false }));
  }

  // --- measuring the clips ------------------------------------------------------------------
  analyze() {
    const rig = SkeletonUtils.clone(this.object);
    const mixer = new THREE.AnimationMixer(rig);
    const bones = {}; rig.traverse((o) => { if (o.isBone) bones[o.name] = o; });
    rig.updateMatrixWorld(true);
    const inv = new THREE.Matrix4(), p = new THREE.Vector3();
    for (const [name, raw] of Object.entries(this.man.raw)) {
      const clip = this.man.clips[name];
      const a = mixer.clipAction(raw); a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; a.play();
      const n = Math.max(2, Math.round(clip.duration * 30) + 1);
      const feet = { l: [], r: [], lw: [], rw: [], pelvis: [] };
      for (let i = 0; i < n; i++) {
        mixer.setTime((i / (n - 1)) * clip.duration);
        rig.updateMatrixWorld(true);
        inv.copy(bones.root.matrixWorld).invert();
        for (const s of ['l', 'r']) {
          bones[`foot_${s}`].getWorldPosition(p);
          feet[s + 'w'].push(p.clone()); // with root travel: world, for stance detection
          feet[s].push(p.clone().sub(new THREE.Vector3().setFromMatrixPosition(bones.root.matrixWorld))); // relative to root, character space
        }
        bones.pelvis.getWorldPosition(p); feet.pelvis.push(p.y);
      }
      a.stop(); mixer.uncacheAction(raw);
      const info = { n, duration: clip.duration, feet, offset: 0, stride: this.man.motion[name].speed * clip.duration };
      // phase 0 = left heel strike: start of the longest run of slow left-foot frames
      if (/Walk|Jog|Run|Sprint/.test(name) && !/To_/.test(name)) {
        const sp = [];
        for (let i = 0; i < n - 1; i++) sp.push(feet.lw[i + 1].distanceTo(feet.lw[i]) * 30);
        const sorted = sp.slice().sort((x, y) => x - y);
        const slow = sorted[Math.floor(sorted.length * 0.4)] * 1.05 + 0.05;
        let best = 0, bestLen = 0;
        for (let i = 0; i < sp.length; i++) {
          if (sp[i] > slow || sp[(i - 1 + sp.length) % sp.length] <= slow) continue;
          let len = 0; while (len < sp.length && sp[(i + len) % sp.length] <= slow) len++;
          if (len > bestLen) { bestLen = len; best = i; }
        }
        info.offset = best / (n - 1);
        info.stance = bestLen / (n - 1);
      }
      // jumps: the frame the hips rise fastest (take-off), and the landing's first squash
      if (name === 'Jump_Start') {
        let best = 0, bv = -Infinity;
        for (let i = 1; i < n; i++) { const v = feet.pelvis[i] - feet.pelvis[i - 1]; if (v > bv) { bv = v; best = i; } }
        info.launch = Math.max(0, (best - 3) / (n - 1));
      }
      if (name === 'Jump_Land') info.contact = 0;
      this.info[name] = info;
    }
    this.postureFix = this.measurePosture(rig, bones, mixer);
    rig.traverse((o) => o.geometry?.dispose?.());
  }

  /** Shoulders' forward offset from the ankles in the standing idle (m, + = in front). */
  shouldersForward(rig, bones, mixer, fix) {
    const S = this.setup, mix = S.idleMix ?? [[S.idle, 1]];
    const acts = mix.map(([c, w]) => { const a = mixer.clipAction(this.man.clips[c]); a.play(); a.setEffectiveWeight(w); return a; });
    let sum = 0;
    const p = (n) => bones[n].getWorldPosition(new THREE.Vector3());
    for (const t of [0.1, 0.4, 0.7]) {
      acts.forEach((a) => { a.time = t * a.getClip().duration; });
      mixer.update(0); rig.updateMatrixWorld(true);
      this.applyPosture(bones, rig, fix);
      sum += (p('upperarm_l').z + p('upperarm_r').z) / 2 - (p('foot_l').z + p('foot_r').z) / 2;
    }
    acts.forEach((a) => { a.stop(); mixer.uncacheAction(a.getClip()); });
    return sum / 3;
  }

  /** Finds collarbone and spine amounts that bring the idle's shoulders over the feet (2 cm ahead). */
  measurePosture(rig, bones, mixer) {
    const target = 0.02;
    const before = this.shouldersForward(rig, bones, mixer, null);
    let k = Math.max(0, before - target), fix = { spine: 0, clavicle: 0 }, after = before;
    for (let i = 0; i < 4; i++) {
      // half from the collarbones (about 18 cm long), half from the upper spine (shoulders ~35 cm above)
      fix = { spine: THREE.MathUtils.clamp(Math.atan2(k * 0.5, 0.35), 0, 0.16), clavicle: THREE.MathUtils.clamp(Math.asin(Math.min(1, (k * 0.5) / 0.18)), 0, 0.4) };
      after = this.shouldersForward(rig, bones, mixer, fix);
      k += after - target;
      if (Math.abs(after - target) < 0.005) break;
    }
    this.postureReport = { before: +(before * 100).toFixed(1), after: +(after * 100).toFixed(1), spineDeg: +THREE.MathUtils.radToDeg(fix.spine).toFixed(1), clavicleDeg: +THREE.MathUtils.radToDeg(fix.clavicle).toFixed(1) };
    return fix;
  }

  /** Feet (relative to root) of clip `name` at normalized time u. */
  feetAt(name, u) {
    const f = this.info[name].feet, n = this.info[name].n;
    const i = clamp(Math.round(wrap(u) * (n - 1)), 0, n - 1);
    return [f.l[i], f.r[i]];
  }

  /** Where he is now: feet relative to the root bone, in character space. */
  currentFeet() {
    this.object.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.object.matrixWorld).invert();
    const r = new THREE.Vector3().setFromMatrixPosition(this.bones.root.matrixWorld).applyMatrix4(inv);
    return ['l', 'r'].map((s) => this.bones[`foot_${s}`].getWorldPosition(new THREE.Vector3()).applyMatrix4(inv).sub(r));
  }

  /** The normalized time in `name` (between from and to) whose feet best match `feet`. */
  match(name, feet, from = 0, to = 1) {
    const info = this.info[name];
    let best = from, bestD = Infinity;
    for (let i = 0; i < info.n; i++) {
      const u = i / (info.n - 1);
      if (u < from || u > to) continue;
      const d = info.feet.l[i].distanceToSquared(feet[0]) + info.feet.r[i].distanceToSquared(feet[1]);
      if (d < bestD) { bestD = d; best = u; }
    }
    return best;
  }

  /** The gait phase whose feet best match `feet`, for clip `name` (a loop). */
  matchPhase(name, feet) {
    return wrap(this.match(name, feet) - this.info[name].offset);
  }

  // --- states -------------------------------------------------------------------------------
  // A state returns, each frame, the clips it plays: [{ clip, time, w }], weights summing to 1.
  enter(state, fade = 0.2) {
    for (const l of this.layers) l.fade = Math.max(l.fade ?? 0, fade);
    const used = new Set(this.layers.map((l) => l.slot));
    const free = [0, 1, 2].find((k) => !used.has(k));
    const slot = free ?? this.layers.shift().slot;
    this.layers.push({ state, weight: this.layers.length ? 0 : 1, fade, slot, rising: true });
    this.state = state;
    return state;
  }

  /** The locomotion blend, turning to face his way or strafing. */
  locoState(opts) {
    const st = { kind: 'loco', ...opts };
    // while it fades out under a stop or turn it keeps the speed it last had: the stop's first frame
    // reports speed 0, which turned the fading run into idle for a frame (the knee snapped straight)
    st.sample = (ctx, dt) => {
      const live = this.state === st;
      if (live || !st.last) st.last = { speed: ctx.speed, moveAngle: ctx.moveAngle };
      return this.sampleLoco({ ...ctx, ...st.last, strafe: st.strafe }, dt, live);
    };
    return st;
  }

  // the gait: phase advanced by distance over stride, so feet stay planted at any mix
  sampleLoco(ctx, dt, advance = true) {
    const S = this.setup, sp = S.speeds;
    const v = ctx.speed; // actual horizontal speed, m/s
    const out = [];
    const add = (clip, w, synced = true) => {
      if (w <= 1e-4) return;
      // standing idle eases between calm and out of breath
      if (clip === this.idleClip) {
        const k = this.tiredMix ?? 0;
        if (1 - k > 1e-3) for (const [c, cw] of S.idleMix ?? [[S.idle, 1]]) out.push({ clip: c, w: w * cw * (1 - k), synced: false });
        if (k > 1e-3) out.push({ clip: 'Idle_Tired', w: w * k, synced: false });
        return;
      }
      out.push({ clip, w, synced });
    };
    if (advance) this.tiredMix = damp(this.tiredMix ?? 0, this.tired ? 1 : 0, 1.2, dt);
    if (!ctx.strafe) {
      const k = [[0, S.idle], [sp.walk, S.walk], [sp.run, S.run], [sp.sprint, S.sprint]];
      if (v <= 0) add(this.idleClip, 1, false);
      else {
        let i = 0; while (i < k.length - 2 && v > k[i + 1][0]) i++;
        const t = clamp((v - k[i][0]) / (k[i + 1][0] - k[i][0]), 0, 1);
        add(i === 0 ? this.idleClip : k[i][1], 1 - t, i > 0); add(k[i + 1][1], t, true);
      }
    } else {
      // strafe: speed blend between the walk ring and the jog ring, direction within each ring
      const walkW = clamp(v / sp.strafeWalk, 0, 1);
      const jogT = clamp((v - sp.strafeWalk) / (sp.strafeJog - sp.strafeWalk), 0, 1);
      add(this.idleClip, 1 - walkW, false);
      this.dirBlend(S.strafe.map(([a, w]) => [a, w]), ctx.moveAngle, walkW * (1 - jogT), add);
      this.dirBlend(S.strafe.map(([a, , j]) => [a, j]), ctx.moveAngle, walkW * jogT, add);
    }
    // merge repeats and advance the shared phase by the blended stride
    const merged = {};
    for (const o of out) (merged[o.clip] ??= { clip: o.clip, w: 0, synced: o.synced }).w += o.w;
    const list = Object.values(merged);
    let stride = 0, sw = 0;
    for (const o of list) if (o.synced) { stride += this.info[o.clip].stride * o.w; sw += o.w; }
    if (sw > 0 && advance) {
      stride /= sw;
      // phase runs at the speed of the moving clips even while idle fades out of the mix
      const cyc = stride > 0.05 ? v / stride : 0;
      this.phase = wrap(this.phase + cyc * dt);
    }
    for (const o of list) {
      const info = this.info[o.clip];
      o.time = o.synced ? wrap(this.phase + info.offset) * info.duration : (this.idleClock ?? 0) % info.duration;
    }
    if (advance) this.debug.loco = list.map((o) => `${o.clip}:${o.w.toFixed(2)}`).join(' ');
    return list;
  }

  // weights along a ring of directions [angle deg, clip]; adds w to the two either side of angle
  dirBlend(ring, angle, w, add) {
    if (w <= 1e-4) return;
    const deg = THREE.MathUtils.radToDeg(angleWrap(angle));
    const sorted = ring.map(([a, c]) => [((a % 360) + 360) % 360, c]).sort((x, y) => x[0] - y[0]);
    const d = ((deg % 360) + 360) % 360;
    for (let i = 0; i < sorted.length; i++) {
      const [a0, c0] = sorted[i], [a1raw, c1] = sorted[(i + 1) % sorted.length];
      const a1 = a1raw <= a0 ? a1raw + 360 : a1raw;
      const dd = d < a0 ? d + 360 : d;
      if (dd >= a0 && dd <= a1) { const t = (dd - a0) / (a1 - a0); add(c0, w * (1 - t)); add(c1, w * t); return; }
    }
  }

  /** A one-shot clip from normalized time `from`, at `rate`. Root motion is read by the player. */
  oneShot(kind, clip, { from = 0, to = 1, rate = 1, loop = false, then = null } = {}) {
    const info = this.info[clip];
    const st = { kind, clip, u: from, prevU: from, to, rate, loop, done: false, then };
    st.sample = (ctx, dt) => {
      st.prevU = st.u;
      st.u += (dt * rate) / info.duration;
      if (st.u >= to) { if (loop) st.u = from + wrap((st.u - from) / (to - from)) * (to - from); else { st.u = to; st.done = true; } }
      return [{ clip, w: 1, time: st.u * info.duration }];
    };
    return st;
  }

  // --- each frame ---------------------------------------------------------------------------
  update(dt, ctx) {
    this.idleClock = (this.idleClock ?? 0) + dt;
    // layers fade: the newest rises, the rest fall
    for (const l of this.layers) {
      const k = dt / Math.max(1e-3, l.fade);
      l.weight = l === this.layers[this.layers.length - 1] ? Math.min(1, l.weight + k) : Math.max(0, l.weight - k);
    }
    this.layers = this.layers.filter((l, i) => l.weight > 0 || i === this.layers.length - 1);
    let total = this.layers.reduce((s, l) => s + l.weight, 0) || 1;
    // the weights each action gets this frame
    const want = [new Map(), new Map(), new Map()];
    for (const l of this.layers) {
      const parts = l.state.sample(ctx, dt);
      for (const p of parts) {
        const m = want[l.slot];
        const e = m.get(p.clip) ?? { w: 0, time: p.time };
        e.w += (p.w * l.weight) / total; e.time = p.time;
        m.set(p.clip, e);
      }
    }
    // what's playing, for marks and the HUD: [clip, weight, time]
    this.lastMix = [];
    for (let k = 0; k < 3; k++) for (const [name, e] of want[k]) if (e.w > 0.005) this.lastMix.push([name, +e.w.toFixed(3), +e.time.toFixed(3)]);
    this.lastMix.sort((a, b) => b[1] - a[1]);
    for (let k = 0; k < 3; k++) for (const [name, a] of Object.entries(this.actions[k])) {
      const e = want[k].get(name);
      if (e) { a.setEffectiveWeight(e.w); a.time = e.time; } else a.setEffectiveWeight(0);
    }
    this.mixer.update(0);
    this.object.updateMatrixWorld(true);
    this.evenSpine(this.bones);
    this.applyPosture(this.bones, this.object, this.postureFix);
    this.object.updateMatrixWorld(true);
  }

  /**
   * Spreads the spine's bend evenly over its three joints. MakeHuman's spine joints sit low and
   * close together with a long chest above them, so a bend the clips put mostly in one joint
   * (Idle_Tired's hands-on-knees) read as a straight lower back kinking into a bent upper back.
   * The chest ends where the clip put it; only the curve between hips and chest changes.
   */
  evenSpine(bones) {
    if (this.spineOn === false) return;
    const chain = [bones.spine_01, bones.spine_02, bones.spine_03];
    const rel = new THREE.Quaternion(), total = new THREE.Quaternion(), restTotal = new THREE.Quaternion();
    for (let i = 0; i < 3; i++) { total.multiply(chain[i].quaternion); restTotal.multiply(this.spineRest[i]); }
    // the whole chain's turn away from its rest, shared out a third at a time
    rel.copy(restTotal).invert().multiply(total);
    const ident = new THREE.Quaternion();
    const parts = [ident.clone().slerp(rel, 1 / 3), ident.clone().slerp(rel, 2 / 3), rel.clone()];
    // local rotations whose running product is restTotal-so-far times part^k
    let built = new THREE.Quaternion(), restSoFar = new THREE.Quaternion();
    for (let i = 0; i < 3; i++) {
      restSoFar.multiply(this.spineRest[i]);
      const target = restSoFar.clone().multiply(parts[i]); // where the chain should be by joint i
      chain[i].quaternion.copy(built.clone().invert().multiply(target));
      built = target;
    }
  }

  /**
   * Upright shoulders. MakeHuman bodies carry their shoulders further forward on the spine than
   * UAL's mannequin, and the clips keep that offset, so he stood hunched (shoulders 12 cm ahead of
   * his ankles in the idle, against the mannequin's 0). Collarbones turn back and a little down,
   * the upper spine opens, the neck gives the head back its angle. Amounts are measured per body.
   */
  applyPosture(bones, object, fix) {
    if (!fix || this.postureOn === false) return;
    const q = object.quaternion;
    const up = new THREE.Vector3(0, 1, 0), right = new THREE.Vector3(-1, 0, 0).applyQuaternion(q), fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const rot = (b, axis, a) => {
      const qa = new THREE.Quaternion().setFromAxisAngle(axis, a);
      const pq = b.parent.getWorldQuaternion(new THREE.Quaternion()), wq = b.getWorldQuaternion(new THREE.Quaternion());
      b.quaternion.copy(pq.invert().multiply(qa.multiply(wq)));
      b.updateMatrixWorld(true);
    };
    // + about his right axis leans a bone back
    rot(bones.spine_02, right, fix.spine * 0.5);
    rot(bones.spine_03, right, fix.spine * 0.5);
    rot(bones.neck_01, right, -fix.spine * 0.85);
    rot(bones.clavicle_l, up, fix.clavicle);
    rot(bones.clavicle_r, up, -fix.clavicle);
    rot(bones.clavicle_l, fwd, -fix.clavicle * 0.25);
    rot(bones.clavicle_r, fwd, fix.clavicle * 0.25);
    // the arms keep their own swing: turning the collarbones back also turned the arm swing 23
    // degrees in towards the body, and running elbows went into his sides (blendi)
    rot(bones.upperarm_l, fwd, fix.clavicle * 0.25);
    rot(bones.upperarm_r, fwd, -fix.clavicle * 0.25);
    rot(bones.upperarm_l, up, -fix.clavicle);
    rot(bones.upperarm_r, up, fix.clavicle);
  }

  /**
   * Elbows stay clear of his sides: each elbow is kept at least 86% of the shoulder joints' half
   * width out from his centre line (sideways, in his own frame), by lifting the upper arm out.
   */
  armClearance(dt) {
    const b = this.bones, o = this.object;
    if (this.armMin == null) this.armMin = this.restShoulderX * 0.86;
    const inv = new THREE.Matrix4().copy(o.matrixWorld).invert();
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(o.quaternion);
    const loc = (n) => b[n].getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
    const mid = loc('spine_03').x;
    this.armPush = this.armPush ?? { l: 0, r: 0 };
    for (const [s, sign] of [['l', 1], ['r', -1]]) {
      const sh = loc(`upperarm_${s}`), el = loc(`lowerarm_${s}`);
      const out = (el.x - mid) * sign; // + = out to his side
      const len = sh.distanceTo(el) || 0.27;
      const need = clamp(Math.asin(clamp((this.armMin - out) / len, 0, 0.9)), 0, 0.6);
      this.armPush[s] = need > this.armPush[s] ? need : damp(this.armPush[s], need, 6, dt);
      if (this.armPush[s] > 1e-4) this.rotateWorld(b[`upperarm_${s}`], fwd, this.armPush[s] * sign);
    }
  }

  // --- after the clips: lean, hands and feet --------------------------------------------------
  /**
   * Relaxed hands: UAL's walk and idle clench fists, anymove's clips carry no fingers at all.
   * Every finger goes to a curl between flat (the rest pose) and the idle's fist: loose when
   * standing and walking, firmer as he runs. The anymove page's clips keep that page's hands, as
   * read from it (hands-anymove.json), in proportion to their weight in the mix.
   */
  relaxHands(speed, weight = 1) {
    if (!this.fingerPoses) {
      this.fingerPoses = [];
      const flat = this.man.raw.TPose, fist = this.man.raw.Idle;
      for (const name of Object.keys(this.bones)) {
        if (!/^(index|middle|ring|pinky|thumb)_0[123]_[lr]$/.test(name)) continue;
        const a = flat.tracks.find((t) => t.name === `${name}.quaternion`), b = fist.tracks.find((t) => t.name === `${name}.quaternion`);
        if (!a || !b) continue;
        const o = this.man.hands[name];
        this.fingerPoses.push({ bone: this.bones[name], flat: new THREE.Quaternion().fromArray(a.values, 0), fist: new THREE.Quaternion().fromArray(b.values, 0), oflat: new THREE.Quaternion().fromArray(o.flat), ofist: new THREE.Quaternion().fromArray(o.fist), thumb: name.startsWith('thumb') });
      }
    }
    const k = THREE.MathUtils.lerp(0.42, 0.72, clamp((speed - 2) / 4, 0, 1));
    const share = clamp((this.lastMix ?? []).reduce((s, [c, w]) => s + (ANYMOVE_HANDS.test(c) ? w : 0), 0), 0, 1);
    const q = new THREE.Quaternion(), o = new THREE.Quaternion();
    for (const f of this.fingerPoses) {
      q.slerpQuaternions(f.flat, f.fist, f.thumb ? k * 0.8 : k);
      if (share > 0) { o.slerpQuaternions(f.oflat, f.ofist, f.thumb ? k * 0.8 : k); q.slerp(o, share); }
      f.bone.quaternion.slerp(q, weight);
    }
  }

  rotateWorld(bone, axis, angle) {
    const q = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    const parentQ = bone.parent.getWorldQuaternion(new THREE.Quaternion());
    const worldQ = bone.getWorldQuaternion(new THREE.Quaternion());
    bone.quaternion.copy(parentQ.invert().multiply(q.multiply(worldQ)));
    bone.updateMatrixWorld(true);
  }

  /** Head and neck turn toward where the camera looks (within reach), easing in and out. */
  lookToward(dt, dirWorld, weight) {
    const inv = new THREE.Quaternion().copy(this.object.quaternion).invert();
    const d = dirWorld.clone().applyQuaternion(inv);
    const yaw = clamp(Math.atan2(d.x, d.z), -1.0, 1.0);
    const behind = Math.abs(Math.atan2(d.x, d.z)) > 1.9; // looking back at him: face forward
    const pitch = clamp(Math.asin(clamp(d.y, -1, 1)) * 0.5, -0.2, 0.3); // + looks up
    this.look = this.look ?? { yaw: 0, pitch: 0 };
    this.look.yaw = damp(this.look.yaw, behind ? 0 : yaw * weight, 5, dt);
    this.look.pitch = damp(this.look.pitch, behind ? 0 : (pitch + 0.08) * weight, 5, dt);
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3(-1, 0, 0).applyQuaternion(this.object.quaternion).applyAxisAngle(up, this.look.yaw);
    for (const [b, k] of [['spine_03', 0.2], ['neck_01', 0.35], ['Head', 0.45]]) {
      this.rotateWorld(this.bones[b], up, this.look.yaw * k);
      this.rotateWorld(this.bones[b], right, this.look.pitch * k);
    }
  }

  /**
   * Keeps his trunk about as upright as a person's at that speed (a few degrees walking, about 11
   * running, 14 sprinting): on this body the run clips lean 23-29 degrees and round the shoulders
   * (blendi: shoulders too far forward while running). Measured each frame, eased.
   */
  uprightTrunk(dt, speed, weight = 1) {
    if (this.uprightOn === false) return;
    const b = this.bones, q = this.object.quaternion;
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q), right = new THREE.Vector3(-1, 0, 0).applyQuaternion(q);
    const trunk = b.neck_01.getWorldPosition(new THREE.Vector3()).sub(b.pelvis.getWorldPosition(new THREE.Vector3()));
    const lean = Math.atan2(trunk.dot(fwd), trunk.y);
    const k = [[0, 4], [1.45, 6], [5.3, 11], [7, 14]];
    let want = k[k.length - 1][1];
    for (let i = 0; i < k.length - 1; i++) if (speed <= k[i + 1][0]) { want = k[i][1] + ((speed - k[i][0]) / (k[i + 1][0] - k[i][0])) * (k[i + 1][1] - k[i][1]); break; }
    // only while he moves: standing poses that bend on purpose (catching his breath) keep their bend
    const moving = clamp((speed - 0.4) / 1.0, 0, 1);
    const extra = clamp(lean - THREE.MathUtils.degToRad(want), 0, THREE.MathUtils.degToRad(22)) * weight * moving;
    this.upright = damp(this.upright ?? 0, extra, 8, dt);
    // the spine joints sit low on this body, so they turn a little more than the lean they remove
    for (const n of ['spine_01', 'spine_02', 'spine_03']) this.rotateWorld(b[n], right, this.upright * 0.45);
    this.rotateWorld(b.neck_01, right, -this.upright * 0.45); // the head keeps looking ahead
  }

  leanInto(dt, turnRate, speed, forwardAccel) {
    const target = clamp(-turnRate * speed * 0.035, -0.22, 0.22);
    this.lean = damp(this.lean, target, 6, dt);
    this.pitchLean = damp(this.pitchLean ?? 0, clamp(forwardAccel * 0.012, -0.08, 0.1), 5, dt);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.object.quaternion);
    const right = new THREE.Vector3(-1, 0, 0).applyQuaternion(this.object.quaternion);
    // roll the whole body about the feet line a little, the spine a little more
    for (const [b, k] of [['spine_01', 0.35], ['spine_02', 0.35], ['spine_03', 0.3]]) {
      this.rotateWorld(this.bones[b], fwd, this.lean * k);
      this.rotateWorld(this.bones[b], right, -this.pitchLean * k); // speeding up leans him forward
    }
  }

  /** Two-bone IK: moves the ankle of `side` by `delta` (world), knee bending in its own plane. */
  legIK(side, delta) {
    const hip = this.bones[`thigh_${side}`], knee = this.bones[`calf_${side}`], foot = this.bones[`foot_${side}`];
    const H = hip.getWorldPosition(new THREE.Vector3()), K = knee.getWorldPosition(new THREE.Vector3()), A = foot.getWorldPosition(new THREE.Vector3());
    const footQ = foot.getWorldQuaternion(new THREE.Quaternion());
    const T = A.clone().add(delta);
    const l1 = H.distanceTo(K), l2 = K.distanceTo(A);
    const toT = T.clone().sub(H);
    const d = clamp(toT.length(), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
    toT.setLength(d);
    // the bend plane: hip, ankle and the knee as animated
    const axis = toT.clone().normalize();
    // the knee bends in its animated plane, but always forward: on a high step or the edge of a
    // platform the animated knee can lie behind the hip-ankle line and the leg would invert
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.object.quaternion);
    const pole = K.clone().sub(H); pole.sub(axis.clone().multiplyScalar(pole.dot(axis)));
    const fwdP = fwd.clone().sub(axis.clone().multiplyScalar(fwd.dot(axis))).normalize();
    // blended in smoothly as the animated knee turns away from forward, so it never switches over
    const along = pole.lengthSq() < 1e-6 ? -1 : pole.clone().normalize().dot(fwdP);
    const pull = clamp((0.5 - along) / 0.7, 0, 1);
    pole.normalize().multiplyScalar(1 - pull).addScaledVector(fwdP, pull * 1.2 + 1e-3);
    pole.normalize();
    const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
    const newK = H.clone().addScaledVector(axis, l1 * cosA).addScaledVector(pole, l1 * Math.sqrt(1 - cosA * cosA));
    // turn the thigh so the knee goes to newK, then the calf so the ankle goes to T
    const q1 = new THREE.Quaternion().setFromUnitVectors(K.clone().sub(H).normalize(), newK.clone().sub(H).normalize());
    this.rotateWorldQ(hip, q1);
    const K2 = knee.getWorldPosition(new THREE.Vector3()), A2 = foot.getWorldPosition(new THREE.Vector3());
    const q2 = new THREE.Quaternion().setFromUnitVectors(A2.clone().sub(K2).normalize(), H.clone().add(toT).sub(K2).normalize());
    this.rotateWorldQ(knee, q2);
    // the foot keeps its own world orientation
    const parentQ = foot.parent.getWorldQuaternion(new THREE.Quaternion());
    foot.quaternion.copy(parentQ.invert().multiply(footQ));
    foot.updateMatrixWorld(true);
  }

  rotateWorldQ(bone, q) {
    const parentQ = bone.parent.getWorldQuaternion(new THREE.Quaternion());
    const worldQ = bone.getWorldQuaternion(new THREE.Quaternion());
    bone.quaternion.copy(parentQ.invert().multiply(q.clone().multiply(worldQ)));
    bone.updateMatrixWorld(true);
  }

  /**
   * Feet on the ground: `ground(x, z, fromY)` returns { y, normal } or null. `rootY` is the height
   * the clips' flat floor sits at (his visual root). Lowers the hips for the lower foot, bends
   * the other leg, and tilts planted feet to the slope.
   */
  placeFeet(dt, ground, rootY, weight = 1) {
    const ik = this.ik;
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.object.quaternion);
    const res = {};
    for (const s of ['l', 'r']) {
      const ankle = this.bones[`foot_${s}`].getWorldPosition(new THREE.Vector3());
      const ball = this.bones[`ball_${s}`].getWorldPosition(new THREE.Vector3());
      // the ground under the heel and the ball: the higher one carries the foot
      const g1 = ground(ankle.x, ankle.z, rootY + 0.7), g2 = ground(ball.x, ball.z, rootY + 0.7);
      let gy = rootY, normal = new THREE.Vector3(0, 1, 0);
      if (g1 || g2) {
        const a = g1 ?? g2, b = g2 ?? g1;
        gy = Math.max(a.y, b.y);
        normal = a.normal.clone().add(b.normal).normalize();
      }
      // a planted foot sits on the ground under it; a foot in the air keeps its swing and is only
      // pushed up if it would go into the ground (lifting a swinging foot by the ramp's height
      // folded the leg and threw the knee out sideways: blendi, running up the ramp)
      const lift = ankle.y - rootY;
      const planted = clamp(1 - (lift - 0.11) / 0.1, 0, 1);
      const offPlanted = clamp(gy - rootY, -0.45, 0.45);
      const offSwing = clamp(gy + 0.1 - ankle.y, 0, 0.45);
      const off = (this.swingFix === false ? offPlanted : offPlanted * planted + offSwing * (1 - planted)) * weight;
      ik[s] = damp(ik[s], off, 18, dt);
      res[s] = { ankle, off: ik[s], normal, lift: ankle.y - rootY, ballLift: ball.y - rootY };
    }
    // foot lock: a foot flat on the floor in the clip stays where it landed until it lifts
    const lock = (this.lock ??= { l: null, r: null }), lockOff = (this.lockOff ??= { l: new THREE.Vector3(), r: new THREE.Vector3() });
    for (const s of ['l', 'r']) {
      const r = res[s];
      const planted = this.footLock !== false && weight > 0.5 && r.lift < 0.125 && r.ballLift < 0.055;
      if (planted) {
        if (!lock[s]) lock[s] = r.ankle.clone().sub(lockOff[s].clone().multiplyScalar(-1));
        let d = lock[s].clone().sub(r.ankle); d.y = 0;
        // past what the leg can comfortably reach: let the pin follow quickly, never snap
        if (d.length() > 0.2) { lock[s].lerp(r.ankle, Math.min(1, 12 * dt)); d = lock[s].clone().sub(r.ankle); d.y = 0; }
        lockOff[s].copy(d);
      } else {
        lock[s] = null;
        lockOff[s].multiplyScalar(Math.exp(-16 * dt));
      }
    }
    const pelvisDrop = Math.min(0, res.l.off, res.r.off);
    ik.pelvis = damp(ik.pelvis, pelvisDrop, 12, dt);
    if (!ik.on) return;
    const pelvis = this.bones.pelvis;
    const pw = pelvis.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, ik.pelvis, 0));
    pelvis.position.copy(pelvis.parent.worldToLocal(pw));
    pelvis.updateMatrixWorld(true);
    for (const s of ['l', 'r']) {
      const r = res[s];
      this.legIK(s, new THREE.Vector3(lockOff[s].x, r.off - ik.pelvis, lockOff[s].z));
      // tilt a planted foot to the slope (fades out as the foot lifts)
      const planted = clamp(1 - (r.lift - 0.09) / 0.12, 0, 1) * weight;
      const n = r.normal.clone();
      if (n.y < 0.75) n.lerp(new THREE.Vector3(0, 1, 0), 0.5).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      const ident = new THREE.Quaternion();
      ident.slerp(q, planted);
      this.rotateWorldQ(this.bones[`foot_${s}`], ident);
    }
    // feet, for marks: world ankle, lift above the floor, pinned or not, how far the pin pulls it, ground offset
    this.feetInfo = Object.fromEntries(['l', 'r'].map((s) => [s, { ankle: res[s].ankle.toArray().map((v) => +v.toFixed(3)), lift: +res[s].lift.toFixed(3), pinned: !!lock[s], pull: +lockOff[s].length().toFixed(3), ground: +res[s].off.toFixed(3) }]));
    this.feetInfo.hips = +ik.pelvis.toFixed(3);
    this.debug.ik = `L ${(res.l.off * 100).toFixed(0)} R ${(res.r.off * 100).toFixed(0)} hips ${(ik.pelvis * 100).toFixed(0)} cm`;
  }
}
