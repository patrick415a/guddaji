import * as THREE from "three";

const cross = (a, b, c) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);

// 실제 정점을 위에서 본 외곽선으로 묶어 사각형 모서리의 빈 공간을 제거합니다.
export function createFootprintCollider(object, margin) {
  const points = [];
  const vertex = new THREE.Vector3();
  object.updateMatrixWorld(true);
  object.traverse((child) => {
    if (!child.isMesh) return;
    const positions = child.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i).applyMatrix4(child.matrixWorld);
      points.push({ x: vertex.x, z: vertex.z });
    }
  });
  points.sort((a, b) => a.x - b.x || a.z - b.z);
  const unique = points.filter((p, i) => !i || p.x !== points[i - 1].x || p.z !== points[i - 1].z);
  if (unique.length < 3) return null;
  const half = (list) => {
    const result = [];
    for (const p of list) {
      while (result.length >= 2 && cross(result.at(-2), result.at(-1), p) <= 0) result.pop();
      result.push(p);
    }
    return result.slice(0, -1);
  };
  const hull = [...half(unique), ...half([...unique].reverse())];
  if (hull.length < 3) return null;
  return { hull, margin };
}

export function isInsideFootprint(position, { hull, margin }) {
  let inside = true;
  let distanceSquared = Infinity;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    if (cross(a, b, position) < 0) inside = false;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = THREE.MathUtils.clamp(((position.x - a.x) * dx + (position.z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
    distanceSquared = Math.min(distanceSquared, (position.x - a.x - t * dx) ** 2 + (position.z - a.z - t * dz) ** 2);
  }
  // 캐릭터 반경만큼 여유를 남겨 꽃 내부에 겹치는 것은 막습니다.
  return inside || distanceSquared <= margin * margin;
}
