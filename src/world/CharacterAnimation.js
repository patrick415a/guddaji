import * as THREE from "three";

// GLB의 재생 방향을 Stand → Sit 순서로 통일합니다.
// Sit은 LoopOnce로 재생하고, 끝 자세를 유지합니다.
export class CharacterAnimation {
  constructor(root, config, clips, onChange = () => {}) {
    this.config = config;
    this.onChange = onChange;
    this.state = "standing";

    this.mixer = new THREE.AnimationMixer(root);

    const find = (name) => {
      const clip = THREE.AnimationClip.findByName(clips, name);

      if (!clip) {
        throw new Error(
          `구따지 애니메이션을 찾지 못했습니다: ${name}. 파일에 있는 동작: ${clips.map((clip) => clip.name).join(", ")}`
        );
      }

      return clip;
    };

    // -----------------------------
    // Sit 기준 골반 트랙 확인
    // -----------------------------

    const sit = find(config.animationClips.sit).clone();
    if (config.sitClipReversed) {
      // 키의 시간과 값을 함께 뒤집어 앉기/역재생 일어나기 로직을 유지합니다.
      for (const track of sit.tracks) {
        const times = track.times.slice();
        const values = track.values.slice();
        const size = track.getValueSize();
        for (let i = 0; i < times.length; i += 1) {
          const source = times.length - 1 - i;
          track.times[i] = sit.duration - times[source];
          track.values.set(values.subarray(source * size, (source + 1) * size), i * size);
        }
      }
    }

    const hipsTrack = sit.tracks.find(
      (track) => track.name === "mixamorigHips.position"
    );

    if (!hipsTrack) {
      throw new Error(
        "새 구따지의 골반 위치 트랙을 찾지 못했습니다."
      );
    }

    // 기본 Idle과 이동의 수평 기준을 맞춰 전환할 때 몸이 튀지 않게 합니다.
    const anchor = root.getObjectByName("mixamorigHips")?.position.toArray()
      ?? hipsTrack.values.slice(0, 3);

    // -----------------------------
    // 애니메이션의 수평 이동 제거
    // 실제 이동은 Three.js 이동 코드가 담당
    // -----------------------------

    const inPlace = (source, lockVertical = false) => {
      const clip = source.clone();

      const track = clip.tracks.find(
        (track) => track.name === hipsTrack.name
      );

      if (track) {
        for (let i = 0; i < track.values.length; i += 3) {
          // X / Z 이동 제거
          track.values[i] = anchor[0];
          track.values[i + 2] = anchor[2];

          // 점프는 코드의 높이 곡선을 사용하므로 골반의 중복 상승을 제거합니다.
          if (lockVertical) track.values[i + 1] = anchor[1];
        }
      }

      return clip;
    };

    // -----------------------------
    // 실제 애니메이션 Clip 준비
    // -----------------------------

    const sitClip = inPlace(sit);
    const idleClip = inPlace(
      find(config.animationClips.idle)
    );
    const walkClip = inPlace(
      find(config.animationClips.walk)
    );
    const runClip = inPlace(
      find(config.animationClips.run)
    );
    const jumpClip = inPlace(
      find(config.animationClips.jump),
      true
    );

    // -----------------------------
    // 앉은 상태의 골반 위치 저장
    // -----------------------------

    const seatedPosition = sitClip.tracks.find(
      (track) => track.name === hipsTrack.name
    );

    this.seatedHip = new THREE.Vector3().fromArray(
      seatedPosition.values,
      seatedPosition.values.length - 3
    );

    // -----------------------------
    // Action 생성
    // -----------------------------

    this.actions = {
      idle: this.mixer.clipAction(idleClip),
      walk: this.mixer.clipAction(walkClip),
      run: this.mixer.clipAction(runClip),
      jump: this.mixer.clipAction(jumpClip),
      sit: this.mixer.clipAction(sitClip),
    };

    // Sit은 한 번만 재생
    this.actions.sit.setLoop(THREE.LoopOnce, 1);

    // 애니메이션 종료 후 마지막 자세 유지
    this.actions.sit.clampWhenFinished = true;
    // 모델 교체 시에도 앉은 옷/허벅지 밑면을 좌판 높이에 맞춥니다.
    this.actions.sit.play();
    this.mixer.update(sitClip.duration);
    root.updateMatrixWorld(true);
    const rootInverse = root.matrixWorld.clone().invert();
    const vertex = new THREE.Vector3();
    let seatedBottomY = Infinity;
    root.traverse((mesh) => {
      if (!mesh.isSkinnedMesh) return;
      mesh.skeleton.update();
      const indices = mesh.geometry.attributes.skinIndex;
      const weights = mesh.geometry.attributes.skinWeight;
      if (!indices || !weights) return;
      const seatBones = new Set(mesh.skeleton.bones.flatMap((bone, index) =>
        /Hips|UpLeg|Spine/.test(bone.name) ? [index] : []));
      const toRoot = rootInverse.clone().multiply(mesh.matrixWorld);
      for (let i = 0; i < indices.count; i++) {
        let influence = 0;
        for (let j = 0; j < 4; j++) {
          if (seatBones.has(indices.getComponent(i, j))) influence += weights.getComponent(i, j);
        }
        if (influence <= 0.6) continue;
        mesh.getVertexPosition(i, vertex).applyMatrix4(toRoot);
        seatedBottomY = Math.min(seatedBottomY, vertex.y);
      }
    });
    this.seatedBottomY = Number.isFinite(seatedBottomY) ? seatedBottomY : null;
    this.actions.sit.stop();
    this.actions.jump.setLoop(THREE.LoopOnce, 1);
    this.actions.jump.clampWhenFinished = true;
    this.actions.jump.setEffectiveTimeScale(
      this.actions.jump.getClip().duration / (this.config.jump?.duration ?? 0.65)
    );

    // 대기 모션은 조금 느리게 재생해 호흡하듯 보이게 합니다.
    this.actions.idle.setEffectiveTimeScale(
      this.config.idlePlaybackSpeed ?? 1
    );

    // 기본 상태는 GLB의 실제 Idle 애니메이션
    this.active = this.actions.idle;
    this.active.play();

    // 초기 상태 적용
    this.mixer.update(0);
    root.updateMatrixWorld(true);
    root.traverse((mesh) => { if (mesh.isSkinnedMesh) mesh.skeleton.update(); });

    // -----------------------------
    // Sit 애니메이션 종료 처리
    // -----------------------------

    this.finished = ({ action }) => {
      if (action !== this.actions.sit) return;

      if (this.state === "sittingDown") {
        this.setState("seated");
      } else if (this.state === "standingUp") {
        this.setState("standing");

        // 다시 기본 서 있는 자세로 복귀
        this.play(this.actions.idle);
      }
    };

    this.mixer.addEventListener(
      "finished",
      this.finished
    );
  }

