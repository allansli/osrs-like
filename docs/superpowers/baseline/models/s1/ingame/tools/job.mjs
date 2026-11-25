// S3 capture job. env: OUT (dir), LABEL, STEPS (comma list of perf,poses,leak,clips,close)
import { writeFileSync, mkdirSync } from 'node:fs';
const OUT = process.env.OUT;
const LABEL = process.env.LABEL;
const STEPS = (process.env.STEPS || 'perf,cost,poses,leak,clips,close').split(',');
const CAMP = { place: 'three_kettle_camp', yaw: 0, pitch: 0.3, distance: 8.5 };
const G_ = () => window.__DEBUG.G;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const HELPERS = () => {
  const D = window.__DEBUG, G = D.G, T = D.THREE;
  const S3 = (window.S3 = {}); window.G_ = () => G;
  S3.ents = () => {
    const ms = G.monstersList;
    return { raider: ms.filter((m) => m.typeKey === 'goblin'), archers: ms.filter((m) => m.typeKey === 'goblin_archer') };
  };
  S3.skinnedCount = () => G.monstersList.filter((m) => { let s = false; m.rig.group.traverse((o) => { if (o.isSkinnedMesh) s = true; }); return s; }).length;
  S3.basis = () => {
    const P = D.player.pos, c = G.camera.position;
    let fx = P.x - c.x, fz = P.z - c.z; const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
    return { P, c, fwd: { x: fx, z: fz }, right: { x: -fz, z: fx } };
  };
  S3.place = (m, rx, fz, hold) => {
    const b = S3.basis();
    const x = b.P.x + b.right.x * rx + b.fwd.x * fz, z = b.P.z + b.right.z * rx + b.fwd.z * fz;
    m.pos.set(x, D.getTerrainHeight(x, z), z);
    m.rig.group.rotation.set(0, Math.atan2(b.c.x - x, b.c.z - z) + Math.PI, 0);
    m.rig.group.visible = true;
    m.__hold = hold;
    m.flinch = 0; m.attackAnim = 0;
  };
  S3.screenX = (m) => {
    const v = new T.Vector3(m.pos.x, m.pos.y + 0.7, m.pos.z).project(G.camera);
    return [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight];
  };
  // raider at screen x px (solved by secant on rx), archers beside it
  S3.setRaiderAtScreen = (m, px, hold) => {
    S3.place(m, 0, -0.6, hold); const a = S3.screenX(m)[0];
    S3.place(m, 1, -0.6, hold); const b = S3.screenX(m)[0];
    S3.place(m, (px - a) / (b - a), -0.6, hold);
  };
  S3.hideOthers = (keep) => { for (const m of G.monstersList) { if (!keep.includes(m)) { m.rig.group.visible = false; m.__hold = 'stand'; } } };
  S3.hero = (v) => { if (D.player.meshGroup) D.player.meshGroup.visible = v; };
  S3.outline = (on) => G.scene.traverse((o) => { if (o.userData?.isOutline) o.visible = on; });
  S3.front = (m) => { const f = (n) => { let o = null; m.rig.group.traverse((x) => { if (x.name === n || x.name.endsWith('_' + n)) o = o || x; }); if (!o) return null; const v = new T.Vector3(); o.getWorldPosition(v); v.project(G.camera); return v.x; }; const l = f('LeftArmPivot'), r = f('RightArmPivot'); return l === null || r === null ? null : l > r; };
  S3.sphere = (m) => {
    m.rig.group.updateMatrixWorld(true);
    const out = []; const v = new T.Vector3();
    m.rig.group.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      o.skeleton.update();
      const sp = o.boundingSphere; const pos = o.geometry.attributes.position; let maxD = 0, outside = 0;
      for (let i = 0; i < pos.count; i++) { o.getVertexPosition(i, v); const d = v.distanceTo(sp.center); if (d > maxD) maxD = d; if (d > sp.radius + 1e-4) outside++; }
      out.push({ name: o.name, shell: !!o.userData.isOutline, verts: pos.count, radius: +sp.radius.toFixed(3), maxDist: +maxD.toFixed(3), outside });
    });
    return out;
  };
  S3.mem = () => { const i = G.renderer.info; return { geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs.length }; };
  S3.visible = () => G.monstersList.filter((m) => {
    const f = new T.Frustum(); f.setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(G.camera.projectionMatrix, G.camera.matrixWorldInverse));
    return m.rig.group.visible && f.containsPoint(new T.Vector3(m.pos.x, m.pos.y + 0.6, m.pos.z));
  }).map((m) => m.typeKey);
};

