import fs from "node:fs";
import path from "node:path";
import { ASSET_PATHS } from "../src/config/worldConfig.js";
import {
  ENVIRONMENT_ASSET_PATHS,
  ENVIRONMENT_PLACEMENTS,
} from "../src/config/environmentConfig.js";

const JSON_CHUNK = 0x4e4f534a;

function readGlbJson(filePath) {
  const buffer = fs.readFileSync(filePath);
  let offset = 12;

  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    if (type === JSON_CHUNK) {
      return {
        bytes: buffer.length,
        json: JSON.parse(buffer.subarray(offset + 8, offset + 8 + length)),
      };
    }
    offset += 8 + length;
  }

  throw new Error(`JSON chunk not found: ${filePath}`);
}

function primitiveTriangles(primitive, accessors) {
  const count = primitive.indices === undefined
    ? accessors[primitive.attributes.POSITION]?.count ?? 0
    : accessors[primitive.indices]?.count ?? 0;
  const mode = primitive.mode ?? 4;

  if (mode === 4) return Math.floor(count / 3);
  if (mode === 5 || mode === 6) return Math.max(0, count - 2);
  return 0;
}

function inspectGlb(filePath) {
  const { bytes, json } = readGlbJson(filePath);
  const accessors = json.accessors ?? [];
  const meshes = json.meshes ?? [];
  const nodes = json.nodes ?? [];
  const scene = json.scenes?.[json.scene ?? 0];
  let triangles = 0;
  let drawPrimitives = 0;
  let meshNodes = 0;

  const visit = (nodeIndex) => {
    const node = nodes[nodeIndex];
    if (!node) return;
    if (node.mesh !== undefined) {
      meshNodes += 1;
      for (const primitive of meshes[node.mesh]?.primitives ?? []) {
        triangles += primitiveTriangles(primitive, accessors);
        drawPrimitives += 1;
      }
    }
    for (const child of node.children ?? []) visit(child);
  };

  for (const node of scene?.nodes ?? []) visit(node);

  return {
    triangles,
    drawPrimitives,
    meshNodes,
    materials: json.materials?.length ?? 0,
    textures: json.textures?.length ?? 0,
    megabytes: bytes / 1024 / 1024,
  };
}

const placementCounts = ENVIRONMENT_PLACEMENTS.reduce((counts, placement) => {
  counts[placement.model] = (counts[placement.model] ?? 0) + 1;
  return counts;
}, {});

const assets = [
  ["terrain", ASSET_PATHS.terrain, 1],
  ["character", ASSET_PATHS.character, 1],
  ["bridge", ASSET_PATHS.bridge, 1],
  ...Object.entries(ENVIRONMENT_ASSET_PATHS).map(([name, assetPath]) => [
    name,
    assetPath,
    name === "background" ? 1 : placementCounts[name] ?? 0,
  ]),
];

const rows = assets.map(([name, assetPath, instances]) => {
  const cleanPath = assetPath.trim();
  const filePath = path.join("public", cleanPath.replace(/^\//, ""));
  const stats = inspectGlb(filePath);
  return {
    name,
    file: path.basename(filePath),
    instances,
    trianglesEach: stats.triangles,
    trianglesPlaced: stats.triangles * instances,
    drawPrimitivesEach: stats.drawPrimitives,
    meshNodesEach: stats.meshNodes,
    materials: stats.materials,
    textures: stats.textures,
    megabytes: Number(stats.megabytes.toFixed(2)),
  };
});

rows.sort((a, b) => b.trianglesPlaced - a.trianglesPlaced);
console.table(rows);
console.log(JSON.stringify(rows, null, 2));
