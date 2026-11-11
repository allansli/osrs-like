// Patch's starter man: loads the character and his clips, ready for an AnimationMixer.
//   const man = await loadMan({ base: '/starter-character/assets/' });
//   scene.add(man.object); const mixer = new THREE.AnimationMixer(man.object);
//   mixer.clipAction(man.clips.Walk).play();
// Clips come in place: their ground travel (the `root` bone's track) is taken out and kept as
// `man.motion[name]` (metres a second, local to the character, +Z forward), so the game moves
// him and plays each clip at the rate that matches his real speed. Turns in place keep their
// root turn as `man.motion[name].yaw` (radians over the clip).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function loadMan({ base = './assets/', man = 'starter-man.glb', clips = 'starter-man-clips.glb', onProgress } = {}) {
  const loader = new GLTFLoader();
  // onProgress(0..1): how much of the two files has arrived
  const got = [0, 0], size = [6.3e6, 19.9e6];
  const tell = (i) => (e) => { got[i] = e.loaded; if (e.total) size[i] = e.total; onProgress?.(Math.min(1, (got[0] + got[1]) / (size[0] + size[1]))); };
  const [m, c] = await Promise.all([loader.loadAsync(base + man, tell(0)), loader.loadAsync(base + clips, tell(1))]);
  const object = m.scene;
  const meshes = [];
  object.traverse((o) => {
    if (o.isSkinnedMesh) {
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      meshes.push(o);
    }
  });
  const bones = {};
  object.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  const hands = await (await fetch(new URL('./hands-anymove.json', import.meta.url))).json();
  const out = { object, meshes, bones, clips: {}, motion: {}, raw: {}, hands };
  for (const clip of c.animations) {
    out.raw[clip.name] = clip;
    const root = clip.tracks.find((t) => t.name === 'root.position');
    const rootRot = clip.tracks.find((t) => t.name === 'root.quaternion');
    const motion = { speed: 0, velocity: new THREE.Vector3(), yaw: 0, duration: clip.duration };
    if (root) {
      const v = root.values, n = v.length;
      // root's parent is the Armature (glTF Y up), so its translation is in character space
      motion.velocity.set(v[n - 3] - v[0], 0, v[n - 1] - v[2]).divideScalar(clip.duration || 1);
      motion.speed = motion.velocity.length();
    }
    if (rootRot) {
      const v = rootRot.values, n = v.length;
      const q0 = new THREE.Quaternion().fromArray(v, 0), q1 = new THREE.Quaternion().fromArray(v, n - 4);
      const d = q1.multiply(q0.invert());
      // q1 * q0^-1 is the turn in root's parent space (the Armature, Y up)
      motion.yaw = 2 * Math.atan2(d.y, d.w);
    }
    out.motion[clip.name] = motion;
    // in place: drop root's tracks, so travel and turning come from the game
    out.clips[clip.name] = new THREE.AnimationClip(clip.name, clip.duration, clip.tracks.filter((t) => !t.name.startsWith('root.')));
  }
  return out;
}

/** Samples a raw clip's root track at time t: ground position (character space) and yaw. */
export function rootAt(clip, t, outPos = new THREE.Vector3()) {
  const tr = clip.tracks.find((x) => x.name === 'root.position');
  if (!tr) return outPos.set(0, 0, 0);
  const times = tr.times, v = tr.values;
  if (t <= times[0]) return outPos.set(v[0], 0, v[2]);
  const last = times.length - 1;
  if (t >= times[last]) return outPos.set(v[last * 3], 0, v[last * 3 + 2]);
  let i = 0;
  while (times[i + 1] < t) i++;
  const k = (t - times[i]) / (times[i + 1] - times[i]);
  return outPos.set(v[i * 3] + (v[i * 3 + 3] - v[i * 3]) * k, 0, v[i * 3 + 2] + (v[i * 3 + 5] - v[i * 3 + 2]) * k);
}
