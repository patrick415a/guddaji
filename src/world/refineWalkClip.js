import * as THREE from "three";

// 기존 회전의 방향·좌우 위상은 보존하고 왕복 끝의 꺾임과 루프 이음새를 줄입니다.
export function refineWalkClip(source, config) {
  if (!config.enabled) return source;
  const clip = source.clone();
  clip.name = `${source.name}-refined`;
  const count = 60;
  const axis = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const offset = new THREE.Quaternion();

  for (const track of clip.tracks) {
    if (!track.name.endsWith(".quaternion")) continue;
    const name = track.name.slice(0, -11);
    const gain = config.swingScale[name];
    const body = name === "몸통";
    const head = name === "대가리";
    if (gain === undefined && !body && !head) continue;
    const base = new THREE.Quaternion().fromArray(track.values).normalize();
    const inverse = base.clone().invert();
    const mean = new THREE.Vector3();
    const cosine = new THREE.Vector3();
    const sine = new THREE.Vector3();
    const interpolant = track.createInterpolant();

    if (gain !== undefined) {
      for (let i = 0; i < count; i++) {
        const phase = i / count * Math.PI * 2;
        q.fromArray(interpolant.evaluate(i / count * clip.duration)).normalize();
        q.premultiply(inverse);
        if (q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w);
        const length = Math.hypot(q.x, q.y, q.z);
        axis.set(q.x, q.y, q.z).multiplyScalar(
          length > 1e-8 ? 2 * Math.atan2(length, q.w) / length : 0,
        );
        mean.addScaledVector(axis, 1 / count);
        cosine.addScaledVector(axis, 2 * Math.cos(phase) / count);
        sine.addScaledVector(axis, 2 * Math.sin(phase) / count);
      }
    }

    const times = [];
    const values = [];
    for (let i = 0; i <= count; i++) {
      const phase = (i % count) / count * Math.PI * 2;
      if (gain !== undefined) {
        axis.copy(mean)
          .addScaledVector(cosine, Math.cos(phase) * gain)
          .addScaledVector(sine, Math.sin(phase) * gain);
        const angle = axis.length();
        offset.setFromAxisAngle(angle > 1e-8 ? axis.divideScalar(angle) : axis.set(1, 0, 0), angle);
      } else {
        // 발과 루트 높이는 그대로 두고 상체에만 작은 무게 이동을 더합니다.
        const amount = body ? 1 : -0.4;
        offset.setFromEuler(new THREE.Euler(
          0,
          Math.sin(phase) * config.bodyTwist * amount,
          Math.cos(phase) * config.bodyRoll * amount,
        ));
      }
      q.copy(base).multiply(offset).normalize();
      times.push(i / count * clip.duration);
      values.push(...q.toArray());
    }
    track.times = new Float32Array(times);
    track.values = new Float32Array(values);
    track.setInterpolation(THREE.InterpolateLinear);
  }
  return clip;
}
