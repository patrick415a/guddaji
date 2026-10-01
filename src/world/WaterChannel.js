import * as THREE from "three";

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWaveAmplitude;
  uniform float uWaveFrequency;
  uniform float uFlowSpeed;

  varying vec2 vUv;
  varying vec2 vPatternUv;
  uniform vec2 uPatternSize;
  varying float vWave;
  varying vec2 vWorldXZ;

  void main() {
    vUv = uv;

    vec3 transformed = position;
    vPatternUv = transformed.xz / uPatternSize + 0.5;
    float longWave = sin(
      transformed.z * uWaveFrequency - uTime * uFlowSpeed
    );
    float crossWave = sin(
      transformed.x * uWaveFrequency * 1.7 + uTime * uFlowSpeed * 0.65
    );
    vWave = longWave * 0.65 + crossWave * 0.35;
    transformed.y += vWave * uWaveAmplitude;
    vWorldXZ = (modelMatrix * vec4(transformed, 1.0)).xz;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uNightMix;
  uniform float uEdgeFade;
  uniform float uFlowSpeed;
  uniform float uFlowStrength;
  uniform float uRippleStrength;
  uniform float uPuffStrength;
  uniform vec3 uShallowColor;
  uniform vec3 uDeepColor;
  uniform vec2 uBackdropAxis;
  uniform vec2 uBackdropRange;

  varying vec2 vUv;
  varying vec2 vPatternUv;
  varying float vWave;
  varying vec2 vWorldXZ;

  // 작은 원형 패치들을 부드럽게 이어 물 표면이 몽글하게 보이게 합니다.
  float softBlob(vec2 uv, float scale, float time, float phase) {
    vec2 tiled = uv * scale;
    vec2 cell = floor(tiled);
    vec2 local = fract(tiled) - 0.5;
    vec2 drift = vec2(
      sin(cell.x * 2.17 + cell.y * 1.31 + time + phase),
      cos(cell.x * 1.73 - cell.y * 2.11 + time * 0.8 + phase)
    ) * 0.12;
    return 1.0 - smoothstep(0.17, 0.48, length(local - drift));
  }

  void main() {
    vec2 patternUv = vPatternUv;
    float broadFlow = sin(
      patternUv.y * 34.0 - uTime * uFlowSpeed * 2.2 + sin(patternUv.x * 10.0) * 0.8
    );
    float fineFlow = sin(
      patternUv.y * 72.0 - uTime * uFlowSpeed * 3.1 + patternUv.x * 13.0
    );
    float movingHighlight =
      smoothstep(0.42, 0.95, broadFlow) * uFlowStrength +
      smoothstep(0.72, 1.0, fineFlow) * uFlowStrength * 0.15;
    float colorMix = clamp(
      0.42 + vWave * 0.1 + broadFlow * 0.035 + movingHighlight,
      0.0,
      1.0
    );
    vec3 waterColor = mix(uDeepColor, uShallowColor, colorMix);

    // 얇은 리본형 하이라이트가 시간에 따라 미끄러지며 찰랑이는 느낌을 만듭니다.
    float ribbonWave = sin(
      patternUv.y * 48.0 - uTime * uFlowSpeed * 3.8 + sin(patternUv.x * 12.0) * 1.2
    );
    float crossRibbon = sin(
      patternUv.x * 31.0 + uTime * uFlowSpeed * 2.4 + patternUv.y * 7.0
    );
    float ribbonLight = (
      smoothstep(0.84, 0.99, ribbonWave) * 0.7 +
      smoothstep(0.88, 1.0, crossRibbon) * 0.3
    ) * uRippleStrength;
    waterColor = mix(
      waterColor,
      vec3(0.86, 0.98, 1.0),
      ribbonLight * 0.7
    );

    // 물결 위를 천천히 떠다니는 둥근 빛 덩어리입니다.
    float puffA = softBlob(
      patternUv + vec2(uTime * uFlowSpeed * 0.018, -uTime * uFlowSpeed * 0.028),
      3.6,
      uTime * uFlowSpeed * 0.45,
      0.0
    );
    float puffB = softBlob(
      patternUv + vec2(-uTime * uFlowSpeed * 0.012, uTime * uFlowSpeed * 0.02),
      5.8,
      uTime * uFlowSpeed * 0.32,
      2.4
    );
    float puffyLight = (puffA * 0.62 + puffB * 0.38) * uPuffStrength;
    waterColor = mix(
      waterColor,
      vec3(0.9, 0.985, 1.0),
      puffyLight
    );

    float edgeDistance = min(
      min(vUv.x, 1.0 - vUv.x),
      min(vUv.y, 1.0 - vUv.y)
    );
    float edgeAlpha = smoothstep(0.0, uEdgeFade, edgeDistance);

    // 카메라 이동에 따라 경계가 따라오지 않도록 월드 좌표에서 처리합니다.
    float backdropAlpha = smoothstep(uBackdropRange.x, uBackdropRange.y, dot(vWorldXZ, uBackdropAxis));
    waterColor *= mix(vec3(1.0), vec3(0.42, 0.55, 0.76), uNightMix);
    gl_FragColor = vec4(waterColor, uOpacity * edgeAlpha * backdropAlpha);
  }
`;

export class WaterChannel extends THREE.Mesh {
  constructor(config) {
    const geometry = new THREE.PlaneGeometry(
      config.crossWidth,
      config.flowLength,
      config.segments[0],
      config.segments[1],
    );
    geometry.rotateX(-Math.PI / 2);

    const uniforms = {
      uTime: { value: 0 },
      uNightMix: { value: 0 },
      uBackdropAxis: { value: new THREE.Vector2(...(config.backdropFade?.axis ?? [0, 1])) },
      uBackdropRange: { value: new THREE.Vector2(config.backdropFade?.hiddenAt ?? -10000, config.backdropFade?.fullAt ?? -9999) },
      uPatternSize: { value: new THREE.Vector2(...(config.patternSize ?? [config.crossWidth, config.flowLength])) },
      uWaveAmplitude: { value: config.waveAmplitude },
      uWaveFrequency: { value: config.waveFrequency },
      uFlowSpeed: { value: config.flowSpeed },
      uOpacity: { value: config.opacity },
      uEdgeFade: { value: config.edgeFade },
      uFlowStrength: { value: config.flowStrength },
      uRippleStrength: { value: config.rippleStrength },
      uPuffStrength: { value: config.puffStrength },
      uShallowColor: { value: new THREE.Color(config.colors.shallow) },
      uDeepColor: { value: new THREE.Color(config.colors.deep) },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: true,
    });

    super(geometry, material);

    this.name = "water-channel";
    this.position.fromArray(config.position);
    this.rotation.y = config.rotationY;
    this.frustumCulled = false;
  }

  update(deltaTime) {
    this.material.uniforms.uTime.value += deltaTime;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
