import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function findBlenderExecutable() {
  if (process.env.BLENDER_PATH && fs.existsSync(process.env.BLENDER_PATH)) {
    return process.env.BLENDER_PATH;
  }
  const localAppData = process.env.LOCALAPPDATA || '';
  const progFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const candidates = [
    path.join(localAppData, 'Programs', 'Blender', 'blender-5.2.3-windows-x64', 'blender.exe'),
    path.join(progFiles, 'Blender Foundation', 'Blender 5.2', 'blender.exe'),
    path.join(progFiles, 'Blender Foundation', 'Blender 4.2', 'blender.exe')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'blender';
}

const mode = process.argv[2] || 'hero';
const argTarget = process.argv[3] || 'hero';
const blenderExe = findBlenderExecutable();

const BUILD_SCRIPTS = {
  hero: 'scripts/blender/build_hero.py',
  gear: 'scripts/blender/build_gear.py',
  monsters: 'scripts/blender/build_monsters.py',
  world: 'scripts/blender/build_world.py'
};

if (mode === 'open') {
  const blendFile = path.resolve(`blender/${argTarget}.blend`);
  console.log(`[Blender] Launching Blender GUI with ${blendFile}...`);
  const child = spawn(blenderExe, [blendFile], { detached: true, stdio: 'ignore' });
  child.unref();
} else if (mode === 'export') {
  const blendFile = path.resolve(`blender/${argTarget}.blend`);
  const exportScript = path.resolve('scripts/blender/export_from_blend.py');
  const res = spawnSync(blenderExe, ['--background', blendFile, '--python', exportScript], {
    stdio: 'inherit'
  });
  process.exit(res.status ?? 0);
} else if (mode === 'all') {
  for (const [key, scriptRel] of Object.entries(BUILD_SCRIPTS)) {
    const scriptFile = path.resolve(scriptRel);
    if (!fs.existsSync(scriptFile)) continue;
    console.log(`[Blender] Building ${key} (${scriptRel})...`);
    const res = spawnSync(blenderExe, ['--background', '--python', scriptFile], {
      stdio: 'inherit'
    });
    if ((res.status ?? 0) !== 0) {
      process.exit(res.status ?? 1);
    }
  }
} else {
  const scriptRel = fs.existsSync(mode) ? mode : (BUILD_SCRIPTS[mode] || BUILD_SCRIPTS.hero);
  const scriptFile = path.resolve(scriptRel);
  const res = spawnSync(blenderExe, ['--background', '--python', scriptFile], {
    stdio: 'inherit'
  });
  process.exit(res.status ?? 0);
}
