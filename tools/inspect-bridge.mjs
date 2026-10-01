import * as THREE from 'three';
import { loadCharacterForTest } from './loadCharacterForTest.mjs';
import { ASSET_PATHS, MODEL_CONFIG, WALKABLE_CONFIG } from '../src/config/worldConfig.js';
import { WalkableSurface } from '../src/world/WalkableSurface.js';
import { BridgeHeightProfile } from '../src/world/BridgeHeightProfile.js';
import assert from 'node:assert/strict';
const surfaces = {};
const objects = {};
for (const name of ['terrain', 'bridge']) {
  const {scene} = await loadCharacterForTest(ASSET_PATHS[name]);
  const config = MODEL_CONFIG[name];
  scene.position.fromArray(config.position);
  scene.rotation.fromArray(config.rotation);
  if (Array.isArray(config.scale)) scene.scale.fromArray(config.scale);
  else scene.scale.setScalar(config.scale);
  scene.updateMatrixWorld(true);
  objects[name] = scene;
  surfaces[name] = new WalkableSurface(scene, {
    cellSize: WALKABLE_CONFIG.spatialCellSize,
    maxSlopeDegrees: WALKABLE_CONFIG.maxSlopeDegrees,
    heightMode: name === 'bridge' ? 'lowest' : 'highest',
  });
}
const profile = new BridgeHeightProfile(objects.bridge, surfaces.terrain, surfaces.bridge,
  WALKABLE_CONFIG.bridgeCorridor, WALKABLE_CONFIG.bridgeHeight);
let oldJump = 0;
let newJump = 0;
for (const z of [-0.6, -0.3, 0, 0.3, 0.6]) {
  let previous = null;
  for (let x = -1.3; x <= 1.3; x += 0.005) {
    const point = objects.bridge.localToWorld(new THREE.Vector3(x,0,z));
    const center = objects.bridge.localToWorld(new THREE.Vector3(x,0,0));
    const t = surfaces.terrain.getHeightAt(point.x, point.z);
    const b = Math.abs(x) <= WALKABLE_CONFIG.bridgeCorridor.halfLength
      ? surfaces.bridge.getHeightAt(center.x, center.z) : null;
    const raw = t == null ? b : b == null ? t : Math.max(t,b);
    const height = profile.getHeight(point, raw);
    if (raw == null) {
      assert.equal(height, null, '물 위 이동 가능 영역을 추가하지 않음');
      previous = null;
      continue;
    }
    assert.ok(height >= raw - 1e-8, '발이 기존 데크 높이 아래로 내려가지 않음');
    if (previous) {
      oldJump = Math.max(oldJump, Math.abs(raw - previous.raw));
      newJump = Math.max(newJump, Math.abs(height - previous.height));
    }
    previous = {raw,height};
  }
}
assert.ok(newJump < 0.025, `보정 후 높이 급변: ${newJump}`);
assert.ok(newJump < oldJump / 4);
console.log('PASS: 실제 다리 GLB 5개 횡단 경로, 데크 관통/물 이동 방지', { oldJump, newJump });