  // -----------------------------
  // 상태 변경
  // -----------------------------

  setState(state) {
    this.state = state;
    this.onChange(state);
  }

  // -----------------------------
  // 애니메이션 전환
  // -----------------------------

  play(action, fadeDuration = this.config.animationFadeDuration) {
    if (this.active === action) return;

    const previous = this.active;

    action
      .reset()
      .setEffectiveWeight(1)
      .fadeIn(fadeDuration)
      .play();

    previous.fadeOut(
      fadeDuration
    );

    this.active = action;
  }

  // -----------------------------
  // 앉기 / 일어서기 토글
  // -----------------------------

  toggleSit() {
    if (this.state === "standing") {
      this.transition(false);
    } else if (this.state === "seated") {
      this.transition(true);
    }
  }

  // -----------------------------
  // Sit 정방향 / 역방향 재생
  // -----------------------------

  transition(standUp) {
    const action = this.actions.sit;
    const previous = this.active;

    action
      .reset()
      .setEffectiveWeight(1);

    // 일어설 때는 Sit 마지막 프레임부터 시작
    action.time = standUp
      ? action.getClip().duration
      : 0;

    // Sit 역재생으로 일어서기
    action.setEffectiveTimeScale(
      standUp
        ? -this.config.postureSpeed
        : (this.config.sitDownSpeed ?? this.config.postureSpeed)
    );

    if (previous !== action) {
      action.fadeIn(
        this.config.animationFadeDuration
      );

      previous.fadeOut(
        this.config.animationFadeDuration
      );
    }

    action.play();

    this.active = action;

    this.setState(
      standUp
        ? "standingUp"
        : "sittingDown"
    );
  }

  // -----------------------------
  // 이동 가능 여부
  // 앉아 있을 때 이동하면 자동으로 일어남
  // -----------------------------

  canMove(wantsMove) {
    if (
      this.state === "seated" &&
      wantsMove
    ) {
      this.transition(true);
    }

    return this.state === "standing";
  }

  // -----------------------------
  // Walk / Run
  // -----------------------------

  locomotion(name, fadeDuration) {
    if (this.state === "standing") {
      this.play(this.actions[name], fadeDuration);
    }
  }

  // 점프 중에는 GLB의 실제 점프 포즈를 재생합니다.
  jump() {
    if (this.state !== "standing") return;

    const action = this.actions.jump;
    const previous = this.active;

    action
      .reset()
      .setEffectiveWeight(1)
      .setEffectiveTimeScale(
        action.getClip().duration / (this.config.jump?.duration ?? 0.65)
      )
      .fadeIn(this.config.animationFadeDuration)
      .play();

    previous.fadeOut(this.config.animationFadeDuration);
    this.active = action;
  }

  // -----------------------------
  // Mixer 업데이트
  // -----------------------------

  update(delta) {
    this.mixer.update(delta);
  }

  // -----------------------------
  // 정리
  // -----------------------------

  dispose() {
    this.mixer.removeEventListener(
      "finished",
      this.finished
    );

    this.mixer.stopAllAction();
  }
}
