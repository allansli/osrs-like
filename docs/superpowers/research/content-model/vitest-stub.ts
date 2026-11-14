// A stand-in for `vitest`, so that Stage 3's tests/pacing.test.ts can be bundled and run UNEDITED by pacing-rerun.sh
// (the test suite itself is not run here). Only the matchers that file uses. A failed `it` is printed and counted.
type Fn = () => void;
let failed = 0;
const prefix: string[] = [];
export function describe(name: string, fn: Fn): void { prefix.push(name); fn(); prefix.pop(); }
export function it(name: string, fn: Fn): void {
  try { fn(); console.log(`  PASS ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${(e as Error).message}`); }
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function expect(got: unknown, label = ''): Record<string, (want?: unknown) => void> & { not: Record<string, (want?: unknown) => void> } {
  const fail = (what: string) => { throw new Error(`${label ? label + ': ' : ''}expected ${JSON.stringify(got)} ${what}`); };
  const m = {
    toBe: (w?: unknown) => { if (!Object.is(got, w)) fail(`to be ${JSON.stringify(w)}`); },
    toEqual: (w?: unknown) => { if (!same(got, w)) fail(`to equal ${JSON.stringify(w)}`); },
    toHaveLength: (w?: unknown) => { if ((got as unknown[]).length !== w) fail(`to have length ${w}`); },
    toBeLessThan: (w?: unknown) => { if (!((got as number) < (w as number))) fail(`to be < ${w}`); },
    toBeLessThanOrEqual: (w?: unknown) => { if (!((got as number) <= (w as number))) fail(`to be <= ${w}`); },
    toBeGreaterThan: (w?: unknown) => { if (!((got as number) > (w as number))) fail(`to be > ${w}`); },
    toBeGreaterThanOrEqual: (w?: unknown) => { if (!((got as number) >= (w as number))) fail(`to be >= ${w}`); }
  };
  return { ...m, not: { toBe: (w?: unknown) => { if (Object.is(got, w)) fail(`not to be ${JSON.stringify(w)}`); } } };
}
process.on('exit', () => { console.log(failed === 0 ? 'EVERY ASSERTION OF pacing.test.ts HOLDS' : `${failed} TEST(S) OF pacing.test.ts FAILED`); });
