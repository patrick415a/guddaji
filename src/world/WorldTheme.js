import * as THREE from "three";
import { LIGHTING_CONFIG, RENDERER_CONFIG, WATER_CONFIG } from "../config/worldConfig.js";
import { THEME_CONFIG } from "../config/themeConfig.js";

// 기존 조명을 재사용하므로 밤 전환으로 광원이나 그림자 패스가 늘지 않습니다.
export class WorldTheme {
  constructor(world, theme) {
    this.world = world;
    this.mix = this.destination = theme === "dark" ? 1 : 0;
    const night = THEME_CONFIG.night;
    this.colors = {
      sky: [LIGHTING_CONFIG.hemisphere.skyColor, night.skyColor],
      ground: [LIGHTING_CONFIG.hemisphere.groundColor, night.groundColor],
      sun: [LIGHTING_CONFIG.sun.color, night.moonColor],
      fog: [0xc8eaff, night.fogColor],
      shallow: [WATER_CONFIG.colors.shallow, night.waterShallow],
      deep: [WATER_CONFIG.colors.deep, night.waterDeep],
    };
    for (const key of Object.keys(this.colors)) this.colors[key] = this.colors[key].map(value => new THREE.Color(value));
    this.sunPositions = [
      new THREE.Vector3(...LIGHTING_CONFIG.sun.position),
      new THREE.Vector3(...night.moonPosition),
    ];
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.apply();
  }

  setTheme(theme) { this.destination = theme === "dark" ? 1 : 0; }

  update(delta) {
    const next = this.reducedMotion.matches ? this.destination :
      THREE.MathUtils.lerp(this.mix, this.destination, 1 - Math.exp(-THEME_CONFIG.transitionSpeed * delta));
    const mix = Math.abs(next - this.destination) < 0.001 ? this.destination : next;
    if (mix === this.mix && this.water === this.world.water) return;
    this.mix = mix;
    this.apply();
  }

  apply() {
    const w = this.world;
    const t = this.mix;
    const night = THEME_CONFIG.night;
    const color = (target, key) => target.copy(this.colors[key][0]).lerp(this.colors[key][1], t);
    color(w.hemisphereLight.color, "sky");
    color(w.hemisphereLight.groundColor, "ground");
    color(w.sunLight.color, "sun");
    w.sunLight.position.copy(this.sunPositions[0]).lerp(this.sunPositions[1], t);
    color(w.scene.fog.color, "fog");
    w.hemisphereLight.intensity = THREE.MathUtils.lerp(LIGHTING_CONFIG.hemisphere.intensity, night.hemisphereIntensity, t);
    w.nightFillLight.intensity = night.fillIntensity * t;
    w.nightFillLight.visible = t > 0.001;
    w.characterFillLight.intensity = night.characterFillIntensity * t;
    w.characterFillLight.visible = t > 0.001;
    w.streetLight.intensity = night.streetLight.intensity * t;
    w.streetLight.visible = t > 0.001;
    w.sunLight.intensity = THREE.MathUtils.lerp(LIGHTING_CONFIG.sun.intensity, night.moonIntensity, t);
    w.sunLight.shadow.intensity = THREE.MathUtils.lerp(LIGHTING_CONFIG.sun.shadowIntensity, night.shadowIntensity, t);
    w.renderer.toneMappingExposure = THREE.MathUtils.lerp(RENDERER_CONFIG.exposure, night.exposure, t);
    w.nightBackgroundMaterials?.forEach(({ material, dayColor, nightColor }) => {
      material.color.copy(dayColor).lerp(nightColor, t);
    });
    if (w.skyClouds) {
      w.skyClouds.cloudMaterial.opacity = 1 - t;
      w.skyClouds.visible = t < 0.999;
    }
    if (w.nightLightPool) {
      w.nightLightPool.material.uniforms.uOpacity.value = night.streetGlow.opacity * t;
      w.nightLightPool.visible = t > 0.001;
    }
    w.nightLightBeams?.forEach((beam) => {
      beam.material.uniforms.uOpacity.value = beam.userData.maxOpacity * t;
      beam.visible = t > 0.001;
    });
    this.water = w.water;
    if (w.water) {
      const u = w.water.material.uniforms;
      color(u.uShallowColor.value, "shallow");
      color(u.uDeepColor.value, "deep");
      u.uNightMix.value = t;
    }
  }
}
