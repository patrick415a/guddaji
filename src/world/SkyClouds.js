import * as THREE from "three";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";

const CLOUD_LOBES = [
  // 간격을 둔 세 봉우리와 낮고 긴 밑면으로 구름의 윤곽을 만듭니다.
  [-1.22, 0.3, 0, 0.66],
  [-0.25, 0.65, 0, 0.84],
  [0.92, 0.38, 0, 0.7],
  [-1.9, -0.28, 0, 0.48],
  [-1.18, -0.27, 0, 0.5],
  [-0.45, -0.26, 0, 0.52],
  [0.3, -0.26, 0, 0.52],
  [1.05, -0.27, 0, 0.5],
  [1.77, -0.28, 0, 0.48],
];

export class SkyClouds extends THREE.Group {
  constructor(config) {
    super();
    this.elapsed = 0;
    this.clouds = [];
    this.responsiveYOffsetStrength = config.responsiveYOffsetStrength;
    this.cloudMaterial = new THREE.MeshStandardMaterial({
      color: config.color,
      emissive: config.emissive,
      emissiveIntensity: config.emissiveIntensity,
      metalness: 0,
      roughness: 1,
      transparent: true,
      opacity: config.opacity,
      depthWrite: false,
    });
    this.cloudGeometry = this.createCloudGeometry();

    for (const placement of config.placements) {
      const cloud = this.createCloud();
      cloud.position.fromArray(placement.position);
      cloud.scale.setScalar(placement.scale);
      cloud.rotation.y = -0.45;
      cloud.userData.motion = {
        originX: placement.position[0],
        originY: placement.position[1],
        drift: placement.drift,
        speed: placement.speed,
        bob: placement.bob,
        phase: placement.phase,
      };
      this.clouds.push(cloud);
      this.add(cloud);
    }
  }

  createCloudGeometry() {
    const field = new MarchingCubes(
      56,
      this.cloudMaterial,
      false,
      false,
      24000,
    );
    field.isolation = 0;
    field.reset();

    // 거리장을 부드럽게 합쳐 둥근 윤곽과 이음새 없는 하나의 표면을 만듭니다.
    const size = field.size;
    const blend = 0.16;
    for (let z = 0; z < size; z++) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const px = (x / size - 0.5) * 6;
          const py = (y / size - 0.5) * 6;
          const pz = (z / size - 0.5) * 6 / 0.78;
          let distance = 100;
          for (const [cx, cy, cz, radius] of CLOUD_LOBES) {
            const next = Math.hypot(px - cx, py - cy, pz - cz) - radius;
            const h = Math.max(blend - Math.abs(distance - next), 0) / blend;
            distance = Math.min(distance, next) - h * h * blend * 0.25;
          }
          field.field[z * size * size + y * size + x] = -distance;
        }
      }
    }
    field.update();

    // 유효한 삼각형만 보관하고 생성용 필드는 해제합니다.
    const geometry = new THREE.BufferGeometry();
    for (const name of ["position", "normal"]) {
      const attribute = field.geometry.getAttribute(name);
      geometry.setAttribute(name, new THREE.BufferAttribute(
        attribute.array.slice(0, field.count * 3), 3,
      ));
    }
    geometry.scale(3, 3, 3);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    field.geometry.dispose();
    return geometry;
  }

  createCloud() {
    const cloud = new THREE.Mesh(this.cloudGeometry, this.cloudMaterial);
    cloud.castShadow = false;
    cloud.receiveShadow = false;
    return cloud;
  }

  update(deltaTime) {
    this.elapsed += deltaTime;

    for (const cloud of this.clouds) {
      const motion = cloud.userData.motion;
      const cycle = this.elapsed * motion.speed + motion.phase;
      // 화면 레이어가 아니라 월드 좌표 자체를 움직입니다.
      cloud.position.x = motion.originX + Math.sin(cycle) * motion.drift;
      cloud.position.y = motion.originY + Math.sin(cycle * 0.7) * motion.bob;
    }
  }

  setViewportAspect(aspect, referenceAspect) {
    const narrowness = Math.max(0, referenceAspect / aspect - 1);
    // 좁은 화면에서는 카메라 FOV가 넓어지는 만큼 구름만 하늘 쪽으로 보정합니다.
    this.position.y = narrowness * this.responsiveYOffsetStrength;
  }

  dispose() {
    this.cloudGeometry.dispose();
    this.cloudMaterial.dispose();
  }
}
