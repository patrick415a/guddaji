import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import {
  ASSET_PATHS,
  CAMERA_CONFIG,
  CHARACTER_CONFIG,
  LIGHTING_CONFIG,
  MODEL_CONFIG,
  RENDERER_CONFIG,
  WALKABLE_CONFIG,
  WATER_CONFIG,
} from "../config/worldConfig.js";
import {
  BACKGROUND_CONFIG,
  CLOUD_CONFIG,
  ENVIRONMENT_ASSET_PATHS,
  ENVIRONMENT_COLLISION_CONFIG,
  ENVIRONMENT_PLACEMENTS,
  INTERACTION_CONFIG,
} from "../config/environmentConfig.js";
import { InputController } from "./InputController.js";
import { CharacterAnimation } from "./CharacterAnimation.js";
import { ResponsiveCamera } from "./ResponsiveCamera.js";
import { SunlightGlow } from "./SunlightGlow.js";
import { WorldTheme } from "./WorldTheme.js";
import { SkyClouds } from "./SkyClouds.js";
import { BridgeHeightProfile } from "./BridgeHeightProfile.js";
import { createFootprintCollider, isInsideFootprint } from "./FootprintCollider.js";
import { WalkableSurface } from "./WalkableSurface.js";
import { WaterChannel } from "./WaterChannel.js";
import { SoundEffects } from './SoundEffects.js';
import { AdaptiveQuality } from './AdaptiveQuality.js';
import { PERFORMANCE_CONFIG } from '../config/performanceConfig.js';
import { THEME_CONFIG } from '../config/themeConfig.js';

const INTERACTION_OUTLINE_VERTEX_SHADER = /* glsl */ `
  uniform float uThickness;

  void main() {
    vec3 expandedPosition = position + normal * uThickness;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(expandedPosition, 1.0);
  }
`;

const INTERACTION_OUTLINE_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;

  void main() {
    gl_FragColor = vec4(uColor, uOpacity);
  }
