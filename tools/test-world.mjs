import assert from 'node:assert/strict';
import * as THREE from 'three';
import { loadCharacterForTest } from './loadCharacterForTest.mjs';
import { CharacterAnimation } from '../src/world/CharacterAnimation.js';
import { ResponsiveCamera } from '../src/world/ResponsiveCamera.js';
import { CAMERA_CONFIG, CHARACTER_CONFIG } from '../src/config/worldConfig.js';

const gltf = await loadCharacterForTest();
const warnings = [];
const originalWarn = console.warn;
console.warn = (...args) => warnings.push(args.join(' '));
const animation = new CharacterAnimation(gltf.scene, CHARACTER_CONFIG, gltf.animations);
const hip = gltf.scene.getObjectByName('mixamorigHips');
const advance = (seconds) => {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) animation.update(1 / 60);
};
for (const name of ['walk', 'run', 'idle']) {
  animation.locomotion(name);
  advance(0.8);
  assert.equal(animation.active, animation.actions[name]);
  assert.ok(hip.position.toArray().every(Number.isFinite));
}
const sitPosition = animation.actions.sit.getClip().tracks.find(t => t.name === 'mixamorigHips.position');
assert.ok(sitPosition.values[1] > sitPosition.values.at(-2), '앉을 때 골반 높이가 낮아짐');
for (let cycle = 0; cycle < 3; cycle++) {
  animation.toggleSit();
  assert.equal(animation.canMove(true), false);
  advance(7);
  assert.equal(animation.state, 'seated');
  const seated = hip.position.clone();
  advance(2);
  assert.ok(seated.distanceTo(hip.position) < 1e-6, '앉은 마지막 자세 유지');
  if (cycle % 2) animation.canMove(true);
  else animation.toggleSit();
  advance(7);
  assert.equal(animation.state, 'standing');
  assert.equal(animation.canMove(true), true);
  animation.locomotion('walk');
  advance(1);
}
animation.dispose();
console.warn = originalWarn;
assert.deepEqual(warnings, [], '애니메이션 트랙 바인딩 경고 없음');

const camera = new THREE.PerspectiveCamera();
const responsive = new ResponsiveCamera(camera, CAMERA_CONFIG);
const character = new THREE.Object3D();
for (const [width, height] of [[1920,1080],[1040,912],[390,708],[844,390],[768,888],[1920,1080]]) {
  responsive.resize(width, height, character);
  assert.equal(responsive.follow, width < CAMERA_CONFIG.mobile.breakpoint);
  assert.equal(camera.aspect, width / height);
  if (responsive.follow) {
    character.position.set(2, 1.3, -1);
    for (let i = 0; i < 180; i++) responsive.update(1/60, character);
    camera.updateMatrixWorld();
    const projected = character.position.clone().add(new THREE.Vector3(0, CAMERA_CONFIG.mobile.targetHeight, 0)).project(camera);
    assert.ok(Math.abs(projected.x) < 1e-6 && Math.abs(projected.y) < 1e-6, '캐릭터 중심 추적');
    const distance = camera.position.distanceTo(responsive.target);
    const visibleWidth = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov/2)) * camera.aspect;
    assert.ok(visibleWidth >= CAMERA_CONFIG.mobile.minVisibleWidth - 1e-6);
  } else {
    assert.deepEqual(camera.position.toArray(), CAMERA_CONFIG.position, 'PC 위치 복원');
  }
}
console.log('PASS: 실제 GLB Idle/Walk/Run, 앉기 유지/역재생/반복, 트랙 바인딩, 6개 화면 크기 및 PC 카메라 복원');
