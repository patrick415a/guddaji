import fs from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ASSET_PATHS } from '../src/config/worldConfig.js';

// 텍스처만 생략해서 실제 GLB의 뼈/애니메이션을 Node에서도 검증합니다.
export async function loadCharacterForTest(path = ASSET_PATHS.character) {
  globalThis.ProgressEvent ??= class {};
  const buffer = fs.readFileSync(`public${path}`);
  const length = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.subarray(20, 20 + length));
  json.buffers[0].uri = `data:application/octet-stream;base64,${buffer.subarray(28 + length).toString('base64')}`;
  delete json.images;
  delete json.textures;
  delete json.materials;
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) delete primitive.material;
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}