`;

export class WorldExperience {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.theme = callbacks.theme ?? "light";
    this.onReady = callbacks.onReady;
    this.onPostureChange = callbacks.onPostureChange;
    this.onError = callbacks.onError;
    this.onQualityChange = callbacks.onQualityChange;
    this.scene = new THREE.Scene();
    this.timer = new THREE.Timer();
    this.loader = new GLTFLoader();
    this.loader.setMeshoptDecoder(MeshoptDecoder);
    this.onLoadProgress = callbacks.onLoadProgress;
    this.assetProgress = new Map([
      ASSET_PATHS.terrain, ASSET_PATHS.character, ASSET_PATHS.bridge,
      ...Object.values(ENVIRONMENT_ASSET_PATHS),
    ].map((path) => [path, 0]));
    this.input = new InputController();
    this.sound = new SoundEffects();
    this.quality = new AdaptiveQuality(PERFORMANCE_CONFIG);
    this.graphicsMode = callbacks.graphicsMode ?? "auto";
    this.quality.setMode(this.graphicsMode);
    this.shadowElapsed = 1;

    this.models = [];
    this.nightBackgroundMaterials = [];
    this.environmentColliders = [];
    this.interactables = [];
    this.activeInteractable = null;
    this.onInteractionChange = callbacks.onInteractionChange;
    this.onInteractionPosition = callbacks.onInteractionPosition;
    this.hintPosition = new THREE.Vector3();
    this.onOpenPanel = callbacks.onOpenPanel;
    this.characterSkeletons = [];
    this.moveDirection = new THREE.Vector3();
    this.jumpElapsed = null;
    this.jumpOffset = 0;
    this.cameraForward = new THREE.Vector3();
    this.cameraRight = new THREE.Vector3();
    this.worldUp = new THREE.Vector3(0, 1, 0);
    this.candidatePosition = new THREE.Vector3();
    this.edgeProbePosition = new THREE.Vector3();
    this.bridgeLocalPosition = new THREE.Vector3();
    this.bridgeCenterSample = new THREE.Vector3();
    this.animationFrame = null;
    this.isDisposed = false;

    this.handleResize = this.handleResize.bind(this);
    this.render = this.render.bind(this);
  }

  async init() {
    this.createRenderer();
    this.createCamera();
    this.createLighting();
    this.createAtmosphere();
    this.createSkyClouds();
    this.worldTheme = new WorldTheme(this, this.theme);
    this.handleResize();
    this.reportQuality();
    window.addEventListener("resize", this.handleResize);
    // 패널 크기와 모바일 주소창 변화도 실제 캔버스 크기로 반영합니다.
    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.resizeObserver.observe(this.canvas);
    this.input.connect();
    this.render();

    try {
      await Promise.all([
        this.loadTerrain(),
        this.loadCharacter(),
        this.loadBridge(),
      ]);
      this.createWaterChannel();
      this.initializeWalkableSurfaces();
      this.createNightLightPool();
      this.createNightLightBeam();
      await this.loadEnvironment();
      this.worldTheme.apply();
      if (!this.isDisposed) {
        this.renderer.render(this.scene, this.camera);
        this.onLoadProgress?.(100);
        this.onReady?.();
      }
    } catch (error) {
      if (!this.isDisposed) this.onError?.(error);
    }
  }

  async loadModel(path) {
    // 전체 모델 목록을 기준으로 집계해 순차 로딩에서도 진행률이 뒤로 가지 않습니다.
    const report = (amount) => {
      if (this.isDisposed) return;
      this.assetProgress.set(path, Math.max(this.assetProgress.get(path) ?? 0, amount));
      const total = [...this.assetProgress.values()].reduce((sum, value) => sum + value, 0);
      this.onLoadProgress?.(Math.floor(total / this.assetProgress.size * 95));
    };
    const gltf = await this.loader.loadAsync(path, (event) => {
      if (event.total > 0) report(Math.min(event.loaded / event.total, 1) * 0.9);
    });
    report(1); // 파일 해석 완료. 나머지 5%는 월드 배치와 첫 렌더링입니다.
    return gltf;
  }

  createRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    // 투명 캔버스 뒤의 CSS 파스텔 그라데이션이 하늘 배경으로 보이게 합니다.
    this.renderer.setClearColor(
      RENDERER_CONFIG.clearColor,
      RENDERER_CONFIG.clearAlpha,
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = RENDERER_CONFIG.exposure;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.info.autoReset = false;
  }

  createCamera() {
    this.camera = new THREE.PerspectiveCamera(
      CAMERA_CONFIG.fov,
      1,
      CAMERA_CONFIG.near,
      CAMERA_CONFIG.far,
    );
    this.camera.position.fromArray(CAMERA_CONFIG.position);
    this.camera.lookAt(...CAMERA_CONFIG.lookAt);
    this.camera.layers.enable(1);
    this.camera.layers.enable(2);
    this.responsiveCamera = new ResponsiveCamera(this.camera, CAMERA_CONFIG);
  }

  createLighting() {
    const { hemisphere, sun } = LIGHTING_CONFIG;
    const hemisphereLight = new THREE.HemisphereLight(
      hemisphere.skyColor,
      hemisphere.groundColor,
      hemisphere.intensity,
    );
    this.scene.add(hemisphereLight);
    this.hemisphereLight = hemisphereLight;

    // 밤의 그늘진 면만 부드럽게 들어 올리는 무방향 보조광입니다.
    const nightFillLight = new THREE.AmbientLight(
      THEME_CONFIG.night.fillColor,
      0,
    );
    this.scene.add(nightFillLight);
    this.nightFillLight = nightFillLight;

    // 캐릭터의 얼굴과 옷이 밤에도 그늘에 묻히지 않도록 하는 전용 보조광입니다.
    const characterFillLight = new THREE.AmbientLight(
      THEME_CONFIG.night.characterFillColor,
      0,
    );
    characterFillLight.layers.set(2);
    this.scene.add(characterFillLight);
    this.characterFillLight = characterFillLight;

    // 그림자를 만들지 않는 단일 조명으로 벤치 주변에 가로등 같은 빛을 더합니다.
    const street = THEME_CONFIG.night.streetLight;
    const streetLight = new THREE.SpotLight(
      street.color,
      0,
      street.distance,
      street.angle,
      street.penumbra,
      street.decay,
    );
    streetLight.position.fromArray(street.position);
    streetLight.target.position.fromArray(street.target);
    streetLight.castShadow = false;
    streetLight.visible = false;
    // 이 조명은 지면이 아닌 캐릭터와 주요 오브젝트만 비춥니다.
    streetLight.layers.set(1);
    this.scene.add(streetLight, streetLight.target);
    this.streetLight = streetLight;

    const sunLight = new THREE.DirectionalLight(sun.color, sun.intensity);
    this.sunLight = sunLight;
    sunLight.position.fromArray(sun.position);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.setScalar(sun.shadowMapSize);
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 45;
    sunLight.shadow.camera.left = -sun.shadowArea;
    sunLight.shadow.camera.right = sun.shadowArea;
    sunLight.shadow.camera.top = sun.shadowArea;
    sunLight.shadow.camera.bottom = -sun.shadowArea;
    sunLight.shadow.bias = -0.0003;
    sunLight.shadow.radius = sun.shadowRadius;
    sunLight.shadow.intensity = sun.shadowIntensity;
    this.scene.add(sunLight);

  }

  createAtmosphere() {
    this.scene.fog = new THREE.Fog(0xc8eaff, 29, 55);
  }

  createSkyClouds() {
    this.skyClouds = new SkyClouds(CLOUD_CONFIG);
    this.scene.add(this.skyClouds);
  }

  setTheme(theme) {
    this.theme = theme;
    this.worldTheme?.setTheme(theme);
  }

  setGraphicsMode(mode) {
    if (mode === this.graphicsMode && this.renderer) return;
    this.graphicsMode = mode;
    this.quality.setMode(mode);
    if (this.renderer && this.sunLight) this.applyQuality();
  }

  reportQuality() {
    const level = this.quality.mode === "auto"
      && this.quality.level === 0
      && !this.quality.environmentShadows
      ? 1
      : this.quality.level;
    this.onQualityChange?.({
      mode: this.quality.mode,
      level,
    });
  }

  async loadTerrain() {
    const gltf = await this.loadModel(ASSET_PATHS.terrain);
    const terrain = gltf.scene;
    this.applyTransform(terrain, MODEL_CONFIG.terrain);
    this.prepareMaterials(terrain, { castShadow: false, receiveShadow: true });
    this.registerNightScenery(terrain, THEME_CONFIG.night.terrainBrightness);
    terrain.name = "terrain";
    this.scene.add(terrain);
    this.models.push(terrain);
    this.terrain = terrain;
  }

  async loadCharacter() {
    const gltf = await this.loadModel(ASSET_PATHS.character);
    const character = gltf.scene;
    this.applyTransform(character, MODEL_CONFIG.character);
    character.scale.multiplyScalar(CHARACTER_CONFIG.assetScale);
    this.prepareMaterials(character, { castShadow: true, receiveShadow: true });
    this.enableAccentLighting(character);
    const skeletons = new Set();
    character.traverse((child) => {
      if (!child.isMesh) return;
      child.receiveShadow = false;
      child.layers.enable(2);
      if (child.isSkinnedMesh) skeletons.add(child.skeleton);
    });
    // 메시 여러 개가 같은 뼈를 공유할 수 있으므로 중복 갱신을 피합니다.
    this.characterSkeletons = [...skeletons];
    this.fixCharacterTextureSeams(character);
    character.name = "guddaji";
    this.scene.add(character);
    this.models.push(character);
    this.character = character;
    this.setupCharacterAnimations(gltf.animations);
    this.responsiveCamera.update(0, character, true);
  }

  async fixCharacterTextureSeams(character) {
    character.traverse((child) => {
      if (!child.isMesh) return;

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      materials.forEach((material) => {
        if (!material) return;

        const textures = [
          material.map,
          material.normalMap,
          material.roughnessMap,
          material.metalnessMap,
        ];

        textures.forEach((texture) => {
          if (!texture) return;

          texture.generateMipmaps = false;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.needsUpdate = true;
        });
      });
    });
  }

  async loadBridge() {
    const gltf = await this.loadModel(ASSET_PATHS.bridge);
    const bridge = gltf.scene;
    this.applyTransform(bridge, MODEL_CONFIG.bridge);
    this.prepareMaterials(bridge, { castShadow: true, receiveShadow: true });
    this.enableAccentLighting(bridge);
    bridge.name = "bridge";
    this.scene.add(bridge);
    this.models.push(bridge);
    this.bridge = bridge;
  }

  createWaterChannel() {
    this.water = new WaterChannel(WATER_CONFIG);
    this.scene.add(this.water);
  }

  createNightLightPool() {
    const config = THEME_CONFIG.night.streetGlow;
    const height = this.terrainSurface.getHeightAt(...config.position);
    if (height === null) return;
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(config.color) },
        uOpacity: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          vec2 point = (vUv - 0.5) * 2.0;
          float glow = pow(1.0 - smoothstep(0.08, 1.0, length(point)), 1.7);
          gl_FragColor = vec4(uColor, glow * uOpacity);
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const geometry = new THREE.PlaneGeometry(...config.size);
    geometry.rotateX(-Math.PI / 2);
    const pool = new THREE.Mesh(geometry, material);
    pool.name = "night-street-glow";
    pool.position.set(config.position[0], height + 0.025, config.position[1]);
    pool.rotation.y = config.rotationY;
    pool.renderOrder = 1;
    this.scene.add(pool);
    this.nightLightPool = pool;
  }

  createNightLightBeam() {
    const light = THEME_CONFIG.night.streetLight;
    const beam = THEME_CONFIG.night.lightBeam;
    const source = new THREE.Vector3(...light.position);
    const target = new THREE.Vector3(...light.target);
    const direction = target.clone().sub(source);
    const height = direction.length();
    const rotation = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, -1, 0),
      direction.normalize(),
    );
    const center = source.clone().add(target).multiplyScalar(0.5);
    const createBeam = (radius, maxOpacity, name) => {
      const geometry = new THREE.ConeGeometry(radius, height, 48, 1, true);
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(beam.color) },
          uOpacity: { value: 0 },
        },
        vertexShader: /* glsl */ `
          varying float vHeight;
          varying vec3 vViewNormal;
          varying vec3 vViewPosition;
          void main() {
            vHeight = position.y / ${height.toFixed(4)} + 0.5;
            vViewNormal = normalize(normalMatrix * normal);
            vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPosition = viewPosition.xyz;
            gl_Position = projectionMatrix * viewPosition;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uOpacity;
          varying float vHeight;
          varying vec3 vViewNormal;
          varying vec3 vViewPosition;
          void main() {
            vec3 viewDirection = normalize(-vViewPosition);
            float facing = abs(dot(normalize(vViewNormal), viewDirection));
            float softEdge = smoothstep(0.02, 0.55, facing);
            float verticalFade = smoothstep(0.0, 0.14, vHeight) * (0.32 + 0.68 * vHeight);
            gl_FragColor = vec4(uColor, uOpacity * softEdge * verticalFade);
          }
        `,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = name;
      mesh.position.copy(center);
      mesh.quaternion.copy(rotation);
      mesh.visible = false;
      mesh.renderOrder = 2;
      mesh.userData.maxOpacity = maxOpacity;
      return mesh;
    };
    this.nightLightBeams = [
      createBeam(beam.radius, beam.opacity, "night-light-beam-wide"),
      createBeam(beam.coreRadius, beam.coreOpacity, "night-light-beam-core"),
    ];
    this.scene.add(...this.nightLightBeams);
  }

  async loadEnvironment() {
    const assetEntries = Object.entries(ENVIRONMENT_ASSET_PATHS);
    const loadedAssets = await Promise.all(
      assetEntries.map(async ([key, path]) => {
        const gltf = await this.loadModel(path);
        return [key, gltf.scene];
      }),
    );
    const assets = Object.fromEntries(loadedAssets);

    this.background = assets.background;
    this.applyTransform(this.background, BACKGROUND_CONFIG);
    this.prepareMaterials(this.background, {
      castShadow: false,
      receiveShadow: false,
    });
    this.registerNightScenery(this.background, THEME_CONFIG.night.backgroundBrightness);
    this.background.name = "background";
    this.scene.add(this.background);
    this.models.push(this.background);

    for (const placement of ENVIRONMENT_PLACEMENTS) {
      if (placement.enabled === false) continue;
      const source = assets[placement.model];
      if (!source) continue;

      const object = source.clone(true);
      object.name = `environment-${placement.model}`;
      object.position.set(placement.position[0], 0, placement.position[1]);
      object.rotation.y = placement.rotationY ?? 0;
      if (Array.isArray(placement.scale)) object.scale.fromArray(placement.scale);
      else object.scale.setScalar(placement.scale ?? 1);
      if (placement.surface === "water") {
        this.placeInWater(object, placement.submerge ?? 0.5);
      } else if (placement.surface === "fixed") {
        object.position.y = placement.height ?? 0;
      } else {
        this.placeOnTerrain(object, placement.groundOffset ?? 0);
      }
      // 처음에는 끄고 실제 FPS가 안정적일 때만 환경 그림자를 켭니다.
      object.userData.adaptiveEnvironmentShadow = true;
      this.prepareMaterials(object, { castShadow: this.quality.environmentShadows, receiveShadow: true });
      this.enableAccentLighting(object);
      this.scene.add(object);
      this.models.push(object);
      this.registerEnvironmentCollider(object, placement.model, placement.collision);

      const interaction = INTERACTION_CONFIG.targets[placement.model];
      if (interaction) {
        // 모델 윗면 중앙을 말풍선 기준점으로 저장합니다.
        const bounds = new THREE.Box3().setFromObject(object);
        const hintAnchor = bounds.getCenter(new THREE.Vector3());
        hintAnchor.y = bounds.max.y;
        this.interactables.push({
          id: placement.model,
          label: interaction.label,
          object,
          baseScale: object.scale.clone(),
          hintAnchor: object.worldToLocal(hintAnchor),
          highlightAmount: 0,
          outlines: interaction.outlineEnabled === false
            ? []
            : this.createInteractionOutlines(
              object,
              interaction.outlineColor,
              interaction.outlineOpacity,
              interaction.outlineThickness,
            ),
        });
      }
    }
  }

  enableAccentLighting(object) {
    object.traverse((child) => {
      if (child.isMesh) child.layers.enable(1);
    });
  }

  registerNightScenery(object, brightness) {
    object.traverse((child) => {
      if (!child.isMesh) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (!material?.color) return;
        const dayColor = material.color.clone();
        this.nightBackgroundMaterials.push({
          material,
          dayColor,
          nightColor: dayColor.clone().multiplyScalar(brightness),
        });
      });
    });
  }

  placeOnTerrain(object, groundOffset) {
    const terrainHeight = this.terrainSurface.getHeightAt(
      object.position.x,
      object.position.z,
    );
    if (terrainHeight === null) {
      console.warn(`${object.name} 배치 위치에서 terrain을 찾지 못했습니다.`);
      return;
    }

    // 모델 원점이 중앙에 있어도 바닥 면이 terrain에 정확히 닿도록 맞춥니다.
    object.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(object);
    object.position.y += terrainHeight - bounds.min.y + groundOffset;
  }

  placeInWater(object, submerge) {
    object.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(object);
    const waterLineInBounds = THREE.MathUtils.lerp(
      bounds.min.y,
      bounds.max.y,
      THREE.MathUtils.clamp(submerge, 0, 1),
    );

    // submerge 0.5는 수면이 모델 높이의 정중앙을 지나게 합니다.
    object.position.y += WATER_CONFIG.position[1] - waterLineInBounds;
  }

  registerEnvironmentCollider(object, modelName, placementOverride) {
    if (ENVIRONMENT_COLLISION_CONFIG.passThroughModels.includes(modelName)) {
      return;
    }

    // 개별 배치에만 충돌 모양을 지정할 수 있습니다.
    const override = placementOverride ?? ENVIRONMENT_COLLISION_CONFIG.modelOverrides?.[modelName];
    object.updateMatrixWorld(true);
    // 정밀 외곽선이 지정된 오브젝트는 아래에서 실제 정점을 사용합니다.
    const bounds = new THREE.Box3().setFromObject(object, override?.preciseBounds ?? false);
    const margin =
      ENVIRONMENT_COLLISION_CONFIG.characterRadius +
      (override?.padding ?? ENVIRONMENT_COLLISION_CONFIG.padding);
    if (override?.shape === "footprint") {
      const footprint = createFootprintCollider(object, margin);
      if (footprint) {
        this.environmentColliders.push(footprint);
        return;
      }
    }
    this.environmentColliders.push({
      minX: bounds.min.x - margin,
      maxX: bounds.max.x + margin,
      minZ: bounds.min.z - margin,
      maxZ: bounds.max.z + margin,
    });
  }

  isBlockedByEnvironment(position) {
    return this.environmentColliders.some((bounds) => (
      bounds.hull ? isInsideFootprint(position, bounds) : (
      position.x >= bounds.minX &&
      position.x <= bounds.maxX &&
      position.z >= bounds.minZ &&
      position.z <= bounds.maxZ)
    ));
  }

  createInteractionOutlines(object, color, opacity, thickness) {
    const outlines = [];
    const meshes = [];
    object.traverse((child) => {
      if (child.isMesh && !child.userData.isInteractionOutline) meshes.push(child);
    });

    meshes.forEach((child) => {
      if (!child.parent) return;
      // 뒷면을 조금 부풀려 앞면에 가려지게 하면 실루엣 바깥쪽만 남습니다.
      const outline = new THREE.Mesh(
        child.geometry,
        new THREE.ShaderMaterial({
          uniforms: {
            uColor: { value: new THREE.Color(color) },
            uOpacity: { value: 0 },
            uThickness: { value: thickness },
          },
          vertexShader: INTERACTION_OUTLINE_VERTEX_SHADER,
          fragmentShader: INTERACTION_OUTLINE_FRAGMENT_SHADER,
          side: THREE.BackSide,
          transparent: true,
          depthTest: true,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      outline.userData.isInteractionOutline = true;
      outline.matrixAutoUpdate = false;
      outline.matrix.copy(child.matrix);
      outline.renderOrder = 5;
      // 원본 메시의 자식이 아닌 형제로 두어 GLB 계층 재귀를 피합니다.
      child.parent.add(outline);
      outlines.push({ material: outline.material, opacity });
    });
    return outlines;
  }

  initializeWalkableSurfaces() {
    this.terrain.updateMatrixWorld(true);
    this.bridge.updateMatrixWorld(true);
    this.character.updateMatrixWorld(true);

    const characterBounds = new THREE.Box3().setFromObject(this.character, true);
    this.terrainSurface = new WalkableSurface(this.terrain, {
      cellSize: WALKABLE_CONFIG.spatialCellSize,
      maxSlopeDegrees: WALKABLE_CONFIG.maxSlopeDegrees,
    });
    this.bridgeSurface = new WalkableSurface(this.bridge, {
      cellSize: WALKABLE_CONFIG.spatialCellSize,
      maxSlopeDegrees: WALKABLE_CONFIG.maxSlopeDegrees,
      heightMode: "lowest",
    });
    this.bridgeHeightProfile = new BridgeHeightProfile(
      this.bridge, this.terrainSurface, this.bridgeSurface,
      WALKABLE_CONFIG.bridgeCorridor, WALKABLE_CONFIG.bridgeHeight,
    );
    this.characterGroundOffset =
      this.character.position.y - characterBounds.min.y +
      WALKABLE_CONFIG.groundClearance;

    const startingHeight = this.getWalkableHeight(this.character.position);
    if (startingHeight === null) {
      throw new Error("구따지의 시작 위치 아래에서 terrain을 찾지 못했습니다.");
    }

    this.character.position.y = startingHeight + this.characterGroundOffset;
  }

  setupCharacterAnimations(clips) {
    this.characterAnimation = new CharacterAnimation(
      this.character, CHARACTER_CONFIG, clips, this.onPostureChange,
    );
  }

  updateCharacter(deltaTime) {
    if (!this.character || !this.terrainSurface || !this.characterAnimation) return;

    // 충돌·다리 높이 계산은 발밑 지면 좌표로, 점프 높이는 마지막에 더합니다.
    this.character.position.y -= this.jumpOffset;
    const wantsJump = this.input.consumeJump();
    if (wantsJump && this.jumpElapsed === null && !this.seatSession && this.characterAnimation.state === 'standing') {
      this.jumpElapsed = 0;
      this.characterAnimation.jump();
      this.sound.jump();
    }
    this.updateGroundMovement(deltaTime);
    if (this.jumpElapsed !== null) {
      this.jumpElapsed += deltaTime;
      const t = Math.min(this.jumpElapsed / CHARACTER_CONFIG.jump.duration, 1);
      this.jumpOffset = 4 * CHARACTER_CONFIG.jump.height * t * (1 - t);
      if (t === 1) this.jumpElapsed = null;
    } else this.jumpOffset = 0;
    this.character.position.y += this.jumpOffset;
  }

  updateGroundMovement(deltaTime) {

    const axes = this.input.getMovementAxes();
    const isMoving = axes.x !== 0 || axes.y !== 0;
    if (!this.characterAnimation.canMove(isMoving)) return;

    if (!isMoving) {
      this.setCharacterAnimation("idle");
      return;
    }

    // 고정 카메라 기준으로 입력 방향을 월드 XZ 방향으로 변환합니다.
    this.camera.getWorldDirection(this.cameraForward);
    this.cameraForward.y = 0;
    this.cameraForward.normalize();
    this.cameraRight.crossVectors(this.cameraForward, this.worldUp).normalize();

    this.moveDirection
      .copy(this.cameraRight)
      .multiplyScalar(axes.x)
      .addScaledVector(this.cameraForward, axes.y)
      .normalize();

    const targetRotation = Math.atan2(
      this.moveDirection.x,
      this.moveDirection.z,
    );
    const rotationAlpha = 1 - Math.exp(-CHARACTER_CONFIG.rotationSpeed * deltaTime);
    // 앉기 후 Euler의 X/Z가 π로 바뀔 수 있으므로 전체 quaternion으로 회전합니다.
    this.moveRotation ??= new THREE.Quaternion();
    this.moveRotation.setFromAxisAngle(this.worldUp, targetRotation);
    this.character.quaternion.slerp(this.moveRotation, rotationAlpha);

    const didMove = this.moveCharacterOnTerrain(deltaTime);
    this.setCharacterAnimation(didMove ? (this.input.isRunning() ? "run" : "walk") : "idle");
  }

  moveCharacterOnTerrain(deltaTime) {
    const moveDistance = (this.input.isRunning() ? CHARACTER_CONFIG.runSpeed : CHARACTER_CONFIG.moveSpeed) * deltaTime;
    this.candidatePosition
      .copy(this.character.position)
      .addScaledVector(this.moveDirection, moveDistance);

    const centerHeight = this.getWalkableHeight(this.candidatePosition);
    if (
      centerHeight === null ||
      !this.isReachableHeight(centerHeight) ||
      this.isBlockedByEnvironment(this.candidatePosition)
    ) return false;

    // 진행 방향 앞쪽도 검사해 캐릭터 중심이 섬 가장자리에 걸리지 않게 합니다.
    this.edgeProbePosition
      .copy(this.candidatePosition)
      .addScaledVector(
        this.moveDirection,
        this.isInsideBridgeCorridor(this.candidatePosition)
          ? WALKABLE_CONFIG.bridgeEdgeProbeDistance
          : WALKABLE_CONFIG.edgeProbeDistance,
      );
    const edgeHeight = this.getWalkableHeight(this.edgeProbePosition);
    if (edgeHeight === null || !this.isReachableHeight(edgeHeight)) return false;

    this.character.position.set(
      this.candidatePosition.x,
      centerHeight + this.characterGroundOffset,
      this.candidatePosition.z,
    );
    return true;
  }

  getWalkableHeight(position) {
    const terrainHeight = this.terrainSurface?.getHeightAt(position.x, position.z);
    const bridgeHeight = this.getBridgeCorridorHeight(position);

    // 접점에서는 높은 표면을 사용해 발이 다리 데크 안으로 내려가지 않게 합니다.
    const rawHeight = terrainHeight != null && bridgeHeight != null
      ? Math.max(terrainHeight, bridgeHeight)
      : terrainHeight ?? bridgeHeight ?? null;
    return this.bridgeHeightProfile?.getHeight(position, rawHeight) ?? rawHeight;
  }

  getBridgeCorridorHeight(position) {
    if (!this.bridge || !this.bridgeSurface) return null;

    this.bridgeLocalPosition.copy(position);
    this.bridge.worldToLocal(this.bridgeLocalPosition);
    if (!this.isInsideBridgeLocalCorridor(this.bridgeLocalPosition)) return null;

    // 판자 틈과 난간 메시의 영향을 피하고 실제 데크 중심선 높이를 사용합니다.
    this.bridgeCenterSample.set(this.bridgeLocalPosition.x, 0, 0);
    this.bridge.localToWorld(this.bridgeCenterSample);
    return this.bridgeSurface.getHeightAt(
      this.bridgeCenterSample.x,
      this.bridgeCenterSample.z,
    );
  }

  isInsideBridgeCorridor(position) {
    if (!this.bridge) return false;

    this.bridgeLocalPosition.copy(position);
    this.bridge.worldToLocal(this.bridgeLocalPosition);
    return this.isInsideBridgeLocalCorridor(this.bridgeLocalPosition);
  }

  isInsideBridgeLocalCorridor(localPosition) {
    const { halfLength, halfWidth } = WALKABLE_CONFIG.bridgeCorridor;
    return (
      Math.abs(localPosition.x) <= halfLength &&
      Math.abs(localPosition.z) <= halfWidth
    );
  }

  isReachableHeight(groundHeight) {
    const currentGroundHeight =
      this.character.position.y - this.characterGroundOffset;
    return (
      Math.abs(groundHeight - currentGroundHeight) <=
      WALKABLE_CONFIG.maxStepHeight
    );
  }

  updateCharacterSkeletons() {
    if (!this.character) return;
    // 앉기 위치를 포함한 이번 프레임의 변환을 먼저 뼈에 반영합니다.
    this.character.updateMatrixWorld(true);
    // 그림자 갱신을 건너뛴 프레임에도 GPU에 전달할 자세는 최신이어야 합니다.
    // Three.js의 렌더/그림자 패스 캐시에 맡기면 이전 자세가 한 프레임 남을 수 있습니다.
    for (const skeleton of this.characterSkeletons) skeleton.update();
  }

  setCharacterAnimation(nextAnimation) {
    // 공중에서는 다른 모션으로 바꾸지 않고 이륙 직전 자세를 유지합니다.
    if (this.jumpElapsed !== null) return;
    this.characterAnimation?.locomotion(nextAnimation);
  }

  applyTransform(object, config) {
    object.position.fromArray(config.position);
    object.rotation.fromArray(config.rotation);
    if (Array.isArray(config.scale)) object.scale.fromArray(config.scale);
    else object.scale.setScalar(config.scale);
  }

  prepareMaterials(object, shadowOptions) {
    object.traverse((child) => {
      if (!child.isMesh) return;

      child.castShadow = shadowOptions.castShadow;
      child.receiveShadow = shadowOptions.receiveShadow;

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      materials.forEach((material) => {
        if (!material?.isMeshStandardMaterial) return;
        // 금속감을 눌러 레퍼런스의 부드러운 클레이 질감에 가깝게 만듭니다.
        material.metalness = 0;
        material.roughness = Math.max(material.roughness, 0.82);
        material.needsUpdate = true;
      });
    });
  }

  handleResize() {
    if (!this.renderer || !this.camera) return;

    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;

    this.responsiveCamera.resize(width, height, this.character);

    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, RENDERER_CONFIG.maxPixelRatio, PERFORMANCE_CONFIG.tiers[this.quality.level].pixelRatio),
    );
    this.renderer.setSize(width, height, false);
    this.skyClouds?.setViewportAspect(width / height, CAMERA_CONFIG.referenceAspect);
    // 저사양 단계에서는 후처리와 렌더 타깃 메모리까지 해제합니다.
    const glowEnabled = LIGHTING_CONFIG.glow.enabled && this.quality.level === 0;
    if (glowEnabled) {
      this.sunlightGlow ??= new SunlightGlow(LIGHTING_CONFIG.glow);
      const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
      this.sunlightGlow.setSize(size.x, size.y);
    } else if (this.sunlightGlow) {
      this.sunlightGlow.dispose();
      this.sunlightGlow = null;
    }
  }

  applyQuality() {
    const tier = PERFORMANCE_CONFIG.tiers[this.quality.level];
    for (const model of this.models) {
      if (!model.userData.adaptiveEnvironmentShadow) continue;
      model.traverse((child) => {
        if (child.isMesh) child.castShadow = this.quality.environmentShadows;
      });
    }
    const shadow = this.sunLight.shadow;
    shadow.mapSize.setScalar(Math.min(LIGHTING_CONFIG.sun.shadowMapSize, tier.shadowSize));
    shadow.map?.dispose();
    shadow.map = null;
    // 움직이는 캐릭터 그림자는 유지하되, 고품질에서도 그림자 맵을 30fps로 제한합니다.
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.handleResize();
    this.reportQuality();
  }

  render() {
    if (this.isDisposed) return;

    this.timer.update();
    if (document.hidden) {
      this.quality.reset();
      this.animationFrame = requestAnimationFrame(this.render);
      return;
    }
    const frameDelta = this.timer.getDelta();
    const deltaTime = Math.min(frameDelta, 0.05);
    // 로딩 시간을 제외한 실제 프레임 간격으로 기기 성능을 판단합니다.
    if (this.character && this.terrainSurface && this.quality.sample(frameDelta)) this.applyQuality();
    this.updateCharacter(deltaTime);
    this.updateInteraction(deltaTime);
    // 모션과 앉기 위치를 적용한 뒤, 그림자 주기와 독립적으로 뼈를 갱신합니다.
    this.characterAnimation?.update(deltaTime);
    this.updateSeatingPosition();
    this.updateCharacterSkeletons();
    this.responsiveCamera.update(deltaTime, this.character);
    this.water?.update(deltaTime);
    this.skyClouds?.update(deltaTime);
    this.worldTheme?.update(deltaTime);
    this.shadowElapsed += deltaTime;
    if (this.shadowElapsed >= 1 / PERFORMANCE_CONFIG.tiers[this.quality.level].shadowFps) {
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowElapsed = 0;
    }
    this.renderer.info.reset();
    if (this.sunlightGlow) this.sunlightGlow.render(this.renderer, this.scene, this.camera);
    else this.renderer.render(this.scene, this.camera);

    this.updateInteractionPosition();
    this.animationFrame = requestAnimationFrame(this.render);
  }

  updateInteractionPosition() {
    const target = this.activeInteractable;
    if (!target) { this.onInteractionPosition?.(null); return; }
    target.object.localToWorld(this.hintPosition.copy(target.hintAnchor));
    this.hintPosition.y += INTERACTION_CONFIG.targets[target.id]?.hintHeight ?? 0.18;
    this.hintPosition.project(this.camera);
    const { x, y, z } = this.hintPosition;
    if (z < -1 || z > 1 || Math.abs(x) > 1 || Math.abs(y) > 1) {
      this.onInteractionPosition?.(null); return;
    }
    const canvas = this.canvas.getBoundingClientRect();
    const parent = this.canvas.closest('.experience').getBoundingClientRect();
    this.onInteractionPosition?.({
      x: canvas.left - parent.left + (x + 1) * canvas.width / 2,
      y: canvas.top - parent.top + (1 - y) * canvas.height / 2,
    });
  }

  updateInteraction(deltaTime) {
    if (!this.character || this.interactables.length === 0) return;
    // 공중에서 의자에 앉거나 창을 열지 않도록 합니다.
    if (this.jumpElapsed !== null) {
      this.input.consumeInteraction();
      return;
    }

    if (this.seatSession) {
      const seated = this.characterAnimation.state === "seated";
      const label = seated ? "일어나기" : (this.characterAnimation.state === "sittingDown" ? "앉는 중…" : "일어나는 중…");
      if (this.seatHint !== label) {
        this.seatHint = label;
        this.onInteractionChange?.({ id: "chair", label });
      }
      if (this.input.consumeInteraction() && seated) this.characterAnimation.toggleSit();
      return;
    }

    let closest = null;
    let closestDistance = INTERACTION_CONFIG.distance;
    for (const interactable of this.interactables) {
      const distance = this.character.position.distanceTo(interactable.object.position);
      if (distance < closestDistance) {
        closest = interactable;
        closestDistance = distance;
      }
    }

    for (const interactable of this.interactables) {
      const targetAmount = interactable === closest ? 1 : 0;
      const blend = 1 - Math.exp(-INTERACTION_CONFIG.highlightLerpSpeed * deltaTime);
      interactable.highlightAmount = THREE.MathUtils.lerp(
        interactable.highlightAmount,
        targetAmount,
        blend,
      );
      interactable.object.scale
        .copy(interactable.baseScale)
        .multiplyScalar(
          1 + interactable.highlightAmount * (INTERACTION_CONFIG.highlightScale - 1),
        );
      interactable.outlines.forEach(({ material, opacity }) => {
        material.uniforms.uOpacity.value = interactable.highlightAmount * opacity;
      });
    }

    const nextId = closest?.id ?? null;
    if (nextId !== this.activeInteractable?.id) {
      this.activeInteractable = closest;
      this.onInteractionChange?.(
        closest ? { id: closest.id, label: closest.label } : null,
      );
    }

    if (this.input.consumeInteraction() && closest) {
      this.handleInteraction(closest);
    }
  }

  handleInteraction(interactable) {
    this.sound.interact();
    if (interactable.id === "chair") {
      const chair = interactable.object;
      chair.scale.copy(interactable.baseScale);
      interactable.highlightAmount = 0;
      chair.updateMatrixWorld(true);
      const settings = INTERACTION_CONFIG.targets.chair;
      const seat = chair.localToWorld(new THREE.Vector3(...settings.seatLocal));
      seat.y += settings.seatClearance + (settings.seatedHeightAdjustment ?? 0);
      const rotation = new THREE.Quaternion().setFromAxisAngle(this.worldUp, chair.rotation.y);
      const hipOffset = this.characterAnimation.seatedHip.clone();
      hipOffset.x += settings.bodyCenterOffsetX;
      hipOffset.y = this.characterAnimation.seatedBottomY
        ?? (hipOffset.y - settings.pelvisToSeat);
      hipOffset.multiply(this.character.scale).applyQuaternion(rotation);
      this.seatSession = {
        exit: this.character.position.clone(),
        destination: seat.sub(hipOffset),
        rotation,
        originalRotation: this.character.quaternion.clone(),
      };
      this.characterAnimation.toggleSit();
      return;
    }
    // 햄버거 메뉴와 동일한 화면을 엽니다. 실제 내용은 TopBar.jsx에서 수정합니다.
    const panel = INTERACTION_CONFIG.targets[interactable.id]?.panel;
    if (panel) this.onOpenPanel?.(panel);
  }

  updateSeatingPosition() {
    if (!this.seatSession) return;
    const session = this.seatSession;
    const action = this.characterAnimation.actions.sit;
    const t = THREE.MathUtils.clamp(action.time / action.getClip().duration, 0, 1);
    const smooth = t * t * (3 - 2 * t);
    // 앉을 때 좌판으로 정렬하고, 역재생 후 충돌 밖의 원래 위치로 복귀합니다.
    this.character.position.lerpVectors(session.exit, session.destination, smooth);
    this.character.quaternion.slerpQuaternions(session.originalRotation, session.rotation, smooth);
    if (this.characterAnimation.state === "standing") {
      this.character.position.copy(session.exit);
      this.seatSession = null;
      this.seatHint = null;
      this.activeInteractable = null;
      this.onInteractionChange?.(null);
    }
  }

  dispose() {
    this.isDisposed = true;
    window.removeEventListener("resize", this.handleResize);
    this.resizeObserver?.disconnect();
    this.input.disconnect();
    this.sound.dispose();
    cancelAnimationFrame(this.animationFrame);
    this.characterAnimation?.dispose();
    this.water?.dispose();
    this.nightLightPool?.geometry.dispose();
    this.nightLightPool?.material.dispose();
    this.nightLightBeams?.forEach((beam) => {
      beam.geometry.dispose();
      beam.material.dispose();
    });
    this.skyClouds?.dispose();
    this.sunlightGlow?.dispose();

    this.models.forEach((model) => {
      model.traverse((child) => {
        if (child.userData.isInteractionOutline) {
          child.material?.dispose();
          return;
        }
        if (child.isLineSegments) {
          child.geometry?.dispose();
          child.material?.dispose();
          return;
        }
        if (!child.isMesh) return;
        child.geometry?.dispose();
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        materials.forEach((material) => material?.dispose());
      });
    });

    this.renderer?.dispose();
  }
}
