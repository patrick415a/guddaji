export const ENVIRONMENT_ASSET_PATHS = {
  background: "/models/background.glb",
  bush: "/models/low/bush-low.glb",
  chair: "/models/low/chair-low.glb",
  fence: "/models/low/fence-low.glb",
  flower: "/models/low/flower-low.glb",
  grass: "/models/low/grass-low.glb",
  houseBlue: "/models/low/house-blue-low.glb",
  housePink: "/models/low/house-pink-low.glb",
  mailbox: "/models/low/mailbox-low.glb",
  sign: "/models/low/sign-low.glb",
  stone: "/models/stone.glb",
  tree: "/models/low/tree-low.glb",
  flowers: "/models/flowers.glb"
};

// 배경은 월드 뒤쪽 장식이며 이동/충돌 표면으로 사용하지 않습니다.
export const BACKGROUND_CONFIG = {
  position: [4.7, 1.5, -12.5],
  rotation: [0, -0.5, 0],
  scale: [16, 14, 10], // 물 아래로 산의 밑단을 내리고 좌우 폭을 확장합니다.
};

// 실제 월드 좌표에 배치되는 3D 구름입니다. position과 scale로 구도를 조정합니다.
export const CLOUD_CONFIG = {
  color: 0xffffff,
  emissive: 0xffffff,
  emissiveIntensity: 0.45,
  opacity: 1,
  responsiveYOffsetStrength: 1.6,
  placements: [
    {
      position: [-1.8, 0.82, -21],
      scale: 0.8,
      drift: 3.2,
      speed: 0.18,
      bob: 0.06,
      phase: 0.4,
    },
    {
      position: [8, 0.9, -24],
      scale: 0.49,
      drift: 4,
      speed: 0.15,
      bob: 0.05,
      phase: 2.1,
    },
    {
      position: [20.3, -1.34, -22],
      scale: 0.69,
      drift: 3,
      speed: 0.13,
      bob: 0.07,
      phase: 4.2,
    },
  ],
};

export const ENVIRONMENT_COLLISION_CONFIG = {
  passThroughModels: ["grass", "flower"],
  characterRadius: 0.29,
  padding: 0.04,
  modelOverrides: {
    // 튤립만 실제 외곽선으로 판정해 둥근 꽃밭 옆의 빈 공간을 열어줍니다.
    flowers: { shape: "footprint", preciseBounds: true, padding: 0.02 },
  },
};

export const INTERACTION_CONFIG = {
  distance: 1.35,
  highlightScale: 1.08,
  highlightLerpSpeed: 8,
  targets: {
    chair: {
      label: "앉기",
      outlineEnabled: false,
      // chair.glb의 실제 좌판 높이(Y=-0.0783), 앞쪽은 +Z입니다.
      // 앉은 캐릭터의 실루엣이 오른쪽으로 치우쳐 보여 좌판 중앙 쪽으로 X를 보정합니다.
      seatLocal: [-0.16, -0.0783, 0.66], // 좌판 높이는 유지하고 앞쪽으로 이동
      seatedHeightAdjustment: -0.035, // 자동 보정 후 앉는 높이 미세 조정(월드 단위)
      hintHeight: 0.7, // 앉기·일어나기 안내가 머리를 가리지 않도록 높입니다.
      // 앉은 GLB 측정: 골반 Y 0.48962 - 엉덩이 최저점 Y 0.08517.
      pelvisToSeat: 0.405,
      // 현재 GLB의 앉은 메시 중심 X(0.004761)와 골반 X(0.005050)의 차이입니다.
      bodyCenterOffsetX: -0.000289,
      seatClearance: 0.015,
    },
    sign: {
      panel: "guidebook",
      label: "표지판을 살펴보기",
      outlineColor: 0xffffff,
      outlineOpacity: 0.22,
      outlineThickness: 0.035,
      outlineEnabled: false,
    },
    mailbox: {
      panel: "contact",
      label: "우편함을 살펴보기",
      outlineColor: 0xffffff,
      outlineOpacity: 0.22,
      outlineThickness: 0.035,
      // GLB가 단일 메시라 뚜껑만 분리할 수 없어 우체통은 확대만 사용합니다.
      outlineEnabled: false,
    },
  },
};

