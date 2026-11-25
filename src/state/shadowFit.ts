// Shadow camera fitting, texel snapping, and stepped light direction (design 6.2).

export type Vec3 = [number, number, number];

export interface ShadowFitResult {
  texel: number;
  lightPos: Vec3;
  target: Vec3;
}

function norm(v: Vec3): Vec3 {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function shadowAxes(lightDir: Vec3): { x: Vec3; y: Vec3 } {
  const x = norm(cross([0, 1, 0], lightDir));
  return { x, y: cross(lightDir, x) };
}

export function fitShadow(
  cam: Vec3,
  forward: Vec3,
  lightDir: Vec3,
  range: number,
  mapSize: number,
): ShadowFitResult {
  const texel = (2 * range) / mapSize;
  const h = Math.hypot(forward[0], forward[2]);
  const fwdFlatX = forward[0] / h;
  const fwdFlatZ = forward[2] / h;

  const idealTarget: Vec3 = [
    cam[0] + fwdFlatX * 0.35 * range,
    0,
    cam[2] + fwdFlatZ * 0.35 * range,
  ];

  const { x: xAx, y: yAx } = shadowAxes(lightDir);
  const cx = dot(idealTarget, xAx);
  const cy = dot(idealTarget, yAx);

  const sx = Math.round(cx / texel) * texel;
  const sy = Math.round(cy / texel) * texel;

  // keep the along-light component (stepped by range so it never crawls, error <= range/2 < light distance)
  const sz = Math.round(dot(idealTarget, lightDir) / range) * range;
  const target: Vec3 = [
    xAx[0] * sx + yAx[0] * sy + lightDir[0] * sz,
    xAx[1] * sx + yAx[1] * sy + lightDir[1] * sz,
    xAx[2] * sx + yAx[2] * sy + lightDir[2] * sz,
  ];

  const dist = Math.max(range * 2, 100);
  const lightPos: Vec3 = [
    target[0] + lightDir[0] * dist,
    target[1] + lightDir[1] * dist,
    target[2] + lightDir[2] * dist,
  ];

  return { texel, lightPos, target };
}

export function stepShadowDir(current: Vec3, sun: Vec3, stepDeg: number): Vec3 {
  const d = dot(norm(current), norm(sun));
  const angle = (Math.acos(Math.max(-1, Math.min(1, d))) * 180) / Math.PI;
  if (angle <= stepDeg) {
    return current;
  }
  return sun;
}
