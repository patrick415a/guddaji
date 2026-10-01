import * as THREE from "three";

// 데크보다 낮아지지 않는 완만한 높이 경로. 이동 가능 영역은 확장하지 않습니다.
export class BridgeHeightProfile {
  constructor(bridge, terrain, deck, corridor, config) {
    this.bridge = bridge;
    this.corridor = corridor;
    this.config = config;
    this.local = new THREE.Vector3();
    bridge.updateMatrixWorld(true);
    const scale = bridge.getWorldScale(new THREE.Vector3());
    this.scaleX = Math.abs(scale.x);
    this.scaleZ = Math.abs(scale.z);
    this.extent = corridor.halfLength + config.approachDistance / this.scaleX;
    const count = Math.ceil(2 * this.extent * this.scaleX / config.sampleSpacing);
    this.step = 2 * this.extent / count;
    this.heights = [];
    const point = new THREE.Vector3();
    for (let i = 0; i <= count; i++) {
      const x = -this.extent + i * this.step;
      bridge.localToWorld(point.set(x, 0, 0));
      const ground = terrain.getHeightAt(point.x, point.z);
      const top = Math.abs(x) <= corridor.halfLength ? deck.getHeightAt(point.x, point.z) : null;
      this.heights.push(Math.max(ground ?? -Infinity, top ?? -Infinity));
    }
    // 앞/뒤로 경사 제한을 적용해 튀어나온 끝판 전후에 진입 곡선을 만듭니다.
    const rise = config.maxGrade * this.step * this.scaleX;
    for (let i = 1; i < this.heights.length; i++) {
      this.heights[i] = Math.max(this.heights[i], this.heights[i - 1] - rise);
    }
    for (let i = this.heights.length - 2; i >= 0; i--) {
      this.heights[i] = Math.max(this.heights[i], this.heights[i + 1] - rise);
    }
  }

  getHeight(position, rawHeight) {
    if (rawHeight == null) return null; // 물이나 막힌 구역은 여전히 통과 불가
    this.bridge.worldToLocal(this.local.copy(position));
    const { x, z } = this.local;
    if (Math.abs(x) >= this.extent) return rawHeight;
    const index = (x + this.extent) / this.step;
    const left = Math.floor(index);
    const height = THREE.MathUtils.lerp(this.heights[left], this.heights[left + 1], index - left);
    // 진입로 옆으로 빠져나갈 때도 높이가 갑자기 끊기지 않게 합니다.
    const sideDistance = Math.max(0, Math.abs(z) - this.corridor.halfWidth) * this.scaleZ;
    const support = height - sideDistance * this.config.maxGrade;
    const boundaryBlend = THREE.MathUtils.smoothstep(
      (this.extent - Math.abs(x)) * this.scaleX, 0, this.config.approachDistance * 0.3,
    );
    return Number.isFinite(support)
      ? rawHeight + Math.max(0, support - rawHeight) * boundaryBlend
      : rawHeight;
  }
}