// 환경 배치는 이 목록의 position(X/Z), rotationY, scale만 수정하면 됩니다.
export const ENVIRONMENT_PLACEMENTS = [
  // 집 위치
  { model: "houseBlue", position: [-2.2, -5.7], rotationY: 0.05, scale: 1.6 }, // 파란집
  { model: "housePink", position: [5.0, -1.5], rotationY: -1.25, scale: 1.6 }, // 분홍집

  // 의자 위치
  { model: "chair", position: [0.85, -5.5], rotationY: 0.05, scale: 0.65 },

  // 표지판과 우체통
  { model: "sign", position: [-2.55, -0.6], rotationY: -0.05, scale: 0.67 },
  { model: "mailbox", position: [0.85, 0.6], rotationY: -0.85, scale: 0.7 },

  // 나무들 위치
  { model: "tree", position: [-6.5, 2.8], rotationY: 0.2, scale: 1 }, // 제일 앞 나무 화면의 빈자리를 살짝 가려주는 나무 (좌측하단1)
  { model: "tree", enabled: false, position: [-8, 4.5], rotationY: 0.2, scale: 3.0, surface: "fixed", height: 0 }, // 고정 시점용 가림막: 추적 시점에서는 숨김
  { model: "tree", enabled: false, position: [-1.35, 8.5], rotationY: 0.2, scale: 2, surface: "fixed", height: 0 }, // 고정 시점용 가림막: 추적 시점에서는 숨김
  { model: "tree", position: [6, -2.0], rotationY: -0.5, scale: 1.8 }, // 분홍집 옆 나무
  { model: "tree", position: [6.7, -0.2], rotationY: -0.5, scale: 1.3 }, // 분홍집 옆 나무
  { model: "tree", position: [-4.8, -7.2], rotationY: 0.75, scale: 1.55 }, // 파란집 옆 나무
  { model: "tree", position: [-4.0, -6.6], rotationY: 0.75, scale: 1.25 }, // 파란집 옆 나무

  // 풀숲
  { model: "bush", position: [-0.7, -5.2], rotationY: 0.1, scale: 0.6 }, // 파란집 
  { model: "bush", position: [-4.2, -5.2], rotationY: 0.1, scale: 0.8 }, // 파란집
  { model: "bush", position: [4.2, -3.0], rotationY: -0.1, scale: 0.8 }, // 분홍집
  { model: "bush", position: [5.3, 0.1], rotationY: -0.1, scale: 0.6 }, // 분홍집
  { model: "bush", position: [0.5, 6.5], rotationY: 0, scale: 1.2, collision: { shape: "footprint" } }, // 작은 섬: 둥근 외곽선으로 빈 모서리 통행 허용

  { model: "flower", position: [-2.5, -0.3], rotationY: 0.4, scale: 0.25 }, // 표지판 꽃
  { model: "grass", position: [-2.9, -0.45], rotationY: -0.85, scale: 0.2 }, // 표지판 풀

  { model: "flower", position: [0.6, 0.4], rotationY: -1.4, scale: 0.23 }, // 우체통 꽃 
  { model: "grass", position: [0.8, 0.85], rotationY: -0.15, scale: 0.25 }, // 우체통 풀
  
  { model: "grass", position: [-3.2, -4.2], rotationY: -0.15, scale: 0.3 }, // 파란집 풀
  { model: "flower", position: [-3.2, -4.8], rotationY: -0.15, scale: 0.25 }, // 파란집 꽃 
  { model: "flower", position: [-1.5, -4.5], rotationY: -0.15, scale: 0.2 }, // 파란집 꽃 

  { model: "grass", position: [3.8, -1.7], rotationY: -0.88, scale: 0.3 }, // 분홍집 풀
  { model: "flower", position: [4.5, -0.2], rotationY: -0.85, scale: 0.25 }, // 분홍집 꽃 

  { model: "stone", position: [-2.1, 3.05], rotationY: 0, scale: 0.2, surface: "water", submerge: 0.5 }, // 물에 반 정도 잠겨있는 돌
  { model: "stone", position: [2.7, 3.05], rotationY: 0, scale: 0.2, surface: "water", submerge: 0.5 }, // 물에 반 정도 잠겨있는 돌

  { model: "fence", position: [-4.5, -6.2], rotationY: 0.1, scale: 0.7 }, // 파란집 울타리
  { model: "fence", position: [-0.15, -5.9], rotationY: 0.1, scale: 0.7 }, // 파란집 울타리

  { model: "fence", position: [6.2, -0.25], rotationY: -1.25, scale: 0.7 }, // 분홍집 울타리
  { model: "fence", position: [4.3, -4.5], rotationY: -1.25, scale: 0.7 }, // 분홍집 울타리

  { model: "flowers", position: [2.2, -5.7], rotationY: -0.55, scale: 0.7 }, // 튤립
];
