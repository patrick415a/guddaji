import * as THREE from "three";

export class ResponsiveCamera {
  constructor(camera, config) {
    this.camera = camera;
    this.config = config;
    this.fixedPosition = new THREE.Vector3().fromArray(config.position);
    this.fixedTarget = new THREE.Vector3().fromArray(config.lookAt);
    this.baseOffset = this.fixedPosition.clone().sub(this.fixedTarget);
    this.offset = this.baseOffset.clone();
    this.target = this.fixedTarget.clone();
    this.positionTarget = this.fixedTarget.clone();
    this.desiredTarget = new THREE.Vector3();
    this.initialized = false;
  }

  resize(width, height, character) {
    const { camera, config } = this;
    const aspect = width / Math.max(height, 1);
    const previousMobile = this.isMobile;
    const previousFollow = this.follow;
    this.isMobile = width < config.mobile.breakpoint;
    // PC도 모바일과 같은 확대 배율과 부드러운 캐릭터 추적을 사용합니다.
    this.follow = config.followOnDesktop || width < config.mobile.breakpoint;
    camera.aspect = aspect;
    camera.fov = this.follow ? config.mobile.fov : THREE.MathUtils.radToDeg(
      2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(config.fov / 2)) *
        Math.max(1, config.referenceAspect / aspect)),
    );
    camera.updateProjectionMatrix();
    camera.clearViewOffset();
    if (this.follow && height > width) {
      // 늘어난 세로 공간은 하늘 쪽으로: 각도/추적 방향은 바꾸지 않습니다.
      const skySpace = Math.min(config.mobile.extraSkyHeight ?? 0, height * 0.2);
      camera.setViewOffset(width, height, 0, -skySpace / 2, width, height);
    }
    if (this.follow) {
      // 세로 화면에서도 주변 길이 보이도록 최소 가로 시야를 확보합니다.
      const minDistance = config.mobile.minVisibleWidth /
        (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect);
      this.offset.copy(this.baseOffset).setLength(Math.max(
        this.baseOffset.length() * config.mobile.distanceScale, minDistance,
      ));
      // 해상도 품질 변경 시에는 진행 중인 추적 보간을 유지합니다.
      this.update(0, character, !this.initialized || previousMobile !== this.isMobile || !previousFollow);
    } else {
      // 넓은 화면으로 돌아오면 사용자가 정한 PC 구도를 정확히 복원합니다.
      camera.position.copy(this.fixedPosition);
      camera.lookAt(this.fixedTarget);
    }
  }

  update(delta, character, snap = false) {
    if (!this.follow || !character) return;
    this.referenceHeight ??= character.position.y;
    this.desiredTarget.copy(character.position);
    this.desiredTarget.y += this.config.mobile.targetHeight;
    const desktop = !this.isMobile ? this.config.desktopFollow : null;
    if (desktop) {
      // 다리·점프·앉기 높이가 카메라를 위아래로 흔들지 않게 제한합니다.
      this.desiredTarget.y = this.referenceHeight + this.config.mobile.targetHeight +
        THREE.MathUtils.clamp((character.position.y - this.referenceHeight) * desktop.verticalInfluence,
          -desktop.maxVerticalOffset, desktop.maxVerticalOffset);
    }
    const bounds = this.config.followBounds;
    if (bounds) {
      this.desiredTarget.x = THREE.MathUtils.clamp(this.desiredTarget.x, bounds.minX, bounds.maxX);
      this.desiredTarget.z = THREE.MathUtils.clamp(this.desiredTarget.z, bounds.minZ, bounds.maxZ);
    }
    if (snap || !this.initialized) {
      this.target.copy(this.desiredTarget);
      this.positionTarget.copy(this.desiredTarget);
      this.initialized = true;
    } else {
      const dt = Math.max(0, delta);
      const positionAlpha = 1 - Math.exp(-(desktop?.positionSpeed ?? this.config.mobile.followSpeed) * dt);
      const lookAlpha = 1 - Math.exp(-(desktop?.lookAtSpeed ?? this.config.mobile.followSpeed) * dt);
      const verticalAlpha = desktop ? 1 - Math.exp(-desktop.verticalSpeed * dt) : positionAlpha;
      // 위치와 시선 모두 프레임률에 관계없이 부드럽게 보간합니다.
      for (const axis of ["x", "z"]) {
        this.positionTarget[axis] = THREE.MathUtils.lerp(this.positionTarget[axis], this.desiredTarget[axis], positionAlpha);
        this.target[axis] = THREE.MathUtils.lerp(this.target[axis], this.desiredTarget[axis], lookAlpha);
      }
      this.positionTarget.y = THREE.MathUtils.lerp(this.positionTarget.y, this.desiredTarget.y, verticalAlpha);
      this.target.y = THREE.MathUtils.lerp(this.target.y, this.desiredTarget.y, verticalAlpha);
    }
    this.camera.position.copy(this.positionTarget).add(this.offset);
    this.camera.lookAt(this.target);
  }
}
