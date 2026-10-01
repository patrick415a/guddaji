import * as THREE from "three";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";

const vertexShader = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// 작은 해상도에서 밝은 부분만 추출·번짐 처리하고 하늘의 투명도는 유지합니다.
export class SunlightGlow {
  constructor(config) {
    this.config = config;
    this.sceneTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.bright = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    this.blur = this.bright.clone();
    this.extract = new THREE.ShaderMaterial({
      vertexShader, depthTest: false, depthWrite: false, toneMapped: false,
      uniforms: { source: { value: this.sceneTarget.texture }, threshold: { value: config.threshold }, knee: { value: config.knee } },
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D source;
        uniform float threshold, knee;
        void main() {
          vec4 c = texture2D(source, vUv);
          float luminance = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
          float weight = smoothstep(threshold - knee, threshold + knee, luminance);
          gl_FragColor = vec4(c.rgb * weight * c.a, 1.0);
        }
      `,
    });
    this.blurMaterial = new THREE.ShaderMaterial({
      vertexShader, depthTest: false, depthWrite: false, toneMapped: false,
      uniforms: { source: { value: null }, direction: { value: new THREE.Vector2() } },
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D source;
        uniform vec2 direction;
        void main() {
          vec3 c = texture2D(source, vUv).rgb * 0.227027;
          c += texture2D(source, vUv + direction * 1.384615).rgb * 0.316216;
          c += texture2D(source, vUv - direction * 1.384615).rgb * 0.316216;
          c += texture2D(source, vUv + direction * 3.230769).rgb * 0.070270;
          c += texture2D(source, vUv - direction * 3.230769).rgb * 0.070270;
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    });
    this.composite = new THREE.ShaderMaterial({
      vertexShader, depthTest: false, depthWrite: false,
      uniforms: { source: { value: this.sceneTarget.texture }, glow: { value: this.bright.texture }, strength: { value: config.strength } },
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D source, glow;
        uniform float strength;
        void main() {
          vec4 base = texture2D(source, vUv);
          gl_FragColor = vec4(base.rgb + texture2D(glow, vUv).rgb * strength, base.a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this.quad = new FullScreenQuad(this.extract);
  }

  setSize(width, height) {
    this.sceneTarget.setSize(width, height);
    this.width = Math.max(1, Math.round(width * this.config.resolutionScale));
    this.height = Math.max(1, Math.round(height * this.config.resolutionScale));
    this.bright.setSize(this.width, this.height);
    this.blur.setSize(this.width, this.height);
  }

  render(renderer, scene, camera) {
    const previousTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(this.sceneTarget);
    renderer.render(scene, camera);
    this.quad.material = this.extract;
    renderer.setRenderTarget(this.bright);
    this.quad.render(renderer);
    this.quad.material = this.blurMaterial;
    this.blurMaterial.uniforms.source.value = this.bright.texture;
    this.blurMaterial.uniforms.direction.value.set(1 / this.width, 0);
    renderer.setRenderTarget(this.blur);
    this.quad.render(renderer);
    this.blurMaterial.uniforms.source.value = this.blur.texture;
    this.blurMaterial.uniforms.direction.value.set(0, 1 / this.height);
    renderer.setRenderTarget(this.bright);
    this.quad.render(renderer);
    this.quad.material = this.composite;
    renderer.setRenderTarget(previousTarget);
    this.quad.render(renderer);
  }

  dispose() {
    for (const resource of [this.sceneTarget, this.bright, this.blur, this.extract, this.blurMaterial, this.composite, this.quad]) resource.dispose();
  }
}
