import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'run-blender.mjs');

const STUB = `#!/usr/bin/env node
const fs = require('node:fs');
fs.appendFileSync(process.env.STUB_LOG, JSON.stringify(process.argv.slice(2)) + '\\n');
if (process.env.STUB_SIGNAL === '1') process.kill(process.pid, 'SIGKILL');
process.exit(Number(process.env.STUB_EXIT || 0));
`;

let dir: string;
let stub: string;
let binDir: string;
let log: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-blender-'));
  // PATH holds only a node symlink: the host's real blender must never be reachable.
  binDir = path.join(dir, 'bin');
  fs.mkdirSync(binDir);
  fs.symlinkSync(process.execPath, path.join(binDir, 'node'));
  stub = path.join(dir, 'blender-stub');
  log = path.join(dir, 'argv.log');
  fs.writeFileSync(stub, STUB);
  fs.chmodSync(stub, 0o755);
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function run(args: string[], env: Record<string, string> = {}, blender = stub) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 20000,
    env: { PATH: binDir, HOME: dir, BLENDER_PATH: blender, STUB_LOG: log, ...env }
  });
}

function argvLines(): string[][] {
  if (!fs.existsSync(log)) return [];
  return fs
    .readFileSync(log, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as string[]);
}

async function waitForLines(n: number): Promise<string[][]> {
  const end = Date.now() + 2000;
  while (Date.now() < end) {
    const lines = argvLines();
    if (lines.length >= n) return lines;
    await new Promise((r) => setTimeout(r, 50));
  }
  return argvLines();
}

function expectFlagOrder(argv: string[]) {
  const auto = argv.indexOf('--disable-autoexec');
  expect(auto, `--disable-autoexec in ${JSON.stringify(argv)}`).toBeGreaterThanOrEqual(0);
  const blend = argv.findIndex((a) => a.endsWith('.blend'));
  if (blend >= 0) expect(auto).toBeLessThan(blend);
  const py = argv.indexOf('--python');
  if (py >= 0) {
    const code = argv.indexOf('--python-exit-code');
    expect(code, `--python-exit-code in ${JSON.stringify(argv)}`).toBeGreaterThanOrEqual(0);
    expect(argv[code + 1]).toBe('1');
    expect(code).toBeLessThan(py);
  }
}

describe('scripts/run-blender.mjs', () => {
  it('exits non-zero when the binary is missing', () => {
    const res = run(['hero'], {}, path.join(dir, 'does-not-exist'));
    expect(res.status).not.toBe(0);
  });

  it('exits non-zero when the stub exits 3', () => {
    const res = run(['hero'], { STUB_EXIT: '3' });
    expect(res.status).not.toBe(0);
  });

  it('exits non-zero on an unknown mode', () => {
    const res = run(['no_such_mode']);
    expect(res.status).not.toBe(0);
  });

  it('passes --disable-autoexec and --python-exit-code 1 on every spawn', async () => {
    expect(run(['hero']).status).toBe(0);
    const hero = argvLines();
    expect(hero).toHaveLength(1);
    hero.forEach(expectFlagOrder);

    fs.rmSync(log);
    expect(run(['all']).status).toBe(0);
    const all = argvLines();
    expect(all).toHaveLength(4);
    all.forEach(expectFlagOrder);

    fs.rmSync(log);
    expect(run(['export', 'knight']).status).toBe(0);
    const exp = argvLines();
    expect(exp).toHaveLength(1);
    expect(exp[0].some((a) => a.endsWith('.blend'))).toBe(true);
    exp.forEach(expectFlagOrder);

    fs.rmSync(log);
    expect(run(['open', 'hero']).status).toBe(0);
    const open = await waitForLines(1);
    expect(open).toHaveLength(1);
    expect(open[0].some((a) => a.endsWith('.blend'))).toBe(true);
    open.forEach(expectFlagOrder);
  });

  it('exits non-zero when the child is killed by a signal', () => {
    const res = run(['hero'], { STUB_SIGNAL: '1' });
    expect(res.status).not.toBe(0);
  });

  it('a BLENDER_PATH that points at nothing fails instead of using another Blender', () => {
    const res = run(['hero'], {}, path.join(dir, 'no-such-blender'));
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('BLENDER_PATH');
    expect(argvLines()).toEqual([]);
  });
});
