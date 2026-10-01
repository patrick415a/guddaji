export const ASSET_PATHS = {
  terrain: "/models/low/terrain-low.glb",
  character: "/models/guddaji-human.glb",
  bridge: "/models/low/bridge-low.glb",
};

// 카메라 구도는 이 값들만 바꿔서 조정할 수 있습니다.
// PC는 최대 1920px, 작은 화면은 사용 가능한 영역을 채웁니다.
export const VIEWPORT_CONFIG = { maxWidth: 1920 };

// reference로 바꾸면 정면 시점 테스트 전 구도로 복원됩니다.
export const CAMERA_PRESET = "frontPreview";
export const CAMERA_PRESETS = {
  original: { fov: 20, position: [-8, 4.5, 15.5], lookAt: [-0.5, 0.85, 0] },
  reference: { fov: 19, position: [-8, 9.5, 15.5], lookAt: [-0.5, 1.35, -0.5] },
  // 내려다보는 각도만 약 4도 낮추고 거리는 거의 유지합니다.
  frontPreview: { fov: 19, position: [-8.26, 8, 16.05], lookAt: [-0.5, 1.35, -0.5] },
};

export const CAMERA_CONFIG = {
  fov: 20,
  referenceAspect: 16 / 9,
  near: 0.2,
  far: 140,
  // position: [-11.5, 10, 15.5],
  position: [-8, 4.5, 15.5],
  lookAt: [-0.5, 0.85, 0],
  ...CAMERA_PRESETS[CAMERA_PRESET],
  followOnDesktop: true, // false로 바꾸면 PC는 기존 고정 구도로 복원됩니다.
  // 섬 끝에서는 추적을 멈춰 무대 바깥의 노출을 줄입니다.
  followBounds: { minX: -2.6, maxX: 2.8, minZ: -3.8, maxZ: 3.8 },
  desktopFollow: {
    positionSpeed: 2.2, // 작을수록 X/Z를 느긋하게 따라갑니다.
    lookAtSpeed: 2.2, // 위치와 같으면 이동 중 카메라 각도가 안정적입니다.
    verticalInfluence: 0.04, // 캐릭터 높이 변화의 4%만 반영
    verticalSpeed: 0.8,
    maxVerticalOffset: 0.06, // 기준 높이에서 최대 변화량
  },
  mobile: {
    breakpoint: 900,
    fov: 26,
    distanceScale: 0.62,
    targetHeight: 0.55,
    minVisibleWidth: 3.6,
    followSpeed: 8,
    extraSkyHeight: 136, // 세로 화면에서 위쪽 하늘에 배분할 추가 공간(px)
  },
};

export const RENDERER_CONFIG = {
  maxPixelRatio: 1.75,
  clearColor: 0xc8eaff,
  clearAlpha: 0,
  exposure: 1.0,
};

// original로 바꾸면 조정 전 조명으로 복원됩니다.
export const LIGHTING_PRESET = "gentleDaylight";
export const LIGHTING_PRESETS = {
  gentleDaylight: {
    hemisphere: { skyColor: 0xe7f2ff, groundColor: 0xdad0c3, intensity: 1.48 },
    // 높은 햇빛으로 그림자를 발밑 가까이 줄이고 경계를 연하게 처리합니다.
    sun: { color: 0xffe2bd, intensity: 2.8, position: [-5, 16, 4], shadowRadius: 3.5, shadowIntensity: 0.52 },
    glow: { enabled: false },
  },
  softSunlight: {
    hemisphere: { skyColor: 0xeef4ff, groundColor: 0xe3d8c8, intensity: 1.65 },
    sun: { color: 0xffe6c5, intensity: 3.0, position: [-10, 10, 6], shadowRadius: 3, shadowIntensity: 0.7 },
    glow: { enabled: true, strength: 0.16, threshold: 1.05, knee: 0.4, resolutionScale: 0.25 },
  },
  warmSunlight: {
    // 주변광을 줄여 옆에서 들어오는 따뜻한 햇빛이 드러나도록 합니다.
    hemisphere: { skyColor: 0xeaf2ff, groundColor: 0xe3cfb4, intensity: 1.25 },
    sun: {
      color: 0xffd09b,
      intensity: 3.6,
      position: [-10, 8, 4],
      shadowRadius: 3,
      shadowIntensity: 0.65,
    },
  },
  original: {
    hemisphere: { skyColor: 0xe9f8ff, groundColor: 0xd8c9f2, intensity: 2.15 },
    sun: { color: 0xfff1d8, intensity: 3.2 },
  },
  soft: {
    hemisphere: { skyColor: 0xeef8ff, groundColor: 0xdce5ef, intensity: 2.2 },
    sun: { color: 0xfff0e2, intensity: 3.0 },
  },
  // 주변광을 낮추고 햇빛 비중을 높여 둥근 형태가 더 잘 드러나게 합니다.
  warmDepth: {
    hemisphere: { skyColor: 0xe8f4ff, groundColor: 0xd7e1eb, intensity: 1.6 },
    sun: { color: 0xffe6cd, intensity: 3.8 },
  },
};

