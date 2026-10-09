import * as THREE from "three";

// 원본 GLB를 바꾸지 않고 반복 모션의 끝/시작을 이어 붙입니다.
// 양쪽 프레임을 함께 샘플링하므로 루프 경계에서도 몸이 갑자기 튀지 않습니다.
export function createLoopClip(source) {
  const clip = source.clone();
  clip.name = source.name + "-loop";
  if (clip.duration <= 0) return clip;
  const count = Math.max(2, Math.ceil(clip.duration * 60));
  const step = clip.duration / count;
  const weights = [1, 4, 6, 4, 1];
  const reference = new THREE.Quaternion();
  const sample = new THREE.Quaternion();

  for (const track of clip.tracks) {
    const size = track.getValueSize();
    const quaternion = track.ValueTypeName === "quaternion";
    if (!quaternion && track.ValueTypeName !== "vector") continue;
    const interpolant = track.createInterpolant();
    const times = new Float32Array(count + 1);
    const values = new Float32Array((count + 1) * size);

    for (let frame = 0; frame < count; frame++) {
      const time = frame * step;
      times[frame] = time;
      if (quaternion) reference.fromArray(interpolant.evaluate(time)).normalize();
      for (let tap = 0; tap < weights.length; tap++) {
        // 경계 밖의 시간은 이전/다음 반복에서 가져와, 끝에서 잠깐 멈추는 현상도 줄입니다.
        const wrapped = ((time + (tap - 2) * step) % clip.duration + clip.duration) % clip.duration;
        const result = interpolant.evaluate(wrapped);
        let weight = weights[tap] / 16;
        if (quaternion) {
          sample.fromArray(result).normalize();
          // q와 -q는 같은 회전입니다. 부호를 맞춰 평균 회전이 상쇄되지 않게 합니다.
          if (reference.dot(sample) < 0) weight = -weight;
          sample.toArray(result);
        }
        for (let component = 0; component < size; component++) {
          values[frame * size + component] += result[component] * weight;
        }
      }
      if (quaternion) sample.fromArray(values, frame * size).normalize().toArray(values, frame * size);
    }
    times[count] = clip.duration;
    values.set(values.subarray(0, size), count * size);
    track.times = times;
    track.values = values;
    track.setInterpolation(THREE.InterpolateLinear);
  }
  return clip;
}
