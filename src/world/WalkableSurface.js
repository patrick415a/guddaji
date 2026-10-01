import * as THREE from "three";

const TRIANGLE_STRIDE = 9;
const BARYCENTRIC_EPSILON = -0.00001;

export class WalkableSurface {
  constructor(objects, { cellSize, maxSlopeDegrees, heightMode = "highest" }) {
    this.cellSize = cellSize;
    this.heightMode = heightMode;
    this.minimumGroundNormal = Math.cos(
      THREE.MathUtils.degToRad(maxSlopeDegrees),
    );
    this.triangleData = [];
    this.cells = new Map();
    this.objects = Array.isArray(objects) ? objects : [objects];
    this.bounds = new THREE.Box3().makeEmpty();
    this.objects.forEach((object) => this.bounds.expandByObject(object));
    this.width = Math.ceil(
      (this.bounds.max.x - this.bounds.min.x) / this.cellSize,
    ) + 1;

    this.objects.forEach((object) => this.build(object));
    this.triangleData = new Float32Array(this.triangleData);
  }

  build(object) {
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const edgeA = new THREE.Vector3();
    const edgeB = new THREE.Vector3();
    const normal = new THREE.Vector3();

    object.updateMatrixWorld(true);
    object.traverse((child) => {
      if (!child.isMesh) return;

      const position = child.geometry.attributes.position;
      const index = child.geometry.index;
      const triangleCount = index ? index.count / 3 : position.count / 3;

      for (let triangle = 0; triangle < triangleCount; triangle += 1) {
        const offset = triangle * 3;
        const indexA = index ? index.getX(offset) : offset;
        const indexB = index ? index.getX(offset + 1) : offset + 1;
        const indexC = index ? index.getX(offset + 2) : offset + 2;

        a.fromBufferAttribute(position, indexA).applyMatrix4(child.matrixWorld);
        b.fromBufferAttribute(position, indexB).applyMatrix4(child.matrixWorld);
        c.fromBufferAttribute(position, indexC).applyMatrix4(child.matrixWorld);
        edgeA.subVectors(b, a);
        edgeB.subVectors(c, a);
        normal.crossVectors(edgeA, edgeB).normalize();

        if (normal.y < this.minimumGroundNormal) continue;

        const triangleIndex = this.triangleData.length / TRIANGLE_STRIDE;
        this.triangleData.push(
          a.x, a.y, a.z,
          b.x, b.y, b.z,
          c.x, c.y, c.z,
        );
        this.addTriangleToCells(triangleIndex, a, b, c);
      }
    });
  }

  addTriangleToCells(triangleIndex, a, b, c) {
    const minCellX = this.getCellX(Math.min(a.x, b.x, c.x));
    const maxCellX = this.getCellX(Math.max(a.x, b.x, c.x));
    const minCellZ = this.getCellZ(Math.min(a.z, b.z, c.z));
    const maxCellZ = this.getCellZ(Math.max(a.z, b.z, c.z));

    for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        const key = this.getCellKey(cellX, cellZ);
        const cell = this.cells.get(key);

        if (cell) cell.push(triangleIndex);
        else this.cells.set(key, [triangleIndex]);
      }
    }
  }

  getHeightAt(x, z) {
    if (
      x < this.bounds.min.x || x > this.bounds.max.x ||
      z < this.bounds.min.z || z > this.bounds.max.z
    ) {
      return null;
    }

    const cell = this.cells.get(
      this.getCellKey(this.getCellX(x), this.getCellZ(z)),
    );
    if (!cell) return null;

    let selectedHeight = null;
    for (const triangleIndex of cell) {
      const height = this.getTriangleHeight(triangleIndex, x, z);
      const shouldReplace = this.heightMode === "lowest"
        ? selectedHeight === null || height < selectedHeight
        : selectedHeight === null || height > selectedHeight;

      if (height !== null && shouldReplace) {
        selectedHeight = height;
      }
    }

    return selectedHeight;
  }

  getTriangleHeight(triangleIndex, x, z) {
    const offset = triangleIndex * TRIANGLE_STRIDE;
    const data = this.triangleData;
    const ax = data[offset];
    const ay = data[offset + 1];
    const az = data[offset + 2];
    const bx = data[offset + 3];
    const by = data[offset + 4];
    const bz = data[offset + 5];
    const cx = data[offset + 6];
    const cy = data[offset + 7];
    const cz = data[offset + 8];
    const denominator = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);

    if (Math.abs(denominator) < Number.EPSILON) return null;

    const weightA = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / denominator;
    const weightB = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / denominator;
    const weightC = 1 - weightA - weightB;

    if (
      weightA < BARYCENTRIC_EPSILON ||
      weightB < BARYCENTRIC_EPSILON ||
      weightC < BARYCENTRIC_EPSILON
    ) {
      return null;
    }

    return weightA * ay + weightB * by + weightC * cy;
  }

  getCellX(x) {
    return Math.floor((x - this.bounds.min.x) / this.cellSize);
  }

  getCellZ(z) {
    return Math.floor((z - this.bounds.min.z) / this.cellSize);
  }

  getCellKey(cellX, cellZ) {
    return cellX + cellZ * this.width;
  }
}