export const LIGHTING_CONFIG = {
  // original 선택 시 번짐도 자동으로 꺼집니다. warmSunlight는 직전 시안입니다.
  glow: LIGHTING_PRESETS[LIGHTING_PRESET].glow ?? { enabled: false },
  hemisphere: {
    ...LIGHTING_PRESETS[LIGHTING_PRESET].hemisphere,
  },
  sun: {
    position: [-8, 14, 10],
    shadowRadius: 1,
    shadowIntensity: 1,
    shadowMapSize: 2048,
    shadowArea: 16,
    ...LIGHTING_PRESETS[LIGHTING_PRESET].sun,
  },
};

export const MODEL_CONFIG = {
  terrain: {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: 10,
  },
  character: {
    position: [-0.45, 1.22, -0.88],
    rotation: [0, -0.25, 0],
    scale: 1.5,
  },
  bridge: {
    position: [-0.43, 0.45, 3.25],
    rotation: [0, -1.75, 0],
    scale: [1.4, 1, 0.8],
  },
};

export const CHARACTER_CONFIG = {
  // 새 GLB의 기준 높이 3을 이전 모델 높이 1에 맞춥니다.
  assetScale: 1 / 3,
  moveSpeed: 1.5,
  runSpeed: 2.5,
  // 원본 점프 동작을 과도하게 압축하지 않도록 체공 시간을 여유 있게 둡니다.
  jump: { height: 0.45, duration: 1.45 }, // 폴짝 높이·체공 시간(초)
  postureSpeed: 4, // 일어나기 재생 속도
  sitDownSpeed: 4, // 앉기 재생 속도
  rotationSpeed: 5,
  animationFadeDuration: 0.55,
  idlePlaybackSpeed: 0.35,
  // false로 바꾸면 원본 Walk로 복귀합니다. 각도는 라디안입니다.
  walkRefinement: {
    enabled: false,
    playbackSpeed: 1.15,
    swingScale: { 오른팔: 0.65, 왼쪽팔: 0.65, 오른발: 0.9, 왼발: 0.9 },
    bodyRoll: 0.02,
    bodyTwist: 0.025,
  },
  animationClips: {
    idle: "Happy_Sway_Standing",
    walk: "Walking",
    run: "Running",
    jump: "Regular_Jump",
    sit: "Sit_to_Stand_Transition_M",
  },
  // 현재 파일은 앉음 → 일어남입니다. 내부에서는 서기 → 앉기로 통일합니다.
  sitClipReversed: true,
};

export const WALKABLE_CONFIG = {
  spatialCellSize: 0.35,
  groundClearance: 0.025,
  edgeProbeDistance: 0.3,
  bridgeEdgeProbeDistance: 0.12,
  maxSlopeDegrees: 48,
  maxStepHeight: 0.35,
  bridgeHeight: {
    sampleSpacing: 0.025, // 월드 단위: 다리 높이 측정 간격
    approachDistance: 0.5, // 양쪽 진입로까지 완만하게 연결
    maxGrade: 0.55, // 수평 1 이동당 최대 높이 변화
  },
  bridgeCorridor: {
    halfLength: 0.85,
    halfWidth: 0.8,
  },
};

export const WATER_CONFIG = {
  position: [-2.2, -0.25, 3.4],
  rotationY: -0.64,
  crossWidth: 100,
  flowLength: 100,
  patternSize: [20, 14], // 확장해도 물결 크기는 유지합니다.
  segments: [96, 96],
  colors: {
    shallow: 0xd8f4f8,
    deep: 0xaadbea,
  },
  opacity: 0.88,
  edgeFade: 0.09,
  // 산 뒤의 먼 물만 하늘로 부드럽게 연결합니다(월드 X/Z 기준).
  backdropFade: { axis: [-0.424, 0.906], hiddenAt: -18, fullAt: -8 },
  waveAmplitude: 0.05,
  waveFrequency: 1.55,
  flowSpeed: 1.15,
  flowStrength: 0.14,
  rippleStrength: 0.2,
  puffStrength: 0.22,
};
