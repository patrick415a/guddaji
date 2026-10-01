// 밤의 밝기·색감은 여기에서 조절합니다. 낮은 기존 조명 설정을 사용합니다.
export const THEME_CONFIG = {
  storageKey: "guddaji-theme",
  transitionSpeed: 3,
  night: {
    // 완전히 어두운 밤보다, 눈이 적응한 뒤 보이는 부드러운 초저녁 톤입니다.
    // 하늘은 밤으로 남기되 캐릭터와 지형에는 밝은 달빛이 닿게 합니다.
    skyColor: 0x91abd4,
    groundColor: 0x74778c,
    hemisphereIntensity: 0.96,
    moonColor: 0xcbdcff,
    moonPosition: [9, 14, 8],
    moonIntensity: 1.12,
    shadowIntensity: 0.32,
    exposure: 0.88,
    fillColor: 0xb9cced,
    fillIntensity: 0.24,
    characterFillColor: 0xe8efff,
    characterFillIntensity: 0.48,
    fogColor: 0x4b6083,
    waterShallow: 0x6689a7,
    waterDeep: 0x3d5d7a,
    terrainBrightness: 0.46,
    backgroundBrightness: 0.48,
    streetGlow: {
      color: 0xb9ccff,
      opacity: 0.082,
      position: [0.45, -4.85],
      size: [14, 9],
      rotationY: -0.08,
    },
    streetLight: {
      color: 0xd7e3ff,
      intensity: 42,
      distance: 18,
      angle: 0.54,
      penumbra: 0.98,
      decay: 2,
      position: [5.8, 10.5, 3.5],
      target: [0.45, 0.2, -4.85],
    },
    lightBeam: {
      color: 0xd2deff,
      opacity: 0.026,
      radius: 8,
      coreOpacity: 0.105,
      coreRadius: 3.45,
    },
  },
};

export function readSavedTheme() {
  try { return localStorage.getItem(THEME_CONFIG.storageKey) === "dark" ? "dark" : "light"; }
  catch { return "light"; }
}
