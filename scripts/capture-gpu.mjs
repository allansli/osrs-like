// Drive the game in headless Chromium on the machine's NVIDIA GPU (WSL2, through the
// d3d12 driver WSLg ships), for captures and frame timing that a software renderer
// cannot give.
//
//   node scripts/capture-gpu.mjs --check
//       prints the WebGL renderer and exits 1 unless it is the NVIDIA GPU.
//   node scripts/capture-gpu.mjs <job.mjs> [url]
//       opens url (default http://localhost:5173/) and runs the job's default export,
//       `async (page, browser) => { ... }`, then closes the browser.
//
// The browser is the Chromium build playwright-core 1.60.0 downloads (revision 1223,
// under ~/.cache/ms-playwright). Install it once with `npx playwright-core install chromium`.
import { chromium } from 'playwright-core';

const GPU_ENV = { GALLIUM_DRIVER: 'd3d12', MESA_D3D12_DEFAULT_ADAPTER_NAME: 'NVIDIA' };
const GPU_ARGS = ['--enable-gpu', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'];

export async function launchGpu() {
  return chromium.launch({ headless: true, args: GPU_ARGS, env: { ...process.env, ...GPU_ENV }, timeout: 60_000 });
}

export async function rendererOf(page) {
  return page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return 'no webgl2';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
}

async function main() {
  const [arg, url = 'http://localhost:5173/'] = process.argv.slice(2);
  if (!arg) {
    console.error('usage: node scripts/capture-gpu.mjs --check | <job.mjs> [url]');
    process.exit(2);
  }
  const browser = await launchGpu();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    if (arg === '--check') {
      await page.setContent('<html></html>');
      const r = await rendererOf(page);
      console.log(r);
      process.exitCode = /NVIDIA/.test(r) ? 0 : 1;
      return;
    }
    const job = (await import(new URL(arg, `file://${process.cwd()}/`).href)).default;
    if (typeof job !== 'function') throw new Error(`${arg} has no default export function (page, browser) => ...`);
    await page.goto(url, { timeout: 60_000 });
    await job(page, browser);
  } finally {
    await browser.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
