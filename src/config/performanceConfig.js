// 카메라/배치는 유지하고, 느린 기기에서만 렌더링 부담을 줄입니다.
export const PERFORMANCE_CONFIG = {
  enabled: true,
  warmupSeconds: 4,
  sampleSeconds: 3,
  minimumFps: 45,
  slowWindows: 2,
  environmentShadows: {
    enableFps: 55,
    disableFps: 45,
    stableWindows: 3, // 3초 측정 구간 3회 연속 안정적이면 켭니다.
  },
  tiers: [
    { pixelRatio: 1.75, shadowSize: 1536, shadowFps: 30 },
    { pixelRatio: 1, shadowSize: 1024, shadowFps: 30 },
    { pixelRatio: 0.9, shadowSize: 1024, shadowFps: 15 },
  ],
};
