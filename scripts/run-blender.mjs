import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function findBlenderExecutable() {
  if (process.env.BLENDER_PATH) {
    if (!fs.existsSync(process.env.BLENDER_PATH)) {
      console.error(`BLENDER_PATH is set to "${process.env.BLENDER_PATH}" but no file exists there.`);
      process.exit(1);
    }
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

const BUILD_SCRIPTS = {
  hero: 'scripts/blender/build_hero.py',
  gear: 'scripts/blender/build_gear.py',
  monsters: 'scripts/blender/build_monsters.py',
  world: 'scripts/blender/build_world.py'
};

const EXTRA_MODES = {
  guard: 'scripts/blender/export_guard.py',
  sheets: 'scripts/blender/review_render.py'
};

const mode = process.argv[2] || 'hero';

let outDir = path.resolve('scratch/models-build');
const positionalArgs = [];
const remaining = process.argv.slice(3);
for (let i = 0; i < remaining.length; i++) {
  if (remaining[i] === '--out') {
    if (i + 1 < remaining.length) {
      outDir = path.resolve(remaining[i + 1]);
      i++;
    }
  } else if (remaining[i].startsWith('--out=')) {
    outDir = path.resolve(remaining[i].slice(6));
  } else {
    positionalArgs.push(remaining[i]);
  }
}

const argTarget = positionalArgs[0] || 'hero';
const blenderExe = findBlenderExecutable();

const ALL_SCRIPTS = { ...BUILD_SCRIPTS, ...EXTRA_MODES };
const KNOWN_MODES = ['open', 'export', 'all', ...Object.keys(ALL_SCRIPTS)];
if (!KNOWN_MODES.includes(mode) && !fs.existsSync(mode)) {
  console.error(`Unknown mode: "${mode}". Valid modes: ${KNOWN_MODES.join(', ')}`);
  process.exit(2);
}

function checkExit(res) {
  if (res.error) {
    console.error(res.error);
    process.exit(1);
  }
  if (res.signal) {
    console.error(`Process killed by signal: ${res.signal}`);
    process.exit(1);
  }
  if (res.status !== 0) {
    process.exit(res.status ?? 1);
  }
}

if (mode === 'open') {
  const blendFile = path.resolve(`blender/${argTarget}.blend`);
  console.log(`[Blender] Launching Blender GUI with ${blendFile}...`);
  const child = spawn(blenderExe, ['--disable-autoexec', blendFile], { detached: true, stdio: 'ignore' });
  child.unref();
} else if (mode === 'export') {
  const blendFile = path.resolve(`blender/${argTarget}.blend`);
  const exportScript = path.resolve('scripts/blender/export_from_blend.py');
  const res = spawnSync(
    blenderExe,
    [
      '--background',
      '--factory-startup',
      '--disable-autoexec',
      blendFile,
      '--python-exit-code',
      '1',
      '--python',
      exportScript,
      '--',
      '--out',
      outDir,
      argTarget
    ],
    { stdio: 'inherit' }
  );
  checkExit(res);
  process.exit(0);
} else if (mode === 'all') {
  for (const [key, scriptRel] of Object.entries(BUILD_SCRIPTS)) {
    const scriptFile = path.resolve(scriptRel);
    if (!fs.existsSync(scriptFile)) continue;
    console.log(`[Blender] Building ${key} (${scriptRel})...`);
    const res = spawnSync(
      blenderExe,
      [
        '--background',
        '--factory-startup',
        '--disable-autoexec',
        '--python-exit-code',
        '1',
        '--python',
        scriptFile,
        '--',
        '--out',
        outDir
      ],
      { stdio: 'inherit' }
    );
    checkExit(res);
  }
} else {
  const scriptRel = fs.existsSync(mode) ? mode : ALL_SCRIPTS[mode];
  const scriptFile = path.resolve(scriptRel);
  const spawnArgs = [
    '--background',
    '--factory-startup',
    '--disable-autoexec',
    '--python-exit-code',
    '1',
    '--python',
    scriptFile,
    '--',
    '--out',
    outDir
  ];
  if (mode === 'sheets') {
    spawnArgs.push(...positionalArgs);
  }
  const res = spawnSync(blenderExe, spawnArgs, { stdio: 'inherit' });
  checkExit(res);
  process.exit(0);
}
