import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ITEMS } from '../data/items';
import { LEAN_RIG, buildHumanoidRig } from '../engine/humanoid';
import { buildBodyVisual, buildHeadVisual, buildLegsVisual } from '../engine/playerGear';

function solidMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const found: THREE.Mesh[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.isOutline) return;
    found.push(mesh);
  });
  return found;
}

function part(root: THREE.Object3D, name: string): THREE.Mesh {
  const mesh = solidMeshes(root).find((entry) => entry.userData.part === name);
  if (!mesh) throw new Error(`missing part ${name}`);
  return mesh;
}

describe('lean OSRS humanoid', () => {
  const rig = buildHumanoidRig();

  it('uses a V-taper chest, flat Z, and a separate hip block', () => {
    const chest = part(rig.torso, 'chest').geometry as THREE.CylinderGeometry;
    expect(chest.parameters.radiusTop).toBe(LEAN_RIG.chestRadiusTop);
    expect(chest.parameters.radiusBottom).toBe(LEAN_RIG.chestRadiusBottom);
    expect(chest.parameters.height).toBe(LEAN_RIG.chestHeight);
    expect(chest.parameters.radiusTop).toBeGreaterThan(chest.parameters.radiusBottom);
    expect(part(rig.torso, 'chest').scale.z).toBe(0.68);
    const belt = part(rig.torso, 'belt').geometry as THREE.CylinderGeometry;
    expect(belt.parameters.radiusTop).toBe(0.17);
    expect(belt.parameters.height).toBe(0.2);
  });

  it('places a visible neck under a smaller head', () => {
    expect(rig.neck.position.y).toBeCloseTo(1.69);
    const head = rig.head.geometry as THREE.SphereGeometry;
    expect(head.parameters.radius).toBe(0.195);
    expect(rig.headGroup.position.y).toBeGreaterThan(rig.neck.position.y);
  });

  it('narrows the shoulders and lengthens the arms', () => {
    expect(rig.leftArmPivot.position.x).toBeCloseTo(-0.28);
    expect(rig.rightArmPivot.position.x).toBeCloseTo(0.28);
    const arm = part(rig.leftArmPivot, 'arm').geometry as THREE.CylinderGeometry;
    expect(arm.parameters.radiusTop).toBe(0.068);
    expect(arm.parameters.radiusBottom).toBe(0.054);
    expect(arm.parameters.height).toBe(0.66);
  });

  it('lengthens the legs and pulls the hips in', () => {
    expect(rig.leftLegPivot.position.x).toBeCloseTo(-0.11);
    expect(rig.rightLegPivot.position.x).toBeCloseTo(0.11);
    const thigh = part(rig.leftLegPivot, 'thigh').geometry as THREE.CylinderGeometry;
    const shin = part(rig.leftLegPivot, 'shin').geometry as THREE.CylinderGeometry;
    expect(thigh.parameters.radiusTop).toBe(0.085);
    expect(shin.parameters.radiusBottom).toBe(0.062);
    expect(thigh.parameters.height + shin.parameters.height).toBeCloseTo(0.82);
  });

  it('inks the silhouette with a fine outline', () => {
    const shell = part(rig.torso, 'chest').children.find((child) => child.userData.isOutline) as THREE.Mesh;
    const material = shell.material as THREE.ShaderMaterial;
    expect(material.uniforms.uThickness.value).toBe(0.016);
  });
});

describe('lean gear mounts', () => {
  it('sets plate pauldrons on the narrow shoulders', () => {
    const plate = buildBodyVisual(ITEMS.rune_plate);
    const xs = solidMeshes(plate.torso!)
      .filter((mesh) => mesh.geometry.type === 'SphereGeometry' && Math.abs(mesh.position.x) > 0.15)
      .map((mesh) => mesh.position.x)
      .sort((a, b) => a - b);
    expect(xs).toEqual([-0.28, 0.28]);
  });

  it('keeps robe skirts, tassets, and platelegs from flaring past the hip', () => {
    const skirt = buildLegsVisual(ITEMS.wizard_bottom);
    const skirtCyl = solidMeshes(skirt.torso!).find((mesh) => {
      const geo = mesh.geometry as THREE.CylinderGeometry;
      return geo.type === 'CylinderGeometry' && geo.parameters.height > 0.4;
    });
    const skirtParams = (skirtCyl!.geometry as THREE.CylinderGeometry).parameters;
    expect(skirtParams.radiusBottom).toBe(0.28);
    expect(skirtParams.radiusTop).toBeLessThan(skirtParams.radiusBottom);

    const tassets = buildLegsVisual(ITEMS.bandos_tassets);
    solidMeshes(tassets.torso!).forEach((mesh) => {
      if (mesh.geometry.type !== 'CylinderGeometry') return;
      expect((mesh.geometry as THREE.CylinderGeometry).parameters.radiusBottom).toBeLessThanOrEqual(0.28);
    });

    const plate = buildLegsVisual(ITEMS.rune_legs);
    solidMeshes(plate.left!).concat(solidMeshes(plate.right!)).forEach((mesh) => {
      if (mesh.geometry.type !== 'CylinderGeometry') return;
      expect((mesh.geometry as THREE.CylinderGeometry).parameters.radiusBottom).toBeLessThanOrEqual(0.28);
    });
  });

  it('fits helms to the smaller head', () => {
    const helm = buildHeadVisual(ITEMS.bronze_helm);
    const dome = solidMeshes(helm).find((mesh) => mesh.geometry.type === 'SphereGeometry')!;
    expect((dome.geometry as THREE.SphereGeometry).parameters.radius).toBeCloseTo(0.225);
    expect((dome.geometry as THREE.SphereGeometry).parameters.radius).toBeLessThan(0.25);
  });
});