export default async (page) => {
  mkdirSync(OUT, { recursive: true });
  await page.context().addInitScript(() => {
    try { localStorage.clear(); } catch {}
    let s = 0x9e3779b9;
    Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const c = (window.__glc = { screen: 0, fbo: 0, raf: 0 });
    const R = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (f) => { c.raf++; return R(f); };
    const P = WebGL2RenderingContext.prototype;
    let bound = null;
    const bf = P.bindFramebuffer;
    P.bindFramebuffer = function (t, fb) { if (t === this.FRAMEBUFFER || t === this.DRAW_FRAMEBUFFER) bound = fb; return bf.call(this, t, fb); };
    for (const n of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements']) {
      const f = P[n];
      P[n] = function (...a) { if (bound) c.fbo++; else c.screen++; return f.apply(this, a); };
    }
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('http://localhost:4191/', { timeout: 60000 });
  await page.evaluate(() => { const b = document.getElementById('onboarding'); if (b && !b.hidden) b.hidden = true; });
  await page.waitForFunction(() => window.__DEBUG && window.__DEBUG.look && window.__DEBUG.look.ready(), null, { timeout: 60000 });
  await page.evaluate(() => { for (const k of Object.keys(__DEBUG.STATE.skills)) { __DEBUG.STATE.skills[k].lvl = 99; __DEBUG.STATE.skills[k].xp = 13034431; } });
  await page.evaluate(HELPERS);
  const result = { label: LABEL };
  const shot = async (name, clip) => page.screenshot({ path: `${OUT}/${name}.png`, type: 'png', ...(clip ? { clip } : {}) });
  const pose = async (row, phase) => page.evaluate(([row, phase]) => { const L = __DEBUG.look; L.tier('balanced'); L.pose(row); L.phase(phase); L.weather('clear'); L.hud(false); }, [row, phase]);
  await pose(CAMP, 0.5);
  await wait(2500); // let the GLB upgrade every monster
  result.skinnedMonsters = await page.evaluate(() => S3.skinnedCount());
  result.monsters = await page.evaluate(() => { const o = {}; for (const m of __DEBUG.G.monstersList) o[m.typeKey] = (o[m.typeKey] || 0) + 1; return o; });
  result.inspect = await page.evaluate(() => {
    const G = __DEBUG.G; const out = {};
    for (const key of ['goblin', 'goblin_archer']) {
      const m = G.monstersList.find((x) => x.typeKey === key); let meshes = 0, skinned = 0, shells = 0, shellsVisible = 0, shellsSkinned = 0; const skels = new Set(), tex = new Set();
      m.rig.group.traverse((o) => {
        if (o.isMesh) { meshes++; if (o.userData.isOutline) { shells++; if (o.visible) shellsVisible++; if (o.isSkinnedMesh) shellsSkinned++; } else if (o.isSkinnedMesh) skinned++; }
        if (o.isSkinnedMesh) skels.add(o.skeleton);
      });
      for (const s of skels) { s.update(); }
      out[key] = { meshes, skinnedBodyMeshes: skinned, outlineShells: shells, outlineShellsVisibleAtLoad: shellsVisible, skinnedShells: shellsSkinned, distinctSkeletons: skels.size, boneTextures: new Set([...skels].map((k) => k.boneTexture).filter(Boolean)).size };
    }
    return out;
  });
  result.renderer = await page.evaluate(() => { const gl = document.createElement('canvas').getContext('webgl2'); const e = gl.getExtension('WEBGL_debug_renderer_info'); return gl.getParameter(e.UNMASKED_RENDERER_WEBGL); });

  if (STEPS.includes('perf')) {
    const rows = [];
    for (let i = 0; i < 3; i++) {
      await wait(1500);
      rows.push(await page.evaluate(async () => {
        const c = window.__glc; const a = { ...c };
        await new Promise((r) => setTimeout(r, 1000));
        const z = { ...c }; const n = z.raf - a.raf;
        const vis = S3.visible();
        __DEBUG.look.hud(true);
        await new Promise((r) => setTimeout(r, 700));
        const hud = document.getElementById('perf-calls').textContent;
        __DEBUG.look.hud(false);
        const bench = __DEBUG.look.bench(120);
        return { colour: Math.round((z.screen - a.screen) / n), shadow: Math.round((z.fbo - a.fbo) / n), frames: n, hud, benchMs: +bench.toFixed(3), inView: vis.reduce((o, k) => ((o[k] = (o[k] || 0) + 1), o), {}) };
      }));
    }
    result.perf = rows;
    await shot('perf-camp');
  }

  if (STEPS.includes('cost')) {
    // controlled: the five camp goblins held standing in view, then hidden; the others keep wandering
    await page.evaluate(() => {
      const e = S3.ents(); S3.hero(false);
      for (const m of __DEBUG.G.monstersList) m.__hold = 'stand';
      e.raider.forEach((m, i) => S3.place(m, -2.4 + i * 1.2, -0.5 + (i % 2) * 0.8, 'stand'));
    });
    await pose({ ...CAMP, x: undefined, place: undefined, ...{ x: 14, z: 9 } }, 0.5);
    await wait(1500);
    const meas = () => page.evaluate(async () => {
      const c = window.__glc; const a = { ...c };
      await new Promise((r) => setTimeout(r, 1500));
      const z = { ...c }; const n = z.raf - a.raf;
      __DEBUG.look.hud(true);
      await new Promise((r) => setTimeout(r, 700));
      const hud = document.getElementById('perf-calls').textContent;
      __DEBUG.look.hud(false);
      const bench = __DEBUG.look.bench(200);
      const inView = S3.visible().filter((k) => k === 'goblin').length;
      return { colour: +((z.screen - a.screen) / n).toFixed(1), shadow: +((z.fbo - a.fbo) / n).toFixed(1), hud, benchMs: +bench.toFixed(3), goblinsInView: inView };
    });
    const withG = await meas();
    await page.evaluate(() => S3.ents().raider.forEach((m) => (m.rig.group.visible = false)));
    await wait(800);
    const without = await meas();
    await page.evaluate(() => S3.ents().raider.forEach((m) => (m.rig.group.visible = true)));
    result.cost = { withGoblins: withG, withoutGoblins: without };
    await page.evaluate(() => { for (const m of __DEBUG.G.monstersList) m.__hold = undefined; });
  }

  const stand = await page.evaluate(() => S3.ents().raider.length);
  // pick the monsters to pose: the first goblin and the first two archers
  const setup = async () => page.evaluate(() => {
    const e = S3.ents(); const r = e.raider[0], a = e.archers.slice(0, 2);
    S3.hideOthers([r, ...a]); S3.hero(false); S3.outline(true);
    return [r.typeKey, a.length];
  });

  if (STEPS.includes('poses')) {
    await setup();
    const lay = (hold, rxR = -1.3, camRow) => page.evaluate(([hold, rxR]) => {
      const e = S3.ents(); const r = e.raider[0], a = e.archers.slice(0, 2);
      S3.place(r, rxR, -0.6, hold); S3.place(a[0], rxR + 1.3, -0.6, hold); S3.place(a[1], rxR + 2.6, -0.6, hold);
    }, [hold, rxR]);
    const ROW = { x: 18.5, z: 12.5, yaw: 0, pitch: 0.25, distance: 6.5 };
    await pose(ROW, 0.5); await wait(800);
    for (const hold of ['stand', 'walk', 'attack', 'flinch', 'windup']) {
      await lay(hold); await wait(700); await shot(`${LABEL}-noon-${hold}`);
    }
    // dusk: a bent arm in light and in shadow (two camera yaws), and the ground shadow from above
    await pose(ROW, 0.7); await wait(800);
    for (const [name, hold, yaw, pitch] of [['dusk-attack-yaw0', 'attack', 0, 0.25], ['dusk-attack-yaw2', 'attack', 2.2, 0.25], ['dusk-windup-yaw4', 'windup', 4.2, 0.25], ['dusk-shadow-top', 'attack', 0.6, 0.75]]) {
      await pose({ ...ROW, yaw, pitch }, 0.7); await wait(900); await lay(hold); await wait(700); await shot(`${LABEL}-${name}`);
    }
    // edge and half off, attack pose, noon
    await pose(ROW, 0.5); await wait(800);
    for (const [name, px] of [['edge-in', 1280 - 60], ['edge-half', 1280 + 0], ['edge-left-half', 0]]) {
      await page.evaluate(([px]) => { const e = S3.ents(); const r = e.raider[0]; S3.setRaiderAtScreen(r, px, 'attack'); const a = e.archers.slice(0, 2); S3.place(a[0], -9, 0, 'stand'); S3.place(a[1], -9, 0, 'stand'); a.forEach((m) => (m.rig.group.visible = false)); }, [px]);
      await wait(700); await shot(`${LABEL}-${name}`);
      result[name] = await page.evaluate(() => { const r = S3.ents().raider[0]; return { sx: Math.round(S3.screenX(r)[0]), visible: r.rig.group.visible }; });
    }
  }

  if (STEPS.includes('close')) {
    await setup();
    await page.evaluate(() => { const e = S3.ents(); e.archers.forEach((m) => (m.rig.group.visible = false)); });
    for (const [name, row] of [['close-front', { x: 18.5, z: 12.5, yaw: 0, pitch: 0.2, distance: 5.4 }]]) {
      await pose(row, 0.5); await wait(800);
      await page.evaluate(() => { const r = S3.ents().raider[0]; S3.place(r, 0, 0, 'stand'); });
      await wait(900); await shot(`${LABEL}-${name}`);
      result.closeFrontToCamera = await page.evaluate(() => { const e = S3.ents(); return { raider: S3.front(e.raider[0]), archer: S3.front(e.archers[0]) }; });
    }
  }

  if (STEPS.includes('body')) {
    await setup();
    await page.evaluate(() => { S3.ents().archers.forEach((m) => (m.rig.group.visible = false)); });
    const BD = Number(process.env.BODY_D || 3.0), BP = Number(process.env.BODY_PITCH || 0.12);
    for (const [name, hold, side] of [['body-front', 'stand', false], ['body-side', 'stand', true], ['body-attack-side', 'attack', true]]) {
      await pose({ x: 18.5, z: 12.5, yaw: 0, pitch: BP, distance: BD }, 0.5);
      await page.evaluate(([BD, BP, DY]) => { __DEBUG.camState.distance = BD; __DEBUG.camState.pitch = BP; window.__lookDy = DY; }, [BD, BP, Number(process.env.BODY_DY || -0.95)]);
      await wait(1500);
      await page.evaluate(([hold, side]) => { const r = S3.ents().raider[0]; S3.place(r, 0, 0, hold); if (side) r.rig.group.rotation.y += Math.PI / 2; }, [hold, side]);
      await wait(900); await shot(`${LABEL}-${name}`);
    }
    await page.evaluate(() => { window.__lookDy = 0; });
  }

  if (STEPS.includes('leak')) {
    // unhold everything, run the real logic: 30 kills and respawns of one goblin
    await page.evaluate(() => { for (const m of __DEBUG.G.monstersList) { m.__hold = undefined; m.rig.group.visible = true; } });
    await pose(CAMP, 0.5);
    await wait(1500);
    const before = await page.evaluate(() => S3.mem());
    const t0 = Date.now();
    const kills = await page.evaluate(async () => {
      const m = S3.ents().raider[0]; const L = m.logic; let n = 0;
      for (let i = 0; i < 30; i++) {
        L.state = 'dying'; L.timer = 0.1; L.windup = null;
        let guard = 0;
        while (L.state !== 'dead' && guard++ < 400) await new Promise((r) => requestAnimationFrame(r));
        L.timer = 0.05; guard = 0;
        while (L.state === 'dead' && guard++ < 400) await new Promise((r) => requestAnimationFrame(r));
        if (L.state !== 'dead' && m.rig.group.visible) n++;
        await new Promise((r) => requestAnimationFrame(r));
      }
      return n;
    });
    await wait(500);
    const after = await page.evaluate(() => S3.mem());
    result.leakKills = { kills, before, after, ms: Date.now() - t0 };
    // 30 spawn then dispose cycles of a skinned goblin (the game never disposes a monster; this is the disposal path)
    const sd = await page.evaluate(async () => {
      const D = __DEBUG, G = D.G; const b0 = S3.mem(); const base = G.monstersList.length;
      for (let i = 0; i < 30; i++) {
        D.spawnMonster('goblin', 13 + (i % 5), 8 + (i % 3), {});
        const m = G.monstersList[G.monstersList.length - 1];
        m.__hold = 'stand';
        for (let k = 0; k < 8; k++) await new Promise((r) => requestAnimationFrame(r));
        await new Promise((r) => setTimeout(r, 60));
        G.monstersList.pop();
        const ix = G.worldInteractiveObjects.indexOf(m.rig.hitbox); if (ix >= 0) G.worldInteractiveObjects.splice(ix, 1);
        m.labelEl.remove();
        D.disposeObject3D(m.rig.group);
      }
      for (let k = 0; k < 10; k++) await new Promise((r) => requestAnimationFrame(r));
      return { before: b0, after: S3.mem(), listDelta: G.monstersList.length - base };
    });
    result.leakSpawnDispose = sd;
    // control: 5 spawns that are not disposed must raise the counts, else the test above would be vacuous
    result.leakControl = await page.evaluate(async () => {
      const D = __DEBUG, G = D.G; const b0 = S3.mem(); const made = [];
      for (let i = 0; i < 5; i++) {
        D.spawnMonster('goblin', 13 + i, 9, {}); const m = G.monstersList[G.monstersList.length - 1]; m.__hold = 'stand'; made.push(m);
        for (let k = 0; k < 8; k++) await new Promise((r) => requestAnimationFrame(r));
        await new Promise((r) => setTimeout(r, 60));
      }
      const mid = S3.mem();
      for (const m of made) { G.monstersList.splice(G.monstersList.indexOf(m), 1); const ix = G.worldInteractiveObjects.indexOf(m.rig.hitbox); if (ix >= 0) G.worldInteractiveObjects.splice(ix, 1); m.labelEl.remove(); D.disposeObject3D(m.rig.group); }
      for (let k = 0; k < 10; k++) await new Promise((r) => requestAnimationFrame(r));
      return { before: b0, undisposed: mid, afterDispose: S3.mem() };
    });
  }

  if (STEPS.includes('clips')) {
    await page.evaluate(() => { for (const m of __DEBUG.G.monstersList) { m.__hold = undefined; } });
    await pose(CAMP, 0.5); await wait(500);
    await setup();
    await page.evaluate(() => { S3.ents().archers.forEach((m) => (m.rig.group.visible = false)); });
    await pose({ x: 18.5, z: 12.5, yaw: 0.5, pitch: 0.2, distance: 5.4 }, 0.5); await wait(800);
    const info = await page.evaluate(async () => {
      const D = __DEBUG, T = D.THREE; const r = S3.ents().raider[0];
      const gltf = await new D.GLTFLoader().loadAsync('/clips.glb');
      const hipsY = (() => { let y = null; r.rig.group.traverse((o) => { if (o.name === 'Hips') y = o.position.y; }); return y; })();
      const clips = {};
      for (const c of gltf.animations) {
        const tr = [];
        for (const t of c.tracks) {
          const n = t.name.replace(/^goblin_/, '');
          if (n.endsWith('.quaternion')) { t.name = n; tr.push(t); }
          else if (n === 'Hips.position') { t.name = n; tr.push(t); }
        }
        clips[c.name] = new T.AnimationClip(c.name, c.duration, tr);
      }
      const mixer = new T.AnimationMixer(r.rig.group);
      window.S3.mixer = mixer; window.S3.clips = clips; window.S3.raider = r;
      S3.place(r, 0, 0, 'clip');
      return { names: Object.keys(clips), tracks: Object.fromEntries(Object.entries(clips).map(([k, c]) => [k, [c.tracks.length, +c.duration.toFixed(3)]])), hipsRest: hipsY };
    });
    result.clips = info;
    for (const [clip, fr] of [['Walk', [0, 0.125, 0.25, 0.375, 0.5, 0.75]], ['Slash', [0, 0.14, 0.28, 0.4, 0.48, 0.7]]]) {
      for (const [i, u] of fr.entries()) {
        await page.evaluate(([clip, u]) => {
          const S = window.S3; S.mixer.stopAllAction(); S.place(S.raider, 0, 0, 'clip'); if (clip === 'Walk') S.raider.rig.group.rotation.y += Math.PI / 2;
          const a = S.mixer.clipAction(S.clips[clip]); a.play(); a.paused = true; a.time = u * S.clips[clip].duration; S.mixer.update(0);
        }, [clip, u]);
        await wait(250); await shot(`${LABEL}-clip-${clip}-${i}`);
        (result.sphere = result.sphere || {})[`${clip}-${i}`] = await page.evaluate(() => S3.sphere(window.S3.raider));
      }
    }
  }
  if (STEPS.includes('shadow')) {
    await setup();
    await page.evaluate(() => { const e = S3.ents(); e.archers.forEach((m) => (m.rig.group.visible = false)); });
    for (const yaw of [0.6, 2.4]) {
      await pose({ x: 18.5, z: 12.5, yaw, pitch: 1.0, distance: 5 }, 0.62); await wait(900);
      for (const hold of ['stand', 'attack', 'windup', 'flinch']) {
        await page.evaluate((h) => S3.place(S3.ents().raider[0], 0, 0, h), hold); await wait(700);
        await shot(`${LABEL}-shadow-y${yaw}-${hold}`);
      }
    }
  }

  if (STEPS.includes('cull')) {
    await setup();
    await page.evaluate(() => { S3.ents().archers.forEach((m) => (m.rig.group.visible = false)); });
    await pose({ x: 18.5, z: 12.5, yaw: 0, pitch: 0.25, distance: 6.5 }, 0.5); await wait(800);
    result.cull = {};
    for (const hold of ['attack', 'windup', 'stand']) {
      const bad = [], rows = [];
      for (const side of [1, -1]) {
        for (let d = -200; d <= 700; d += 25) {
          const px = side > 0 ? 1280 + d : -d;
          const r = await page.evaluate(([px, hold]) => {
            const m = S3.ents().raider[0]; S3.setRaiderAtScreen(m, px, hold);
            return new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => {
              const D = __DEBUG, G = D.G, T = D.THREE; G.camera.updateMatrixWorld(); m.rig.group.updateMatrixWorld(true);
              const f = new T.Frustum(); f.setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(G.camera.projectionMatrix, G.camera.matrixWorldInverse));
              let boneIn = false, meshIn = false, nb = 0; const v = new T.Vector3();
              m.rig.group.traverse((o) => {
                if (o.isSkinnedMesh && !o.userData.isOutline) { if (f.intersectsObject(o)) meshIn = true; for (const b of o.skeleton.bones) { b.getWorldPosition(v); nb++; if (f.containsPoint(v)) boneIn = true; } }
              });
              res({ boneIn, meshIn, nb });
            })));
          }, [px, hold]);
          rows.push(r.boneIn === r.meshIn || (!r.boneIn && r.meshIn) ? 0 : 1);
          if (r.boneIn && !r.meshIn) bad.push([side, px]);
        }
      }
      result.cull[hold] = { samples: rows.length, boneVisibleButMeshCulled: bad };
    }
  }


  if (STEPS.includes('dist')) {
    await setup();
    const lay = (hold) => page.evaluate((hold) => { const e = S3.ents(); const r = e.raider[0], a = e.archers.slice(0, 2); S3.place(r, -1.3, -0.6, hold); S3.place(a[0], 0, -0.6, hold); S3.place(a[1], 1.3, -0.6, hold); }, hold);
    for (const d of [26, 8.5]) {
      for (const hold of ['stand', 'attack']) {
        await pose({ x: 18.5, z: 12.5, yaw: 0, pitch: 0.25, distance: d }, 0.5); await wait(800);
        await lay(hold); await wait(700); await shot(`${LABEL}-dist${d}-${hold}`);
      }
    }
    result.distPx = await page.evaluate(() => { const r = S3.ents().raider[0]; return S3.screenX(r); });
  }
  if (STEPS.includes('sphere')) {
    await setup();
    await page.evaluate(() => { S3.ents().archers.forEach((m) => (m.rig.group.visible = false)); });
    await pose({ x: 18.5, z: 12.5, yaw: 0, pitch: 0.25, distance: 6.5 }, 0.5); await wait(800);
    result.sphere = result.sphere || {};
    for (const hold of ['stand', 'walk', 'attack', 'windup', 'flinch']) {
      await page.evaluate((h) => S3.place(S3.ents().raider[0], 0, 0, h), hold); await wait(500);
      result.sphere[hold] = await page.evaluate(() => S3.sphere(S3.ents().raider[0]));
    }
  }
  if (STEPS.includes('facing')) {
    await page.evaluate(() => { for (const m of __DEBUG.G.monstersList) { m.__hold = undefined; m.rig.group.visible = true; } S3.hero(true); });
    await pose({ ...CAMP, distance: 5.4 }, 0.5);
    for (let i = 0; i < 4; i++) {
      await wait(2500);
      const st = await page.evaluate(() => S3.ents().raider.map((m) => [m.logic.state, +m.rig.group.rotation.y.toFixed(2), +Math.hypot(m.pos.x - __DEBUG.player.pos.x, m.pos.z - __DEBUG.player.pos.z).toFixed(1)]));
      const ft = await page.evaluate(() => S3.ents().raider.map((m) => [m.logic.state, S3.front(m)]));
      result['facing' + i] = ft; await shot(`${LABEL}-facing-${i}`);
    }
  }

  result.errors = errs.slice(0, 10);
  writeFileSync(`${OUT}/result.json`, JSON.stringify(result, null, 1));
  console.log(JSON.stringify(result));
};
